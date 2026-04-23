/**
 * `hscli crm imports` — create/list/get/errors for /crm/v3/imports jobs.
 */
import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "./shared.js";

export function registerImports(crm: Command, getCtx: () => CliContext): void {
  const imports = crm.command("imports").description("HubSpot CRM imports");

  imports
    .command("create")
    .requiredOption("--data <payload>", "Import payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/crm/v3/imports", payload);
      printResult(ctx, res);
    });

  imports
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/crm/v3/imports?${params.toString()}`);
      printResult(ctx, res);
    });

  imports.command("get").argument("<importId>").action(async (importId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const importIdSegment = encodePathSegment(importId, "importId");
    const res = await client.request(`/crm/v3/imports/${importIdSegment}`);
    printResult(ctx, res);
  });

  imports.command("errors").argument("<importId>").action(async (importId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const importIdSegment = encodePathSegment(importId, "importId");
    const res = await client.request(`/crm/v3/imports/${importIdSegment}/errors`);
    printResult(ctx, res);
  });
}
