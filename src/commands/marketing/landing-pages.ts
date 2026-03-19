import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerLandingPages(marketing: Command, getCtx: () => CliContext): void {
  const lp = marketing.command("landing-pages").description("HubSpot Landing Pages");

  lp.command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/cms/v3/pages/landing-pages?${params.toString()}`);
      printResult(ctx, res);
    });

  lp.command("get")
    .argument("<pageId>")
    .action(async (pageId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(pageId, "pageId");
      const res = await client.request(`/cms/v3/pages/landing-pages/${id}`);
      printResult(ctx, res);
    });

  lp.command("create")
    .requiredOption("--data <payload>", "JSON payload")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const body = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/cms/v3/pages/landing-pages", body);
      printResult(ctx, res);
    });

  lp.command("update")
    .argument("<pageId>")
    .requiredOption("--data <payload>", "JSON payload")
    .action(async (pageId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(pageId, "pageId");
      const body = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PATCH", `/cms/v3/pages/landing-pages/${id}`, body);
      printResult(ctx, res);
    });
}
