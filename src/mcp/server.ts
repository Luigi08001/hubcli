import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getToken, getApiBaseUrl } from "../core/auth.js";
import { HubSpotClient } from "../core/http.js";
import { CliError, redactSensitive, type CliContext } from "../core/output.js";
import {
  ENGAGEMENT_OBJECT_TYPES,
  OBJECT_COMMAND_TYPES,
  PIPELINE_OBJECT_TYPES,
  PROPERTY_OBJECT_TYPES,
  appendOptional,
  encodePathSegment,
  maybeWrite,
  parseBooleanFlag,
  parseNumberFlag,
  parseSupportedObjectType,
} from "../commands/crm/shared.js";
import {
  resolvePortalContext,
  enrichListResponse,
  enrichRecordUrl,
  enrichCustomListResponse,
  enrichCustomRecordUrl,
} from "../core/urls.js";
import { registerHubspotCompatTools } from "./compat-hubspot.js";
import { registerExtensionTools } from "./ext-tools.js";

export interface McpBaseArgs {
  profile?: string;
  force?: boolean;
  dryRun?: boolean;
}

export const baseArgsSchema = {
  profile: z.string().min(1).optional(),
  force: z.boolean().optional(),
  dryRun: z.boolean().optional(),
};

export function resolveProfile(requested?: string): string {
  // Priority order:
  // 1. HSCLI_MCP_PROFILE — hard lock (any other profile request throws)
  // 2. Explicit `profile` arg on the tool call
  // 3. HSCLI_PROFILE — set by the CLI's preAction hook when user passes
  //    `hscli --profile prod mcp`. Without this, launching MCP with
  //    `--profile prod` silently fell back to "default" and could send
  //    reads/writes to the wrong portal.
  // 4. "default"
  const isolatedProfile = process.env.HSCLI_MCP_PROFILE?.trim();
  if (isolatedProfile) {
    const selected = requested?.trim() || isolatedProfile;
    if (selected !== isolatedProfile) {
      throw new CliError("MCP_PROFILE_ISOLATED", `MCP server is locked to profile '${isolatedProfile}'.`);
    }
    return isolatedProfile;
  }

  const requestedTrimmed = requested?.trim();
  if (requestedTrimmed) return requestedTrimmed;

  const inheritedProfile = process.env.HSCLI_PROFILE?.trim();
  if (inheritedProfile) return inheritedProfile;

  return "default";
}

function mcpContext(args: McpBaseArgs): CliContext {
  const force = Boolean(args.force);
  const dryRun = args.dryRun ?? !force;
  return {
    profile: resolveProfile(args.profile),
    json: true,
    dryRun,
    force,
  };
}

function asStructuredContent(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { result: value };
}

function textResult(data: unknown): { content: Array<{ type: "text"; text: string }>; structuredContent: Record<string, unknown> } {
  const safe = redactSensitive(data);
  return {
    content: [{ type: "text", text: JSON.stringify(safe, null, 2) }],
    structuredContent: asStructuredContent(safe),
  };
}

export async function executeTool(args: McpBaseArgs, fn: (ctx: CliContext, client: HubSpotClient) => Promise<unknown>) {
  try {
    const ctx = mcpContext(args);
    const client = new HubSpotClient(getToken(ctx.profile), {
      profile: ctx.profile,
      strictCapabilities: isEnvTrue(process.env.HSCLI_MCP_STRICT_CAPABILITIES),
      apiBaseUrl: getApiBaseUrl(ctx.profile),
    });
    const result = await fn(ctx, client);
    return textResult(result);
  } catch (error) {
    const err = error instanceof CliError
      ? error
      : new CliError("UNEXPECTED_ERROR", error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      ...textResult({
        code: err.code,
        message: err.message,
        status: err.status,
        details: err.details,
      }),
    };
  }
}

/**
 * Wrap `server.registerTool` so every MCP handler runs with
 * HSCLI_MCP_TOOL_NAME set to this tool's name. The HTTP layer reads this
 * env var to tag trace/telemetry events, so `hscli trace stats` and
 * `hscli audit by-tool` can break activity down by MCP tool.
 *
 * The SDK's registerTool signature is a heavily-overloaded generic; we
 * stay loosely typed here because every callsite already builds its own
 * config/handler with the right shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerMcpTool(server: McpServer, name: string, config: any, handler: (...args: any[]) => any): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrapped = (...handlerArgs: any[]): any => {
    const previous = process.env.HSCLI_MCP_TOOL_NAME;
    process.env.HSCLI_MCP_TOOL_NAME = name;
    const restore = () => {
      if (previous === undefined) delete process.env.HSCLI_MCP_TOOL_NAME;
      else process.env.HSCLI_MCP_TOOL_NAME = previous;
    };
    try {
      const result = handler(...handlerArgs);
      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        return Promise.resolve(result as PromiseLike<unknown>).finally(restore);
      }
      restore();
      return result;
    } catch (err) {
      restore();
      throw err;
    }
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server.registerTool as any)(name, config, wrapped);
}

function isEnvTrue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function registerStandardObjectTools(server: McpServer, objectType: string): void {
  registerMcpTool(server,`crm_${objectType}_list`, {
    description: `List ${objectType}`,
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().int().positive().default(10),
      after: z.string().optional(),
      archived: z.boolean().optional(),
      properties: z.string().optional(),
    },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 10), "limit")));
    appendOptional(params, "after", args.after);
    if (args.archived !== undefined) {
      params.set("archived", String(parseBooleanFlag(String(args.archived), "archived")));
    }
    appendOptional(params, "properties", args.properties);
    const res = await client.request(`/crm/v3/objects/${objectType}?${params.toString()}`);
    enrichListResponse(res, portal, objectType);
    return res;
  }));

  registerMcpTool(server,`crm_${objectType}_get`, {
    description: `Get one ${objectType.slice(0, -1)} by ID`,
    inputSchema: {
      ...baseArgsSchema,
      id: z.string().min(1),
      properties: z.string().optional(),
    },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const idSegment = encodePathSegment(args.id, "id");
    const suffix = args.properties ? `?properties=${encodeURIComponent(args.properties)}` : "";
    const res = await client.request(`/crm/v3/objects/${objectType}/${idSegment}${suffix}`);
    if (res && typeof res === "object") enrichRecordUrl(res as Record<string, unknown>, portal, objectType);
    return res;
  }));

  registerMcpTool(server,`crm_${objectType}_search`, {
    description: `Search ${objectType}`,
    inputSchema: {
      ...baseArgsSchema,
      query: z.string().min(1),
      limit: z.number().int().positive().default(10),
      after: z.number().int().positive().optional(),
    },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const body: Record<string, unknown> = {
      query: args.query,
      limit: parseNumberFlag(String(args.limit ?? 10), "limit"),
    };
    if (args.after !== undefined) {
      body.after = parseNumberFlag(String(args.after), "after");
    }
    const res = await client.request(`/crm/v3/objects/${objectType}/search`, { method: "POST", body });
    enrichListResponse(res, portal, objectType);
    return res;
  }));

  registerMcpTool(server,`crm_${objectType}_create`, {
    description: `Create ${objectType.slice(0, -1)} (dry-run by default unless force=true)`,
    inputSchema: {
      ...baseArgsSchema,
      data: z.record(z.string(), z.unknown()),
    },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectType}`, args.data);
    if (res && typeof res === "object") enrichRecordUrl(res as Record<string, unknown>, portal, objectType);
    return res;
  }));

  registerMcpTool(server,`crm_${objectType}_update`, {
    description: `Update ${objectType.slice(0, -1)} (dry-run by default unless force=true)`,
    inputSchema: {
      ...baseArgsSchema,
      id: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const idSegment = encodePathSegment(args.id, "id");
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/objects/${objectType}/${idSegment}`, args.data);
    if (res && typeof res === "object") enrichRecordUrl(res as Record<string, unknown>, portal, objectType);
    return res;
  }));

  registerMcpTool(server,`crm_${objectType}_delete`, {
    description: `Delete/archive ${objectType.slice(0, -1)} by ID (dry-run by default unless force=true)`,
    inputSchema: { ...baseArgsSchema, id: z.string().min(1) },
  }, (args) => executeTool(args, (ctx, client) => {
    const idSegment = encodePathSegment(args.id, "id");
    return maybeWrite(ctx, client, "DELETE", `/crm/v3/objects/${objectType}/${idSegment}`);
  }));

  registerMcpTool(server,`crm_${objectType}_merge`, {
    description: `Merge ${objectType} records (endpoint support varies by object)`,
    inputSchema: { ...baseArgsSchema, data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, (ctx, client) => maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectType}/merge`, args.data)));

  registerMcpTool(server,`crm_${objectType}_batch_read`, {
    description: `Batch read ${objectType}`,
    inputSchema: { ...baseArgsSchema, data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, (_ctx, client) => client.request(`/crm/v3/objects/${objectType}/batch/read`, { method: "POST", body: args.data })));

  registerMcpTool(server,`crm_${objectType}_batch_upsert`, {
    description: `Batch upsert ${objectType} (dry-run by default unless force=true)`,
    inputSchema: { ...baseArgsSchema, data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, (ctx, client) => maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectType}/batch/upsert`, args.data)));

  registerMcpTool(server,`crm_${objectType}_batch_archive`, {
    description: `Batch archive ${objectType} (dry-run by default unless force=true)`,
    inputSchema: { ...baseArgsSchema, data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, (ctx, client) => maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectType}/batch/archive`, args.data)));
}

export function registerHubSpotTools(server: McpServer): void {
  for (const objectType of OBJECT_COMMAND_TYPES) {
    registerStandardObjectTools(server, objectType);
  }

  for (const objectType of ENGAGEMENT_OBJECT_TYPES) {
    registerStandardObjectTools(server, objectType);
  }

  // HubSpot Remote MCP drop-in compatibility layer — agents built against
  // https://mcp.hubspot.com can target `hscli mcp` unchanged.
  registerHubspotCompatTools(server);

  // Extension surface — MCP tools that HubSpot's hosted server doesn't
  // expose (workflows, files, forms, webhooks, marketing-emails, CMS writes,
  // conversations).
  registerExtensionTools(server);

  registerMcpTool(server,"crm_properties_list", {
    description: "List properties for an object type",
    inputSchema: { ...baseArgsSchema, objectType: z.enum(PROPERTY_OBJECT_TYPES) },
  }, (args) => executeTool(args, (_ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    return client.request(`/crm/v3/properties/${objectTypeSegment}`);
  }));

  registerMcpTool(server,"crm_properties_get", {
    description: "Get one property definition",
    inputSchema: { ...baseArgsSchema, objectType: z.enum(PROPERTY_OBJECT_TYPES), propertyName: z.string().min(1) },
  }, (args) => executeTool(args, (_ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const propertyNameSegment = encodePathSegment(args.propertyName, "propertyName");
    return client.request(`/crm/v3/properties/${objectTypeSegment}/${propertyNameSegment}`);
  }));

  registerMcpTool(server,"crm_properties_create", {
    description: "Create property (dry-run by default unless force=true)",
    inputSchema: { ...baseArgsSchema, objectType: z.enum(PROPERTY_OBJECT_TYPES), data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, (ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    return maybeWrite(ctx, client, "POST", `/crm/v3/properties/${objectTypeSegment}`, args.data);
  }));

  registerMcpTool(server,"crm_properties_update", {
    description: "Update property (dry-run by default unless force=true)",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.enum(PROPERTY_OBJECT_TYPES),
      propertyName: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const propertyNameSegment = encodePathSegment(args.propertyName, "propertyName");
    return maybeWrite(ctx, client, "PATCH", `/crm/v3/properties/${objectTypeSegment}/${propertyNameSegment}`, args.data);
  }));

  registerMcpTool(server,"crm_associations_list", {
    description: "List associations between CRM objects (supports standard types, engagements, and custom object type IDs like 2-199622513)",
    inputSchema: {
      ...baseArgsSchema,
      fromObjectType: z.string().min(1).describe("Object type name (contacts, deals, notes, calls, etc.) or custom object type ID (e.g. 2-199622513)"),
      fromObjectId: z.string().min(1),
      toObjectType: z.string().min(1).describe("Object type name or custom object type ID"),
      limit: z.number().int().positive().default(100),
      after: z.string().optional(),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const fromObjectTypeSegment = encodePathSegment(args.fromObjectType.trim().toLowerCase(), "fromObjectType");
    const fromObjectIdSegment = encodePathSegment(args.fromObjectId, "fromObjectId");
    const toObjectTypeSegment = encodePathSegment(args.toObjectType.trim().toLowerCase(), "toObjectType");
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 100), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/crm/v4/objects/${fromObjectTypeSegment}/${fromObjectIdSegment}/associations/${toObjectTypeSegment}?${params.toString()}`);
  }));

  registerMcpTool(server,"crm_associations_create", {
    description: "Create default association (dry-run by default unless force=true). Supports standard types, engagements, and custom object type IDs.",
    inputSchema: {
      ...baseArgsSchema,
      fromObjectType: z.string().min(1).describe("Object type name (contacts, deals, notes, calls, etc.) or custom object type ID (e.g. 2-199622513)"),
      fromObjectId: z.string().min(1),
      toObjectType: z.string().min(1).describe("Object type name or custom object type ID"),
      toObjectId: z.string().min(1),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    return maybeWrite(
      ctx,
      client,
      "PUT",
      `/crm/v4/objects/${encodePathSegment(args.fromObjectType.trim().toLowerCase(), "fromObjectType")}/${encodePathSegment(args.fromObjectId, "fromObjectId")}/associations/default/${encodePathSegment(args.toObjectType.trim().toLowerCase(), "toObjectType")}/${encodePathSegment(args.toObjectId, "toObjectId")}`,
    );
  }));

  registerMcpTool(server,"crm_associations_remove", {
    description: "Remove default association (dry-run by default unless force=true). Supports standard types, engagements, and custom object type IDs.",
    inputSchema: {
      ...baseArgsSchema,
      fromObjectType: z.string().min(1).describe("Object type name (contacts, deals, notes, calls, etc.) or custom object type ID (e.g. 2-199622513)"),
      fromObjectId: z.string().min(1),
      toObjectType: z.string().min(1).describe("Object type name or custom object type ID"),
      toObjectId: z.string().min(1),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    return maybeWrite(
      ctx,
      client,
      "DELETE",
      `/crm/v4/objects/${encodePathSegment(args.fromObjectType.trim().toLowerCase(), "fromObjectType")}/${encodePathSegment(args.fromObjectId, "fromObjectId")}/associations/default/${encodePathSegment(args.toObjectType.trim().toLowerCase(), "toObjectType")}/${encodePathSegment(args.toObjectId, "toObjectId")}`,
    );
  }));

  registerMcpTool(server,"crm_imports_create", {
    description: "Create import (dry-run by default unless force=true)",
    inputSchema: { ...baseArgsSchema, data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, (ctx, client) => maybeWrite(ctx, client, "POST", "/crm/v3/imports", args.data)));

  registerMcpTool(server,"crm_imports_list", {
    description: "List import jobs",
    inputSchema: { ...baseArgsSchema, limit: z.number().int().positive().default(100), after: z.string().optional() },
  }, (args) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 100), "limit")));
    appendOptional(params, "after", args.after);
    return client.request(`/crm/v3/imports?${params.toString()}`);
  }));

  registerMcpTool(server,"crm_imports_get", {
    description: "Get import by ID",
    inputSchema: { ...baseArgsSchema, importId: z.string().min(1) },
  }, (args) => executeTool(args, (_ctx, client) => {
    const importIdSegment = encodePathSegment(args.importId, "importId");
    return client.request(`/crm/v3/imports/${importIdSegment}`);
  }));

  registerMcpTool(server,"crm_imports_errors", {
    description: "Get import errors",
    inputSchema: { ...baseArgsSchema, importId: z.string().min(1) },
  }, (args) => executeTool(args, (_ctx, client) => {
    const importIdSegment = encodePathSegment(args.importId, "importId");
    return client.request(`/crm/v3/imports/${importIdSegment}/errors`);
  }));

  registerMcpTool(server,"crm_owners_list", {
    description: "List HubSpot owners",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().int().positive().default(100),
      after: z.string().optional(),
      email: z.string().email().optional(),
    },
  }, (args) => executeTool(args, (_ctx, client) => {
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 100), "limit")));
    appendOptional(params, "after", args.after);
    appendOptional(params, "email", args.email);
    return client.request(`/crm/v3/owners/?${params.toString()}`);
  }));

  registerMcpTool(server,"crm_custom_schemas_list", {
    description: "List custom object schemas",
    inputSchema: { ...baseArgsSchema },
  }, (args) => executeTool(args, (_ctx, client) => client.request("/crm/v3/schemas")));

  registerMcpTool(server,"crm_custom_schemas_get", {
    description: "Get custom object schema by objectType",
    inputSchema: { ...baseArgsSchema, objectType: z.string().min(1) },
  }, (args) => executeTool(args, (_ctx, client) => client.request(`/crm/v3/schemas/${encodePathSegment(args.objectType, "objectType")}`)));

  registerMcpTool(server,"crm_custom_schemas_create", {
    description: "Create custom object schema (dry-run by default unless force=true)",
    inputSchema: { ...baseArgsSchema, data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, (ctx, client) => maybeWrite(ctx, client, "POST", "/crm/v3/schemas", args.data)));

  registerMcpTool(server,"crm_custom_schemas_update", {
    description: "Update custom object schema (dry-run by default unless force=true)",
    inputSchema: { ...baseArgsSchema, objectType: z.string().min(1), data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, (ctx, client) => maybeWrite(
    ctx,
    client,
    "PATCH",
    `/crm/v3/schemas/${encodePathSegment(args.objectType, "objectType")}`,
    args.data,
  )));

  registerMcpTool(server,"crm_custom_records_list", {
    description: "List custom object records by objectType",
    inputSchema: { ...baseArgsSchema, objectType: z.string().min(1), limit: z.number().int().positive().default(50), after: z.string().optional() },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(String(args.limit ?? 50), "limit")));
    appendOptional(params, "after", args.after);
    const res = await client.request(`/crm/v3/objects/${encodePathSegment(args.objectType, "objectType")}?${params.toString()}`);
    enrichCustomListResponse(res, portal, args.objectType);
    return res;
  }));

  registerMcpTool(server,"crm_custom_records_get", {
    description: "Get custom object record by objectType and id",
    inputSchema: { ...baseArgsSchema, objectType: z.string().min(1), id: z.string().min(1) },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const res = await client.request(
      `/crm/v3/objects/${encodePathSegment(args.objectType, "objectType")}/${encodePathSegment(args.id, "id")}`,
    );
    if (res && typeof res === "object") enrichCustomRecordUrl(res as Record<string, unknown>, portal, args.objectType);
    return res;
  }));

  registerMcpTool(server,"crm_custom_records_search", {
    description: "Search custom object records",
    inputSchema: { ...baseArgsSchema, objectType: z.string().min(1), data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const res = await client.request(
      `/crm/v3/objects/${encodePathSegment(args.objectType, "objectType")}/search`,
      { method: "POST", body: args.data },
    );
    enrichCustomListResponse(res, portal, args.objectType);
    return res;
  }));

  registerMcpTool(server,"crm_custom_records_create", {
    description: "Create custom object record (dry-run by default unless force=true)",
    inputSchema: { ...baseArgsSchema, objectType: z.string().min(1), data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const res = await maybeWrite(
      ctx,
      client,
      "POST",
      `/crm/v3/objects/${encodePathSegment(args.objectType, "objectType")}`,
      args.data,
    );
    if (res && typeof res === "object") enrichCustomRecordUrl(res as Record<string, unknown>, portal, args.objectType);
    return res;
  }));

  registerMcpTool(server,"crm_custom_records_update", {
    description: "Update custom object record (dry-run by default unless force=true)",
    inputSchema: { ...baseArgsSchema, objectType: z.string().min(1), id: z.string().min(1), data: z.record(z.string(), z.unknown()) },
  }, (args) => executeTool(args, async (ctx, client) => {
    const portal = resolvePortalContext(ctx.profile);
    const res = await maybeWrite(
      ctx,
      client,
      "PATCH",
      `/crm/v3/objects/${encodePathSegment(args.objectType, "objectType")}/${encodePathSegment(args.id, "id")}`,
      args.data,
    );
    if (res && typeof res === "object") enrichCustomRecordUrl(res as Record<string, unknown>, portal, args.objectType);
    return res;
  }));

  registerMcpTool(server,"crm_custom_records_delete", {
    description: "Delete custom object record (dry-run by default unless force=true)",
    inputSchema: { ...baseArgsSchema, objectType: z.string().min(1), id: z.string().min(1) },
  }, (args) => executeTool(args, (ctx, client) => maybeWrite(
    ctx,
    client,
    "DELETE",
    `/crm/v3/objects/${encodePathSegment(args.objectType, "objectType")}/${encodePathSegment(args.id, "id")}`,
  )));

  registerMcpTool(server,"crm_pipelines_list", {
    description: "List pipelines for object type",
    inputSchema: { ...baseArgsSchema, objectType: z.enum(PIPELINE_OBJECT_TYPES) },
  }, (args) => executeTool(args, (_ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PIPELINE_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    return client.request(`/crm/v3/pipelines/${objectTypeSegment}`);
  }));

  registerMcpTool(server,"crm_pipelines_get", {
    description: "Get one pipeline",
    inputSchema: { ...baseArgsSchema, objectType: z.enum(PIPELINE_OBJECT_TYPES), pipelineId: z.string().min(1) },
  }, (args) => executeTool(args, (_ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PIPELINE_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const pipelineIdSegment = encodePathSegment(args.pipelineId, "pipelineId");
    return client.request(`/crm/v3/pipelines/${objectTypeSegment}/${pipelineIdSegment}`);
  }));

  registerMcpTool(server,"hub_api_request", {
    description: "Raw HubSpot API request with safety controls",
    inputSchema: {
      ...baseArgsSchema,
      method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]).default("GET"),
      path: z.string().min(1),
      data: z.record(z.string(), z.unknown()).optional(),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    const method = args.method;
    if (method === "GET") {
      return client.request(args.path, { method });
    }
    return maybeWrite(ctx, client, method, args.path, args.data);
  }));

  // ── Lists ──────────────────────────────────────────────────────────────

  registerMcpTool(server,"crm_lists_list", {
    description: "List CRM lists with pagination",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().min(1).max(250).optional(),
      after: z.string().optional(),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const params = new URLSearchParams();
    if (args.limit) params.set("limit", String(args.limit));
    if (args.after) params.set("after", args.after);
    const qs = params.toString();
    return await client.request(`/crm/v3/lists${qs ? `?${qs}` : ""}`);
  }));

  registerMcpTool(server,"crm_lists_get", {
    description: "Get a CRM list by ID",
    inputSchema: {
      ...baseArgsSchema,
      listId: z.string().min(1),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const listIdSegment = encodePathSegment(args.listId, "listId");
    return await client.request(`/crm/v3/lists/${listIdSegment}`);
  }));

  registerMcpTool(server,"crm_lists_create", {
    description: "Create a CRM list (dry-run by default unless force=true)",
    inputSchema: {
      ...baseArgsSchema,
      data: z.record(z.string(), z.unknown()),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    return maybeWrite(ctx, client, "POST", "/crm/v3/lists", args.data);
  }));

  registerMcpTool(server,"crm_lists_update", {
    description: "Update a CRM list (dry-run by default unless force=true)",
    inputSchema: {
      ...baseArgsSchema,
      listId: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    const listIdSegment = encodePathSegment(args.listId, "listId");
    return maybeWrite(ctx, client, "PATCH", `/crm/v3/lists/${listIdSegment}`, args.data);
  }));

  registerMcpTool(server,"crm_lists_delete", {
    description: "Delete a CRM list (dry-run by default unless force=true)",
    inputSchema: {
      ...baseArgsSchema,
      listId: z.string().min(1),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    const listIdSegment = encodePathSegment(args.listId, "listId");
    return maybeWrite(ctx, client, "DELETE", `/crm/v3/lists/${listIdSegment}`);
  }));

  registerMcpTool(server,"crm_lists_memberships", {
    description: "Get memberships of a CRM list",
    inputSchema: {
      ...baseArgsSchema,
      listId: z.string().min(1),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const listIdSegment = encodePathSegment(args.listId, "listId");
    return await client.request(`/crm/v3/lists/${listIdSegment}/memberships`);
  }));

  // ── Sequences ──────────────────────────────────────────────────────────

  registerMcpTool(server,"sales_sequences_list", {
    description: "List sales sequences with pagination",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().min(1).max(250).optional(),
      after: z.string().optional(),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const params = new URLSearchParams();
    if (args.limit) params.set("limit", String(args.limit));
    if (args.after) params.set("after", args.after);
    const qs = params.toString();
    return await client.request(`/automation/v4/sequences${qs ? `?${qs}` : ""}`);
  }));

  registerMcpTool(server,"sales_sequences_get", {
    description: "Get a sales sequence by ID",
    inputSchema: {
      ...baseArgsSchema,
      sequenceId: z.string().min(1),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const sequenceIdSegment = encodePathSegment(args.sequenceId, "sequenceId");
    return await client.request(`/automation/v4/sequences/${sequenceIdSegment}`);
  }));

  registerMcpTool(server,"sales_sequences_enrollments", {
    description: "Get enrollments for a sales sequence",
    inputSchema: {
      ...baseArgsSchema,
      sequenceId: z.string().min(1),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const sequenceIdSegment = encodePathSegment(args.sequenceId, "sequenceId");
    return await client.request(`/automation/v4/sequences/${sequenceIdSegment}/enrollments`);
  }));

  // ── Reporting ──────────────────────────────────────────────────────────

  registerMcpTool(server,"reporting_dashboards_list", {
    description: "List analytics reports/dashboards with pagination",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().min(1).max(250).optional(),
      after: z.string().optional(),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const params = new URLSearchParams();
    if (args.limit) params.set("limit", String(args.limit));
    if (args.after) params.set("after", args.after);
    const qs = params.toString();
    return await client.request(`/analytics/v2/reports${qs ? `?${qs}` : ""}`);
  }));

  registerMcpTool(server,"reporting_dashboards_get", {
    description: "Get an analytics report/dashboard by ID",
    inputSchema: {
      ...baseArgsSchema,
      dashboardId: z.string().min(1),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const dashboardIdSegment = encodePathSegment(args.dashboardId, "dashboardId");
    return await client.request(`/analytics/v2/reports/${dashboardIdSegment}`);
  }));

  // ── Exports ────────────────────────────────────────────────────────────

  registerMcpTool(server,"crm_exports_create", {
    description: "Create a CRM export (dry-run by default unless force=true)",
    inputSchema: {
      ...baseArgsSchema,
      data: z.record(z.string(), z.unknown()),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    return maybeWrite(ctx, client, "POST", "/crm/v3/exports", args.data);
  }));

  registerMcpTool(server,"crm_exports_list", {
    description: "List CRM exports with pagination",
    inputSchema: {
      ...baseArgsSchema,
      limit: z.number().min(1).max(250).optional(),
      after: z.string().optional(),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const params = new URLSearchParams();
    if (args.limit) params.set("limit", String(args.limit));
    if (args.after) params.set("after", args.after);
    const qs = params.toString();
    return await client.request(`/crm/v3/exports${qs ? `?${qs}` : ""}`);
  }));

  registerMcpTool(server,"crm_exports_get", {
    description: "Get a CRM export by ID",
    inputSchema: {
      ...baseArgsSchema,
      exportId: z.string().min(1),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const exportIdSegment = encodePathSegment(args.exportId, "exportId");
    return await client.request(`/crm/v3/exports/${exportIdSegment}`);
  }));

  registerMcpTool(server,"crm_exports_status", {
    description: "Get the status of a CRM export",
    inputSchema: {
      ...baseArgsSchema,
      exportId: z.string().min(1),
    },
  }, (args) => executeTool(args, async (_ctx, client) => {
    const exportIdSegment = encodePathSegment(args.exportId, "exportId");
    return await client.request(`/crm/v3/exports/${exportIdSegment}/status`);
  }));

  // ── Pipeline Stages ────────────────────────────────────────────────────

  registerMcpTool(server,"crm_pipelines_stages", {
    description: "List stages for a pipeline",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.enum(PIPELINE_OBJECT_TYPES),
      pipelineId: z.string().min(1),
    },
  }, (args) => executeTool(args, (_ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PIPELINE_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const pipelineIdSegment = encodePathSegment(args.pipelineId, "pipelineId");
    return client.request(`/crm/v3/pipelines/${objectTypeSegment}/${pipelineIdSegment}/stages`);
  }));

  // ── Property Groups ────────────────────────────────────────────────────

  registerMcpTool(server,"crm_property_groups_list", {
    description: "List property groups for an object type",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.enum(PROPERTY_OBJECT_TYPES),
    },
  }, (args) => executeTool(args, (_ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    return client.request(`/crm/v3/properties/${objectTypeSegment}/groups`);
  }));

  registerMcpTool(server,"crm_property_groups_create", {
    description: "Create a property group (dry-run by default unless force=true)",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.enum(PROPERTY_OBJECT_TYPES),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    return maybeWrite(ctx, client, "POST", `/crm/v3/properties/${objectTypeSegment}/groups`, args.data);
  }));

  registerMcpTool(server,"crm_property_groups_update", {
    description: "Update a property group (dry-run by default unless force=true)",
    inputSchema: {
      ...baseArgsSchema,
      objectType: z.enum(PROPERTY_OBJECT_TYPES),
      groupName: z.string().min(1),
      data: z.record(z.string(), z.unknown()),
    },
  }, (args) => executeTool(args, (ctx, client) => {
    const objectTypeValue = parseSupportedObjectType(args.objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const groupNameSegment = encodePathSegment(args.groupName, "groupName");
    return maybeWrite(ctx, client, "PATCH", `/crm/v3/properties/${objectTypeSegment}/groups/${groupNameSegment}`, args.data);
  }));
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "hscli", version: "0.1.0" });
  registerHubSpotTools(server);
  return server;
}

export async function runMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
