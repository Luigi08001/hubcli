import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerHubSpotTools } from "../src/mcp/server.js";

type ToolCallback = (args: any) => Promise<any>;

class MockMcpServer {
  public tools = new Map<string, ToolCallback>();

  registerTool(name: string, _config: unknown, cb: ToolCallback): void {
    this.tools.set(name, cb);
  }
}

function setupHomeWithToken(profile = "default", token = "test-token"): string {
  const home = mkdtempSync(join(tmpdir(), "hubcli-mcp-test-"));
  const dir = join(home, ".hubcli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles: { [profile]: { token } } }));
  process.env.HUBCLI_HOME = dir;
  process.env.HOME = home;
  return home;
}

describe("mcp server", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.HUBCLI_HOME;
    delete process.env.HUBCLI_MCP_PROFILE;
    delete process.env.HUBCLI_MCP_STRICT_CAPABILITIES;
  });

  it("registers expected CRM tool catalog", () => {
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);

    expect(mock.tools.has("crm_contacts_list")).toBe(true);
    expect(mock.tools.has("crm_companies_update")).toBe(true);
    expect(mock.tools.has("crm_deals_search")).toBe(true);
    expect(mock.tools.has("crm_tickets_list")).toBe(true);
    expect(mock.tools.has("crm_tickets_delete")).toBe(true);
    expect(mock.tools.has("crm_contacts_batch_upsert")).toBe(true);
    expect(mock.tools.has("crm_properties_update")).toBe(true);
    expect(mock.tools.has("crm_custom_schemas_list")).toBe(true);
    expect(mock.tools.has("hub_api_request")).toBe(true);
    expect(mock.tools.has("crm_associations_remove")).toBe(true);
    expect(mock.tools.has("crm_imports_errors")).toBe(true);
    expect(mock.tools.has("crm_owners_list")).toBe(true);
    expect(mock.tools.has("crm_pipelines_get")).toBe(true);
  });

  it("supports a read flow via contacts list", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);

    const fetchSpy = vi.spyOn(global, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: "1" }] }),
      headers: new Headers(),
    } as never);

    const result = await mock.tools.get("crm_contacts_list")!({ limit: 1 });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ results: [{ id: "1" }] });
  });

  it("write tools default to dry-run unless force=true", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);

    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_contacts_create")!({ data: { properties: { email: "dry@example.com" } } });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "/crm/v3/objects/contacts",
    });
  });

  it("rejects traversal-like MCP path segments", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);

    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_properties_list")!({ objectType: ".." });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "UNSUPPORTED_OBJECT_TYPE" });
  });

  it("rejects invalid id segments in MCP object tools", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);

    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const result = await mock.tools.get("crm_contacts_get")!({ id: "../bad-id" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "INVALID_PATH_SEGMENT" });
  });

  it("rejects unsupported pipeline objectType in MCP", async () => {
    setupHomeWithToken();
    const mock = new MockMcpServer();
    registerHubSpotTools(mock as any);

    const fetchSpy = vi.spyOn(global, "fetch" as never);
    const result = await mock.tools.get("crm_pipelines_list")!({ objectType: "contacts" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ code: "UNSUPPORTED_OBJECT_TYPE" });
  });

  it("raw hub_api_request write defaults to dry-run", async () => {
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
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "/marketing/v3/forms",
    });
  });
});
