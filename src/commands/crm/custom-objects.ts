/**
 * `hscli crm custom-objects` — schemas + records for any custom object type.
 */
import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "./shared.js";

function assertSchemaUpdateDoesNotContainProperties(payload: unknown): void {
  if (
    payload
    && typeof payload === "object"
    && !Array.isArray(payload)
    && Array.isArray((payload as { properties?: unknown }).properties)
  ) {
    throw new CliError(
      "SCHEMA_UPDATE_PROPERTIES_UNSUPPORTED",
      "Schema PATCH does not create properties. Use `hscli crm properties batch-create <objectType> --data ...` instead.",
    );
  }
}

export function registerCustomObjects(crm: Command, getCtx: () => CliContext): void {
  const custom = crm.command("custom-objects").description("Custom object schemas and records");

  const schemas = custom.command("schemas").description("Schema management");

  schemas.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request("/crm/v3/schemas");
    printResult(ctx, res);
  });

  schemas.command("get").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/crm/v3/schemas/${encodePathSegment(objectType, "objectType")}`);
    printResult(ctx, res);
  });

  schemas.command("create").requiredOption("--data <payload>", "Schema payload JSON").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", "/crm/v3/schemas", payload);
    printResult(ctx, res);
  });

  schemas.command("update").argument("<objectType>").requiredOption("--data <payload>", "Schema payload JSON").action(async (objectType, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    assertSchemaUpdateDoesNotContainProperties(payload);
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/schemas/${encodePathSegment(objectType, "objectType")}`, payload);
    printResult(ctx, res);
  });

  const records = custom.command("records").description("Custom object records");

  records
    .command("list")
    .argument("<objectType>")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (objectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/crm/v3/objects/${encodePathSegment(objectType, "objectType")}?${params.toString()}`);
      printResult(ctx, res);
    });

  records.command("get").argument("<objectType>").argument("<id>").action(async (objectType, id) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/crm/v3/objects/${encodePathSegment(objectType, "objectType")}/${encodePathSegment(id, "id")}`);
    printResult(ctx, res);
  });

  records.command("search").argument("<objectType>").requiredOption("--data <payload>", "Search payload JSON").action(async (objectType, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await client.request(
      `/crm/v3/objects/${encodePathSegment(objectType, "objectType")}/search`,
      { method: "POST", body: payload, permissionMode: "read" },
    );
    printResult(ctx, res);
  });

  records.command("batch-read").argument("<objectType>").requiredOption("--data <payload>", "Batch read payload JSON").action(async (objectType, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await client.request(
      `/crm/v3/objects/${encodePathSegment(objectType, "objectType")}/batch/read`,
      { method: "POST", body: payload, permissionMode: "read" },
    );
    printResult(ctx, res);
  });

  records.command("batch-create").argument("<objectType>").requiredOption("--data <payload>", "Batch create payload JSON: { inputs: [{ properties }] }").action(async (objectType, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${encodePathSegment(objectType, "objectType")}/batch/create`, payload);
    printResult(ctx, res);
  });

  records.command("batch-update").argument("<objectType>").requiredOption("--data <payload>", "Batch update payload JSON").action(async (objectType, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${encodePathSegment(objectType, "objectType")}/batch/update`, payload);
    printResult(ctx, res);
  });

  records.command("batch-archive").argument("<objectType>").requiredOption("--data <payload>", "Batch archive payload JSON").action(async (objectType, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${encodePathSegment(objectType, "objectType")}/batch/archive`, payload);
    printResult(ctx, res);
  });

  records.command("create").argument("<objectType>").requiredOption("--data <payload>", "Record payload JSON").action(async (objectType, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/objects/${encodePathSegment(objectType, "objectType")}`, payload);
    printResult(ctx, res);
  });

  records.command("update").argument("<objectType>").argument("<id>").requiredOption("--data <payload>", "Record payload JSON").action(async (objectType, id, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/objects/${encodePathSegment(objectType, "objectType")}/${encodePathSegment(id, "id")}`, payload);
    printResult(ctx, res);
  });

  records.command("delete").argument("<objectType>").argument("<id>").action(async (objectType, id) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/objects/${encodePathSegment(objectType, "objectType")}/${encodePathSegment(id, "id")}`);
    printResult(ctx, res);
  });
}
