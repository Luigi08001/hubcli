# SAFETY_MODEL

> See also: [[ARCHITECTURE]] · [[COMMAND_COMPATIBILITY]] · [[hubspot-rules]] · [[TESTING_PLAN]]

## Principles
1. **No silent mutation**: write commands require explicit invocation and can be simulated via `--dry-run`.
2. **Deterministic output**: `--json` mode emits structured envelopes for CI/automation.
3. **Least secret exposure**: tokens are profile-scoped in a local config file and never printed by default.
4. **Policy-first execution**: optional policy file can deny writes/deletes or require change-ticket context.
5. **Graceful API resilience**: timeout + retry skeleton handles transient failures and rate limits.

## Dry-run Contract
- Applies to all mutating commands routed through `maybeWrite`.
- In dry-run mode, command returns:
  - target endpoint
  - method
  - payload
  - `dryRun: true`
- No network mutation request is sent.

## Rate Limit & Retry Baseline
- Retry on: `429`, `5xx`, and network errors.
- Honor `Retry-After` header when present.
- Use capped exponential backoff.
- Enforce request timeout (`30s`) to prevent hung command invocations.
- Surface retry exhaustion as `HTTP_RETRY_EXHAUSTED`.

## Profiles & Access
- Profiles isolate tokens per environment/workspace.
- `--profile` allows explicit target account selection.
- Missing token fails fast with guidance.

## Safe Defaults
- Default limit for list/search is conservative (`10`).
- Explicit JSON payload required for create/update.
- Unknown command errors are structured and non-destructive.
- API paths are constrained to approved HubSpot scopes.
