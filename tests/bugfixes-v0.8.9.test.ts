/**
 * Regression tests for v0.8.9 audit findings (PR #43 + follow-up #44).
 *
 *  1. P1 — `auth token-info` must never write the token into trace/audit JSONL
 *          even though the HubSpot endpoint embeds the token in the URL path.
 *  2. P1 — `--include-bodies` must run every body through `redactSensitive`
 *          before persistence; the trace-help text advertises this guarantee.
 *  3. P2 — `--change-ticket` on the CLI path must surface in telemetry even
 *          for non-MCP commands (preAction env bridge, not just ALS).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface TelemetryEvent {
  ts?: string;
  method?: string;
  path?: string;
  status?: number;
  toolName?: string;
  changeTicket?: string;
  requestBody?: unknown;
  responseBody?: unknown;
}

function setupHome(): { home: string; revfleetDir: string; traceFile: string } {
  const home = mkdtempSync(join(tmpdir(), "hscli-0.8.9-"));
  const revfleetDir = join(home, ".revfleet");
  mkdirSync(revfleetDir, { recursive: true });
  writeFileSync(
    join(revfleetDir, "auth.json"),
    JSON.stringify({ profiles: { default: { token: "pat-na1-deadbeef-cafe-babe" } } }),
  );
  const traceFile = join(revfleetDir, "trace.jsonl");
  process.env.HSCLI_HOME = revfleetDir;
  process.env.HOME = home;
  return { home, revfleetDir, traceFile };
}

function readTrace(path: string): TelemetryEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TelemetryEvent);
}

describe("security regression — 0.8.9 audit findings", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_TELEMETRY_FILE;
    delete process.env.HSCLI_TRACE_BODIES;
    delete process.env.HSCLI_MCP_TOOL_NAME;
    delete process.env.HSCLI_CHANGE_TICKET;
    delete process.env.HOME;
  });

  // #1 — auth token-info path must be redacted before it hits disk.
  it("auth token-info request path never writes the raw token to telemetry", async () => {
    const { traceFile } = setupHome();
    process.env.HSCLI_TELEMETRY_FILE = traceFile;

    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ scopes: [] }),
      headers: new Headers(),
    } as never);

    const { createClient } = await import("../src/core/http.js");
    const client = createClient("default");
    // Mimic `hscli auth token-info` — the token is URL-encoded into
    // the path segment, which is the exact leak vector the audit
    // flagged.
    const token = "pat-na1-deadbeef-cafe-babe";
    await client.request(`/oauth/v1/access-tokens/${encodeURIComponent(token)}`);

    const events = readTrace(traceFile);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.path ?? "").not.toContain(token);
      // And the redaction should take the shape we promise.
      if ((event.path ?? "").startsWith("/oauth/v1/access-tokens/")) {
        expect(event.path).toBe("/oauth/v1/access-tokens/[REDACTED]");
      }
    }
  });

  // #2 — --include-bodies must redact secrets inside request/response.
  it("trace --include-bodies redacts secrets inside request/response bodies", async () => {
    const { revfleetDir, traceFile } = setupHome();
    // Simulate an active trace session with includeBodies=true.
    writeFileSync(join(revfleetDir, "trace-session.json"), JSON.stringify({
      file: traceFile,
      startedAt: new Date().toISOString(),
      includeBodies: true,
      scope: "all",
    }));

    const secretInBody = "pat-na1-super-secret-token-0123456789";
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        token: secretInBody,
        safe_field: "hello",
      }),
      headers: new Headers(),
    } as never);

    const { createClient } = await import("../src/core/http.js");
    const client = createClient("default");
    await client.request("/crm/v3/objects/contacts", {
      method: "POST",
      body: { password: secretInBody, name: "not secret" },
    });

    const events = readTrace(traceFile).filter((e) => e.method === "POST");
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    const raw = JSON.stringify(last);
    // The raw secret must not appear anywhere — neither in requestBody
    // nor in responseBody.
    expect(raw).not.toContain(secretInBody);
    // The redacted record should be present.
    expect(raw).toMatch(/\[REDACTED\]/);
  });

  // #3 — --change-ticket from CLI flag must reach telemetry too.
  it("CLI path: HSCLI_CHANGE_TICKET env bridge surfaces changeTicket in telemetry", async () => {
    const { traceFile } = setupHome();
    process.env.HSCLI_TELEMETRY_FILE = traceFile;
    process.env.HSCLI_CHANGE_TICKET = "OPS-CHANGE-777";

    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [] }),
      headers: new Headers(),
    } as never);

    const { createClient } = await import("../src/core/http.js");
    const client = createClient("default");
    // No MCP, no ALS — pure CLI code path. The fallback env read inside
    // emitTelemetry is what's under test here.
    await client.request("/crm/v3/objects/contacts?limit=1");

    const events = readTrace(traceFile);
    expect(events.length).toBeGreaterThan(0);
    expect(events[events.length - 1].changeTicket).toBe("OPS-CHANGE-777");
  });
});
