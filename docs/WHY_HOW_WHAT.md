# WHY / HOW / WHAT

> See also: [[ARCHITECTURE]] · [[SAFETY_MODEL]] · [[ROADMAP_PHASE1_TO_3]]

## WHY this CLI exists
`hscli` exists to give operators a safe, automatable, production-grade command interface to HubSpot APIs without needing to write code each time. It solves three operational problems:
- **Speed:** repetitive CRM operations become scriptable and repeatable.
- **Safety:** write controls prevent accidental destructive mutations.
- **Reliability:** consistent output + retry behavior reduce brittle ad-hoc scripts.

## WHAT has been built (and what remains)

### Built now
- Foundation CLI architecture with global flags:
  - `--profile` for auth profile selection
  - `--json` for machine-readable output
  - `--dry-run` for mutation simulation
  - `--force` for explicit write confirmation
  - `--policy-file` + `--change-ticket` for policy-governed writes
  - `--telemetry-file` for request-level telemetry
- CRM object support:
  - contacts/companies/deals/tickets: list/get/search/create/update/delete/merge/batch
  - pagination/filter flags on read/search paths
- Schema and relationship support:
  - properties: list/get/create/update
  - associations: list/create/remove
  - owners: list
  - pipelines: list/get
  - custom objects: schema + record management
  - engagements: notes/calls/tasks/emails/meetings
  - sync: incremental pull workflow
- Cross-domain support:
  - marketing, forms, files, cms, workflows, service command groups
  - raw API passthrough (`api request`) with existing safety controls
- Core protections:
  - write gate (`--force`) + dry-run preview
  - policy middleware for writes/deletes
  - secret redaction in output/error serialization
  - profile environment isolation via `HSCLI_HOME`
  - request scope guard, timeout, retries, and correlation id
- Auth model expansion:
  - profile listing/inspection
  - OAuth authorize URL + code exchange
  - token introspection

### Still remaining
- richer input schema validation (field-level and enum constraints)
- release signing/provenance automation
- external HubSpot sandbox e2e coverage expansion

## HOW architecture, safety, and reliability work

## Architecture
- `src/cli.ts`: global options and execution context
- `src/commands/**`: command handlers by domain
- `src/core/auth.ts`: profile-based token store with filesystem permissions
- `src/core/http.ts`: HTTP transport, retry/backoff, normalized error behavior
- `src/core/output.ts`: unified output/error envelopes + redaction

## Safety controls
- **Write confirmation pathway:** all mutating commands route through `maybeWrite`.
  - If `--dry-run`: command returns mutation preview only, no network write.
  - If live write without `--force`: blocked with `WRITE_CONFIRMATION_REQUIRED`.
  - If `--force`: write executes.
- **Policy guardrail pathway:** optional policy file can block writes/deletes or require change tickets by profile.
- **No plaintext token logs:** token values are never intentionally printed.
- **Redaction pipeline:** output and error payloads are sanitized for token/authorization/secret-like keys and bearer strings.
- **Profile isolation:** `HSCLI_HOME` can isolate credentials per environment/workload.

## Reliability controls
- Retry policy for rate-limit and transient server failures with request timeout.
- Request correlation IDs and optional telemetry output.
- Stable `CliError` envelope with machine-readable code/status/details.
- Consistent JSON mode for automation workflows.

## Threat model snapshot
- **Token theft:** mitigated by file permission restrictions + redaction + profile isolation.
- **Replay/misuse of credentials:** reduced by scope-minimal private app tokens and environment separation.
- **Payload injection / malformed writes:** JSON parsing guardrails and explicit write intent gate.
- **Unsafe writes:** default block unless `--force` or `--dry-run`.
- **Operational misuse:** deterministic outputs and explicit errors enable safe CI/script handling.
