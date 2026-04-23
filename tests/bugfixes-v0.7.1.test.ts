/**
 * Regression tests for Codex-reported bugs landed in v0.7.1:
 *
 *  1. P1 — getHscliHomeDir ignores auth.enc (primary silently skipped
 *          in favor of plaintext auth.json when both existed).
 *  2. P2 — policy windows evaluated in UTC instead of window.tz (or
 *          local when omitted), causing day-boundary misfires.
 *  3. P2 — MCP executeTool never tagged toolName in telemetry.
 *  4. P2 — trace session options (includeBodies, scope) written but
 *          never enforced by the HTTP layer.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { encryptVault } from "../src/core/vault.js";

// ───────────────────────────────────────────────────────────────────────────
// #1 P1: getHscliHomeDir must honor auth.enc + respect HSCLI_HOME
// ───────────────────────────────────────────────────────────────────────────
describe("getHscliHomeDir — config-dir resolution", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
  });

  it("returns $HSCLI_HOME when explicitly set", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "hscli-home-explicit-"));
    process.env.HSCLI_HOME = fakeHome;
    try {
      const { getHscliHomeDir } = await import("../src/core/auth.js");
      expect(getHscliHomeDir()).toBe(fakeHome);
    } finally {
      delete process.env.HSCLI_HOME;
    }
  });

  it("defaults to ~/.revfleet/ when $HSCLI_HOME is unset", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "hscli-home-default-"));
    const origHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      const { getHscliHomeDir } = await import("../src/core/auth.js");
      expect(getHscliHomeDir()).toBe(join(fakeHome, ".revfleet"));
    } finally {
      if (origHome === undefined) delete process.env.HOME;
      else process.env.HOME = origHome;
    }
  });

  it("encrypted vault unlocks with passphrase (primary location)", async () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "hscli-home-enc-"));
    const primary = join(fakeHome, ".revfleet");
    mkdirSync(primary, { recursive: true });
    const encrypted = encryptVault(
      JSON.stringify({ profiles: { default: { token: "encrypted-token" } } }),
      "pw",
    );
    writeFileSync(join(primary, "auth.enc"), encrypted);
    const origHome = process.env.HOME;
    process.env.HOME = fakeHome;
    process.env.HSCLI_VAULT_PASSPHRASE = "pw";
    try {
      const { getToken } = await import("../src/core/auth.js");
      expect(getToken("default")).toBe("encrypted-token");
    } finally {
      delete process.env.HSCLI_VAULT_PASSPHRASE;
      if (origHome === undefined) delete process.env.HOME;
      else process.env.HOME = origHome;
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #3 P2: policy window must be evaluated in window.tz (or local when
//        omitted), not UTC. The old code could allow a write on a
//        Saturday local time that was still Friday UTC.
// ───────────────────────────────────────────────────────────────────────────
describe("policy window — timezone correctness", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  function writePolicy(body: unknown): string {
    const dir = mkdtempSync(join(tmpdir(), "hscli-pol-tz-"));
    const file = join(dir, "policy.json");
    writeFileSync(file, JSON.stringify(body), "utf8");
    return file;
  }

  function withFixedDate(iso: string, fn: () => void): void {
    const realDate = Date;
    const fixed = new realDate(iso);
     
    (globalThis as any).Date = class extends realDate {
      constructor() { super(); return fixed; }
      static now() { return fixed.getTime(); }
    };
    try { fn(); } finally {
       
      (globalThis as any).Date = realDate;
    }
  }

  it("mon-fri in US/Eastern still allows write late Friday US/Eastern (even if UTC is Saturday)", async () => {
    // 2026-04-18T02:30:00Z is Friday 22:30 US/Eastern (still in window)
    // but Saturday in UTC. Old code blocked; new code must allow.
    const f = writePolicy({
      version: 2,
      profiles: {
        default: {
          rules: [{
            name: "weekdays",
            match: { method: "POST", path: "**" },
            action: "allow",
            window: { tz: "US/Eastern", days: "mon-fri" },
          }],
        },
      },
    });
    const { enforceWritePolicy } = await import("../src/core/policy.js");
    const { CliError } = await import("../src/core/output.js");
    void CliError;
    const ctx = {
      profile: "default", json: false, dryRun: false, force: true,
      strictCapabilities: false, format: "json" as const, policyFile: f,
    };
    withFixedDate("2026-04-18T02:30:00Z", () => {
      expect(() => enforceWritePolicy(ctx, "POST", "/x")).not.toThrow();
    });
  });

  it("mon-fri in US/Eastern blocks Saturday morning US/Eastern (which is Saturday UTC too)", async () => {
    const f = writePolicy({
      version: 2,
      profiles: {
        default: {
          rules: [{
            name: "weekdays",
            match: { method: "POST", path: "**" },
            action: "allow",
            window: { tz: "US/Eastern", days: "mon-fri" },
          }],
        },
      },
    });
    const { enforceWritePolicy } = await import("../src/core/policy.js");
    const ctx = {
      profile: "default", json: false, dryRun: false, force: true,
      strictCapabilities: false, format: "json" as const, policyFile: f,
    };
    withFixedDate("2026-04-18T14:30:00Z", () => {
      expect(() => enforceWritePolicy(ctx, "POST", "/x"))
        .toThrowError(/outside its allowed time window/i);
    });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #4 P2: MCP tool invocations must tag toolName in telemetry.
// ───────────────────────────────────────────────────────────────────────────
 
type ToolCallback = (args: any) => Promise<any>;
class MockMcpServer {
  public tools = new Map<string, ToolCallback>();
  registerTool(name: string, _config: unknown, cb: ToolCallback): void {
    this.tools.set(name, cb);
  }
}

describe("MCP telemetry — toolName tagging", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_TELEMETRY_FILE;
    delete process.env.HSCLI_MCP_TOOL_NAME;
  });

  function setupMcpHome(): string {
    const home = mkdtempSync(join(tmpdir(), "hscli-mcp-tel-"));
    const dir = join(home, ".revfleet");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "auth.json"),
      JSON.stringify({ profiles: { default: { token: "t" } } }),
    );
    process.env.HSCLI_HOME = dir;
    process.env.HOME = home;
    return home;
  }

  it("crm_contacts_list records toolName in the telemetry event", async () => {
    const home = setupMcpHome();
    const telemetryFile = join(home, "trace.jsonl");
    process.env.HSCLI_TELEMETRY_FILE = telemetryFile;

    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [] }),
      headers: new Headers(),
    } as never);

    const { registerHubSpotTools } = await import("../src/mcp/server.js");
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const cb = mock.tools.get("crm_contacts_list");
    expect(cb, "crm_contacts_list tool must be registered").toBeDefined();
    await cb!({ limit: 1 });

    expect(existsSync(telemetryFile)).toBe(true);
    const lines = readFileSync(telemetryFile, "utf8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const event = JSON.parse(lines[lines.length - 1]) as { toolName?: string };
    expect(event.toolName).toBe("crm_contacts_list");
  });

  it("HSCLI_MCP_TOOL_NAME is cleared after the handler returns", async () => {
    setupMcpHome();
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [] }),
      headers: new Headers(),
    } as never);

    const { registerHubSpotTools } = await import("../src/mcp/server.js");
    const mock = new MockMcpServer();

    registerHubSpotTools(mock as any);
    await mock.tools.get("crm_contacts_list")!({ limit: 1 });
    expect(process.env.HSCLI_MCP_TOOL_NAME).toBeUndefined();
  });

  it("changeTicket from MCP args is written into the telemetry event", async () => {
    const home = setupMcpHome();
    const telemetryFile = join(home, "trace.jsonl");
    process.env.HSCLI_TELEMETRY_FILE = telemetryFile;

    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "1" }),
      headers: new Headers(),
    } as never);

    const { registerHubSpotTools } = await import("../src/mcp/server.js");
    const mock = new MockMcpServer();

    registerHubSpotTools(mock as any);
    const cb = mock.tools.get("crm_contacts_list");
    expect(cb, "crm_contacts_list tool must be registered").toBeDefined();
    await cb!({ limit: 1, changeTicket: "OPS-42" });

    expect(existsSync(telemetryFile)).toBe(true);
    const lines = readFileSync(telemetryFile, "utf8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const event = JSON.parse(lines[lines.length - 1]) as { toolName?: string; changeTicket?: string };
    expect(event.toolName).toBe("crm_contacts_list");
    expect(event.changeTicket).toBe("OPS-42");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// #5 P2: Trace session options (scope, includeBodies) must be enforced.
// ───────────────────────────────────────────────────────────────────────────
describe("trace session — scope + includeBodies enforcement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_TELEMETRY_FILE;
    delete process.env.HSCLI_TRACE_BODIES;
    delete process.env.HSCLI_MCP_TOOL_NAME;
  });

  function setup(sessionExtras: Record<string, unknown>): { dir: string; traceFile: string } {
    const home = mkdtempSync(join(tmpdir(), "hscli-trace-enf-"));
    const dir = join(home, ".revfleet");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "auth.json"),
      JSON.stringify({ profiles: { default: { token: "t" } } }),
    );
    const traceFile = join(dir, "trace.jsonl");
    writeFileSync(join(dir, "trace-session.json"), JSON.stringify({
      file: traceFile,
      startedAt: new Date().toISOString(),
      ...sessionExtras,
    }));
    process.env.HSCLI_HOME = dir;
    process.env.HOME = home;
    return { dir, traceFile };
  }

  it("scope=write filters out GET requests from the trace file", async () => {
    const { traceFile } = setup({ scope: "write", includeBodies: false });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "crm", "contacts", "list", "--limit", "1"]);

    // GET should not be recorded under scope=write.
    const content = existsSync(traceFile) ? readFileSync(traceFile, "utf8").trim() : "";
    expect(content).toBe("");
  });

  it("scope=read filters out POST/PATCH/DELETE requests", async () => {
    const { traceFile } = setup({ scope: "read", includeBodies: false });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "1" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run([
      "node", "hscli", "--force",
      "crm", "contacts", "create",
      "--data", '{"properties":{"email":"x@example.com"}}',
    ]);

    const content = existsSync(traceFile) ? readFileSync(traceFile, "utf8").trim() : "";
    expect(content).toBe("");
  });

  it("scope=all records every request", async () => {
    const { traceFile } = setup({ scope: "all", includeBodies: false });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "crm", "contacts", "list", "--limit", "1"]);

    const lines = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(1);
  });

  it("includeBodies=true captures responseBody in the telemetry event", async () => {
    const { traceFile } = setup({ scope: "all", includeBodies: true });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [{ id: "abc" }] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "crm", "contacts", "list", "--limit", "1"]);

    const lines = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);
    const event = JSON.parse(lines[lines.length - 1]) as { responseBody?: { results?: unknown[] } };
    expect(event.responseBody).toBeDefined();
    expect(event.responseBody?.results).toEqual([{ id: "abc" }]);
  });

  it("includeBodies=false omits bodies even when the write has a body", async () => {
    const { traceFile } = setup({ scope: "all", includeBodies: false });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "new-id" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run([
      "node", "hscli", "--force",
      "crm", "contacts", "create",
      "--data", '{"properties":{"email":"secret@example.com"}}',
    ]);

    const lines = readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean);
    const event = JSON.parse(lines[lines.length - 1]) as { requestBody?: unknown; responseBody?: unknown };
    expect(event.requestBody).toBeUndefined();
    expect(event.responseBody).toBeUndefined();
  });
});

// Silence unused import lint warnings (homedir used by some platforms only)
void homedir;
