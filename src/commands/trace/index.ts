import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import { watch, open } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";

function getHscliHome(): string {
  return process.env.HSCLI_HOME?.trim() || join(homedir(), ".revfleet");
}

function getSessionFile(): string {
  return join(getHscliHome(), "trace-session.json");
}

interface TraceSession {
  file: string;
  startedAt: string;
  includeBodies: boolean;
  scope?: "read" | "write" | "all";
}

function readSession(): TraceSession | null {
  const path = getSessionFile();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as TraceSession;
  } catch {
    return null;
  }
}

function writeSession(session: TraceSession): void {
  const path = getSessionFile();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(session, null, 2), { encoding: "utf8", mode: 0o600 });
}

function deleteSession(): void {
  const path = getSessionFile();
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      // If unlink fails (permission, race), fall back to emptying the file —
      // readSession() will return null on empty/malformed JSON.
      writeFileSync(path, "", { encoding: "utf8" });
    }
  }
}

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
  // body capture (opt-in via HSCLI_TRACE_BODIES=1)
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
  const trace = program.command("trace").description("Session tracing + replay (observability of every hscli request, human + MCP)");

  trace
    .command("start")
    .description("Start a trace session. Writes a state file at ~/.revfleet/trace-session.json that the http client reads on each request. Every subsequent hscli command (and MCP tool call) appends to the trace file until `hscli trace stop`.")
    .option("--out <file>", "Path to the .jsonl trace file (default: ~/.revfleet/trace-<timestamp>.jsonl)")
    .option("--include-bodies", "Capture request + response bodies (bigger files, redacted for secrets)")
    .option("--scope <mode>", "Filter: read|write|all (default: all)", "all")
    .action(async (opts) => {
      const ctx = getCtx();
      const existing = readSession();
      if (existing) {
        throw new CliError(
          "TRACE_ALREADY_ACTIVE",
          `A trace session is already active (file: ${existing.file}, started: ${existing.startedAt}). Run \`hscli trace stop\` before starting a new one.`,
        );
      }
      const file = opts.out
        ? String(opts.out)
        : join(getHscliHome(), `trace-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
      const session: TraceSession = {
        file,
        startedAt: new Date().toISOString(),
        includeBodies: Boolean(opts.includeBodies),
        scope: opts.scope === "read" || opts.scope === "write" ? opts.scope : "all",
      };
      writeSession(session);
      printResult(ctx, {
        started: true,
        file,
        session,
        note: "The trace file will grow with every hscli / MCP request until `hscli trace stop`.",
      });
    });

  trace
    .command("stop")
    .description("Stop the active trace session. Removes the state file; the trace .jsonl is preserved.")
    .action(async () => {
      const ctx = getCtx();
      const existing = readSession();
      if (!existing) {
        throw new CliError("TRACE_NOT_ACTIVE", "No active trace session. Use `hscli trace start` to begin one.");
      }
      deleteSession();
      let fileSize = 0;
      let eventCount = 0;
      try {
        if (existsSync(existing.file)) {
          fileSize = statSync(existing.file).size;
          eventCount = readTraceFile(existing.file).length;
        }
      } catch { /* stats best-effort */ }
      printResult(ctx, {
        stopped: true,
        file: existing.file,
        durationMs: Date.now() - new Date(existing.startedAt).getTime(),
        fileSizeBytes: fileSize,
        eventCount,
        nextSteps: [
          `hscli trace show ${existing.file}`,
          `hscli trace stats ${existing.file}`,
          `hscli trace errors ${existing.file}`,
        ],
      });
    });

  trace
    .command("status")
    .description("Show active trace session state (if any)")
    .action(async () => {
      const ctx = getCtx();
      const session = readSession();
      if (!session) {
        printResult(ctx, { active: false });
        return;
      }
      let fileSize = 0;
      let eventCount = 0;
      try {
        if (existsSync(session.file)) {
          fileSize = statSync(session.file).size;
          eventCount = readTraceFile(session.file).length;
        }
      } catch { /* best-effort */ }
      printResult(ctx, {
        active: true,
        session,
        fileSizeBytes: fileSize,
        eventCount,
        durationMs: Date.now() - new Date(session.startedAt).getTime(),
      });
    });

  trace
    .command("tail")
    .description("Live-stream a trace file as new events are appended (like tail -f)")
    .argument("<file>", "Path to the .jsonl trace file (or leave blank to tail the active session)")
    .option("--format <mode>", "Output format: compact|json|pretty", "compact")
    .action(async (fileArg, opts) => {
      const session = readSession();
      const file = fileArg || session?.file;
      if (!file) {
        throw new CliError(
          "TRACE_TAIL_NO_FILE",
          "No active session and no file argument. Either `hscli trace start` or pass a file path.",
        );
      }
      if (!existsSync(file)) {
        throw new CliError("TRACE_FILE_NOT_FOUND", `Trace file not found: ${file}`);
      }
      const formatLine = (ev: TraceEvent): string => {
        if (opts.format === "json") return JSON.stringify(ev);
        if (opts.format === "pretty") return JSON.stringify(ev, null, 2);
        // compact: status ts method path latency
        const status = ev.status ? String(ev.status) : (ev.error ? "ERR" : "---");
        const ts = ev.ts ? ev.ts.slice(11, 19) : "--:--:--";
        const latency = ev.durationMs !== undefined ? ` ${ev.durationMs}ms` : "";
        const tool = ev.toolName ? ` [${ev.toolName}]` : "";
        return `${status.padStart(3)} ${ts} ${(ev.method || "???").padEnd(6)} ${ev.path || ""}${latency}${tool}`;
      };
      // Print existing content first
      const initial = readTraceFile(file);
      for (const ev of initial) process.stdout.write(formatLine(ev) + "\n");
      process.stderr.write(`--- tailing ${file} (Ctrl-C to stop) ---\n`);
      // Watch file for growth
      let lastSize = statSync(file).size;
      const fd = await open(file, "r");
      try {
        const watcher = watch(file);
        for await (const event of watcher) {
          if (event.eventType !== "change") continue;
          const newSize = statSync(file).size;
          if (newSize <= lastSize) continue;
          const buf = Buffer.alloc(newSize - lastSize);
          await fd.read(buf, 0, buf.length, lastSize);
          lastSize = newSize;
          const chunk = buf.toString("utf8");
          for (const line of chunk.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const ev = JSON.parse(trimmed) as TraceEvent;
              process.stdout.write(formatLine(ev) + "\n");
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        await fd.close();
      }
    });

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

  trace
    .command("diff")
    .description("Diff two trace JSONL sessions by method+path key. Helps verify that a script/agent made the same HubSpot calls across two runs (reproducibility, migration from stage→prod, regression detection).")
    .argument("<file-a>", "First trace file")
    .argument("<file-b>", "Second trace file")
    .action(async (fileA, fileB) => {
      const ctx = getCtx();
      const a = readTraceFile(fileA);
      const b = readTraceFile(fileB);

      // Key by method + path (ignore query params + ids) so diffs show
      // structural divergence, not trivial id differences.
      const keyOf = (ev: TraceEvent): string =>
        `${ev.method || "?"} ${(ev.path || "").split("?")[0].replace(/\/\d+/g, "/{id}")}`;
      const bucketize = (events: TraceEvent[]): Map<string, TraceEvent[]> => {
        const buckets = new Map<string, TraceEvent[]>();
        for (const ev of events) {
          const k = keyOf(ev);
          if (!buckets.has(k)) buckets.set(k, []);
          buckets.get(k)!.push(ev);
        }
        return buckets;
      };
      const aBuckets = bucketize(a);
      const bBuckets = bucketize(b);

      const allKeys = new Set([...aBuckets.keys(), ...bBuckets.keys()]);
      const onlyInA: string[] = [];
      const onlyInB: string[] = [];
      const countChanges: Array<{ key: string; countA: number; countB: number; delta: number }> = [];
      const statusChanges: Array<{ key: string; statusesA: string[]; statusesB: string[] }> = [];

      for (const k of allKeys) {
        const aRecs = aBuckets.get(k) ?? [];
        const bRecs = bBuckets.get(k) ?? [];
        if (aRecs.length === 0) { onlyInB.push(k); continue; }
        if (bRecs.length === 0) { onlyInA.push(k); continue; }
        if (aRecs.length !== bRecs.length) {
          countChanges.push({ key: k, countA: aRecs.length, countB: bRecs.length, delta: bRecs.length - aRecs.length });
        }
        const sa = [...new Set(aRecs.map(r => String(r.status ?? "err")))].sort();
        const sb = [...new Set(bRecs.map(r => String(r.status ?? "err")))].sort();
        if (sa.join(",") !== sb.join(",")) {
          statusChanges.push({ key: k, statusesA: sa, statusesB: sb });
        }
      }

      const summary = {
        fileA,
        fileB,
        totalEventsA: a.length,
        totalEventsB: b.length,
        uniqueKeysA: aBuckets.size,
        uniqueKeysB: bBuckets.size,
        onlyInA: onlyInA.sort(),
        onlyInB: onlyInB.sort(),
        countChanges: countChanges.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)),
        statusChanges,
        divergent: onlyInA.length > 0 || onlyInB.length > 0 || statusChanges.length > 0,
      };
      printResult(ctx, summary);
    });

  trace
    .command("replay")
    .description("Re-run the GET requests from a trace session against the current profile. Useful for: reproducing a bug, verifying a portal migration, warming caches. Write operations are NEVER replayed (too risky).")
    .argument("<file>", "Path to the .jsonl trace file")
    .option("--profile <name>", "Override the profile (default: inherit from CLI)")
    .option("--limit <n>", "Max requests to replay", "100")
    .action(async (file, opts) => {
      const ctx = getCtx();
      const events = readTraceFile(file);
      // Only replay GETs — writes (POST/PUT/PATCH/DELETE) are intentionally
      // not supported to avoid accidental re-mutation. If a user wants to
      // replay writes, they must do so via their own script with --force.
      const replayable = events.filter(e => e.method === "GET" && e.path);
      const limit = Number(opts.limit) || 100;
      const slice = replayable.slice(0, limit);

      // Dry-run is the SAFE default (respects CLI global --dry-run).
      // Users must explicitly pass --force to re-issue the GETs live.
      if (ctx.dryRun || !ctx.force) {
        printResult(ctx, {
          dryRun: true,
          wouldReplay: slice.length,
          skippedWrites: events.filter(e => e.method && ["POST", "PUT", "PATCH", "DELETE"].includes(e.method)).length,
          firstTen: slice.slice(0, 10).map(e => `${e.method} ${e.path}`),
        });
        return;
      }

      const { createClient } = await import("../../core/http.js");
      const client = createClient(opts.profile ?? ctx.profile);

      const results: Array<{ path: string; status: string; durationMs: number }> = [];
      for (const ev of slice) {
        const started = Date.now();
        try {
          await client.request(ev.path!);
          results.push({ path: ev.path!, status: "ok", durationMs: Date.now() - started });
        } catch (err) {
          const statusMatch = (err instanceof Error ? err.message : String(err)).match(/\((\d+)\)/);
          results.push({ path: ev.path!, status: statusMatch ? statusMatch[1] : "err", durationMs: Date.now() - started });
        }
      }
      printResult(ctx, {
        replayed: results.length,
        ok: results.filter(r => r.status === "ok").length,
        errors: results.filter(r => r.status !== "ok").length,
        skippedWrites: events.filter(e => e.method && ["POST", "PUT", "PATCH", "DELETE"].includes(e.method)).length,
        results,
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
