import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

const ATTENDANCE_STATES = new Set(["register", "cancel", "attend", "no-show"]);

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

  events
    .command("participations")
    .description("List participation breakdown for a marketing event (by state)")
    .argument("<externalEventId>")
    .option("--external-account-id <id>", "External account ID (required when not using internal event id)")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (externalEventId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const eventSeg = encodePathSegment(externalEventId, "externalEventId");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      appendOptional(params, "externalAccountId", opts.externalAccountId);
      const res = await client.request(`/marketing/v3/marketing-events/${eventSeg}/participations/breakdown?${params.toString()}`);
      printResult(ctx, res);
    });

  events
    .command("attendance")
    .description("Record attendance state change (register|cancel|attend|no-show) for contacts on a marketing event")
    .argument("<externalEventId>")
    .argument("<state>", "Attendance state: register, cancel, attend, no-show")
    .requiredOption("--data <payload>", "Payload JSON: { inputs: [{ interactionDateTime, properties?, vid?|email? }, ...] }")
    .option("--external-account-id <id>", "External account ID (if event is scoped to an external app)")
    .action(async (externalEventId, state, opts) => {
      if (!ATTENDANCE_STATES.has(state)) {
        throw new Error(`state must be one of: ${Array.from(ATTENDANCE_STATES).join(", ")}`);
      }
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const eventSeg = encodePathSegment(externalEventId, "externalEventId");
      const stateSeg = encodePathSegment(state, "state");
      const payload = parseJsonPayload(opts.data);
      const qs = opts.externalAccountId ? `?externalAccountId=${encodeURIComponent(opts.externalAccountId)}` : "";
      const res = await maybeWrite(
        ctx,
        client,
        "POST",
        `/marketing/v3/marketing-events/attendance/${eventSeg}/${stateSeg}/create${qs}`,
        payload,
      );
      printResult(ctx, res);
    });
}
