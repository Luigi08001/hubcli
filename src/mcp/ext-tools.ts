/**
 * Extension MCP tools — surface area that HubSpot's hosted Remote MCP
 * does NOT expose. Each tool maps to an already-implemented `hscli` CLI
 * command / HTTP route; we're just giving agents a first-class MCP handle.
 *
 * Registered here:
 *   ── Workflows ──
 *   - workflows_list, workflows_get, workflows_enroll, workflows_unenroll
 *   ── Files ──
 *   - files_list, files_get, files_delete, files_signed_url
 *   ── Forms ──
 *   - forms_list, forms_get, forms_submissions, forms_submit
 *   ── Webhooks ──
 *   - webhooks_list_subscriptions, webhooks_create_subscription, webhooks_delete_subscription
 *   ── Marketing emails ──
 *   - marketing_emails_list, marketing_emails_get, marketing_emails_statistics
 *   ── CMS (HubDB + URL redirects + blog posts write) ──
 *   - hubdb_tables_list, hubdb_rows_list, hubdb_row_create, hubdb_row_update, hubdb_publish
 *   - cms_redirects_list, cms_redirects_create, cms_redirects_delete
 *   ── Conversations ──
 *   - conversations_inboxes_list, conversations_threads_list, conversations_messages_send
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { appendOptional, encodePathSegment, maybeWrite, parseNumberFlag } from "../commands/crm/shared.js";
import { baseArgsSchema, executeTool, registerMcpTool } from "./server.js";

export function registerExtensionTools(server: McpServer): void {
  // ═══════════════════════════════════════════════════════════════════════
  // Workflows (v4 + legacy v3)
  // ═══════════════════════════════════════════════════════════════════════

  registerMcpTool(server, "workflows_list", {
    description: "List workflows (v4). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().int().positive().default(100),
      after: z.string().optional(),
    },
  }, (args: { limit?: number; after?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 100), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/automation/v4/flows?${params.toString()}`);
  }));

  registerMcpTool(server, "workflows_get", {
    description: "Get one workflow by flowId (v4). Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema, flowId: z.string().min(1) },
  }, (args: { flowId: string; profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request(`/automation/v4/flows/${encodePathSegment(args.flowId, "flowId")}`),
  ));

  registerMcpTool(server, "workflows_enroll", {
    description: "Enroll a contact into a legacy v3 workflow (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      workflowId: z.string().min(1),
      email: z.string().email(),
    },
  }, (args: { workflowId: string; email: string; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(ctx, client, "POST", `/automation/v2/workflows/${encodePathSegment(args.workflowId, "workflowId")}/enrollments/contacts/${encodePathSegment(args.email, "email")}`),
  ));

  registerMcpTool(server, "workflows_unenroll", {
    description: "Remove a contact from a legacy v3 workflow (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      workflowId: z.string().min(1),
      email: z.string().email(),
    },
  }, (args: { workflowId: string; email: string; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(ctx, client, "DELETE", `/automation/v2/workflows/${encodePathSegment(args.workflowId, "workflowId")}/enrollments/contacts/${encodePathSegment(args.email, "email")}`),
  ));

  // ═══════════════════════════════════════════════════════════════════════
  // Files
  // ═══════════════════════════════════════════════════════════════════════

  registerMcpTool(server, "files_list", {
    description: "List uploaded files. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().int().positive().max(100).default(50),
      after: z.string().optional(),
      parentFolderId: z.string().optional(),
      name: z.string().optional().describe("Filter by name substring"),
    },
  }, (args: { limit?: number; after?: string; parentFolderId?: string; name?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 50), "limit")));
    appendOptional(params, "after", args.after);
    appendOptional(params, "parentFolderId", args.parentFolderId);
    appendOptional(params, "name", args.name);
    return client.request(`/files/v3/files?${params.toString()}`);
  }));

  registerMcpTool(server, "files_get", {
    description: "Get metadata for a single file by ID. Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema, fileId: z.string().min(1) },
  }, (args: { fileId: string; profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request(`/files/v3/files/${encodePathSegment(args.fileId, "fileId")}`),
  ));

  registerMcpTool(server, "files_delete", {
    description: "Permanently delete a file (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema, fileId: z.string().min(1) },
  }, (args: { fileId: string; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(ctx, client, "DELETE", `/files/v3/files/${encodePathSegment(args.fileId, "fileId")}`),
  ));

  registerMcpTool(server, "files_signed_url", {
    description: "Generate a time-limited signed URL for a private file. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      fileId: z.string().min(1),
      expirationSeconds: z.number().int().positive().max(86400).default(3600),
    },
  }, (args: { fileId: string; expirationSeconds?: number; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("expirationSeconds", String(parseNumberFlag(String(args.expirationSeconds ?? 3600), "expirationSeconds")));
    return client.request(`/files/v3/files/${encodePathSegment(args.fileId, "fileId")}/signed-url?${params.toString()}`);
  }));

  // ═══════════════════════════════════════════════════════════════════════
  // Forms
  // ═══════════════════════════════════════════════════════════════════════

  registerMcpTool(server, "forms_list", {
    description: "List marketing forms. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().int().positive().default(100),
      after: z.string().optional(),
    },
  }, (args: { limit?: number; after?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 100), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/marketing/v3/forms?${params.toString()}`);
  }));

  registerMcpTool(server, "forms_get", {
    description: "Get one form by ID. Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema, formId: z.string().min(1) },
  }, (args: { formId: string; profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request(`/marketing/v3/forms/${encodePathSegment(args.formId, "formId")}`),
  ));

  registerMcpTool(server, "forms_submissions", {
    description: "List submissions for a form. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      formId: z.string().min(1),
      limit: z.number().int().positive().default(50),
      after: z.string().optional(),
    },
  }, (args: { formId: string; limit?: number; after?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 50), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/form-integrations/v1/submissions/forms/${encodePathSegment(args.formId, "formId")}?${params.toString()}`);
  }));

  registerMcpTool(server, "forms_submit", {
    description: "Programmatically submit a form (server-side submission endpoint). Dry-run by default unless force=true.",
    inputSchema: {
      ...baseArgsSchema,
      portalId: z.string().min(1),
      formGuid: z.string().min(1),
      fields: z.array(z.object({ name: z.string(), value: z.unknown() })).min(1),
      context: z.record(z.string(), z.unknown()).optional(),
    },
  }, (args: { portalId: string; formGuid: string; fields: Array<{ name: string; value: unknown }>; context?: Record<string, unknown>; force?: boolean; profile?: string }) =>
    executeTool(args, (ctx, client) => maybeWrite(
      ctx, client, "POST",
      `/submissions/v3/integration/submit/${encodePathSegment(args.portalId, "portalId")}/${encodePathSegment(args.formGuid, "formGuid")}`,
      { fields: args.fields, context: args.context ?? {} },
    )),
  );

  // ═══════════════════════════════════════════════════════════════════════
  // Webhooks
  // ═══════════════════════════════════════════════════════════════════════

  registerMcpTool(server, "webhooks_list_subscriptions", {
    description: "List webhook subscriptions for a HubSpot app. Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema, appId: z.string().min(1) },
  }, (args: { appId: string; profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request(`/webhooks/v3/${encodePathSegment(args.appId, "appId")}/subscriptions`),
  ));

  registerMcpTool(server, "webhooks_create_subscription", {
    description: "Create a webhook subscription (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      appId: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args: { appId: string; data: Record<string, unknown>; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(ctx, client, "POST", `/webhooks/v3/${encodePathSegment(args.appId, "appId")}/subscriptions`, args.data),
  ));

  registerMcpTool(server, "webhooks_delete_subscription", {
    description: "Delete a webhook subscription (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      appId: z.string().min(1),
      subscriptionId: z.string().min(1),
    },
  }, (args: { appId: string; subscriptionId: string; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(
      ctx, client, "DELETE",
      `/webhooks/v3/${encodePathSegment(args.appId, "appId")}/subscriptions/${encodePathSegment(args.subscriptionId, "subscriptionId")}`,
    ),
  ));

  // ═══════════════════════════════════════════════════════════════════════
  // Marketing emails (v3)
  // ═══════════════════════════════════════════════════════════════════════

  registerMcpTool(server, "marketing_emails_list", {
    description: "List marketing emails. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().int().positive().default(50),
      after: z.string().optional(),
    },
  }, (args: { limit?: number; after?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 50), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/marketing/v3/emails?${params.toString()}`);
  }));

  registerMcpTool(server, "marketing_emails_get", {
    description: "Get one marketing email by ID. Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema, emailId: z.string().min(1) },
  }, (args: { emailId: string; profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request(`/marketing/v3/emails/${encodePathSegment(args.emailId, "emailId")}`),
  ));

  registerMcpTool(server, "marketing_emails_statistics", {
    description: "Get statistics for a marketing email. Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema, emailId: z.string().min(1) },
  }, (args: { emailId: string; profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request(`/marketing/v3/emails/${encodePathSegment(args.emailId, "emailId")}/statistics`),
  ));

  // ═══════════════════════════════════════════════════════════════════════
  // CMS — HubDB
  // ═══════════════════════════════════════════════════════════════════════

  registerMcpTool(server, "hubdb_tables_list", {
    description: "List HubDB tables. Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema },
  }, (args: { profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request("/cms/v3/hubdb/tables"),
  ));

  registerMcpTool(server, "hubdb_rows_list", {
    description: "List rows in a HubDB table. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      tableIdOrName: z.string().min(1),
      limit: z.number().int().positive().default(100),
      after: z.string().optional(),
    },
  }, (args: { tableIdOrName: string; limit?: number; after?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 100), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/cms/v3/hubdb/tables/${encodePathSegment(args.tableIdOrName, "tableIdOrName")}/rows?${params.toString()}`);
  }));

  registerMcpTool(server, "hubdb_row_create", {
    description: "Create a row in a HubDB draft table (dry-run by default unless force=true). Call hubdb_publish to publish. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      tableIdOrName: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args: { tableIdOrName: string; data: Record<string, unknown>; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(ctx, client, "POST", `/cms/v3/hubdb/tables/${encodePathSegment(args.tableIdOrName, "tableIdOrName")}/rows/draft`, args.data),
  ));

  registerMcpTool(server, "hubdb_row_update", {
    description: "Update a HubDB row in the draft table (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      tableIdOrName: z.string().min(1),
      rowId: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args: { tableIdOrName: string; rowId: string; data: Record<string, unknown>; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(
      ctx, client, "PATCH",
      `/cms/v3/hubdb/tables/${encodePathSegment(args.tableIdOrName, "tableIdOrName")}/rows/${encodePathSegment(args.rowId, "rowId")}/draft`,
      args.data,
    ),
  ));

  registerMcpTool(server, "hubdb_publish", {
    description: "Publish a HubDB table's draft state to live (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      tableIdOrName: z.string().min(1),
    },
  }, (args: { tableIdOrName: string; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(
      ctx, client, "POST",
      `/cms/v3/hubdb/tables/${encodePathSegment(args.tableIdOrName, "tableIdOrName")}/draft/publish`,
    ),
  ));

  // ═══════════════════════════════════════════════════════════════════════
  // CMS — URL redirects
  // ═══════════════════════════════════════════════════════════════════════

  registerMcpTool(server, "cms_redirects_list", {
    description: "List CMS URL redirects. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().int().positive().default(100),
      after: z.string().optional(),
    },
  }, (args: { limit?: number; after?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 100), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/cms/v3/url-redirects?${params.toString()}`);
  }));

  registerMcpTool(server, "cms_redirects_create", {
    description: "Create a CMS URL redirect (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      data: z.record(z.string(), z.unknown()),
    },
  }, (args: { data: Record<string, unknown>; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(ctx, client, "POST", "/cms/v3/url-redirects", args.data),
  ));

  registerMcpTool(server, "cms_redirects_delete", {
    description: "Delete a CMS URL redirect (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      redirectId: z.string().min(1),
    },
  }, (args: { redirectId: string; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(ctx, client, "DELETE", `/cms/v3/url-redirects/${encodePathSegment(args.redirectId, "redirectId")}`),
  ));

  // ═══════════════════════════════════════════════════════════════════════
  // Conversations
  // ═══════════════════════════════════════════════════════════════════════

  registerMcpTool(server, "conversations_inboxes_list", {
    description: "List conversation inboxes. Not available via HubSpot Remote MCP.",
    inputSchema: { ...baseArgsSchema },
  }, (args: { profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request("/conversations/v3/conversations/inboxes"),
  ));

  registerMcpTool(server, "conversations_threads_list", {
    description: "List conversation threads. Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      inboxId: z.string().optional(),
      limit: z.number().int().positive().default(50),
      after: z.string().optional(),
    },
  }, (args: { inboxId?: string; limit?: number; after?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 50), "limit")));
    appendOptional(params, "after", args.after);
    appendOptional(params, "inboxId", args.inboxId);
    return client.request(`/conversations/v3/conversations/threads?${params.toString()}`);
  }));

  registerMcpTool(server, "conversations_messages_send", {
    description: "Send a message into a conversation thread (dry-run by default unless force=true). Not available via HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      threadId: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args: { threadId: string; data: Record<string, unknown>; force?: boolean; profile?: string }) => executeTool(args, (ctx, client) =>
    maybeWrite(
      ctx, client, "POST",
      `/conversations/v3/conversations/threads/${encodePathSegment(args.threadId, "threadId")}/messages`,
      args.data,
    ),
  ));
}
