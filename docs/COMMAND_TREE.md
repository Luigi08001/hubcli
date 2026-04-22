# COMMAND_TREE

> Updated: 2026-04-17 for 0.3.0
> See also: [COMMAND_COMPATIBILITY.md](COMMAND_COMPATIBILITY.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [MCP.md](MCP.md)

High-level map of every hscli command. For detailed args and examples per command, run `hscli <domain> <cmd> --help`.

## Global flags (apply to every command)

- `--profile <name>` — Auth profile (default: `default`)
- `--json` / `--format <table|csv|yaml|json>` — Output format
- `--dry-run` — Simulate without mutating
- `--force` — Required for live writes / deletes
- `--policy-file <path>` — Load write/delete policy
- `--change-ticket <id>` — Change-ticket enforcement (when policy demands it)
- `--strict-capabilities` — Fail fast on unsupported endpoints
- `--telemetry-file <path>` — JSONL request audit trail
- `--verbose` — Print request/response details

## Auth

- `hscli auth login --token-stdin` | `--token <token>`
- `hscli auth logout [--profile <name>]`
- `hscli auth profiles` — list profiles
- `hscli auth profile-show [--profile <name>]`
- `hscli auth token-info`
- `hscli auth oauth-url --client-id <id> --redirect-uri <uri> --scope <scopes>`
- `hscli auth oauth-exchange --client-id <id> --client-secret <secret> --redirect-uri <uri> --code <code>`
- `hscli auth vault-encrypt` | `vault-decrypt` | `vault-rotate` — encrypted token vault

## Doctor

- `hscli doctor capabilities [--refresh]` — probe portal tier + scopes
- `hscli doctor permissions` — introspect current token scopes

## CRM (22 sub-command files)

Objects:
- `hscli crm contacts|companies|deals|tickets list|get|search|create|update|delete [...]`
- `hscli crm quotes|products|line-items|goals list|get|search|create|update|delete [...]`
- `hscli crm payments|invoices|subscriptions list|get [...]` — commerce
- `hscli crm custom-objects schemas list|get|create|update|delete`
- `hscli crm custom-objects records list|get|search|create|update|delete`
- `hscli crm engagements (notes|calls|tasks|emails|meetings) list|get|create|update|delete`

Properties + pipelines + associations:
- `hscli crm properties list|get|create|update|delete` + `hscli crm properties groups list|create|update|delete`
- `hscli crm pipelines list|get|create|update|delete` + `hscli crm pipelines stages create|update|delete`
- `hscli crm associations list|get|create|delete`
- `hscli crm owners list|get`

Imports + sync + introspection:
- `hscli crm imports list|get|create`
- `hscli crm sync pull --object <type>` — incremental sync
- `hscli crm describe <object> [--refresh-cache] [--offline]` — schema introspection
- `hscli crm validate <object> --data '<payload>' [--offline]` — client-side validation

## Marketing (9 files)

- `hscli marketing emails list|get|create|update|delete`
- `hscli marketing emails stats <emailId>` — **per-email engagement metrics**
- `hscli marketing campaigns list|get|create|update|delete`
- `hscli marketing ads accounts|campaigns list|get`
- `hscli marketing social accounts|posts list|get`
- `hscli marketing seo recommendations|topics list|get`
- `hscli marketing landing-pages list|get|create|update|delete`
- `hscli marketing transactional send|smtp-tokens`
- `hscli marketing subscriptions list|get` — subscription types
- `hscli marketing events list|get|create|update|delete`
- `hscli marketing behavioral-events list|get|create|update`

## Sales (4 files)

- `hscli sales sequences list|get|enrollments`
- `hscli sales meetings list|get|create|update`
- `hscli sales calling list|get`
- `hscli sales goals list|get`

## Service (4 files)

- `hscli service conversations list|get|send-message`
- `hscli service feedback list|get`
- `hscli service chatflows list|get|create|update|delete`
- `hscli service knowledge-base articles list|get|create|update|delete`
- `hscli service pipelines list|get|create|update`

## CMS

- `hscli cms hubdb tables list|get|rows list|create|update|delete`
- `hscli cms redirects list|get|create|update|delete`
- `hscli cms landing-pages list|get`
- `hscli cms domains list|get`

## Lists (standalone top-level)

- `hscli lists list|get|create|update|delete`
- `hscli lists search --query <term>`
- `hscli lists add-members --list-id <id> --object-ids <ids>`
- `hscli lists remove-members --list-id <id> --object-ids <ids>`

## Reporting

- `hscli reporting dashboards list|get`
- `hscli reporting reports list|get`

## Exports

- `hscli exports create --data '<payload>'`
- `hscli exports list|get|status <id>`

## Settings

- `hscli settings users list|get|create|update|delete` + `roles list`
- `hscli settings teams list`
- `hscli settings business-units list`
- `hscli settings currencies list`
- `hscli settings gdpr delete-contact <id>`
- `hscli settings audit-logs list [--filters]`

## Account

- `hscli account info`
- `hscli account audit-logs list [--filters]`
- `hscli account private-apps` — **list private apps installed (integration audit)**
- `hscli account api-usage` — daily API usage totals

## Communication preferences

- `hscli communication-preferences status|definitions|update`

## Conversations

- `hscli conversations list|get|send-message`

## Events

- `hscli events list|get|create`

## Automation

- `hscli automation flows list|get` + `actions list|get`

## Workflows

- `hscli workflows flows list|get` + `actions list|get` + `sequences list|get`

## Files + Forms + Domains + Site-search + Timeline

- `hscli files list|get|upload|delete`
- `hscli forms list|get|submissions list|create`
- `hscli domains list|get`
- `hscli site-search list --type <type>`
- `hscli timeline events list|create`

## Webhooks

- `hscli webhooks list --app-id <id>`
- `hscli webhooks subscribe --app-id <id> --data '<payload>'`
- `hscli webhooks delete --app-id <id> --subscription-id <id>`

## Raw API

- `hscli api request --path <path> [--method GET|POST|PATCH|PUT|DELETE] [--data '<payload>']`
- Path is validated against the allowed API scopes — SSRF and traversal attempts are rejected at transport.

## MCP server

- `hscli mcp` — start MCP server over stdio. ~125 tools across the full surface. Profile-isolated via `HSCLI_MCP_PROFILE`.

Full tool catalog and Claude Desktop / Cursor config in [MCP.md](MCP.md).

## Seed (dev + testing)

- `hscli seed --all [--dry-run]` — seed a test portal with the 48-asset baseline

## Notes

- All live writes require `--force` (or `--dry-run` to simulate).
- Write and batch requests include an `Idempotency-Key` header for replay safety.
- Transport tracks HubSpot rate-limit headers and throttles proactively.
- Policy checks apply to writes/deletes when `--policy-file` is provided.
- Capability cache is keyed by portal + token scopes; `--strict-capabilities` forces cached-state preflight.
- Schema cache (`crm describe` / `crm validate`) supports an `--offline` mode after first fetch.
