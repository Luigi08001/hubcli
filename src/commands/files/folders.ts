import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerFolders(files: Command, getCtx: () => CliContext): void {
  const folders = files.command("folders").description("HubSpot file folders (File Manager)");

  folders
    .command("list")
    .description("List folders with filters and paging")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .option("--parent-folder-id <id>", "Restrict to direct children of a parent folder")
    .option("--name <text>", "Filter by folder name")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      if (opts.parentFolderId) params.set("parentFolderId", opts.parentFolderId);
      if (opts.name) params.set("name", opts.name);
      const res = await client.request(`/files/v3/folders?${params.toString()}`);
      printResult(ctx, res);
    });

  folders
    .command("get")
    .argument("<folderId>")
    .description("Get a folder by id")
    .action(async (folderId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const folderIdSegment = encodePathSegment(folderId, "folderId");
      const res = await client.request(`/files/v3/folders/${folderIdSegment}`);
      printResult(ctx, res);
    });

  folders
    .command("create")
    .description("Create a new folder")
    .requiredOption("--data <payload>", "Folder payload JSON: { name, parentFolderId? }")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/files/v3/folders", payload);
      printResult(ctx, res);
    });

  folders
    .command("update")
    .argument("<folderId>")
    .description("Rename or move a folder")
    .requiredOption("--data <payload>", "Folder update payload JSON")
    .action(async (folderId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const folderIdSegment = encodePathSegment(folderId, "folderId");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PATCH", `/files/v3/folders/${folderIdSegment}`, payload);
      printResult(ctx, res);
    });

  folders
    .command("archive")
    .argument("<folderId>")
    .description("Archive (soft-delete) a folder")
    .action(async (folderId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const folderIdSegment = encodePathSegment(folderId, "folderId");
      const res = await maybeWrite(ctx, client, "DELETE", `/files/v3/folders/${folderIdSegment}`);
      printResult(ctx, res);
    });
}
