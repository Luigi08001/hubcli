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

  const inboxes = conversations.command("inboxes").description("Conversation inboxes (channel routing destinations)");
  inboxes
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/conversations/v3/conversations/inboxes?${params.toString()}`);
      printResult(ctx, res);
    });

  inboxes
    .command("get")
    .argument("<inboxId>")
    .action(async (inboxId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(inboxId, "inboxId");
      const res = await client.request(`/conversations/v3/conversations/inboxes/${id}`);
      printResult(ctx, res);
    });

  const channels = conversations.command("channels").description("Conversation channels (email, chat, FB, forms, etc.)");
  channels
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/conversations/v3/conversations/channels?${params.toString()}`);
      printResult(ctx, res);
    });

  channels
    .command("get")
    .argument("<channelId>")
    .action(async (channelId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(channelId, "channelId");
      const res = await client.request(`/conversations/v3/conversations/channels/${id}`);
      printResult(ctx, res);
    });

  const channelAccounts = conversations.command("channel-accounts").description("Conversation channel accounts (specific connected mailboxes/inboxes on a channel)");
  channelAccounts
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .option("--channel-id <id>", "Filter by channel id")
    .option("--inbox-id <id>", "Filter by inbox id")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      appendOptional(params, "channelId", opts.channelId);
      appendOptional(params, "inboxId", opts.inboxId);
      const res = await client.request(`/conversations/v3/conversations/channel-accounts?${params.toString()}`);
      printResult(ctx, res);
    });

  channelAccounts
    .command("get")
    .argument("<channelAccountId>")
    .action(async (channelAccountId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(channelAccountId, "channelAccountId");
      const res = await client.request(`/conversations/v3/conversations/channel-accounts/${id}`);
      printResult(ctx, res);
    });

  const actors = conversations.command("actors").description("Conversation actors (agents, bots, visitors) for hydrating threads");
  actors
    .command("get")
    .argument("<actorId>")
    .description("Get actor details by actor id (e.g. A-12345, V-abcdef)")
    .action(async (actorId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(actorId, "actorId");
      const res = await client.request(`/conversations/v3/conversations/actors/${id}`);
      printResult(ctx, res);
    });

  actors
    .command("batch-read")
    .description("Batch-read actor details for up to 100 actor ids in one call")
    .requiredOption("--ids <csv>", "Comma-separated list of actor ids")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const ids = String(opts.ids).split(",").map((s) => s.trim()).filter(Boolean);
      const res = await client.request(`/conversations/v3/conversations/actors/batch/read`, {
        method: "POST",
        body: { inputs: ids.map((id) => ({ id })) },
      });
      printResult(ctx, res);
    });
}
