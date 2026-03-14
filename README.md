# hubcli

> See also: [[WHY_HOW_WHAT]] · [[ARCHITECTURE]] · [[COMMAND_TREE]] · [[SAFETY_MODEL]] · [[hubspot-rules]]

Production-grade HubSpot CLI in TypeScript, focused on safe operations, automation, and release workflows.

## What It Covers
- Auth profiles (`--profile`) with local secure token store
- Safety gates for mutations (`--dry-run`, `--force`, policy file, change ticket)
- Capability-aware endpoint preflight (`doctor capabilities`, `--strict-capabilities`)
- Proactive rate-limit control (rolling window + daily pacing from HubSpot headers)
- Idempotency-Key on write and batch calls
- CRM coverage:
  - Objects: `contacts`, `companies`, `deals`, `tickets`
  - Properties, associations, owners, pipelines, imports
  - Custom objects (schemas + records)
  - Engagement objects (`notes`, `calls`, `tasks`, `emails`, `meetings`)
  - Incremental sync (`crm sync pull`)
  - Schema introspection and validation (`crm describe`, `crm validate`)
- Domain coverage: marketing, forms, files, cms, workflows, service
- Webhooks management (`webhooks list|subscribe|delete`)
- Raw API command (`api request`) with path scope controls
- MCP server over stdio (`hubcli mcp`)
- Output modes: `--format table|csv|yaml|json` (+ `--json`)
- Request telemetry (`--telemetry-file`)

## Install / Build
```bash
npm install
npm run build
```

## Quickstart
Save token (recommended):
```bash
printf '%s' '<HUBSPOT_PRIVATE_APP_TOKEN>' | node dist/cli.js auth login --token-stdin
```

Inline token (supported):
```bash
node dist/cli.js auth login --token <HUBSPOT_PRIVATE_APP_TOKEN>
```

Read flow:
```bash
node dist/cli.js crm contacts list --limit 5
```

Dry-run write:
```bash
node dist/cli.js --dry-run crm contacts create --data '{"properties":{"email":"test@example.com"}}'
```

Live write (explicit):
```bash
node dist/cli.js --force crm contacts create --data '{"properties":{"email":"test@example.com"}}'
```

Policy-guarded delete:
```bash
node dist/cli.js --force --policy-file docs/POLICY_EXAMPLE.json --change-ticket CHG-123 crm contacts delete 123
```

## Output Modes
Default output is `table`.

JSON envelope:
```bash
node dist/cli.js --json crm companies list --limit 3
```

CSV:
```bash
node dist/cli.js --format csv crm contacts list --limit 5
```

YAML:
```bash
node dist/cli.js --format yaml crm deals get 123
```

Notes:
- `--json` implies JSON output and cannot be combined with `--format` non-json.
- `--format json` is also supported.

## Capability / Tier Awareness
Probe portal capabilities and cache them by `portalId + scopes`:
```bash
node dist/cli.js doctor capabilities --refresh
```

Fail fast when capability status is unknown/unsupported:
```bash
node dist/cli.js --strict-capabilities marketing emails list
```

## Schema Introspection + Validation
Describe CRM schema (properties, enums, required, pipelines, association labels):
```bash
node dist/cli.js crm describe contacts --refresh-cache
```

Validate payload client-side before write:
```bash
node dist/cli.js crm validate contacts --data '{"properties":{"email":"x@example.com"}}'
```

Offline mode (uses local schema cache):
```bash
node dist/cli.js crm describe contacts --offline
node dist/cli.js crm validate contacts --offline --data '{"properties":{"email":"x@example.com"}}'
```

## Webhooks
List subscriptions:
```bash
node dist/cli.js webhooks list --app-id 12345
```

Create subscription (dry-run first):
```bash
node dist/cli.js --dry-run webhooks subscribe --app-id 12345 --data '{"eventType":"contact.creation","active":true}'
```

Delete subscription:
```bash
node dist/cli.js --force webhooks delete --app-id 12345 --subscription-id 999
```

## Runtime Safety Model
- Mutations are blocked unless `--force` (or intercepted by `--dry-run`).
- Write/delete can be constrained by policy (`--policy-file`) and change-ticket enforcement.
- Requests are origin-locked to `https://api.hubapi.com` and restricted to approved API path roots.
- Path segments are hardened against traversal/control chars.
- Output/error payloads are redacted for secrets and token-like strings.
- Transport retries transient failures, then fails with structured error codes.
- Rate-limit controller reads `X-HubSpot-RateLimit-*` headers and throttles proactively.
- All write/batch methods include `Idempotency-Key` for replay-safe retries.

## Caches
Under `HUBCLI_HOME` (default: `~/.hubcli`):
- `auth.json`: profile tokens/metadata
- `capabilities.json`: portal/tier capability cache
- `schema-cache.json`: CRM schema cache for describe/validate

## Commands Surface (High Level)
- `auth`: login/logout/profile/token/OAuth helpers
- `doctor`: capability probe/cache
- `crm`: objects + schemas + imports + owners + pipelines + custom objects + engagements + sync + describe/validate
- `marketing`, `forms`, `files`, `cms`, `workflows`, `service`
- `webhooks`
- `api request`
- `mcp`

Full command tree: `docs/COMMAND_TREE.md`

## Verification
Release check:
```bash
npm run release:verify
```
This runs typecheck, tests, build, and checksum verification.

## Documentation
- `docs/COMMAND_TREE.md`
- `docs/ARCHITECTURE.md`
- `docs/SAFETY_MODEL.md`
- `docs/TESTING_PLAN.md`
- `docs/MCP.md`
- `docs/RELEASE_GOVERNANCE.md`
- `docs/COMMAND_COMPATIBILITY.md`
- `SECURITY.md`
- `CHANGELOG.md`
