# Publishing runbook

How to cut a new release of `@revfleet/hscli` on npm. Written for the maintainer (currently Luigi / `lvermeulen94@gmail.com`) and for any assistant helping the release.

## Prerequisites

- Write access to `npmjs.com/package/@revfleet/hscli` (check `npm owner ls @revfleet/hscli`).
- Write access to `github.com/revfleet/hscli` (push to `main`, create tags).
- Working `gh` CLI, logged in (`gh auth status` shows the `revfleet` org).
- A terminal session where you can respond to a **passkey prompt** from your password manager. The npm account is protected by a passkey (WebAuthn / platform authenticator), not a TOTP code. `npm publish` will fail interactively with `EOTP` if the passkey prompt can't reach you.

## Release flow

### 1. Land all changes on a feature branch

```bash
cd /Users/louisv/Pro-Desktop/Projets/hubcli-main
git checkout -b <branch-name>
# ... commits ...
git push -u origin <branch-name>
```

### 2. Verify CI locally before opening a PR

```bash
npm run typecheck
npm run lint
npm test
```

All three should be clean. CI runs the same checks across Node 20 and 22.

### 3. Bump the version

Edit `package.json`:

```json
{
  "version": "X.Y.Z"
}
```

Patch-bump for docs-only / internal fixes, minor for new surface (tools, commands), major for breaking changes.

### 4. Update `CHANGELOG.md`

Add a new section at the top:

```markdown
## X.Y.Z - YYYY-MM-DD

<one-paragraph summary>

### New

- ...

### Fixes

- ...

### Tests / Docs

- ...
```

Follow the shape of recent entries — tie every change to a file path when useful.

### 5. Commit, push, open PR

```bash
git add package.json CHANGELOG.md src/ tests/ docs/ README.md
git commit -m "<conventional commit message>"
git push
gh pr create --title "..." --body "..."
```

### 6. Wait for CI green

```bash
gh pr checks <pr-number>
```

Both `lint-test-build (20)` and `lint-test-build (22)` must pass.

### 7. Merge + tag

```bash
gh pr merge <pr-number> --squash --delete-branch
git checkout main
git fetch origin
git reset --hard origin/main
git tag -a vX.Y.Z -m "vX.Y.Z — <short description>"
git push origin vX.Y.Z
```

### 8. `npm publish` — the passkey gotcha

**Only the maintainer running an interactive terminal on their own machine can do this step.** Automated agents can't, because npm's 2FA is a passkey.

```bash
npm publish
```

Expected flow:

1. `npm publish` prints the tarball contents + metadata.
2. It hangs briefly, waiting for 2FA. On a passkey-only account it will print:
   ```
   npm error code EOTP
   npm error This operation requires a one-time password...
   ```
3. Your password manager / browser should have surfaced a passkey prompt at the same time. Approve it.
4. If the prompt didn't surface, re-run with `--otp=<code>` — but your npm account doesn't issue codes, so this path isn't available. You have to fix the passkey prompt instead (Chrome/Safari browser extension, OS-native passkey UI, or `1Password` / `Bitwarden` browser extension depending on your setup).

If the passkey prompt is dismissed or times out, re-run `npm publish`.

**Alternative: one-time npm token.** If you need to publish from a non-interactive environment (CI, remote agent), you can generate a temporary automation token at npmjs.com → Access Tokens → "Automation" (bypasses 2FA by design). Scope it to `@revfleet/hscli` only, set a short expiry, and delete it after use. Store it in the environment where the publish runs (`npm config set //registry.npmjs.org/:_authToken=<token>` or `NODE_AUTH_TOKEN`). Do NOT commit this token.

### 9. Verify the release

```bash
npm view @revfleet/hscli version   # should print X.Y.Z
npm view @revfleet/hscli dist-tags # 'latest' should point at X.Y.Z
```

Also confirm the GitHub Release exists at `https://github.com/revfleet/hscli/releases/tag/vX.Y.Z`. If the `release.yml` GitHub Action is set up, pushing the tag should have triggered it automatically.

## Common failure modes

| Error | Cause | Fix |
|---|---|---|
| `EOTP` at publish | Passkey prompt didn't reach you | Re-run `npm publish` from a terminal where the browser / OS can surface the passkey UI |
| `E403 Forbidden` on the first publish of a new version | Name conflict / too-similar-to-existing-package | Rename under a scope (`@revfleet/<name>`) |
| `E404` during `npm publish` | Scope doesn't exist on npm | Create it at npmjs.com/~yourname → "Create org" |
| `EUSAGE` in CI | `package-lock.json` out of sync with `package.json` | Regenerate lock with `rm -rf node_modules package-lock.json && npm install` |
| `release:verify` fails checksums step | `dist/` doesn't match `release/checksums.sha256` | Run `npm run build` then `npm run release:checksums` and commit |
| GitHub tag-push triggers release workflow but attestation step fails | Attestations require a public repo | The workflow has `continue-on-error: true` on that step; the tarball still publishes |

## Deprecating a bad release

If a published version is broken:

```bash
npm deprecate @revfleet/hscli@X.Y.Z "Broken release — use X.Y.(Z+1). See CHANGELOG."
```

Do NOT `npm unpublish` past 72 hours — npm blocks it, and even within 72 hours unpublishing disrupts anyone who cached the tarball. Deprecation + a patch release is the right move.

## Keeping the passkey flow manageable

- Keep the password manager extension installed in your default browser. If Chrome/Safari doesn't see the passkey, publish fails.
- Every now and then (once a quarter), generate a short-lived automation token specifically for planned maintenance. Revoke immediately after.
- Don't switch the npm account away from passkey 2FA. Passkeys are more secure than TOTP and the "automation token" escape hatch is sufficient for the 1 hour/quarter you need CI publish.
