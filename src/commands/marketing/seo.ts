import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, parseNumberFlag } from "../crm/shared.js";

export function registerSeo(marketing: Command, getCtx: () => CliContext): void {
  const seo = marketing.command("seo").description("HubSpot SEO APIs");

  const recommendations = seo.command("recommendations").description("SEO recommendations");
  recommendations
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/cms/v3/seo/audit?${params.toString()}`);
      printResult(ctx, res);
    });

  const topics = seo.command("topics").description("SEO topics");
  topics
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/cms/v3/topics?${params.toString()}`);
      printResult(ctx, res);
    });
}
