import { Command } from "commander";
import { getToken } from "../../core/auth.js";
import { HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { parseNumberFlag } from "../crm/shared.js";

export function registerAccount(program: Command, getCtx: () => CliContext): void {
  const account = program.command("account").description("HubSpot account information and audit");

  account
    .command("info")
    .description("Get account details and usage")
    .action(async () => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const res = await client.request("/account-info/v3/details");
      printResult(ctx, res);
    });

  account
    .command("audit-logs")
    .description("Account activity audit log (Enterprise)")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .option("--user-id <id>", "Filter by user ID")
    .option("--event-type <type>", "Filter by event type")
    .option("--object-type <type>", "Filter by object type")
    .option("--occurred-after <iso>", "Only events after ISO datetime")
    .option("--occurred-before <iso>", "Only events before ISO datetime")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      if (opts.userId) params.set("userId", opts.userId);
      if (opts.eventType) params.set("eventType", opts.eventType);
      if (opts.objectType) params.set("objectType", opts.objectType);
      if (opts.occurredAfter) params.set("occurredAfter", opts.occurredAfter);
      if (opts.occurredBefore) params.set("occurredBefore", opts.occurredBefore);
      const res = await client.request(`/account-info/v3/activity/audit-logs/list?${params.toString()}`);
      printResult(ctx, res);
    });
}
