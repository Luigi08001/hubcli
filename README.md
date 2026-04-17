# hubcli

[![CI](https://github.com/Luigi08001/hubcli/actions/workflows/ci.yml/badge.svg)](https://github.com/Luigi08001/hubcli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/hubcli.svg)](https://www.npmjs.com/package/hubcli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node: >=20](https://img.shields.io/badge/Node-%3E%3D20-brightgreen)](package.json)
[![HubSpot API coverage: 95%+](https://img.shields.io/badge/HubSpot%20API-95%25%2B-7c3aed)](docs/COMMAND_TREE.md)

**A production-grade HubSpot CLI + MCP server — 25 command domains, 125+ MCP tools, enterprise safety rails, self-hosted.**

hubcli gives you one TypeScript binary that covers ~95% of HubSpot's public API surface:

- **Full CRM** — contacts, companies, deals, tickets, quotes, products, line items, goals, payments, invoices, subscriptions, custom objects, properties, pipelines, associations, owners, imports, engagements, sync, describe/validate
- **Marketing** — emails (with per-email stats), campaigns, ads, social, SEO, landing pages, transactional, subscriptions, events, behavioral events
- **Sales** — sequences, meetings, calling, goals
- **Service** — conversations, feedback, chatflows, knowledge-base, pipelines, automation, tickets
- **CMS** — HubDB, redirects, site-search, landing pages, domains
- **Settings** — users, teams, business units, currencies, GDPR, audit-logs
- **Account** — info, audit-logs, private-apps, API usage
- **Operations** — lists, reporting, exports, workflows, automation, webhooks, timeline
- **Communication preferences**, **conversations**, **events**, **site-search**, **domains**
- **Raw API** command with path-scope controls
- **Built-in MCP server** over stdio (125+ tools) for Claude Desktop, Cursor, Claude Code, any MCP client

Enterprise-grade from day one: `--dry-run`, `--force`, policy files, change tickets, capability probing, rate-limit intelligence, token redaction, path scope allowlisting, idempotency keys.

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

## Install

From npm (once published):

```bash
npm install -g hubcli
```

From source:

```bash
git clone https://github.com/Luigi08001/hubcli.git
cd hubcli
npm install
npm run build
```

## Quickstart

Save a token (recommended — avoids shell history):

```bash
printf '%s' '<HUBSPOT_PRIVATE_APP_TOKEN>' | hubcli auth login --token-stdin
```

Inline token (also supported):

```bash
hubcli auth login --token <HUBSPOT_PRIVATE_APP_TOKEN>
```

Read:

```bash
hubcli crm contacts list --limit 5
hubcli marketing emails stats 123456
hubcli sales sequences list
hubcli reporting dashboards list
hubcli settings teams list
```

Dry-run write:

```bash
hubcli --dry-run crm contacts create --data '{"properties":{"email":"test@example.com"}}'
```

Live write (explicit):

```bash
hubcli --force crm contacts create --data '{"properties":{"email":"test@example.com"}}'
```

Policy-guarded delete with change ticket:

```bash
hubcli --force --policy-file docs/POLICY_EXAMPLE.json --change-ticket CHG-123 \
  crm contacts delete 123
```

## Output modes

```bash
hubcli --json crm companies list --limit 3           # JSON envelope
hubcli --format csv crm contacts list --limit 5      # CSV
hubcli --format yaml crm deals get 123               # YAML
```

## MCP: AI agents as first-class consumers

hubcli ships a built-in MCP server over stdio with ~125 tools exposing the full surface:

```bash
hubcli mcp
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
hubcli --strict-capabilities marketing emails list
```

## Schema introspection + offline validation

```bash
hubcli crm describe contacts --refresh-cache
hubcli crm validate contacts --offline --data '{"properties":{"email":"x@example.com"}}'
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
