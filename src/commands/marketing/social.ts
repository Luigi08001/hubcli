import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerSocial(marketing: Command, getCtx: () => CliContext): void {
  const social = marketing.command("social").description("HubSpot Social APIs");

  const accounts = social.command("accounts").description("Social accounts");
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
      const res = await client.request(`/marketing/v3/social/accounts?${params.toString()}`);
      printResult(ctx, res);
    });

  const posts = social.command("posts").description("Social posts");
  posts
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/marketing/v3/social/posts?${params.toString()}`);
      printResult(ctx, res);
    });

  posts
    .command("get")
    .argument("<postId>")
    .action(async (postId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(postId, "postId");
      const res = await client.request(`/marketing/v3/social/posts/${id}`);
      printResult(ctx, res);
    });
}
