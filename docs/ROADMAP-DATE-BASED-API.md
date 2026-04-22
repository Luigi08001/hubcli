# Roadmap: Date-based API versioning migration

Status: **planning** (targeted for v0.9.x series, 2026-H2)
Owner: hscli maintainer
Last updated: 2026-04-22

## Context

HubSpot announced ([Spring 2026 Spotlight](https://developers.hubspot.com/changelog), 2026-04-14) that date-based API versioning is now GA. Going forward, public API endpoints will use `/YYYY-MM/` segments instead of `/v1/`, `/v2/`, `/v3/`, `/v4/`. Example:

```
Today:    /crm/v3/objects/contacts
Future:   /crm/2026-03/objects/contacts
```

HubSpot has not (as of 2026-04-22) published a deprecation timeline for the numeric `vN` routes, and existing `/crm/v3/...` calls continue to work. This is forward-looking planning, not a response to a live incident.

## Why `hscli` can't just swap paths wholesale

Three reasons:

1. **Coverage completeness.** `hscli` claims 1,180 endpoints. Every one of them has a hand-rolled path in the codebase. Migrating them all in a single PR is a multi-thousand-line diff; reviewability is near zero.
2. **Per-endpoint cutover cadence.** HubSpot is unlikely to flip every endpoint to date-based versioning on the same day. Each endpoint will have its own migration window, and during that window both `/v3/` and `/2026-03/` will be valid — possibly with *different response shapes*.
3. **Backward compatibility for users.** A scripted user who pins `@revfleet/hscli@0.7.x` must keep working as long as HubSpot keeps the `/vN/` routes live. We don't want to force callers onto a new hscli major just because we migrated internally.

## Proposed approach: `apiVersion` client option + version table

### 1. Path builder layer

Introduce a helper `resolveVersionedPath({ area, date? })` that takes a logical endpoint and returns a concrete path. Example:

```ts
// Old — hand-rolled, hardcoded
await client.request(`/crm/v3/objects/${objectType}/batch/read`);

// New — explicit
await client.request(
  resolveVersionedPath("crm", "2026-03", `objects/${objectType}/batch/read`),
);
// → "/crm/2026-03/objects/contacts/batch/read" (if 2026-03 is selected)
// → "/crm/v3/objects/contacts/batch/read"      (if v3 is selected)
```

The signature we want is small enough to retrofit incrementally.

### 2. Version preference table

Store a per-area version preference in `src/core/api-versions.ts`:

```ts
export const API_VERSIONS: Record<string, { current: string; fallback: string }> = {
  crm:        { current: "v3",      fallback: "v3" },
  marketing:  { current: "v3",      fallback: "v3" },
  automation: { current: "v4",      fallback: "v4" },
  // When HubSpot flips CRM to date-based:
  // crm:     { current: "2026-03", fallback: "v3" },
};
```

`fallback` is what we'd retry with on `404`/`ENDPOINT_NOT_AVAILABLE`, so we can roll forward aggressively without breaking on portals where HubSpot hasn't cut over yet.

### 3. Response-shape adapter

HubSpot may reshape response envelopes in the date-based endpoints. We'll add a small adapter layer in `src/core/api-shapes.ts` that normalizes responses back to the v3 shape our commands expect, gated per `(area, version)` tuple. Start with an identity adapter and add transformations only when actual drift surfaces.

### 4. Capability probe extension

The existing `hscli doctor capabilities` + cache file at `~/.revfleet/capabilities.json` already fingerprints endpoints by `portalId + scopes`. Add an additional dimension: `preferredVersion`. When a probe notices a newer `/YYYY-MM/` variant returning 200, cache that preference and future calls opt in automatically.

### 5. Opt-in flag before default

Ship the migration in three phases:

- **Phase A (v0.8.x):** Version table exists. Defaults still resolve to `vN`. `--api-version 2026-03` flag + `HSCLI_API_VERSION` env var accepted for callers that want to exercise date-based paths manually.
- **Phase B (v0.9.x):** For each area HubSpot has promoted, flip `current` to the date-based version. Keep `fallback` pointing at `vN` so the capability probe can retry. Log both paths in trace telemetry when a fallback happens.
- **Phase C (v1.0):** Drop the `fallback` and delete any v3 path helpers HubSpot has formally deprecated. Breaking change justified by HubSpot's own deprecation.

## Effort estimate

- Phase A scaffolding (version table, `resolveVersionedPath`, flag wiring): **1–2 days**
- Retrofitting 1,180 callsites to use `resolveVersionedPath` (mechanical refactor): **2–3 days** (spread across v0.8.x patches)
- Adapter layer + capability probe extension: **1 day each**
- Per-area cutover (Phase B): **hours per area, weeks of calendar time** — driven by HubSpot's own schedule

## Non-goals

- **Not rebuilding the client.** The request/retry/rate-limit layer doesn't need to change.
- **Not anticipating HubSpot's every reshaping.** We add adapters when drift is observed, not pre-emptively.
- **Not breaking v0.x callers.** Anyone on v0.7.x today should still work against their portal in 2027 unless HubSpot removes the v3 endpoint entirely.

## Open questions

- **What's HubSpot's removal timeline for `/v3/`?** Unknown as of 2026-04-22. The changelog says "GA" but not "deprecated". We'll revisit when that announcement lands.
- **Will date-based versioning apply to the Search API?** The HubSpot Remote MCP server is built on CRM Search; any date-based cutover there affects us through the `search_crm_objects` compat tool too.
- **Legacy `/contacts/v1/`, `/deals/v1/` etc.** — these predate the v1/v2/v3/v4 system. Likely to be removed before the numeric-to-date migration completes. Track separately.

## Action items (not yet started)

- [ ] Add `src/core/api-versions.ts` with the version table.
- [ ] Add `resolveVersionedPath()` helper + unit tests.
- [ ] Add `--api-version <YYYY-MM>` global CLI flag + `HSCLI_API_VERSION` env.
- [ ] Retrofit the top-20-most-called endpoints first (`contacts`, `companies`, `deals`, `tickets`, `owners`, `properties`, associations, pipelines) as proof of concept in a dedicated PR.
- [ ] Watch the HubSpot changelog for the first per-area "GA on date-based versioning" notice and flip that area's `current` in a follow-up.
