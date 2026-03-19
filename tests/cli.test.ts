import { beforeEach, describe, expect, it, vi } from "vitest";
import { chmodSync, mkdtempSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError, printError, redactSensitive, type CliContext } from "../src/core/output.js";

function setupHomeWithToken(
  profile = "default",
  token = "test-token",
  extras: Record<string, unknown> = {},
): string {
  const home = mkdtempSync(join(tmpdir(), "hubcli-test-"));
  const dir = join(home, ".hubcli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles: { [profile]: { token, ...extras } } }));
  process.env.HUBCLI_HOME = dir;
  return home;
}

describe("hubcli", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HUBCLI_HOME;
    delete process.env.HUBCLI_PROFILE;
    delete process.env.HUBCLI_STRICT_CAPABILITIES;
    delete process.env.HUBCLI_REQUEST_ID;
    delete process.env.HUBCLI_TELEMETRY_FILE;
  });

  it("parses global flags", async () => {
    const home = setupHomeWithToken("team");
    process.env.HOME = home;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--json", "--profile", "team", "crm", "contacts", "list", "--limit", "1"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalled();
    const output = String(logSpy.mock.calls[0][0]);
    expect(output).toContain('"ok": true');
  });

  it("contacts list supports pagination/filter flags", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hubcli",
      "crm",
      "contacts",
      "list",
      "--limit",
      "5",
      "--after",
      "abc123",
      "--archived",
      "true",
      "--properties",
      "firstname,email",
    ]);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/crm/v3/objects/contacts?");
    expect(String(url)).toContain("limit=5");
    expect(String(url)).toContain("after=abc123");
    expect(String(url)).toContain("archived=true");
    expect(String(url)).toContain("properties=firstname%2Cemail");
  });

  it("tickets list routes to tickets endpoint", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "tickets", "list", "--limit", "2"]);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/crm/v3/objects/tickets?");
    expect(String(url)).toContain("limit=2");
  });

  it("forms list routes to marketing forms endpoint", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "forms", "list", "--limit", "2"]);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/marketing/v3/forms?");
    expect(String(url)).toContain("limit=2");
  });

  it("strict capabilities mode fails fast when capability status is unknown", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--strict-capabilities", "marketing", "emails", "list"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("CAPABILITY_UNKNOWN"))).toBe(true);
  });

  it("capability cache blocks unsupported endpoints before network call", async () => {
    const home = setupHomeWithToken("default", "test-token", {
      portalId: "12345",
      scopes: ["content.read", "crm.objects.contacts.read"],
    });
    process.env.HOME = home;
    const capabilitiesPath = join(process.env.HUBCLI_HOME!, "capabilities.json");
    writeFileSync(capabilitiesPath, JSON.stringify({
      version: 1,
      entries: [{
        key: "12345|content.read,crm.objects.contacts.read",
        portalId: "12345",
        scopes: ["content.read", "crm.objects.contacts.read"],
        profile: "default",
        probedAt: "2026-03-05T00:00:00.000Z",
        updatedAt: "2026-03-05T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        capabilities: {
          "marketing-emails": {
            status: "unsupported",
            statusCode: 403,
            checkedAt: "2026-03-05T00:00:00.000Z",
            note: "probe-status-403",
          },
        },
      }],
    }), "utf8");

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "marketing", "emails", "list"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("CAPABILITY_UNSUPPORTED"))).toBe(true);
  });

  it("doctor capabilities probes and reports cached capability matrix", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockImplementation(async (url: unknown) => {
      const value = String(url);
      if (value.includes("/oauth/v1/access-tokens/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ hub_id: 98765, scopes: ["content.read", "crm.objects.contacts.read"] }),
          headers: new Headers(),
        } as never;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
        headers: new Headers(),
      } as never;
    });

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--json", "doctor", "capabilities", "--refresh"]);

    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
    const output = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(output.ok).toBe(true);
    expect(output.data.refreshed).toBe(true);
    expect(output.data.summary.supported).toBeGreaterThan(0);
  });

  it("maps 403 endpoint responses to endpoint availability guidance", async () => {
    const home = setupHomeWithToken("default", "test-token", {
      portalId: "12345",
      scopes: ["content.read", "crm.objects.contacts.read"],
    });
    process.env.HOME = home;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: "forbidden" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "marketing", "emails", "list"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("ENDPOINT_NOT_AVAILABLE"))).toBe(true);
  });

  it("dry-run create does not call fetch mutation", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hubcli",
      "--dry-run",
      "crm",
      "contacts",
      "create",
      "--data",
      '{"properties":{"email":"dryrun@example.com"}}',
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
    const output = String(logSpy.mock.calls[0][0]);
    expect(output).toContain("dryRun");
    expect(output).toContain("POST");
    expect(output).toContain("/crm/v3/objects/contacts");
  });

  it("rejects unsupported objectType outside strict allowlist", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hubcli",
      "--dry-run",
      "crm",
      "properties",
      "create",
      "..",
      "--data",
      '{"label":"x"}',
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("UNSUPPORTED_OBJECT_TYPE"))).toBe(true);
  });

  it("rejects unsupported pipeline objectType", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "pipelines", "list", "contacts"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("UNSUPPORTED_OBJECT_TYPE"))).toBe(true);
  });

  it("rejects path traversal-like id segments", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "contacts", "get", "../bad-id"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("INVALID_PATH_SEGMENT"))).toBe(true);
  });

  it("write operations require --force", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "contacts", "create", "--data", '{"properties":{"email":"x@example.com"}}']);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("WRITE_CONFIRMATION_REQUIRED"))).toBe(true);
  });

  it("write operations execute when --force is provided", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "1" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--force", "crm", "contacts", "create", "--data", '{"properties":{"email":"x@example.com"}}']);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("api request write defaults to dry-run when --dry-run is set", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--dry-run", "api", "request", "--method", "POST", "--path", "/marketing/v3/forms", "--data", '{"name":"x"}']);

    expect(fetchSpy).not.toHaveBeenCalled();
    const output = String(logSpy.mock.calls[0][0]);
    expect(output).toContain("dryRun");
    expect(output).toContain("POST");
    expect(output).toContain("/marketing/v3/forms");
  });

  it("policy file can block delete even with --force", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const policyPath = join(home, "policy.json");
    writeFileSync(policyPath, JSON.stringify({ defaults: { allowWrite: true, allowDelete: false } }), "utf8");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--force", "--policy-file", policyPath, "crm", "contacts", "delete", "1"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("POLICY_DELETE_BLOCKED"))).toBe(true);
  });

  it("dry-run associations remove is intercepted", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--dry-run", "crm", "associations", "remove", "contacts", "1", "companies", "2"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    const output = String(logSpy.mock.calls[0][0]);
    expect(output).toContain("DELETE");
    expect(output).toContain('/crm/v4/objects/contacts/1/associations/default/companies/2');
  });

  it("owners list supports cursor and email filtering", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "owners", "list", "--limit", "20", "--after", "A1", "--email", "owner@example.com"]);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/crm/v3/owners/?");
    expect(String(url)).toContain("limit=20");
    expect(String(url)).toContain("after=A1");
    expect(String(url)).toContain("email=owner%40example.com");
  });

  it("imports list supports limit and after", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "imports", "list", "--limit", "25", "--after", "cursor-1"]);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/crm/v3/imports?");
    expect(String(url)).toContain("limit=25");
    expect(String(url)).toContain("after=cursor-1");
  });

  it("imports get calls expected endpoint", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "123" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "imports", "get", "123"]);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/crm/v3/imports/123");
  });

  it("imports errors calls expected endpoint", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "imports", "errors", "123"]);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/crm/v3/imports/123/errors");
  });

  it("imports create dry-run is intercepted", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "imports", "create", "--dry-run", "--data", '{"name":"import-job"}']);

    expect(fetchSpy).not.toHaveBeenCalled();
    const output = String(logSpy.mock.calls[0][0]);
    expect(output).toContain("dryRun");
    expect(output).toContain("POST");
    expect(output).toContain('/crm/v3/imports');
  });

  it("supports --format csv output", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: "1", firstname: "Ada" }] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--format", "csv", "crm", "contacts", "list", "--limit", "1"]);

    const output = String(logSpy.mock.calls[0][0]);
    expect(output).toContain("id,firstname");
    expect(output).toContain("1,Ada");
  });

  it("sets Idempotency-Key on forced write requests", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "1" }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--force", "crm", "contacts", "create", "--data", '{"properties":{"email":"idempotent@example.com"}}']);

    const requestInit = fetchSpy.mock.calls[0][1] as { headers?: Record<string, string> };
    expect(requestInit.headers).toBeDefined();
    expect(requestInit.headers?.["Idempotency-Key"]).toBeTruthy();
  });

  it("webhooks list routes to webhook subscriptions endpoint", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "webhooks", "list", "--app-id", "12345"]);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("/webhooks/v3/12345/subscriptions");
  });

  it("crm describe contacts loads schema metadata", async () => {
    const home = setupHomeWithToken("default", "test-token", {
      portalId: "12345",
      scopes: ["crm.objects.contacts.read"],
    });
    process.env.HOME = home;
    vi.spyOn(console, "log").mockImplementation(() => {});

    const fetchSpy = vi.spyOn(global, "fetch" as never).mockImplementation(async (url: unknown) => {
      const value = String(url);
      if (value.includes("/crm/v3/properties/contacts")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            results: [{
              name: "email",
              label: "Email",
              type: "string",
              required: true,
              options: [],
            }],
          }),
          headers: new Headers(),
        } as never;
      }
      if (value.includes("/crm/v4/associations/contacts/")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ results: [] }),
          headers: new Headers(),
        } as never;
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ message: "not-found" }),
        headers: new Headers(),
      } as never;
    });

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--json", "--format", "json", "crm", "describe", "contacts", "--refresh-cache"]);

    expect(fetchSpy).toHaveBeenCalled();
  });

  it("imports create requires force when not dry-run", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "imports", "create", "--data", '{"name":"import-job"}']);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("WRITE_CONFIRMATION_REQUIRED"))).toBe(true);
  });

  it("returns missing-token auth error", async () => {
    const home = mkdtempSync(join(tmpdir(), "hubcli-no-auth-"));
    process.env.HOME = home;
    process.env.HUBCLI_HOME = join(home, ".hubcli");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "crm", "contacts", "list"]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("AUTH_PROFILE_NOT_FOUND"))).toBe(true);
  });

  it("requires --token or --token-stdin for auth login", async () => {
    const home = mkdtempSync(join(tmpdir(), "hubcli-auth-input-"));
    process.env.HOME = home;
    process.env.HUBCLI_HOME = join(home, ".hubcli");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "auth", "login"]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("AUTH_TOKEN_REQUIRED"))).toBe(true);
  });

  it("locks HUBCLI_HOME directory permissions on auth login", async () => {
    const home = mkdtempSync(join(tmpdir(), "hubcli-auth-perms-"));
    const dir = join(home, ".hubcli");
    mkdirSync(dir, { recursive: true });
    if (process.platform !== "win32") {
      chmodSync(dir, 0o777);
    }
    process.env.HOME = home;
    process.env.HUBCLI_HOME = dir;
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "auth", "login", "--token", "perm-test-token"]);

    if (process.platform !== "win32") {
      expect(statSync(dir).mode & 0o777).toBe(0o700);
    }
    expect(statSync(join(dir, "auth.json")).mode & 0o777).toBe(0o600);
  });

  it("handles malformed JSON payload", async () => {
    const home = setupHomeWithToken();
    process.env.HOME = home;
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--dry-run", "crm", "contacts", "create", "--data", "{bad-json"]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("INVALID_JSON"))).toBe(true);
  });

  it("redacts token-like fields in output sanitization", () => {
    const redacted = redactSensitive({ token: "abc", nested: { Authorization: "Bearer secret123" } });
    expect(redacted).toEqual({ token: "[REDACTED]", nested: { Authorization: "[REDACTED]" } });
  });

  it("redacts bearer string in error output", () => {
    const ctx: CliContext = { profile: "default", json: true, dryRun: false, force: false };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    printError(ctx, new CliError("X", "failed with bearer abc.def", 401, { trace: "Bearer zzz" }));

    const output = String(errSpy.mock.calls[0][0]);
    expect(output).toContain("Bearer [REDACTED]");
    expect(output).not.toContain("abc.def");
    expect(output).not.toContain("zzz");
  });

  it("redacts query-like token assignments in error output", () => {
    const ctx: CliContext = { profile: "default", json: true, dryRun: false, force: false };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    printError(
      ctx,
      new CliError("X", "failed url https://api.hubapi.com/?token=abc123", 400, {
        debug: "api_key=xyz987",
      }),
    );

    const output = String(errSpy.mock.calls[0][0]);
    expect(output).toContain("token=[REDACTED]");
    expect(output).toContain("api_key=[REDACTED]");
    expect(output).not.toContain("abc123");
    expect(output).not.toContain("xyz987");
  });
});
