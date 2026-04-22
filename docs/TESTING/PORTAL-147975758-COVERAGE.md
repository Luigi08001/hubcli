# Portal Coverage Probe — 147975758 (EU1, free tier)

Generated: 2026-04-21T19:06:34.284Z  •  hscli @ f97fdd4  •  profile: `default`

Probed 438 read-only endpoints of 1180 total HubSpot API endpoints (only GET + safe POST /search).

## Summary

| Category | Count | % |
|---|---:|---:|
| **PASS** | 164 | 37.4% |
| **AUTH** | 27 | 6.2% |
| **404** | 151 | 34.5% |
| **METHOD** | 1 | 0.2% |
| **400** | 26 | 5.9% |
| **429** | 2 | 0.5% |
| **5XX** | 13 | 3.0% |
| **SKIP-PARAM** | 54 | 12.3% |

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
| cms | 66 | 22 |  | 6 | 11 |  | 4 |  | 13 | 10 |  |
| crm_core | 135 | 70 |  | 5 | 40 |  | 3 | 2 |  | 15 |  |
| general | 128 | 34 |  | 5 | 75 | 1 | 9 |  |  | 4 |  |
| marketing | 43 | 13 |  | 1 | 6 |  | 7 |  |  | 16 |  |
| operations | 10 | 2 |  | 7 |  |  | 1 |  |  |  |  |
| sales | 12 | 5 |  |  | 1 |  | 2 |  |  | 4 |  |
| service | 23 | 8 |  | 2 | 10 |  |  |  |  | 3 |  |
| settings | 21 | 10 |  | 1 | 8 |  |  |  |  | 2 |  |

## Endpoints by category (non-PASS, up to 30 each)

### AUTH (27 endpoints)

- `GET /media-bridge/v1/{appId}/properties/{objectType}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/properties/{objectType}/groups` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/properties/{objectType}/{propertyName}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/properties/{objectType}/groups/{groupName}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/schemas` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/schemas/{objectType}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /crm/v3/exports/export/async/tasks/{taskId}/status` → **403**  _{"status":"error","message":"Permission to get export file cannot be granted for exportId 478408617167 and portalId 147975758","correlationI_
- `GET /crm/v3/extensions/calling/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /crm/v3/extensions/calling/{appId}/settings/recording` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /crm/v3/extensions/videoconferencing/settings/{appId}` → **403**  _{"status":"error","message":"The scope needed for this API call isn't available for public use. If you have questions, contact support or po_
- `GET /crm/v3/extensions/cards/dev/{appId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /email/public/v1/smtpapi/tokens` → **403**  _{"status":"error","message":"This app hasn't been granted all required scopes to make this call. Read more about required scopes here: https_
- `GET /owners/v2/owners` → **401**  _{"status":"error","message":"Any of the listed authentication credentials are missing","correlationId":"019db16f-c7d6-792c-85f9-2b1ad81939d1_
- `GET /webhooks/v3/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /webhooks/v3/{appId}/subscriptions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /webhooks/v3/{appId}/subscriptions/{subscriptionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /marketing/v3/marketing-events/{appId}/settings` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /automation/v4/actions/{appId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/revisions/{revisionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/revisions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /conversations/v3/custom-channels/` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /conversations/v3/custom-channels/{channelId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /business-units/v3/business-units/user/{userId}` → **403**  _{"status":"error","message":"This app hasn't been granted all required scopes to make this call. Read more about required scopes here: https_

### 404 (151 endpoints)

- `GET /cms/v3/blogs/posts/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/landing-pages/folders/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/landing-pages/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/site-pages/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/source-code/{environment}/content/{path}` → **404**  _{"status":"error","message":"resource not found","correlationId":"019db16f-8a39-72ff-ab01-140b98f1cdbb"}_
- `GET /cms/v3/source-code/{environment}/metadata/{path}` → **404**  _{"status":"error","message":"resource not found","correlationId":"019db16f-8a2a-7d5b-8f58-057cda54f149"}_
- `GET /files/v3/files/import/from/url/async/tasks/{taskId}/status` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /files/v3/files/stat/{path}` → **404**  _{"status":"error","message":"No file or folder exists at path","correlationId":"019db16f-8b51-7b27-8439-14de955bd9d6"}_
- `GET /files/v3/files/{fileId}/signed/url` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /media-bridge/v1/{appId}/settings/event/visibility` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /media-bridge/v1/{appId}/settings/oembed/domains` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/object-schemas/v3/schemas` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_
- `GET /crm/objects/2025-09/{objectType}/{objectId}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db16f-907b-735c-9d4e-f62df30199b7","contex_
- `GET /crm/object-schemas/v3/schemas/{objectType}` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_
- `GET /crm/objects/2025-09/{objectType}/{objectId}/associations/{toObjectType}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db16f-916f-785a-bcf4-2004e463b4c3","contex_
- `GET /crm/objects/v3/{objectType}/{objectId}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db16f-9279-7f55-b451-5b9d2cb2c6e1","contex_
- `GET /crm/properties/2025-09/{objectType}/groups` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/properties/2025-09/{objectType}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/properties/2025-09/{objectType}/groups/{groupName}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/properties/2025-09/{objectType}/{propertyName}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/calling/{appId}/settings/channel/connection` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/cards/dev/sample/response` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/cards/dev/{appId}/{cardId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/calculated/properties` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/custom/object/types` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/custom/properties` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/lists/{listId}/memberships/join/order` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/object/library/enablement` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_
- `GET /crm/v3/lists/{listId}/schedule/conversion` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/object/library/enablement/{objectTypeId}` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_

_(+121 more)_

### METHOD (1 endpoints)

- `GET /reports/v2/events/batch` → **405**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 405 Method Not Allowed</title> </head> <body>_

### 400 (26 endpoints)

- `GET /cms/v3/site-search/search` → **400**  _{"status":"error","message":"Invalid input JSON on line -1, column -1: Cannot build PublicSearchRequest, some of required attributes are not_
- `GET /cms/v3/source-code/extract/async/tasks/{taskId}/status` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: taskId","correlationId":"019db16f-8a19-71bd-a97c-847bdb4df2ab"}_
- `GET /files/v3/folders/{folderId}` → **400**  _{"status":"error","message":"id must be > 0","correlationId":"019db16f-8c68-7188-8a44-14b4911ae6c8","context":{"id":["0"]},"category":"VALID_
- `GET /files/v3/folders/update/async/tasks/{taskId}/status` → **400**  _{"status":"error","message":"Provided ID could not be decoded.","correlationId":"019db16f-8c90-72b0-b3f7-d1e4b1d02aaf","context":{"id":["478_
- `GET /crm/v3/imports/{importId}` → **400**  _{"status":"error","message":"importId must be positive.","correlationId":"019db16f-9698-7556-bea4-acec42e9f0dc","context":{"importId":["0"]}_
- `GET /crm/v3/imports/{importId}/errors` → **400**  _{"status":"error","message":"importId must be positive.","correlationId":"019db16f-978b-7f5e-9c62-4d234ffc3eb3","context":{"importId":["0"]}_
- `GET /crm/v3/lists/idmapping` → **400**  _{"status":"error","message":"Id {{ id }} can't be converted to java.lang.Integer","correlationId":"019db16f-9a01-7757-bdc9-f310ef103081","co_
- `GET /automation/v3/performance/workflow/{workflowId}` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: workflowId","correlationId":"019db16f-b572-7ab5-95c8-b4e5d3937f8e"}_
- `GET /automation/v3/workflows/{workflowId}` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: workflowId","correlationId":"019db16f-b654-75a2-bc96-a3dad57e6eb8"}_
- `GET /contacts/v1/lists/listid/contacts/recent` → **400**  _{"status":"error","message":"Could not parse number from listId: listid","correlationId":"019db16f-bc6d-76de-843b-ea863359ff02","category":"_
- `GET /contacts/v1/lists/listid/contacts/all` → **400**  _{"status":"error","message":"Could not parse number from listId: listid","correlationId":"019db16f-bc84-7167-9764-db486c19dd1d","category":"_
- `GET /email/public/v1/events/created/{id}` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: created","correlationId":"019db16f-c28c-753c-84d0-2c7ed9b7349a"}_
- `GET /properties/v2/objecttype/groups` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db16f-cb03-7832-9139-5d694b202782"}_
- `GET /properties/v2/objecttype/groups/named/groupname` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db16f-cbb1-7edf-8ccb-b283c1d3c537"}_
- `GET /properties/v2/objecttype/properties` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db16f-cbbd-75a0-9f2a-7a4d26746cdc"}_
- `GET /properties/v2/objecttype/properties/named/name` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db16f-cbd4-756d-8bfe-4fe83ec41818"}_
- `GET /events/v3/events/` → **400**  _{"status":"error","message":"Must specify an eventType or objectType","correlationId":"019db16f-cff5-7298-a411-cce9c03ab94b","category":"VAL_
- `GET /marketing/v3/emails/statistics/histogram` → **400**  _{"correlationId":"019db16f-d202-725c-85b7-f251c2ed9ec9","message":"Unable to parse value for query parameter: startTimestamp","status":"erro_
- `GET /marketing/v3/emails/statistics/list` → **400**  _{"correlationId":"019db16f-d2b4-705d-8360-3a112bb1b1cf","message":"Unable to parse value for query parameter: startTimestamp","status":"erro_
- `GET /marketing/v3/campaigns/{campaignGuid}/reports/revenue` → **400**  _{"status":"error","message":"There was a problem with the request.","correlationId":"019db16f-d1d7-7756-ab6b-883f848a4f1f"}_
- `GET /marketing/v3/marketing-events/events/search` → **400**  _{"status":"error","message":"validation error","correlationId":"019db16f-d50f-76f1-b1f3-f38b8a4cdd10","errors":["query param q may not be nu_
- `GET /marketing/v3/marketing-events/events/{externalEventId}` → **400**  _{"status":"error","message":"validation error","correlationId":"019db16f-d52d-703d-84fa-13cce5745cf7","errors":["query param externalAccount_
- `GET /marketing/v3/marketing-events/{objectId}` → **400**  _{"status":"error","message":"Invalid value: '0' specified in objectId parameter. Should be a positive Long.","correlationId":"019db16f-d5fa-_
- `GET /automation/v4/flows/email-campaigns` → **400**  _{"status":"error","message":"One or more flowId parameters are required for email campaign fetch.","correlationId":"019db16f-da7e-787b-9841-_
- `GET /automation/v4/sequences/` → **400**  _{"status":"error","message":"validation error","correlationId":"019db16f-dbd4-7f7a-a1da-45f4fe65ac53","errors":["query param userId may not _
- `GET /automation/v4/sequences/{sequenceId}` → **400**  _{"status":"error","message":"validation error","correlationId":"019db16f-dbe3-7203-9ffa-85538fb48a53","errors":["query param userId may not _

### 429 (2 endpoints)

- `POST /crm/v3/objects/discounts/search` → **429**  _{"status":"error","message":"You have reached your secondly limit.","errorType":"RATE_LIMIT","correlationId":"019db16f-9fbe-7d30-b847-3412e5_
- `POST /crm/v3/objects/taxes/search` → **429**  _{"status":"error","message":"You have reached your secondly limit.","errorType":"RATE_LIMIT","correlationId":"019db16f-a7e5-73de-9955-30fd29_

### 5XX (13 endpoints)

- `GET /cms/v3/blogs/authors/{objectId}` → **500**  _{"correlationId":"019db16f-8156-78b7-a699-19dd14589dc2","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}` → **500**  _{"correlationId":"019db16f-8229-7124-82af-85c8a6b1d4fb","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}/draft` → **500**  _{"correlationId":"019db16f-823f-7647-8a2f-1665e24007f2","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}/revisions` → **500**  _{"correlationId":"019db16f-82a5-70ee-a129-4d893f0ffe47","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/tags/{objectId}` → **500**  _{"correlationId":"019db16f-831c-7564-bcb0-0d4017cce6b5","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/folders/{objectId}` → **500**  _{"correlationId":"019db16f-8665-713d-8314-27e1ad25bf9a","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/folders/{objectId}/revisions` → **500**  _{"correlationId":"019db16f-8722-7bd2-8a02-e432ac2a2e19","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}` → **500**  _{"correlationId":"019db16f-8739-7d7c-a0f2-7be93e4b9882","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}/draft` → **500**  _{"correlationId":"019db16f-8772-7d7a-ab1a-6bec2da4eb49","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}/revisions` → **500**  _{"correlationId":"019db16f-8804-7d7c-ac87-7f4c0db100f1","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}` → **500**  _{"correlationId":"019db16f-8856-7ad7-bf12-4b9f1d7ddbc3","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}/draft` → **500**  _{"correlationId":"019db16f-893d-767a-b240-b2f8ba0e9348","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}/revisions` → **500**  _{"correlationId":"019db16f-8941-7c8d-acf2-27725dd7d7df","message":"internal error","status":"error"}_

### SKIP-PARAM (54 endpoints)

- `GET /cms/v3/blog-settings/settings/{blogId}`  _unresolved: {blogId}_
- `GET /cms/v3/blog-settings/settings/{blogId}/revisions`  _unresolved: {blogId}_
- `GET /cms/v3/blog-settings/settings/{blogId}/revisions/{revisionId}`  _unresolved: {blogId}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows/{rowId}`  _unresolved: {rowId}_
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows/{rowId}/draft`  _unresolved: {rowId}_
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
- `GET /crm/v3/objects/{0}/{410}`  _unresolved: <scrape-artifact>_
- `POST /crm/v3/objects/{0}/{410}/search`  _unresolved: <scrape-artifact>_
- `GET /crm/v3/objects/{0}/{410}/{courseId}`  _unresolved: <scrape-artifact>_
- `GET /crm/v3/objects/{0}/{420}`  _unresolved: <scrape-artifact>_
- `POST /crm/v3/objects/{0}/{420}/search`  _unresolved: <scrape-artifact>_
- `GET /crm/v3/objects/{0}/{420}/{listingId}`  _unresolved: <scrape-artifact>_
- `GET /crm/v3/property/validations/{objectTypeId}/{propertyName}/rule/type/{ruleType}`  _unresolved: {ruleType}_
- `GET /integrators/timeline/v3/events/{eventTemplateId}/{eventId}`  _unresolved: {eventTemplateId}_
- `GET /integrators/timeline/v3/events/{eventTemplateId}/{eventId}/detail`  _unresolved: {eventTemplateId}_
- `GET /integrators/timeline/v3/{appId}/event/templates/{eventTemplateId}`  _unresolved: {eventTemplateId}_
- `GET /contacts/v1/{contactbyUtk}/batch`  _unresolved: {contactbyUtk}_
- `GET /crm/associations/v1/associations/{objectIdHUBSPOTDEFINEDdefinition}/{id}`  _unresolved: {objectIdHUBSPOTDEFINEDdefinition}_
- `GET /oauth/v1/access-tokens/{token}`  _unresolved: {token}_
- `GET /oauth/v1/refresh-tokens/{token}`  _unresolved: {token}_
- `GET /communication/preferences/v3/status/email/{emailAddress}`  _unresolved: {emailAddress}_

_(+24 more)_


## PASS endpoints (first 60)

- `GET /cms/v3/blog-settings/settings`
- `GET /cms/v3/blogs/authors`
- `GET /cms/v3/audit-logs/`
- `GET /cms/v3/blogs/posts`
- `GET /cms/v3/blogs/tags`
- `GET /cms/v3/domains/`
- `GET /cms/v3/domains/{domainId}`
- `GET /cms/v3/hubdb/tables/draft`
- `GET /cms/v3/hubdb/tables`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/draft`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/draft/export`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/export`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows`
- `GET /cms/v3/pages/landing-pages/folders`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft`
- `GET /cms/v3/pages/landing-pages`
- `GET /cms/v3/pages/site-pages`
- `GET /cms/v3/url-redirects/`
- `GET /files/v3/files/search`
- `GET /files/v3/files/{fileId}`
- `GET /files/v3/folders/search`
- `GET /crm/associations/v4/definitions/configurations/{fromObjectType}/{toObjectType}`
- `GET /crm/associations/v4/{fromObjectType}/{toObjectType}/labels`
- `GET /crm/associations/v4/definitions/configurations/all`
- `POST /crm/objects/2025-09/{objectType}/search`
- `GET /crm/objects/2025-09/{objectType}`
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
- `GET /crm/v3/lists/{listId}/memberships`
- `GET /crm/v3/lists/{listId}`
- `GET /crm/v3/objects/calls`
- `GET /crm/v3/objects/carts`
- `GET /crm/v3/objects/calls/{callId}`
- `POST /crm/v3/objects/calls/search`
- `POST /crm/v3/objects/carts/search`
- `POST /crm/v3/objects/communications/search`
- `GET /crm/v3/objects/communications`
- `GET /crm/v3/objects/companies`
- `POST /crm/v3/objects/companies/search`
- `GET /crm/v3/objects/contacts`
- `GET /crm/v3/objects/companies/{companyId}`
- `GET /crm/v3/objects/discounts`
- `GET /crm/v3/objects/contacts/{contactId}`
- `POST /crm/v3/objects/contacts/search`
- `POST /crm/v3/objects/emails/search`
- `GET /crm/v3/objects/emails`
- `POST /crm/v3/objects/fees/search`
- `GET /crm/v3/objects/fees`

_(+104 more)_

