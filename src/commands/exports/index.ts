import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerExports(program: Command, getCtx: () => CliContext): void {
  const exports_ = program.command("exports").description("HubSpot CRM Exports");

  exports_
    .command("create")
    .requiredOption("--data <payload>", "Export payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/crm/v3/exports", payload);
      printResult(ctx, res);
    });

  exports_
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/crm/v3/exports?${params.toString()}`);
      printResult(ctx, res);
    });

  exports_.command("get").argument("<exportId>").action(async (exportId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const exportIdSegment = encodePathSegment(exportId, "exportId");
    const res = await client.request(`/crm/v3/exports/${exportIdSegment}`);
    printResult(ctx, res);
  });

  exports_.command("status").argument("<exportId>").action(async (exportId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const exportIdSegment = encodePathSegment(exportId, "exportId");
    const res = await client.request(`/crm/v3/exports/${exportIdSegment}/status`);
    printResult(ctx, res);
  });
}
