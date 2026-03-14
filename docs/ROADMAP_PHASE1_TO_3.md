# ROADMAP: Phase 1 to Phase 3

> See also: [[ARCHITECTURE]] · [[SAFETY_MODEL]] · [[RELEASE_GOVERNANCE]] · [[WHY_HOW_WHAT]]

## Scope
This roadmap defines execution from foundational CLI to production-ready HubSpot operations with strict safety and reliability gates.

## Phase 1 (Completed): Core CRM + Safety Baseline

### Delivered in this run
- CRM object commands (contacts, companies, deals, tickets): list/get/search/create/update/delete/merge + batch operations
- Pagination/filter flags baseline on object list/search commands
- Properties commands: list/get/create/update with strict object-type allowlists
- Associations commands: list/create/remove
- Owners read command: list with pagination/filter flags
- Pipelines read commands: list/get (strictly scoped to deals/tickets)
- Custom object support: schema + record CRUD/search
- Engagement support: notes, calls, tasks, emails, meetings
- Incremental sync utility (`crm sync pull`)
- Domain command groups: marketing, forms, files, cms, workflows, service
- Raw API command (`api request`) for controlled endpoint coverage
- Unified write safety middleware (`maybeWrite`):
  - `--dry-run` previews writes
  - `--force` required for live write execution
- Policy middleware:
  - `--policy-file` profile-based write/delete rules
  - `--change-ticket` enforcement where required
- JSON output consistency and redaction controls
- Profile isolation support via `HUBCLI_HOME` (environment-isolated auth store)
- OAuth-oriented auth tooling (`oauth-url`, `oauth-exchange`, token introspection)
- Request telemetry + correlation ID support

### Remaining to close Phase 1 hardening
- Endpoint-by-endpoint request/response schema validation
- Expanded command examples and cookbook docs
- Dedicated lint workflow (in addition to typecheck+test)

## Phase 2: Reliability and Operational Hardening

### Targets
- Idempotency/retry strategy refinement per endpoint class
- Optional local encrypted token vault integration
- Command-level permission profiles (read-only vs writer profiles)
- Hardened test matrix:
  - integration test fixtures
  - external sandbox smoke tests
  - production-safe contract checks

### Exit criteria
- Stable e2e suite against HubSpot sandbox
- Zero unredacted secret leak in logs/errors
- Write-path controls enforced across all mutating endpoints
- Domain coverage validated against production-safe contract suite

## Phase 3: Production Readiness + Distribution

### Targets
- Packaging and release process:
  - signed release artifacts + provenance metadata
  - checksums and provenance notes
- Supply-chain policy automation (`npm audit`, dependency review)
- Operational playbooks for incident response and rollback
- Backward-compatible command contracts and changelog discipline
- Plugin/extension interface for non-core domain packs

### Exit criteria
- Reproducible build from clean checkout
- Signed release + checksum published per version
- Production launch checklist complete (security, reliability, observability)

## Risk Register (Top Items)
- Token leakage risk in logs/errors
- Unsafe write execution without explicit human confirmation
- Command drift from HubSpot API contracts
- Dependency compromise in npm supply chain

## Execution Order
1. Finish Phase 1 gaps (imports, validations, CLI UX)
2. Implement Phase 2 reliability hardening + sandbox e2e
3. Lock Phase 3 release and governance controls
