# Why I open-sourced hubcli — the rigorous HubSpot CLI + MCP server for the agent era

_Draft — update with real numbers + tweaks before publishing on your blog / dev.to / LinkedIn._

---

## The short version

I've been building hubcli in private for six months. Today I'm open-sourcing it.

It's a TypeScript CLI for HubSpot that:
- Gives you CRUD across CRM, Marketing, Service, Workflows, CMS, Settings, Account, Events, Communication Preferences
- Ships a **built-in MCP server** — any MCP-compatible agent (Claude, Cursor, Claude Code, ChatGPT plugins) can drive HubSpot through hubcli
- Has the safety rails an enterprise admin expects: dry-run, force flags, policy files, change tickets, scope allowlisting, token redaction, origin-locked transport
- 82 tests passing, 0 vulnerabilities, SHA256 release checksums

Repo: https://github.com/Luigi08001/hubcli
npm: `npm install -g hubcli` _(publishing shortly)_

## Why another HubSpot tool?

The landscape is busy — and that's good, it means the problem space is real:

- **HubSpot's official CLI** (`@hubspot/cli`, the `hs` command) is great for CMS authoring (theme deploy, serverless functions, HubDB sync). Not designed for CRM-wide CRUD or MCP.
- **HubSpot's official MCP server repo** exists ([hubspot/mcp-server](https://github.com/hubspot/mcp-server)) but is currently empty. HubSpot has announced a remote MCP server; no public implementation to audit yet.
- **Hosted SaaS option:** [Composio](https://composio.dev/toolkits/hubspot) offers a managed HubSpot MCP at `connect.composio.dev/mcp` with 100-200+ HubSpot tools, part of their 850-app SaaS adapter platform. Proprietary, they hold your token on their infrastructure (SOC 2 Type 2).
- **Community OSS MCP servers:** [lkm1developer/hubspot-mcp-server](https://github.com/lkm1developer/hubspot-mcp-server), [peakmojo/mcp-hubspot](https://github.com/peakmojo/mcp-hubspot), [naorhemed/hubspot-mcp-server](https://github.com/naorhemed/hubspot-mcp-server), [SanketSKasar/HubSpot-MCP-Server](https://github.com/SanketSKasar/HubSpot-MCP-Server), [shinzo-labs/hubspot-mcp](https://github.com/shinzo-labs/hubspot-mcp), CData's hubspot-mcp-server, and 10+ others.

So hubcli is not "the only MCP server for HubSpot". It's the one with a different emphasis — **self-hosted, auditable, token-sovereign, enterprise-safety-first.** If you want a hosted SaaS with token refresh handled for you and cross-app orchestration, Composio is the right call. If you need self-hosting, enterprise write gates, or you're building a HubSpot-specific product like CRMforge, hubcli is the right call.

**Rigor + safety + CLI + MCP, in a single, auditable codebase.** Most of the community MCP servers are MCP-first and thin. hubcli is CLI-first with MCP as a first-class surface — meaning every tool you can call from Claude has a matching CLI command, the same write gates, the same redaction, the same path scope enforcement.

If you care about:
- Running in enterprise / regulated environments
- Audit trails (telemetry JSONL, change-ticket enforcement)
- Pre-flight capability probing (fail fast on tier-restricted endpoints)
- Idempotency-Key on every write
- Refusing paths that escape the allowed HubSpot API scopes (SSRF / traversal protection at the transport layer)
- Offline schema validation

...this is built for you. If you just need "Claude can list my 5 most recent contacts", any community MCP works fine.

## Why open source it now?

Last week Salesforce announced [Headless 360](https://venturebeat.com/ai/salesforce-launches-headless-360-to-turn-its-entire-platform-into-infrastructure-for-ai-agents) — explicitly repositioning their platform as **backend infrastructure for AI agents**. HubSpot will ship their own version of this through their remote MCP server and ongoing Breeze work. In the meantime, the community needs a **portable, auditable, agent-native interface** they can actually run, inspect, fork, and self-host today.

By open-sourcing hubcli now, the ecosystem gets a mature alternative. When HubSpot's official MCP ships, hubcli will still be relevant for the use cases it's better at: enterprise safety, CRMforge-class observability, offline-friendly workflows.

## What hubcli actually gives you

### A CLI that respects production

```bash
# Mutations are blocked unless --force is explicit
hubcli crm contacts create --data '{...}'
# Error: WRITE_GATE_BLOCKED — pass --force to execute

# --dry-run shows what would happen
hubcli --dry-run crm contacts create --data '{...}'

# Policy files + change tickets for regulated environments
hubcli --force --policy-file policy.json --change-ticket CHG-482 \
  crm contacts delete 123
```

### Rate-limit intelligence that just works

hubcli reads HubSpot's `X-HubSpot-RateLimit-*` headers and throttles proactively. No more waking up to a bricked import because your integration blew past the daily limit.

### Capability probing

```bash
hubcli doctor capabilities --refresh
```

Knows what your tier supports. Fail fast mode (`--strict-capabilities`) blocks commands that would hit a 404 or 403 based on scope limits.

### Schema introspection + offline validation

```bash
hubcli crm describe contacts --refresh-cache
hubcli crm validate contacts --offline --data '{...}'
```

Local schema cache means you can validate payloads without hitting HubSpot.

### Built-in MCP server with profile isolation

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "hubcli": {
      "command": "hubcli",
      "args": ["mcp"],
      "env": { "HUBCLI_MCP_PROFILE": "default" }
    }
  }
}
```

The `HUBCLI_MCP_PROFILE` env var is important — it locks the MCP server to a single auth profile. Even if the LLM tries to pass a different profile at tool-call time, the server refuses. This prevents cross-tenant access in a multi-profile setup.

All CLI safety rails apply to MCP calls. Secrets are redacted from every tool response.

## Security model

If you're going to hand a private app token to any software, these are the things you want:

- **Token storage:** profile-based auth file, 0o700 dir, 0o600 file. Never in process args (prefer `--token-stdin`).
- **Redaction:** Bearer tokens, HubSpot private-app token patterns, and a list of sensitive keywords are stripped from stdout, stderr, and error traces.
- **Path scope allowlisting:** requests can only hit approved API roots. A misconfigured path that would escape to another domain or traverse up is rejected at the transport level.
- **Write gates:** no mutation without `--force` (or `--dry-run` which simulates). Optional policy files + change tickets layer on top.
- **Origin-locked:** transport only talks to `api.hubapi.com`. Can't be tricked into SSRF-ing.
- **Idempotency:** every write / batch includes an `Idempotency-Key` for replay-safe retries.

Full threat model: [SECURITY.md](https://github.com/Luigi08001/hubcli/blob/main/SECURITY.md).

## What's next

hubcli is the foundation for [CRMforge](https://crmforge.ai), the AI HubSpot consultant I'm building in parallel. CRMforge uses hubcli as its backend — scanning portals, running a 53-check scoring engine, surfacing fixes, and letting Claude drive live queries against your HubSpot through the MCP server.

If you're building HubSpot tooling, try hubcli. PRs welcome. Issues welcome. Security reports especially welcome.

---

**Links**
- GitHub: https://github.com/Luigi08001/hubcli
- Docs: [README.md](https://github.com/Luigi08001/hubcli/blob/main/README.md)
- MCP setup: [docs/MCP.md](https://github.com/Luigi08001/hubcli/blob/main/docs/MCP.md)
- Security: [SECURITY.md](https://github.com/Luigi08001/hubcli/blob/main/SECURITY.md)
- Changelog: [CHANGELOG.md](https://github.com/Luigi08001/hubcli/blob/main/CHANGELOG.md)
