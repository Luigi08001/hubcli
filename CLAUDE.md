# CLAUDE.md — hscli

## What This Is
CLI tool for HubSpot API. 77 subcommands across 26 modules covering ~95% of HubSpot's public API surface.

## Architecture
- TypeScript, Commander.js CLI framework
- `src/commands/` — one folder per module (crm, marketing, service, settings, sales, cms, etc.)
- `src/commands/crm/shared.ts` — `registerObjectCommands()` helper for CRM CRUD
- `src/core/` — output formatting, HTTP client, auth
- `src/commands/mcp.ts` — MCP server (~125 tools) for AI Copilot
- `src/commands/seed.ts` — portal seeder for testing

## Key Commands
- `hscli crm contacts list` — list contacts
- `hscli crm deals list` — list deals
- `hscli marketing emails list` — list marketing emails
- `hscli settings users list` — list users
- `hscli mcp` — start MCP server
- `hscli seed --all` — seed test portal

## Auth
- Config: `~/.hscli/auth.json`
- Private App token (EU1 portal 147975758 for testing)
- EU1 API base: `https://api.hubapi.com` (same as US, HubSpot routes internally)

## Module Coverage
- CRM: 25 subcommands (contacts, companies, deals, tickets, quotes, products, line-items, goals, payments, invoices, subscriptions, properties, pipelines, associations, owners, imports, engagements, custom-objects, sync, describe, validate)
- Marketing: 11 (emails, campaigns, ads, social, seo, landing-pages, transactional, subscriptions, events, behavioral-events)
- Settings: 7 (account, users, teams, audit-logs, currencies, gdpr, business-units)
- Service: 7 (conversations, feedback, chatflows, kb, pipelines, automation, tickets)
- Sales: 4 (meetings, calling, sequences, goals)
- CMS: 5 (hubdb, redirects, site-search, landing-pages, domains)
- Top-level: seed, mcp, doctor, api, auth

## Testing
- Portal: EU1 147975758 (free tier)
- 48 seed assets created
- 153 commands tested (111 PASS, 27 FAIL tier-locked, 15 PARTIAL)
- NEEDS-PAID-TESTING.md: 25 commands requiring paid portal

## Rules
1. Run `npx vitest` after changes
2. Run `npx tsc --noEmit` for typecheck
3. Never expose tokens in code
4. EU1 hublet: some API paths differ slightly
5. Zero envoi: never trigger real emails/notifications during testing
