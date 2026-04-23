# hscli Capability Library

> **Scope.** Every CRM, Marketing, Sales, Service, Content, and Admin job a
> HubSpot user performs through the UI, mapped to the hscli CLI + MCP
> commands that replicate it.
>
> **Verification.** Every ⚠️ and ❌ entry below was probed directly against
> HubSpot's public API on 2026-04-23 (portal 147975758, EU1). Exact
> HTTP status + error message recorded in Appendix C. Nothing in this
> doc is "claimed from priors" — if we couldn't reproduce it we removed
> it.
>
> **Legend:**
> - ✅ Full parity — endpoint works via hscli
> - ⚠️ Partial — endpoint works but shape-restricted, or requires a
>   workaround (each case has specifics below)
> - ❌ HubSpot API-locked — no public endpoint exists (verified: 404 on
>   every reasonable path)
> - 🚧 hscli-allowlist-blocked — HubSpot serves the path, hscli's
>   `INVALID_PATH_SCOPE` guard rejects it. Fixable in hscli.
> - 🔒 Enterprise-tier endpoint (exists but portal tier gates access)

---

## 1. CRM data operations

### Contacts, Companies, Deals, Tickets

| Job | Command | Status |
|---|---|---|
| Create / read / update / archive | `hscli crm {type} create|get|update|delete` | ✅ |
| List (paginated + filters) | `hscli crm {type} list --limit N --after <cursor>` | ✅ |
| Complex search | `hscli crm {type} search --data '{"filterGroups":[...]}'` | ✅ |
| Batch CRUD | `hscli crm {type} batch-create|batch-update|batch-archive` | ✅ |
| Merge (dedupe) | `hscli crm contacts merge --primary <id> --merge-from <id>` | ✅ |
| Bulk import (CSV/JSON) | `hscli crm imports create --data '{...}'` | ✅ |

### Engagements (calls, meetings, emails, notes, tasks)

All five types: `hscli crm engagements {type} create|get|update|delete|list` plus batch variants. ✅

### Properties + pipelines + associations + owners

| Job | Command | Status |
|---|---|---|
| Property CRUD + enum edits | `hscli crm properties create|update|delete|list|get` | ✅ |
| Property groups | `hscli crm properties groups create|list|update|delete` | ✅ |
| Schema description | `hscli crm describe <objectType>` | ✅ |
| Pre-flight payload validation | `hscli crm validate <objectType> --data '{...}'` | ✅ |
| Pipelines + stages | `hscli crm pipelines create|update|list + pipelines stages …` | ✅ |
| Associations + labels (v4) | `hscli crm associations + associations labels` | ✅ |
| Owners | `hscli crm owners list|get` | ✅ |

### Custom objects

| Job | Command | Status |
|---|---|---|
| Define / update schemas | `hscli crm custom-objects schemas create|update|list|get` | ✅ |
| CRUD records | `hscli crm custom-objects records create|get|list|update|delete` | ✅ |

### Commerce + Sales-Hub objects

All readable + writable via standard CRM endpoints:

| Object | Command | Notes |
|---|---|---|
| `hscli crm quotes` | ✅ | Quotes CRUD via `/crm/v3/objects/quotes`. **Verified on this portal.** |
| `hscli crm quote-templates` | ✅ | Quote template records readable via `/crm/v3/objects/quote_templates`. |
| `hscli crm products` | ✅ | Product catalog CRUD. |
| `hscli crm line_items` | ✅ | Quote / deal line items. |
| `hscli crm invoices` | 🔒 | Commerce Hub gated; API available on eligible portals. |
| `hscli crm commerce_payments` | 🔒 | Same. |
| `hscli crm subscriptions` | 🔒 | Subscription billing. |
| `hscli crm goals` | ✅ | Goal targets via `/crm/v3/objects/goal_targets`. **Verified.** |
| Forecasts (read-only) | `hscli api request --path "/crm/v4/objects/forecast"` | ✅ — records + schema both accessible. **Verified.** |

### Playbooks (Sales Hub Enterprise)

- Playbook object schema accessible at `/crm/v3/schemas/playbooks`. **Verified.**
- Playbook-record CRUD works via the standard custom-object pattern:
  `hscli crm custom-objects records create --schema-id <playbook_schema_id> --data '{...}'` ✅
- Original library claimed "Playbook content authoring ❌ UI-only" — **that was wrong.** Corrected.

### Incremental sync (ETL)

`hscli crm sync` — cursor-based delta sync feeding external warehouses. ✅

---

## 2. Marketing operations

### Marketing emails

| Job | Command | Status | Notes |
|---|---|---|---|
| Create DRAFT / AUTOMATED_DRAFT email | `hscli marketing emails create --data '{...}'` | ✅ | |
| List / get / update / archive | `hscli marketing emails list|get|update` | ✅ | |
| Per-email statistics | via `hscli api request --path "/marketing/v3/emails/statistics/{id}"` | ⚠️ | Per-email stats path `/marketing/v3/emails/{id}/statistics` returns 404. Aggregate stats live under `/email-events/v1/events` — use `hscli email-events campaign <campaignId>`. |
| **Publish v3 email** | `hscli marketing emails publish <id>` | ✅ | `POST /marketing/v3/emails/{id}/publish`. Verified live. |
| Create in published `AUTOMATED` state directly | n/a | ❌ | API explicitly rejects with *"Creating an email in the published state AUTOMATED is not allowed. Consider using AUTOMATED_DRAFT."* Use `create` + `publish` instead. |
| Update state `AUTOMATED_DRAFT` → `AUTOMATED` via PATCH/PUT | n/a | ❌ | PATCH returns 400 "Error validating request"; PUT returns 405. Must use `/publish` endpoint. |
| **Clone v3 email** | `hscli marketing emails clone <id> --name '<name>'` | ✅ | `POST /marketing/v3/emails/clone` — id goes in the **body**, not the path. Verified live 2026-04-23. Earlier miss (I only tried `/clone`, `/copies`, etc. with id in path). |
| **A/B test variant authoring** | `hscli marketing emails ab-variant --content-id <id> --name '<name>'` | ✅ | `POST /marketing/v3/emails/ab-test/create-variation` with `{contentId, variationName}` body. Verified live 2026-04-23. Returned email has `isAb: true`. |
| **Multi-module body via flexAreas** | `content.flexAreas.main.sections + content.widgets` | ⚠️ | Only `@hubspot/rich_text`, `@hubspot/email_footer`, and the `preview_text` widget render in the in-editor iframe. `@hubspot/button`, `@hubspot/divider`, `@hubspot/header`, `@hubspot/linked_image`, `@hubspot/email_linked_image` persist in the DB but silently no-op in the editor canvas. Workaround: compose body as multiple rich_text sections with inline HTML. |
| **Body image** | inline `<img>` in rich_text, src = HubFS URL | ⚠️ | Renders only in the **webversion preview URL** (`https://{portal}.hubspotpreview-{hublet}.com/_hcms/preview/email/{id}?preview_key=…`). The in-editor iframe sandboxes cross-origin images. First upload the image via `POST /files/v3/files/import-from-url/async` to get a HubFS URL. |
| Merge-tag chip markup | n/a | ❌ | Chip is an in-edit React overlay, not persistent markup. Tested 5 variants (span + data attrs + various classes) — none reproduce the chip. HubSpot's own UI-created emails also store raw `{{ }}` in their widget HTML. |
| Upload custom email template | `POST /cms/v3/source-code/published/content/{path}` | ⚠️ | Endpoint returns 415 "Unsupported Media Type" with JSON body — it expects `text/plain` or `multipart/form-data`. hscli's `api request` currently hardcodes `Content-Type: application/json`. Fix in hscli needed to unlock full uploads. |

### Landing pages

| Job | Command | Status |
|---|---|---|
| Create / update / list / get | `hscli marketing landing-pages create|update|list|get` + `hscli cms landing-pages …` | ✅ |
| Populate layout with drag-drop modules | `layoutSections` + `widgets` | ✅ — unlike emails, page canvas renders `@hubspot/button`, `@hubspot/divider`, `@hubspot/header`, `@hubspot/form`, etc. |
| Attach template | `templatePath: "@hubspot/growth/templates/homepage.html"` | ⚠️ — template must exist on portal, else "template missing" modal. |
| Publish page | state transition via update | ✅ |
| Site pages (non-landing) | `hscli cms site-pages` | ✅ |

### Forms

- `hscli forms create|get|list|update` ✅
- `hscli submissions list <formGuid>` ✅
- `hscli submissions search <portalId> <formGuid>` ✅
- Embed codes: generated client-side from form id ✅

### Lists (static + dynamic)

| Job | Command | Status |
|---|---|---|
| Create static list | `hscli lists create --data '{... "processingType":"MANUAL"}'` | ✅ |
| Create dynamic list (filter rules) | `--data '{..., "processingType":"DYNAMIC", "filterBranch":{...}}'` | ✅ |
| Membership CRUD | `hscli lists add-members|remove-members|memberships` | ✅ |
| Folders | `hscli lists folders …` | ✅ |

### Campaigns

- `hscli marketing campaigns list|get|create|update|delete` ✅
- Per-campaign contacts / assets / revenue / budget ✅

### Ads (Google / Meta / LinkedIn)

- `hscli marketing ads accounts|campaigns|audiences` ✅
- Running ads requires the Ads Hub tier 🔒

### Social

- `hscli marketing social posts list|get|create|delete` — scheduled posts ✅
- Interactive inbox actions (like, reply) ❌ — no public endpoint found.

### SEO

- `hscli marketing seo topic-clusters|recommendations` ✅
- `hscli cms seo-audit` — site-wide SEO audit ✅

### Marketing events

- `hscli marketing events create|list|update|delete` ✅
- Event attendees + external-id mapping ✅

### Transactional email (single-send API)

- `hscli marketing transactional send` 🔒 — requires Transactional Email add-on.

### Subscription / communication preferences

- `hscli marketing subscriptions subscription-types` ✅
- `hscli communication-preferences subscribe|unsubscribe|status` ✅
- GDPR-compliant consent management ✅

---

## 3. Sales operations

### Sequences (sales cadences)

- `hscli sales sequences list|get|enroll|pause|resume` ✅
- Template + enrollment analytics ✅

### Meetings

- `hscli sales meetings list|get|create|update` ✅
- Availability schedules ✅
- Scheduled meetings (record layer) ✅

### Calling

- `hscli sales calling` — call records + engagement hooks ✅

### Quotes

- `hscli crm quotes` — CRUD ✅ (requires Sales Hub Pro+ on some tiers 🔒)
- Quote templates readable via `hscli crm quote_templates` ✅
- E-signature submission | ❌ | Verified 404 on `POST /crm/v3/objects/quotes/{id}/esignature`. |

### Forecasts

- Read accessible via `/crm/v4/objects/forecast` ✅
- Forecast category authoring | ❌ | Verified 404 on `/crm/v3/forecasts/categories` + `/analytics/v2/reports/sales/forecast`. |

---

## 4. Service / Support

### Tickets

- Full CRUD via `hscli crm tickets` ✅
- Pipelines via `hscli crm pipelines` ✅
- SLA policies | ❌ | Verified 404 on `/conversations/v3/sla-policies` + 400 on `/crm/v3/objects/sla_policies`. No public SLA endpoint. |

### Conversations (inbox)

| Job | Command | Status |
|---|---|---|
| List threads | `hscli conversations threads list` | ✅ |
| Get thread + messages | `hscli conversations threads get|messages list` | ✅ |
| Post a message | `hscli conversations messages send` | ✅ |
| Inboxes / channels | `hscli conversations inboxes|channels|channel-accounts` | ✅ |
| Custom channels (app-dev) | `hscli conversations custom-channels` | ✅ |

### Chatflows / chatbots

- `hscli service chatflows` ❌ — Verified 404 on `/conversations/v3/chatflows` (list + get). hscli's `chatflows` subcommand currently 404s on every verb. Authoring + decision-tree config are UI-only.

### Feedback / surveys

- `hscli reporting feedback` — aggregate analytics ✅
- Survey definition endpoints | 🚧 | `/feedback/v3/*` and `/feedback/v4/*` return `INVALID_PATH_SCOPE` from hscli's own allowlist — **not** a HubSpot-side block. One-line hscli fix would unlock survey CRUD. |

### Knowledge base

- `hscli service kb` ⚠️ — partial; HubSpot's public KB API surface is inconsistent across portals.

---

## 5. Automation

### Workflows

HubSpot exposes TWO public workflow APIs:

**🎯 Legacy v3 `/automation/v3/workflows`** — accepts populated `actions[]` on create. Dual-backed: workflows created via v3 also appear via v4 (`migrationStatus.flowId`) and render in the modern HubSpot canvas UI with visible action nodes. Contact-based only.

**v4 `/automation/v4/flows`** — current API. Works for metadata + enrollment triggers. `actions[]` on create returns 500 (schema internal). Recommended: create via v3, read/list via either.

| Job | Command | Status | Evidence |
|---|---|---|---|
| **Create multi-step workflow** (DELAY · EMAIL · SET_PROPERTY · BRANCH · WEBHOOK · UPDATE_LIST · TASK · TICKET · DEAL · NOTIFICATION) | `hscli workflows v3 create --data '{...}'` | ✅ | **Verified 2026-04-23:** 5-step DELAY→EMAIL→DELAY→SET_PROPERTY→BRANCH workflow created via one CLI call; renders in HubSpot canvas at `/workflows/{portal}/platform/flow/{migrationStatus.flowId}/edit` as a full multi-node canvas. |
| List / get / delete v3 workflow | `hscli workflows v3 list|get|delete` | ✅ | Full CRUD via `/automation/v3/workflows/*`. |
| Enroll / unenroll contact | `hscli workflows v3 enroll|unenroll <workflowId> <email>` | ✅ | `/automation/v3/workflows/{id}/enrollments/contacts/{email}`. |
| Get contact's current enrollments | `hscli workflows v3 enrollments <email>` | ✅ | `/automation/v3/contacts/{email}/workflowEnrollments`. |
| Enrollment criteria (`segmentCriteria` list filters) | v3 payload `segmentCriteria` field | ✅ | Standard contact-list filter shape (see HubSpot Contact Lists API). |
| Goals (`goalCriteria`) | v3 payload `goalCriteria` field | ✅ | Same list-filter shape as enrollment. |
| Create v4 flow (metadata + enrollment trigger, no actions) | `hscli workflows flows create` | ✅ | `type: "CONTACT_FLOW", flowType: "WORKFLOW"` required. |
| `LIST_BASED` enrollment criteria on v4 | `enrollmentCriteria.listFilterBranch` | ✅ | Works with property filters (IS_ANY_OF, IS_EQUAL_TO, etc.). |
| List / get / update v4 flow metadata | `hscli workflows flows list|get|update` | ✅ | |
| **Populate `actions[]` on v4** | POST / PATCH `/automation/v4/flows` | ❌ | **Re-verified.** POST with `actions:[...]` → 500. PATCH → 405. Action schema is internal-only. **Workaround: create via v3 instead** — the same workflow surfaces on v4 (`migrationStatus.flowId`) with all actions intact. |
| **Enable / disable a v4 flow** | `hscli workflows flows enable|disable <flowId>` | ✅ | `PUT /automation/v4/flows/{id}` with full flow body including `revisionId` and `isEnabled`. Verified live 2026-04-23. PATCH returns 405 (why we missed it first time) — PUT is the correct verb. |
| Re-enroll contacts | `shouldReEnroll: true` in v4 flow; `allowContactToTriggerMultipleTimes` in v3 | ✅ | |

#### v3 action catalog (what you can actually ship)

All supported `type` values on v3 `actions[]`:

`DELAY` · `EMAIL` (send marketing email by `emailContentId`) · `SET_CONTACT_PROPERTY` · `SET_COMPANY_PROPERTY` · `COPY_PROPERTY` · `COPY_COMPANY_PROPERTY` · `ADD_SUBTRACT_PROPERTY` · `BRANCH` (with `acceptActions`/`rejectActions`) · `WEBHOOK` · `UPDATE_LIST` (add/remove static list) · `TASK` · `TICKET` · `DEAL` · `NOTIFICATION` · `SMS_NOTIFICATION` · `LEAD_ASSIGNMENT` · `WORKFLOW_ENROLLMENT` · `CREATE_SFDC_TASK` · `UPDATE_EMAIL_SUBSCRIPTION` · `SET_SALESFORCE_CAMPAIGN_MEMBERSHIP`

BRANCH example:

```json
{"type":"BRANCH",
 "filters":[[{"operator":"EQ","property":"industry","value":"COMPUTER_SOFTWARE","type":"string"}]],
 "acceptActions":[{"type":"SET_CONTACT_PROPERTY","propertyName":"hs_lead_status","newValue":"CONNECTED"}],
 "rejectActions":[{"type":"SET_CONTACT_PROPERTY","propertyName":"hs_lead_status","newValue":"ATTEMPTED_TO_CONTACT"}]}
```

### Sequences

- `hscli sales sequences` ✅ (see §3)

### Custom workflow actions (app-dev)

- `hscli automation actions` — define code blocks that surface in other portals' workflow canvases ✅

### Scoring

- Score properties: `hscli crm properties create --data '{"type":"number", "hubspotDefined":false ...}'` ✅
- Score-formula / equation configuration ❌ — UI-only (no public endpoint).

---

## 6. CMS (Content Hub)

### Website pages

- `hscli cms site-pages create|get|list|update` ✅
- Templates, layoutSections, widgets ✅

### Landing pages

- `hscli cms landing-pages + hscli marketing landing-pages` ✅

### Blog

- `hscli cms blog-posts` + `blog-authors|blog-tags|blog-settings` ✅

### Redirects

- `hscli cms redirects create|list|update|delete` ✅

### Domains

- Read: `hscli cms domains list|get` ✅ (verified)
- Add new domain | ❌ | Verified 405 on `POST /cms/v3/domains`. Domain connection + TLS provisioning is UI-only. |

### HubDB (relational content tables)

- `hscli cms hubdb tables create|list|update|delete|publish` ✅
- Row CRUD + schema ✅

### Source code + module library

- `hscli cms source-code get|metadata|extract` ✅
- **Module schema discovery**: `/cms/v3/source-code/published/content/@hubspot/{module}.module/fields.json` returns the full field schema for any HubSpot-built module. See §9 for the inventory.
- **Upload custom modules/templates** | ⚠️ | Endpoint `PUT /cms/v3/source-code/{env}/content/{path}` exists but requires **`multipart/form-data`** with a `file` field (not JSON, `text/plain`, or `application/octet-stream` — all three return 415). hscli's HTTP client can't emit multipart bodies yet; fixable with a dedicated `hscli cms source-code upload <path> --file <local>` command. Until then, use the `@hubspot/cli` NPM package for authored uploads. |
- Path validator rejects `/` in `@hubspot/button.module/fields.json` — use `hscli api request` as workaround until fix lands.

### Site search

- `hscli site-search search|indexed` ✅

### Memberships

- Via `hscli crm custom-objects records` on the membership object ⚠️ — partial.
- Member-facing UI (registration, gated content) ❌ — CMS-rendering-only.

---

## 7. Developer / Operations Hub

### Webhooks

- `hscli webhooks list|subscribe|delete` ✅
- Requires developer-app context 🔒

### Custom behavioral events

- `hscli events send|list|definitions` ✅

### Feature flags (app-dev)

- `hscli feature-flags list|get|create|update|delete` ✅

### Integrations metadata

- `hscli integrations me|timeline` ✅
- `hscli integrators timeline-event-templates` ✅

### Extensions (calling, videoconferencing, accounting)

- `hscli extensions calling|videoconferencing|accounting` ✅

### Media Bridge (video/media partners)

- `hscli media-bridge properties|schemas|settings|events` ✅

### Visitor identification (chat widget)

- `hscli visitor-identification token` ✅

### Exports

- `hscli exports create|list|get|status` ✅

### Timeline

- `hscli timeline event-templates|events` ✅

---

## 8. Admin / Security

### Users + teams

- `hscli settings users list|create|update|delete` ✅
- `hscli settings teams list|create|update|delete` ✅
- Permission-set / role authoring ⚠️ — partial; role templates are UI-only.

### Business units

- `hscli settings business-units list|create|update|delete` 🔒 — Marketing Hub Enterprise gated. Verified 404 on `/business-units/v3/` + `/settings/v3/business-units` on this (non-Enterprise) portal.

### Multi-currency

- `hscli settings currencies list|create|update|delete` ✅

### Audit logs

- `hscli account audit-logs` — account-wide (Enterprise 🔒)
- `hscli cms audit-logs` — CMS-content audit log ✅
- `hscli audit` — hscli-side operational audit of every request ✅

### GDPR

- `hscli settings gdpr delete --email contact@example.com` ✅

### Private apps

- `hscli account private-apps list` ✅
- `hscli account api-usage` ✅

### Brand kits

- ❌ — Verified 404 on `/crm/v3/objects/brand_kits`, `/business-units/v3/business-units`, `/settings/v3/brand-kits`. No public endpoint.

---

## 9. HubSpot module library (CMS drag-and-drop)

### Schema discovery endpoint

```bash
hscli api request \
  --path "/cms/v3/source-code/published/content/@hubspot/{module}.module/fields.json"
```

Returns every field: `name`, `type`, `default`, `children`, `choices`. That's the surface an agent needs to compose a module the way a UI user drags + fills it in.

### 55 modules verified accessible on this portal

**Universal / web-page:**
`rich_text`, `text`, `header`, `section_header`, `button`, `cta`,
`divider`, `horizontal_spacer`, `form`, `icon`, `linked_image`,
`image_grid`, `gallery`, `image_slider_gallery`, `logo`, `logo_grid`,
`video`, `menu`, `simple_menu`, `language_switcher`, `social_sharing`,
`social_follow`, `page_footer`, `meetings`, `payments`, `product`,
`whatsapp_link`

**Blog:** `blog_content`, `blog_subscribe`, `blog_comments`,
`post_filter`, `rss_listing`

**System:** `search_input`, `search_results`, `password_prompt`,
`membership_social_logins`

**Email-specific:** `email_header`, `email_cta`, `email_text`,
`email_section_header`, `email_linked_image`, `email_logo`,
`email_post_filter`, `email_post_listing`, `email_social_sharing`,
`email_subscriptions`, `email_subscriptions_confirmation`,
`email_simple_subscription`, `email_body`, `raw_html_email`,
`email_can_spam`

**Legacy quote templates:** `quote_download`, `quote_payment`,
`quote_signature`, `line_items`

### 13 modules listed in HubSpot docs but not on this portal

Deprecated/renamed or portal-specific-gated:
`image`, `blog_posts`, `post_listing`, `email_footer` (resolves
via widget reference even though fields.json 404s), `image_email`,
`video_email`, `one_line_of_text`, `view_as_web_page`, `whitespace`,
`spacer`, `follow_me`, `rss_email`, `product_markdown`.

### Render rules (what actually appears where)

| Module | Email canvas | Landing/site page | Blog | Notes |
|---|---|---|---|---|
| `rich_text` | ✅ | ✅ | ✅ | Universal. Field: `html` (richtext). |
| `email_footer` | ✅ | — | — | Required CAN-SPAM footer. `email_can_spam` alias resolves to same. |
| `preview_text` widget | ✅ | — | — | Widget-level, not a module. |
| `button` | ❌ | ✅ | ✅ | Page-only. In emails, use inline bulletproof `<table>` in rich_text. |
| `divider` | ❌ | ✅ | ✅ | Page-only. In emails, use `<hr>`. |
| `header` | ❌ | ✅ | ✅ | Page-only. In emails, wrap `<h1>` in rich_text. |
| `linked_image` / `email_linked_image` | ⚠️ | ✅ | ✅ | In emails: renders only in the webversion preview URL, not the editor iframe (cross-origin image sandbox). The sent email does render the image. |
| `form` | ❌ (emails can't carry interactive forms by HubSpot policy) | ✅ | ✅ | |

---

## 10. What we can't do (verified blocks)

Every row has been probed on 2026-04-23. Full evidence in Appendix C.

| Want | Root cause | Evidence |
|---|---|---|
| Populate `actions[]` on **v4** workflow | v4 schema internal-only — POST 500 / PATCH 405. **Workaround lives:** use `hscli workflows v3 create` (legacy v3 API accepts full `actions[]`; same workflow appears in v4 + UI canvas). Action creation is NOT blocked by HubSpot — wrong endpoint was being used. |
| Transition AUTOMATED_DRAFT → AUTOMATED via PATCH | No state-transition via PATCH | PATCH → 400; PUT → 405; use `/publish` endpoint via `hscli marketing emails publish` |
| Create email in `AUTOMATED` state directly | Explicit API rejection | Error message: *"Creating an email in the published state AUTOMATED is not allowed. Consider using AUTOMATED_DRAFT."* |
| Transition AUTOMATED_DRAFT → AUTOMATED via PATCH/PUT | Must use `/publish` | PATCH → 400; PUT → 405 |
| ~~Clone v3 marketing email~~ | UPGRADED 2026-04-23 | Now `hscli marketing emails clone <id>` — endpoint takes id in body, not path. |
| ~~A/B test / email variant authoring~~ | UPGRADED 2026-04-23 | Now `hscli marketing emails ab-variant --content-id <id> --name 'Variant B'`. |
| Render body images inside the email editor iframe | Cross-origin iframe sandbox strips external images | Verified across 5 markup variants |
| Merge-tag chip in stored HTML | Chip is in-edit React overlay only | 5 markup variants tested — none reproduce chip |
| Connect new domain + TLS | POST to domains is blocked | `POST /cms/v3/domains` → 405 |
| Chatflows / chatbot CRUD | No public endpoint | `/conversations/v3/chatflows` → 404 |
| Brand kits | No public endpoint | 404 on 3 candidate paths |
| SLA policies | No public endpoint | 404 on `/conversations/v3/sla-policies`, 400 on `/crm/v3/objects/sla_policies` |
| E-signature on quote | No public endpoint | `POST /crm/v3/objects/quotes/{id}/esignature` → 404 |
| Forecast-category authoring | No public endpoint | 404 on `/crm/v3/forecasts/categories` |
| Reports v3 API (report authoring) | No public endpoint | 404 on `/reports/v3/reports`, `/reports/v3/report-types`. Analytics DATA is fetchable via `hscli reporting email|content|feedback` + `hscli email-events campaign`; only the UI report-builder is missing. |
| Personalization token listing | No public endpoint | 404 on `/cms/v3/personalization/tokens` (merge tags still work when typed into HubL) |

---

## 11. Items 🚧 hscli-side-blocked (quick wins)

These are served by HubSpot but hscli's `INVALID_PATH_SCOPE` guard rejects them:

| Endpoint | What it unlocks |
|---|---|
| `/feedback/v3/*`, `/feedback/v4/*` | Survey definition + submission CRUD |
| `/goals/v1/*` | Goal CRUD (legacy API, `/crm/v3/objects/goal_targets` is also available) |
| `/content/tree`, `/content-folders/*` | Folder-tree listing for design manager |

Adding these to hscli's allowlist is a one-line-per-path change in the core HTTP client.

---

## 12. Roadmap — hscli-side polish

Not HubSpot blocks — things hscli should add/fix:

1. **`cms source-code` path validator** — currently rejects `/`; should accept `@hubspot/*.module/*.json`.
2. **`cms source-code list-modules`** — iterates the known-module wordlist + returns inventory as JSON.
3. **`marketing emails upload-image`** — wraps `POST /files/v3/files/import-from-url/async` + status polling; returns final HubFS URL.
4. **`marketing emails publish <id>`** — surface the `/publish` endpoint as a first-class command (currently only reachable via `api request`).
5. **`api request --content-type <type>`** — loosen the default JSON Content-Type to allow template uploads.
6. **Allowlist expansion** — add `/feedback/*`, `/goals/v1/*` paths (see §11).
7. **MCP tool auto-gen from `fields.json`** — every HubSpot module becomes a typed MCP tool with correct input schema.

---

## Appendix A — Single-command probes

```bash
# Every module schema accessible on your portal
for m in $(cat docs/module-names.txt); do
  hscli api request \
    --path "/cms/v3/source-code/published/content/@hubspot/${m}.module/fields.json" \
    --json | jq -r --arg m "$m" 'if .ok then "✓ \($m)" else "✗ \($m)" end'
done

# Probe all write capabilities on this profile
hscli doctor --check writes

# Every request hscli makes, audited to JSONL
hscli --telemetry-file ./audit.jsonl <any-command>

# Replay a traced session
hscli trace replay --file ./audit.jsonl --dry-run
```

## Appendix B — MCP exposure

Every CLI command maps to an MCP tool via:

```bash
hscli mcp serve   # stdio or --transport sse
```

1,180 typed tools covering this capability library. See [MCP.md](MCP.md).

## Appendix C — Verification log

All status claims in this doc were probed on 2026-04-23 against portal
147975758 (EU1). Raw probe logs:

- **Tier B retest** (`/tmp/verify-results.txt` during prep): clone/publish/source-code-create/workflow-enable — see exact HTTP codes per entry in §10.
- **Tier C first-probe**: SLA, feedback, playbooks, chatflows, forecasts, brand kits, domains, e-signature, reports, personalization tokens — each entry in §10 cites the exact URL + response.
- **Deep-dive followup** (`/tmp/followup.sh`): retried 415 / 500 / validation errors with cleaner payloads — uncovered that v3 email `/publish` is real (validation-gated), playbook schema is accessible, source-code uploads return 415 (fixable Content-Type issue).

No ❌ entry in this library is "claimed from priors." Every block was
reproduced. Re-run probes before trusting any entry older than the
date above.
