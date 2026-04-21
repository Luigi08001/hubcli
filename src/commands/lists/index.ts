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
    .option("--query <text>", "Search query")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const body: Record<string, unknown> = {
        count: parseNumberFlag(opts.limit, "--limit"),
      };
      if (opts.after) body.offset = Number(opts.after);
      if (opts.query) body.query = opts.query;
      const res = await client.request("/crm/v3/lists/search", { method: "POST", body });
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
    .command("add-members")
    .argument("<listId>")
    .requiredOption("--ids <recordIds>", "Comma-separated record IDs to add")
    .action(async (listId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const listIdSegment = encodePathSegment(listId, "listId");
      const recordIds = opts.ids.split(",").map((id: string) => id.trim());
      const res = await maybeWrite(ctx, client, "PUT", `/crm/v3/lists/${listIdSegment}/memberships/add`, recordIds);
      printResult(ctx, res);
    });

  lists
    .command("remove-members")
    .argument("<listId>")
    .requiredOption("--ids <recordIds>", "Comma-separated record IDs to remove")
    .action(async (listId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const listIdSegment = encodePathSegment(listId, "listId");
      const recordIds = opts.ids.split(",").map((id: string) => id.trim());
      const res = await maybeWrite(ctx, client, "PUT", `/crm/v3/lists/${listIdSegment}/memberships/remove`, recordIds);
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

  // Folders — organizational containers for lists
  const folders = lists.command("folders").description("Lists folders (organizational tree)");
  folders.command("list").option("--limit <n>", "Max records", "50").option("--after <cursor>", "Paging cursor").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    if (o.after) params.set("after", o.after);
    const res = await client.request(`/crm/v3/lists/folders?${params.toString()}`);
    printResult(ctx, res);
  });
  folders.command("get").argument("<folderId>").action(async (folderId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(folderId, "folderId");
    const res = await client.request(`/crm/v3/lists/folders/${seg}`);
    printResult(ctx, res);
  });
  folders.command("create").requiredOption("--data <payload>", "Folder payload JSON: { name, parentFolderId? }").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/lists/folders`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  folders.command("update").argument("<folderId>").requiredOption("--data <payload>", "Folder patch JSON").action(async (folderId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(folderId, "folderId");
    const res = await maybeWrite(ctx, client, "PUT", `/crm/v3/lists/folders/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  folders.command("delete").argument("<folderId>").action(async (folderId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(folderId, "folderId");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/lists/folders/${seg}`);
    printResult(ctx, res);
  });
  folders.command("move").argument("<listId>").requiredOption("--folder-id <id>", "Target folder id").action(async (listId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(listId, "listId");
    const folderSeg = encodePathSegment(o.folderId, "folderId");
    const res = await maybeWrite(ctx, client, "PUT", `/crm/v3/lists/folders/move/${seg}/to/${folderSeg}`);
    printResult(ctx, res);
  });
}
