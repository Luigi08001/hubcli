import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerReporting(program: Command, getCtx: () => CliContext): void {
  const reporting = program.command("reporting").description("HubSpot Reporting & Analytics");
  const dashboards = reporting.command("dashboards").description("Analytics dashboards");

  dashboards
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/analytics/v2/reports?${params.toString()}`);
      printResult(ctx, res);
    });

  dashboards.command("get").argument("<dashboardId>").action(async (dashboardId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const dashboardIdSegment = encodePathSegment(dashboardId, "dashboardId");
    const res = await client.request(`/analytics/v2/reports/${dashboardIdSegment}`);
    printResult(ctx, res);
  });
}
