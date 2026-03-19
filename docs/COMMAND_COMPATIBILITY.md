# COMMAND COMPATIBILITY

> See also: [[COMMAND_TREE]] · [[SAFETY_MODEL]] · [[RELEASE_GOVERNANCE]]

## Stability Promise
- Existing command names and argument shapes are considered stable in minor/patch versions.
- New command groups may be added in minor versions.
- Breaking changes require a major version.

## Sensitive Surfaces
- `crm <object> delete`
- `crm <object> merge`
- `crm <object> batch-upsert`
- `api request` with write methods

These are guarded by:
- `--force`
- optional policy file (`--policy-file`)
- optional change ticket (`--change-ticket`) when policy requires it

## Migration Guidance
- Prefer `--json` for automation to avoid brittle text parsing.
- For new domains, prefer dedicated command groups over raw `api request` when available.
- Use `auth profiles` and `auth profile-show` before migrations to validate active profile context.
