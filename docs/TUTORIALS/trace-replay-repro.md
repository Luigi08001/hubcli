# Tutorial: Reproduce a bug with trace + replay

**Time:** ~10 min
**Prerequisites:** `hscli` installed, a HubSpot Private App token authenticated, at least one portal to test against.

Your agent "works fine in staging, fails in prod." Or: "Monday it fetched 500 contacts, Tuesday it fetched 120." You need to see *exactly* what happened, compare runs, and replay the read portion safely to isolate the divergence.

`hscli trace` records every request to a JSONL file with enough detail to reconstruct and replay the session.

## Step 1 — start recording

```bash
hscli trace start --include-bodies
```

Output:
```json
{
  "started": true,
  "file": "/Users/you/.revfleet/trace-2026-04-21T09-14-22-123Z.jsonl",
  "session": { ... }
}
```

A state file at `~/.revfleet/trace-session.json` tells the HTTP client to append every request to the trace file until you stop.

`--include-bodies` captures request and response payloads (redacted for secrets). Omit it for tiny trace files when you only need metadata (method, path, status, latency).

## Step 2 — reproduce the scenario

Run whatever failed. This can be:
- A sequence of `hscli` commands in a shell script
- An MCP agent connected to `hscli mcp` (every tool call is tagged with `toolName`)
- A custom integration hitting `hscli api request ...`

Example:
```bash
hscli crm contacts list --limit 100
hscli crm companies list --limit 50
hscli --force crm contacts create --data '{"properties":{"email":"test@example.com"}}'
```

## Step 3 — stop + inspect

```bash
hscli trace stop
```

Output shows the trace file path, duration, event count, and file size.

### Summary

```bash
hscli trace stats ~/.revfleet/trace-2026-04-21T09-14-22-123Z.jsonl
```

Breaks down by method, status, profile, tool (if MCP), latency percentiles (p50/p95/p99/max), write vs read count.

### Errors only

```bash
hscli trace errors ~/.revfleet/trace-2026-04-21T09-14-22-123Z.jsonl
```

### Filter for specific events

```bash
hscli trace show <file> --filter "status=>=400,method=POST"
hscli trace show <file> --filter "path=/crm/v3/objects/contacts,status=!200"
```

Supported operators: `=`, `!` (not equal), `>=`, `<=`, `>`, `<`, plus substring match when no operator is used.

## Step 4 — compare two runs

This is the killer feature for reproducibility. Record the same scenario twice — once on staging, once on prod:

```bash
# Staging
hscli trace start --out ./staging.jsonl
./run-scenario.sh
hscli trace stop

# Prod
hscli trace start --out ./prod.jsonl
./run-scenario.sh
hscli trace stop

# Diff
hscli trace diff ./staging.jsonl ./prod.jsonl
```

`trace diff` normalizes numeric path segments (e.g. `/crm/v3/objects/contacts/123` → `/crm/v3/objects/contacts/{id}`) so you see structural divergence, not id noise. The output tells you:

- `onlyInA` — calls the staging run made but prod didn't
- `onlyInB` — calls prod made but staging didn't
- `countChanges` — keys with a different number of hits (cursor pagination edge cases live here)
- `statusChanges` — same call but different status in each run (the bug's fingerprint)
- `divergent` — single boolean flag for CI

## Step 5 — replay GETs

To test a fix, you often want to re-run the same reads against a different profile or a patched client:

```bash
hscli --profile staging trace replay ./prod.jsonl
```

Default is **dry-run** — it reports what *would* be replayed. Writes (`POST/PUT/PATCH/DELETE`) are filtered out entirely; they're never replayable, to avoid accidental re-mutation.

To actually re-issue the GETs:

```bash
hscli --force --profile staging trace replay ./prod.jsonl
```

You'll get a list of each path, status, and duration — perfect for confirming a capability-probe cache invalidation, a rate-limit reshuffle, or a schema migration.

## Step 6 — tail live (optional)

If you want to watch events stream in during a long scenario:

```bash
# In one terminal
hscli trace start

# In another
hscli trace tail   # tails the active session
# or
hscli trace tail <file> --format json
```

Compact mode shows `status ts method path latency [toolName]` per line. `--format json` streams the full event for pipe-to-`jq` workflows.

## What you get

- Every request is an auditable line of JSON — method, path, status, duration, profile, tool (for MCP), optional bodies.
- Two runs of the same scenario can be diffed, and differences surface structurally (not as a wall of id changes).
- Read-side replay lets you isolate whether a bug is client-side or portal-side.
- Pair with `hscli audit` (see the [audit tutorial](audit-portal-writes.md)) to roll traces up into *who did what when*.

## Tips

- Trace files are append-only JSONL — safe to `tail -f`, pipe into `jq`, feed into observability tools.
- Set `HSCLI_TRACE_BODIES=1` if you want the HTTP layer to always capture bodies without needing `--include-bodies`.
- Keep traces out of git — add `~/.revfleet/trace-*.jsonl` to `.gitignore` or write to `/tmp`.
- Trace works for every `hscli` command and every MCP tool — the recording lives in the HTTP layer, not in the command handler.
