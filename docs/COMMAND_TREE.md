# COMMAND_TREE

> See also: [[COMMAND_COMPATIBILITY]] · [[ARCHITECTURE]] · [[MCP]]

## Global
- `hubcli --profile <name>`: Select auth profile (default: `default`)
- `hubcli --json`: JSON-only output for automation
- `hubcli --format <mode>`: Output mode `json|table|csv|yaml` (default: `table`)
- `hubcli --dry-run`: Simulate write operations without mutating HubSpot
- `hubcli --force`: Required to execute live writes
- `hubcli --strict-capabilities`: Fail fast when capability status is unknown for the active portal
- `hubcli --policy-file <path>`: Policy controls for write/delete behavior
- `hubcli --change-ticket <id>`: Required when policy mandates ticketed writes
- `hubcli --telemetry-file <path>`: Request telemetry JSONL output

## Auth
- `hubcli auth login --token <private-app-token> [--profile <name>]`
- `hubcli auth login --token-stdin [--profile <name>]` (recommended for shell history safety)
- `hubcli auth whoami [--profile <name>]`
- `hubcli auth profiles`
- `hubcli auth profile-show [--profile <name>]`
- `hubcli auth logout [--profile <name>]`
- `hubcli auth token-info [--profile <name>]`
- `hubcli auth oauth-url --client-id <id> --redirect-uri <uri> [--scopes <csv>] [--state <value>]`
- `hubcli auth oauth-exchange --client-id <id> --client-secret <secret> --code <code> --redirect-uri <uri> [--profile <name>]`

## Doctor
- `hubcli doctor capabilities [--refresh] [--ttl-hours <n>]`

## CRM
### Core Objects (`contacts`, `companies`, `deals`, `tickets`)
- `<object> list|get|search|create|update|delete`
- `<object> merge --data '<payload>'`
- `<object> batch-read --data '<payload>'`
- `<object> batch-upsert --data '<payload>'`
- `<object> batch-archive --data '<payload>'`

### Schemas / Meta
- `hubcli crm properties list|get|create|update <objectType> ...`
- `hubcli crm associations list|create|remove <fromType> <fromId> <toType> [<toId>]`
- `hubcli crm owners list [--limit <n>] [--after <cursor>] [--email <email>]`
- `hubcli crm pipelines list|get <objectType> [pipelineId]`

### Imports
- `hubcli crm imports create --data '<payload>' [--dry-run] [--force]`
- `hubcli crm imports list [--limit <n>] [--after <cursor>]`
- `hubcli crm imports get <importId>`
- `hubcli crm imports errors <importId>`

### Custom Objects
- `hubcli crm custom-objects schemas list|get|create|update ...`
- `hubcli crm custom-objects records list|get|search|create|update|delete ...`

### Engagements
- `hubcli crm engagements notes|calls|tasks|emails|meetings <object-command>`

### Sync
- `hubcli crm sync pull <objectType> [--since <iso>] [--state-file <path>] [--out-file <path>] [--limit <n>] [--max-pages <n>]`

### Introspection / Validation
- `hubcli crm describe <objectType> [--offline] [--refresh-cache] [--ttl-hours <n>]`
- `hubcli crm validate <objectType> --data '<payload>' [--offline] [--refresh-cache] [--ttl-hours <n>]`

## Marketing
- `hubcli marketing emails list|get|create|update`
- `hubcli marketing campaigns list|get|create|update`

## Forms
- `hubcli forms list|get|create|update`

## Files
- `hubcli files assets list|get|update|delete`

## CMS
- `hubcli cms pages list|get|create|update|delete`
- `hubcli cms blogs list|get|create|update|delete`

## Workflows
- `hubcli workflows flows list|get|create|update`

## Service
- `hubcli service conversations list|get`
- `hubcli service feedback list|get|create|update`

## Webhooks
- `hubcli webhooks list --app-id <id>`
- `hubcli webhooks subscribe --app-id <id> --data '<payload>' [--dry-run|--force]`
- `hubcli webhooks delete --app-id <id> --subscription-id <id> [--dry-run|--force]`

## Raw API
- `hubcli api request --path <path> [--method <method>] [--data '<payload>']`

## Notes
- All live writes require `--force` unless run in `--dry-run`.
- Write/batch requests include an `Idempotency-Key` header for replay safety.
- Transport tracks HubSpot rate-limit headers and throttles proactively before quota exhaustion.
- Policy checks apply to writes/deletes when `--policy-file` is provided.
- Capability cache is keyed by portal + token scopes and used for endpoint preflight.
- `--strict-capabilities` requires a supported cached capability status (`hubcli doctor capabilities --refresh`).
- Schema cache stores properties, pipelines and association labels for `crm describe/validate` and offline usage.
- Strict allowlists:
- Object commands: `contacts`, `companies`, `deals`, `tickets`
- Properties/associations object types: `contacts`, `companies`, `deals`, `tickets`
- Pipeline object types: `deals`, `tickets`
