import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerTransactional(marketing: Command, getCtx: () => CliContext): void {
  const tx = marketing.command("transactional").description("Transactional email APIs");

  tx.command("send")
    .requiredOption("--data <payload>", "JSON payload")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const body = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/marketing/v3/transactional/single-email/send", body);
      printResult(ctx, res);
    });

  const templates = tx.command("templates").description("Transactional SMTP tokens");
  templates
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/marketing/v3/transactional/smtp-tokens?${params.toString()}`);
      printResult(ctx, res);
    });
}
