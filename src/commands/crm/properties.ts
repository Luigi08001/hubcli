import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { chunkInputs, loadExistingPropertyMetadata, normalizePropertyBatch, normalizePropertyLabel, propertyName, readPropertyInputs, type EmptyEnumMode } from "./property-batch.js";
import { PROPERTY_OBJECT_TYPES, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag, parseSupportedObjectType } from "./shared.js";

function parseEmptyEnumMode(raw: string | undefined): EmptyEnumMode {
  if (raw === undefined || raw === "skip") return "skip";
  if (raw === "demote") return "demote";
  throw new CliError("INVALID_FLAG", "--empty-enum must be skip or demote");
}

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
    .command("batch-create")
    .description("Create properties in batches; accepts arrays, { inputs }, or properties list dumps with { results }")
    .argument("<objectType>")
    .requiredOption("--data <payload>", "Batch payload JSON, @file, array, { inputs }, or { results } dump")
    .option("--chunk-size <n>", "Properties per batch request", "100")
    .option("--skip-existing", "Fetch existing sandbox properties and skip matching names")
    .option("--skip-label-collisions", "Fetch existing sandbox properties and skip labels already used by another property")
    .option("--include-readonly", "Do not skip hubspotDefined/readOnlyDefinition properties")
    .option("--include-reserved", "Do not skip reserved hs_* property names")
    .option("--empty-enum <mode>", "How to handle enumeration properties with no valid options: skip|demote", "skip")
    .action(async (objectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeSegment = encodePathSegment(objectType, "objectType");
      const path = `/crm/v3/properties/${objectTypeSegment}/batch/create`;
      const chunkSize = parseNumberFlag(opts.chunkSize, "--chunk-size");
      const rawInputs = readPropertyInputs(opts.data);
      const normalized = normalizePropertyBatch(rawInputs, {
        includeReadonly: Boolean(opts.includeReadonly),
        includeReserved: Boolean(opts.includeReserved),
        emptyEnumMode: parseEmptyEnumMode(opts.emptyEnum),
      });

      let inputs = normalized.inputs;
      const skippedExisting: string[] = [];
      const skippedLabelCollisions: Array<{ name: string; label: string; existingName: string }> = [];
      if ((opts.skipExisting || opts.skipLabelCollisions) && inputs.length > 0) {
        const existing = await loadExistingPropertyMetadata(client, objectTypeSegment);
        inputs = inputs.filter((input) => {
          const name = propertyName(input, "");
          if (opts.skipExisting && name !== "" && existing.names.has(name)) {
            skippedExisting.push(name);
            return false;
          }
          const label = normalizePropertyLabel(input.label);
          const existingName = label ? existing.labels.get(label) : undefined;
          if (opts.skipLabelCollisions && label && existingName && existingName !== name) {
            skippedLabelCollisions.push({ name, label: String(input.label), existingName });
            return false;
          }
          return true;
        });
      }

      const chunks = chunkInputs(inputs, chunkSize);
      const summary = {
        objectType,
        endpoint: path,
        totalInput: rawInputs.length,
        requested: inputs.length,
        skippedReadonly: normalized.skippedReadonly,
        skippedReserved: normalized.skippedReserved,
        skippedInvalid: normalized.skippedInvalid,
        skippedExisting,
        skippedLabelCollisions,
        cleanedOptions: normalized.cleanedOptions,
        demotedEnums: normalized.demotedEnums,
        chunkSize,
        chunks: chunks.map((chunk, index) => ({
          index: index + 1,
          count: chunk.length,
          names: chunk.slice(0, 10).map((input, inputIndex) => propertyName(input, `<chunk:${index + 1}:${inputIndex}>`)),
        })),
        previewInputs: inputs.slice(0, 3),
      };

      if (ctx.dryRun) {
        printResult(ctx, { dryRun: true, method: "POST", path, ...summary });
        return;
      }

      if (inputs.length === 0) {
        printResult(ctx, { ...summary, responses: [], noOp: true });
        return;
      }

      const responses = [];
      for (const [index, chunk] of chunks.entries()) {
        const res = await maybeWrite(ctx, client, "POST", path, { inputs: chunk });
        responses.push({ index: index + 1, count: chunk.length, response: res });
      }
      printResult(ctx, { ...summary, responses });
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
