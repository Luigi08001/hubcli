# TESTING PLAN

> See also: [[ARCHITECTURE]] · [[SAFETY_MODEL]] · [[RELEASE_GOVERNANCE]]

## Strategy Overview

### Unit tests
- Core output redaction logic
- CLI argument parsing and context propagation
- write-gate behavior (`--dry-run`, `--force`, block when missing)
- malformed payload and auth error handling

### Integration tests (mocked HubSpot HTTP)
- command routing to expected endpoint paths
- query params (limit/after/properties/filter) correctness
- method correctness for create/update/remove operations

### End-to-end tests
- **Sandbox first:** run against HubSpot developer sandbox only.
- **Production testing:** read-only smoke checks unless explicit manual approval window.
- `tests/contract.sandbox.test.ts` is opt-in and enabled with `HUBCLI_ENABLE_SANDBOX_CONTRACT=1`.

## Sandbox vs Production Policy
- Sandbox is mandatory for all mutation tests.
- Production writes require:
  - approved change window
  - backup/export plan
  - explicit operator confirmation
- Default recommendation: run with `--dry-run` first, then re-run with `--force` only after review.

## Domain Test Cases

### Contacts / Companies / Deals
- list with pagination/filters
- get by ID + selected properties
- search with limit/after
- create/update dry-run and forced execution

### Properties
- list/get property definitions
- create/update property definitions (dry-run and force paths)
- invalid JSON payload rejection

### Associations
- list associations with paging
- create/remove association dry-run and force behavior
- path construction validation for object types/ids

### Pipelines
- list by object type
- get pipeline by ID

### Owners
- list with limit/after/email filters

### Imports (Phase 1 gap)
- create import job payload validation
- status polling behavior
- failed-row error retrieval

## Dry-Run Validation Matrix
- Every mutating command must satisfy:
  - with `--dry-run`: no HTTP mutation call occurs
  - without `--dry-run` and without `--force`: operation blocked
  - with `--force`: HTTP mutation call allowed

## Security Control Tests
- Redaction tests:
  - token-like keys replaced with `[REDACTED]`
  - bearer strings redacted in messages/details
- Non-mutation dry-run tests:
  - ensure fetch is not called on writes
- Unauthorized/missing token behavior:
  - `AUTH_PROFILE_NOT_FOUND` returned
- Malformed payload handling:
  - invalid JSON returns `INVALID_JSON`
- Policy gate tests:
  - policy can block writes/deletes even with `--force`
  - policy can require change ticket context

## Acceptance Criteria: External HubSpot Contact Testing
Checklist before sign-off:
- [ ] Sandbox contact list/get/search returns valid schema
- [ ] Contact create dry-run outputs exact request preview
- [ ] Contact create live write requires `--force`
- [ ] Contact update dry-run and live paths validated
- [ ] No token/authorization value appears in stdout/stderr
- [ ] Error envelopes are machine-parseable in `--json` mode
- [ ] Retry behavior observed for synthetic 429/5xx response simulation
