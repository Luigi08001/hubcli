# COMMAND_TREE

> Updated: 2026-04-17 for 0.3.0
> See also: [COMMAND_COMPATIBILITY.md](COMMAND_COMPATIBILITY.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [MCP.md](MCP.md)

High-level map of every hubcli command. For detailed args and examples per command, run `hubcli <domain> <cmd> --help`.

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

- `hubcli auth login --token-stdin` | `--token <token>`
- `hubcli auth logout [--profile <name>]`
- `hubcli auth profiles` — list profiles
- `hubcli auth profile-show [--profile <name>]`
- `hubcli auth token-info`
- `hubcli auth oauth-url --client-id <id> --redirect-uri <uri> --scope <scopes>`
- `hubcli auth oauth-exchange --client-id <id> --client-secret <secret> --redirect-uri <uri> --code <code>`
- `hubcli auth vault-encrypt` | `vault-decrypt` | `vault-rotate` — encrypted token vault

## Doctor

- `hubcli doctor capabilities [--refresh]` — probe portal tier + scopes
- `hubcli doctor permissions` — introspect current token scopes

## CRM (22 sub-command files)

Objects:
- `hubcli crm contacts|companies|deals|tickets list|get|search|create|update|delete [...]`
- `hubcli crm quotes|products|line-items|goals list|get|search|create|update|delete [...]`
- `hubcli crm payments|invoices|subscriptions list|get [...]` — commerce
- `hubcli crm custom-objects schemas list|get|create|update|delete`
- `hubcli crm custom-objects records list|get|search|create|update|delete`
- `hubcli crm engagements (notes|calls|tasks|emails|meetings) list|get|create|update|delete`

Properties + pipelines + associations:
- `hubcli crm properties list|get|create|update|delete` + `hubcli crm properties groups list|create|update|delete`
- `hubcli crm pipelines list|get|create|update|delete` + `hubcli crm pipelines stages create|update|delete`
- `hubcli crm associations list|get|create|delete`
- `hubcli crm owners list|get`

Imports + sync + introspection:
- `hubcli crm imports list|get|create`
- `hubcli crm sync pull --object <type>` — incremental sync
- `hubcli crm describe <object> [--refresh-cache] [--offline]` — schema introspection
- `hubcli crm validate <object> --data '<payload>' [--offline]` — client-side validation

## Marketing (9 files)

- `hubcli marketing emails list|get|create|update|delete`
- `hubcli marketing emails stats <emailId>` — **per-email engagement metrics**
- `hubcli marketing campaigns list|get|create|update|delete`
- `hubcli marketing ads accounts|campaigns list|get`
- `hubcli marketing social accounts|posts list|get`
- `hubcli marketing seo recommendations|topics list|get`
- `hubcli marketing landing-pages list|get|create|update|delete`
- `hubcli marketing transactional send|smtp-tokens`
- `hubcli marketing subscriptions list|get` — subscription types
- `hubcli marketing events list|get|create|update|delete`
- `hubcli marketing behavioral-events list|get|create|update`

## Sales (4 files)

- `hubcli sales sequences list|get|enrollments`
- `hubcli sales meetings list|get|create|update`
- `hubcli sales calling list|get`
- `hubcli sales goals list|get`

## Service (4 files)

- `hubcli service conversations list|get|send-message`
- `hubcli service feedback list|get`
- `hubcli service chatflows list|get|create|update|delete`
- `hubcli service knowledge-base articles list|get|create|update|delete`
- `hubcli service pipelines list|get|create|update`

## CMS

- `hubcli cms hubdb tables list|get|rows list|create|update|delete`
- `hubcli cms redirects list|get|create|update|delete`
- `hubcli cms landing-pages list|get`
- `hubcli cms domains list|get`

## Lists (standalone top-level)

- `hubcli lists list|get|create|update|delete`
- `hubcli lists search --query <term>`
- `hubcli lists add-members --list-id <id> --object-ids <ids>`
- `hubcli lists remove-members --list-id <id> --object-ids <ids>`

## Reporting

- `hubcli reporting dashboards list|get`
- `hubcli reporting reports list|get`

## Exports

- `hubcli exports create --data '<payload>'`
- `hubcli exports list|get|status <id>`

## Settings

- `hubcli settings users list|get|create|update|delete` + `roles list`
- `hubcli settings teams list`
- `hubcli settings business-units list`
- `hubcli settings currencies list`
- `hubcli settings gdpr delete-contact <id>`
- `hubcli settings audit-logs list [--filters]`

## Account

- `hubcli account info`
- `hubcli account audit-logs list [--filters]`
- `hubcli account private-apps` — **list private apps installed (integration audit)**
- `hubcli account api-usage` — daily API usage totals

## Communication preferences

- `hubcli communication-preferences status|definitions|update`

## Conversations

- `hubcli conversations list|get|send-message`

## Events

- `hubcli events list|get|create`

## Automation

- `hubcli automation flows list|get` + `actions list|get`

## Workflows

- `hubcli workflows flows list|get` + `actions list|get` + `sequences list|get`

## Files + Forms + Domains + Site-search + Timeline

- `hubcli files list|get|upload|delete`
- `hubcli forms list|get|submissions list|create`
- `hubcli domains list|get`
- `hubcli site-search list --type <type>`
- `hubcli timeline events list|create`

## Webhooks

- `hubcli webhooks list --app-id <id>`
- `hubcli webhooks subscribe --app-id <id> --data '<payload>'`
- `hubcli webhooks delete --app-id <id> --subscription-id <id>`

## Raw API

- `hubcli api request --path <path> [--method GET|POST|PATCH|PUT|DELETE] [--data '<payload>']`
- Path is validated against the allowed API scopes — SSRF and traversal attempts are rejected at transport.

## MCP server

- `hubcli mcp` — start MCP server over stdio. ~125 tools across the full surface. Profile-isolated via `HUBCLI_MCP_PROFILE`.

Full tool catalog and Claude Desktop / Cursor config in [MCP.md](MCP.md).

## Seed (dev + testing)

- `hubcli seed --all [--dry-run]` — seed a test portal with the 48-asset baseline

## Notes

- All live writes require `--force` (or `--dry-run` to simulate).
- Write and batch requests include an `Idempotency-Key` header for replay safety.
- Transport tracks HubSpot rate-limit headers and throttles proactively.
- Policy checks apply to writes/deletes when `--policy-file` is provided.
- Capability cache is keyed by portal + token scopes; `--strict-capabilities` forces cached-state preflight.
- Schema cache (`crm describe` / `crm validate`) supports an `--offline` mode after first fetch.
