# CHANGELOG-OPENCLAW.md

> **READ THIS FIRST.** Every agent (Claw, DevBot, Codex, Claude Code) MUST read this file before any work on hubcli. It tracks all modifications made by OpenClaw agents in the context of the HubSpot Pilot project.

## Context
hubcli is being extended as part of **HubSpot Pilot** (SaaS audit tool). hubcli powers the **Copilot** (Brique 5) — the AI agent that executes actions on client portals. The Scanner (Brique 1) uses direct API calls, NOT hubcli.

## Source of Truth
- **Master repo**: `/Volumes/vibeC/Hubspot CLI/hubcli-main/` (Air, SMB)
- **Working copy**: `/Users/luigi/Desktop/Projets/hubcli-main/` (Pro)
- **Workspace reference**: `/Users/luigi/.openclaw/workspace/business/hubcli/` (older, diverged)
- **Project tracker**: `/Users/luigi/.openclaw/workspace/projects/hubspot-audit/`

## Modifications Log

### 2026-03-19 — Merge workspace commands into vibeC
- **Who**: Claw (main agent)
- **What**: Copied 4 commands from workspace version to vibeC version
- **Commands added**: `account`, `communication-preferences`, `events`, `settings`
- **Reason**: vibeC was missing these; workspace had them from a different dev branch
- **Result**: vibeC hubcli now has 18 commands (was 14)

### 2026-03-19 — Add 6 new command modules (Copilot 360 coverage)
- **Who**: Sub-agent spawned by Claw
- **What**: Adding 6 new command modules for full Copilot coverage
- **Commands added**:
  1. `lists` — CRM Lists API v3 (list, get, create, update, delete, memberships)
  2. `crm pipelines` — Full CRUD (create, update, delete, stages) — was read-only
  3. `crm properties` — Full CRUD (delete, groups list/create/update) — was missing delete+groups
  4. `sales sequences` — Sequences API (list, get, enrollments)
  5. `reporting` — Analytics dashboards (list, get)
  6. `exports` — CRM Exports API (create, list, get, status)
- **Reason**: Copilot needs write access to all major HubSpot modules
- **Status**: IN PROGRESS (sub-agent building)
- **Result**: hubcli will have ~24 commands, covering 100% of Copilot needs

## Architecture Rules (for all agents)
1. Follow existing patterns in `src/commands/crm/` — Commander.js + createClient + printResult
2. Use `encodePathSegment()` for ALL path parameters (security)
3. Use `maybeWrite()` for ALL POST/PATCH/DELETE (dry-run support)
4. Use `parseJsonPayload()` for --data flags
5. DO NOT modify core files (`src/core/*`) without explicit approval from Luigi
6. All list commands must support `--limit` and `--after` pagination
7. TypeScript strict mode — `npm run typecheck` must pass
8. Tests must pass — `npm test` before any commit

## What NOT to Touch
- `src/core/http.ts` — HTTP client, stable
- `src/core/output.ts` — Output formatting, stable
- `src/core/policy.ts` — Write policies, stable
- `src/core/vault.ts` — Token storage, stable
- `src/core/auth.ts` — Auth logic, stable

## Next Planned Changes
- [ ] Add `quotes` command (Sales Quotes API) — Phase 2
- [ ] Add `meetings` command (Meetings API) — Phase 2
- [ ] Add `users` command (User permissions API) — Phase 2
- [ ] Add `data-quality` command (if API becomes available) — Phase 3
- [ ] MCP server expansion for Copilot tool use — Phase 3
