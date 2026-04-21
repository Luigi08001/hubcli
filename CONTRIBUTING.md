# Contributing to hubcli

Thanks for considering a contribution. hubcli is built to a high bar — security, safety, and rigor first. Please read this doc before opening issues or PRs.

## Ground rules

1. **Security-first.** hubcli handles HubSpot private app tokens. Any change must preserve:
   - Secret redaction in output and error paths
   - File permissions on the auth store (0700 dir, 0600 file)
   - Path scope allowlisting
   - No plaintext tokens in logs, telemetry, or error traces
2. **Type-safety.** TypeScript strict mode is mandatory. `any` is allowed only with an inline comment justifying it.
3. **Tests required.** New commands need at least a CLI smoke test. New transport paths need an http.test.ts case. MCP tools need an mcp.test.ts case.
4. **Backwards compatibility.** Don't rename or remove existing commands / flags in a minor release. If you must, open a discussion first.
5. **100% surface coverage is the contract.** hubcli claims to cover every public HubSpot endpoint. If HubSpot publishes a new endpoint, there's a gap to fill. PRs adding a new endpoint are welcome and merged fast. See [docs/TIERS.md](docs/TIERS.md) for the current mapping of endpoints → required HubSpot plan tier.

## When an endpoint doesn't work for you

First, check [docs/TIERS.md](docs/TIERS.md) — most "it doesn't work" cases are because the endpoint requires a paid HubSpot tier or specific app context:

| Symptom | Likely cause | Fix |
|---|---|---|
| 401 / *"requires hapikey="* | [Zombie endpoint](docs/TIERS.md#zombie-endpoints) — HubSpot's legacy Developer API Key | Not fixable in hubcli; HubSpot must migrate. Track with label `hubspot-platform` |
| 403 / *"not available on your account"* | Tier-locked | Upgrade the HubSpot plan or test on a portal that has it |
| 404 on a `{revisionId}` path | No revision history | Edit a page first to create a revision |
| 404 on a `{appId}` path | Need OAuth Developer App | See [OAuth setup](docs/TIERS.md#developer-platform-hubspot-developer-account-free) |
| 400 / validation error | Body payload incomplete | Check HubSpot docs for required fields; pass via `--data` |

If the endpoint **should** work on your tier but doesn't, open an [endpoint issue](https://github.com/Luigi08001/hscli/issues/new?template=endpoint_not_working.md) with:
- The `hubcli` command you ran
- Your portal's tier per hub
- The HubSpot correlation ID from the response
- Whether the same operation works in the HubSpot UI

These issues are triaged quickly. If the cause is a bug in hubcli's payload construction or path handling, we fix it in a patch release.

## Running the portal probes

hubcli ships two probe scripts that test the portal's reachable surface:

```bash
# Read probe (GET + safe POST /search endpoints)
HUBCLI_PROFILE=default HUBCLI_DEV_APP_ID=<optional> \
  node scripts/test-portal-coverage.mjs > coverage.md

# Write probe (POST / PUT / PATCH / DELETE endpoints)
HUBCLI_PROFILE=default HUBCLI_DEV_APP_ID=<optional> \
  node scripts/test-portal-writes.mjs > writes.md
```

Both scripts:
- Discover real IDs from the portal dynamically
- Classify responses as PASS / VALIDATION / AUTH / ZOMBIE / TIER / 404
- Auto-retry 405 Method Not Allowed with the Allow-header's suggested verb
- Skip scrape artifacts (paths like `/{0}`)

If your probe run differs significantly from the shipped `docs/TESTING/PORTAL-147975758-COVERAGE.md`, open an issue — it's valuable telemetry.

## Development workflow

```bash
git clone https://github.com/Luigi08001/hscli.git
cd hubcli
npm install
npm run typecheck
npm test
npm run build
```

Watch mode:

```bash
npm run dev -- crm contacts list --limit 3
```

Run a command against a real sandbox (you need a HubSpot sandbox token):

```bash
export HUBCLI_HOME="$(mktemp -d)"
printf '%s' "$SANDBOX_TOKEN" | node dist/cli.js auth login --token-stdin
node dist/cli.js crm contacts list --limit 3
```

Run the contract tests against a sandbox:

```bash
export HUBCLI_ENABLE_SANDBOX_CONTRACT=1
export HUBCLI_SANDBOX_TOKEN="pat-..."
npm run test:contract
```

## Adding a new command

1. Put the command under `src/commands/<domain>/` (e.g. `src/commands/crm/`)
2. Follow the existing pattern — use `registerResource()` for CRUD or hand-roll with `commander` for special endpoints
3. Use `encodePathSegment()` on every dynamic path part
4. Route writes through `maybeWrite()` so the safety gate is enforced
5. Validate JSON payloads with `parseJsonPayload()` and numeric flags with `parseNumberFlag()`
6. Add a CLI test in `tests/cli.test.ts`
7. If the command should also be callable from MCP, register it in `src/mcp/server.ts`
8. Update `docs/COMMAND_TREE.md`

## Reporting security issues

Do **not** open a public issue for security vulnerabilities. Email the maintainer directly (see SECURITY.md) or use GitHub Security Advisories on this repository.

## Style

- Biome handles lint + format: `npm run lint:fix`
- Prefer `import type` for type-only imports
- Don't use default exports except where required
- Keep functions small, side-effects explicit

## Release process

See [docs/RELEASE_GOVERNANCE.md](docs/RELEASE_GOVERNANCE.md).

## Licensing

All contributions are licensed MIT, the same as the project. By opening a PR you agree your contribution is MIT-licensed and you have the right to submit it.
