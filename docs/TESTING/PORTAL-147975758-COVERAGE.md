# Portal Coverage Probe — 147975758 (EU1, free tier)

Generated: 2026-04-21T17:16:13.498Z  •  hubcli @ d9a124f  •  profile: `default`

Probed 438 read-only endpoints of 1180 total HubSpot API endpoints (only GET + safe POST /search).

## Summary

| Category | Count | % |
|---|---:|---:|
| **PASS** | 153 | 34.9% |
| **AUTH** | 27 | 6.2% |
| **404** | 153 | 34.9% |
| **METHOD** | 1 | 0.2% |
| **400** | 24 | 5.5% |
| **429** | 1 | 0.2% |
| **5XX** | 13 | 3.0% |
| **SKIP-PARAM** | 66 | 15.1% |

## Legend

- **PASS** — 2xx, endpoint fully accessible on the portal
- **TIER** — 403 from a paid/enterprise feature; token is OK, portal plan isn't
- **AUTH** — 401/403 from missing scope on the Private App token
- **404** — endpoint exists but probe used a placeholder ID (substitution used `0` or similar)
- **METHOD** — 405, scrape metadata listed wrong verb
- **400** — bad request, typically missing required query parameter
- **429** — rate limit hit; retry count is in the detailed section
- **5XX** — HubSpot server error
- **SKIP-PARAM** — path has unresolved `{param}` (nested list discovery needed)
- **ERROR** — network/timeout

## Per-module breakdown

| Module | Probed | PASS | TIER | AUTH | 404 | METHOD | 400 | 429 | 5XX | SKIP-PARAM | ERROR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| cms | 66 | 15 |  | 6 | 11 |  | 5 |  | 13 | 16 |  |
| crm_core | 135 | 69 |  | 5 | 42 |  | 3 | 1 |  | 15 |  |
| general | 128 | 34 |  | 5 | 75 | 1 | 7 |  |  | 6 |  |
| marketing | 43 | 10 |  | 1 | 6 |  | 6 |  |  | 20 |  |
| operations | 10 | 2 |  | 7 |  |  | 1 |  |  |  |  |
| sales | 12 | 5 |  |  | 1 |  | 2 |  |  | 4 |  |
| service | 23 | 8 |  | 2 | 10 |  |  |  |  | 3 |  |
| settings | 21 | 10 |  | 1 | 8 |  |  |  |  | 2 |  |

## Endpoints by category (non-PASS, up to 30 each)

### AUTH (27 endpoints)

- `GET /media-bridge/v1/{appId}/properties/{objectType}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/properties/{objectType}/groups/{groupName}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/properties/{objectType}/groups` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/properties/{objectType}/{propertyName}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/schemas` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/schemas/{objectType}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /crm/v3/exports/export/async/tasks/{taskId}/status` → **403**  _{"status":"error","message":"Permission to get export file cannot be granted for exportId 475549724882 and portalId 147975758","correlationI_
- `GET /crm/v3/extensions/calling/{appId}/settings/recording` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /crm/v3/extensions/calling/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /crm/v3/extensions/cards/dev/{appId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /crm/v3/extensions/videoconferencing/settings/{appId}` → **403**  _{"status":"error","message":"The scope needed for this API call isn't available for public use. If you have questions, contact support or po_
- `GET /email/public/v1/smtpapi/tokens` → **403**  _{"status":"error","message":"This app hasn't been granted all required scopes to make this call. Read more about required scopes here: https_
- `GET /owners/v2/owners` → **401**  _{"status":"error","message":"Any of the listed authentication credentials are missing","correlationId":"019db10a-c27a-72e7-9c4d-2b0f9825e3f0_
- `GET /webhooks/v3/{appId}/subscriptions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /webhooks/v3/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /webhooks/v3/{appId}/subscriptions/{subscriptionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /marketing/v3/marketing-events/{appId}/settings` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /automation/v4/actions/{appId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/revisions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/revisions/{revisionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /conversations/v3/custom-channels/{channelId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /conversations/v3/custom-channels/` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /business-units/v3/business-units/user/{userId}` → **403**  _{"status":"error","message":"This app hasn't been granted all required scopes to make this call. Read more about required scopes here: https_

### 404 (153 endpoints)

- `GET /cms/v3/blogs/posts/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/landing-pages/folders/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/landing-pages/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/site-pages/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /files/v3/files/import/from/url/async/tasks/{taskId}/status` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/source-code/{environment}/metadata/{path}` → **404**  _{"status":"error","message":"resource not found","correlationId":"019db10a-84d9-7105-94bd-bd602215034a"}_
- `GET /cms/v3/source-code/{environment}/content/{path}` → **404**  _{"status":"error","message":"resource not found","correlationId":"019db10a-851f-7e20-8f23-a4a7ce263f49"}_
- `GET /files/v3/files/stat/{path}` → **404**  _{"status":"error","message":"No file or folder exists at path","correlationId":"019db10a-85c1-7b4c-9f82-9679f2acf935"}_
- `GET /files/v3/files/{fileId}/signed/url` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /media-bridge/v1/{appId}/settings/event/visibility` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /media-bridge/v1/{appId}/settings/oembed/domains` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/object-schemas/v3/schemas` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_
- `GET /crm/object-schemas/v3/schemas/{objectType}` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_
- `GET /crm/objects/2025-09/{objectType}/{objectId}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db10a-8b09-78aa-9ce7-eeaa263dd6e4","contex_
- `GET /crm/objects/2025-09/{objectType}/{objectId}/associations/{toObjectType}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db10a-8c23-7ea2-9dee-f252b5f3d0f6","contex_
- `GET /crm/objects/v3/{objectType}/{objectId}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db10a-8d08-7218-ae1f-2e801e058f5a","contex_
- `GET /crm/properties/2025-09/{objectType}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/properties/2025-09/{objectType}/groups` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/properties/2025-09/{objectType}/groups/{groupName}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/properties/2025-09/{objectType}/{propertyName}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/calling/{appId}/settings/channel/connection` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/cards/dev/sample/response` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/cards/dev/{appId}/{cardId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/calculated/properties` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/custom/object/types` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/custom/properties` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/lists/{listId}` → **404**  _{"status":"error","message":"List does not exist with ID 0.","correlationId":"019db10a-9530-74d2-b450-499899948856","context":{"listId":["0"_
- `GET /crm/v3/lists/{listId}/memberships` → **404**  _{"status":"error","message":"List does not exist with ID 0.","correlationId":"019db10a-9537-7957-860a-76bc9283381d","context":{"listId":["0"_
- `GET /crm/v3/lists/{listId}/memberships/join/order` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/lists/{listId}/schedule/conversion` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _

_(+123 more)_

### METHOD (1 endpoints)

- `GET /reports/v2/events/batch` → **405**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 405 Method Not Allowed</title> </head> <body>_

### 400 (24 endpoints)

- `GET /cms/v3/site-search/search` → **400**  _{"status":"error","message":"Invalid input JSON on line -1, column -1: Cannot build PublicSearchRequest, some of required attributes are not_
- `GET /cms/v3/source-code/extract/async/tasks/{taskId}/status` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: taskId","correlationId":"019db10a-83e3-774d-99c9-04fae813e48c"}_
- `GET /files/v3/files/{fileId}` → **400**  _{"status":"error","message":"id must be > 0","correlationId":"019db10a-85d0-72b2-8d6c-04ff25149d7b","context":{"id":["0"]},"category":"VALID_
- `GET /files/v3/folders/{folderId}` → **400**  _{"status":"error","message":"id must be > 0","correlationId":"019db10a-86e7-7757-9e4a-67ed5cd887e2","context":{"id":["0"]},"category":"VALID_
- `GET /files/v3/folders/update/async/tasks/{taskId}/status` → **400**  _{"status":"error","message":"Provided ID could not be decoded.","correlationId":"019db10a-86e5-7bfa-b51d-c7a58070daa9","context":{"id":["475_
- `GET /crm/v3/imports/{importId}` → **400**  _{"status":"error","message":"importId must be positive.","correlationId":"019db10a-9181-75f3-8997-cea1f74bec53","context":{"importId":["0"]}_
- `GET /crm/v3/imports/{importId}/errors` → **400**  _{"status":"error","message":"importId must be positive.","correlationId":"019db10a-91fe-7e8d-82d2-7c820ba69532","context":{"importId":["0"]}_
- `GET /crm/v3/lists/idmapping` → **400**  _{"status":"error","message":"Id {{ id }} can't be converted to java.lang.Integer","correlationId":"019db10a-9467-7b47-aa4d-ca05541bc9b3","co_
- `GET /contacts/v1/lists/listid/contacts/all` → **400**  _{"status":"error","message":"Could not parse number from listId: listid","correlationId":"019db10a-b6fc-7f6b-aad7-6a7fbaeb36d2","category":"_
- `GET /contacts/v1/lists/listid/contacts/recent` → **400**  _{"status":"error","message":"Could not parse number from listId: listid","correlationId":"019db10a-b728-7adf-a373-69a2d18701a2","category":"_
- `GET /email/public/v1/events/created/{id}` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: created","correlationId":"019db10a-bd16-7f36-89dd-cd215a0e06f6"}_
- `GET /properties/v2/objecttype/groups` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db10a-c59b-77d3-b77c-04e765d91a2d"}_
- `GET /properties/v2/objecttype/groups/named/groupname` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db10a-c64b-7d4d-8818-200b2879923f"}_
- `GET /properties/v2/objecttype/properties` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db10a-c65d-7c19-a616-0af2e3c8c16c"}_
- `GET /properties/v2/objecttype/properties/named/name` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db10a-c684-729b-9511-9fd35349aab9"}_
- `GET /events/v3/events/` → **400**  _{"status":"error","message":"Must specify an eventType or objectType","correlationId":"019db10a-ca8e-7442-96d4-3c5c825bb6ea","category":"VAL_
- `GET /marketing/v3/emails/statistics/list` → **400**  _{"correlationId":"019db10a-cbbf-7480-b2f4-ab0769f367b5","message":"Unable to parse value for query parameter: startTimestamp","status":"erro_
- `GET /marketing/v3/emails/statistics/histogram` → **400**  _{"correlationId":"019db10a-cbc0-7803-844e-f417569b212b","message":"Unable to parse value for query parameter: startTimestamp","status":"erro_
- `GET /marketing/v3/marketing-events/events/search` → **400**  _{"status":"error","message":"validation error","correlationId":"019db10a-ce93-7413-942e-80dda89356e6","errors":["query param q may not be nu_
- `GET /marketing/v3/marketing-events/events/{externalEventId}` → **400**  _{"status":"error","message":"validation error","correlationId":"019db10a-ceb1-7a6f-af2c-891948a935d1","errors":["query param externalAccount_
- `GET /marketing/v3/marketing-events/{objectId}` → **400**  _{"status":"error","message":"Invalid value: '0' specified in objectId parameter. Should be a positive Long.","correlationId":"019db10a-cf75-_
- `GET /automation/v4/flows/email-campaigns` → **400**  _{"status":"error","message":"One or more flowId parameters are required for email campaign fetch.","correlationId":"019db10a-d4b3-7ca2-8f61-_
- `GET /automation/v4/sequences/` → **400**  _{"status":"error","message":"validation error","correlationId":"019db10a-d562-7da8-b090-66ed423cf439","errors":["query param userId may not _
- `GET /automation/v4/sequences/{sequenceId}` → **400**  _{"status":"error","message":"validation error","correlationId":"019db10a-d616-785f-96ea-660d143917c8","errors":["query param userId may not _

### 429 (1 endpoints)

- `POST /crm/v3/objects/subscriptions/search` → **429**  _{"status":"error","message":"You have reached your secondly limit.","errorType":"RATE_LIMIT","correlationId":"019db10a-a0b8-7b9d-9755-79f594_

### 5XX (13 endpoints)

- `GET /cms/v3/blogs/authors/{objectId}` → **500**  _{"correlationId":"019db10a-7cb7-7001-bc91-a6bb111b102a","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}` → **500**  _{"correlationId":"019db10a-7d77-7155-b243-ef182d7cfc63","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}/revisions` → **500**  _{"correlationId":"019db10a-7da2-729a-bea9-3c7e8ac9544f","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}/draft` → **500**  _{"correlationId":"019db10a-7dac-7b96-8eb8-18b703083f16","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/tags/{objectId}` → **500**  _{"correlationId":"019db10a-7eb4-7141-8344-3c391b5b977b","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/folders/{objectId}` → **500**  _{"correlationId":"019db10a-80c4-7217-aa68-f5a784683fc5","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/folders/{objectId}/revisions` → **500**  _{"correlationId":"019db10a-80c6-779d-a6b2-5fadd8a46e43","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}` → **500**  _{"correlationId":"019db10a-81a6-7a98-b2d6-3ea53a1ec3c6","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}/draft` → **500**  _{"correlationId":"019db10a-81c7-79c5-a579-9cfd9b57dbf8","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}/revisions` → **500**  _{"correlationId":"019db10a-81c1-774d-a919-440e30e9a815","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}/draft` → **500**  _{"correlationId":"019db10a-82cc-77d1-89b0-873a67bd53f0","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}` → **500**  _{"correlationId":"019db10a-82d8-7c31-9188-5d999c7d7f1d","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}/revisions` → **500**  _{"correlationId":"019db10a-83c7-7515-a178-2bd2d9cba0ff","message":"internal error","status":"error"}_

### SKIP-PARAM (66 endpoints)

- `GET /cms/v3/blog-settings/settings/{blogId}`  _unresolved: {blogId}_
- `GET /cms/v3/blog-settings/settings/{blogId}/revisions`  _unresolved: {blogId}_
- `GET /cms/v3/blog-settings/settings/{blogId}/revisions/{revisionId}`  _unresolved: {blogId}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}`  _unresolved: {tableIdOrName}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/draft`  _unresolved: {tableIdOrName}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/draft/export`  _unresolved: {tableIdOrName}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/export`  _unresolved: {tableIdOrName}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows`  _unresolved: {tableIdOrName}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft`  _unresolved: {tableIdOrName}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows/{rowId}`  _unresolved: {tableIdOrName},{rowId}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows/{rowId}/draft`  _unresolved: {tableIdOrName},{rowId}_
- `GET /cms/v3/site-search/indexed/data/{contentId}`  _unresolved: {contentId}_
- `GET /cms/v3/url-redirects/{urlRedirectId}`  _unresolved: {urlRedirectId}_
- `GET /files/v3/folders/{folderPath}`  _unresolved: {folderPath}_
- `GET /media-bridge/v1/{appId}/settings/object/definitions/{mediaType}`  _unresolved: {mediaType}_
- `GET /media-bridge/v1/{appId}/settings/oembed/domains/{oEmbedDomainId}`  _unresolved: {oEmbedDomainId}_
- `GET /crm/objects/v3/projects/{projectId}`  _unresolved: {projectId}_
- `GET /crm/v3/limits/associations/records/{fromObjectTypeId}/to`  _unresolved: {fromObjectTypeId}_
- `GET /crm/v3/limits/associations/records/{fromObjectTypeId}/{toObjectTypeId}`  _unresolved: {fromObjectTypeId},{toObjectTypeId}_
- `GET /crm/v3/lists/object/type/{id}/{objectTypeId}/name/{listName}`  _unresolved: {listName}_
- `GET /crm/v3/lists/records/{objectTypeId}/{recordId}/memberships`  _unresolved: {recordId}_
- `GET /crm/v3/objects/{0}/{410}`  _unresolved: {0},{410}_
- `POST /crm/v3/objects/{0}/{410}/search`  _unresolved: {0},{410}_
- `GET /crm/v3/objects/{0}/{410}/{courseId}`  _unresolved: {0},{410},{courseId}_
- `GET /crm/v3/objects/{0}/{420}`  _unresolved: {0},{420}_
- `POST /crm/v3/objects/{0}/{420}/search`  _unresolved: {0},{420}_
- `GET /crm/v3/objects/{0}/{420}/{listingId}`  _unresolved: {0},{420},{listingId}_
- `GET /crm/v3/property/validations/{objectTypeId}/{propertyName}/rule/type/{ruleType}`  _unresolved: {ruleType}_
- `GET /integrators/timeline/v3/events/{eventTemplateId}/{eventId}`  _unresolved: {eventTemplateId}_
- `GET /integrators/timeline/v3/events/{eventTemplateId}/{eventId}/detail`  _unresolved: {eventTemplateId}_

_(+36 more)_


## PASS endpoints (first 60)

- `GET /cms/v3/audit-logs/`
- `GET /cms/v3/blog-settings/settings`
- `GET /cms/v3/blogs/authors`
- `GET /cms/v3/blogs/posts`
- `GET /cms/v3/blogs/tags`
- `GET /cms/v3/domains/`
- `GET /cms/v3/domains/{domainId}`
- `GET /cms/v3/hubdb/tables`
- `GET /cms/v3/hubdb/tables/draft`
- `GET /cms/v3/pages/landing-pages`
- `GET /cms/v3/pages/landing-pages/folders`
- `GET /cms/v3/pages/site-pages`
- `GET /cms/v3/url-redirects/`
- `GET /files/v3/files/search`
- `GET /files/v3/folders/search`
- `GET /crm/associations/v4/definitions/configurations/all`
- `GET /crm/associations/v4/definitions/configurations/{fromObjectType}/{toObjectType}`
- `GET /crm/associations/v4/{fromObjectType}/{toObjectType}/labels`
- `GET /crm/objects/2025-09/{objectType}`
- `POST /crm/objects/2025-09/{objectType}/search`
- `GET /crm/objects/v3/projects`
- `POST /crm/objects/v3/projects/search`
- `GET /crm/objects/v3/{objectType}`
- `POST /crm/objects/v3/{objectType}/search`
- `GET /crm/v3/associations/{fromObjectType}/{toObjectType}/types`
- `GET /crm/v3/imports/`
- `GET /crm/v3/limits/associations/labels`
- `GET /crm/v3/limits/associations/records/from`
- `GET /crm/v3/limits/pipelines`
- `GET /crm/v3/limits/records`
- `GET /crm/v3/lists/`
- `GET /crm/v3/lists/folders`
- `POST /crm/v3/lists/search`
- `GET /crm/v3/objects/calls`
- `GET /crm/v3/objects/calls/{callId}`
- `GET /crm/v3/objects/carts`
- `POST /crm/v3/objects/calls/search`
- `POST /crm/v3/objects/carts/search`
- `GET /crm/v3/objects/communications`
- `POST /crm/v3/objects/communications/search`
- `GET /crm/v3/objects/companies/{companyId}`
- `POST /crm/v3/objects/companies/search`
- `GET /crm/v3/objects/companies`
- `GET /crm/v3/objects/contacts`
- `GET /crm/v3/objects/discounts`
- `POST /crm/v3/objects/contacts/search`
- `GET /crm/v3/objects/contacts/{contactId}`
- `POST /crm/v3/objects/discounts/search`
- `POST /crm/v3/objects/emails/search`
- `GET /crm/v3/objects/emails`
- `GET /crm/v3/objects/fees`
- `POST /crm/v3/objects/fees/search`
- `GET /crm/v3/objects/invoices`
- `POST /crm/v3/objects/invoices/search`
- `GET /crm/v3/objects/meetings`
- `POST /crm/v3/objects/meetings/search`
- `GET /crm/v3/objects/meetings/{meetingId}`
- `GET /crm/v3/objects/notes`
- `GET /crm/v3/objects/notes/{noteId}`
- `POST /crm/v3/objects/notes/search`

_(+93 more)_

