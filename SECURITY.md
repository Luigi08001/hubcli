# SECURITY

> See also: [[SAFETY_MODEL]] · [[RELEASE_GOVERNANCE]] · [[hubspot-rules]]

## Security Objectives
- Prevent credential exposure
- Prevent unintended or unsafe CRM mutations
- Maintain auditable, deterministic CLI behavior

## Data Handling Policy
- Only required data for command execution is processed.
- Sensitive values (tokens, authorization-like fields) must never be logged in plaintext.
- Output and error payloads are redacted before serialization.
- JSON mode is preferred for machine handling to avoid ad-hoc parsing leaks.

## Secret Storage Policy
- Tokens are stored in profile-based auth file under `HUBCLI_HOME` or default `~/.hubcli`.
- File permissions are locked to owner-only (`0700` dir, `0600` auth file).
- Prefer `auth login --token-stdin` over inline `--token` to reduce shell-history/process-list exposure.
- No token echo in CLI responses.
- Roadmap item: optional encrypted keychain-backed storage.

## Auth Scope Minimization
- Use HubSpot private app tokens with minimum scopes required for the operation set.
- Separate profiles by environment (sandbox/prod) to reduce blast radius.
- Prefer read-only tokens for non-mutation workflows.

## Write Safety Policy
- All mutating commands must pass through centralized write gate.
- `--dry-run`: always available and non-mutating.
- `--force`: mandatory to execute actual writes.
- Missing `--force` blocks execution with explicit error code.
- Optional policy file gate:
  - `--policy-file <path>` to enforce profile-level write/delete rules
  - `--change-ticket <id>` required when policy mandates ticketed changes
- Dynamic path segments are validated/encoded and transport rejects paths escaping approved HubSpot API scopes.
- Dynamic `objectType` inputs are allowlisted (strict mode) with per-command-family scopes.

## Threat Model
- **Token theft:** local secret file compromise, output leak, or copied logs.
- **Replay/misuse:** stolen token used across environments.
- **Injection/malformed payload:** malformed or malicious JSON payloads.
- **Unsafe writes:** accidental execution of destructive changes.
- **Supply-chain compromise:** malicious dependency or tampered release artifact.

## Incident Response Checklist
1. Revoke affected HubSpot token(s) immediately.
2. Rotate credentials and recreate scopes minimally.
3. Audit recent command history and API activity.
4. Validate no plaintext secret leakage in logs/artifacts.
5. Patch root cause and add regression tests.
6. Re-run sandbox validation before production re-enable.

## Supply-Chain Hygiene Baseline
- Run `npm audit` regularly (pre-release required).
- Keep lockfile committed; pin direct dependencies intentionally.
- Review dependency upgrades (especially transitive risk hotspots).
- Generate deterministic SHA256 checksums for distributables: `npm run release:checksums`.

## Release Integrity Workflow (Baseline)
1. Build release artifacts: `npm run build`.
2. Generate checksum manifest: `npm run release:checksums`.
3. Review `release/checksums.sha256` and commit it with the release changes.
4. Verify checksums before publishing or installing from local artifacts:
   - `shasum -a 256 -c release/checksums.sha256`
5. If any verification fails, stop release and rebuild from a trusted commit.

This baseline ensures release artifacts in `dist/` are tamper-evident between build and distribution.
