/**
 * HubSpot Remote MCP — drop-in compatibility layer.
 *
 * HubSpot's hosted MCP server at `https://mcp.hubspot.com` exposes 12 tools
 * with a specific naming convention (e.g. `search_crm_objects`,
 * `get_crm_objects`, `manage_crm_objects`). Agents built against that
 * surface don't speak hscli's per-object tool family
 * (`crm_contacts_list`, `crm_contacts_search`, ...) out of the box.
 *
 * This module mirrors HubSpot's tool names 1-for-1, delegating to the same
 * HTTP layer hscli already uses. The result: any agent wired to
 * HubSpot Remote MCP can swap the endpoint to `hscli mcp` and keep working,
 * while gaining the capabilities HubSpot's hosted version doesn't expose —
 * most notably `manage_crm_objects` with `operation: "delete"`, custom
 * objects, and the full differentiation tool family defined in
 * src/mcp/ext-tools.ts.
 *
 * Tools registered here:
 *   1.  get_user_details
 *   2.  search_crm_objects
 *   3.  get_crm_objects
 *   4.  manage_crm_objects          (create | update | delete — hscli extension)
 *   5.  search_properties
 *   6.  get_properties
 *   7.  search_owners
 *   8.  get_campaign_analytics
 *   9.  get_campaign_contacts_by_type
 *   10. get_campaign_asset_types
 *   11. get_campaign_asset_metrics
 *
 * Intentionally omitted: `submit_feedback` (HubSpot-specific endpoint).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  appendOptional,
  encodePathSegment,
  maybeWrite,
  parseNumberFlag,
} from "../commands/crm/shared.js";
import { CliError } from "../core/output.js";
import { baseArgsSchema, executeTool, registerMcpTool } from "./server.js";

// Object types accepted by search_crm_objects / get_crm_objects /
// manage_crm_objects: contacts, companies, deals, tickets, line_items,
// products, quotes, invoices, orders, carts, subscriptions, and all five
// engagement types (calls, emails, meetings, notes, tasks). hscli also
// accepts custom object type IDs like "2-199622513" — we don't enforce a
// closed enum here because custom objects are per-portal.

/** Normalize a user-supplied object type to the canonical HubSpot URL segment. */
function normalizeObjectType(raw: string): string {
  const t = raw.trim().toLowerCase();
  // HubSpot's URL segments use kebab-less plurals; callers may pass either
  // "line_items" (HubSpot MCP convention) or "line-items" (API URL
  // convention). We accept both and normalize to the API form.
  if (t === "line_items" || t === "lineitems") return "line_items";
  return t;
}

export function registerHubspotCompatTools(server: McpServer): void {
  // ── 1. get_user_details ────────────────────────────────────────────────
  // HubSpot: "Returns the authenticated user's information, account
  // details, and per-object access." hscli hits /account-info/v3/details
  // + /oauth/v1/access-tokens/{token} to build an equivalent response.
  registerMcpTool(server, "get_user_details", {
    description: "Get the authenticated user's account info, portal details, and OAuth scopes. HubSpot-compat tool.",
    inputSchema: { ...baseArgsSchema },
  }, (args: { profile?: string }) => executeTool(args, async (_ctx, client) => {
    // /account-info/v3/details returns portalId, uiDomain, timeZone, currency, etc.
    const account = await client.request("/account-info/v3/details").catch(() => null);
    // Scope introspection requires the raw token, which is not exposed to
    // the HTTP layer. Surface what we have and let callers escalate to the
    // dedicated `hscli auth whoami` CLI if they need scope details.
    return {
      account,
      note: "For OAuth scopes + token introspection, call `hscli auth whoami` from the CLI.",
    };
  }));

  // ── 2. search_crm_objects ──────────────────────────────────────────────
  // HubSpot: "Search and filter CRM records using filter groups, text
  // queries, sorting, and pagination. Max 200/page, max 5 filter groups ×
  // 6 filters each." We accept the same shape.
  registerMcpTool(server, "search_crm_objects", {
    description: "Search CRM records by filter groups, text query, sorts, and pagination. HubSpot-compat: accepts the same filterGroups/query/sorts/properties/limit/after shape as HubSpot Remote MCP.",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.string().min(1).describe("contacts | companies | deals | tickets | line_items | products | quotes | invoices | orders | carts | subscriptions | calls | emails | meetings | notes | tasks | custom object type ID (2-XXXXXX)"),
      query: z.string().optional().describe("Text query string (alternative/in addition to filterGroups)"),
      filterGroups: z.array(z.unknown()).max(5).optional().describe("Max 5 filter groups, each with max 6 filters"),
      sorts: z.array(z.unknown()).optional(),
      properties: z.array(z.string()).optional(),
      limit: z.number().int().positive().max(200).default(10),
      after: z.string().optional(),
    },
  }, (args: {
    objectType: string;
    query?: string;
    filterGroups?: unknown[];
    sorts?: unknown[];
    properties?: string[];
    limit?: number;
    after?: string;
    profile?: string;
  }) => executeTool(args, (_ctx, client) => {
    if (args.filterGroups && args.filterGroups.length > 5) {
      throw new CliError("HUBSPOT_MCP_LIMIT", "filterGroups max 5 entries (HubSpot Remote MCP compat).");
    }
    const body: Record<string, unknown> = {
      limit: parseNumberFlag(String(args.limit ?? 10), "limit"),
    };
    if (args.query) body.query = args.query;
    if (args.filterGroups) body.filterGroups = args.filterGroups;
    if (args.sorts) body.sorts = args.sorts;
    if (args.properties) body.properties = args.properties;
    if (args.after) body.after = args.after;
    const objectTypeSegment = encodePathSegment(normalizeObjectType(args.objectType), "objectType");
    return client.request(`/crm/v3/objects/${objectTypeSegment}/search`, { method: "POST", body });
  }));

  // ── 3. get_crm_objects ─────────────────────────────────────────────────
  // HubSpot: "Fetch one or more CRM objects by their IDs in a single
  // request. Max 100/request." Implemented via batch/read.
  registerMcpTool(server, "get_crm_objects", {
    description: "Batch read CRM records by ID. HubSpot-compat: max 100 IDs per request.",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.string().min(1),
      ids: z.array(z.string().min(1)).min(1).max(100).describe("Max 100 IDs per request"),
      properties: z.array(z.string()).optional(),
      propertiesWithHistory: z.array(z.string()).optional(),
      idProperty: z.string().optional().describe("Optional unique property to look up records by (e.g. 'email')"),
    },
  }, (args: {
    objectType: string;
    ids: string[];
    properties?: string[];
    propertiesWithHistory?: string[];
    idProperty?: string;
    profile?: string;
  }) => executeTool(args, (_ctx, client) => {
    if (args.ids.length > 100) {
      throw new CliError("HUBSPOT_MCP_LIMIT", "get_crm_objects accepts max 100 IDs per request.");
    }
    const body: Record<string, unknown> = {
      inputs: args.ids.map((id) => ({ id })),
    };
    if (args.properties) body.properties = args.properties;
    if (args.propertiesWithHistory) body.propertiesWithHistory = args.propertiesWithHistory;
    if (args.idProperty) body.idProperty = args.idProperty;
    const objectTypeSegment = encodePathSegment(normalizeObjectType(args.objectType), "objectType");
    return client.request(`/crm/v3/objects/${objectTypeSegment}/batch/read`, { method: "POST", body });
  }));

  // ── 4. manage_crm_objects ──────────────────────────────────────────────
  // HubSpot hosted version: "Create or update CRM records or activities"
  // (no delete). hscli extends this with `operation: "delete"` because
  // hscli actually supports deletes (policy-guarded + change-ticket).
  registerMcpTool(server, "manage_crm_objects", {
    description: "Create, update, or DELETE CRM records. HubSpot-compat surface extended with 'delete' — policy-file + change-ticket still enforced server-side. Bulk max 100 records per call.",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.string().min(1),
      operation: z.enum(["create", "update", "delete"]).describe("HubSpot Remote MCP supports create/update; hscli adds 'delete'"),
      records: z.array(z.record(z.string(), z.unknown())).min(1).max(100).describe("Max 100 records per call"),
    },
  }, (args: {
    objectType: string;
    operation: "create" | "update" | "delete";
    records: Array<Record<string, unknown>>;
    profile?: string;
  }) => executeTool(args, (ctx, client) => {
    if (args.records.length > 100) {
      throw new CliError("HUBSPOT_MCP_LIMIT", "manage_crm_objects accepts max 100 records per call.");
    }
    const objectTypeSegment = encodePathSegment(normalizeObjectType(args.objectType), "objectType");
    const body = { inputs: args.records };
    if (args.operation === "create") {
      return maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectTypeSegment}/batch/create`, body);
    }
    if (args.operation === "update") {
      return maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectTypeSegment}/batch/update`, body);
    }
    // delete → batch/archive (HubSpot soft-delete)
    return maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectTypeSegment}/batch/archive`, body);
  }));

  // ── 5. search_properties ───────────────────────────────────────────────
  // HubSpot: "Find property definitions for an object type using keyword
  // search. Max 5 keywords." hscli hits /crm/v3/properties/{objectType}
  // and filters client-side (HubSpot's API doesn't expose a keyword
  // search for properties directly).
  registerMcpTool(server, "search_properties", {
    description: "Keyword-search property definitions for an object type. HubSpot-compat: max 5 keywords.",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.string().min(1),
      keywords: z.array(z.string().min(1)).min(1).max(5).describe("Max 5 keywords"),
    },
  }, (args: { objectType: string; keywords: string[]; profile?: string }) => executeTool(args, async (_ctx, client) => {
    if (args.keywords.length > 5) {
      throw new CliError("HUBSPOT_MCP_LIMIT", "search_properties accepts max 5 keywords.");
    }
    const objectTypeSegment = encodePathSegment(normalizeObjectType(args.objectType), "objectType");
    const res = await client.request(`/crm/v3/properties/${objectTypeSegment}`) as {
      results?: Array<{ name?: string; label?: string; description?: string }>;
    };
    const needles = args.keywords.map((k) => k.toLowerCase());
    const matches = (res.results ?? []).filter((p) => {
      const hay = `${p.name ?? ""} ${p.label ?? ""} ${p.description ?? ""}`.toLowerCase();
      return needles.some((n) => hay.includes(n));
    });
    return { results: matches, total: matches.length, keywords: args.keywords };
  }));

  // ── 6. get_properties ──────────────────────────────────────────────────
  registerMcpTool(server, "get_properties", {
    description: "Get full property definitions (types, enum options) for an object type. HubSpot-compat.",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.string().min(1),
      properties: z.array(z.string()).optional().describe("If omitted, returns all properties for the object type"),
    },
  }, (args: { objectType: string; properties?: string[]; profile?: string }) => executeTool(args, async (_ctx, client) => {
    const objectTypeSegment = encodePathSegment(normalizeObjectType(args.objectType), "objectType");
    if (!args.properties || args.properties.length === 0) {
      return client.request(`/crm/v3/properties/${objectTypeSegment}`);
    }
    // Resolve requested properties one at a time — HubSpot doesn't have
    // a batch-get for property definitions.
    const results = await Promise.all(args.properties.map((p) =>
      client.request(`/crm/v3/properties/${objectTypeSegment}/${encodePathSegment(p, "property")}`).catch((err) => ({ name: p, error: String(err) })),
    ));
    return { results };
  }));

  // ── 7. search_owners ───────────────────────────────────────────────────
  // HubSpot: "Find CRM record owners by name or email, or look up owners
  // by ID. Max 100 results."
  registerMcpTool(server, "search_owners", {
    description: "Find CRM owners by email or ID, or list all. HubSpot-compat: max 100 results.",
    inputSchema: {
      ...baseArgsSchema,
      email: z.string().email().optional(),
      ids: z.array(z.string()).max(100).optional(),
      limit: z.number().int().positive().max(100).default(100),
      after: z.string().optional(),
    },
  }, (args: { email?: string; ids?: string[]; limit?: number; after?: string; profile?: string }) => executeTool(args, async (_ctx, client) => {
    if (args.ids && args.ids.length > 0) {
      const results = await Promise.all(args.ids.map((id) =>
        client.request(`/crm/v3/owners/${encodePathSegment(id, "ownerId")}`).catch((err) => ({ id, error: String(err) })),
      ));
      return { results };
    }
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(100, parseNumberFlag(String(args.limit ?? 100), "limit"))));
    appendOptional(params, "after", args.after);
    appendOptional(params, "email", args.email);
    return client.request(`/crm/v3/owners/?${params.toString()}`);
  }));

  // ── 8. get_campaign_analytics ──────────────────────────────────────────
  registerMcpTool(server, "get_campaign_analytics", {
    description: "Get campaign analytics (aggregated metrics) for one or more campaigns. HubSpot-compat.",
    inputSchema: {
      ...baseArgsSchema,
      campaignIds: z.array(z.string().min(1)).min(1).describe("One or more campaign GUIDs"),
      startDate: z.string().optional().describe("ISO-8601 date"),
      endDate: z.string().optional(),
    },
  }, (args: { campaignIds: string[]; startDate?: string; endDate?: string; profile?: string }) => executeTool(args, async (_ctx, client) => {
    const results = await Promise.all(args.campaignIds.map(async (id) => {
      const params = new URLSearchParams();
      appendOptional(params, "startDate", args.startDate);
      appendOptional(params, "endDate", args.endDate);
      const qs = params.toString();
      try {
        return {
          campaignId: id,
          metrics: await client.request(`/marketing/v3/campaigns/${encodePathSegment(id, "campaignId")}/metrics${qs ? `?${qs}` : ""}`),
        };
      } catch (err) {
        return { campaignId: id, error: err instanceof Error ? err.message : String(err) };
      }
    }));
    return { results };
  }));

  // ── 9. get_campaign_contacts_by_type ──────────────────────────────────
  registerMcpTool(server, "get_campaign_contacts_by_type", {
    description: "Paginated contact IDs for a campaign filtered by attribution type (e.g. 'INFLUENCED'). HubSpot-compat.",
    inputSchema: {
      ...baseArgsSchema,
      campaignId: z.string().min(1),
      attributionType: z.string().min(1).describe("HubSpot attribution type (e.g. INFLUENCED, DIRECT, FIRST_TOUCH)"),
      limit: z.number().int().positive().default(100),
      after: z.string().optional(),
    },
  }, (args: { campaignId: string; attributionType: string; limit?: number; after?: string; profile?: string }) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("attributionType", args.attributionType);
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 100), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/marketing/v3/campaigns/${encodePathSegment(args.campaignId, "campaignId")}/contacts?${params.toString()}`);
  }));

  // ── 10. get_campaign_asset_types ───────────────────────────────────────
  registerMcpTool(server, "get_campaign_asset_types", {
    description: "List available campaign asset types (emails, blog posts, ads, etc.). HubSpot-compat.",
    inputSchema: { ...baseArgsSchema },
  }, (args: { profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request("/marketing/v3/campaigns/asset-types"),
  ));

  // ── 11. get_campaign_asset_metrics ─────────────────────────────────────
  registerMcpTool(server, "get_campaign_asset_metrics", {
    description: "Get metrics for specific CRM objects associated with a campaign. HubSpot-compat.",
    inputSchema: {
      ...baseArgsSchema,
      campaignId: z.string().min(1),
      assetType: z.string().min(1),
      assetId: z.string().min(1),
    },
  }, (args: { campaignId: string; assetType: string; assetId: string; profile?: string }) => executeTool(args, (_ctx, client) =>
    client.request(
      `/marketing/v3/campaigns/${encodePathSegment(args.campaignId, "campaignId")}`
      + `/assets/${encodePathSegment(args.assetType, "assetType")}`
      + `/${encodePathSegment(args.assetId, "assetId")}/metrics`,
    ),
  ));
}
