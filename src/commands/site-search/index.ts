import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";

export function registerSiteSearch(program: Command, getCtx: () => CliContext): void {
  const siteSearch = program.command("site-search").description("HubSpot Site Search APIs");

  siteSearch
    .command("indexed")
    .description("Get indexed pages data")
    .option("--type <type>", "Content type: LANDING_PAGE, SITE_PAGE, BLOG_POST, LISTING_PAGE, KNOWLEDGE_ARTICLE", "SITE_PAGE")
    .option("--limit <n>", "Max results", "20")
    .option("--offset <n>", "Offset for pagination", "0")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("type", opts.type);
      params.set("limit", opts.limit);
      params.set("offset", opts.offset);
      const res = await client.request(`/cms/v3/site-search/indexed-data/${encodeURIComponent(opts.type)}?${params.toString()}`);
      printResult(ctx, res);
    });

  siteSearch
    .command("search")
    .description("Search site content")
    .requiredOption("--query <text>", "Search query")
    .option("--limit <n>", "Max results", "10")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("q", opts.query);
      params.set("limit", opts.limit);
      const res = await client.request(`/cms/v3/site-search/search?${params.toString()}`);
      printResult(ctx, res);
    });
}
