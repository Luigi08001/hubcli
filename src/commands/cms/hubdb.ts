import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
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

  // Import rows into a HubDB table from a local CSV file. Uses the
  // real multipart endpoint (POST /cms/v3/hubdb/tables/{id}/draft/import
  // with parts: `config` JSON + `file` bytes). Earlier attempts with
  // JSON bodies returned 415; the fix was native FormData emitting
  // its own `multipart/form-data; boundary=…` Content-Type.
  hubdb
    .command("import")
    .argument("<tableId>")
    .requiredOption("--file <path>", "Local CSV file to import")
    .option(
      "--config <json>",
      "Import config JSON (e.g. {\"skipRows\":1,\"primaryKeyColumn\":\"key\"})",
      "{}",
    )
    .description("Import rows into a HubDB draft table from a local CSV (multipart upload)")
    .action(async (tableId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const tableIdSegment = encodePathSegment(tableId, "tableId");
      const filePath = resolve(String(opts.file));
      // Validate config is valid JSON before shipping it as a string part.
      try {
        JSON.parse(String(opts.config));
      } catch {
        throw new CliError("INVALID_JSON", "--config must be valid JSON");
      }
      const res = await maybeWrite(
        ctx, client, "POST",
        `/cms/v3/hubdb/tables/${tableIdSegment}/draft/import`,
        undefined,
        {
          multipart: {
            config: String(opts.config),
            file: { path: filePath, contentType: "text/csv" },
          },
        },
      );
      printResult(ctx, res);
    });

  // Export a HubDB table as CSV or XLSX. Verified 2026-04-23 —
  // response shape is `{ data: { message: "<file bytes>" } }`. With
  // `--output <path>`, writes the decoded bytes to disk; otherwise
  // prints the raw string (fine for CSV, not useful for XLSX which
  // is binary).
  hubdb
    .command("export")
    .argument("<tableId>")
    .option("--format <fmt>", "Export format: CSV | XLSX | XLS", "CSV")
    .option("--output <path>", "Write export to this local path (else print to stdout)")
    .description("Export HubDB table as CSV/XLSX (GET /cms/v3/hubdb/tables/{id}/export)")
    .action(async (tableId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const tableIdSegment = encodePathSegment(tableId, "tableId");
      const format = String(opts.format ?? "CSV").toUpperCase();
      if (!["CSV", "XLSX", "XLS"].includes(format)) {
        throw new CliError("INVALID_FORMAT", "--format must be CSV, XLSX, or XLS");
      }
      const res = (await client.request(
        `/cms/v3/hubdb/tables/${tableIdSegment}/export?format=${format}`,
      )) as { message?: string } | string;
      const payload = typeof res === "string" ? res : (res?.message ?? "");
      if (opts.output) {
        const dest = resolve(String(opts.output));
        writeFileSync(dest, payload, format === "CSV" ? "utf8" : "binary");
        printResult(ctx, { written: dest, bytes: payload.length, format });
      } else {
        printResult(ctx, { format, content: payload });
      }
    });
}
