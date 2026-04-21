import { Command } from "commander";
import { createClient, HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "./shared.js";

const KNOWN_OBJECT_TYPES = new Set([
  "contacts", "companies", "deals", "tickets",
  "notes", "calls", "tasks", "emails", "meetings",
]);

let customObjectCache: Map<string, string> | null = null;

async function fetchCustomObjectMap(client: HubSpotClient): Promise<Map<string, string>> {
  if (customObjectCache) return customObjectCache;
  customObjectCache = new Map();
  try {
    const res = await client.request("/crm/v3/schemas") as { results?: Array<{ name?: string; objectTypeId?: string; labels?: { singular?: string; plural?: string } }> };
    for (const schema of res.results ?? []) {
      if (schema.name && schema.objectTypeId) {
        customObjectCache.set(schema.name.toLowerCase(), schema.objectTypeId);
        if (schema.labels?.singular) customObjectCache.set(schema.labels.singular.toLowerCase(), schema.objectTypeId);
        if (schema.labels?.plural) customObjectCache.set(schema.labels.plural.toLowerCase(), schema.objectTypeId);
      }
    }
  } catch {
    // If schema fetch fails, we'll just pass through the raw value
  }
  return customObjectCache;
}

async function resolveObjectType(raw: string, client: HubSpotClient, flagName: string): Promise<string> {
  const value = raw?.trim().toLowerCase();
  if (!value) {
    throw new CliError("UNSUPPORTED_OBJECT_TYPE", `${flagName} cannot be empty`);
  }
  // Known standard/engagement types — pass through
  if (KNOWN_OBJECT_TYPES.has(value)) return value;
  // Already an objectTypeId (e.g. 2-199622513) — pass through
  if (/^\d+-\d+$/.test(value)) return value;
  // Try to resolve from custom object schemas
  const map = await fetchCustomObjectMap(client);
  const resolved = map.get(value);
  if (resolved) return resolved;
  // Pass through as-is — let HubSpot API validate
  return value;
}

export function registerAssociations(crm: Command, getCtx: () => CliContext): void {
  const associations = crm.command("associations").description("Associations between CRM objects");

  associations
    .command("list")
    .argument("<fromObjectType>")
    .argument("<fromObjectId>")
    .argument("<toObjectType>")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (fromObjectType, fromObjectId, toObjectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromObjectTypeValue = await resolveObjectType(fromObjectType, client, "fromObjectType");
      const toObjectTypeValue = await resolveObjectType(toObjectType, client, "toObjectType");
      const fromObjectTypeSegment = encodePathSegment(fromObjectTypeValue, "fromObjectType");
      const fromObjectIdSegment = encodePathSegment(fromObjectId, "fromObjectId");
      const toObjectTypeSegment = encodePathSegment(toObjectTypeValue, "toObjectType");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const path = `/crm/v4/objects/${fromObjectTypeSegment}/${fromObjectIdSegment}/associations/${toObjectTypeSegment}?${params.toString()}`;
      const res = await client.request(path);
      printResult(ctx, res);
    });

  associations
    .command("create")
    .argument("<fromObjectType>")
    .argument("<fromObjectId>")
    .argument("<toObjectType>")
    .argument("<toObjectId>")
    .action(async (fromObjectType, fromObjectId, toObjectType, toObjectId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromObjectTypeValue = await resolveObjectType(fromObjectType, client, "fromObjectType");
      const toObjectTypeValue = await resolveObjectType(toObjectType, client, "toObjectType");
      const fromObjectTypeSegment = encodePathSegment(fromObjectTypeValue, "fromObjectType");
      const fromObjectIdSegment = encodePathSegment(fromObjectId, "fromObjectId");
      const toObjectTypeSegment = encodePathSegment(toObjectTypeValue, "toObjectType");
      const toObjectIdSegment = encodePathSegment(toObjectId, "toObjectId");
      const path = `/crm/v4/objects/${fromObjectTypeSegment}/${fromObjectIdSegment}/associations/default/${toObjectTypeSegment}/${toObjectIdSegment}`;
      const res = await maybeWrite(ctx, client, "PUT", path);
      printResult(ctx, res);
    });

  associations
    .command("remove")
    .argument("<fromObjectType>")
    .argument("<fromObjectId>")
    .argument("<toObjectType>")
    .argument("<toObjectId>")
    .action(async (fromObjectType, fromObjectId, toObjectType, toObjectId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromObjectTypeValue = await resolveObjectType(fromObjectType, client, "fromObjectType");
      const toObjectTypeValue = await resolveObjectType(toObjectType, client, "toObjectType");
      const fromObjectTypeSegment = encodePathSegment(fromObjectTypeValue, "fromObjectType");
      const fromObjectIdSegment = encodePathSegment(fromObjectId, "fromObjectId");
      const toObjectTypeSegment = encodePathSegment(toObjectTypeValue, "toObjectType");
      const toObjectIdSegment = encodePathSegment(toObjectId, "toObjectId");
      const path = `/crm/v4/objects/${fromObjectTypeSegment}/${fromObjectIdSegment}/associations/default/${toObjectTypeSegment}/${toObjectIdSegment}`;
      const res = await maybeWrite(ctx, client, "DELETE", path);
      printResult(ctx, res);
    });

  const labels = associations.command("labels").description("Association label/type definitions between two object types");

  labels
    .command("list")
    .description("List all association labels/types between two object types")
    .argument("<fromObjectType>")
    .argument("<toObjectType>")
    .action(async (fromObjectType, toObjectType) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromValue = await resolveObjectType(fromObjectType, client, "fromObjectType");
      const toValue = await resolveObjectType(toObjectType, client, "toObjectType");
      const fromSeg = encodePathSegment(fromValue, "fromObjectType");
      const toSeg = encodePathSegment(toValue, "toObjectType");
      const res = await client.request(`/crm/v4/associations/${fromSeg}/${toSeg}/labels`);
      printResult(ctx, res);
    });

  labels
    .command("create")
    .description("Create a user-defined association label between two object types")
    .argument("<fromObjectType>")
    .argument("<toObjectType>")
    .requiredOption("--data <payload>", "Label payload JSON: { label, name? }")
    .action(async (fromObjectType, toObjectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromValue = await resolveObjectType(fromObjectType, client, "fromObjectType");
      const toValue = await resolveObjectType(toObjectType, client, "toObjectType");
      const fromSeg = encodePathSegment(fromValue, "fromObjectType");
      const toSeg = encodePathSegment(toValue, "toObjectType");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", `/crm/v4/associations/${fromSeg}/${toSeg}/labels`, payload);
      printResult(ctx, res);
    });

  labels
    .command("update")
    .description("Update a user-defined association label")
    .argument("<fromObjectType>")
    .argument("<toObjectType>")
    .requiredOption("--data <payload>", "Label update payload JSON: { associationTypeId, label, name? }")
    .action(async (fromObjectType, toObjectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromValue = await resolveObjectType(fromObjectType, client, "fromObjectType");
      const toValue = await resolveObjectType(toObjectType, client, "toObjectType");
      const fromSeg = encodePathSegment(fromValue, "fromObjectType");
      const toSeg = encodePathSegment(toValue, "toObjectType");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PUT", `/crm/v4/associations/${fromSeg}/${toSeg}/labels`, payload);
      printResult(ctx, res);
    });

  labels
    .command("delete")
    .description("Delete a user-defined association label by associationTypeId")
    .argument("<fromObjectType>")
    .argument("<toObjectType>")
    .argument("<associationTypeId>")
    .action(async (fromObjectType, toObjectType, associationTypeId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromValue = await resolveObjectType(fromObjectType, client, "fromObjectType");
      const toValue = await resolveObjectType(toObjectType, client, "toObjectType");
      const fromSeg = encodePathSegment(fromValue, "fromObjectType");
      const toSeg = encodePathSegment(toValue, "toObjectType");
      const idSeg = encodePathSegment(associationTypeId, "associationTypeId");
      const res = await maybeWrite(ctx, client, "DELETE", `/crm/v4/associations/${fromSeg}/${toSeg}/labels/${idSeg}`);
      printResult(ctx, res);
    });
}
