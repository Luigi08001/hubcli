# Portal Write Probe — 147975758 (EU1, DEVELOPER_TEST)

Generated: 2026-04-21T18:29:55.436Z  •  hubcli @ 27c3f85  •  profile: `default`  •  runSuffix: `yjb62`  •  HUBCLI_DEV_APP_ID: `37336308`

Probed 742 write endpoints (POST non-search + PUT + PATCH + DELETE) of 1180 total HubSpot API endpoints.

## Summary

| Category | Count | % |
|---|---:|---:|
| **PASS** | 57 | 7.7% |
| **CONFLICT** | 1 | 0.1% |
| **VALIDATION** | 145 | 19.5% |
| **AUTH** | 20 | 2.7% |
| **ZOMBIE** | 13 | 1.8% |
| **404** | 358 | 48.2% |
| **5XX** | 2 | 0.3% |
| **SKIP-PARAM** | 103 | 13.9% |
| **SKIP-ARTIFACT** | 33 | 4.4% |

## Legend

- **PASS** — 2xx; write succeeded with our minimal body
- **CONFLICT** — 409; endpoint works, resource already exists (semantic PASS)
- **VALIDATION** — 400; endpoint reachable + authenticated, but our minimal body is incomplete. User must provide real data via `--data`. **Counts as headless-accessible.**
- **AUTH** — 401/403 (scope or auth issue, non-zombie)
- **ZOMBIE** — 403 with explicit "requires legacy hapikey" — HubSpot's dead developer auth style
- **TIER** — 403 paid-plan-only (Marketing Hub Pro+, Service Hub Pro, etc.)
- **404** — path not found (scrape stale OR portal missing feature)
- **METHOD** — 405; scrape metadata listed wrong verb
- **5XX / 429** — server-side error or rate limit
- **SKIP-PARAM** — unresolved `{param}`
- **SKIP-ARTIFACT** — scrape artifact placeholder
- **SKIP-UNSAFE** — intentionally skipped for safety (portal-wide destructive)

## Headless accessibility

- **Directly succeeding**: 58 / 742 (7.8%)
- **Reachable via hubcli** (PASS + CONFLICT + VALIDATION): 203 / 742 (27.4%)

The headless accessibility rate treats VALIDATION responses as "reachable" because they confirm the endpoint authenticates the call and HubSpot accepted the path — what's missing is just richer payload data which is the user's domain, not the CLI's.

## Per-method breakdown

| Method | Total | PASS | CONFLICT | VALIDATION | AUTH | ZOMBIE | TIER | 404 | METHOD | 400 | 429 | 5XX | SKIP-PARAM | SKIP-ARTIFACT | SKIP-UNSAFE | ERROR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| POST | 314 | 20 | 1 | 96 | 5 | 4 |  | 124 |  |  |  | 2 | 31 | 25 |  |  |
| PUT | 63 | 2 |  | 14 | 2 | 1 |  | 30 |  |  |  |  | 11 |  |  |  |
| PATCH | 75 | 4 |  | 20 | 4 | 3 |  | 12 |  |  |  |  | 28 | 4 |  |  |
| DELETE | 111 | 26 |  | 10 | 7 | 2 |  | 28 |  |  |  |  | 33 | 4 |  |  |

## Per-module breakdown

| Module | Probed | PASS | CONFLICT | VALIDATION | AUTH | ZOMBIE | TIER | 404 | METHOD | 400 | 429 | 5XX | SKIP-PARAM | SKIP-ARTIFACT | SKIP-UNSAFE | ERROR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| cms | 160 | 6 | 1 | 22 |  | 13 |  | 72 |  |  |  | 2 | 39 |  |  |  |
| crm_core | 301 | 32 |  | 56 | 8 |  |  | 162 |  |  |  |  | 25 | 16 |  |  |
| general | 126 | 3 |  | 31 | 7 |  |  | 79 |  |  |  |  | 6 |  |  |  |
| marketing | 74 | 11 |  | 22 |  |  |  | 21 |  |  |  |  | 19 |  |  |  |
| operations | 13 | 2 |  | 3 | 4 |  |  | 1 |  |  |  |  | 1 |  |  |  |
| sales | 27 | 1 |  | 4 |  |  |  | 11 |  |  |  |  | 2 | 9 |  |  |
| service | 30 | 1 |  | 5 | 1 |  |  | 5 |  |  |  |  | 10 | 8 |  |  |
| settings | 11 | 1 |  | 2 |  |  |  | 7 |  |  |  |  | 1 |  |  |  |

## Zombie endpoints (13) — require legacy hapikey

- `POST /media-bridge/v1/{appId}/properties/{objectType}` → **403**
- `POST→DELETE /media-bridge/v1/{appId}/properties/{objectType}/batch-archive` → **403**
- `POST→DELETE /media-bridge/v1/{appId}/properties/{objectType}/batch-create` → **403**
- `POST→DELETE /media-bridge/v1/{appId}/properties/{objectType}/batch-read` → **403**
- `DELETE /media-bridge/v1/{appId}/properties/{objectType}/groups/{groupName}` → **403**
- `POST /media-bridge/v1/{appId}/properties/{objectType}/groups` → **403**
- `PATCH /media-bridge/v1/{appId}/properties/{objectType}/groups/{groupName}` → **403**
- `PATCH /media-bridge/v1/{appId}/properties/{objectType}/{propertyName}` → **403**
- `DELETE /media-bridge/v1/{appId}/properties/{objectType}/{propertyName}` → **403**
- `PATCH /media-bridge/v1/{appId}/schemas/{objectType}` → **403**
- `POST /media-bridge/v1/{appId}/schemas/{objectType}/associations` → **403**
- `PUT /media-bridge/v1/{appId}/settings` → **403**
- `POST /media-bridge/v1/{appId}/settings/register` → **403**

## Tier-locked endpoints (0)


## First 40 VALIDATION (reachable, body-incomplete)

- `POST /cms/v3/blogs/authors` → **400**  _{"correlationId":"019db14d-47ac-7782-ab28-bd17303a0ad2","errorType":"AUTHOR_FULL_NAME_MISSING","message":"The author's d_
- `POST /cms/v3/blogs/posts` → **400**  _{"correlationId":"019db14d-4cb6-71b1-8858-6b88fb5c56ee","errorType":"PARENT_BLOG_DOES_NOT_EXIST","message":"Selected par_
- `POST /cms/v3/blogs/posts/clone` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-5001-70f7-913a-cf12ac94fe9f","message":"Invalid input JSON on l_
- `POST /cms/v3/blogs/posts/schedule` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-51f1-7bd7-824a-4b43ba81beeb","message":"Invalid input JSON on l_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/draft/clone` → **400**  _{"status":"error","message":"Errors validating HubDbTableCloneRequestCore","correlationId":"019db14d-5814-7f66-bb17-c0e8_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft/batch/clone` → **400**  _{"status":"error","message":"Batch input provided should have at least one object.","correlationId":"019db14d-5b58-7fdc-_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft/batch/replace` → **400**  _{"status":"error","message":"Batch input provided should have at least one object.","correlationId":"019db14d-5c29-7715-_
- `DELETE /cms/v3/hubdb/tables/{tableIdOrName}/rows/{rowId}/draft` → **400**  _{"status":"error","message":"Row 0 to be hard deleted could not be found in table 2080623862","correlationId":"019db14d-_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft/batch/purge` → **400**  _{"status":"error","message":"Batch input provided should have at least one object.","correlationId":"019db14d-5c21-77fa-_
- `POST /cms/v3/pages/landing-pages` → **400**  _{"correlationId":"019db14d-5e2c-7519-90d3-662917087df6","errorTokens":{"contentType":["LANDING_PAGE"]},"errorType":"CONT_
- `POST /cms/v3/pages/landing-pages/ab-test/rerun` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-5f3f-7375-b6dc-4e88fc0eb69a","message":"Invalid input JSON on l_
- `POST /cms/v3/pages/landing-pages/ab-test/end` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-5f40-7567-bc54-4e6fe3577830","message":"Invalid input JSON on l_
- `POST /cms/v3/pages/landing-pages/clone` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-623d-723e-8036-4b71bcbd2674","message":"Invalid input JSON on l_
- `POST /cms/v3/pages/landing-pages/schedule` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-673d-7719-be74-e2dbdc6dee7f","message":"Invalid input JSON on l_
- `POST /cms/v3/pages/site-pages` → **400**  _{"correlationId":"019db14d-6843-7462-96c1-80c594e84769","errorTokens":{"contentType":["SITE_PAGE"]},"errorType":"CONTENT_
- `POST /cms/v3/pages/site-pages/ab-test/end` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-6861-77a9-9492-cdc659d1406e","message":"Invalid input JSON on l_
- `POST /cms/v3/pages/site-pages/ab-test/rerun` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-6931-7228-8a6b-0bf9e2dc47b6","message":"Invalid input JSON on l_
- `POST /cms/v3/pages/site-pages/clone` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-6b4a-7238-9ca4-2e5265194280","message":"Invalid input JSON on l_
- `POST /cms/v3/pages/site-pages/schedule` → **400**  _{"category":"VALIDATION_ERROR","correlationId":"019db14d-6db5-734c-8881-bdc3c39d2ced","message":"Invalid input JSON on l_
- `POST /cms/v3/source-code/extract/async` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [path]","correla_
- `POST /cms/v3/url-redirects/` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [routePrefix, de_
- `POST /files/v3/folders` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [name]","correla_
- `POST /crm/associations/2025-09/{fromObjectType}/{toObjectType}/labels` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [label, name]","_
- `PUT /crm/associations/2025-09/{fromObjectType}/{toObjectType}/labels` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [label, associat_
- `PUT /crm/associations/v4/{fromObjectType}/{toObjectType}/labels` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [label, associat_
- `POST /crm/objects/v3/projects` → **400**  _{"status":"error","message":"Error creating PROJECT. Some required properties were not set.","correlationId":"019db14d-8_
- `POST /crm/objects/v3/projects/merge` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [primaryObjectId_
- `POST /crm/v3/exports/export/async` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2: Could not resolve subtype of [simple type, class co_
- `POST /crm/v3/extensions/calling/recordings/ready` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [engagementId]",_
- `POST /crm/v3/imports/{importId}/cancel` → **400**  _{"status":"error","message":"importId must be positive.","correlationId":"019db14d-9870-703f-9041-a944820f3807","context_
- `POST /crm/v3/lists/folders` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [name]","correla_
- `POST /crm/v3/lists/` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 2. Some required fields were not set: [name, objectTyp_
- `POST /crm/v3/lists/idmapping` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 1: Cannot deserialize value of type `java.util.HashSet_
- `PUT /crm/v3/lists/{listId}/memberships/add` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 1: Cannot deserialize value of type `java.util.ArrayLi_
- `PUT /crm/v3/lists/{listId}/memberships/remove` → **400**  _{"status":"error","message":"Invalid input JSON on line 1, column 1: Cannot deserialize value of type `java.util.ArrayLi_
- `POST /crm/v3/objects/calls` → **400**  _{"status":"error","message":"Error creating CALL. Some required properties were not set.","correlationId":"019db14d-9dbc_
- `PATCH /crm/v3/objects/calls/{callId}` → **400**  _{"status":"error","message":"No properties found to update, please provide at least one.","correlationId":"019db14d-a1c1_
- `POST /crm/v3/objects/carts` → **400**  _{"status":"error","message":"Property values were not valid: [{\"isValid\":false,\"message\":\"Property \\\"name\\\" doe_
- `POST /crm/v3/objects/communications` → **400**  _{"status":"error","message":"Error creating COMMUNICATION. Some required properties were not set.","correlationId":"019d_
- `PATCH /crm/v3/objects/carts/{cartId}` → **400**  _{"status":"error","message":"No properties found to update, please provide at least one.","correlationId":"019db14d-a5df_

## First 40 AUTH (non-zombie auth failure)

- `POST /crm/v3/extensions/calling/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `PATCH /crm/v3/extensions/calling/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `DELETE /crm/v3/extensions/calling/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `POST /crm/v3/extensions/calling/{appId}/settings/recording` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `PATCH /crm/v3/extensions/calling/{appId}/settings/recording` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `POST→DELETE /crm/v3/extensions/cards/dev/{appId}` → **401**  _[auto-retried as DELETE] {"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 _
- `DELETE /crm/v3/extensions/videoconferencing/settings/{appId}` → **403**  _{"status":"error","message":"The scope needed for this API call isn't available for public use. If you have questions, c_
- `PUT /crm/v3/extensions/videoconferencing/settings/{appId}` → **403**  _{"status":"error","message":"The scope needed for this API call isn't available for public use. If you have questions, c_
- `POST /email/public/v1/smtpapi/tokens` → **403**  _{"status":"error","message":"This app hasn't been granted all required scopes to make this call. Read more about require_
- `DELETE /webhooks/v3/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `PUT /webhooks/v3/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `POST /webhooks/v3/{appId}/subscriptions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `DELETE /webhooks/v3/{appId}/subscriptions/{subscriptionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `POST→DELETE /webhooks/v3/{appId}/subscriptions/batch-update` → **401**  _[auto-retried as DELETE] {"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 _
- `PATCH /webhooks/v3/{appId}/subscriptions/{subscriptionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `DELETE /automation/v4/actions/{appId}/{definitionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `PATCH /automation/v4/actions/{appId}/{definitionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `DELETE /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `DELETE /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_
- `POST /conversations/v3/custom-channels/` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you ca_

## First 40 404s

- `POST /cms/v3/blog-settings/settings/multi-language/create/language/variation` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blog-settings/settings/multi-language/detach/from/lang-group` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blog-settings/settings/multi-language/attach/to/lang-group` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blog-settings/settings/multi-language/update/languages` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `PUT /cms/v3/blog-settings/settings/multi-language/set/new/lang/primary` → **404**  __
- `POST→DELETE /cms/v3/blogs/authors/batch-read` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-read"]},"correlation_
- `POST→DELETE /cms/v3/blogs/authors/batch-create` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-create"]},"correlati_
- `POST→DELETE /cms/v3/blogs/authors/batch-archive` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-archive"]},"correlat_
- `POST /cms/v3/blogs/authors/multi-language/create/language/variation` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blogs/authors/multi-language/attach/to/lang-group` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST→DELETE /cms/v3/blogs/authors/batch-update` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-update"]},"correlati_
- `PUT /cms/v3/blogs/authors/multi-language/set/new/lang/primary` → **404**  __
- `POST /cms/v3/blogs/authors/multi-language/detach/from/lang-group` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blogs/authors/multi-language/update/languages` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST→DELETE /cms/v3/blogs/posts/batch-archive` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-archive"]},"correlat_
- `POST→DELETE /cms/v3/blogs/posts/batch-create` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-create"]},"correlati_
- `POST→DELETE /cms/v3/blogs/posts/batch-read` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-read"]},"correlation_
- `POST→DELETE /cms/v3/blogs/posts/batch-update` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-update"]},"correlati_
- `POST /cms/v3/blogs/posts/multi-language/attach/to/lang-group` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blogs/posts/multi-language/create/language/variation` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `PUT /cms/v3/blogs/posts/multi-language/set/new/lang/primary` → **404**  __
- `POST /cms/v3/blogs/posts/multi-language/detach/from/lang-group` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blogs/posts/multi-language/update/languages` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST→DELETE /cms/v3/blogs/tags/batch-create` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-create"]},"correlati_
- `POST→DELETE /cms/v3/blogs/tags/batch-archive` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-archive"]},"correlat_
- `POST→DELETE /cms/v3/blogs/tags/batch-read` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-read"]},"correlation_
- `POST /cms/v3/blogs/tags/multi-language/attach/to/lang-group` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blogs/tags/multi-language/create/language/variation` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/blogs/tags/multi-language/detach/from/lang-group` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST→DELETE /cms/v3/blogs/tags/batch-update` → **404**  _[auto-retried as DELETE] {"category":"OBJECT_NOT_FOUND","context":{"id":["batch-update"]},"correlati_
- `PUT /cms/v3/blogs/tags/multi-language/set/new/lang/primary` → **404**  __
- `POST /cms/v3/blogs/tags/multi-language/update/languages` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/rows/batch-read` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft/batch-create` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft/batch-read` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft/batch-update` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_
- `PATCH /cms/v3/hubdb/tables/{tableIdOrName}/rows/{rowId}/draft` → **404**  _{"status":"error","message":"The HubDbTableRow 0 does not exist.","correlationId":"019db14d-5d0a-717_
- `PUT /cms/v3/hubdb/tables/{tableIdOrName}/rows/{rowId}/draft` → **404**  _{"status":"error","message":"Row with id: 0 is not present in table 2080623862 in portal: 147975758"_
- `POST /cms/v3/hubdb/tables/{tableIdOrName}/rows/{rowId}/draft/clone` → **404**  _{"status":"error","message":"Row with id: 0 is not present in table 2080623862 in portal: 147975758"_
- `POST /cms/v3/pages/landing-pages/ab-test/create/variation` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 N_

