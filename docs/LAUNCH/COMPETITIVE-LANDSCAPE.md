# hubcli — Competitive landscape

_Last updated: 2026-04-17_

This is an honest map of the HubSpot CLI + MCP + agent-integration space. hubcli is one of many. Our job is to be clear about where we fit.

---

## CLI

| Project | Scope | Status | vs hubcli |
|---|---|---|---|
| [HubSpot/hubspot-cli](https://github.com/HubSpot/hubspot-cli) | CMS authoring (themes, serverless, HubDB sync) | Official, public, marked read-only (active dev internal) | Different scope. `hs` = CMS, hubcli = everything else. Complementary. |
| [HubSpot/local-cms-server-cli](https://github.com/HubSpot/local-cms-server-cli) | Local CMS dev server | Official, older | Not a competitor. Niche CMS dev tool. |
| [HubSpot/cli-lib](https://github.com/HubSpot/cli-lib) | Shared library | Internal lib, not a standalone CLI | Not a competitor. |
| **hubcli** (us) | Full CRM + Marketing + Service + Settings + Workflows + Account + MCP | MIT, active, 0.3.0 | — |

**Verdict:** There is no other serious HubSpot generalist CLI. hubcli is alone in that slot — and the official CLI explicitly doesn't cover that scope.

---

## MCP servers for HubSpot

The MCP space is crowded. As of April 2026, visible GitHub projects include:

- **Official (announced, repo exists):** [hubspot/mcp-server](https://github.com/hubspot/mcp-server) — public repo, empty as of this audit. HubSpot has communicated about a remote MCP server in recent releases.
- **Hosted SaaS adapter:** [Composio HubSpot MCP](https://composio.dev/toolkits/hubspot/framework/codex) — managed MCP endpoint at `connect.composio.dev/mcp`. 100-200+ HubSpot tools exposed. Proprietary, not open source. Token stored on Composio's infrastructure. SOC 2 Type 2.
- **Community OSS MCP servers:**
  - [peakmojo/mcp-hubspot](https://github.com/peakmojo/mcp-hubspot)
  - [lkm1developer/hubspot-mcp-server](https://github.com/lkm1developer/hubspot-mcp-server)
  - [SanketSKasar/HubSpot-MCP-Server](https://github.com/SanketSKasar/HubSpot-MCP-Server)
  - [naorhemed/hubspot-mcp-server](https://github.com/naorhemed/hubspot-mcp-server)
  - [scopiousdigital/hubspot-mcp](https://github.com/scopiousdigital/hubspot-mcp)
  - [v4lheru/hubspot-mcp](https://github.com/v4lheru/hubspot-mcp)
  - [shinzo-labs/hubspot-mcp](https://github.com/shinzo-labs/hubspot-mcp)
  - [sheffieldp/hubspot_mcp](https://github.com/sheffieldp/hubspot_mcp)
  - [CDataSoftware/hubspot-mcp-server-by-cdata](https://github.com/CDataSoftware/hubspot-mcp-server-by-cdata)
  - [smithery-ai/hubspot_new_mcp_server](https://github.com/smithery-ai/hubspot_new_mcp_server)
  - [yespark/mcp-hubspot](https://github.com/yespark/mcp-hubspot)
  - [HexaMCP/HubSpot](https://github.com/HexaMCP/HubSpot)
  - [bajwa61/hubspot-mcp-server](https://github.com/bajwa61/hubspot-mcp-server)
  - [Shameerpc5029/hubspot-mcp](https://github.com/Shameerpc5029/hubspot-mcp)
  - [ampcome-mcps/hubspot-mcp](https://github.com/ampcome-mcps/hubspot-mcp)
  - [ajaystream/hubspot-mcp-custom](https://github.com/ajaystream/hubspot-mcp-custom)

These are a mix of mature and experimental. Most are MCP-first (thin wrappers around HubSpot API surfaces). None that we've inspected have the full CLI + safety gate combination.

---

## Where hubcli fits

hubcli isn't "the first" or "the only". It's the one with a specific emphasis:

### 1. CLI-first with MCP as a peer surface
Every MCP tool has a matching `hubcli` command. Same write gates, same redaction, same capability probing apply in both modes. Other MCP servers are MCP-only; you lose them the moment you need a shell script.

### 2. Self-hosted, auditable, MIT
Your HubSpot private app token never leaves your machine. Contrast with Composio, which stores your token on their infrastructure (they're SOC 2, but it's still their infra). For regulated environments, MSPs managing multiple portals, or anyone who reads SECURITY.md before installing — this matters.

### 3. Enterprise safety gates
No mutation without `--force`. Optional `--policy-file` for role-based write rules. Optional `--change-ticket` requirement for auditable change control. Path scope allowlisting rejects misconfigured requests at the transport layer, not just the CLI wrapper. Idempotency-Key on every write for replay-safe retries.

Most community MCP servers don't have any of this. Composio has some audit logging in their dashboard but not the client-side enforcement of the same guarantees.

### 4. HubSpot-native engineering
- Reads HubSpot's own `X-HubSpot-RateLimit-*` headers and throttles proactively
- Capability probing by `portalId + scopes`, cached locally — knows what your tier supports before hitting a 404
- Schema introspection with offline validation
- Token redaction tuned for HubSpot's specific token formats

### 5. Backbone for CRMforge
hubcli is the foundation of [CRMforge](https://crmforge.ai) — the AI HubSpot consultant doing portal scoring, remediation guidance, benchmarks, and governance audits. Hosted MCPs don't give us the substrate we need for that; self-hosted open source does.

---

## Honest boundaries

hubcli is **not the right fit** if:

- You want a managed SaaS with OAuth refresh handled for you → **Composio or HubSpot's remote MCP** (when it ships) are better
- You only need Claude to list 5 contacts → **any community MCP works**
- You want 850 app integrations, not just HubSpot → **Composio's breadth wins**

hubcli **is the right fit** if:

- You want enterprise safety gates + auditable writes
- You need CLI + MCP in one tool
- You're building HubSpot-specific tooling (CRMforge, agency tools, custom audit pipelines)
- You care about token sovereignty and self-hosting
- You want to read, fork, or contribute to the codebase

---

## CRMforge's positioning — above this layer

hubcli is one of many ways to *talk to* HubSpot. **CRMforge is the layer that tells you whether your HubSpot is healthy, what's broken, and what to fix next.**

That's not a connector problem. It's a diagnostic + governance problem, and the competitive set is very different:
- HubSpot's Data Quality Command Center (native but shallow)
- Insycle (data ops — dedup, cleanup)
- Consulting firms (k-k engagements)
- Portal-iQ, Audit Fox, Boundary, DiffSpot, Webalite (audit tools)

CRMforge's moat:
- 53-rule scoring engine across 8 modules
- Read-capability multi-module (not just CRM)
- Industry benchmarks
- Audit-trail governance (AI + permission posture)
- Tomorrow: guided remediation

**The positioning isn't "we're the only MCP for HubSpot".** It's:
- **hubcli** = the most rigorous, self-hosted HubSpot CLI + MCP for operators and AI agents
- **CRMforge** = the audit intelligence + ops layer most useful above HubSpot
