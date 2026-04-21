import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const enabled = process.env.HSCLI_ENABLE_SANDBOX_CONTRACT === "1";

const maybeDescribe = enabled ? describe : describe.skip;

function setupSandboxProfile(): { home: string; token: string } {
  const token = process.env.HSCLI_SANDBOX_TOKEN;
  if (!token) {
    throw new Error("HSCLI_SANDBOX_TOKEN is required when HSCLI_ENABLE_SANDBOX_CONTRACT=1");
  }

  const home = mkdtempSync(join(tmpdir(), "hscli-contract-"));
  const dir = join(home, ".revfleet");
  mkdirSync(dir, { recursive: true });

  // Detect hublet from token prefix for proper routing
  const hubletMatch = token.match(/^pat-([a-z0-9]+)-/);
  const hublet = hubletMatch && hubletMatch[1] !== "na1" ? hubletMatch[1] : undefined;
  const apiDomain = hublet ? `api-${hublet}.hubapi.com` : "api.hubapi.com";

  const profileData: Record<string, unknown> = { token };
  if (hublet) {
    profileData.hublet = hublet;
    profileData.apiDomain = apiDomain;
  }

  writeFileSync(
    join(dir, "auth.json"),
    JSON.stringify({ profiles: { sandbox: profileData } }),
  );
  process.env.HOME = home;
  process.env.HSCLI_HOME = dir;

  return { home, token };
}

maybeDescribe("sandbox contract (opt-in)", () => {
  // ────────────────────────────────────────────
  // CRM object read smoke tests
  // ────────────────────────────────────────────

  it("contacts list returns valid schema", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "crm", "contacts", "list", "--limit", "1"]);

    const output = unwrap(spy.getOutput());
    expect(output).toHaveProperty("results");
    expect(Array.isArray(output.results)).toBe(true);
  });

  it("companies list returns valid schema", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "crm", "companies", "list", "--limit", "1"]);

    const output = unwrap(spy.getOutput());
    expect(output).toHaveProperty("results");
  });

  it("deals list returns valid schema", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "crm", "deals", "list", "--limit", "1"]);

    const output = unwrap(spy.getOutput());
    expect(output).toHaveProperty("results");
  });

  it("tickets list returns valid schema", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "crm", "tickets", "list", "--limit", "1"]);

    const output = unwrap(spy.getOutput());
    expect(output).toHaveProperty("results");
  });

  // ────────────────────────────────────────────
  // Properties / pipelines / owners
  // ────────────────────────────────────────────

  it("properties list returns valid schema for contacts", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "crm", "properties", "list", "contacts"]);

    const output = unwrap(spy.getOutput());
    expect(output).toHaveProperty("results");
    if (output.results.length > 0) {
      expect(output.results[0]).toHaveProperty("name");
      expect(output.results[0]).toHaveProperty("label");
    }
  });

  it("pipelines list returns valid schema for deals", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "crm", "pipelines", "list", "deals"]);

    const output = unwrap(spy.getOutput());
    expect(output).toHaveProperty("results");
  });

  it("owners list returns valid schema", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "crm", "owners", "list", "--limit", "5"]);

    const output = unwrap(spy.getOutput());
    expect(output).toHaveProperty("results");
  });

  // ────────────────────────────────────────────
  // Dry-run write safety (no actual writes)
  // ────────────────────────────────────────────

  it("contact create dry-run outputs request preview without sending", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run([
      "node", "hscli", "--profile", "sandbox", "--json",
      "crm", "contacts", "create",
      "--data", '{"properties":{"email":"dryrun@test.hscli.dev","firstname":"DryRun"}}',
      "--dry-run",
    ]);

    const output = unwrap(spy.getOutput());
    expect(output).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "/crm/v3/objects/contacts",
    });
  });

  // ────────────────────────────────────────────
  // No token leakage
  // ────────────────────────────────────────────

  it("no token or authorization value appears in JSON output", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const stdoutSpy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "crm", "contacts", "list", "--limit", "1"]);

    const raw = JSON.stringify(stdoutSpy.getOutput());
    expect(raw).not.toContain(process.env.HSCLI_SANDBOX_TOKEN!);
    expect(raw).not.toMatch(/Bearer\s+[a-zA-Z0-9_-]+/);
  });

  // ────────────────────────────────────────────
  // Domain commands
  // ────────────────────────────────────────────

  it("forms list returns valid schema", async () => {
    setupSandboxProfile();
    const { run } = await import("../src/cli.js");
    const spy = capturePrintResult();

    await run(["node", "hscli", "--profile", "sandbox", "--json", "forms", "list", "--limit", "1"]);

    const output = unwrap(spy.getOutput());
    expect(output).toHaveProperty("results");
  });
});

/** Unwrap the CLI's `{ ok: true, data: <payload> }` envelope. */
function unwrap(raw: any): any {
  if (raw && typeof raw === "object" && "ok" in raw && "data" in raw) return raw.data;
  return raw;
}

/**
 * Capture output from printResult by intercepting console.log / process.stdout.write.
 * Works for both JSON and non-JSON modes.
 */
function capturePrintResult() {
  const captured: string[] = [];

  const originalLog = console.log;

  console.log = (...args: any[]) => {
    captured.push(args.map(String).join(" "));
  };

  return {
    getOutput(): any {
      console.log = originalLog;
      const raw = captured.join("\n");
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    },
    getRaw(): string {
      console.log = originalLog;
      return captured.join("\n");
    },
  };
}
