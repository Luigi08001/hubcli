import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { encodePathSegment, parseNumberFlag } from "./shared.js";

interface SyncState {
  after?: string;
  lastRunAt?: string;
  lastSince?: string;
}

function readState(filePath: string): SyncState {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as SyncState;
  } catch {
    throw new CliError("SYNC_STATE_INVALID", `Invalid sync state file: ${filePath}`);
  }
}

function writeState(filePath: string, state: SyncState): void {
  writeFileSync(filePath, JSON.stringify(state, null, 2) + "\n", "utf8");
}

export function registerSync(crm: Command, getCtx: () => CliContext): void {
  const sync = crm.command("sync").description("Incremental sync utilities");

  sync
    .command("pull")
    .argument("<objectType>")
    .option("--since <iso>", "Only pull records modified since ISO datetime")
    .option("--state-file <path>", "State file path")
    .option("--out-file <path>", "Output JSON file path")
    .option("--limit <n>", "Page size", "100")
    .option("--max-pages <n>", "Maximum pages per run", "5")
    .action(async (objectType, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeSegment = encodePathSegment(objectType, "objectType");
      const limit = parseNumberFlag(opts.limit, "--limit");
      const maxPages = parseNumberFlag(opts.maxPages, "--max-pages");
      const stateFile = opts.stateFile ? String(opts.stateFile) : `.hubcli-sync-${objectTypeSegment}.json`;
      const state = readState(stateFile);

      const results: unknown[] = [];
      let pages = 0;
      let after: string | undefined = opts.since ? undefined : state.after;

      while (pages < maxPages) {
        let response: any;
        if (opts.since) {
          const sinceDate = new Date(String(opts.since));
          if (Number.isNaN(sinceDate.getTime())) {
            throw new CliError("SYNC_INVALID_SINCE", "--since must be a valid ISO date");
          }
          const body: Record<string, unknown> = {
            limit,
            filterGroups: [{
              filters: [{
                propertyName: "hs_lastmodifieddate",
                operator: "GTE",
                value: String(sinceDate.getTime()),
              }],
            }],
            sorts: [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }],
          };
          if (after) body.after = Number(after);
          response = await client.request(`/crm/v3/objects/${objectTypeSegment}/search`, { method: "POST", body });
        } else {
          const params = new URLSearchParams();
          params.set("limit", String(limit));
          if (after) params.set("after", after);
          response = await client.request(`/crm/v3/objects/${objectTypeSegment}?${params.toString()}`);
        }

        const pageResults = Array.isArray(response?.results) ? response.results : [];
        results.push(...pageResults);
        pages += 1;
        after = response?.paging?.next?.after ? String(response.paging.next.after) : undefined;
        if (!after) break;
      }

      const output = {
        objectType,
        pagesFetched: pages,
        count: results.length,
        nextAfter: after ?? null,
        results,
      };

      if (opts.outFile) {
        writeFileSync(String(opts.outFile), JSON.stringify(output, null, 2) + "\n", "utf8");
      }

      writeState(stateFile, {
        after,
        lastRunAt: new Date().toISOString(),
        lastSince: opts.since ? String(opts.since) : state.lastSince,
      });

      printResult(ctx, output);
    });
}
