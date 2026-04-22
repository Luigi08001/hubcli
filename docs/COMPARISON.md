# hscli capability surface

A factual inventory of what `hscli` exposes via its CLI and MCP server surface, and the HubSpot operations it covers. No comparisons, no marketing framing — just what's in the box.

Last updated: 2026-04-22 (v0.8.0)

## MCP tool surface

`hscli mcp` exposes two tool families over stdio:

### Native tool family (per-object)

| Object | Tools |
|---|---|
| contacts, companies, deals, tickets, line items, products, quotes, invoices, orders, carts | `crm_<type>_list`, `_get`, `_search`, `_create`, `_update`, `_delete`, `_merge`, `_batch_read`, `_batch_upsert`, `_batch_archive` |
| notes, calls, tasks, emails, meetings | Same 10 tools each |
| custom objects | `crm_custom_schemas_{list,get,create,update}`, `crm_custom_records_{list,get,search,create,update,delete}` |
| properties | `crm_properties_{list,get,create,update}`, `crm_property_groups_{list,create,update}` |
| associations | `crm_associations_{list,create,remove}` |
| pipelines | `crm_pipelines_{list,get,stages}` |
| lists | `crm_lists_{list,get,create,update,delete,memberships}` |
| imports | `crm_imports_{create,list,get,errors}` |
| exports | `crm_exports_{create,list,get,status}` |
| sequences | `sales_sequences_{list,get,enrollments}` |
| reporting | `reporting_dashboards_{list,get}` |
| raw | `hub_api_request` |

### HubSpot Remote MCP compatibility family

`hscli mcp` also registers the 11 tool names used by HubSpot's hosted Remote MCP server at `mcp.hubspot.com`. An agent built against the HubSpot Remote MCP can point at `hscli mcp` without modification:

| Tool | Scope | Notes |
|---|---|---|
| `get_user_details` | Read | Returns portal / account info |
| `search_crm_objects` | Read | filterGroups (max 5) + query + sorts + pagination |
| `get_crm_objects` | Read | Batch read by ID, max 100/call |
| `manage_crm_objects` | Write + **delete** | `operation: "create" \| "update" \| "delete"` — the `delete` operation is an hscli extension (HubSpot Remote MCP is create/update only) |
| `search_properties` | Read | Keyword filter, max 5 keywords |
| `get_properties` | Read | Full property definitions |
| `search_owners` | Read | By email, by ID, or list |
| `get_campaign_analytics` | Read | Per-campaign metrics |
| `get_campaign_contacts_by_type` | Read | Paginated, with `attributionType` |
| `get_campaign_asset_types` | Read | Supported asset types |
| `get_campaign_asset_metrics` | Read | Per-asset metrics |

### Extension tool family (hscli-only)

Tools for surfaces not exposed by HubSpot's hosted Remote MCP:

| Area | Tools |
|---|---|
| Workflows | `workflows_{list,get,enroll,unenroll}` |
| Files | `files_{list,get,delete,signed_url}` |
| Forms | `forms_{list,get,submissions,submit}` |
| Webhooks | `webhooks_{list_subscriptions,create_subscription,delete_subscription}` |
| Marketing emails | `marketing_emails_{list,get,statistics}` |
| HubDB | `hubdb_{tables_list,rows_list,row_create,row_update,publish}` |
| CMS URL redirects | `cms_redirects_{list,create,delete}` |
| Conversations | `conversations_{inboxes_list,threads_list,messages_send}` |

## CLI surface

Every MCP tool has a matching CLI subcommand. Top-level command groups:

```
hscli auth               Token mgmt (login, logout, whoami, encrypt, decrypt)
hscli crm                Full CRM surface (contacts, companies, deals, tickets,
                         custom objects, properties, pipelines, associations,
                         imports, exports, describe/validate, owners, etc.)
hscli marketing          Emails, campaigns, ads, forms, landing pages,
                         transactional, subscriptions, events, behavioral events
hscli sales              Sequences, meetings, calling, scheduler, sales extensions
hscli service            Conversations (threads, messages, inboxes, channels),
                         feedback, chatflows, knowledge-base
hscli cms                Blog posts + authors + tags, site pages, landing pages,
                         HubDB (tables, rows, drafts, publishing), URL redirects,
                         source-code, domains, SEO audit, site search, comments
hscli workflows          v4 flows + legacy v2/v3 workflow enrollment
hscli automation         Custom actions
hscli files              File upload, list, delete, signed URLs
hscli forms              Forms CRUD + submissions
hscli webhooks           Subscription CRUD
hscli settings           Users, teams, business units, currencies, GDPR,
                         audit-logs, communication preferences (v3 + v4 batch)
hscli account            Account info, audit-logs, private-apps, API usage
hscli reporting          Analytics v2 reports/dashboards
hscli exports            CRM exports
hscli lists              Lists (v3) + folders + memberships
hscli conversations      Threads, messages, inboxes, channels, custom-channels
hscli api                Raw API request with scope allowlisting
hscli doctor             Diagnostics + capability probing
hscli policy             policy-as-code: list, show-matching, validate, templates
hscli audit              Operational audit over trace JSONL files
hscli trace              Session tracing + replay
hscli seed               Generate test portal data (tier-aware)
hscli mcp                Run MCP server over stdio
```

Legacy v1/v2 API support lives under `hscli contacts-v1`, `hscli companies-v2`, `hscli deals-v1`, `hscli owners-v2`, `hscli engagements-v1`, `hscli properties-legacy`, `hscli reports-v2`, `hscli calling-v1`, `hscli channels`, `hscli broadcast`, `hscli appinstalls`, `hscli marketing-emails-v1`.

## HubSpot API coverage

**Total endpoints covered:** 1,180 (verified against an automated scrape of HubSpot's developer documentation + live probe runs against multiple tier profiles).

Whether an endpoint returns 2xx on a given portal depends on HubSpot's tier gates:

| Portal tier | Reachable endpoints (read + write) |
|---|---:|
| Free | ~550 / 1180 (46.6%) |
| Starter | ~640 / 1180 (54.2%) |
| Professional | ~890 / 1180 (75.4%) |
| Enterprise (all hubs) + Commerce + Ops | ~1140 / 1180 (96.6%) |

Per-endpoint tier mapping: [docs/TIERS.md](TIERS.md).

## Auth models

| Method | Supported | Notes |
|---|:---:|---|
| HubSpot Private App token | ✅ | Primary. Scriptable / machine-to-machine / CI. |
| OAuth authorization code | Partial | Available for developer apps via `hscli auth login --oauth` |
| OAuth refresh-token rotation | ✅ | Persisted in `~/.revfleet/auth.json` (or encrypted `auth.enc`) |
| Legacy `hapikey` | ❌ | Retired by HubSpot (June 2023) |

## Safety model

- **Mutations are blocked by default.** `--force` or `--dry-run` required; neither = preview only.
- **Policy-as-code.** `--policy-file <path>` (or `HSCLI_POLICY_FILE`) evaluates rules with method + path globs, time windows (tz-aware), change-ticket requirements, approval gates. See [docs/POLICY_EXAMPLE.json](POLICY_EXAMPLE.json).
- **Change tickets.** `--change-ticket <id>` required by policy for guarded writes; value is written to telemetry.
- **Path scope allowlisting.** All requests must resolve to an approved HubSpot API path root; traversal is rejected.
- **Idempotency keys.** Every write includes an `Idempotency-Key` header for replay-safe retries.
- **Token redaction.** Bearer tokens, `token=`, `api_key=`, and `Authorization:` values are scrubbed from every output and error payload.
- **Rate-limit awareness.** Reads HubSpot's `X-HubSpot-RateLimit-*` headers; proactive throttling + daily quota reset in the portal's declared timezone.
- **Capability probing.** Endpoints are fingerprinted by `portalId + scopes`; `--strict-capabilities` fails fast on unsupported endpoints before issuing a network call.

## Observability

- **Trace.** `hscli trace start` writes every request to a JSONL file with method, path, status, latency, profile, MCP tool name (if applicable), optional request/response bodies. Session state lives at `~/.revfleet/trace-session.json`. See [docs/TUTORIALS/trace-replay-repro.md](TUTORIALS/trace-replay-repro.md).
- **Audit.** `hscli audit {timeline,who,what,writes,by-tool}` aggregates trace JSONL into operational audit views (who did what when, which tool is buggy, which path had the most writes). See [docs/TUTORIALS/audit-portal-writes.md](TUTORIALS/audit-portal-writes.md).
- **Replay.** `hscli trace replay <file>` re-issues GETs (writes are intentionally non-replayable).

## Hosting / deployment

- **Self-hosted.** `hscli` runs on your machine / CI runner / private infrastructure. No traffic transits third-party servers.
- **Token sovereignty.** HubSpot tokens stay at rest in `~/.revfleet/auth.json` (mode 0600, dir mode 0700) or encrypted `auth.enc` when `HSCLI_VAULT_PASSPHRASE` is set.
- **No telemetry phoning home.** Trace files are local-only; `hscli` ships no outbound telemetry.
