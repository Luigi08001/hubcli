# hubcli

[![CI](https://github.com/revfleet/hscli/actions/workflows/ci.yml/badge.svg)](https://github.com/revfleet/hscli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@revfleet/hscli.svg)](https://www.npmjs.com/package/@revfleet/hscli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node: >=20](https://img.shields.io/badge/Node-%3E%3D20-brightgreen)](package.json)
[![HubSpot API coverage: 100%](https://img.shields.io/badge/HubSpot%20API-100%25%20(1180%20endpoints)-7c3aed)](docs/TIERS.md)

**The headless HubSpot CLI + MCP server. 100% public API coverage (1,180 endpoints, 55+ command domains), enterprise safety rails, self-hosted.**

## Get started in 30 seconds

```bash
# 1. Install
npm install -g @revfleet/hscli

# 2. Auth with a HubSpot Private App token (create one at
#    Settings → Integrations → Private Apps → Create private app)
printf '%s' 'pat-eu1-XXXX-XXXX-XXXX' | hscli auth login --token-stdin

# 3. Read
hscli crm contacts list --limit 5

# 4. Write (dry-run by default, --force to execute)
hscli --force crm contacts create --data '{"properties":{"email":"jane@example.com"}}'

# 5. Run as an MCP server for Claude Desktop, Cursor, Claude Code
hscli mcp
```

That's the whole thing. For the full picture of what's available, read on.

---

<details>
<summary><strong>Full coverage map (55+ domains)</strong></summary>

hubcli gives you one TypeScript binary that covers **every** endpoint of HubSpot's public API surface — verified against a scrape of HubSpot's own dev docs (1,178 source files, 1,180 endpoints). Whether an endpoint actually returns data on *your* portal depends on the HubSpot tier you're on (see [docs/TIERS.md](docs/TIERS.md)). hubcli exposes them all.

- **Full CRM** — contacts, companies, deals, tickets, leads, quotes, products, line items, orders, carts, discounts, fees, taxes, invoices, subscriptions, payments, goals, communications, users, feedback-submissions, custom objects, properties (+ legacy v1/v2), pipelines, associations v4 (+ labels CRUD + dated 2025-09), owners, imports, exports, engagements (notes/tasks/calls/meetings), sync, describe/validate, timeline, CRM Cards (UI Extensions), filter + count primitives on every object
- **Marketing** — emails (v3 + legacy v1, per-email stats), campaigns, ads, social, SEO, landing pages, transactional, subscriptions, events (+ attendance + participations), behavioral events, forms, form integrations, legacy email events stream (per-recipient)
- **Sales** — sequences (+ enroll/unenroll), meetings, calling, goals, scheduler (meeting links, book/reschedule/cancel), sales extensions (videoconferencing, accounting)
- **Service** — conversations (threads, messages, inboxes, channels, channel-accounts, actors, custom-channels), feedback, chatflows, knowledge-base, ticket pipelines, visitor-identification
- **CMS** — site pages, landing pages (+ folders), blog posts (+ authors + tags + blog-settings), HubDB (tables, rows, drafts, publishing), URL redirects, source-code, domains, SEO audit, site search, topics, audit-logs, comments, legacy content/api/v2 (Pages, Layouts, Templates, Modules, UrlMappings)
- **Settings** — users, teams, business units, currencies, GDPR, audit-logs, communication preferences (v3 + v4 batch)
- **Account** — info, audit-logs, private-apps, API usage
- **Operations** — lists (+ folders + memberships), reporting, exports, workflows (v4 + legacy v2/v3), automation custom actions, webhooks (subscriptions), timeline (templates + events + integrators)
- **Commerce Hub** — quotes, products, line-items, invoices, subscriptions, payments, orders, carts, discounts, fees, taxes, payments-subscriptions, tax rates
- **Developer Platform** — feature flags, CRM cards, integrators timeline, media bridge (properties + schemas + settings + events), extensions (calling + videoconferencing + accounting + sales)
- **Legacy v1/v2** — contacts-v1, companies-v2, deals-v1, owners-v2, engagements-v1, properties-legacy, reports-v2, calling-v1, channels, broadcast, appinstalls, marketing-emails-v1
- **Niche** — email events, email events per-recipient stream, submissions, visitor-identification, scheduler, tax, appinstalls, marketing-extras, owners-extras
- **Raw API** command with path-scope controls + OAuth flow support
- **Built-in MCP server** over stdio (140+ tools) for Claude Desktop, Cursor, Claude Code, any MCP client

Enterprise-grade from day one: `--dry-run`, `--force`, policy files, change tickets, capability probing, rate-limit intelligence, token redaction, path scope allowlisting, idempotency keys.

</details>


## How it compares

The HubSpot CLI + MCP space is crowded:

- **[HubSpot's official CLI](https://github.com/HubSpot/hubspot-cli)** (`@hubspot/cli`, `hs`) — scoped to CMS authoring (themes, serverless, HubDB sync). Complementary, not competing.
- **[HubSpot's official MCP server](https://github.com/hubspot/mcp-server)** — public repo exists but empty as of writing. Remote MCP service announced.
- **[Composio](https://composio.dev/toolkits/hubspot)** — hosted SaaS MCP at `connect.composio.dev/mcp`, part of their 850-app adapter platform. Proprietary, they hold your token on their infra (SOC 2 Type 2).
- **Community OSS MCP servers** — [peakmojo/mcp-hubspot](https://github.com/peakmojo/mcp-hubspot), [lkm1developer/hubspot-mcp-server](https://github.com/lkm1developer/hubspot-mcp-server), [shinzo-labs/hubspot-mcp](https://github.com/shinzo-labs/hubspot-mcp), [CData's hubspot-mcp-server](https://github.com/CDataSoftware/hubspot-mcp-server-by-cdata), and ~15 others on GitHub.

hubcli's emphasis:

1. **CLI-first with MCP as a peer surface.** Every MCP tool has a matching `hubcli` command — same write gates, same redaction, same capability probing in both.
2. **Self-hosted and token-sovereign.** Your HubSpot private app token never leaves your machine. Contrast with Composio.
3. **Enterprise safety gates.** `--dry-run`, `--force`, policy files, change tickets, path scope allowlisting, idempotency keys. Most community MCP servers don't have these.
4. **HubSpot-native engineering.** Reads HubSpot's `X-HubSpot-RateLimit-*` headers, proactive throttling, capability probing by `portalId + scopes`, offline schema validation, idempotency-key on every write.
5. **Used in production.** Powers [CRMforge](https://crmforge.ai), the AI HubSpot consultant.

Full landscape: [docs/LAUNCH/COMPETITIVE-LANDSCAPE.md](docs/LAUNCH/COMPETITIVE-LANDSCAPE.md).

## "100% coverage" — what that means

hubcli's coverage claim is precise: **every one of HubSpot's 1,180 documented public API endpoints has a corresponding CLI subcommand.** This is verified against an automated scrape of HubSpot's developer documentation (committed at [docs/TESTING/PORTAL-147975758-COVERAGE.md](docs/TESTING/PORTAL-147975758-COVERAGE.md) and [PORTAL-147975758-WRITES.md](docs/TESTING/PORTAL-147975758-WRITES.md)).

It does **not** mean every endpoint returns 2xx on your portal — HubSpot tier-locks hundreds of endpoints behind paid plans:

| Portal profile | Reachable endpoints (read + write) |
|---|---:|
| Free account | ~550 / 1180 (46.6%) |
| Starter hubs | ~640 / 1180 (54.2%) |
| Professional hubs | ~890 / 1180 (75.4%) |
| Enterprise hubs (all) + Commerce + Ops | ~1140 / 1180 (96.6%) |
| Developer App OAuth install | adds ~30 app-dev endpoints |
| Legacy hapikey (pre-June-2023 accounts) | adds ~40 zombie endpoints |

See [docs/TIERS.md](docs/TIERS.md) for the exact endpoint → tier mapping.

**If an endpoint your portal should access doesn't work**, open an [endpoint issue](https://github.com/revfleet/hscli/issues/new?template=endpoint_not_working.md) — we triage these fast.

## Install

From npm (once published):

```bash
npm install -g @revfleet/hscli
```

From source:

```bash
git clone https://github.com/revfleet/hscli.git
cd hubcli
npm install
npm run build
```

## Quickstart

Save a token (recommended — avoids shell history):

```bash
printf '%s' '<HUBSPOT_PRIVATE_APP_TOKEN>' | hscli auth login --token-stdin
```

Inline token (also supported):

```bash
hscli auth login --token <HUBSPOT_PRIVATE_APP_TOKEN>
```

Read:

```bash
hscli crm contacts list --limit 5
hscli marketing emails stats 123456
hubcli sales sequences list
hubcli reporting dashboards list
hscli settings teams list
```

Dry-run write:

```bash
hscli --dry-run crm contacts create --data '{"properties":{"email":"test@example.com"}}'
```

Live write (explicit):

```bash
hscli --force crm contacts create --data '{"properties":{"email":"test@example.com"}}'
```

Policy-guarded delete with change ticket:

```bash
hscli --force --policy-file docs/POLICY_EXAMPLE.json --change-ticket CHG-123 \
  crm contacts delete 123
```

## Output modes

```bash
hscli --json crm companies list --limit 3           # JSON envelope
hscli --format csv crm contacts list --limit 5      # CSV
hscli --format yaml crm deals get 123               # YAML
```

## MCP: AI agents as first-class consumers

hubcli ships a built-in MCP server over stdio with ~125 tools exposing the full surface:

```bash
hscli mcp
```

For Claude Desktop, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hubcli": {
      "command": "hubcli",
      "args": ["mcp"],
      "env": {
        "HUBCLI_MCP_PROFILE": "default"
      }
    }
  }
}
```

Restart Claude. Now Claude can list contacts, search deals, inspect workflows, and — with `--force` passed at tool-call time — perform safe writes. All CLI safety rails apply to MCP calls. Secrets are redacted from every tool response. `HUBCLI_MCP_PROFILE` locks the stdio server to one auth profile to prevent cross-tenant access.

See [docs/MCP.md](docs/MCP.md) for the full tool catalog.

## Capability / tier awareness

Probe portal capabilities and cache them by `portalId + scopes`:

```bash
hubcli doctor capabilities --refresh
```

Fail fast when a command hits an unsupported endpoint:

```bash
hscli --strict-capabilities marketing emails list
```

## Schema introspection + offline validation

```bash
hscli crm describe contacts --refresh-cache
hscli crm validate contacts --offline --data '{"properties":{"email":"x@example.com"}}'
```

Local schema cache means you can validate payloads without hitting HubSpot.

## Runtime safety model

- Mutations are **blocked** unless `--force` is passed (or intercepted by `--dry-run`)
- Write/delete can be constrained by policy (`--policy-file`) and change-ticket enforcement
- Requests are origin-locked to `https://api.hubapi.com` and restricted to approved API path roots
- Path segments are hardened against traversal / control characters
- Output and error payloads are redacted for secrets and token-like strings
- Transport retries transient failures with exponential backoff
- Rate-limit controller reads `X-HubSpot-RateLimit-*` headers and throttles proactively
- All write / batch methods include `Idempotency-Key` for replay-safe retries

Full threat model: [SECURITY.md](SECURITY.md).

## Caches

Under `HUBCLI_HOME` (default: `~/.hubcli`):

- `auth.json` — profile tokens (0600 permissions, 0700 directory)
- `capabilities.json` — portal/tier capability cache
- `schema-cache.json` — CRM schema cache for describe/validate
- `auth.enc` — optional encrypted vault (when passphrase is set)

## Documentation

- [docs/COMMAND_TREE.md](docs/COMMAND_TREE.md) — full command surface
- [docs/WHY_HOW_WHAT.md](docs/WHY_HOW_WHAT.md) — design philosophy
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/SAFETY_MODEL.md](docs/SAFETY_MODEL.md)
- [docs/MCP.md](docs/MCP.md) — MCP server tool catalog
- [docs/TESTING_PLAN.md](docs/TESTING_PLAN.md)
- [docs/RELEASE_GOVERNANCE.md](docs/RELEASE_GOVERNANCE.md)
- [docs/PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md) — writing plugins
- [docs/OPERATIONAL_PLAYBOOKS.md](docs/OPERATIONAL_PLAYBOOKS.md)
- [docs/COOKBOOK.md](docs/COOKBOOK.md) — common recipes
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
- [CHANGELOG.md](CHANGELOG.md)

### Domain setup guides

- [docs/PORTAL_SETUP.md](docs/PORTAL_SETUP.md)
- [docs/CMS_SETUP.md](docs/CMS_SETUP.md)
- [docs/COMMERCE_SETUP.md](docs/COMMERCE_SETUP.md)
- [docs/MARKETING_SETUP.md](docs/MARKETING_SETUP.md)
- [docs/SALES_SETUP.md](docs/SALES_SETUP.md)
- [docs/SERVICE_SETUP.md](docs/SERVICE_SETUP.md)
- [docs/OPERATIONS_SETUP.md](docs/OPERATIONS_SETUP.md)
- [docs/REPORTING_SETUP.md](docs/REPORTING_SETUP.md)
- [docs/INTEGRATIONS_NOTIFICATIONS_SETUP.md](docs/INTEGRATIONS_NOTIFICATIONS_SETUP.md)

## Verification

Full release check:

```bash
npm run release:verify
```

Runs typecheck + lint + tests + audit + build + SHA256 checksum verification.

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, coding standards, and how to run contract tests against a sandbox portal.

## License

MIT — see [LICENSE](LICENSE).

---

**Built as the foundation for [CRMforge](https://crmforge.ai)**, the AI HubSpot consultant. hubcli is open source so the ecosystem can build on it.
