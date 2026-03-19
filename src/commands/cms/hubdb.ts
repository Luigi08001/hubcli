import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag, appendOptional } from "../crm/shared.js";

export function registerHubdb(cms: Command, getCtx: () => CliContext): void {
  const hubdb = cms.command("hubdb").description("HubDB tables");

  hubdb
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/cms/v3/hubdb/tables?${params.toString()}`);
      printResult(ctx, res);
    });

  hubdb.command("get").argument("<tableId>").action(async (tableId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/cms/v3/hubdb/tables/${encodePathSegment(tableId, "tableId")}`);
    printResult(ctx, res);
  });

  hubdb
    .command("rows")
    .argument("<tableId>")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (tableId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const tableIdSegment = encodePathSegment(tableId, "tableId");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/cms/v3/hubdb/tables/${tableIdSegment}/rows?${params.toString()}`);
      printResult(ctx, res);
    });

  hubdb.command("create").requiredOption("--data <payload>", "Table definition JSON").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWrite(ctx, client, "POST", "/cms/v3/hubdb/tables", payload);
    printResult(ctx, res);
  });

  hubdb.command("delete").argument("<tableId>").action(async (tableId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const tableIdSegment = encodePathSegment(tableId, "tableId");
    const res = await maybeWrite(ctx, client, "DELETE", `/cms/v3/hubdb/tables/draft/${tableIdSegment}`);
    printResult(ctx, res);
  });
}
