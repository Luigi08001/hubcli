# HubSpot Plan Tier Requirements

Every HubSpot public API endpoint is gated by a specific HubSpot plan tier. hscli
exposes **100% of the 1180 public endpoints** as CLI commands, but whether a
given command actually returns data depends on whether the portal has the
required tier activated.

This document maps hscli modules to the HubSpot product hubs and tiers that
unlock them, based on [HubSpot's official pricing page](https://www.hubspot.com/pricing)
and the [developer documentation](https://developers.hubspot.com/docs/api/overview)
as of April 2026. Tiers are cumulative — e.g. "Marketing Hub Professional+" means
Professional and Enterprise both unlock the endpoint.

If an endpoint returns **403 Forbidden** with a message like *"This endpoint is
not available on your account"* or *"This feature is part of HubSpot's [X] Hub"*,
it's tier-locked. Upgrade the portal to the required tier or test on a portal
that has it.

## Quick tier map

| Tier | Reachable endpoints (approx) |
|---|---:|
| **Free** (any account) | ~550 |
| **Starter** (any hub, $20-50/mo) | +~80 |
| **Professional** (any hub, $800-900/mo) | +~250 |
| **Enterprise** (any hub, $3200+/mo) | +~100 |
| **Commerce Hub** add-on | +~60 |
| **Operations Hub Pro+** | +~40 |
| **Developer Test Account** (free) | +~30 |
| **Developer App + legacy hapikey** | +~40 (zombie — see below) |

Cumulative ceiling with Marketing+Sales+Service+CMS+Ops+Commerce **all at
Enterprise plus a dev app**: ~1140 / 1180 reachable (96.6%). Of the remaining
~40, most are [zombie endpoints](#zombie-endpoints) HubSpot never migrated off
legacy auth.

---

## Free (no paid plan required)

These endpoints work on any HubSpot portal, including free personal accounts
and Developer Test Accounts.

### CRM objects (standard)
- `hscli crm contacts ...` — `/crm/v3/objects/contacts` (all CRUD + search + batch)
- `hscli crm companies ...` — `/crm/v3/objects/companies`
- `hscli crm deals ...` — `/crm/v3/objects/deals`
- `hscli crm tickets ...` — `/crm/v3/objects/tickets`
- `hscli crm engagements` — notes, tasks, calls, meetings, emails
- `hscli crm feedback-submissions`
- `hscli crm communications` — SMS / WhatsApp logs

### CRM infrastructure
- `hscli crm properties ...` — `/crm/v3/properties/{objectType}` + groups
- `hscli crm pipelines ...` — `/crm/v3/pipelines/{deals|tickets}`
- `hscli crm owners ...` — `/crm/v3/owners`
- `hscli crm associations ...` — `/crm/v3/associations` + `/crm/v4/associations`
- `hscli crm schemas ...` (custom objects) — `/crm/v3/schemas`
- `hscli crm imports ...` — `/crm/v3/imports`
- `hscli crm exports ...` — `/crm/v3/exports`
- `hscli lists ...` + `lists folders` — `/crm/v3/lists`

### Settings (admin)
- `hscli settings users,teams,currencies` — `/settings/v3/users`, `/settings/v3/users/teams`, `/settings/v3/currencies`
- `hscli settings audit-logs` — `/settings/v3/audit-logs` (read-only)
- `hscli account info,api-usage,private-apps,audit-logs` — `/account-info/v3`

### Files + Forms
- `hscli files ...` + `files folders` — `/files/v3/files`, `/files/v3/folders`
- `hscli forms ...` — `/marketing/v3/forms` (basic CRUD)
- `hscli submissions ...` — `/form-integrations/v1`, `/submissions/v3`

### Webhooks
- `hscli webhooks ...` — `/webhooks/v3/subscriptions` (portal-side)

### OAuth + Auth
- `hscli auth ...` — `/oauth/v1`, `/oauth/v3`

### Communication Preferences
- `hscli communication-preferences ...` — `/communication-preferences/v3` + v4 batch

### Events
- `hscli events ...` — `/events/v3` (behavioral events + event definitions)
- `hscli timeline ...` — `/crm/v3/timeline/events` (emit events, not templates)

### Conversations (read)
- `hscli conversations threads,messages,actors` — `/conversations/v3/conversations`

### Legacy CRM v1/v2
All work on Free portals (backward-compatibility preserved by HubSpot):
- `hscli contacts-v1` — `/contacts/v1`
- `hscli companies-v2` — `/companies/v2`
- `hscli deals-v1` — `/deals/v1`
- `hscli owners-v2` — `/owners/v2`
- `hscli engagements-v1` — `/engagements/v1`
- `hscli properties-legacy` — `/properties/v1`, `/properties/v2`

### Analytics (basic)
- `hscli reporting` — `/analytics/v2/reports` (read, limited by tier)

---

## Marketing Hub (Starter+)

Upgrade: $20/mo and up. Unlocks email marketing + form follow-ups.

### Starter
- `hscli marketing emails list,get` — read `/marketing/v3/emails` (limited send volume)
- `hscli marketing subscriptions` — subscription types
- `hscli marketing-emails-v1 list,get` — read legacy emails
- `hscli ctas read` — CTA reporting (legacy)

### Professional+ (adds)
- `hscli marketing emails create,update,stats` — full editorial CRUD + analytics
- `hscli marketing campaigns` — `/marketing/v3/campaigns`
- `hscli marketing ads` — `/marketing/v3/ads/{accounts,campaigns}`
- `hscli marketing social` — `/marketing/v3/social/{accounts,posts}`
- `hscli marketing seo` — `/marketing/v3/seo` + `/cms/v3/seo/audit`
- `hscli marketing events` + `attendance` + `participations` — `/marketing/v3/marketing-events`
- `hscli marketing behavioral-events` — custom behavioral event definitions
- `hscli marketing transactional single-email-send,smtp-tokens` — `/marketing/v3/transactional`
- `hscli broadcast ...`, `broadcasts-root` — legacy social broadcast
- `hscli email-events list,get,campaigns` — `/email/public/v1/events` (legacy per-recipient stream)
- `hscli marketing-extras ads-events,legacy-email-ab-test`
- `hscli marketing-emails-v1 create,update,clone,publish,statistics` — full legacy CRUD

### Enterprise (adds)
- `hscli settings business-units ...`, `hscli business-units` — `/settings/v3/business-units`, `/business-units/v3`
- `marketing.campaigns.revenue.read` scope — revenue attribution endpoints

---

## Sales Hub (Starter+)

Upgrade: $20/mo and up. Unlocks meeting scheduler + basic deal tools.

### Starter
- `hscli scheduler links-list,link-get` — `/scheduler/v3/meetings/meeting-links` (basic)
- `hscli sales meetings ...` — `/crm/v3/objects/meetings` (create/link)

### Professional+ (adds)
- `hscli sales sequences list,get,enrollments,enroll,unenroll` — `/automation/v4/sequences`
- `hscli scheduler book,reschedule,cancel` — advanced scheduler ops
- `hscli sales calling` — `/crm/v3/extensions/calling/*` (calling SDK, partly zombie — see below)
- `hscli crm goals` — `/crm/v3/objects/goal_targets` (basic custom goals in Starter, full forecasting Pro)
- `hscli crm dated associations-2025-09 usage-report` — high-usage associations report

### Enterprise (adds)
- `crm.schemas.forecasts.read`, `crm.objects.forecasts.read` — forecast data
- `crm.extensions_calling_transcripts.read,write` — call transcripts
- `crm.dealsplits.read_write` — deal splits
- `sales-email-read` — email templates API

---

## Service Hub (Starter+)

Upgrade: $20/mo and up. Unlocks ticket automation + chatflows.

### Starter
- `hscli service chatflows ...` — `/conversations/v3/chatflows`
- `hscli service feedback` — `/crm/v3/objects/feedback_submissions`
- `hscli conversations inboxes,channels,channel-accounts` — `/conversations/v3/conversations/*`
- `hscli conversations custom-channels` — app-dev custom channels

### Professional+ (adds)
- `hscli service knowledge-base ...` — `/cms/v3/knowledge_base` (articles, settings)
- `hscli service pipelines` — `/crm/v3/pipelines/tickets` with > 1 pipeline
- `hscli conversations messages send` — send messages into threads

### Enterprise (adds)
- Custom survey types + advanced routing (endpoints read-only on Pro)

---

## CMS Hub (Starter+)

Upgrade: $23/mo (CMS Hub Starter). Unlocks HubSpot-hosted website.

### Starter
- `hscli cms site-pages,pages,landing-pages` — basic CRUD
- `hscli cms url-redirects` — URL redirects
- `hscli cms topics` — blog topics
- `hscli cms audit-logs` — content audit log
- `hscli cms blog-posts,blogs,blog-authors,blog-tags,blog-settings` — full blog CRUD (Starter onwards)
- `hscli cms landing-page-folders` — landing page organization

### Professional+ (adds)
- `hscli cms hubdb ...` — `/cms/v3/hubdb/tables` (HubDB)
- `hscli cms seo-audit` — SEO audit API
- `hscli cms domains` — multi-domain listing
- `hscli cms source-code ...` — theme/module source code API
- `hscli cms content-v2 ...` — legacy Content API v2 (Pages, Layouts, Templates, Modules)
- `hscli cms pages ab-test,revisions,multi-language` — A/B testing + multi-language
- `hscli comments` — `/comments/v3/comments`

### Enterprise (adds)
- `cms.membership.access_groups.read,write` — CMS membership access groups
- Multi-brand (via Business Units)

---

## Operations Hub (Starter+)

Upgrade: $20/mo and up. Unlocks data sync + custom code.

### Starter
- `hscli crm imports,exports` — enhanced batch import/export
- `hscli integration-sync` (integrations) — basic 2-way sync

### Professional+ (adds)
- `hscli automation workflows` — `/automation/v4/flows` (Workflows)
- `hscli automation actions ...` — `/automation/v4/actions/{appId}` (custom code actions, requires OAuth dev app)
- `hscli crm dated *` — dated 2025-09 API with batch
- `hscli marketing behavioral-events` — custom event definitions (send on Ops Pro+)

### Enterprise (adds)
- Advanced data quality automation + team-based custom-code permissions

---

## Commerce Hub (Commerce add-on)

Commerce Hub is a separate add-on (not a tier). Free Commerce gives limited
Stripe checkout + quotes; paid unlocks the full suite.

### Commerce Hub (Free with Commerce account)
- `hscli crm quotes ...` — `/crm/v3/objects/quotes` (basic, requires `hs_language`)
- `hscli crm products ...` — `/crm/v3/objects/products`
- `hscli crm line-items ...` — `/crm/v3/objects/line_items`

### Commerce Hub Professional+
- `hscli crm invoices ...` — `/crm/v3/objects/invoices`
- `hscli crm subscriptions ...` — `/crm/v3/objects/subscriptions`
- `hscli crm payments ...` — `/crm/v3/objects/payments`
- `hscli crm orders,carts,discounts,fees,taxes` — commerce objects
- `hscli payments-subscriptions get,cancel,pause` — `/payments/subscriptions/v1`
- `hscli tax list,get,create,update,delete` — `/tax/v3/taxes` (tax rates)

---

## Developer Platform (HubSpot Developer Account, free)

These endpoints require a [HubSpot Developer Account](https://developers.hubspot.com/)
(free, separate from a customer portal). You build an "App" in the developer
account, install it via OAuth onto a test portal, and use the OAuth
access_token. hscli supports this via `hscli auth oauth-url` +
`hscli auth oauth-exchange --profile <devapp>`.

### Accessible via OAuth Developer App
- `hscli webhooks` — `/webhooks/v3/{appId}/subscriptions` (app developer's webhook subscriptions)
- `hscli automation actions` — `/automation/v4/actions/{appId}` (custom workflow actions)
- `hscli integrators timeline-event-templates` — `/integrators/timeline/v3/{appId}/event/templates`
- `hscli integrations timeline create,batch-create,update,delete` — `/integrations/v1/application/{appId}/timeline`
- `hscli crm cards ...` — `/crm/v3/extensions/cards/{appId}` (UI Extension cards)
- `hscli feature-flags ...` — `/feature/flags/v3/{appId}/flags` (app feature flags)
- `hscli appinstalls uninstall` — `/appinstalls/v3/external/install`

### Developer Test Account
- `hscli integrations me` — `/integrations/v1/me` (introspect installed app on test portal)

---

## Zombie endpoints

HubSpot retired the legacy **Developer API Key (`hapikey=...` query param)** for
new accounts in June 2023, but never migrated these endpoints to modern auth.
They require a legacy hapikey that only old accounts still have:

- `/crm/v3/extensions/calling/{appId}/settings/*` — Calling Extensions SDK (3 endpoints)
- `/crm/v3/extensions/cards/dev/{appId}` — UI Extensions dev preview (2 endpoints)
- `/crm/v3/extensions/videoconferencing/settings/{appId}` — Video Conf SDK (2 endpoints)
- `/media-bridge/v1/{appId}/properties/*` — Media Bridge (24 endpoints)
- `/media-bridge/v1/{appId}/schemas,settings` — Media Bridge infra (6 endpoints)
- `/crm/v3/timeline/event-templates` (write) — app-level templates
- A few others in `/integrators/timeline/v3/{appId}` write path

**Total: ~40 zombie endpoints** (3.4% of the 1180 API surface).

hscli exposes CLI commands for all of them — they're documented, typed, and
available — but they'll return 401/403 with
*"This API can't be called using an OAuth access token. A valid developer API
key must be provided in the `hapikey=` query param"* on any portal that no
longer has a legacy hapikey.

If HubSpot eventually migrates these (GitHub tracker: [HubSpot dev community](https://community.hubspot.com/)),
hscli will immediately work on them — the commands already exist.

---

## Reporting an endpoint not working

If you hit an endpoint that should work on your tier but returns an unexpected
error, open an issue at [Luigi08001/hscli/issues](https://github.com/revfleet/hscli/issues/new)
with:

1. Your portal's HubSpot plan (Starter / Pro / Enterprise, which Hubs)
2. The exact `hscli ...` command you ran
3. The error output (redact tokens)
4. The HubSpot correlation ID from the response (helps HubSpot debug faster)

For zombie endpoints, issues will be tagged `hubspot-platform` and tracked
separately — they aren't fixable in hscli.

---

## Tier reference: HubSpot official pricing

Accurate as of 2026-04-21. Prices in USD, monthly, billed annually:

| Hub | Free | Starter | Professional | Enterprise |
|---|---:|---:|---:|---:|
| Marketing Hub | ✓ | $20 | $890 | $3,600 |
| Sales Hub | ✓ | $20 | $90 (seat) | $150 (seat) |
| Service Hub | ✓ | $20 | $90 (seat) | $150 (seat) |
| CMS Hub | — | $23 | $400 | $1,500 |
| Operations Hub | ✓ | $20 | $800 | $2,000 |
| Commerce Hub | ✓ (limited) | — | $90 (seat) | — |

Check [hubspot.com/pricing](https://www.hubspot.com/pricing) for the latest.
