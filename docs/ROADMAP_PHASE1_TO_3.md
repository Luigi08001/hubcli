# ROADMAP: Phase 1 to Phase 3

> See also: [[ARCHITECTURE]] · [[SAFETY_MODEL]] · [[RELEASE_GOVERNANCE]] · [[WHY_HOW_WHAT]]

## Scope
This roadmap defines execution from foundational CLI to production-ready HubSpot operations with strict safety and reliability gates.

## Phase 1 (✅ Complete): Core CRM + Safety Baseline

### Delivered
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
- Zod response schema validation with graceful degradation (`HUBCLI_STRICT_SCHEMAS=1` for strict mode)
- ESLint with typescript-eslint (0 errors, integrated into `release:verify`)

## Phase 2 (✅ Complete): Reliability and Operational Hardening

### Delivered
- Hublet-aware API routing for EU1/AP1 portals (`createClient(profile)`, `doctor hublet-check`)
- Retry/backoff with exponential delay on 429 + 5xx (max 3 retries, Retry-After header respect)
- Rate limit observation (rolling + daily quotas, pacing, daily exhaustion guard)
- Idempotency keys auto-generated for all write operations
- Encrypted token vault (AES-256-GCM, PBKDF2 600k iterations) — transparent via auth.ts
  - `hubcli auth encrypt` / `hubcli auth decrypt` CLI commands
  - `HUBCLI_VAULT_PASSPHRASE` env var for automated workflows
- Permission profiles (`hubcli auth set-mode <profile> read-only|read-write`)
  - Enforced at HTTP client level before any request
- Hardened test matrix: 155 tests across 9 suites
  - Unit: hublet detection, schemas, permissions, vault
  - Bugfix regression: vault bypass, 404 remap, safeJson, sync state
  - Integration: MCP tools (32 tests), CLI commands (34 tests)
  - Contract: sandbox smoke tests (10, opt-in via `HUBCLI_ENABLE_SANDBOX_CONTRACT=1`)
- `npm audit` integrated into release:verify

### Exit criteria status
- ✅ Zero unredacted secret leak in logs/errors (redaction controls + vault)
- ✅ Write-path controls enforced across all mutating endpoints (policy + permission profiles)
- ⚠️ Stable e2e suite against HubSpot sandbox — tests exist but opt-in, not CI-automated yet
- ⚠️ Domain coverage validated against production-safe contract suite — partial

## Phase 3 (✅ Complete): Production Readiness + Distribution

### Completed
- Checksums via `npm run release:checksums`
- `release:verify` pipeline: typecheck → lint → test → build → checksums
- npm audit in release gates
- CI/CD pipeline (GitHub Actions): lint + test + build on push/PR (Node 20+22 matrix)
- Cookbook / examples documentation per command (`docs/COOKBOOK.md`)
- Signed release artifacts + provenance attestation (GitHub Actions release workflow)
- Supply-chain automation (Dependabot: npm weekly + GitHub Actions weekly)
- P1/P2 bug fixes: vault bypass enforcement, 404 record-vs-endpoint disambiguation, safeJson body handling, sync cursor/mode isolation
- Plugin/extension interface (`src/core/plugins.ts`, `docs/PLUGIN_GUIDE.md`)
  - HUBCLI_PLUGINS env var + node_modules keyword discovery
  - PluginContext exposes createClient, maybeWrite, printResult, CliError
  - Safety gates (dry-run/force/policy) enforced for plugin writes
- Operational playbooks for incident response (`docs/OPERATIONAL_PLAYBOOKS.md`)

### Remaining
- (none — Phase 3 complete)

### Exit criteria
- Reproducible build from clean checkout
- CI green on every PR
- Signed release + checksum published per version
- Production launch checklist complete (security, reliability, observability)

## Risk Register (Top Items)
- Token leakage risk in logs/errors — **mitigated** (redaction + vault encryption)
- Unsafe write execution without human confirmation — **mitigated** (--force gate + permission profiles)
- Command drift from HubSpot API contracts — **mitigated** (Zod schema validation)
- Dependency compromise in npm supply chain — **mitigated** (npm audit in CI + Dependabot weekly)

## Execution Order
1. ~~Finish Phase 1 gaps~~ ✅
2. ~~Implement Phase 2 reliability hardening~~ ✅
3. ~~Lock Phase 3 release and governance controls~~ ✅ (core items)
4. ~~Operational playbooks + plugin interface~~ ✅
