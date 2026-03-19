import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerTimeline(program: Command, getCtx: () => CliContext): void {
  const timeline = program.command("timeline").description("HubSpot Timeline APIs");

  const eventTemplates = timeline.command("event-templates").description("Timeline event templates");
  eventTemplates
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/crm/v3/timeline/event-templates?${params.toString()}`);
      printResult(ctx, res);
    });

  const events = timeline.command("events").description("Timeline events");
  events
    .command("create")
    .requiredOption("--data <payload>", "JSON payload")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const body = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/crm/v3/timeline/events", body);
      printResult(ctx, res);
    });
}
