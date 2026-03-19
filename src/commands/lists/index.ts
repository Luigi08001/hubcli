import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerLists(program: Command, getCtx: () => CliContext): void {
  const lists = program.command("lists").description("HubSpot Lists");

  lists
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/crm/v3/lists?${params.toString()}`);
      printResult(ctx, res);
    });

  lists.command("get").argument("<listId>").action(async (listId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const listIdSegment = encodePathSegment(listId, "listId");
    const res = await client.request(`/crm/v3/lists/${listIdSegment}`);
    printResult(ctx, res);
  });

  lists
    .command("create")
    .requiredOption("--data <payload>", "List payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/crm/v3/lists", payload);
      printResult(ctx, res);
    });

  lists
    .command("update")
    .argument("<listId>")
    .requiredOption("--data <payload>", "List update payload JSON")
    .action(async (listId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const listIdSegment = encodePathSegment(listId, "listId");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/lists/${listIdSegment}`, payload);
      printResult(ctx, res);
    });

  lists.command("delete").argument("<listId>").action(async (listId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const listIdSegment = encodePathSegment(listId, "listId");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/lists/${listIdSegment}`);
    printResult(ctx, res);
  });

  lists
    .command("memberships")
    .argument("<listId>")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (listId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const listIdSegment = encodePathSegment(listId, "listId");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/crm/v3/lists/${listIdSegment}/memberships?${params.toString()}`);
      printResult(ctx, res);
    });
}
