import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(status: number, headers: Headers = new Headers(), body: unknown = { ok: true }): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as Response;
}

describe("HubSpotClient rate limits", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    delete process.env.HSCLI_PROFILE;
    delete process.env.HSCLI_REQUEST_ID;
    delete process.env.HSCLI_TELEMETRY_FILE;
    delete process.env.HSCLI_API_BASE_URL;
  });

  it("shares observed rolling limits across clients for the same profile and base URL", async () => {
    vi.useFakeTimers({ now: new Date("2026-04-24T12:00:00.000Z") });
    const { HubSpotClient } = await import("../src/core/http.js");
    const headers = new Headers({
      "x-hubspot-ratelimit-interval-milliseconds": "100",
      "x-hubspot-ratelimit-max": "1",
      "x-hubspot-ratelimit-remaining": "0",
    });
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue(jsonResponse(200, headers) as never);

    const first = new HubSpotClient("token-a", { profile: "shared-rate-test" });
    const second = new HubSpotClient("token-a", { profile: "shared-rate-test" });

    await first.request("/crm/v3/objects/contacts?limit=1");
    const pending = second.request("/crm/v3/objects/companies?limit=1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(124);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("honors HubSpot secondly rate-limit headers before the next request", async () => {
    vi.useFakeTimers({ now: new Date("2026-04-24T12:00:00.000Z") });
    const { HubSpotClient } = await import("../src/core/http.js");
    const headers = new Headers({
      "x-hubspot-ratelimit-secondly": "1",
      "x-hubspot-ratelimit-secondly-remaining": "0",
    });
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue(jsonResponse(200, headers) as never);
    const client = new HubSpotClient("token-a", { profile: "secondly-rate-test" });

    await client.request("/crm/v3/objects/contacts?limit=1");
    const pending = client.request("/crm/v3/objects/contacts?limit=1");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1024);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("backs off using Retry-After before retrying 429 responses", async () => {
    vi.useFakeTimers({ now: new Date("2026-04-24T12:00:00.000Z") });
    const { HubSpotClient } = await import("../src/core/http.js");
    const fetchSpy = vi.spyOn(global, "fetch" as never)
      .mockResolvedValueOnce(jsonResponse(429, new Headers({ "retry-after": "2" })) as never)
      .mockResolvedValueOnce(jsonResponse(200) as never);
    const client = new HubSpotClient("token-a", { profile: "retry-after-test" });

    const pending = client.request("/crm/v3/objects/contacts?limit=1");

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("stops immediately when HubSpot reports the daily hard limit", async () => {
    const { HubSpotClient } = await import("../src/core/http.js");
    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue(
      jsonResponse(429, new Headers(), {
        status: "error",
        message: "You have reached your daily limit.",
        policyName: "DAILY",
      }) as never,
    );
    const client = new HubSpotClient("token-a", { profile: "daily-hard-limit-test" });

    await expect(client.request("/crm/v3/objects/contacts?limit=1")).rejects.toMatchObject({
      code: "RATE_LIMIT_DAILY_EXHAUSTED",
      status: 429,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("blocks new requests once daily remaining reaches zero", async () => {
    const { HubSpotClient } = await import("../src/core/http.js");
    let crmCalls = 0;
    vi.spyOn(global, "fetch" as never).mockImplementation(async (url: unknown) => {
      if (String(url).includes("/account-info/v3/details")) {
        return jsonResponse(200, new Headers(), { timeZone: "UTC" }) as never;
      }
      crmCalls += 1;
      return crmCalls === 1
        ? jsonResponse(200, new Headers({
          "x-hubspot-ratelimit-daily": "100",
          "x-hubspot-ratelimit-daily-remaining": "6",
        })) as never
        : jsonResponse(200, new Headers({
          "x-hubspot-ratelimit-daily": "100",
          "x-hubspot-ratelimit-daily-remaining": "0",
        })) as never;
    });
    const client = new HubSpotClient("token-a", { profile: "daily-header-limit-test" });

    await client.request("/crm/v3/objects/contacts?limit=1");
    await client.request("/crm/v3/objects/contacts?limit=1");
    await expect(client.request("/crm/v3/objects/contacts?limit=1")).rejects.toMatchObject({
      code: "RATE_LIMIT_DAILY_EXHAUSTED",
    });
    expect(crmCalls).toBe(2);
  });
});
