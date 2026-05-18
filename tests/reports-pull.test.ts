import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function setupHomeWithProfiles(profiles: Record<string, Record<string, unknown>> = { default: { token: "test-token" } }): string {
  const home = mkdtempSync(join(tmpdir(), "hscli-reports-"));
  const dir = join(home, ".hscli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles }));
  process.env.HSCLI_HOME = dir;
  return home;
}

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    headers: new Headers(),
  } as Response;
}

describe("reports pull", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_PROFILE;
    delete process.env.HSCLI_STRICT_CAPABILITIES;
    delete process.env.HSCLI_REQUEST_ID;
    delete process.env.HSCLI_TELEMETRY_FILE;
    delete process.env.HSCLI_API_BASE_URL;
    process.exitCode = undefined;
  });

  it("pulls object fill rate for selected properties", async () => {
    setupHomeWithProfiles();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue(response({
      results: [
        { id: "1", properties: { firstname: "Ada", email: "ada@example.com" } },
        { id: "2", properties: { firstname: "", email: "grace@example.com" } },
      ],
    }) as never);

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hscli",
      "--json",
      "reports",
      "pull",
      "object-fill-rate",
      "--object",
      "contacts",
      "--properties",
      "firstname,email",
      "--limit",
      "2",
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/crm/v3/objects/contacts?");
    const output = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(output.data).toMatchObject({
      recipe: "object-fill-rate",
      objectType: "contacts",
      sampled: 2,
    });
    expect(output.data.results).toEqual([
      { property: "firstname", filled: 1, blank: 1, fillRate: 0.5 },
      { property: "email", filled: 2, blank: 0, fillRate: 1 },
    ]);
  });

  it("pulls a property distribution", async () => {
    setupHomeWithProfiles();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockResolvedValue(response({
      results: [
        { id: "1", properties: { lifecyclestage: "lead" } },
        { id: "2", properties: { lifecyclestage: "customer" } },
        { id: "3", properties: { lifecyclestage: "" } },
      ],
    }) as never);

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hscli",
      "--json",
      "reports",
      "pull",
      "property-distribution",
      "--object",
      "contacts",
      "--property",
      "lifecyclestage",
      "--limit",
      "3",
    ]);

    const output = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(output.data).toMatchObject({
      recipe: "property-distribution",
      objectType: "contacts",
      property: "lifecyclestage",
      sampled: 3,
      blank: 1,
    });
    expect(output.data.results).toEqual([
      { value: "lead", count: 1, percent: 1 / 3 },
      { value: "customer", count: 1, percent: 1 / 3 },
    ]);
  });

  it("pulls per-recipient email events for campaign ids", async () => {
    setupHomeWithProfiles();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockImplementation(async (url: unknown) => {
      const value = String(url);
      if (value.includes("eventType=DELIVERED")) {
        return response({ events: [{ recipient: "a@example.com", type: "DELIVERED", created: 1 }] });
      }
      if (value.includes("eventType=BOUNCE")) {
        return response({
          events: [{
            recipient: "b@example.com",
            type: "BOUNCE",
            created: 2,
            obsoletedBy: null,
            category: "UNKNOWN_USER",
            response: "550 5.1.1 unknown user",
          }],
        });
      }
      return response({ events: [] });
    });

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hscli",
      "--json",
      "reports",
      "pull",
      "email-recipients",
      "--campaign-ids",
      "101",
      "--event-types",
      "delivered,bounce",
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const output = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(output.data).toMatchObject({
      recipe: "email-recipients",
      campaigns: ["101"],
      eventTypes: ["DELIVERED", "BOUNCE"],
    });
    expect(output.data.results).toEqual([
      {
        campaignId: "101",
        email: "a@example.com",
        events: ["DELIVERED"],
        received: true,
        hardBounce: false,
        softBounce: false,
        notDeliveredReason: "",
      },
      {
        campaignId: "101",
        email: "b@example.com",
        events: ["BOUNCE"],
        received: false,
        hardBounce: true,
        softBounce: false,
        notDeliveredReason: "Hard bounce",
      },
    ]);
  });

  it("uses email internally for contact enrichment without emitting it unless requested", async () => {
    setupHomeWithProfiles();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockImplementation(async (url: unknown, init?: RequestInit) => {
      const value = String(url);
      if (value.includes("/email/public/v1/events")) {
        return response({ events: [{ recipient: "ada@example.com", type: "DELIVERED", created: 1 }] });
      }
      if (value.includes("/crm/v3/objects/contacts/batch/read")) {
        const body = JSON.parse(String(init?.body ?? "{}"));
        expect(body.properties).toEqual(["email", "firstname"]);
        return response({
          results: [{ id: "1", properties: { email: "ada@example.com", firstname: "Ada" } }],
        });
      }
      return response({});
    });

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hscli",
      "--json",
      "reports",
      "pull",
      "email-recipients",
      "--campaign-ids",
      "101",
      "--event-types",
      "delivered",
      "--contact-properties",
      "firstname",
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const output = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(output.data.results).toEqual([{
      campaignId: "101",
      email: "ada@example.com",
      events: ["DELIVERED"],
      received: true,
      hardBounce: false,
      softBounce: false,
      notDeliveredReason: "",
      contactProperties: { firstname: "Ada" },
    }]);
  });

  it("pulls source-target parity counts across profiles", async () => {
    setupHomeWithProfiles({
      source: { token: "source-token" },
      target: { token: "target-token" },
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(global, "fetch" as never).mockImplementation(async (_url: unknown, init: RequestInit) => {
      const auth = String((init.headers as Record<string, string>).Authorization);
      if (auth.includes("source-token")) return response({ total: 10, results: [] });
      if (auth.includes("target-token")) return response({ total: 8, results: [] });
      return response({ total: 0, results: [] });
    });

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hscli",
      "--json",
      "reports",
      "pull",
      "source-target-parity",
      "--source-profile",
      "source",
      "--target-profile",
      "target",
      "--objects",
      "contacts",
    ]);

    const output = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(output.data).toMatchObject({
      recipe: "source-target-parity",
      sourceProfile: "source",
      targetProfile: "target",
    });
    expect(output.data.results).toEqual([
      { objectType: "contacts", sourceTotal: 10, targetTotal: 8, delta: -2, parityRatio: 0.8 },
    ]);
  });
});
