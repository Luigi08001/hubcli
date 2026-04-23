<p align="center">
  <img src="brand/readme-hero.svg" alt="hscli — agentic HubSpot CLI + MCP server" width="100%">
</p>

<p align="center">
  <strong>Your HubSpot portal, in one binary.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@revfleet/hscli"><img src="https://img.shields.io/npm/v/@revfleet/hscli.svg?style=flat-square&color=22D3EE&labelColor=0F172A" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-22D3EE?style=flat-square&labelColor=0F172A" alt="MIT"></a>
  <a href="docs/TIERS.md"><img src="https://img.shields.io/badge/HubSpot%20API-1%2C180%20endpoints-22D3EE?style=flat-square&labelColor=0F172A" alt="1,180 HubSpot endpoints"></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/revfleet/hscli/main/docs/demo-hubspot.gif" alt="hscli writing into a HubSpot portal in real time — records appear in the UI as hscli creates them" width="100%">
</p>

<p align="center">
  <sub>↳ Live tour · terminal writes, HubSpot reflects · ~60s on a real portal.</sub>
</p>

---

## Why

1,180 HubSpot endpoints, one TypeScript binary. Every write blocked unless you explicitly `--force` it. Every request auditable. Token stays on your machine. MCP-ready for Claude Desktop, Cursor, and any agent that speaks the protocol.

No SaaS middleman, no proprietary dashboard, no "download the CLI, then also install the desktop app". Just a CLI that respects production.

## Install & auth

```bash
npm install -g @revfleet/hscli
printf '%s' 'pat-eu1-XXXX-XXXX-XXXX' | hscli auth login --token-stdin
hscli crm contacts list --limit 5
```

Create a Private App token at **Settings → Integrations → Private Apps → Create private app** in your HubSpot portal.

## Write safely

```bash
# Blocked — writes need explicit intent
hscli crm contacts create --data '{"properties":{"email":"jane@acme.com"}}'
# → WRITE_CONFIRMATION_REQUIRED

# Preview what the call would look like
hscli --dry-run crm contacts create --data '{"properties":{"email":"jane@acme.com"}}'

# Execute — with an Idempotency-Key baked in automatically
hscli --force crm contacts create --data '{"properties":{"email":"jane@acme.com"}}'
```

Policy file + change-ticket enforcement for ops teams:

```bash
hscli --force --policy-file ./policy.json --change-ticket CHG-123 \
  crm contacts delete 123
```

## Run as an MCP server

Drop `hscli` into any MCP client — Claude Desktop, Cursor, Claude Code, or your own agent runtime.

```bash
hscli mcp
```

For Claude Desktop, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hscli": {
      "command": "hscli",
      "args": ["mcp"],
      "env": { "HSCLI_MCP_PROFILE": "default" }
    }
  }
}
```

The MCP server exposes three tool families:

- **Per-object tools** — `crm_contacts_list`, `crm_deals_create`, `crm_custom_records_search`, …
- **HubSpot Remote MCP compat** — same tool names as `mcp.hubspot.com` (`search_crm_objects`, `manage_crm_objects`, …) so agents built for HubSpot's hosted MCP drop in without changes
- **Extension surface** — workflows, files, forms, webhooks, HubDB, conversations, and more, all with the same `--force` + policy gates as the CLI

Every MCP tool call goes through the same safety rails as the CLI. Token redaction is enforced on every response. `HSCLI_MCP_PROFILE` locks the stdio server to one auth profile to prevent cross-tenant access.

## Observability

```bash
hscli trace start                          # start recording every request
hscli --force crm contacts create …        # → appends to the trace JSONL
hscli trace stop

hscli trace stats ./trace-*.jsonl          # p50/p95/p99 latency, method breakdown
hscli trace diff  ./run-a.jsonl ./run-b.jsonl   # spot reproducibility drift
hscli audit writes --since 24h             # who wrote what, when
hscli audit by-tool                        # per-MCP-tool call count + error rate
```

Every request hscli makes is append-only JSONL. Pair `trace` with `audit` for full "who did what when" provenance — no extra infrastructure required.

## What's in the box

<details>
<summary><strong>Surface coverage</strong> — click to expand</summary>

- **CRM** — contacts, companies, deals, tickets, leads, quotes, products, line items, orders, carts, discounts, fees, taxes, invoices, subscriptions, payments, goals, communications, users, custom objects, properties, pipelines, associations v4, owners, imports, exports, engagements, sync, describe/validate, timeline, CRM Cards
- **Marketing** — emails (v3 + legacy v1), campaigns, ads, social, SEO, landing pages, transactional, subscriptions, events, behavioral events, forms
- **Sales** — sequences, meetings, calling, scheduler, sales extensions
- **Service** — conversations, feedback, chatflows, knowledge-base, ticket pipelines, visitor-identification
- **CMS** — site/landing/blog pages, HubDB, URL redirects, source-code, domains, SEO audit
- **Settings** — users, teams, business units, currencies, GDPR, audit-logs, communication preferences
- **Operations** — lists, reporting, exports, workflows (v4 + legacy), automation, webhooks, timeline
- **Commerce Hub** — quotes, products, line-items, invoices, subscriptions, payments, orders, carts, taxes
- **Developer Platform** — feature flags, CRM cards, integrators timeline, media bridge, extensions
- **Legacy v1/v2** — every pre-v3 surface preserved for portals that still need them
- **Raw API** command with path-scope controls + full OAuth flow support

Enterprise defaults: `--dry-run`, `--force`, policy files, change tickets, capability probing, rate-limit intelligence, token redaction, path scope allowlisting, idempotency keys on every write.

</details>

### What "1,180 endpoints" means

hscli covers **~all** of HubSpot's documented public API endpoints — a CLI subcommand or MCP tool per endpoint, verified against an automated scrape of HubSpot's developer documentation. A small residue stays out of reach because it's UI-only, deprecated, or requires a developer-app auth model rather than a private-app bearer token; see [docs/CAPABILITY_LIBRARY.md](docs/CAPABILITY_LIBRARY.md) for the ❌/⚠️/✅ matrix.

Even within the reachable set, actual 2xx responses on your portal depend on:

- **Tier/plan gates** — hundreds of endpoints are locked to Marketing/Sales/Service/CMS/Ops/Commerce Pro/Enterprise or add-ons.
- **Scope gates** — the private-app token must carry the right scopes; some scopes have no public endpoint surface.
- **Auth-model gates** — a subset (developer-platform, app-install) require a Developer Account + `appId` + developer API key, not a bearer token.
- **Deprecated surfaces** — HubDB v2, CMS performance, legacy ecommerce bridge, accounting extension, marketing calendar etc. are shipped for continuity but HubSpot may 4xx them.
- **UI-only surfaces** — chatflow decision trees, SLA policies, quote e-signature, social-inbox reactions, scoring formulas and similar authoring flows have no public endpoint (covered in the library as ❌ hard-locks).

HubSpot's own tier map, projected onto hscli's surface:

| Portal profile | Reachable endpoints |
|---|---:|
| Free | ~550 / 1,180 (47%) |
| Starter | ~640 / 1,180 (54%) |
| Professional | ~890 / 1,180 (75%) |
| Enterprise (all hubs) + Commerce + Ops | ~1,140 / 1,180 (97%) |

Exact endpoint → tier mapping in [docs/TIERS.md](docs/TIERS.md).

## Design principles

1. **CLI-first, MCP as a peer.** Every MCP tool has a matching `hscli` command — same write gates, same redaction, same capability probing in both.
2. **Self-hosted, token-sovereign.** Your HubSpot private app token stays on your machine. No telemetry, no phone-home.
3. **Safe by default.** Mutations are blocked unless `--force` is explicit. `--dry-run` previews every write. Idempotency-Key on every mutation.
4. **HubSpot-native.** Reads `X-HubSpot-RateLimit-*` headers, throttles proactively, caches capabilities by `portalId + scopes`, validates payloads offline.

## Output modes

```bash
hscli --json crm companies list --limit 3          # JSON envelope
hscli --format csv crm contacts list --limit 5     # CSV
hscli --format yaml crm deals get 123              # YAML
hscli --format table crm contacts list --limit 5   # table (default)
```

## Terminal session

The HubSpot-UI recording at the top shows the *outcome*. Here's the *cause* — the same fixture built and torn down entirely from the shell:

<p align="center">
  <img src="https://raw.githubusercontent.com/revfleet/hscli/main/docs/demo-terminal.gif" alt="hscli terminal walkthrough — blank → create → associate → read → update → archive → blank" width="100%">
</p>

[Source script](https://github.com/revfleet/hscli/blob/main/scripts/demo.sh) · [recording config](https://github.com/revfleet/hscli/blob/main/scripts/demo.tape) · [how the recordings are made](https://github.com/revfleet/hscli/blob/main/scripts/README.md)

## Caches

Under `HSCLI_HOME` (default: `~/.revfleet`):

- `auth.json` — profile tokens (0600, in a 0700 directory)
- `auth.enc` — optional encrypted vault when `HSCLI_VAULT_PASSPHRASE` is set
- `capabilities.json` — portal/tier capability cache
- `schema-cache.json` — CRM schema cache for describe / validate
- `trace-session.json` + `trace-*.jsonl` — active trace + recorded sessions

## Documentation

- [docs/COMMAND_TREE.md](docs/COMMAND_TREE.md) — full command surface
- [docs/COMPARISON.md](docs/COMPARISON.md) — MCP tool families, CLI groups, coverage, safety, observability
- [docs/MCP.md](docs/MCP.md) — MCP server tool catalog
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/SAFETY_MODEL.md](docs/SAFETY_MODEL.md) · [docs/WHY_HOW_WHAT.md](docs/WHY_HOW_WHAT.md)
- [docs/ROADMAP-DATE-BASED-API.md](docs/ROADMAP-DATE-BASED-API.md) — HubSpot's `/YYYY-MM/` migration plan
- [docs/PLUGIN_GUIDE.md](docs/PLUGIN_GUIDE.md) — writing plugins
- [docs/COOKBOOK.md](docs/COOKBOOK.md) — recipes
- [docs/PUBLISHING.md](docs/PUBLISHING.md) — release runbook (maintainers)
- [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [CHANGELOG.md](CHANGELOG.md)

Domain setup guides: [PORTAL](docs/PORTAL_SETUP.md) · [CMS](docs/CMS_SETUP.md) · [Commerce](docs/COMMERCE_SETUP.md) · [Marketing](docs/MARKETING_SETUP.md) · [Sales](docs/SALES_SETUP.md) · [Service](docs/SERVICE_SETUP.md) · [Operations](docs/OPERATIONS_SETUP.md) · [Reporting](docs/REPORTING_SETUP.md) · [Integrations & Notifications](docs/INTEGRATIONS_NOTIFICATIONS_SETUP.md)

Tutorials: [secure agent writes](docs/TUTORIALS/secure-agent-writes.md) · [audit portal writes](docs/TUTORIALS/audit-portal-writes.md) · [trace + replay](docs/TUTORIALS/trace-replay-repro.md)

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, coding standards, and live-portal contract tests.

## License

MIT — see [LICENSE](LICENSE).
