import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerMarketingEvents(marketing: Command, getCtx: () => CliContext): void {
  const events = marketing.command("events").description("Marketing events");

  events
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/marketing/v3/marketing-events?${params.toString()}`);
      printResult(ctx, res);
    });

  events
    .command("get")
    .argument("<eventId>")
    .action(async (eventId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(eventId, "eventId");
      const res = await client.request(`/marketing/v3/marketing-events/${id}`);
      printResult(ctx, res);
    });
}
