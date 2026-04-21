import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, parseNumberFlag } from "../crm/shared.js";
import { registerFolders } from "./folders.js";

export function registerFiles(program: Command, getCtx: () => CliContext): void {
  const files = program.command("files").description("HubSpot Files APIs");

  files
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/files/v3/files/search?${params.toString()}`);
      printResult(ctx, res);
    });

  files.command("get").argument("<fileId>").action(async (fileId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const fileIdSegment = encodePathSegment(fileId, "fileId");
    const res = await client.request(`/files/v3/files/${fileIdSegment}`);
    printResult(ctx, res);
  });

  registerFolders(files, getCtx);
}
