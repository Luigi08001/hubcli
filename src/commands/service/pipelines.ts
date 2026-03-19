import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment } from "../crm/shared.js";

export function registerTicketPipelines(service: Command, getCtx: () => CliContext): void {
  const pipelines = service.command("pipelines").description("Ticket pipelines and stages");

  pipelines
    .command("list")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/crm/v3/pipelines/tickets");
      printResult(ctx, res);
    });

  pipelines
    .command("get")
    .argument("<pipelineId>")
    .action(async (pipelineId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(pipelineId, "pipelineId");
      const res = await client.request(`/crm/v3/pipelines/tickets/${id}`);
      printResult(ctx, res);
    });

  pipelines
    .command("stages")
    .argument("<pipelineId>")
    .description("List stages for a ticket pipeline")
    .action(async (pipelineId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(pipelineId, "pipelineId");
      const res = await client.request(`/crm/v3/pipelines/tickets/${id}/stages`);
      printResult(ctx, res);
    });
}
