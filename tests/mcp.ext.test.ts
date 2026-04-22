/**
 * Tests for the extension MCP tools (src/mcp/ext-tools.ts) — capabilities
 * beyond what HubSpot's hosted Remote MCP offers: workflows, files,
 * forms, webhooks, marketing emails, HubDB, URL redirects, conversations.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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

function setupAuthHome(): void {
  const home = mkdtempSync(join(tmpdir(), "hscli-ext-test-"));
  const dir = join(home, ".revfleet");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "auth.json"),
    JSON.stringify({ profiles: { default: { token: "t" } } }),
  );
  process.env.HSCLI_HOME = dir;
  process.env.HOME = home;
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

describe("extension MCP tools (beyond HubSpot Remote MCP)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_MCP_PROFILE;
    delete process.env.HSCLI_PROFILE;
  });

  it("registers every extension tool expected", () => {
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);

    const expected = [
      // Workflows
      "workflows_list", "workflows_get", "workflows_enroll", "workflows_unenroll",
      // Files
      "files_list", "files_get", "files_delete", "files_signed_url",
      // Forms
      "forms_list", "forms_get", "forms_submissions", "forms_submit",
      // Webhooks
      "webhooks_list_subscriptions", "webhooks_create_subscription", "webhooks_delete_subscription",
      // Marketing emails
      "marketing_emails_list", "marketing_emails_get", "marketing_emails_statistics",
      // HubDB
      "hubdb_tables_list", "hubdb_rows_list", "hubdb_row_create", "hubdb_row_update", "hubdb_publish",
      // CMS redirects
      "cms_redirects_list", "cms_redirects_create", "cms_redirects_delete",
      // Conversations
      "conversations_inboxes_list", "conversations_threads_list", "conversations_messages_send",
    ];
    for (const name of expected) {
      expect(mock.tools.has(name), `missing extension tool: ${name}`).toBe(true);
    }
  });

  // Workflows

  it("workflows_list hits /automation/v4/flows", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });
    await mock.tools.get("workflows_list")!({ limit: 10 });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/automation/v4/flows");
  });

  it("workflows_enroll is dry-run by default", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({});
    const res = await mock.tools.get("workflows_enroll")!({ workflowId: "123", email: "a@b.com" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(res.content[0].text).dryRun).toBe(true);
  });

  it("workflows_enroll with force=true hits /automation/v2/workflows/{id}/enrollments/contacts/{email}", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({});
    await mock.tools.get("workflows_enroll")!({ workflowId: "123", email: "a@b.com", force: true });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/automation/v2/workflows/123/enrollments/contacts/a%40b.com");
  });

  // Files

  it("files_list hits /files/v3/files with limit + after", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });
    await mock.tools.get("files_list")!({ limit: 25, after: "cursor-1" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/files/v3/files");
    expect(url).toContain("limit=25");
    expect(url).toContain("after=cursor-1");
  });

  it("files_delete is dry-run by default", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({});
    const res = await mock.tools.get("files_delete")!({ fileId: "f1" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(res.content[0].text).method).toBe("DELETE");
  });

  it("files_signed_url includes expirationSeconds", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ url: "https://..." });
    await mock.tools.get("files_signed_url")!({ fileId: "f1", expirationSeconds: 120 });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/files/v3/files/f1/signed-url");
    expect(url).toContain("expirationSeconds=120");
  });

  // Forms

  it("forms_submissions hits /form-integrations/v1/submissions/forms/{formId}", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });
    await mock.tools.get("forms_submissions")!({ formId: "f1", limit: 25 });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("/form-integrations/v1/submissions/forms/f1");
  });

  it("forms_submit with force hits /submissions/v3/integration/submit/{portalId}/{formGuid}", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ ok: true });
    await mock.tools.get("forms_submit")!({
      portalId: "12345",
      formGuid: "abc-def",
      fields: [{ name: "email", value: "x@y.com" }],
      force: true,
    });
    const [url, init] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/submissions/v3/integration/submit/12345/abc-def");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.fields).toEqual([{ name: "email", value: "x@y.com" }]);
  });

  // Webhooks

  it("webhooks_list_subscriptions hits /webhooks/v3/{appId}/subscriptions", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });
    await mock.tools.get("webhooks_list_subscriptions")!({ appId: "54321" });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/webhooks/v3/54321/subscriptions");
  });

  it("webhooks_create_subscription is dry-run by default", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({});
    const res = await mock.tools.get("webhooks_create_subscription")!({
      appId: "54321",
      data: { eventType: "contact.propertyChange", propertyName: "email", active: true },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(res.content[0].text).dryRun).toBe(true);
  });

  // Marketing emails

  it("marketing_emails_statistics hits /marketing/v3/emails/{id}/statistics", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ opens: 0 });
    await mock.tools.get("marketing_emails_statistics")!({ emailId: "em1" });
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/marketing/v3/emails/em1/statistics");
  });

  // HubDB

  it("hubdb_tables_list hits /cms/v3/hubdb/tables", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });
    await mock.tools.get("hubdb_tables_list")!({});
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/cms/v3/hubdb/tables");
  });

  it("hubdb_row_create targets the draft table", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({});
    await mock.tools.get("hubdb_row_create")!({
      tableIdOrName: "my_table",
      data: { values: { col1: "x" } },
      force: true,
    });
    const [url] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/cms/v3/hubdb/tables/my_table/rows/draft");
  });

  it("hubdb_publish POSTs to draft/publish", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ publishedAt: "..." });
    await mock.tools.get("hubdb_publish")!({ tableIdOrName: "my_table", force: true });
    const [url, init] = fetchSpy.mock.calls[0] as [URL | string, RequestInit];
    expect(String(url)).toContain("/cms/v3/hubdb/tables/my_table/draft/publish");
    expect(init.method).toBe("POST");
  });

  // CMS redirects

  it("cms_redirects_delete is dry-run by default", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({});
    const res = await mock.tools.get("cms_redirects_delete")!({ redirectId: "r1" });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(res.content[0].text).method).toBe("DELETE");
  });

  // Conversations

  it("conversations_inboxes_list hits /conversations/v3/conversations/inboxes", async () => {
    setupAuthHome();
    const mock = new MockMcpServer();
     
    registerHubSpotTools(mock as any);
    const fetchSpy = mockFetchOk({ results: [] });
    await mock.tools.get("conversations_inboxes_list")!({});
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/conversations/v3/conversations/inboxes");
  });
});
