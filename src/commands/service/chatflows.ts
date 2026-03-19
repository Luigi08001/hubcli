import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerChatflows(service: Command, getCtx: () => CliContext): void {
  const chatflows = service.command("chatflows").description("Chatflows / chat widgets");

  chatflows
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/conversations/v3/chatflows?${params.toString()}`);
      printResult(ctx, res);
    });

  chatflows
    .command("get")
    .argument("<chatflowId>")
    .action(async (chatflowId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(chatflowId, "chatflowId");
      const res = await client.request(`/conversations/v3/chatflows/${id}`);
      printResult(ctx, res);
    });
}
