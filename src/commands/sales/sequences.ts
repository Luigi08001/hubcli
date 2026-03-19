import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerSequences(sales: Command, getCtx: () => CliContext): void {
  const sequences = sales.command("sequences").description("HubSpot Sequences");

  sequences
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/automation/v4/sequences?${params.toString()}`);
      printResult(ctx, res);
    });

  sequences.command("get").argument("<sequenceId>").action(async (sequenceId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const sequenceIdSegment = encodePathSegment(sequenceId, "sequenceId");
    const res = await client.request(`/automation/v4/sequences/${sequenceIdSegment}`);
    printResult(ctx, res);
  });

  sequences
    .command("enrollments")
    .argument("<sequenceId>")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (sequenceId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const sequenceIdSegment = encodePathSegment(sequenceId, "sequenceId");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/automation/v4/sequences/${sequenceIdSegment}/enrollments?${params.toString()}`);
      printResult(ctx, res);
    });
}
