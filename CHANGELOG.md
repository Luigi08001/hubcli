# Changelog

> See also: [[ROADMAP_PHASE1_TO_3]] · [[RELEASE_GOVERNANCE]]

## 0.2.0 - 2026-03-05
- Added CRM tickets command family.
- Added strict allowlists for objectType inputs with domain-specific scope.
- Added enterprise safety controls:
  - policy file support (`--policy-file`)
  - change-ticket enforcement (`--change-ticket`) when policy requires it
- Added request observability:
  - run correlation id (`X-Hubcli-Request-Id`)
  - optional telemetry JSONL (`--telemetry-file`)
- Added CRM lifecycle operations:
  - delete/archive, merge, batch-read, batch-upsert, batch-archive
- Added CRM custom object support:
  - schema list/get/create/update
  - record list/get/search/create/update/delete
- Added CRM engagement support:
  - notes, calls, tasks, emails, meetings
- Added incremental sync utility:
  - `crm sync pull`
- Added top-level domain command groups:
  - `marketing`, `forms`, `files`, `cms`, `workflows`, `service`
- Added raw API command:
  - `api request`
- Expanded MCP catalog:
  - lifecycle object tools (delete/merge/batch)
  - custom object schema/record tools
  - raw `hub_api_request`
- Added OAuth-oriented auth commands:
  - `auth profiles`, `auth profile-show`, `auth token-info`
  - `auth oauth-url`, `auth oauth-exchange`
- Added release governance + compatibility docs and sandbox contract test scaffolding.
