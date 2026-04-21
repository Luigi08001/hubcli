# Tutorial: Audit every write to your HubSpot portal

**Time:** ~10 min
**Prerequisites:** `hscli` installed, at least one trace file recorded (see the [trace tutorial](trace-replay-repro.md)).

You need to answer: "Which agent deleted 40 contacts on Friday?" or "Did any automation write to pipelines outside business hours last quarter?" `hscli audit` rolls up JSONL traces to give you operational auditability without a backend.

## Step 0 — ensure traces exist

If you haven't recorded yet, start one session:

```bash
hscli trace start
# ... run some commands, let MCP tools run, etc ...
hscli trace stop
```

Traces are saved as `~/.revfleet/trace-*.jsonl`. `hscli audit` auto-scans that directory by default — no configuration needed.

## Step 1 — timeline

```bash
hscli audit timeline --since 24h
```

Chronological event list across every trace file. Useful for "what happened in the last hour / day / week".

Flags:
- `--since 15m | 24h | 7d` — time window (default: all time)
- `--limit N` — max events to show (default: 100, shown most-recent-first)
- `--writes-only` — filter to `POST/PUT/PATCH/DELETE`
- `[file-or-dir]` — positional arg overrides the default `~/.revfleet/` scan

## Step 2 — who did what

For each profile, get a breakdown by method, status, and path root:

```bash
hscli audit who alice --since 7d
```

Output shape:
```json
{
  "profile": "alice",
  "totalEvents": 412,
  "reads": 380,
  "writes": 32,
  "byMethod":    { "GET": 380, "POST": 20, "PATCH": 8, "DELETE": 4 },
  "byStatus":    { "200": 390, "201": 18, "400": 2, "500": 2 },
  "byPathRoot":  { "crm": 300, "marketing": 80, "cms": 32 },
  "lastTen":     [ ... ]
}
```

Great for answering "is profile X chatty or abusive?" or "did their error rate spike?".

## Step 3 — who touched this path

Inverse lookup: a given path pattern, who's been hitting it?

```bash
hscli audit what /crm/v3/objects/deals --since 7d
```

Substring match — `/deals` catches `/crm/v3/objects/deals`, `/crm/v3/objects/deals/123`, `/crm/v3/objects/deals/batch/read`, etc.

Output buckets by profile, MCP tool (if the request came from `hscli mcp`), and method. Also lists `recentWrites` — the last 10 write operations against that path.

This is the go-to command for incident response: **"An unexpected delete happened on contacts. Who?"**

```bash
hscli audit what /crm/v3/objects/contacts --since 24h
# → byProfile: { "alice": 12, "claude-agent": 3 }
# → byTool: { "crm-batch-delete": 2 }
# → recentWrites: [ ... with profile, toolName, timestamp ... ]
```

## Step 4 — every write, ever

The most security-relevant audit view:

```bash
hscli audit writes --since 24h
```

Returns *every* `POST/PUT/PATCH/DELETE` event in the window, counts failed vs successful, and includes a `limit`-capped list. Ideal for daily operator review.

## Step 5 — MCP tool breakdown

If you're running `hscli mcp` (exposing tools to Claude, Cursor, etc.), every request is tagged with `toolName`. Roll up per tool:

```bash
hscli audit by-tool --since 7d
```

Output:
```json
{
  "totalMcpCalls": 1200,
  "uniqueTools": 28,
  "breakdown": [
    { "tool": "crm-contacts-list", "calls": 450, "writes": 0,  "errors": 2, "errorRate": "0.4%", "avgMs": 180, "maxMs": 520 },
    { "tool": "crm-contacts-create", "calls": 120, "writes": 120, "errors": 15, "errorRate": "12.5%", "avgMs": 320, "maxMs": 1800 },
    ...
  ]
}
```

Sorted by call count descending. Quick pattern-matching:

- Highest-call-count tool → "which tool is the chatty one"
- Highest error rate → "which tool is the buggy one" or "which tool is hitting a capability boundary"
- Highest maxMs → "which tool has tail-latency issues"

## Step 6 — combine with `jq` for custom views

Every audit command outputs JSON when you pass `--json` (or use `--format json` globally). Pipe into `jq` for ad-hoc queries:

```bash
# All 5xx writes in the last day, path + profile + ts
hscli --json audit writes --since 24h \
  | jq '.data.writes[] | select(.status >= 500) | { ts, profile, method, path, status }'

# Top 5 profiles by write count
hscli --json audit timeline --since 7d --writes-only --limit 10000 \
  | jq '.data.events | group_by(.profile) | map({ profile: .[0].profile, count: length }) | sort_by(-.count) | .[:5]'
```

## Step 7 — feed into CI / Slack / PagerDuty

Because everything is JSON-in / JSON-out, you can:

- Run `hscli audit writes --since 1h` as a cron job; if any `failedWrites > 0`, POST to Slack.
- Gate your deploy pipeline on `hscli audit by-tool --since 1h | jq '.data.breakdown[] | select(.errorRate | rtrimstr("%") | tonumber > 5)'` — fail if any tool's error rate spiked.
- Archive traces to S3 daily for long-term compliance — the format is append-only JSONL, gzip-friendly.

## What you get

- Every trace file in `~/.revfleet/` becomes a queryable, structured audit log — no DB, no service to run.
- Five pre-built aggregations (timeline, who, what, writes, by-tool) cover 90% of operator questions.
- Works whether the traffic came from a human at a terminal, a cron job, or an MCP-connected agent.
- Combined with [policy-as-code](secure-agent-writes.md), you get "what rule fired, against which request, from which tool, at what time" — in aggregate.

## Tips

- Trace files retain the HTTP request metadata but not the auth token — safe to share between operators.
- If you store multiple portals in separate profiles (`hscli --profile prod ...`, `--profile staging ...`), `audit who` naturally segments by portal.
- For a persistent audit trail, write traces to a shared path (`--out /mnt/shared-audit/trace-$(date +%F-%H%M).jsonl`) and scan with `hscli audit --file /mnt/shared-audit/`.
- `audit who` and `audit what` return `0` for `totalEvents` when nothing matches — no error, just silence — so they're safe to run in pipelines.
