import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function setupHomeWithToken(
  profile = "default",
  token = "test-token",
  extras: Record<string, unknown> = {},
): string {
  const home = mkdtempSync(join(tmpdir(), "hubcli-hublet-"));
  const dir = join(home, ".hubcli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles: { [profile]: { token, ...extras } } }));
  process.env.HUBCLI_HOME = dir;
  return home;
}

describe("hublet detection and routing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HUBCLI_HOME;
    delete process.env.HUBCLI_PROFILE;
    delete process.env.HUBCLI_STRICT_CAPABILITIES;
    delete process.env.HUBCLI_REQUEST_ID;
    delete process.env.HUBCLI_TELEMETRY_FILE;
  });

  // -----------------------------------------------------------------------
  // detectHublet
  // -----------------------------------------------------------------------
  describe("detectHublet", () => {
    it("returns explicit hublet field when present", async () => {
      const { detectHublet } = await import("../src/core/auth.js");
      expect(detectHublet({ hublet: "eu1" })).toBe("eu1");
    });

    it("detects hublet from uiDomain (app-eu1.hubspot.com)", async () => {
      const { detectHublet } = await import("../src/core/auth.js");
      expect(detectHublet({ uiDomain: "app-eu1.hubspot.com" })).toBe("eu1");
    });

    it("detects hublet from token prefix (pat-eu1-...)", async () => {
      const { detectHublet } = await import("../src/core/auth.js");
      expect(detectHublet({ token: "pat-eu1-abc-def-123" })).toBe("eu1");
    });

    it("returns undefined for NA token (pat-na1-...)", async () => {
      const { detectHublet } = await import("../src/core/auth.js");
      expect(detectHublet({ token: "pat-na1-abc-def-123" })).toBeUndefined();
    });

    it("returns undefined for standard uiDomain (app.hubspot.com)", async () => {
      const { detectHublet } = await import("../src/core/auth.js");
      expect(detectHublet({ uiDomain: "app.hubspot.com" })).toBeUndefined();
    });

    it("returns undefined when no data available", async () => {
      const { detectHublet } = await import("../src/core/auth.js");
      expect(detectHublet({})).toBeUndefined();
    });

    it("prioritizes explicit hublet over uiDomain", async () => {
      const { detectHublet } = await import("../src/core/auth.js");
      expect(detectHublet({ hublet: "ap1", uiDomain: "app-eu1.hubspot.com" })).toBe("ap1");
    });

    it("prioritizes uiDomain over token prefix", async () => {
      const { detectHublet } = await import("../src/core/auth.js");
      expect(detectHublet({ uiDomain: "app-eu1.hubspot.com", token: "pat-ap1-abc" })).toBe("eu1");
    });
  });

  // -----------------------------------------------------------------------
  // resolveApiDomain
  // -----------------------------------------------------------------------
  describe("resolveApiDomain", () => {
    it("returns api.hubapi.com for undefined hublet", async () => {
      const { resolveApiDomain } = await import("../src/core/auth.js");
      expect(resolveApiDomain(undefined)).toBe("api.hubapi.com");
    });

    it("returns api-eu1.hubapi.com for eu1", async () => {
      const { resolveApiDomain } = await import("../src/core/auth.js");
      expect(resolveApiDomain("eu1")).toBe("api-eu1.hubapi.com");
    });

    it("returns api-ap1.hubapi.com for ap1", async () => {
      const { resolveApiDomain } = await import("../src/core/auth.js");
      expect(resolveApiDomain("ap1")).toBe("api-ap1.hubapi.com");
    });
  });

  // -----------------------------------------------------------------------
  // getApiBaseUrl
  // -----------------------------------------------------------------------
  describe("getApiBaseUrl", () => {
    it("returns stored apiDomain when present", async () => {
      setupHomeWithToken("default", "test-token", { apiDomain: "api-eu1.hubapi.com" });
      const { getApiBaseUrl } = await import("../src/core/auth.js");
      expect(getApiBaseUrl("default")).toBe("https://api-eu1.hubapi.com");
    });

    it("detects from uiDomain when apiDomain is missing", async () => {
      setupHomeWithToken("default", "test-token", { uiDomain: "app-eu1.hubspot.com" });
      const { getApiBaseUrl } = await import("../src/core/auth.js");
      expect(getApiBaseUrl("default")).toBe("https://api-eu1.hubapi.com");
    });

    it("detects from token prefix when nothing else available", async () => {
      setupHomeWithToken("default", "pat-eu1-abc-def-123");
      const { getApiBaseUrl } = await import("../src/core/auth.js");
      expect(getApiBaseUrl("default")).toBe("https://api-eu1.hubapi.com");
    });

    it("falls back to api.hubapi.com for NA tokens", async () => {
      setupHomeWithToken("default", "some-regular-token");
      const { getApiBaseUrl } = await import("../src/core/auth.js");
      expect(getApiBaseUrl("default")).toBe("https://api.hubapi.com");
    });

    it("falls back to api.hubapi.com for missing profile", async () => {
      setupHomeWithToken("default", "test-token");
      const { getApiBaseUrl } = await import("../src/core/auth.js");
      expect(getApiBaseUrl("nonexistent")).toBe("https://api.hubapi.com");
    });
  });

  // -----------------------------------------------------------------------
  // createClient routes to correct API base
  // -----------------------------------------------------------------------
  describe("createClient", () => {
    it("routes EU1 profile to api-eu1.hubapi.com", async () => {
      setupHomeWithToken("default", "pat-eu1-abc-def-123", {
        apiDomain: "api-eu1.hubapi.com",
      });

      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
        headers: new Headers(),
      } as never);

      const { createClient } = await import("../src/core/http.js");
      const client = createClient("default");
      await client.request("/crm/v3/objects/contacts?limit=1");

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain("https://api-eu1.hubapi.com/");
      expect(String(url)).toContain("/crm/v3/objects/contacts");
    });

    it("routes NA profile to api.hubapi.com", async () => {
      setupHomeWithToken("default", "regular-token");

      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
        headers: new Headers(),
      } as never);

      const { createClient } = await import("../src/core/http.js");
      const client = createClient("default");
      await client.request("/crm/v3/objects/contacts?limit=1");

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain("https://api.hubapi.com/");
    });
  });

  // -----------------------------------------------------------------------
  // CLI integration: EU1 contacts list routes correctly
  // -----------------------------------------------------------------------
  it("CLI contacts list routes to EU1 API when profile has eu1 hublet", async () => {
    setupHomeWithToken("default", "pat-eu1-test-token", {
      portalId: "147975758",
      uiDomain: "app-eu1.hubspot.com",
      hublet: "eu1",
      apiDomain: "api-eu1.hubapi.com",
    });

    vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
      headers: new Headers(),
    } as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--json", "crm", "contacts", "list", "--limit", "1"]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("https://api-eu1.hubapi.com/");
  });

  // -----------------------------------------------------------------------
  // auth login saves hublet + apiDomain
  // -----------------------------------------------------------------------
  it("auth login auto-detects EU1 and saves hublet/apiDomain", async () => {
    const home = mkdtempSync(join(tmpdir(), "hubcli-login-hublet-"));
    const dir = join(home, ".hubcli");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles: {} }));
    process.env.HUBCLI_HOME = dir;
    process.env.HOME = home;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockImplementation(async (url: unknown) => {
      const value = String(url);
      if (value.includes("/account-info/v3/details")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ portalId: 147975758, uiDomain: "app-eu1.hubspot.com" }),
          headers: new Headers(),
        } as never;
      }
      return { ok: false, status: 404, json: async () => ({}), headers: new Headers() } as never;
    });

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--json", "auth", "login", "--token", "pat-eu1-test-abc-123"]);

    const output = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(output.ok).toBe(true);
    expect(output.data.hublet).toBe("eu1");
    expect(output.data.apiDomain).toBe("api-eu1.hubapi.com");

    // Verify profile was persisted with hublet
    const { getProfile } = await import("../src/core/auth.js");
    const profile = getProfile("default");
    expect(profile.hublet).toBe("eu1");
    expect(profile.apiDomain).toBe("api-eu1.hubapi.com");
  });

  // -----------------------------------------------------------------------
  // doctor hublet-check
  // -----------------------------------------------------------------------
  describe("doctor hublet-check", () => {
    it("reports ALL_OK when hublet config is consistent", async () => {
      const home = setupHomeWithToken("default", "pat-eu1-test-abc-123", {
        portalId: "147975758",
        uiDomain: "app-eu1.hubspot.com",
        hublet: "eu1",
        apiDomain: "api-eu1.hubapi.com",
      });

      // Create matching ~/.hscli/config.yml
      const hscliDir = join(home, ".hscli");
      mkdirSync(hscliDir, { recursive: true });
      writeFileSync(join(hscliDir, "config.yml"), [
        "defaultAccount: 147975758",
        "accounts:",
        "  - name: '147975758'",
        "    accountId: 147975758",
        "    env: eu1",
        "    authType: personalaccesskey",
      ].join("\n"));

      // Override homedir for the test
      process.env.HOME = home;
      vi.doMock("node:os", async (importOriginal) => {
        const actual = await importOriginal<typeof import("node:os")>();
        return { ...actual, homedir: () => home };
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { run } = await import("../src/cli.js");
      await run(["node", "hubcli", "--json", "doctor", "hublet-check"]);

      const output = JSON.parse(String(logSpy.mock.calls[0][0]));
      expect(output.ok).toBe(true);
      expect(output.data.hublet).toBe("eu1");
      expect(output.data.apiDomain).toBe("api-eu1.hubapi.com");
      expect(output.data.overallStatus).toBe("ALL_OK");
    });

    it("reports warning when no hublet detected", async () => {
      setupHomeWithToken("default", "some-oauth-token", {
        portalId: "12345",
        uiDomain: "app.hubspot.com",
      });

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { run } = await import("../src/cli.js");
      await run(["node", "hubcli", "--json", "doctor", "hublet-check"]);

      const output = JSON.parse(String(logSpy.mock.calls[0][0]));
      expect(output.ok).toBe(true);
      expect(output.data.hublet).toBe("na (global)");
      expect(output.data.checks.some((c: any) => c.status === "warning")).toBe(true);
    });

    it("reports error when profile not found", async () => {
      const home = mkdtempSync(join(tmpdir(), "hubcli-noauth-"));
      process.env.HUBCLI_HOME = join(home, ".hubcli");
      process.env.HOME = home;

      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const { run } = await import("../src/cli.js");
      await run(["node", "hubcli", "--json", "doctor", "hublet-check"]);

      const output = JSON.parse(String(logSpy.mock.calls[0][0]));
      expect(output.ok).toBe(true);
      expect(output.data.overallStatus).toBe("ERRORS_FOUND");
      expect(output.data.checks.some((c: any) => c.check === "hubcli_profile" && c.status === "error")).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // HubSpotClient apiBaseUrl option
  // -----------------------------------------------------------------------
  describe("HubSpotClient apiBaseUrl", () => {
    it("defaults to api.hubapi.com when no apiBaseUrl given", async () => {
      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
        headers: new Headers(),
      } as never);

      const { HubSpotClient } = await import("../src/core/http.js");
      const client = new HubSpotClient("test-token");
      await client.request("/crm/v3/objects/contacts?limit=1");

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain("https://api.hubapi.com/");
    });

    it("uses custom apiBaseUrl when provided", async () => {
      const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [] }),
        headers: new Headers(),
      } as never);

      const { HubSpotClient } = await import("../src/core/http.js");
      const client = new HubSpotClient("test-token", { apiBaseUrl: "https://api-eu1.hubapi.com" });
      await client.request("/crm/v3/objects/contacts?limit=1");

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain("https://api-eu1.hubapi.com/");
    });
  });
});
