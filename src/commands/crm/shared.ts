import { Command } from "commander";
import { createClient, HubSpotClient } from "../../core/http.js";
import { enforceWritePolicy } from "../../core/policy.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { resolvePortalContext, enrichListResponse, enrichRecordUrl } from "../../core/urls.js";
import { parseResponse, HubSpotListResponse, HubSpotSearchResponse, HubSpotRecord } from "../../core/schemas.js";

const OBJECT_COMMAND_TYPES = ["contacts", "companies", "deals", "tickets"] as const;
const PROPERTY_OBJECT_TYPES = ["contacts", "companies", "deals", "tickets"] as const;
const ASSOCIATION_OBJECT_TYPES = ["contacts", "companies", "deals", "tickets", "notes", "calls", "tasks", "emails", "meetings"] as const;
const PIPELINE_OBJECT_TYPES = ["deals", "tickets"] as const;
const ENGAGEMENT_OBJECT_TYPES = ["notes", "calls", "tasks", "emails", "meetings"] as const;

function parseJsonPayload(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new CliError("INVALID_JSON", "Invalid JSON payload");
  }
}

function parseNumberFlag(raw: string, flagName: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new CliError("INVALID_FLAG", `${flagName} must be a positive number`);
  }
  return parsed;
}

function parseBooleanFlag(raw: string, flagName: string): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new CliError("INVALID_FLAG", `${flagName} must be true or false`);
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/;

function encodePathSegment(raw: string, segmentName: string): string {
  const value = raw?.trim();
  if (!value) {
    throw new CliError("INVALID_PATH_SEGMENT", `${segmentName} cannot be empty`);
  }
  if (CONTROL_CHAR_PATTERN.test(value)) {
    throw new CliError("INVALID_PATH_SEGMENT", `${segmentName} must not contain control characters`);
  }
  if (value.includes("/") || value.includes("\\")) {
    throw new CliError("INVALID_PATH_SEGMENT", `${segmentName} must not contain path separators`);
  }
  if (value === "." || value === "..") {
    throw new CliError("INVALID_PATH_SEGMENT", `${segmentName} cannot be '.' or '..'`);
  }
  return encodeURIComponent(value);
}

function parseSupportedObjectType<T extends readonly string[]>(
  raw: string,
  allowed: T,
  flagName = "objectType",
): T[number] {
  const value = raw?.trim().toLowerCase();
  const allowedList = allowed.join(", ");
  if (!value) {
    throw new CliError("UNSUPPORTED_OBJECT_TYPE", `${flagName} must be one of: ${allowedList}`);
  }
  if (!allowed.includes(value)) {
    throw new CliError("UNSUPPORTED_OBJECT_TYPE", `${flagName} must be one of: ${allowedList}`);
  }
  return value as T[number];
}

function appendOptional(params: URLSearchParams, key: string, value?: string): void {
  if (value !== undefined && value !== "") params.set(key, value);
}

export async function maybeWrite(
  ctx: CliContext,
  client: HubSpotClient,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<unknown> {
  if (ctx.dryRun) return { dryRun: true, method, path, body };
  if (!ctx.force) {
    throw new CliError(
      "WRITE_CONFIRMATION_REQUIRED",
      "Write blocked. Re-run with --dry-run to preview, then add --force to execute.",
    );
  }
  enforceWritePolicy(ctx, method, path);
  return client.request(path, { method, body });
}

export function registerObjectCommands(parent: Command, objectType: string, getCtx: () => CliContext): void {
  const cmd = parent.command(objectType).description(`${objectType} commands`);

  cmd
    .command("list")
    .option("--limit <n>", "Max records", "10")
    .option("--after <cursor>", "Paging cursor")
    .option("--archived <bool>", "Include archived records (true/false)")
    .option("--properties <csv>", "Properties CSV")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const portal = resolvePortalContext(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      if (opts.archived !== undefined) {
        params.set("archived", String(parseBooleanFlag(opts.archived, "--archived")));
      }
      appendOptional(params, "properties", opts.properties);
      const res = await client.request(`/crm/v3/objects/${objectType}?${params.toString()}`);
      parseResponse(HubSpotListResponse, res, `${objectType} list`);
      enrichListResponse(res, portal, objectType);
      printResult(ctx, res);
    });

  cmd.command("get").argument("<id>").option("--properties <csv>", "Properties CSV").action(async (id, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const portal = resolvePortalContext(ctx.profile);
    const idSegment = encodePathSegment(id, "id");
    const suffix = opts.properties ? `?properties=${encodeURIComponent(opts.properties)}` : "";
    const res = await client.request(`/crm/v3/objects/${objectType}/${idSegment}${suffix}`);
    parseResponse(HubSpotRecord, res, `${objectType} get`);
    if (res && typeof res === "object") enrichRecordUrl(res as Record<string, unknown>, portal, objectType);
    printResult(ctx, res);
  });

  cmd.command("search").requiredOption("--query <text>", "Free text query").option("--limit <n>", "Max records", "10").option("--after <n>", "Paging offset").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const portal = resolvePortalContext(ctx.profile);
    const body: Record<string, unknown> = { query: opts.query, limit: parseNumberFlag(opts.limit, "--limit") };
    if (opts.after !== undefined) {
      body.after = parseNumberFlag(opts.after, "--after");
    }
    const res = await client.request(`/crm/v3/objects/${objectType}/search`, {
      method: "POST",
      body,
    });
    parseResponse(HubSpotSearchResponse, res, `${objectType} search`);
    enrichListResponse(res, portal, objectType);
    printResult(ctx, res);
  });

  cmd.command("create").requiredOption("--data <payload>", "HubSpot object payload JSON").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const portal = resolvePortalContext(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectType}`, payload);
    if (res && typeof res === "object") enrichRecordUrl(res as Record<string, unknown>, portal, objectType);
    printResult(ctx, res);
  });

  cmd.command("update").argument("<id>").requiredOption("--data <payload>", "HubSpot update payload JSON").action(async (id, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const portal = resolvePortalContext(ctx.profile);
    const idSegment = encodePathSegment(id, "id");
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/objects/${objectType}/${idSegment}`, payload);
    if (res && typeof res === "object") enrichRecordUrl(res as Record<string, unknown>, portal, objectType);
    printResult(ctx, res);
  });

  cmd.command("delete").argument("<id>").description("Archive/delete one record").action(async (id) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const idSegment = encodePathSegment(id, "id");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/objects/${objectType}/${idSegment}`);
    printResult(ctx, res);
  });

  cmd.command("merge").requiredOption("--data <payload>", "Merge payload JSON").description("Merge records (endpoint support varies by object)").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectType}/merge`, payload);
    printResult(ctx, res);
  });

  cmd.command("batch-read").requiredOption("--data <payload>", "Batch read payload JSON").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await client.request(`/crm/v3/objects/${objectType}/batch/read`, { method: "POST", body: payload });
    printResult(ctx, res);
  });

  cmd.command("batch-upsert").requiredOption("--data <payload>", "Batch upsert payload JSON").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectType}/batch/upsert`, payload);
    printResult(ctx, res);
  });

  cmd.command("batch-archive").requiredOption("--data <payload>", "Batch archive payload JSON").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${objectType}/batch/archive`, payload);
    printResult(ctx, res);
  });
}

export {
  parseJsonPayload,
  parseNumberFlag,
  parseBooleanFlag,
  parseSupportedObjectType,
  encodePathSegment,
  appendOptional,
  OBJECT_COMMAND_TYPES,
  PROPERTY_OBJECT_TYPES,
  ASSOCIATION_OBJECT_TYPES,
  PIPELINE_OBJECT_TYPES,
  ENGAGEMENT_OBJECT_TYPES,
};
