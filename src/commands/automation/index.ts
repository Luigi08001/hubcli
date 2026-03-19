import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerAutomation(program: Command, getCtx: () => CliContext): void {
  const automation = program.command("automation").description("HubSpot Automation APIs (v4 workflows)");

  const workflows = automation.command("workflows").description("Automation workflows (v4)");
  workflows
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/automation/v4/flows?${params.toString()}`);
      printResult(ctx, res);
    });

  workflows
    .command("get")
    .argument("<flowId>")
    .action(async (flowId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(flowId, "flowId");
      const res = await client.request(`/automation/v4/flows/${id}`);
      printResult(ctx, res);
    });
}
