/**
 * Tests for the HubSpot Remote MCP compatibility layer
 * (src/mcp/compat-hubspot.ts). Verifies that hscli's `mcp` server exposes
 * the same tool names + accepts the same argument shapes as
 * https://mcp.hubspot.com, and routes to the correct HubSpot API paths.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerHubSpotTools } from "../src/mcp/server.js";

 
type ToolCallback = (args: any) => Promise<any>;

class MockMcpServer {
  public tools = new Map<string, { config: unknown; cb: ToolCallback }>();
  registerTool(name: string, config: unknown, cb: ToolCallback): void {
    this.tools.set(name, { config, cb });
  }
}

function setupAuthHome(): string {
  const home = mkdtempSync(join(tmpdir(), "hscli-compat-test-"));
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

function mockFetchOk<T>(data: T): ReturnType<typeof vi.spyOn> {
  const body = JSON.stringify(data);
  return vi.spyOn(global, "fetch" as never).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => body,
    headers: new Headers(),
  } as never);
}

describe("HubSpot Remote MCP compat layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_MCP_PROFILE;
    delete process.env.HSCLI_PROFILE;
  });

  // ────────────────────────────────────────────
  // Catalog
  // ────────────────────────────────────────────

  it("registers all 11 HubSpot-compat tools with the exact names from mcp.hubspot.com", () => {
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);

    const expected = [
      "get_user_details",
      "search_crm_objects",
      "get_crm_objects",
      "manage_crm_objects",
      "search_properties",
      "get_properties",
      "search_owners",
      "get_campaign_analytics",
      "get_campaign_contacts_by_type",
      "get_campaign_asset_types",
      "get_campaign_asset_metrics",
    ];
    for (const name of expected) {
      expect(mock.tools.has(name), `missing compat tool: ${name}`).toBe(true);
    }
  });

  // ────────────────────────────────────────────
  // search_crm_objects
  // ────────────────────────────────────────────

  it("search_crm_objects POSTs to /crm/v3/objects/<type>/search with filterGroups + query", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ id: "1" }] });

    await mock.tools.get("search_crm_objects")!.cb({
      objectType: "contacts",
      query: "acme",
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: "x@y.com" }] }],
      limit: 50,
    });

    const [url, init] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/crm/v3/objects/contacts/search");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.query).toBe("acme");
    expect(body.filterGroups).toHaveLength(1);
    expect(body.limit).toBe(50);
  });

  it("search_crm_objects rejects filterGroups > 5 per HubSpot spec", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    mockFetchOk({ results: [] });

    const res = await mock.tools.get("search_crm_objects")!.cb({
      objectType: "contacts",
      filterGroups: [1, 2, 3, 4, 5, 6].map((i) => ({ filters: [{ propertyName: "n", operator: "EQ", value: i }] })),
    });
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res.content)).toMatch(/HUBSPOT_MCP_LIMIT|max 5/i);
  });

  // ────────────────────────────────────────────
  // get_crm_objects
  // ────────────────────────────────────────────

  it("get_crm_objects routes to batch/read with inputs=[{id}, ...]", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ id: "1" }, { id: "2" }] });

    await mock.tools.get("get_crm_objects")!.cb({
      objectType: "companies",
      ids: ["1", "2"],
      properties: ["name", "domain"],
    });

    const [url, init] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/crm/v3/objects/companies/batch/read");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.inputs).toEqual([{ id: "1" }, { id: "2" }]);
    expect(body.properties).toEqual(["name", "domain"]);
  });

  it("get_crm_objects rejects > 100 IDs per HubSpot spec", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    mockFetchOk({ results: [] });

    const res = await mock.tools.get("get_crm_objects")!.cb({
      objectType: "deals",
      ids: Array.from({ length: 101 }, (_, i) => String(i)),
    });
    expect(res.isError).toBe(true);
  });

  // ────────────────────────────────────────────
  // manage_crm_objects — hscli extension: delete
  // ────────────────────────────────────────────

  it("manage_crm_objects operation=delete routes to batch/archive (hscli extension)", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ ok: true });

    await mock.tools.get("manage_crm_objects")!.cb({
      objectType: "contacts",
      operation: "delete",
      records: [{ id: "123" }, { id: "456" }],
      force: true,
    });

    const [url, init] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/crm/v3/objects/contacts/batch/archive");
    expect(init.method).toBe("POST");
  });

  it("manage_crm_objects operation=create routes to batch/create", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ id: "1" }] });

    await mock.tools.get("manage_crm_objects")!.cb({
      objectType: "deals",
      operation: "create",
      records: [{ properties: { dealname: "Test Deal" } }],
      force: true,
    });

    const [url] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/crm/v3/objects/deals/batch/create");
  });

  it("manage_crm_objects default is dry-run (force=false)", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({});

    const res = await mock.tools.get("manage_crm_objects")!.cb({
      objectType: "contacts",
      operation: "delete",
      records: [{ id: "999" }],
    });

    // No fetch made — dry-run intercept
    expect(fetchSpy).not.toHaveBeenCalled();
    const output = JSON.parse(res.content[0].text);
    expect(output.dryRun).toBe(true);
    expect(output.method).toBe("POST");
    expect(output.path).toContain("/batch/archive");
  });

  // ────────────────────────────────────────────
  // search_properties + get_properties
  // ────────────────────────────────────────────

  it("search_properties filters property definitions by keywords", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    mockFetchOk({
      results: [
        { name: "email", label: "Email", description: "Contact email" },
        { name: "firstname", label: "First Name", description: "" },
        { name: "phone", label: "Phone", description: "" },
      ],
    });

    const result = await mock.tools.get("search_properties")!.cb({
      objectType: "contacts",
      keywords: ["email"],
    });
    const output = JSON.parse(result.content[0].text);
    expect(output.results).toHaveLength(1);
    expect(output.results[0].name).toBe("email");
  });

  it("search_properties rejects > 5 keywords", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    mockFetchOk({ results: [] });

    const res = await mock.tools.get("search_properties")!.cb({
      objectType: "contacts",
      keywords: ["a", "b", "c", "d", "e", "f"],
    });
    expect(res.isError).toBe(true);
  });

  it("get_properties with no args returns all props for object type", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ name: "email" }] });

    await mock.tools.get("get_properties")!.cb({ objectType: "contacts" });
    const [url] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toMatch(/\/crm\/v3\/properties\/contacts$/);
  });

  // ────────────────────────────────────────────
  // search_owners
  // ────────────────────────────────────────────

  it("search_owners with email filter hits /crm/v3/owners with query param", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });

    await mock.tools.get("search_owners")!.cb({ email: "owner@example.com", limit: 10 });
    const [url] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/crm/v3/owners/");
    expect(String(url)).toContain("email=owner%40example.com");
    expect(String(url)).toContain("limit=10");
  });

  it("search_owners with ids resolves each via GET /crm/v3/owners/{id}", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ id: "o1" });

    await mock.tools.get("search_owners")!.cb({ ids: ["o1", "o2"] });
    expect(fetchSpy.mock.calls.length).toBe(2);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/crm/v3/owners/o1");
    expect(String(fetchSpy.mock.calls[1][0])).toContain("/crm/v3/owners/o2");
  });

  // ────────────────────────────────────────────
  // Campaigns
  // ────────────────────────────────────────────

  it("get_campaign_analytics fetches /marketing/v3/campaigns/{id}/metrics per campaignId", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ opens: 100 });

    await mock.tools.get("get_campaign_analytics")!.cb({
      campaignIds: ["c1", "c2"],
      startDate: "2026-01-01",
    });

    expect(fetchSpy.mock.calls.length).toBe(2);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/marketing/v3/campaigns/c1/metrics");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("startDate=2026-01-01");
  });

  it("get_campaign_contacts_by_type routes with attributionType param", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });

    await mock.tools.get("get_campaign_contacts_by_type")!.cb({
      campaignId: "c1",
      attributionType: "INFLUENCED",
    });

    const [url] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/marketing/v3/campaigns/c1/contacts");
    expect(String(url)).toContain("attributionType=INFLUENCED");
  });
});
