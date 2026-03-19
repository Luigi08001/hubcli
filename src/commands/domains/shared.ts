import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

interface ResourceDefinition {
  name: string;
  description: string;
  listPath: string;
  itemPath: (id: string) => string;
  createPath?: string;
  updatePath?: (id: string) => string;
  deletePath?: (id: string) => string;
}

export function registerResource(parent: Command, getCtx: () => CliContext, def: ResourceDefinition): void {
  const cmd = parent.command(def.name).description(def.description);

  cmd
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const sep = def.listPath.includes("?") ? "&" : "?";
      const res = await client.request(`${def.listPath}${sep}${params.toString()}`);
      printResult(ctx, res);
    });

  cmd.command("get").argument("<id>").action(async (id) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(def.itemPath(encodePathSegment(id, "id")));
    printResult(ctx, res);
  });

  if (def.createPath) {
    const createPath = def.createPath;
    cmd.command("create").requiredOption("--data <payload>", "JSON payload").action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const body = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", createPath, body);
      printResult(ctx, res);
    });
  }

  if (def.updatePath) {
    const updatePath = def.updatePath;
    cmd.command("update").argument("<id>").requiredOption("--data <payload>", "JSON payload").action(async (id, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const body = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PATCH", updatePath(encodePathSegment(id, "id")), body);
      printResult(ctx, res);
    });
  }

  if (def.deletePath) {
    const deletePath = def.deletePath;
    cmd.command("delete").argument("<id>").action(async (id) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "DELETE", deletePath(encodePathSegment(id, "id")));
      printResult(ctx, res);
    });
  }
}
