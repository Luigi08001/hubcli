import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { PROPERTY_OBJECT_TYPES, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag, parseSupportedObjectType } from "./shared.js";

export function registerProperties(crm: Command, getCtx: () => CliContext): void {
  const properties = crm.command("properties").description("Property schema operations");

  properties.command("list").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const objectTypeValue = parseSupportedObjectType(objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const res = await client.request(`/crm/v3/properties/${objectTypeSegment}`);
    printResult(ctx, res);
  });

  properties.command("get").argument("<objectType>").argument("<propertyName>").action(async (objectType, propertyName) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const objectTypeValue = parseSupportedObjectType(objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const propertyNameSegment = encodePathSegment(propertyName, "propertyName");
    const res = await client.request(`/crm/v3/properties/${objectTypeSegment}/${propertyNameSegment}`);
    printResult(ctx, res);
  });

  properties.command("create").argument("<objectType>").requiredOption("--data <payload>", "Property payload JSON").action(async (objectType, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const objectTypeValue = parseSupportedObjectType(objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/properties/${objectTypeSegment}`, payload);
    printResult(ctx, res);
  });

  properties
    .command("update")
    .argument("<objectType>")
    .argument("<propertyName>")
    .requiredOption("--data <payload>", "Property update payload JSON")
    .action(async (objectType, propertyName, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeValue = parseSupportedObjectType(objectType, PROPERTY_OBJECT_TYPES, "objectType");
      const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
      const propertyNameSegment = encodePathSegment(propertyName, "propertyName");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/properties/${objectTypeSegment}/${propertyNameSegment}`, payload);
      printResult(ctx, res);
    });

  properties.command("delete").argument("<objectType>").argument("<propertyName>").action(async (objectType, propertyName) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const objectTypeValue = parseSupportedObjectType(objectType, PROPERTY_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const propertyNameSegment = encodePathSegment(propertyName, "propertyName");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/properties/${objectTypeSegment}/${propertyNameSegment}`);
    printResult(ctx, res);
  });

  const groups = properties.command("groups").description("Property group operations");

  groups
    .command("list")
    .argument("<objectType>")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (objectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeValue = parseSupportedObjectType(objectType, PROPERTY_OBJECT_TYPES, "objectType");
      const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/crm/v3/properties/${objectTypeSegment}/groups?${params.toString()}`);
      printResult(ctx, res);
    });

  groups
    .command("create")
    .argument("<objectType>")
    .requiredOption("--data <payload>", "Property group payload JSON")
    .action(async (objectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeValue = parseSupportedObjectType(objectType, PROPERTY_OBJECT_TYPES, "objectType");
      const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", `/crm/v3/properties/${objectTypeSegment}/groups`, payload);
      printResult(ctx, res);
    });

  groups
    .command("update")
    .argument("<objectType>")
    .argument("<groupName>")
    .requiredOption("--data <payload>", "Property group update payload JSON")
    .action(async (objectType, groupName, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeValue = parseSupportedObjectType(objectType, PROPERTY_OBJECT_TYPES, "objectType");
      const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
      const groupNameSegment = encodePathSegment(groupName, "groupName");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/properties/${objectTypeSegment}/groups/${groupNameSegment}`, payload);
      printResult(ctx, res);
    });
}
