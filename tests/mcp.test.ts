import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerHubSpotTools, resolveProfile } from "../src/mcp/server.js";

type ToolCallback = (args: any) => Promise<any>;

class MockMcpServer {
  public tools = new Map<string, ToolCallback>();

  registerTool(name: string, _config: unknown, cb: ToolCallback): void {
    this.tools.set(name, cb);
  }
}

function setupHomeWithToken(
  profile = "default",
  token = "test-token",
  extra: Record<string, string> = {},
): string {
  const home = mkdtempSync(join(tmpdir(), "hscli-mcp-test-"));
  const dir = join(home, ".hscli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "auth.json"),
    JSON.stringify({ profiles: { [profile]: { token, ...extra } } }),
  );
  process.env.HSCLI_HOME = dir;
  process.env.HOME = home;
  return home;
}

function mockFetchOk(data: unknown = { results: [] }) {
  const body = JSON.stringify(data);
  return vi.spyOn(global, "fetch" as never).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => body,
    headers: new Headers(),
  } as never);
}

describe("mcp server", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_MCP_PROFILE;
    delete process.env.HSCLI_MCP_STRICT_CAPABILITIES;
    delete process.env.HSCLI_PROFILE;
  });

  // ────────────────────────────────────────────
  // 1. Tool catalog
  // ────────────────────────────────────────────

  it("registers expected CRM tool catalog", () => {
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);

    const expected = [
      "crm_contacts_list", "crm_contacts_get", "crm_contacts_search",
      "crm_contacts_create", "crm_contacts_update", "crm_contacts_delete",
      "crm_contacts_merge", "crm_contacts_batch_read", "crm_contacts_batch_upsert",
      "crm_contacts_batch_archive",
      "crm_companies_list", "crm_companies_update",
      "crm_deals_list", "crm_deals_search",
      "crm_tickets_list", "crm_tickets_delete",
      "crm_properties_list", "crm_properties_get",
      "crm_properties_create", "crm_properties_update",
      "crm_associations_list", "crm_associations_create", "crm_associations_remove",
      "crm_owners_list",
      "crm_pipelines_list", "crm_pipelines_get",
      "crm_imports_list", "crm_imports_get", "crm_imports_errors", "crm_imports_create",
      "crm_custom_schemas_list", "crm_custom_schemas_get",
      "crm_custom_schemas_create", "crm_custom_schemas_update",
      "crm_custom_records_list", "crm_custom_records_get",
      "crm_custom_records_create", "crm_custom_records_update", "crm_custom_records_delete",
      "hub_api_request",
    ];

    for (const name of expected) {
      expect(mock.tools.has(name), `missing tool: ${name}`).toBe(true);
    }
  });

  it("registers engagement object tools (notes, calls, tasks, emails, meetings)", () => {
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);

    for (const eng of ["notes", "calls", "tasks", "emails", "meetings"]) {
      expect(mock.tools.has(`crm_${eng}_list`), `missing ${eng}_list`).toBe(true);
      expect(mock.tools.has(`crm_${eng}_create`), `missing ${eng}_create`).toBe(true);
    }
  });

  // ────────────────────────────────────────────
  // 2. Read flows
  // ────────────────────────────────────────────

  it("contacts list read flow", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ id: "1" }] });

    const result = await mock.tools.get("crm_contacts_list")!({ limit: 1 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({ results: [{ id: "1" }] });
  });

  it("companies list read flow", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ id: "42", properties: { name: "Acme" } }] });

    const result = await mock.tools.get("crm_companies_list")!({ limit: 5 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.structuredContent.results).toHaveLength(1);
  });

  it("deals search read flow", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ id: "99" }], total: 1 });

    await mock.tools.get("crm_deals_search")!({ query: "big deal", limit: 5 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchSpy.mock.calls[0] as [string, any];
    expect(url).toContain("/crm/v3/objects/deals/search");
    expect(opts.method).toBe("POST");
  });

  it("contacts get by ID", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ id: "123", properties: { email: "a@b.com" } });

    const result = await mock.tools.get("crm_contacts_get")!({ id: "123" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({ id: "123" });
  });

  it("owners list read flow", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ userId: 1 }] });

    await mock.tools.get("crm_owners_list")!({ limit: 10 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/crm/v3/owners");
  });

  it("pipelines list read flow (deals)", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ id: "p1", label: "Sales" }] });

    await mock.tools.get("crm_pipelines_list")!({ objectType: "deals" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/crm/v3/pipelines/deals");
  });

  it("properties list read flow", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ name: "email", label: "Email" }] });

    await mock.tools.get("crm_properties_list")!({ objectType: "contacts" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/crm/v3/properties/contacts");
  });

  it("associations list read flow", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ toObjectId: "5" }] });

    await mock.tools.get("crm_associations_list")!({
      fromObjectType: "contacts",
      fromObjectId: "1",
      toObjectType: "companies",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/crm/v4/objects/contacts/1/associations/companies");
  });

  it("imports list read flow", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });

    await mock.tools.get("crm_imports_list")!({ limit: 5 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/crm/v3/imports");
  });

  // ────────────────────────────────────────────
  // 3. Write safety (dry-run)
  // ────────────────────────────────────────────

  it("contacts create defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_contacts_create")!({
      data: { properties: { email: "dry@example.com" } },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "/crm/v3/objects/contacts",
    });
  });

  it("contacts update defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_contacts_update")!({
      id: "123",
      data: { properties: { firstname: "Test" } },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      dryRun: true,
      method: "PATCH",
    });
  });

  it("contacts delete defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_contacts_delete")!({ id: "123" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      dryRun: true,
      method: "DELETE",
    });
  });

  it("contacts create with force=true sends HTTP", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ id: "999", properties: { email: "new@example.com" } });

    const result = await mock.tools.get("crm_contacts_create")!({
      force: true,
      data: { properties: { email: "new@example.com" } },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.structuredContent).toMatchObject({ id: "999" });
  });

  it("associations create defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_associations_create")!({
      fromObjectType: "contacts",
      fromObjectId: "1",
      toObjectType: "companies",
      toObjectId: "2",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({ dryRun: true, method: "PUT" });
  });

  it("batch upsert defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_contacts_batch_upsert")!({
      data: { inputs: [{ properties: { email: "a@b.com" } }] },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({ dryRun: true });
  });

  it("batch archive defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_contacts_batch_archive")!({
      data: { inputs: [{ id: "1" }] },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({ dryRun: true });
  });

  it("properties create defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_properties_create")!({
      objectType: "contacts",
      data: { name: "test_prop", label: "Test", type: "string", fieldType: "text", groupName: "contactinformation" },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({ dryRun: true });
  });

  it("imports create defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_imports_create")!({
      data: { files: [] },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({ dryRun: true });
  });

  // ────────────────────────────────────────────
  // 4. Validation / security
  // ────────────────────────────────────────────

  it("rejects traversal-like objectType in properties", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_properties_list")!({ objectType: ".." });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "UNSUPPORTED_OBJECT_TYPE" });
  });

  it("rejects invalid id segments", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_contacts_get")!({ id: "../bad-id" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "INVALID_PATH_SEGMENT" });
  });

  it("rejects unsupported pipeline objectType", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);
    const result = await mock.tools.get("crm_pipelines_list")!({ objectType: "contacts" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "UNSUPPORTED_OBJECT_TYPE" });
  });

  // ────────────────────────────────────────────
  // 5. Raw API request
  // ────────────────────────────────────────────

  it("hub_api_request GET executes immediately", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });

    const result = await mock.tools.get("hub_api_request")!({
      method: "GET",
      path: "/crm/v3/objects/contacts",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.isError).toBeUndefined();
  });

  it("hub_api_request POST defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("hub_api_request")!({
      method: "POST",
      path: "/marketing/v3/forms",
      data: { name: "x" },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "/marketing/v3/forms",
    });
  });

  // ────────────────────────────────────────────
  // 6. EU1 / hublet routing via MCP
  // ────────────────────────────────────────────

  it("routes API calls to EU1 domain when profile has hublet", async () => {
    setupHomeWithToken("default", "pat-eu1-abc123", {
      hublet: "eu1",
      apiDomain: "api-eu1.hubapi.com",
    });
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });

    await mock.tools.get("crm_contacts_list")!({ limit: 1 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("api-eu1.hubapi.com");
  });

  // ────────────────────────────────────────────
  // 7. Profile isolation
  // ────────────────────────────────────────────

  it("profile isolation rejects cross-profile requests", () => {
    process.env.HSCLI_MCP_PROFILE = "locked";
    expect(() => resolveProfile("other")).toThrow("locked to profile");
  });

  it("profile isolation allows matching profile", () => {
    process.env.HSCLI_MCP_PROFILE = "locked";
    expect(resolveProfile("locked")).toBe("locked");
  });

  it("defaults to 'default' profile when no isolation", () => {
    expect(resolveProfile()).toBe("default");
  });

  // Codex P1.1 regression: CLI's preAction hook sets HSCLI_PROFILE; MCP's
  // resolveProfile() must inherit it when no explicit `profile` arg is passed.
  it("inherits HSCLI_PROFILE env var when no explicit profile arg", () => {
    delete process.env.HSCLI_MCP_PROFILE;
    process.env.HSCLI_PROFILE = "prod-portal";
    expect(resolveProfile()).toBe("prod-portal");
    expect(resolveProfile("")).toBe("prod-portal"); // empty string also falls through
  });

  it("explicit profile arg takes precedence over HSCLI_PROFILE", () => {
    delete process.env.HSCLI_MCP_PROFILE;
    process.env.HSCLI_PROFILE = "prod-portal";
    expect(resolveProfile("staging")).toBe("staging");
  });

  it("HSCLI_MCP_PROFILE isolation still wins over HSCLI_PROFILE", () => {
    process.env.HSCLI_MCP_PROFILE = "locked";
    process.env.HSCLI_PROFILE = "prod-portal"; // should be ignored
    expect(resolveProfile()).toBe("locked");
    expect(() => resolveProfile("prod-portal")).toThrow("locked to profile");
  });

  // ────────────────────────────────────────────
  // 8. Batch read (non-mutating POST)
  // ────────────────────────────────────────────

  it("batch read sends POST without dry-run gate", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [{ id: "1" }] });

    const result = await mock.tools.get("crm_contacts_batch_read")!({
      data: { inputs: [{ id: "1" }], properties: ["email"] },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.isError).toBeUndefined();
  });

  // ────────────────────────────────────────────
  // 9. Custom objects
  // ────────────────────────────────────────────

  it("custom schemas list read flow", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });

    await mock.tools.get("crm_custom_schemas_list")!({});

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toContain("/crm/v3/schemas");
  });

  it("custom records create defaults to dry-run", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_custom_records_create")!({
      objectType: "p_my_object",
      data: { properties: { name: "test" } },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({ dryRun: true });
  });

  // ────────────────────────────────────────────
  // 11. Codex P1.3 regression: handlers must not double-wrap via textResult()
  // (the outer executeTool wraps exactly once; if a handler also wraps,
  // clients receive structuredContent.content[0].text = "{...json...}" blob
  // instead of the actual structured payload)
  // ────────────────────────────────────────────

  it("crm_lists_list returns structured payload, not double-wrapped blob", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    mockFetchOk({ lists: [{ listId: 42, name: "Active" }], hasMore: false });

    const result = await mock.tools.get("crm_lists_list")!({});

    expect(result).toBeDefined();
    expect(result.structuredContent).toMatchObject({ lists: [{ listId: 42 }] });
    // Specifically: structuredContent must NOT have `content` as a child
    // (which would indicate a double-wrap)
    expect(result.structuredContent).not.toHaveProperty("content");
  });

  it("sales_sequences_list returns structured payload, not double-wrapped blob", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    mockFetchOk({ results: [{ id: "1" }] });

    const result = await mock.tools.get("sales_sequences_list")!({ userId: "u" });

    expect(result.structuredContent).toMatchObject({ results: [{ id: "1" }] });
    expect(result.structuredContent).not.toHaveProperty("content");
  });

  it("reporting_dashboards_list returns structured payload, not double-wrapped blob", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    mockFetchOk({ results: [{ id: "d1", name: "Sales" }] });

    const result = await mock.tools.get("reporting_dashboards_list")!({});

    expect(result.structuredContent).toMatchObject({ results: [{ id: "d1" }] });
    expect(result.structuredContent).not.toHaveProperty("content");
  });

  it("crm_exports_list returns structured payload, not double-wrapped blob", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);
    mockFetchOk({ results: [{ id: "e1", status: "DONE" }] });

    const result = await mock.tools.get("crm_exports_list")!({});

    expect(result.structuredContent).toMatchObject({ results: [{ id: "e1" }] });
    expect(result.structuredContent).not.toHaveProperty("content");
  });
});
