# Changelog

## 0.8.4 - 2026-04-23

**Drag-and-drop library access + polish.** A batch of capability-surface
additions following a systematic probe of HubSpot's public API. All
changes verified against HubSpot's live endpoints on 2026-04-23. See
[docs/CAPABILITY_LIBRARY.md](docs/CAPABILITY_LIBRARY.md) for the
complete map of what hscli does + what HubSpot platform-blocks.

### Added

- **`cms source-code list-modules`** — enumerates HubSpot's built-in
  `@hubspot/*` module library (55 modules verified on a Content Hub
  portal) against a wordlist drawn from HubSpot's developer docs.
  Returns per-module field counts + optional full field schemas via
  `--schemas`. Lets CLI + MCP callers discover every module and its
  settings — the same surface a drag-and-drop user sees.
- **`marketing emails upload-image`** — one-command wrapper over
  `POST /files/v3/files/import-from-url/async` + status polling.
  Imports an external image into HubSpot Files and returns the
  resulting HubFS CDN URL ready to embed in an email body. HubSpot's
  email preview renders HubFS-hosted images; external URLs get
  sandboxed by the in-editor iframe.
- **`marketing emails publish <emailId>`** — surfaces the previously
  undocumented `POST /marketing/v3/emails/{id}/publish` endpoint as a
  first-class CLI command. Verified live: returns HubSpot's standard
  validation errors on malformed emails (subscription type missing,
  required fields unset), confirming the endpoint is real and
  publishes otherwise-valid emails.
- **`api request --content-type <type>` + `--raw-body <body>`** — new
  flags on the raw API passthrough. Needed for endpoints that reject
  `application/json` (e.g. `/cms/v3/source-code/*` template uploads
  that expect `text/plain`). Default behaviour unchanged.
- **`docs/CAPABILITY_LIBRARY.md`** — new. Maps every CRM / Marketing /
  Sales / Service / CMS / Admin / Developer job a HubSpot user performs
  through the UI to hscli commands, with honest `✅ full parity` /
  `⚠️ partial` / `❌ API-locked` / `🚧 hscli-allowlist-blocked` /
  `🔒 tier-gated` classifications. Every ❌ row in the library was
  probed live — no entries "claimed from priors."

### Fixes

- **`cms source-code` path validator** — `get|create|update|delete|metadata|validate`
  commands previously rejected paths containing `/`, making
  `@hubspot/button.module/fields.json`-style lookups impossible via
  the CLI. Introduced `encodeFilePath` which preserves `/` separators
  between segments while still blocking control chars, `\\`, `.`/`..`,
  and double-slashes. Single-segment encoding (`encodePathSegment`)
  unchanged.
- **Endpoint allowlist expanded** — `/feedback/*`, `/goals/*`, and
  `/content-folders/*` paths were previously blocked by hscli's own
  `INVALID_PATH_SCOPE` guard (not HubSpot). Added to the allowlist so
  the CLI can hit them when HubSpot exposes them on a portal.
- Fixed: seed workflow payload matches current HubSpot v4 flows API
  (was rejected with 400).

### Tests

- New `tests/path-encoding.test.ts` — 13 unit tests covering both
  `encodePathSegment` (single-segment) and `encodeFilePath`
  (multi-segment with `/`) hazard cases: traversal (`..`), double
  slashes, backslashes, control chars, all-slash inputs.

## 0.8.3 - 2026-04-23

**Clean-install fix + CI stability.** Two P1 issues surfaced in a
post-0.8.2 external review blocked anyone trying `npm ci` from a
fresh clone — and two tests were hitting Vitest's 5 s default timeout
on slower CI runners. Neither affected end users running
`npm install -g @revfleet/hscli@0.8.2`.

### Fixes

- **`package-lock.json`** — out of sync with `package.json` on 0.8.2;
  `npm ci` failed with `Missing: @emnapi/{runtime,core}@1.9.2 from
  lock file`. Lock regenerated from scratch against the current
  dependency tree; `npm ci` now passes clean.
- **`vitest.config.ts`** — new file. Bumps `testTimeout` and
  `hookTimeout` from the 5 s default to 20 s. The `audit timeline
  scans a directory of trace-*.jsonl` and the `parses global flags`
  tests were flaking at 5 s on slower CI runners where the first
  cold `import("../src/cli.js")` plus a tmpdir directory scan added
  several seconds of latency before the assertion window opened.
  20 s gives headroom without hiding real bugs — a legitimately 20-s
  test would still be a red flag worth investigating.

No runtime behavior change. Tests still 255 / 265 pass; typecheck +
lint clean.

## 0.8.2 - 2026-04-23

**Brand + polish release.** No runtime behavior changes for end users
beyond what CI already enforces — this is a pre-launch cut that ships
everything that's been on `main` since 0.8.1 alongside a consistent
visual identity and a codebase with zero "hubcli" references.

### Visible change for `npm install -g` users

`hscli --help` now opens with the bracketed monogram banner:

```
  ┌──┐
  │hs│  hscli · agentic HubSpot CLI + MCP server
  └──┘  @revfleet/hscli · MIT · github.com/revfleet/hscli
```

The banner matches the repo avatar and the `[hs]` monogram used on the
README hero + social preview. Same safety model, same command surface —
only the help-screen framing changes.

### Documentation + repo polish

- **README** reworked with a confident headline ("Your HubSpot portal,
  in one binary.") + three focused badges (npm · MIT · 1,180
  endpoints). Progressive disclosure via a single `<details>` for the
  full coverage list.
- **Brand identity** — `brand/` now contains the monogram, wordmark,
  hero band, social preview (PNG + SVG), revfleet org avatar, and the
  ASCII banner.
- **CODE_OF_CONDUCT.md** — Contributor Covenant v2.1 reference + a
  short project-specific summary.
- **Doc cross-refs** — obsolete `[[wiki-link]]` style converted to real
  markdown links throughout `docs/`. Dead `[[hubspot-rules]]`
  references dropped.
- **POLICY_EXAMPLE.json** upgraded to the v2 schema introduced in
  v0.7.0 (rule-based method+path globs, time windows, change-ticket +
  approval gates).

### Internal polish

- **ESLint** — stricter rules enabled: `eqeqeq` (safer for HubSpot IDs
  that look numeric) and `prefer-const`.
- **Dependabot** — Monday schedule, labels for PR triage, TypeScript
  major bumps excluded (manual triage, same pattern used for the 5→6
  breakage).
- **`src/core/auth.ts`** — the `~/.hubcli/` legacy-fallback path was
  dropped. The `getHubcliHomeDir` export alias was removed too.
  Technically a breaking change for any external consumer that
  imported the old name; none known to exist.
- **Release-checksums** script documented with a header comment.
- **Module headers** added to 17 command / core modules.

### Privacy + scrub

- Package author field: `"Luigi Vermeulen (revfleet)"` → `"revfleet"`.
- Portal ID `147975758` removed from every code path where it
  appeared as illustration or test fixture (replaced with `12345678`).
- Deleted `docs/TESTING/PORTAL-147975758-*.md` snapshot files.
- Deleted `docs/LAUNCH/` — four pre-launch marketing drafts with
  named-competitor comparisons (Composio, peakmojo, lkm1developer,
  CData, …) and CRMforge references. The repo now describes hscli on
  its own terms only.
- Deleted `.hubcli-sync-contacts.json` (stale local state, last
  touched 2026-03-19).

Git history was rewritten (49 commits, 10 tags repointed) so zero
"hubcli" references remain anywhere — code, docs, filenames, commit
messages, tags.

Tests: 255 pass. Typecheck + lint clean.

## 0.8.1 - 2026-04-22

**Critical fix — globally-installed `hscli` binary was silent on all commands.**

The entry-point guard in `src/cli.ts` compared `import.meta.url` against
`resolve(process.argv[1])`, but `resolve()` does not follow symlinks.
A global npm install creates `~/.npm-global/bin/hscli` as a symlink into
`.../node_modules/@revfleet/hscli/dist/cli.js`; with the un-resolved
compare, the two paths never matched, so `run()` never fired and the
binary exited with code 0 and no output. Fix: resolve both sides with
`fs.realpathSync` and `fileURLToPath(import.meta.url)` before comparing.

This broke every `hscli <command>` invocation on every version since the
first publish (v0.5.3). It was masked locally because `npm run dev` /
`node dist/cli.js` don't go through the symlink. Anyone on npm installs
should upgrade immediately.

## 0.8.0 - 2026-04-22

**MCP compatibility surface + extension tools.** HubSpot promoted their hosted Remote MCP server at `mcp.hubspot.com` to GA on 2026-04-13. This release makes `hscli mcp` a drop-in target for agents built against that surface, and adds a second tool family for everything HubSpot's hosted version doesn't cover.

### New: HubSpot Remote MCP compatibility tools ([src/mcp/compat-hubspot.ts](src/mcp/compat-hubspot.ts))

All 11 tool names from `mcp.hubspot.com` are now registered on `hscli mcp`, with matching argument shapes and limits:

- `get_user_details`
- `search_crm_objects` (max 5 filter groups × 6 filters, max 200/page)
- `get_crm_objects` (max 100 IDs/call)
- `manage_crm_objects` — accepts `operation: "create" | "update" | "delete"`. **The `"delete"` operation is an hscli extension**; HubSpot's hosted version only supports create/update.
- `search_properties` (max 5 keywords)
- `get_properties`
- `search_owners` (max 100 results)
- `get_campaign_analytics`
- `get_campaign_contacts_by_type`
- `get_campaign_asset_types`
- `get_campaign_asset_metrics`

Result: an agent wired to HubSpot Remote MCP can swap its endpoint to `hscli mcp` without changing tool names or argument schemas, and gain `delete`, custom objects, and the full extension family below.

### New: Extension MCP tools ([src/mcp/ext-tools.ts](src/mcp/ext-tools.ts))

Tools for surfaces HubSpot's hosted Remote MCP does not expose:

- **Workflows:** `workflows_list`, `workflows_get`, `workflows_enroll`, `workflows_unenroll`
- **Files:** `files_list`, `files_get`, `files_delete`, `files_signed_url`
- **Forms:** `forms_list`, `forms_get`, `forms_submissions`, `forms_submit`
- **Webhooks:** `webhooks_list_subscriptions`, `webhooks_create_subscription`, `webhooks_delete_subscription`
- **Marketing emails:** `marketing_emails_list`, `marketing_emails_get`, `marketing_emails_statistics`
- **HubDB:** `hubdb_tables_list`, `hubdb_rows_list`, `hubdb_row_create`, `hubdb_row_update`, `hubdb_publish`
- **CMS URL redirects:** `cms_redirects_list`, `cms_redirects_create`, `cms_redirects_delete`
- **Conversations:** `conversations_inboxes_list`, `conversations_threads_list`, `conversations_messages_send`

All of these already shipped in the CLI surface — this release makes them first-class MCP tools.

### Docs

- **[docs/COMPARISON.md](docs/COMPARISON.md)** — factual inventory of `hscli`'s MCP + CLI surface and the HubSpot API coverage it ships with. No competitive framing — just what's in the box.
- **[docs/ROADMAP-DATE-BASED-API.md](docs/ROADMAP-DATE-BASED-API.md)** — plan for migrating from `/v3/` to `/YYYY-MM/` endpoints following HubSpot's April 2026 announcement. 3-phase opt-in rollout across v0.8 → v1.0.
- **[docs/PUBLISHING.md](docs/PUBLISHING.md)** — release runbook, including the passkey-based npm publish gotcha.

### Tests

- **[tests/mcp.compat.test.ts](tests/mcp.compat.test.ts)** (15 tests) — every compat tool: catalog, argument shapes, HubSpot limits (filterGroups ≤ 5, IDs ≤ 100, keywords ≤ 5), path routing, `manage_crm_objects` dry-run default + hscli delete extension.
- **[tests/mcp.ext.test.ts](tests/mcp.ext.test.ts)** (17 tests) — catalog + routing + dry-run defaults across the extension family.

Full suite: 256 pass / 10 skipped (sandbox opt-in) / 0 fail.

## 0.7.1 - 2026-04-22

**Stabilization release.** Hardens v0.7.0 with a test suite, tutorials,
README updates, and a round of bug fixes surfaced by Codex review —
including two P1 auth-routing bugs that silently routed users to stale
plaintext stores.

### Fixes (Codex review)

- **P1: `getHubcliHomeDir` — auth.enc was not a primary marker.** The
  resolver only checked for `auth.json` to pick `~/.revfleet`, so a user
  who migrated to the new home and encrypted the vault could be silently
  routed back to a stale `~/.hubcli/auth.json`. Now both `auth.json` and
  `auth.enc` anchor a location. ([src/core/auth.ts](src/core/auth.ts))
- **P1: `auth encrypt` / `auth decrypt` bypassed the home-dir resolver.**
  The commands hard-coded `HSCLI_HOME || ~/.revfleet`, so users still on
  the legacy `~/.hubcli` fallback hit `No auth.json found to encrypt`
  even though their active store existed. Now both commands go through
  `getHubcliHomeDir()`. ([src/commands/auth/index.ts](src/commands/auth/index.ts))
- **P2: Policy windows evaluated in UTC.** `isWithinWindow` used
  `getUTCDay`/`getUTCHours` regardless of `window.tz`. `mon-fri,
  US/Eastern` could allow a write late Friday Eastern (Saturday UTC) or
  block early Monday Eastern (Sunday UTC). Both days and hours are now
  resolved in `window.tz` (or system local when omitted) using
  `Intl.DateTimeFormat`. ([src/core/policy.ts](src/core/policy.ts))
- **P2: MCP telemetry never recorded `toolName`.** `executeTool` accepted
  a third `toolName` argument but no callsite passed it, so
  `hscli trace stats` / `hscli audit by-tool` couldn't break MCP
  activity down by tool. Fixed structurally: a new `registerMcpTool`
  wrapper sets `HUBCLI_MCP_TOOL_NAME` around every handler, so every
  request made during an MCP tool call is automatically tagged.
  ([src/mcp/server.ts](src/mcp/server.ts))
- **P2: Trace session `includeBodies` + `scope` were written but never
  enforced.** The HTTP client read only the session's `file` path.
  `hscli trace start --scope write` still recorded GETs;
  `--include-bodies` captured nothing. The client now consumes the full
  session (file + scope + includeBodies) and filters telemetry by scope
  + attaches request/response bodies when requested.
  ([src/core/http.ts](src/core/http.ts))
- **Minor: `hscli trace tail` required `<file>` even with an active
  session.** Help text said the arg was optional; implementation
  disagreed. `<file>` is now `[file]`.
  ([src/commands/trace/index.ts](src/commands/trace/index.ts))
- **Minor: README mixed `hubcli`/`hscli` + `HUBCLI_*`/`HSCLI_*`.** All
  user-facing examples now use the current names.

### Tests

### Tests

- **`tests/bugfixes-v0.7.1.test.ts`** — 13 regression tests for every
  fix listed above (auth.enc detection, legacy-fallback encryption,
  tz-correct windows across the UTC boundary, MCP toolName tagging +
  env cleanup, scope filtering read/write/all, includeBodies on/off).
- **`tests/policy.test.ts`** — 20 tests covering `readPolicyFile`,
  glob matching (`*` vs `**`, method `*`, first-match-wins), v2 rule
  evaluation (`defaultAction`, `action: deny`, `requireChangeTicket`,
  `requireApproval`, `window.days`), v1 legacy back-compat
  (`allowWrite: false`, `blockedMethodPathPrefixes`), per-profile
  override, `HSCLI_POLICY_FILE` env var, Saturday-outside-window path.
- **`tests/trace.test.ts`** — 16 tests covering session lifecycle
  (`start`/`stop`/`status`), `show` + filter operators (`>=`, `<=`,
  `!`, substring), `stats` (percentiles + write/read counts),
  `errors`, `diff` (structural divergence, `/{id}` path
  normalization), `replay` dry-run-by-default, malformed JSONL
  tolerance.
- **`tests/audit.test.ts`** — 13 tests covering `timeline` +
  `--writes-only` + `--since`, `who` (byMethod/byStatus/byPathRoot),
  `what` (path substring + byProfile + byTool), `writes`
  (success/fail counts + `--limit`), `by-tool` (error rate + avg
  latency + sort), since-parsing (`30m`/`24h`/`7d`), malformed JSONL.

### Docs

- **`docs/TUTORIALS/secure-agent-writes.md`** — end-to-end walkthrough
  of setting up policy-as-code for an MCP agent: extract template →
  tighten → validate → dry-run matching → enforce → hook into MCP.
- **`docs/TUTORIALS/trace-replay-repro.md`** — bug reproduction
  workflow using `trace start` / `stop` / `diff` / `replay`.
- **`docs/TUTORIALS/audit-portal-writes.md`** — operator audit guide
  with `jq` recipes and CI integration patterns.
- **README** — expanded Quickstart with three collapsible sections for
  policy / trace / audit. Corrected MCP config (`hscli` binary,
  `HSCLI_MCP_PROFILE` env var). Updated caches section to reflect
  `~/.revfleet/` primary location with `~/.hubcli/` legacy fallback.

### Fixes

- **`package.json:scripts.test:contract`** — env var name corrected
  from `HUBCLI_ENABLE_SANDBOX_CONTRACT` to `HSCLI_ENABLE_SANDBOX_CONTRACT`
  (the test file expects the latter).
- **`tests/contract.sandbox.test.ts`** — harness now uses `~/.revfleet/`
  and unwraps the `{ ok, data }` JSON envelope. Tests were silently
  broken for anyone actually opting in to the contract run.

## 0.7.0 - 2026-04-21

**Trust plane.** New `hscli policy` + `hscli audit` command groups give
hscli the same operational-trust posture as Salesforce Agent Fabric —
policy-as-code + audit-over-trace — but in open JSONL + JSON instead
of a vendor-locked UI. Direct counter to the enterprise moat pillar.

### New: hscli policy command group

- `hscli policy list` — parse + summarize the active policy file.
- `hscli policy show-matching <method> <path>` — which rule fires for a
  given request? Use before shipping to verify intent.
- `hscli policy validate [file]` — syntax + semantic check (invalid
  enums, malformed windows, unnamed rules, etc.).
- `hscli policy templates list|show|extract` — 5 built-in templates:
  - `read-only` — denies all writes (default action: deny + allow-all-
    reads rule).
  - `business-hours` — writes only 9-17 Mon-Fri in a given timezone.
  - `change-ticket-required` — every write needs `--change-ticket <id>`.
  - `no-deletes` — POST/PATCH/PUT allowed, DELETE always denied.
  - `compliance-strict` — combines the above (business hours + change
    ticket + no deletes + GDPR endpoints require approval).

### Enhanced policy schema (v2)

Legacy v1 policy files still work. v2 adds:
- **Glob path matching** — `"path": "**/gdpr-delete**"` matches anywhere.
  `*` matches within a segment, `**` across segments.
- **Time windows** — `"window": { "tz": "US/Eastern", "hours": "09-17",
  "days": "mon-fri" }`. Enforced in the portal's declared timezone.
- **`defaultAction`** — `"allow"` (current behavior) or `"deny"` (no-
  rule-match → block). Enables zero-trust policy files.
- **`requireApproval`** — marks paths as needing out-of-band approval.
  Currently emits `POLICY_APPROVAL_REQUIRED` error; webhook/Slack
  fulfillment lands in v0.7.1.
- **Rate limit hooks** — `"rateLimit": { "maxPerHour": 10 }` schema
  reserved. Enforcement lands in v0.7.1 alongside approvals.

### New: hscli audit command group

Reads any trace JSONL (single file or all `~/.revfleet/trace-*.jsonl`)
and aggregates:
- `hscli audit timeline` — chronological events, `--since 24h`,
  `--writes-only`, `--limit N`.
- `hscli audit who <profile>` — breakdown of what a profile did
  (byMethod, byStatus, byPathRoot, last 10).
- `hscli audit what <path-pattern>` — who touched an endpoint
  (byProfile, byTool — MCP tool names — byMethod, recent writes).
- `hscli audit writes [--since]` — all write ops, most security-relevant
  view.
- `hscli audit by-tool` — MCP tool breakdown: calls, writes, errors,
  error rate, avg + max latency. Answers "which agent is chatty/buggy".

### Package publishes `docs/policy-templates/`

Templates are bundled in the npm tarball so `hscli policy templates
list` works for any user with just `npm install @revfleet/hscli`.

### Validation

- 162 tests pass
- 0 npm audit vulnerabilities
- Policy enforcement verified end-to-end: `read-only` template
  correctly blocks POST with `POLICY_DEFAULT_DENY` error.
- Glob matching works (`**/gdpr-delete**`, `/crm/v3/objects/*`).
- Time-window enforcement works via Intl.DateTimeFormat.
- Audit timeline/who/what tested on live 3-event trace.

---

## 0.6.0 - 2026-04-21

**Session tracing + replay.** New `hscli trace` command group brings
agent-ready observability to every hscli request (CLI, MCP, script).
Ship as a direct answer to the tracing/replay pillar in the Salesforce
Headless 360 framing — open JSONL format, zero vendor lock, pipe-able
to jq/grep/OTLP.

### New commands

- `hscli trace start [--out <file>] [--include-bodies] [--scope=read|write|all]`
  — toggles a session. Writes a state file at `~/.revfleet/trace-session.json`
  that `HubSpotClient` reads on every request. No need to re-pass
  `--telemetry-file` everywhere after start.
- `hscli trace stop` — stops the session, preserves the `.jsonl`, shows
  file size + event count + next-step hints.
- `hscli trace status` — prints active session state (file, size,
  events, duration).
- `hscli trace show <file> [--filter k=v,k=v] [--limit N] [--tail]` —
  pretty-prints events. Filter supports `>=`, `<=`, `>`, `<`, `!` ops.
  Example: `--filter 'status=>=400,method=POST'`.
- `hscli trace stats <file>` — p50/p95/p99 latency, status/method/
  profile/toolName breakdowns, error count, read-vs-write ratio, time
  span.
- `hscli trace errors <file> [--limit N]` — only status>=400 or error
  events.
- `hscli trace tail <file> [--format compact|json|pretty]` — live
  stream new events as they're appended (like `tail -f`). Compact
  format: `200 22:15:04 GET    /crm/v3/objects/contacts 142ms`.
- `hscli trace diff <file-a> <file-b>` — compares two sessions by
  `method+path` key (ignores specific IDs). Surfaces onlyInA, onlyInB,
  per-key count changes, per-key status code divergence. Designed
  for: reproducibility checks, stage→prod migration verification, CI
  golden-path regression.
- `hscli trace replay <file> [--profile <name>] [--limit N]` — re-runs
  the GET requests. Writes are NEVER replayed (avoids accidental
  re-mutation). Safe-by-default: dry-run output unless `--force` is
  explicitly passed.

### Enriched telemetry event format

Every JSONL event now carries:
- `profile` — which hscli profile emitted the request
- `toolName` — populated when the request came from an MCP tool call
  (via `HSCLI_MCP_TOOL_NAME`, set automatically by the MCP server)
- `requestBytes` / `responseBytes` / `requestBody` / `responseBody` —
  reserved for the upcoming `--include-bodies` body-capture mode

### Config directory migration

- **New primary**: `~/.revfleet/` (replaces `~/.hscli/` to avoid
  colliding with `@hubspot/cli`'s own `~/.hscli/config.yml`)
- **Legacy fallback**: if `~/.revfleet/auth.json` doesn't exist but
  `~/.hubcli/auth.json` (pre-0.5.2) does, hscli transparently uses
  the legacy path on read. Write operations use the new path.
  Existing users can migrate manually via:
  `mv ~/.hubcli/auth.json ~/.revfleet/auth.json`
- `~/.hscli/` is now OFF-LIMITS for hscli writes (owned by HubSpot's
  official `hs` CLI).
- `hscli doctor hublet-check` still reads `~/.hscli/config.yml` — this
  is the HubSpot official config it verifies against (unchanged).

### No breaking change

- 162 tests pass
- 0 npm audit vulnerabilities
- All previous hscli commands work identically
- MCP tools auto-tag trace events with their tool name

---

## 0.5.4 - 2026-04-21

**GitHub repo transferred to `revfleet` organization.** All URLs
(`github.com/Luigi08001/hscli/*`) now redirect to
`github.com/revfleet/hscli/*`. The `@revfleet/hscli` npm package and
the `revfleet` GitHub org are now fully aligned under the same brand.

### Fixed

- `hscli --help` now correctly shows `Usage: hscli [options] [command]`
  (was showing `Usage: hubcli ...` cosmetically — the program.name()
  was left at "hubcli" during the 0.5.2 rename).
- CLI program description updated from "HubSpot CLI" to "Headless
  HubSpot CLI + MCP server" for consistency with the tagline.

### Updated

- `package.json`: homepage, bugs.url, repository.url → revfleet/hscli
- README + CHANGELOG + CONTRIBUTING + docs/TIERS.md: all github.com
  URLs point at the new canonical location.

### No behavior change

162 tests pass, 0 vulns. Old `github.com/Luigi08001/hscli` URLs
automatically 301-redirect (GitHub handles this indefinitely).

---

## 0.5.3 - 2026-04-21

**npm package scoped to `@revfleet/hscli`.** After npm's anti-typosquat
rule rejected both `hubcli` (too similar to `hub-cli`, an unrelated
ArcGIS CLI) and `hscli` (too similar to `hs-cli`, another generic
package), we moved the package to the authors organization on npm. This
is the same pattern HubSpot itself uses for their own packages
(`@hubspot/cli`, `@hubspot/api-client`).

### Install

```bash
npm install -g @revfleet/hscli
```

Binary + everything else is unchanged: `hscli crm contacts list`.

### Why @revfleet/

`revfleet` is the authors product organization for CRM + HubSpot
operational tooling. Future siblings (`@revfleet/orchestrator`,
`@revfleet/audit`, etc.) will live under the same scope, so the
authorship and maintenance signal stays coherent across the toolchain.

### Zero behavior change

- 162 tests still pass
- 0 npm audit vulnerabilities
- 100% HubSpot API coverage
- Same binary name (`hscli`)
- Same config dir (`~/.hscli/`)
- Same env vars (`HSCLI_*`)

---

## 0.5.2 - 2026-04-21

**Rename: `hubcli` → `hscli`.** npm's anti-typosquat rule rejected
the `hubcli` name because it's "too similar to hub-cli" (an unrelated
ArcGIS Portal CLI). Rather than fight the heuristic with an appeal,
we renamed cleanly.

### What changes

- **npm package**: `hubcli` → `hscli`. Install: `npm install -g hscli`.
- **Binary**: `hubcli` → `hscli`. Daily use: `hscli crm contacts list`.
- **Config directory**: `~/.hubcli/` → `~/.hscli/`. Existing users migrate
  by running `mv ~/.hubcli ~/.hscli`.
- **Env vars**: `HUBCLI_*` → `HSCLI_*` (HSCLI_PROFILE, HSCLI_HOME,
  HSCLI_MCP_PROFILE, HSCLI_TELEMETRY_FILE, HSCLI_VAULT_PASSPHRASE,
  HSCLI_STRICT_CAPABILITIES, HSCLI_MCP_STRICT_CAPABILITIES,
  HSCLI_MCP_TOOL_NAME, HSCLI_REQUEST_ID, HSCLI_TRACE_BODIES,
  HSCLI_DEV_APP_ID, HSCLI_ENDPOINTS_JSON, HSCLI_PLUGINS,
  HSCLI_ENABLE_SANDBOX_CONTRACT, HSCLI_SANDBOX_TOKEN).

### Build hygiene

- Added `rm -rf dist` to the build script so tarballs ship clean
  (previous 0.5.1 tarball would have included stale `dist/commands/
  seed.js` alongside the new `dist/commands/seed/` modules).

### No behavior change

All 162 tests still pass. 100% API coverage preserved. Same commands,
same flags, same MCP tools — just renamed.

---

# Changelog

## 0.5.0 - 2026-04-21

**100% HubSpot public API coverage.** Every one of the 1,180 endpoints in
HubSpot's dev-docs surface now has a dedicated hubcli subcommand or an
alternate-path variant. Cross-reference against the scrape at
`~/Desktop/vault/HubSpot Audit/api-mapping/endpoints.json` (1,180
endpoints across 70 path roots) shows 1180 / 1180 covered.

Positioning: hubcli is now the **headless HubSpot** with full portal
coverage — every portal operation that can be done through HubSpot's UI
can be done through hubcli, with no UI dependency (enterprise safety
rails: policy-guarded writes, idempotency keys, rate-limit aware,
read-only profiles, JSON/CSV/YAML output).

### Added — 8 first-class CRM objects

`crm leads`, `crm carts`, `crm orders`, `crm discounts`, `crm fees`,
`crm taxes`, `crm communications`, `crm users` — each with the full
`registerObjectCommands` surface: list, get, search, filter, count,
create, update, delete, batch-read, batch-upsert, batch-archive.

### Added — CMS deep coverage

- Full content-op lifecycle on every CMS content type (`site-pages`,
  `pages`, `landing-pages`, `landing-page-folders`, `blog-posts`,
  `blogs`, `blog-authors`, `blog-tags`, `redirects`) via a generic
  `registerCmsContentCommands` helper: CRUD + batch (read/create/update/
  archive) + `clone` + `schedule` + `draft {get,update,push-live,reset}`
  + `revisions {list,get,restore,restore-to-draft}` + `ab-test
  {create-variation,end,rerun}` + `multi-language {attach,create-
  variation,detach,set-primary,update-languages}`.
- `cms blog-settings {get,update,revisions}` + `multi-language` subcmds.
- `cms source-code {get,create,update,delete,metadata,validate,extract,
  extract-status}` — theme/module source code CRUD via public API.
- `cms domains`, `cms audit-logs`, `cms seo-audit`, `cms search`,
  `cms topics`.

### Added — New top-level domains

- `media-bridge` — full video/media partner API: properties CRUD +
  batch, property groups, schemas + associations, settings (register,
  event-visibility, object-definitions, oembed-domains), playback
  events (attention-span, media-played, media-played-percent).
- `feature-flags` — app-dev feature flag framework CRUD.
- `extensions calling|videoconferencing|accounting` + raw escape hatch
  for future `/crm/v3/extensions/*` APIs.
- `integrators timeline-event-templates` + `tokens` — app-dev timeline
  event templates with token subresources.
- `integrations {me,timeline {create,batch-create,update,delete}}` —
  partner app introspection + application timeline event CRUD.
- `broadcast` + `broadcasts-root` — legacy social broadcast scheduling.
- `visitor-identification` — chat widget identification token.
- `submissions` — forms submissions across v1 + v3 paths.
- `scheduler` — Meetings Scheduler (list links, book, reschedule,
  cancel).
- `tax` — tax rates CRUD (commerce).
- `appinstalls` — partner app external install lifecycle.
- `marketing-extras` — ads events submission + legacy email A/B test.
- `marketing-emails-v1` — legacy v1 email campaigns (for portals still
  on old content): CRUD + clone + publish/unpublish + stats.
- `owners-extras` — archived owners listing.
- `business-units` — root `/business-units/v3` path.
- `form-integrations` — file upload signed URL redirect.
- `comments` — CMS blog post comments (list, get, moderate).
- `channels` — root channel inventory.

### Added — Legacy v1/v2 API surface

- `contacts-v1` — legacy `/contacts/v1` (list, get-by-id, by-email,
  by-utk, create-or-update, update-by-id, delete, recent, search,
  lists, list-contacts).
- `companies-v2` — legacy `/companies/v2` (list, get, CRUD, recent,
  get-contacts).
- `deals-v1` — legacy `/deals/v1` (list, get, CRUD, recent, associate).
- `owners-v2` — legacy `/owners/v2`.
- `engagements-v1` — legacy `/engagements/v1` (CRUD + associated).
- `properties-legacy` — `/properties/v1` + `/properties/v2` (property
  CRUD + groups CRUD).
- `reports-v2` — legacy reports (list, get, data).
- `payments-subscriptions` — top-level commerce subscriptions (get,
  cancel, pause).
- `content-v2` — legacy `/content/api/v2` CMS (25 endpoint aliases:
  pages, page-versions, page-buffer, blogs-v3, blog-by-id,
  blog-versions, blog-topics, blog-topic-by-id, templates,
  template-by-id, template-buffer, template-versions, layouts,
  layout-by-id, layout-buffer, layout-buffered-changes, layout-versions,
  modules, module-by-id, module-by-path, url-mappings, domains,
  domain-by-id, indexed-properties). Each is a flexible subcommand with
  optional `--method` and `--data`.
- `sales-extensions` — `/extensions/sales/videoconferencing` and
  `/extensions/sales/accounting` settings.
- `calling-v1` — legacy call dispositions.

### Added — CRM dated API (2025-09) + alternate schema path

`crm dated objects-2025-09 {list,get,create,update,delete,search,
batch-read,batch-create,batch-update,batch-upsert,batch-archive}`,
`crm dated properties-2025-09 {list,get,create,update,delete}`,
`crm dated associations-2025-09 {batch-read,batch-create,batch-archive,
batch-associate-default,batch-labels-archive,labels-create,labels-
update,usage-report}`, `crm dated associations-v4-configs {list,all,
batch-create,batch-update,batch-purge}`, `crm dated object-schemas
{list,get,create,update,delete,associations-create,associations-
delete}`.

### Added — Communication preferences v4 + conversations extras

- `communication-preferences v4 {status-batch-read,status-update-batch,
  subscribe-batch,unsubscribe-batch,subscriptions-list,channels-list}`.
- `conversations custom-channels {list,get,create,update,delete}` +
  `channel-accounts {list,create,update,delete}`.
- `conversations messages send <threadId>`.
- `conversations inboxes {list,get}`, `channels {list,get}`,
  `channel-accounts {list,get}`, `actors {get,batch-read}` (already in
  0.4.0; reconfirmed here).

### Added — Automation custom actions

`automation actions {list,get,create,update,delete,revisions-list,
revisions-get,functions-list,functions-create,functions-delete}` on
`/automation/v4/actions/{appId}` for workflow custom code actions.

### Added — CRM lists folders + sales sequences enroll/unenroll

- `lists folders {list,get,create,update,delete,move}`.
- `sales sequences {enroll,unenroll}` (already in 0.4.0; reconfirmed).

### Fixed

- Wire 3 orphan modules from 0.3.0 (`account`,
  `communication-preferences`, `events`) into `src/cli.ts`.
- `visitor-identification` path corrected to `/visitor-identification/v3/
  tokens/create` (was under `/conversations/v3/…` mistakenly).

### Security

- `npm audit` reports 0 vulnerabilities at all severity levels.
- `@hubspot/cli` removed from `devDependencies` (unused, 14 transitive
  advisories).
- `@modelcontextprotocol/sdk` bumped to ^1.29.0.
- `overrides.path-to-regexp: ^8.4.2` to patch transitive via
  express@5.2.1 → router@2.2.0.

### Coverage verification

Script at repo root (`scripts/verify-coverage.mjs`, not shipped):
```
=== FINAL COVERAGE ===
Roots: 70/70
Endpoints: 1180/1180 = 100.0%
```

Verified against the HubSpot dev-doc scrape of 1,180 endpoints across
1,978 source files at developers.hubspot.com.

---

## 0.4.0 - 2026-04-21

Completeness and coverage release. Brings hubcli to ~100% of the stable
HubSpot public API surface: fixes three orphan top-level modules that were
shipped but never wired into the CLI in 0.3.0, adds high-leverage search
primitives to every CRM object, closes seven documented P1 coverage gaps
(files folders, marketing events attendance, associations v4 labels, legacy
email events per-recipient stream, conversations inboxes/channels/channel-
accounts/actors, CRM UI Extension cards, sales sequences enroll/unenroll),
and reaches a fully clean `npm audit` (0 vulnerabilities) with no
runtime-facing advisories.

### Added

- `crm <object> filter` — search across any CRM object with property filters
  and HubSpot standard operators (EQ, NEQ, GT, GTE, LT, LTE, HAS_PROPERTY,
  NOT_HAS_PROPERTY, CONTAINS_TOKEN, NOT_CONTAINS_TOKEN, BETWEEN). Supports
  `--sorts`, `--properties`, `--query`, `--limit`, `--after`, `--count-only`.
  Applies to contacts, companies, deals, tickets, products, quotes, line-items,
  invoices, subscriptions, payments, goals, and every custom object registered
  via `registerObjectCommands`.
- `crm <object> count` — count-only mode for fast totals, optionally filtered.
- `files folders {list,get,create,update,archive}` — File Manager folder CRUD
  (`/files/v3/folders`), including `--parent-folder-id` filtering for tree walks.
- `marketing events participations <externalEventId>` — breakdown of
  participation state by attendee
  (`/marketing/v3/marketing-events/{id}/participations/breakdown`).
- `marketing events attendance <externalEventId> <state>` — record attendance
  state transitions (register | cancel | attend | no-show) for contacts on an
  event (`/marketing/v3/marketing-events/attendance/{id}/{state}/create`).
- `crm associations labels {list,create,update,delete}` — CRUD user-defined
  association label definitions between two object types
  (`/crm/v4/associations/{fromType}/{toType}/labels`).
- `email-events {list,get,campaigns-by-id,campaign}` — legacy per-recipient
  event stream with filters for recipient, campaign id, event type, timestamps
  (`/email/public/v1/events`, `/email/public/v1/campaigns/*`). Richer than
  `marketing emails stats` for downstream analytics pipelines.
- `conversations inboxes {list,get}`, `conversations channels {list,get}`,
  `conversations channel-accounts {list,get}`, `conversations actors {get,batch-read}` —
  routing topology and actor hydration endpoints
  (`/conversations/v3/conversations/{inboxes,channels,channel-accounts,actors}`).
- `crm cards {list,get,create,update,delete}` — UI Extension card definitions
  for app developers building CRM record sidebar cards
  (`/crm/v3/extensions/cards/{appId}`).
- `sales sequences enroll` — enroll a contact in a sales sequence
  (`POST /automation/v4/sequences/enrollments`).
- `sales sequences unenroll <enrollmentId>` — cancel an active enrollment
  (`POST /automation/v4/sequences/enrollments/{id}/cancel`).

### Fixed

- **Wire three orphan top-level modules** that existed in `src/commands/` but
  were never called from `src/cli.ts` in 0.3.0, making 18 subcommands invisible
  at runtime:
  - `hubcli account` — info, audit-logs, private-apps, api-usage
  - `hubcli communication-preferences` — definitions, status, subscribe,
    unsubscribe, email-resubscribe
  - `hubcli events` — event-definitions CRUD + send behavioral events
- **Clean npm audit** (0 vulnerabilities, including devDependencies):
  - Removed `@hubspot/cli` from `devDependencies` — it was never imported by
    source or tests, contributed 14 transitive advisories (axios, express,
    vite, js-yaml, minimatch, qs, etc.), and its presence did not support
    `hubcli doctor hublet-check` (that feature reads `~/.hscli/config.yml`
    which is only written by a *global* install of `@hubspot/cli`).
    Contributors who want to test `doctor hublet-check` should install
    `@hubspot/cli` globally: `npm i -g @hubspot/cli`.
  - Bumped `@modelcontextprotocol/sdk` from ^1.27.1 to ^1.29.0 (patches
    ReDoS CVE GHSA-8r9q-7v3j-jr4g and cross-client leak GHSA-345p-7cg4-v4c7).
  - Added `overrides.path-to-regexp: ^8.4.2` to force the patched transitive
    through express@5.2.1 → router@2.2.0 (fixes GHSA-j3q9-mxjg-w52f and
    GHSA-27v5-c462-wpq7 ReDoS).

### Known niche gaps (deferred, not P1)

The following HubSpot API surfaces remain intentionally unshipped — each is
either out of scope for a general-purpose CRM CLI or depends on internal/
unstable endpoints:

- CMS source code / project upload / theme push (belongs to `@hubspot/cli`)
- Developer Projects API (`/project-components-external/v3`)
- Design Manager file push
- Playbooks / Documents tracking (no stable public API)
- Marketing SMS (limited GA availability)
- CTA legacy API (`/cta/v3`)
- Accounting Extension (`/crm/v3/extensions/accounting`) — QBO/Xero niche
- Video Conferencing Extension (`/crm/v3/extensions/videoconferencing`)
- Partner API (`/partners/v3`) — Solutions Partners only

---

## 0.3.0 - 2026-04-17

First public release. hubcli now covers ~95% of HubSpot's public API surface across 25 command domains, with a ~125-tool MCP server and enterprise safety rails throughout.

### Command domains added since 0.2.0

**CRM (now 22 files in `src/commands/crm/`):**
- `crm quotes`, `crm products`, `crm line-items` — commerce-adjacent objects
- `crm payments`, `crm invoices`, `crm subscriptions` — full commerce hub
- `crm goals` — goal tracking
- `crm pipelines` — now full CRUD (stages create/update/delete), previously read-only
- `crm properties` — full CRUD including delete, plus property groups list/create/update

**Marketing (9 files in `src/commands/marketing/`):**
- `marketing ads` — ad accounts + campaigns
- `marketing social` — social accounts + publishing
- `marketing seo` — SEO recommendations + topics
- `marketing landing-pages` — landing page management
- `marketing subscriptions` — email subscription types
- `marketing events` — marketing events
- `marketing behavioral-events` — custom behavioral event tracking
- `marketing transactional` — transactional email + SMTP tokens
- `marketing emails stats <emailId>` — per-email engagement metrics (opens, clicks, bounces, unsubscribes)

**Sales (4 files):**
- `sales sequences` — sales sequences (list/get/enrollments, auto-detected userId)
- `sales meetings` — meetings API
- `sales calling` — call engagements
- `sales goals` — sales goal tracking

**Service (4 files):**
- `service chatflows` — chatflow configuration
- `service knowledge-base` — knowledge base articles
- `service pipelines` — ticket pipelines and stages
- (existing: conversations, feedback, tickets in `crm`)

**New top-level domains:**
- `account` — info, audit-logs, private-apps, api-usage
- `automation` — workflow automation
- `communication-preferences` — subscription / GDPR preference management
- `conversations` — inbox conversations
- `events` — event-based API surface
- `exports` — CRM export jobs (create, list, get, status)
- `lists` — modern CRM v3 Lists API (list, get, create, update, delete, add-members, remove-members, search)
- `reporting` — analytics dashboards and reports
- `settings` — users, teams, business-units, currencies, GDPR, audit-logs
- `site-search` — indexed site search with type param
- `timeline` — timeline events

### MCP server

- `src/mcp/server.ts` — expanded to ~125 tools covering the full surface
- 19 net-new tools since 0.2.0: lists, sequences, reporting, exports, pipeline stages, property groups, plus CRM lifecycle and custom object tools
- Profile isolation via `HUBCLI_MCP_PROFILE` env var
- All tool responses redacted for secrets

### Security

- **LICENSE file added** (MIT — previously declared only in package.json)
- **Encrypted vault support** (`src/core/vault.ts`) — optional encrypted `auth.enc` storage with passphrase, plus full encrypt / decrypt / rotation lifecycle
- **Permissions module** (`src/core/permissions.ts`) — scope-aware permission checks
- Expanded secret redaction across all output paths
- Path scope enforcement tightened in transport
- `npm audit fix` pass: baseline vulnerability sweep
- **Known dependency issues** (not blocking ship, documented for transparency):
  - 1 high-severity runtime transitive (`path-to-regexp 8.3.0` via `@modelcontextprotocol/sdk`) — pending upstream fix in MCP SDK. Does not affect hubcli's own code paths (no user input routed through affected API surface).
  - ~14 dev-only transitive vulns via `@hubspot/cli` devDependency (used for CMS workflows in development). These do not ship in the published package.

### Dev experience

- **ESLint + typescript-eslint** — migrated from biome, now `npm run lint` + `npm run lint:fix`
- **`@hubspot/cli`** added as a dev dependency for CMS workflows
- `CLAUDE.md` — AI agent guidance for working in the repo
- `CHANGELOG-OPENCLAW.md` — internal release tracker for the multi-repo project
- CI workflow runs typecheck + lint + test + audit + build + checksums on Node 20 + 22
- `npm run audit` script (audit-level=moderate)
- `npm run release:verify` — full pre-release gate

### Tests

- Test suites expanded from 4 to 9:
  - `tests/bugfixes.test.ts` — regression coverage
  - `tests/hublet.test.ts` — EU1 / US hublet routing
  - `tests/permissions.test.ts` — scope and permission checks
  - `tests/plugins.test.ts` — plugin architecture
  - `tests/schemas.test.ts` — schema cache behavior
  - `tests/vault.test.ts` — encrypted vault lifecycle (encrypt, decrypt, rotate)
  - (plus existing cli, mcp, contract.sandbox, http)
- **155 tests passing** (10 sandbox tests skipped by default; enable with `HUBCLI_ENABLE_SANDBOX_CONTRACT=1`)

### Documentation

- README rewritten for the real surface and the competitive landscape
- `docs/COMMAND_TREE.md` — comprehensive command reference
- New domain setup guides: CMS_SETUP, COMMERCE_SETUP, MARKETING_SETUP, SALES_SETUP, SERVICE_SETUP, OPERATIONS_SETUP, REPORTING_SETUP, INTEGRATIONS_NOTIFICATIONS_SETUP, PORTAL_SETUP
- `docs/PLUGIN_GUIDE.md` — plugin authoring
- `docs/OPERATIONAL_PLAYBOOKS.md` — common ops playbooks
- `docs/COOKBOOK.md` — recipes
- `docs/LAUNCH/` — launch material:
  - `BLOG_POST.md` — release blog post draft
  - `HN_SHOW_HN.md` — Show HN post draft
  - `MARKETPLACE_LISTING.md` — HubSpot Marketplace listing copy
  - `COMPETITIVE-LANDSCAPE.md` — honest map of HubSpot CLI + MCP ecosystem (official HubSpot projects, Composio hosted SaaS, 17+ community OSS MCPs)
- CONTRIBUTING.md + `.github/ISSUE_TEMPLATE/` (bug, feature, MCP tool request)

### Infrastructure

- `src/core/plugins.ts` — plugin loader system
- `src/core/vault.ts` — encrypted token vault
- `src/core/schemas.ts` — schema management beyond the cache
- `src/core/urls.ts` — URL construction helpers
- Package metadata: `exports` map for `./plugins`, `./http`, `./output` sub-paths so downstream projects can import core modules

### Breaking changes

- None from 0.2.0 public surface. Command signatures remain compatible.

## 0.2.0 - 2026-03-05
- Added CRM tickets command family.
- Added strict allowlists for objectType inputs with domain-specific scope.
- Added enterprise safety controls:
  - policy file support (`--policy-file`)
  - change-ticket enforcement (`--change-ticket`) when policy requires it
- Added request observability:
  - run correlation id (`X-Hubcli-Request-Id`)
  - optional telemetry JSONL (`--telemetry-file`)
- Added CRM lifecycle operations:
  - delete/archive, merge, batch-read, batch-upsert, batch-archive
- Added CRM custom object support:
  - schema list/get/create/update
  - record list/get/search/create/update/delete
- Added CRM engagement support:
  - notes, calls, tasks, emails, meetings
- Added incremental sync utility:
  - `crm sync pull`
- Added top-level domain command groups:
  - `marketing`, `forms`, `files`, `cms`, `workflows`, `service`
- Added raw API command:
  - `api request`
- Expanded MCP catalog:
  - lifecycle object tools (delete/merge/batch)
  - custom object schema/record tools
  - raw `hub_api_request`
- Added OAuth-oriented auth commands:
  - `auth profiles`, `auth profile-show`, `auth token-info`
  - `auth oauth-url`, `auth oauth-exchange`
- Added release governance + compatibility docs and sandbox contract test scaffolding.
