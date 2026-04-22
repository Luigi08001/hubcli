/**
 * Tests for Codex-reported bugs: vault bypass, 404 remap, safeJson body, sync state.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { encryptVault } from "../src/core/vault.js";

// ---------------------------------------------------------------------------
// P1: Vault bypass — encrypted vault without passphrase must throw, not fallback
// ---------------------------------------------------------------------------
describe("vault passphrase enforcement in auth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_VAULT_PASSPHRASE;
  });

  function makeEncryptedHome(): string {
    const home = mkdtempSync(join(tmpdir(), "hscli-vault-enforce-"));
    const dir = join(home, ".hscli");
    mkdirSync(dir, { recursive: true });
    // Create an auth.enc to signal vault is encrypted
    // Also create auth.json to verify it does NOT fall back to it
    writeFileSync(join(dir, "auth.json"), JSON.stringify({
      profiles: { default: { token: "plaintext-leak" } },
    }));
    // Use real encryption for auth.enc
    const data = JSON.stringify({ profiles: { default: { token: "encrypted-token" } } });
    const encrypted = encryptVault(data, "test-pass");
    writeFileSync(join(dir, "auth.enc"), encrypted);
    process.env.HSCLI_HOME = dir;
    return dir;
  }

  it("readAuthFile throws VAULT_PASSPHRASE_REQUIRED when vault encrypted and no passphrase", async () => {
    makeEncryptedHome();
    // No HSCLI_VAULT_PASSPHRASE set
    const { getToken } = await import("../src/core/auth.js");
    expect(() => getToken("default")).toThrow("Vault is encrypted");
  });

  it("saveToken throws VAULT_PASSPHRASE_REQUIRED when vault encrypted and no passphrase", async () => {
    makeEncryptedHome();
    const { saveToken } = await import("../src/core/auth.js");
    expect(() => saveToken("default", "new-token")).toThrow("Vault is encrypted");
  });

  it("does NOT create plaintext auth.json when vault is encrypted", async () => {
    const dir = makeEncryptedHome();
    const { saveToken } = await import("../src/core/auth.js");
    try { saveToken("default", "leaked-token"); } catch { /* expected */ }
    // auth.json should still have the original content, not the new token
    const content = JSON.parse(readFileSync(join(dir, "auth.json"), "utf8"));
    expect(content.profiles.default.token).toBe("plaintext-leak");
    expect(content.profiles.default.token).not.toBe("leaked-token");
  });

  it("reads encrypted vault when passphrase IS provided", async () => {
    makeEncryptedHome();
    process.env.HSCLI_VAULT_PASSPHRASE = "test-pass";
    const { getToken } = await import("../src/core/auth.js");
    expect(getToken("default")).toBe("encrypted-token");
  });
});

// ---------------------------------------------------------------------------
// P1: 404 on record-level path should NOT be remapped to ENDPOINT_NOT_AVAILABLE
// ---------------------------------------------------------------------------
describe("404 record-not-found vs endpoint unavailable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_VAULT_PASSPHRASE;
  });

  function setupHome(): void {
    const home = mkdtempSync(join(tmpdir(), "hscli-404-"));
    const dir = join(home, ".hscli");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "auth.json"), JSON.stringify({
      profiles: { default: { token: "test-token" } },
    }));
    process.env.HSCLI_HOME = dir;
  }

  it("record-level 404 returns HTTP_ERROR, not ENDPOINT_NOT_AVAILABLE", async () => {
    setupHome();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ status: "error", message: "resource not found" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "crm", "contacts", "get", "99999999"]);

    const errors = errSpy.mock.calls.map((c) => String(c[0]));
    const hasHttpError = errors.some((e) => e.includes("HTTP_ERROR"));
    const hasEndpointNotAvailable = errors.some((e) => e.includes("ENDPOINT_NOT_AVAILABLE"));
    expect(hasHttpError).toBe(true);
    expect(hasEndpointNotAvailable).toBe(false);
  });

  it("collection-level 404 still maps to ENDPOINT_NOT_AVAILABLE", async () => {
    setupHome();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: "not found" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "marketing", "emails", "list"]);

    const errors = errSpy.mock.calls.map((c) => String(c[0]));
    expect(errors.some((e) => e.includes("ENDPOINT_NOT_AVAILABLE"))).toBe(true);
  });

  it("403 on record-level path still maps to ENDPOINT_NOT_AVAILABLE", async () => {
    setupHome();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ message: "forbidden" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "crm", "contacts", "get", "123"]);

    const errors = errSpy.mock.calls.map((c) => String(c[0]));
    expect(errors.some((e) => e.includes("ENDPOINT_NOT_AVAILABLE"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P2: safeJson should not throw "Body is unusable" on non-JSON responses
// ---------------------------------------------------------------------------
describe("safeJson handles non-JSON responses", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_VAULT_PASSPHRASE;
  });

  it("returns HTML body as message when response is not JSON", async () => {
    const home = mkdtempSync(join(tmpdir(), "hscli-safejson-"));
    const dir = join(home, ".hscli");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "auth.json"), JSON.stringify({
      profiles: { default: { token: "test-token" } },
    }));
    process.env.HSCLI_HOME = dir;

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const htmlBody = "<html><body>Unprocessable Entity</body></html>";
    // Use 422 (not 5xx) to avoid retry loop that causes timeout
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => htmlBody,
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "crm", "contacts", "list"]);

    // Should NOT throw TypeError: Body is unusable
    // Should show HTTP_ERROR with the HTML message
    const errors = errSpy.mock.calls.map((c) => String(c[0]));
    expect(errors.some((e) => e.includes("HTTP_ERROR"))).toBe(true);
    expect(errors.some((e) => e.includes("Body is unusable"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P2: sync state persistence — cursor and mode tracking
// ---------------------------------------------------------------------------
describe("sync state persistence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_VAULT_PASSPHRASE;
  });

  function setupSyncTest(): { dir: string; stateFile: string } {
    const home = mkdtempSync(join(tmpdir(), "hscli-sync-"));
    const dir = join(home, ".hscli");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "auth.json"), JSON.stringify({
      profiles: { default: { token: "test-token" } },
    }));
    process.env.HSCLI_HOME = dir;
    const stateFile = join(home, "sync-state.json");
    return { dir, stateFile };
  }

  it("saves mode in state file", async () => {
    const { stateFile } = setupSyncTest();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [{ id: "1" }], paging: {} }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "crm", "sync", "pull", "contacts", "--state-file", stateFile, "--max-pages", "1"]);

    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    expect(state.mode).toBe("list");
    expect(state.lastRunAt).toBeTruthy();
  });

  it("saves mode=since when --since is used", async () => {
    const { stateFile } = setupSyncTest();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [{ id: "1" }], paging: {} }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "crm", "sync", "pull", "contacts", "--state-file", stateFile, "--since", "2026-01-01T00:00:00Z", "--max-pages", "1"]);

    const state = JSON.parse(readFileSync(stateFile, "utf8"));
    expect(state.mode).toBe("since");
    expect(state.lastSince).toBe("2026-01-01T00:00:00Z");
  });

  it("does not reuse --since cursor for list mode", async () => {
    const { stateFile } = setupSyncTest();
    // Seed a state from a previous --since run with a cursor
    writeFileSync(stateFile, JSON.stringify({
      after: "since-cursor-42",
      mode: "since",
      lastRunAt: "2026-01-01T00:00:00Z",
      lastSince: "2025-12-01T00:00:00Z",
    }));

    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ results: [], paging: {} }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    // Run WITHOUT --since — should NOT use the since-cursor
    await run(["node", "hscli", "crm", "sync", "pull", "contacts", "--state-file", stateFile, "--max-pages", "1"]);

    const [url] = fetchSpy.mock.calls[0];
    // Should not contain the old since cursor
    expect(String(url)).not.toContain("since-cursor-42");
  });
});
