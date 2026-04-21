import { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";

interface TraceEvent {
  ts?: string;
  requestId?: string;
  profile?: string;
  toolName?: string;            // set when the request was emitted from an MCP tool
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  attempt?: number;
  error?: string;
  // body capture (opt-in via HUBCLI_TRACE_BODIES=1)
  requestBody?: unknown;
  responseBody?: unknown;
  requestBytes?: number;
  responseBytes?: number;
}

function readTraceFile(path: string): TraceEvent[] {
  if (!existsSync(path)) {
    throw new CliError("TRACE_FILE_NOT_FOUND", `Trace file not found: ${path}`);
  }
  const raw = readFileSync(path, "utf8");
  const events: TraceEvent[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as TraceEvent);
    } catch {
      // Skip malformed lines; trace files are append-only and may be partially
      // written if the CLI crashed mid-request.
    }
  }
  return events;
}

function matchFilter(ev: TraceEvent, filter: Record<string, string>): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    const actual = String((ev as unknown as Record<string, unknown>)[key] ?? "");
    // Support >= / <= / > / < / ! for numeric-ish keys
    if (expected.startsWith(">=")) {
      if (Number(actual) < Number(expected.slice(2))) return false;
    } else if (expected.startsWith("<=")) {
      if (Number(actual) > Number(expected.slice(2))) return false;
    } else if (expected.startsWith(">")) {
      if (Number(actual) <= Number(expected.slice(1))) return false;
    } else if (expected.startsWith("<")) {
      if (Number(actual) >= Number(expected.slice(1))) return false;
    } else if (expected.startsWith("!")) {
      if (actual === expected.slice(1)) return false;
    } else if (!actual.includes(expected)) {
      return false;
    }
  }
  return true;
}

function parseFilterArg(raw?: string): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [k, ...vParts] = pair.split("=");
    if (!k || !vParts.length) continue;
    out[k.trim()] = vParts.join("=").trim();
  }
  return out;
}

export function registerTrace(program: Command, getCtx: () => CliContext): void {
  const trace = program.command("trace").description("Session tracing + replay (observability of every hubcli request, human + MCP)");

  trace
    .command("show")
    .description("Pretty-print a trace JSONL file with optional filters")
    .argument("<file>", "Path to the .jsonl trace file")
    .option("--filter <pairs>", "Comma-separated key=value filters. Supports >=, <=, >, <, ! operators. Example: --filter status=>=400,method=POST")
    .option("--limit <n>", "Max events to show (default 50)", "50")
    .option("--tail", "Show last N events instead of first N")
    .action(async (file, opts) => {
      const ctx = getCtx();
      const events = readTraceFile(file);
      const filter = parseFilterArg(opts.filter);
      const matching = events.filter(ev => matchFilter(ev, filter));
      const limit = Number(opts.limit) || 50;
      const slice = opts.tail ? matching.slice(-limit) : matching.slice(0, limit);
      const summary = {
        file,
        totalEvents: events.length,
        matchingEvents: matching.length,
        showing: slice.length,
        filter: opts.filter || "(none)",
        statusBreakdown: countBy(matching, e => String(e.status ?? "unknown")),
        methodBreakdown: countBy(matching, e => String(e.method ?? "unknown")),
        p50LatencyMs: percentile(matching.map(e => e.durationMs ?? 0), 50),
        p95LatencyMs: percentile(matching.map(e => e.durationMs ?? 0), 95),
        errorCount: matching.filter(e => e.error || (e.status !== undefined && e.status >= 400)).length,
      };
      printResult(ctx, { summary, events: slice });
    });

  trace
    .command("stats")
    .description("Summary stats of a trace file (no per-event output)")
    .argument("<file>", "Path to the .jsonl trace file")
    .action(async (file) => {
      const ctx = getCtx();
      const events = readTraceFile(file);
      const stats = {
        totalEvents: events.length,
        byStatus: countBy(events, e => String(e.status ?? "unknown")),
        byMethod: countBy(events, e => String(e.method ?? "unknown")),
        byProfile: countBy(events, e => String(e.profile ?? "unknown")),
        byToolName: countBy(events.filter(e => e.toolName), e => String(e.toolName)),
        latency: {
          p50Ms: percentile(events.map(e => e.durationMs ?? 0), 50),
          p95Ms: percentile(events.map(e => e.durationMs ?? 0), 95),
          p99Ms: percentile(events.map(e => e.durationMs ?? 0), 99),
          maxMs: Math.max(0, ...events.map(e => e.durationMs ?? 0)),
        },
        errors: events.filter(e => e.error || (e.status !== undefined && e.status >= 400)).length,
        writeOps: events.filter(e => ["POST", "PUT", "PATCH", "DELETE"].includes(e.method ?? "")).length,
        readOps: events.filter(e => e.method === "GET").length,
        timeSpan: events.length
          ? { from: events[0].ts, to: events[events.length - 1].ts }
          : null,
      };
      printResult(ctx, stats);
    });

  trace
    .command("errors")
    .description("Show only error events (status >= 400 or explicit error field)")
    .argument("<file>", "Path to the .jsonl trace file")
    .option("--limit <n>", "Max errors to show", "50")
    .action(async (file, opts) => {
      const ctx = getCtx();
      const events = readTraceFile(file);
      const errors = events.filter(e => e.error || (e.status !== undefined && e.status >= 400));
      const limit = Number(opts.limit) || 50;
      printResult(ctx, {
        totalErrors: errors.length,
        showing: Math.min(errors.length, limit),
        errors: errors.slice(0, limit),
      });
    });
}

function countBy<T>(xs: T[], keyFn: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = keyFn(x);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function percentile(sortedOrUnsorted: number[], p: number): number {
  if (sortedOrUnsorted.length === 0) return 0;
  const sorted = [...sortedOrUnsorted].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return Math.round(sorted[idx]);
}
