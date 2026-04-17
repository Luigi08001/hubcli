# Show HN draft

_Title (honest + specific):_
- **Show HN: hubcli – a rigorous HubSpot CLI with a built-in MCP server**

_Alternative if we want to lean on the safety angle:_
- Show HN: hubcli – HubSpot CLI + MCP server with production-grade safety rails

---

**Body:**

I've been building hubcli in private for six months. It's a TypeScript CLI for HubSpot with CRUD across the full API surface (CRM, Marketing, CMS, Workflows, Service, Settings, Account, Events, Communication Preferences) and a built-in MCP server over stdio so any MCP-compatible agent can use HubSpot natively.

**Why another one?** The HubSpot MCP space has several community implementations (lkm1developer, peakmojo, naorhemed, SanketSKasar, shinzo-labs, CData, and 10+ others). Composio offers a hosted SaaS MCP at connect.composio.dev/mcp with 100+ HubSpot tools (proprietary, token stored on their infra). HubSpot themselves have a public-but-empty mcp-server repo and an announced remote MCP service. So hubcli isn't "the first". It's the one with a different emphasis:

- CLI-first with MCP as an equal surface. Every MCP tool has a matching `hubcli` command, same safety rails, same redaction.
- Enterprise write gates: every mutation blocks unless `--force` is passed. Optional policy files + change-ticket enforcement. SSRF / traversal blocked at the transport layer, not just the CLI wrapper.
- Capability probing: knows what your tier supports, caches by `portalId + scopes`, can fail fast before hitting a 404.
- Rate-limit intelligence: reads HubSpot's own `X-HubSpot-RateLimit-*` headers and paces rolling + daily.
- Idempotency-Key on every write and batch.
- MCP profile isolation: `HUBCLI_MCP_PROFILE` env var locks the stdio server to one auth profile so the LLM can't cross tenants.
- Full token redaction (Bearer patterns, HubSpot private-app token patterns, sensitive keywords) on every output path including errors.
- 82 tests passing including real retry/backoff cases.
- Release artifacts include SHA256 checksums.

Built as the foundation for CRMforge, a separate project doing AI-driven HubSpot portal audits. The foundation is MIT, so anyone can build on it.

Repo: https://github.com/Luigi08001/hubcli
npm: `npm install -g hubcli` (publishing shortly)
Docs: README + SECURITY.md + MCP.md in the repo.

Happy to answer questions, especially from HubSpot admins, MSPs running multiple portals, and anyone wiring this into their agent stack.

---

_Comments to anticipate / prepared responses:_

- **"Why not HubSpot's official MCP?"** — They've announced one but the public repo is empty as of now. hubcli gives you something you can run / audit / fork / self-host today.
- **"How does this compare to Composio?"** — Composio is managed SaaS — they hold your HubSpot token on their infra (encrypted, SOC 2) and give you an MCP endpoint via HTTP. hubcli is self-hosted, MIT, you keep the token local. Different model, different buyer. Composio wins for quick-start and 850-app breadth; hubcli wins for token sovereignty, enterprise gates, and HubSpot-native depth.
- **"How does this compare to peakmojo/lkm1developer/naorhemed MCP servers?"** — Those are MCP-first and lightweight. hubcli is CLI-first with MCP as a peer surface. Different emphasis. If you just want Claude to list contacts, they're fine. If you need enterprise safety gates + auditable writes + capability probing, hubcli is the one.
- **"How does this compare to `@hubspot/cli`?"** — hs covers CMS authoring (themes, serverless, HubDB sync). hubcli covers everything else, plus MCP. They're complementary.
- **"Is HubSpot affiliated?"** — No, independent. MIT licensed.
- **"What about OAuth refresh?"** — Private App tokens + OAuth exchange helpers today. Auto-refresh on roadmap.
- **"Why Node?"** — Best MCP SDK ecosystem. Also means `npx hubcli` just works.
