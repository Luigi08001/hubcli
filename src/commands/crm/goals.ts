import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, parseNumberFlag, appendOptional } from "./shared.js";

export function registerGoals(crm: Command, getCtx: () => CliContext): void {
  const goals = crm.command("goals").description("goals commands");

  goals
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
      const res = await client.request(`/crm/v3/objects/goals?${params.toString()}`);
      printResult(ctx, res);
    });

  goals.command("get").argument("<id>").option("--properties <csv>", "Properties CSV").action(async (id, opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const idSegment = encodePathSegment(id, "id");
    const suffix = opts.properties ? `?properties=${encodeURIComponent(opts.properties)}` : "";
    const res = await client.request(`/crm/v3/objects/goals/${idSegment}${suffix}`);
    printResult(ctx, res);
  });
}
