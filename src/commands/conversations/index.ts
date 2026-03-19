import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, parseNumberFlag } from "../crm/shared.js";

export function registerConversations(program: Command, getCtx: () => CliContext): void {
  const conversations = program.command("conversations").description("HubSpot Conversations APIs (threads & messages)");

  const threads = conversations.command("threads").description("Conversation threads");
  threads
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/conversations/v3/conversations/threads?${params.toString()}`);
      printResult(ctx, res);
    });

  threads
    .command("get")
    .argument("<threadId>")
    .action(async (threadId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(threadId, "threadId");
      const res = await client.request(`/conversations/v3/conversations/threads/${id}`);
      printResult(ctx, res);
    });

  const messages = conversations.command("messages").description("Thread messages");
  messages
    .command("list")
    .argument("<threadId>")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (threadId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(threadId, "threadId");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/conversations/v3/conversations/threads/${id}/messages?${params.toString()}`);
      printResult(ctx, res);
    });
}
