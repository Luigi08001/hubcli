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
