import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerAds(marketing: Command, getCtx: () => CliContext): void {
  const ads = marketing.command("ads").description("HubSpot Ads APIs");

  const accounts = ads.command("accounts").description("Ad accounts");
  accounts
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/marketing/v3/ads/accounts?${params.toString()}`);
      printResult(ctx, res);
    });

  const campaigns = ads.command("campaigns").description("Ad campaigns");
  campaigns
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/marketing/v3/ads/campaigns?${params.toString()}`);
      printResult(ctx, res);
    });

  campaigns
    .command("get")
    .argument("<campaignId>")
    .action(async (campaignId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(campaignId, "campaignId");
      const res = await client.request(`/marketing/v3/ads/campaigns/${id}`);
      printResult(ctx, res);
    });
}
