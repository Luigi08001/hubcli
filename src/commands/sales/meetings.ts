import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag, appendOptional } from "../crm/shared.js";

export function registerMeetings(sales: Command, getCtx: () => CliContext): void {
  const meetings = sales.command("meetings").description("HubSpot Meetings");

  meetings
    .command("list")
    .option("--limit <n>", "Max records", "10")
    .option("--after <cursor>", "Paging cursor")
    .option("--properties <csv>", "Properties CSV")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      appendOptional(params, "properties", opts.properties);
      const res = await client.request(`/crm/v3/objects/meetings?${params.toString()}`);
      printResult(ctx, res);
    });

  meetings.command("get").argument("<meetingId>").option("--properties <csv>", "Properties CSV").action(async (meetingId, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const idSegment = encodePathSegment(meetingId, "meetingId");
    const suffix = opts.properties ? `?properties=${encodeURIComponent(opts.properties)}` : "";
    const res = await client.request(`/crm/v3/objects/meetings/${idSegment}${suffix}`);
    printResult(ctx, res);
  });

  meetings.command("create").requiredOption("--data <payload>", "Meeting payload JSON").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", "/crm/v3/objects/meetings", payload);
    printResult(ctx, res);
  });
}
