import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";

export function registerSiteSearch(program: Command, getCtx: () => CliContext): void {
  const siteSearch = program.command("site-search").description("HubSpot Site Search APIs");

  siteSearch
    .command("indexed")
    .description("Get indexed pages data")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/cms/v3/site-search/indexed-data/pages");
      printResult(ctx, res);
    });
}
