# CLAUDE.md — hscli

## What this is

`hscli` is a TypeScript CLI + MCP server covering 100% of HubSpot's public API surface (1,180 endpoints). Self-hosted, MIT-licensed, published as `@revfleet/hscli`.

## Architecture

- **TypeScript** + Commander.js CLI
- **`src/commands/`** — one directory per surface (crm, marketing, service, settings, sales, cms, workflows, files, forms, webhooks, conversations, lists, sales, reporting, exports, policy, trace, audit, seed, mcp, …)
- **`src/commands/crm/shared.ts`** — `registerObjectCommands()` factory that drives CRM CRUD across every standard object
- **`src/core/`** — output formatting, HTTP client with rate-limit + retry + telemetry, auth vault, capability probing, permission profiles
- **`src/mcp/`** — MCP server with three tool families:
  - per-object tools (`crm_contacts_list`, `crm_deals_create`, …)
  - HubSpot Remote MCP compat layer (`search_crm_objects`, `manage_crm_objects`, … with the same names as `mcp.hubspot.com`)
  - extension tools (workflows, files, forms, webhooks, HubDB, …)

## Auth

- Config dir: `~/.revfleet/` (override via `$HSCLI_HOME`).
- `~/.revfleet/auth.json` stores profile tokens (0600 permissions, 0700 directory).
- Optional encrypted vault via `auth.enc` + `HSCLI_VAULT_PASSPHRASE` env var.
- Token type: HubSpot Private App token (recommended) or OAuth (supported for developer apps).

## Key commands

- `hscli auth login --token-stdin` — save a Private App token
- `hscli crm contacts list --limit 5` — smoke test auth
- `hscli doctor capabilities --refresh` — probe + cache endpoint availability for the portal
- `hscli policy templates extract <name> --to ./policy.json` — copy a built-in policy template
- `hscli trace start` / `trace stop` — record every request to a JSONL file
- `hscli audit writes --since 24h` — aggregate writes across trace files
- `hscli mcp` — run the MCP server on stdio
- `hscli seed --all` — populate a test portal with demo CRM data

## Safety model (default)

1. Mutations blocked unless `--force` or `--dry-run` is set.
2. `--policy-file` enforces method + path glob + time-window + change-ticket + approval rules.
3. All writes include an `Idempotency-Key` header for replay-safe retries.
4. Path scope allowlist — requests are rejected if they escape approved HubSpot API roots.
5. Bearer tokens + `token=` / `api_key=` values are redacted from every output and error.

## Testing

- `npx vitest run` — unit + integration tests (256 tests, ~3s)
- `npx tsc --noEmit` — typecheck
- `npm run lint` — eslint
- `test:contract` (opt-in) — set `HSCLI_ENABLE_SANDBOX_CONTRACT=1` + `HSCLI_SANDBOX_TOKEN=…` to run live sandbox tests

Always run `vitest` + `tsc` before opening a PR.

## Rules for Claude Code

1. Never commit auth tokens or credentials.
2. Run `npx vitest run` + `npx tsc --noEmit` after any source change.
3. No real emails / notifications / outbound during tests — the `--dry-run` + `--force` model is the guardrail.
4. Branch protection is on; changes to `main` go through PRs with CI green.
