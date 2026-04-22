# ARCHITECTURE

> See also: [[SAFETY_MODEL]] · [[COMMAND_TREE]] · [[MCP]] · [[TESTING_PLAN]] · [[WHY_HOW_WHAT]]

`hscli` is built as a layered TypeScript CLI:

## Layers
1. **CLI Layer (`src/cli.ts`)**
   - Command registration and argument parsing (Commander)
   - Global options propagation (`--profile`, `--json`, `--dry-run`, `--force`, policy, telemetry)
2. **Command Layer (`src/commands/**`)**
   - Domain-specific commands (auth, crm, marketing, forms, files, cms, workflows, service, api)
   - Minimal orchestration only; no transport internals
3. **Core Layer (`src/core/**`)**
   - `auth.ts`: token/profile store abstraction
   - `http.ts`: HubSpot API client, timeout/retry/backoff, scope guard, telemetry, idempotency and proactive rate-limit throttling
   - `capabilities.ts`: portal/tier capability probe + cache + endpoint preflight
   - `schema-cache.ts`: offline CRM schema cache (properties, pipelines, association labels) for describe/validate flows
   - `policy.ts`: optional write/delete policy enforcement
   - `output.ts`: `table|csv|yaml|json` formatting + safe error envelopes

## Extensibility
- New product domains can be added under `src/commands/<domain>`.
- Shared write-command behavior goes through `maybeWrite` helper to enforce dry-run and safety semantics.
- API transport remains centralized in `HubSpotClient`, including approved-path scope controls and capability preflight/fallback mapping.

## Runtime Flow
1. Parse global options.
2. Resolve profile -> token from auth store.
3. Build `HubSpotClient` with base URL + token.
4. Execute command handler.
5. Output standardized result or `CliError` envelope.

## Error Model
All command failures surface as:
- `code`: stable machine-readable identifier
- `message`: human-readable summary
- `details` (optional): diagnostic payload
- `status` (optional): HTTP status for API errors
