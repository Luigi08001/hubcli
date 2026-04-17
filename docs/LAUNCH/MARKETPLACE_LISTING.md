# HubSpot Marketplace listing copy

_Category: Developer Tools_

## Name
hubcli

## Tagline (60 char max)
Rigorous HubSpot CLI + MCP server for agents and devs

## Short description (160 chars)
Open-source TypeScript CLI for HubSpot with CRUD across CRM/Marketing/CMS/Workflows, a built-in MCP server, and enterprise safety rails.

## Long description

hubcli is an open-source TypeScript CLI for HubSpot, purpose-built for two audiences:

**HubSpot admins who need programmatic control.** Full CRUD across contacts, companies, deals, tickets, custom objects, schemas, properties, pipelines, engagements, imports, marketing emails, forms, workflows, service conversations, settings, events, and communication preferences — with safety gates that prevent accidents. Every mutation is blocked behind `--force`. Enterprise teams can layer on policy files and change-ticket requirements. Token storage is 0600, and every output is scanned for secret leakage before being printed.

**AI agents that need to drive HubSpot.** hubcli ships a built-in MCP server over stdio. Point Claude Desktop, Cursor, or Claude Code at it and HubSpot becomes a set of safe, auditable tools. Profile isolation prevents cross-tenant access. The same dry-run / force / policy gates apply. Agents get capability-aware preflight (they know your tier's limits before trying a call).

### How it differs from what's already out there

- **HubSpot's official CLI (`hs`)** is scoped to CMS authoring. hubcli covers everything else.
- **HubSpot's official remote MCP server** is announced but the public repo is empty. hubcli is usable today.
- **Composio** offers a hosted SaaS MCP (connect.composio.dev/mcp) with 100+ HubSpot tools across 850+ apps. Proprietary and holds your token on their infrastructure. hubcli is the self-hosted, open source alternative for token-sovereign and enterprise-safety use cases.
- **Community MCP servers** (lkm1developer, peakmojo, naorhemed, SanketSKasar, CData, etc.) are typically MCP-first and thin. hubcli is CLI-first with MCP as a peer surface — same write gates, same redaction, same capability checks across both.

### Key features

- 150+ commands across CRM / Marketing / Service / CMS / Workflows / Settings / Account / Events / Communication Preferences
- Built-in MCP server (stdio transport, profile-isolated via `HUBCLI_MCP_PROFILE`)
- `--dry-run` / `--force` write gates on every mutation
- Policy files + change-ticket enforcement for regulated environments
- Rate-limit intelligence (reads `X-HubSpot-RateLimit-*` headers, proactive throttling)
- Capability probing with local cache (fail fast on tier-restricted endpoints)
- Schema introspection + offline validation
- Idempotency-Key on every write and batch call
- Token redaction across all output paths including errors
- Path-scope allowlisting (SSRF / traversal blocked at transport)
- Output in table / CSV / YAML / JSON
- Release artifacts include SHA256 checksums

### Install

```bash
npm install -g hubcli
hubcli auth login --token-stdin   # paste your Private App token
hubcli crm contacts list --limit 5
```

### Open source

MIT licensed. Code, docs, and issue tracker: https://github.com/Luigi08001/hubcli

hubcli is the foundation of **CRMforge**, the AI HubSpot consultant that scans, scores, and advises on portal health. If you want the diagnostic + coaching layer on top of hubcli, see https://crmforge.ai.

### Support

- GitHub Issues: https://github.com/Luigi08001/hubcli/issues
- Security reports: see SECURITY.md
- Contribution guide: CONTRIBUTING.md

## Categories
- Developer Tools
- Productivity
- Data Quality

## Tags
cli, mcp, ai-agents, automation, private-app, developer-tools, data-ops, audit, compliance
