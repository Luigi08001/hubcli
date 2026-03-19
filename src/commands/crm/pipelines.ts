import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { PIPELINE_OBJECT_TYPES, encodePathSegment, maybeWrite, parseJsonPayload, parseSupportedObjectType } from "./shared.js";

export function registerPipelines(crm: Command, getCtx: () => CliContext): void {
  const pipelines = crm.command("pipelines").description("HubSpot pipelines");

  pipelines.command("list").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const objectTypeValue = parseSupportedObjectType(objectType, PIPELINE_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const res = await client.request(`/crm/v3/pipelines/${objectTypeSegment}`);
    printResult(ctx, res);
  });

  pipelines.command("get").argument("<objectType>").argument("<pipelineId>").action(async (objectType, pipelineId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const objectTypeValue = parseSupportedObjectType(objectType, PIPELINE_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const pipelineIdSegment = encodePathSegment(pipelineId, "pipelineId");
    const res = await client.request(`/crm/v3/pipelines/${objectTypeSegment}/${pipelineIdSegment}`);
    printResult(ctx, res);
  });

  pipelines
    .command("create")
    .argument("<objectType>")
    .requiredOption("--data <payload>", "Pipeline payload JSON")
    .action(async (objectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeValue = parseSupportedObjectType(objectType, PIPELINE_OBJECT_TYPES, "objectType");
      const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", `/crm/v3/pipelines/${objectTypeSegment}`, payload);
      printResult(ctx, res);
    });

  pipelines
    .command("update")
    .argument("<objectType>")
    .argument("<pipelineId>")
    .requiredOption("--data <payload>", "Pipeline update payload JSON")
    .action(async (objectType, pipelineId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeValue = parseSupportedObjectType(objectType, PIPELINE_OBJECT_TYPES, "objectType");
      const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
      const pipelineIdSegment = encodePathSegment(pipelineId, "pipelineId");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/pipelines/${objectTypeSegment}/${pipelineIdSegment}`, payload);
      printResult(ctx, res);
    });

  pipelines.command("delete").argument("<objectType>").argument("<pipelineId>").action(async (objectType, pipelineId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const objectTypeValue = parseSupportedObjectType(objectType, PIPELINE_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const pipelineIdSegment = encodePathSegment(pipelineId, "pipelineId");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/pipelines/${objectTypeSegment}/${pipelineIdSegment}`);
    printResult(ctx, res);
  });

  pipelines.command("stages").argument("<objectType>").argument("<pipelineId>").action(async (objectType, pipelineId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const objectTypeValue = parseSupportedObjectType(objectType, PIPELINE_OBJECT_TYPES, "objectType");
    const objectTypeSegment = encodePathSegment(objectTypeValue, "objectType");
    const pipelineIdSegment = encodePathSegment(pipelineId, "pipelineId");
    const res = await client.request(`/crm/v3/pipelines/${objectTypeSegment}/${pipelineIdSegment}/stages`);
    printResult(ctx, res);
  });
}
