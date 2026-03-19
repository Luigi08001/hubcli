import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerReporting(program: Command, getCtx: () => CliContext): void {
  const reporting = program.command("reporting").description("HubSpot Reporting & Analytics");

  // Feedback submissions (available on all tiers)
  const feedback = reporting.command("feedback").description("Feedback submissions");

  feedback
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/crm/v3/objects/feedback_submissions?${params.toString()}`);
      printResult(ctx, res);
    });

  feedback.command("get").argument("<submissionId>").action(async (submissionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const submissionIdSegment = encodePathSegment(submissionId, "submissionId");
    const res = await client.request(`/crm/v3/objects/feedback_submissions/${submissionIdSegment}`);
    printResult(ctx, res);
  });

  // Content analytics
  const content = reporting.command("content").description("Content analytics");

  content
    .command("totals")
    .description("Content performance totals")
    .requiredOption("--type <type>", "Content type: landing-pages, standard-pages, blog-posts, listing-pages, knowledge-articles")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--end <date>", "End date (YYYY-MM-DD)")
    .option("--period <period>", "Time period: total, daily, weekly, monthly", "total")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const typeSegment = encodePathSegment(opts.type, "type");
      const params = new URLSearchParams();
      if (opts.start) params.set("start", opts.start);
      if (opts.end) params.set("end", opts.end);
      if (opts.period) params.set("period", opts.period);
      const qs = params.toString();
      const res = await client.request(`/analytics/v2/reports/${typeSegment}/total${qs ? `?${qs}` : ""}`);
      printResult(ctx, res);
    });

  // Email analytics
  const email = reporting.command("email").description("Email analytics");

  email
    .command("stats")
    .description("Email performance stats")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--end <date>", "End date (YYYY-MM-DD)")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      if (opts.start) params.set("startTimestamp", opts.start);
      if (opts.end) params.set("endTimestamp", opts.end);
      const qs = params.toString();
      const res = await client.request(`/marketing/v3/emails/statistics/list${qs ? `?${qs}` : ""}`);
      printResult(ctx, res);
    });
}
