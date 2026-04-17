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

## Development workflow

```bash
git clone https://github.com/Luigi08001/hubcli.git
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
