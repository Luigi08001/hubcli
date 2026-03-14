import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { ASSOCIATION_OBJECT_TYPES, encodePathSegment, maybeWrite, parseNumberFlag, parseSupportedObjectType } from "./shared.js";

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
      const fromObjectTypeValue = parseSupportedObjectType(fromObjectType, ASSOCIATION_OBJECT_TYPES, "fromObjectType");
      const toObjectTypeValue = parseSupportedObjectType(toObjectType, ASSOCIATION_OBJECT_TYPES, "toObjectType");
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
      const fromObjectTypeValue = parseSupportedObjectType(fromObjectType, ASSOCIATION_OBJECT_TYPES, "fromObjectType");
      const toObjectTypeValue = parseSupportedObjectType(toObjectType, ASSOCIATION_OBJECT_TYPES, "toObjectType");
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
      const fromObjectTypeValue = parseSupportedObjectType(fromObjectType, ASSOCIATION_OBJECT_TYPES, "fromObjectType");
      const toObjectTypeValue = parseSupportedObjectType(toObjectType, ASSOCIATION_OBJECT_TYPES, "toObjectType");
      const fromObjectTypeSegment = encodePathSegment(fromObjectTypeValue, "fromObjectType");
      const fromObjectIdSegment = encodePathSegment(fromObjectId, "fromObjectId");
      const toObjectTypeSegment = encodePathSegment(toObjectTypeValue, "toObjectType");
      const toObjectIdSegment = encodePathSegment(toObjectId, "toObjectId");
      const path = `/crm/v4/objects/${fromObjectTypeSegment}/${fromObjectIdSegment}/associations/default/${toObjectTypeSegment}/${toObjectIdSegment}`;
      const res = await maybeWrite(ctx, client, "DELETE", path);
      printResult(ctx, res);
    });
}
