# Changelog

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
