import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "./shared.js";

/**
 * Dated API (2025-09) — HubSpot's newer schema-versioned paths alongside v3.
 * Same functional surface as /crm/v3/objects/{type} but with fixed behaviour for
 * schema changes. Exposed under `hscli crm dated ...` so v3 and the dated
 * version stay side-by-side without collision.
 */
export function registerDatedApi(crm: Command, getCtx: () => CliContext): void {
  const dated = crm.command("dated").description("CRM dated API versions (2025-09) with schema-stable semantics");

  const objects = dated.command("objects-2025-09").description("/crm/objects/2025-09/{objectType}");
  objects.command("list").argument("<objectType>").option("--limit <n>", "Max records", "10").option("--after <cursor>", "Paging cursor").option("--properties <csv>", "Comma-separated property names").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "after", o.after);
    if (o.properties) params.set("properties", o.properties);
    const res = await client.request(`/crm/objects/2025-09/${seg}?${params.toString()}`);
    printResult(ctx, res);
  });
  objects.command("get").argument("<objectType>").argument("<id>").action(async (objectType, id) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const idSeg = encodePathSegment(id, "id");
    const res = await client.request(`/crm/objects/2025-09/${typeSeg}/${idSeg}`);
    printResult(ctx, res);
  });
  objects.command("create").argument("<objectType>").requiredOption("--data <payload>", "Object payload JSON").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "POST", `/crm/objects/2025-09/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  objects.command("update").argument("<objectType>").argument("<id>").requiredOption("--data <payload>", "Object patch JSON").action(async (objectType, id, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const idSeg = encodePathSegment(id, "id");
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/objects/2025-09/${typeSeg}/${idSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  objects.command("delete").argument("<objectType>").argument("<id>").action(async (objectType, id) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const idSeg = encodePathSegment(id, "id");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/objects/2025-09/${typeSeg}/${idSeg}`);
    printResult(ctx, res);
  });
  objects.command("search").argument("<objectType>").requiredOption("--data <payload>", "Search body JSON").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await client.request(`/crm/objects/2025-09/${seg}/search`, { method: "POST", body: parseJsonPayload(o.data) });
    printResult(ctx, res);
  });
  for (const op of ["batch-read", "batch-create", "batch-update", "batch-upsert", "batch-archive"] as const) {
    objects.command(op).argument("<objectType>").requiredOption("--data <payload>", `Batch ${op} payload JSON`).action(async (objectType, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(objectType, "objectType");
      const res = op === "batch-read"
        ? await client.request(`/crm/objects/2025-09/${seg}/${op}`, { method: "POST", body: parseJsonPayload(o.data) })
        : await maybeWrite(ctx, client, "POST", `/crm/objects/2025-09/${seg}/${op}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
  }

  const props = dated.command("properties-2025-09").description("/crm/properties/2025-09/{objectType}");
  props.command("list").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await client.request(`/crm/properties/2025-09/${seg}`);
    printResult(ctx, res);
  });
  props.command("get").argument("<objectType>").argument("<propertyName>").action(async (objectType, propertyName) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(propertyName, "propertyName");
    const res = await client.request(`/crm/properties/2025-09/${typeSeg}/${nameSeg}`);
    printResult(ctx, res);
  });
  props.command("create").argument("<objectType>").requiredOption("--data <payload>", "Property definition JSON").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "POST", `/crm/properties/2025-09/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  props.command("update").argument("<objectType>").argument("<propertyName>").requiredOption("--data <payload>", "Property patch JSON").action(async (objectType, propertyName, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(propertyName, "propertyName");
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/properties/2025-09/${typeSeg}/${nameSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  props.command("delete").argument("<objectType>").argument("<propertyName>").action(async (objectType, propertyName) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(propertyName, "propertyName");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/properties/2025-09/${typeSeg}/${nameSeg}`);
    printResult(ctx, res);
  });

  const assoc = dated.command("associations-2025-09").description("/crm/associations/2025-09/*");
  for (const op of ["batch-read", "batch-create", "batch-archive"] as const) {
    assoc.command(op).argument("<fromObjectType>").argument("<toObjectType>").requiredOption("--data <payload>", `Batch ${op} payload JSON`).action(async (fromObjectType, toObjectType, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromSeg = encodePathSegment(fromObjectType, "fromObjectType");
      const toSeg = encodePathSegment(toObjectType, "toObjectType");
      const res = op === "batch-read"
        ? await client.request(`/crm/associations/2025-09/${fromSeg}/${toSeg}/${op}`, { method: "POST", body: parseJsonPayload(o.data) })
        : await maybeWrite(ctx, client, "POST", `/crm/associations/2025-09/${fromSeg}/${toSeg}/${op}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
  }
  assoc.command("batch-associate-default").argument("<fromObjectType>").argument("<toObjectType>").requiredOption("--data <payload>", "Batch associate-default payload JSON").action(async (fromObjectType, toObjectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const fromSeg = encodePathSegment(fromObjectType, "fromObjectType");
    const toSeg = encodePathSegment(toObjectType, "toObjectType");
    const res = await maybeWrite(ctx, client, "POST", `/crm/associations/2025-09/${fromSeg}/${toSeg}/batch/associate/default`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  assoc.command("batch-labels-archive").argument("<fromObjectType>").argument("<toObjectType>").requiredOption("--data <payload>", "Batch labels-archive payload JSON").action(async (fromObjectType, toObjectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const fromSeg = encodePathSegment(fromObjectType, "fromObjectType");
    const toSeg = encodePathSegment(toObjectType, "toObjectType");
    const res = await maybeWrite(ctx, client, "POST", `/crm/associations/2025-09/${fromSeg}/${toSeg}/batch/labels/archive`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  assoc.command("labels-create").argument("<fromObjectType>").argument("<toObjectType>").requiredOption("--data <payload>", "Label create payload JSON").action(async (fromObjectType, toObjectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const fromSeg = encodePathSegment(fromObjectType, "fromObjectType");
    const toSeg = encodePathSegment(toObjectType, "toObjectType");
    const res = await maybeWrite(ctx, client, "POST", `/crm/associations/2025-09/${fromSeg}/${toSeg}/labels`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  assoc.command("labels-update").argument("<fromObjectType>").argument("<toObjectType>").requiredOption("--data <payload>", "Label patch JSON").action(async (fromObjectType, toObjectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const fromSeg = encodePathSegment(fromObjectType, "fromObjectType");
    const toSeg = encodePathSegment(toObjectType, "toObjectType");
    const res = await maybeWrite(ctx, client, "PUT", `/crm/associations/2025-09/${fromSeg}/${toSeg}/labels`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  assoc.command("usage-report").description("Generate high-usage associations report").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/crm/associations/2025-09/usage/high/usage/report`);
    printResult(ctx, res);
  });

  // Associations v4 definitions / configurations
  const v4defs = dated.command("associations-v4-configs").description("/crm/associations/v4/definitions/configurations");
  v4defs.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/crm/associations/v4/definitions/configurations`);
    printResult(ctx, res);
  });
  v4defs.command("all").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/crm/associations/v4/definitions/configurations/all`);
    printResult(ctx, res);
  });
  for (const op of ["batch-create", "batch-update"] as const) {
    v4defs.command(op).argument("<fromObjectType>").argument("<toObjectType>").requiredOption("--data <payload>", `Payload JSON for ${op}`).action(async (fromObjectType, toObjectType, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const fromSeg = encodePathSegment(fromObjectType, "fromObjectType");
      const toSeg = encodePathSegment(toObjectType, "toObjectType");
      const res = await maybeWrite(ctx, client, "POST", `/crm/associations/v4/definitions/configurations/${fromSeg}/${toSeg}/${op}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
  }
  v4defs.command("batch-purge").argument("<fromObjectType>").argument("<toObjectType>").requiredOption("--data <payload>", "Purge payload JSON").action(async (fromObjectType, toObjectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const fromSeg = encodePathSegment(fromObjectType, "fromObjectType");
    const toSeg = encodePathSegment(toObjectType, "toObjectType");
    const res = await maybeWrite(ctx, client, "POST", `/crm/associations/v4/definitions/configurations/${fromSeg}/${toSeg}/batch/purge`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });

  // Object schemas alternate path
  const schemas = dated.command("object-schemas").description("/crm/object-schemas/v3/schemas (alternate path)");
  schemas.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/crm/object-schemas/v3/schemas`);
    printResult(ctx, res);
  });
  schemas.command("get").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await client.request(`/crm/object-schemas/v3/schemas/${seg}`);
    printResult(ctx, res);
  });
  schemas.command("create").requiredOption("--data <payload>", "Schema payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/crm/object-schemas/v3/schemas`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  schemas.command("update").argument("<objectType>").requiredOption("--data <payload>", "Schema patch JSON").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/object-schemas/v3/schemas/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  schemas.command("delete").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/object-schemas/v3/schemas/${seg}`);
    printResult(ctx, res);
  });
  schemas.command("associations-create").argument("<objectType>").requiredOption("--data <payload>", "Association payload JSON").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "POST", `/crm/object-schemas/v3/schemas/${seg}/associations`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  schemas.command("associations-delete").argument("<objectType>").argument("<associationId>").action(async (objectType, associationId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const idSeg = encodePathSegment(associationId, "associationId");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/object-schemas/v3/schemas/${seg}/associations/${idSeg}`);
    printResult(ctx, res);
  });
}
