# RELEASE GOVERNANCE

> See also: [[TESTING_PLAN]] · [[COMMAND_COMPATIBILITY]] · [[SECURITY]] · [[ROADMAP_PHASE1_TO_3]]

## Versioning & Compatibility
- Use semantic versioning.
- Do not remove or rename commands without a major version bump.
- Keep JSON response envelopes stable (`ok/data` and `ok/error`).

## Required Release Gates
1. `npm run typecheck`
2. `npm test`
3. `npm run build`
4. `npm run release:checksums`
5. `shasum -a 256 -c release/checksums.sha256`
6. `npm audit --audit-level=low`

Use one command for local release validation:

```bash
npm run release:verify
```

## Security Gates
- No plaintext secrets in logs/tests/docs.
- Policy-controlled destructive commands in production profiles.
- `--force` required for writes and `--dry-run` available for preview.

## Publishing Checklist
1. Update `CHANGELOG.md`
2. Confirm command compatibility notes
3. Tag release in git
4. Publish release artifacts with checksums
5. Announce breaking changes (if any) with migration guidance
