import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { parseNumberFlag, appendOptional } from "../crm/shared.js";

export function registerCalling(sales: Command, getCtx: () => CliContext): void {
  const calling = sales.command("calling").description("HubSpot Calling");

  calling
    .command("settings")
    .description("Get calling extension settings")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/crm/v3/extensions/calling/settings");
      printResult(ctx, res);
    });

  const recordings = calling.command("recordings").description("Call recordings");

  recordings
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
      const res = await client.request(`/crm/v3/objects/calls?${params.toString()}`);
      printResult(ctx, res);
    });
}
