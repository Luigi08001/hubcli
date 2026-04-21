# Portal Coverage Probe — 147975758 (EU1, free tier)

Generated: 2026-04-21T18:10:31.962Z  •  hubcli @ 1a27699  •  profile: `default`

Probed 438 read-only endpoints of 1180 total HubSpot API endpoints (only GET + safe POST /search).

## Summary

| Category | Count | % |
|---|---:|---:|
| **PASS** | 161 | 36.8% |
| **AUTH** | 27 | 6.2% |
| **404** | 151 | 34.5% |
| **METHOD** | 1 | 0.2% |
| **400** | 26 | 5.9% |
| **429** | 1 | 0.2% |
| **5XX** | 13 | 3.0% |
| **SKIP-PARAM** | 58 | 13.2% |

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
| cms | 66 | 21 |  | 6 | 11 |  | 5 |  | 13 | 10 |  |
| crm_core | 135 | 71 |  | 5 | 40 |  | 3 | 1 |  | 15 |  |
| general | 128 | 34 |  | 5 | 75 | 1 | 9 |  |  | 4 |  |
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
- `GET /media-bridge/v1/{appId}/schemas/{objectType}` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /media-bridge/v1/{appId}/schemas` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /crm/v3/exports/export/async/tasks/{taskId}/status` → **403**  _{"status":"error","message":"Permission to get export file cannot be granted for exportId 475549724882 and portalId 147975758","correlationI_
- `GET /crm/v3/extensions/calling/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /crm/v3/extensions/calling/{appId}/settings/recording` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /crm/v3/extensions/cards/dev/{appId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /crm/v3/extensions/videoconferencing/settings/{appId}` → **403**  _{"status":"error","message":"The scope needed for this API call isn't available for public use. If you have questions, contact support or po_
- `GET /email/public/v1/smtpapi/tokens` → **403**  _{"status":"error","message":"This app hasn't been granted all required scopes to make this call. Read more about required scopes here: https_
- `GET /owners/v2/owners` → **401**  _{"status":"error","message":"Any of the listed authentication credentials are missing","correlationId":"019db13c-7ae8-744d-a36f-96e911a8bd46_
- `GET /webhooks/v3/{appId}/settings` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /webhooks/v3/{appId}/subscriptions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /webhooks/v3/{appId}/subscriptions/{subscriptionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /marketing/v3/marketing-events/{appId}/settings` → **403**  _{"status":"error","message":"This API can't be called using an OAuth access token. A valid developer API key must be provided in the `hapike_
- `GET /automation/v4/actions/{appId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/functions/{functionType}/{functionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/revisions/{revisionId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /automation/v4/actions/{appId}/{definitionId}/revisions` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /conversations/v3/custom-channels/` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /conversations/v3/custom-channels/{channelId}` → **401**  _{"status":"error","message":"Authentication credentials not found. This API supports OAuth 2.0 authentication and you can find more details _
- `GET /business-units/v3/business-units/user/{userId}` → **403**  _{"status":"error","message":"This app hasn't been granted all required scopes to make this call. Read more about required scopes here: https_

### 404 (151 endpoints)

- `GET /cms/v3/blogs/posts/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/landing-pages/folders/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/landing-pages/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/pages/site-pages/{objectId}/revisions/{revisionId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /cms/v3/source-code/{environment}/content/{path}` → **404**  _{"status":"error","message":"resource not found","correlationId":"019db13c-3d51-7874-b1d9-dec7d7012169"}_
- `GET /cms/v3/source-code/{environment}/metadata/{path}` → **404**  _{"status":"error","message":"resource not found","correlationId":"019db13c-3d53-75d0-aaa8-c1d340a1db0b"}_
- `GET /files/v3/files/import/from/url/async/tasks/{taskId}/status` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /files/v3/files/stat/{path}` → **404**  _{"status":"error","message":"No file or folder exists at path","correlationId":"019db13c-3e43-7b5d-b453-adcb318d1e2a"}_
- `GET /files/v3/files/{fileId}/signed/url` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /media-bridge/v1/{appId}/settings/event/visibility` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /media-bridge/v1/{appId}/settings/oembed/domains` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/object-schemas/v3/schemas` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_
- `GET /crm/objects/2025-09/{objectType}/{objectId}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db13c-4370-7a24-850b-c0f3753bab54","contex_
- `GET /crm/object-schemas/v3/schemas/{objectType}` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_
- `GET /crm/objects/2025-09/{objectType}/{objectId}/associations/{toObjectType}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db13c-4457-7905-9d89-0d8618ff3e65","contex_
- `GET /crm/properties/2025-09/{objectType}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/objects/v3/{objectType}/{objectId}` → **404**  _{"status":"error","message":"Object not found. objectId is usually positive.","correlationId":"019db13c-457f-7928-b00a-e45c8e5a1384","contex_
- `GET /crm/properties/2025-09/{objectType}/groups` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/properties/2025-09/{objectType}/groups/{groupName}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/properties/2025-09/{objectType}/{propertyName}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/calling/{appId}/settings/channel/connection` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/cards/dev/sample/response` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/extensions/cards/dev/{appId}/{cardId}` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/calculated/properties` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/custom/object/types` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/limits/custom/properties` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/lists/{listId}/memberships/join/order` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/lists/{listId}/schedule/conversion` → **404**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 404 Not Found</title> </head> <body><h2>HTTP _
- `GET /crm/v3/object/library/enablement/{objectTypeId}` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_
- `GET /crm/v3/object/library/enablement` → **404**  _<!DOCTYPE html> <html lang=en><meta charset=utf-8><title>Error</title><style>*,*::before,*::after{box-sizing:border-box}html,body{margin:0px_

_(+121 more)_

### METHOD (1 endpoints)

- `GET /reports/v2/events/batch` → **405**  _<html> <head> <meta http-equiv="Content-Type" content="text/html;charset=utf-8"/> <title>Error 405 Method Not Allowed</title> </head> <body>_

### 400 (26 endpoints)

- `GET /cms/v3/site-search/search` → **400**  _{"status":"error","message":"Invalid input JSON on line -1, column -1: Cannot build PublicSearchRequest, some of required attributes are not_
- `GET /cms/v3/source-code/extract/async/tasks/{taskId}/status` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: taskId","correlationId":"019db13c-3d57-753f-b9c2-ba1b3671acef"}_
- `GET /files/v3/files/{fileId}` → **400**  _{"status":"error","message":"id must be > 0","correlationId":"019db13c-3e51-7a76-9739-647a30676eb7","context":{"id":["0"]},"category":"VALID_
- `GET /files/v3/folders/update/async/tasks/{taskId}/status` → **400**  _{"status":"error","message":"Provided ID could not be decoded.","correlationId":"019db13c-3f65-7090-b003-0c6dcfc7abcf","context":{"id":["475_
- `GET /files/v3/folders/{folderId}` → **400**  _{"status":"error","message":"id must be > 0","correlationId":"019db13c-3f83-70f6-8bea-4685719420cb","context":{"id":["0"]},"category":"VALID_
- `GET /crm/v3/imports/{importId}` → **400**  _{"status":"error","message":"importId must be positive.","correlationId":"019db13c-499a-7db2-917d-26b6105a71ca","context":{"importId":["0"]}_
- `GET /crm/v3/imports/{importId}/errors` → **400**  _{"status":"error","message":"importId must be positive.","correlationId":"019db13c-4a72-71ae-9a21-eebc3f5fc9d9","context":{"importId":["0"]}_
- `GET /crm/v3/lists/idmapping` → **400**  _{"status":"error","message":"Id {{ id }} can't be converted to java.lang.Integer","correlationId":"019db13c-4ccb-70ba-beb3-671a5bd09c93","co_
- `GET /automation/v3/performance/workflow/{workflowId}` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: workflowId","correlationId":"019db13c-690c-7158-b343-faffdbe82bcc"}_
- `GET /automation/v3/workflows/{workflowId}` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: workflowId","correlationId":"019db13c-692a-719f-a5a3-9f54ff53796a"}_
- `GET /contacts/v1/lists/listid/contacts/all` → **400**  _{"status":"error","message":"Could not parse number from listId: listid","correlationId":"019db13c-6f8f-7aaa-ac40-519a30326c98","category":"_
- `GET /contacts/v1/lists/listid/contacts/recent` → **400**  _{"status":"error","message":"Could not parse number from listId: listid","correlationId":"019db13c-705e-7ecf-874d-d0f9901aba47","category":"_
- `GET /email/public/v1/events/created/{id}` → **400**  _{"status":"error","message":"Unable to parse value for path parameter: created","correlationId":"019db13c-75c4-78e8-acb8-bc5a73b40dda"}_
- `GET /properties/v2/objecttype/groups` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db13c-7eb2-7ab4-97a8-06b80279f869"}_
- `GET /properties/v2/objecttype/groups/named/groupname` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db13c-7ed2-7d3a-bec6-b89a68d93fe4"}_
- `GET /properties/v2/objecttype/properties` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db13c-7ed7-79a8-9c80-3ce145def106"}_
- `GET /properties/v2/objecttype/properties/named/name` → **400**  _{"status":"error","message":"Unable to infer object type from: objecttype","correlationId":"019db13c-7f10-7d4b-81d0-c03ed1caa0b3"}_
- `GET /events/v3/events/` → **400**  _{"status":"error","message":"Must specify an eventType or objectType","correlationId":"019db13c-8316-72dc-bcd0-6297e604c95b","category":"VAL_
- `GET /marketing/v3/emails/statistics/histogram` → **400**  _{"correlationId":"019db13c-8444-78da-9100-4a06c4644519","message":"Unable to parse value for query parameter: startTimestamp","status":"erro_
- `GET /marketing/v3/emails/statistics/list` → **400**  _{"correlationId":"019db13c-84d6-70a5-87d5-3863b901a6cf","message":"Unable to parse value for query parameter: startTimestamp","status":"erro_
- `GET /marketing/v3/marketing-events/events/search` → **400**  _{"status":"error","message":"validation error","correlationId":"019db13c-871a-7357-bcad-cd8b1b85a17d","errors":["query param q may not be nu_
- `GET /marketing/v3/marketing-events/events/{externalEventId}` → **400**  _{"status":"error","message":"validation error","correlationId":"019db13c-871d-7660-9a58-98dfa5bb45d1","errors":["query param externalAccount_
- `GET /marketing/v3/marketing-events/{objectId}` → **400**  _{"status":"error","message":"Invalid value: '0' specified in objectId parameter. Should be a positive Long.","correlationId":"019db13c-87f4-_
- `GET /automation/v4/flows/email-campaigns` → **400**  _{"status":"error","message":"One or more flowId parameters are required for email campaign fetch.","correlationId":"019db13c-8ca3-756c-b64c-_
- `GET /automation/v4/sequences/` → **400**  _{"status":"error","message":"validation error","correlationId":"019db13c-8db8-7039-a2b8-88329b22c3fc","errors":["query param userId may not _
- `GET /automation/v4/sequences/{sequenceId}` → **400**  _{"status":"error","message":"validation error","correlationId":"019db13c-8deb-7e69-b8be-e4f563558fb6","errors":["query param userId may not _

### 429 (1 endpoints)

- `POST /crm/v3/objects/users/search` → **429**  _{"status":"error","message":"You have reached your secondly limit.","errorType":"RATE_LIMIT","correlationId":"019db13c-5afa-7be9-93e0-0a90d2_

### 5XX (13 endpoints)

- `GET /cms/v3/blogs/authors/{objectId}` → **500**  _{"correlationId":"019db13c-3424-7f84-971e-ebef3a643450","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}` → **500**  _{"correlationId":"019db13c-3517-721b-b3d4-ac15872d2f61","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}/draft` → **500**  _{"correlationId":"019db13c-3520-72e2-beb7-f964e34fe94b","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/posts/{objectId}/revisions` → **500**  _{"correlationId":"019db13c-3521-7d24-8f73-9bf49d5141fd","message":"internal error","status":"error"}_
- `GET /cms/v3/blogs/tags/{objectId}` → **500**  _{"correlationId":"019db13c-360b-74e8-a607-b558602a20c5","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/folders/{objectId}` → **500**  _{"correlationId":"019db13c-3946-7e6a-9b68-25fbb7714df7","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/folders/{objectId}/revisions` → **500**  _{"correlationId":"019db13c-3a27-7316-9685-7c8fb52c592c","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}` → **500**  _{"correlationId":"019db13c-3a3c-7bee-89af-4325c2928b8e","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}/draft` → **500**  _{"correlationId":"019db13c-3a4c-7c05-b8ee-70367033de71","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}` → **500**  _{"correlationId":"019db13c-3b40-705d-a737-d214908b6a0b","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/landing-pages/{objectId}/revisions` → **500**  _{"correlationId":"019db13c-3b3e-7bd5-ae6e-d00d885d7530","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}/revisions` → **500**  _{"correlationId":"019db13c-3c2c-77bc-8e27-7ee1c1ad6964","message":"internal error","status":"error"}_
- `GET /cms/v3/pages/site-pages/{objectId}/draft` → **500**  _{"correlationId":"019db13c-3c38-7258-b737-ddb6ebec0cef","message":"internal error","status":"error"}_

### SKIP-PARAM (58 endpoints)

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

_(+28 more)_


## PASS endpoints (first 60)

- `GET /cms/v3/blog-settings/settings`
- `GET /cms/v3/blogs/authors`
- `GET /cms/v3/audit-logs/`
- `GET /cms/v3/blogs/posts`
- `GET /cms/v3/blogs/tags`
- `GET /cms/v3/domains/`
- `GET /cms/v3/hubdb/tables/draft`
- `GET /cms/v3/domains/{domainId}`
- `GET /cms/v3/hubdb/tables`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/draft/export`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/export`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/draft`
- `GET /cms/v3/hubdb/tables/{tableIdOrName}/rows/draft`
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
- `GET /crm/v3/lists/{listId}`
- `GET /crm/v3/lists/{listId}/memberships`
- `GET /crm/v3/objects/calls`
- `POST /crm/v3/objects/calls/search`
- `GET /crm/v3/objects/calls/{callId}`
- `GET /crm/v3/objects/carts`
- `POST /crm/v3/objects/carts/search`
- `GET /crm/v3/objects/communications`
- `POST /crm/v3/objects/communications/search`
- `GET /crm/v3/objects/companies`
- `GET /crm/v3/objects/companies/{companyId}`
- `POST /crm/v3/objects/companies/search`
- `GET /crm/v3/objects/contacts`
- `POST /crm/v3/objects/contacts/search`
- `GET /crm/v3/objects/discounts`
- `GET /crm/v3/objects/contacts/{contactId}`
- `POST /crm/v3/objects/discounts/search`
- `POST /crm/v3/objects/emails/search`
- `GET /crm/v3/objects/emails`
- `GET /crm/v3/objects/fees`
- `POST /crm/v3/objects/fees/search`

_(+101 more)_

