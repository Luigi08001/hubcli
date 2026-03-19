import { Command } from "commander";
import { getToken } from "../../core/auth.js";
import { loadCrmObjectSchema, validateCrmPayload } from "../../core/schema-cache.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { OBJECT_COMMAND_TYPES, parseJsonPayload, parseNumberFlag, parseSupportedObjectType } from "./shared.js";

export function registerDescribe(crm: Command, getCtx: () => CliContext): void {
  crm
    .command("describe")
    .argument("<objectType>")
    .description("Describe CRM schema (properties, enums, required, pipelines, association labels)")
    .option("--offline", "Use local schema cache only")
    .option("--refresh-cache", "Force refresh from API")
    .option("--ttl-hours <n>", "Schema cache TTL in hours", "24")
    .action(async (objectType, opts) => {
      const ctx = getCtx();
      const token = getToken(ctx.profile);
      const objectTypeValue = parseSupportedObjectType(objectType, OBJECT_COMMAND_TYPES, "objectType");
      const ttlHours = parseNumberFlag(String(opts.ttlHours), "--ttl-hours");

      const loaded = await loadCrmObjectSchema({
        profile: ctx.profile,
        token,
        objectType: objectTypeValue,
        offline: Boolean(opts.offline),
        refresh: Boolean(opts.refreshCache),
        ttlMs: ttlHours * 3_600_000,
      });

      const schema = loaded.schema;
      const requiredFields = schema.properties.filter((property) => property.required).map((property) => property.name);
      const enumValues = Object.fromEntries(
        schema.properties
          .filter((property) => property.options.length > 0)
          .map((property) => [property.name, property.options.map((option) => option.value)]),
      );

      printResult(ctx, {
        objectType: schema.objectType,
        source: loaded.source,
        stale: Boolean(loaded.stale),
        fetchedAt: schema.fetchedAt,
        propertyCount: schema.properties.length,
        requiredFields,
        completionHints: {
          propertyNames: schema.properties.map((property) => property.name),
          enumValues,
        },
        properties: schema.properties,
        pipelines: schema.pipelines,
        associationLabels: schema.associationLabels,
      });
    });

  crm
    .command("validate")
    .argument("<objectType>")
    .requiredOption("--data <payload>", "Payload JSON to validate")
    .description("Validate payload against cached/remote CRM property schema before API calls")
    .option("--offline", "Use local schema cache only")
    .option("--refresh-cache", "Force refresh from API")
    .option("--ttl-hours <n>", "Schema cache TTL in hours", "24")
    .action(async (objectType, opts) => {
      const ctx = getCtx();
      const token = getToken(ctx.profile);
      const objectTypeValue = parseSupportedObjectType(objectType, OBJECT_COMMAND_TYPES, "objectType");
      const ttlHours = parseNumberFlag(String(opts.ttlHours), "--ttl-hours");
      const payload = parseJsonPayload(opts.data);

      const loaded = await loadCrmObjectSchema({
        profile: ctx.profile,
        token,
        objectType: objectTypeValue,
        offline: Boolean(opts.offline),
        refresh: Boolean(opts.refreshCache),
        ttlMs: ttlHours * 3_600_000,
      });

      const result = validateCrmPayload(loaded.schema, payload);
      if (!result.valid) {
        throw new CliError("PAYLOAD_VALIDATION_FAILED", "Payload failed client-side schema validation", undefined, {
          objectType: objectTypeValue,
          source: loaded.source,
          stale: Boolean(loaded.stale),
          errors: result.errors,
          warnings: result.warnings,
        });
      }

      printResult(ctx, {
        objectType: objectTypeValue,
        source: loaded.source,
        stale: Boolean(loaded.stale),
        valid: true,
        errors: result.errors,
        warnings: result.warnings,
      });
    });
}
