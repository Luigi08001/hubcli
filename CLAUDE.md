# CLAUDE.md — hubcli project rules

> Global rules: [[coding-standards]] · [[hubspot-rules]] · [[tooling]] · [[lessons-learned]]

## What is hubcli
A custom CRM-focused CLI for HubSpot. See [[tooling#Two HubSpot CLIs]] for how it differs from the official `hs` CLI.

### Installing
```bash
git clone <repo> && cd hubcli-main
npm install && npm run build
node dist/cli.js <command>
# Or link globally:
npm link

# Auth with Private App Token
hubcli auth login --token "<pat-eu1-...>"
```

## Build & Test
- Build: `npm run build` (TypeScript → dist/)
- Run CLI: `node dist/cli.js <command>`
- Run tests: `npm test` (vitest)

## Architecture
- `src/core/` — shared modules (auth, http client, output, URLs, capabilities)
- `src/commands/` — CLI command registration
- `src/mcp/` — MCP server with tool registration
- `scripts/` — utility scripts (seed data, release checksums)
- All write operations require `--force` (CLI) or `force: true` (MCP), dry-run by default

## Portal Context & Hublet Routing
- Portal ID, uiDomain, hublet, and apiDomain are cached in `~/.hubcli/auth.json` per profile
- `hubcli auth login` auto-detects hublet from token prefix (`pat-eu1-...`) and uiDomain
- API calls route to hublet-specific endpoint (e.g. `api-eu1.hubapi.com` for EU1 portals)
- URLs are enriched automatically in CLI and MCP responses
- Use `hubcli doctor hublet-check` to verify hublet configuration consistency
- Hublet routing: see [[hubspot-rules#Portal Location Rule (Hublet-Aware API)]]

### Client instantiation
- Use `createClient(profile)` (from `src/core/http.ts`) — resolves token + hublet-aware API base URL
- Direct `new HubSpotClient(token)` only for profile-less contexts (e.g. `auth token-info`)

## Dependency on @hubspot/cli (`hs`)

hubcli is **CRM-focused** and does NOT implement project/UI extension commands. For these operations, use the official `@hubspot/cli`:

| Operation | hubcli | @hubspot/cli (`hs`) |
|-----------|--------|---------------------|
| CRM CRUD (contacts, deals, etc.) | `hubcli crm contacts list` | N/A |
| MCP server | `hubcli mcp` | N/A |
| Project upload + build + deploy | N/A | `hs project upload` |
| Deploy specific build | N/A | `hs project deploy --build=N` |
| Local dev server | N/A | `hs project dev` |
| Serverless function logs | N/A | `hs project logs` |
| Custom CRM cards / UI Extensions | N/A | `hs project upload` |
| Auth diagnostics | `hubcli doctor hublet-check` | N/A |
| Capability probing | `hubcli doctor capabilities` | N/A |

### Auth is separate
- hubcli: `~/.hubcli/auth.json` (per profile, auto-detected hublet)
- @hubspot/cli: `~/.hscli/config.yml` (YAML, needs manual `env: eu1` for EU1 portals)
- `hubcli doctor hublet-check` validates consistency between both configs

### EU1 Portal Gotcha
`~/.hscli/config.yml` **must have `env: eu1`** for EU1 portals. Default `env: prod` routes to NA API. hubcli detects this automatically, `hs` does not.

## HubSpot API Rules
See [[hubspot-rules]] for the full set. Key ones for this project:
- [[hubspot-rules#Error Threshold Rule]]
- [[hubspot-rules#Record Owner Rule]]
- [[hubspot-rules#Missing Information Rule]]
- [[hubspot-rules#Documentation-First Rule]]
