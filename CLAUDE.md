# CLAUDE.md — hubcli project rules

## Build & Test
- Build: `npm run build` (TypeScript → dist/)
- Run CLI: `node --input-type=module -e "import { createProgram } from './dist/cli.js'; ..."`
- Run tests: `npx tsx --test tests/cli.test.ts` and `npx tsx --test tests/mcp.test.ts`

## HubSpot API Rules

### Error Threshold Rule
When performing bulk operations against the HubSpot API (batch creates, imports, seed scripts):
1. **Validate first**: Before creating records in bulk, create a single test record and confirm success.
2. **5-error hard stop**: If more than 5 errors occur on the same action type (same endpoint, same error code), STOP immediately. Do not continue retrying.
3. **Diagnose before retry**: Analyze the error response (field validation, rate limits, auth issues) and fix the root cause in code before attempting again.
4. **Rate limit awareness**: HubSpot enforces 10-second rolling limits (~100 req/10s for private apps). Use sequential processing with throttle pauses (1-2s per 5 records), not large parallel batches.
5. **Idempotent re-runs**: Seed scripts must check for existing records before creating duplicates.

### Missing Information Rule
When creating HubSpot objects (companies, custom objects, contacts), if required fields or configuration choices are ambiguous, **ask the user before proceeding**. Never guess at business-specific values like:
- Company details (industry, type, revenue)
- Custom object schemas (field names, types, associations)
- Pipeline stages and probabilities
- Property field types and options

## Architecture
- `src/core/` — shared modules (auth, http client, output, URLs, capabilities)
- `src/commands/` — CLI command registration
- `src/mcp/` — MCP server with tool registration
- `scripts/` — utility scripts (seed data, release checksums)
- All write operations require `--force` (CLI) or `force: true` (MCP), dry-run by default

## Portal Context
- Portal ID and uiDomain are cached in `~/.hubcli/auth.json` per profile
- URLs are enriched automatically in CLI and MCP responses
- EU portals use `app-eu1.hubspot.com`, US portals use `app.hubspot.com`
