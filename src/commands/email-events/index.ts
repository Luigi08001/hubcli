import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerEmailEvents(program: Command, getCtx: () => CliContext): void {
  const emailEvents = program
    .command("email-events")
    .description("HubSpot per-recipient email event stream (legacy /email/public/v1)");

  emailEvents
    .command("list")
    .description("List email events with filters (opens, clicks, bounces, unsubscribes, spam reports, etc.)")
    .option("--limit <n>", "Max records", "100")
    .option("--offset <cursor>", "Paging offset cursor")
    .option("--recipient <email>", "Filter by recipient email")
    .option("--campaign-id <id>", "Filter by marketing email campaign id")
    .option("--app-id <id>", "Filter by application id")
    .option("--event-type <type>", "Filter by event type (DELIVERED, OPEN, CLICK, BOUNCE, UNSUBSCRIBED, SPAMREPORT, SENT, DEFERRED, PROCESSED, DROPPED, STATUSCHANGE, SUPPRESSED)")
    .option("--start-timestamp <ms>", "Earliest event epoch ms")
    .option("--end-timestamp <ms>", "Latest event epoch ms")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "offset", opts.offset);
      appendOptional(params, "recipient", opts.recipient);
      appendOptional(params, "campaignId", opts.campaignId);
      appendOptional(params, "appId", opts.appId);
      appendOptional(params, "eventType", opts.eventType);
      appendOptional(params, "startTimestamp", opts.startTimestamp);
      appendOptional(params, "endTimestamp", opts.endTimestamp);
      const res = await client.request(`/email/public/v1/events?${params.toString()}`);
      printResult(ctx, res);
    });

  emailEvents
    .command("get")
    .description("Get a single email event by id + created timestamp")
    .argument("<id>")
    .argument("<created>", "Event creation timestamp (epoch ms)")
    .action(async (id, created) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const idSeg = encodePathSegment(id, "id");
      const createdSeg = encodePathSegment(created, "created");
      const res = await client.request(`/email/public/v1/events/${createdSeg}/${idSeg}`);
      printResult(ctx, res);
    });

  emailEvents
    .command("campaigns-by-id")
    .description("List email campaign IDs (for correlating events back to campaigns)")
    .option("--limit <n>", "Max records", "100")
    .option("--offset <cursor>", "Paging offset cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "offset", opts.offset);
      const res = await client.request(`/email/public/v1/campaigns/by-id?${params.toString()}`);
      printResult(ctx, res);
    });

  emailEvents
    .command("campaign")
    .description("Get aggregate stats for an email campaign")
    .argument("<campaignId>")
    .option("--app-id <id>", "Application id scope")
    .action(async (campaignId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const idSeg = encodePathSegment(campaignId, "campaignId");
      const params = new URLSearchParams();
      appendOptional(params, "appId", opts.appId);
      const qs = params.toString();
      const res = await client.request(`/email/public/v1/campaigns/${idSeg}${qs ? `?${qs}` : ""}`);
      printResult(ctx, res);
    });
}
