# MCP Support (`hubcli mcp`)

> See also: [[ARCHITECTURE]] · [[SAFETY_MODEL]] · [[COMMAND_TREE]] · [[tooling]]

`hubcli` now exposes a Model Context Protocol (MCP) server over **stdio**.

## Run

```bash
npm run build
node dist/cli.js mcp
```

Or if installed globally:

```bash
hubcli mcp
```

## Profile isolation and safety defaults

- **Profile isolation**: set `HUBCLI_MCP_PROFILE=<profile>` to hard-lock the MCP server to one auth profile.
  - If a tool call requests a different profile, the server rejects it.
- **Write tools are dry-run by default**:
  - `force: true` is required to execute actual writes.
  - Without `force`, write tools return a dry-run payload (`{ dryRun: true, method, path, body }`).
- **Lifecycle coverage for CRM objects**:
  - standard object tools now include delete, merge, batch read/upsert/archive.
- **Strict object type allowlist**:
  - Object tools: `contacts`, `companies`, `deals`, `tickets`
  - Properties/associations object types: `contacts`, `companies`, `deals`, `tickets`
  - Pipeline object types: `deals`, `tickets`
- **Secrets redaction**:
  - Token-like fields and bearer strings are redacted in MCP tool outputs and errors.

## Claude Desktop setup

Add a server entry in your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "hubcli": {
      "command": "node",
      "args": ["/absolute/path/to/hubcli/dist/cli.js", "mcp"],
      "env": {
        "HUBCLI_HOME": "/absolute/path/to/.hubcli",
        "HUBCLI_MCP_PROFILE": "default"
      }
    }
  }
}
```

If `hubcli` is on your PATH you can use:

```json
{
  "mcpServers": {
    "hubcli": {
      "command": "hubcli",
      "args": ["mcp"]
    }
  }
}
```

## OpenAI-compatible MCP clients

Use a stdio server command equivalent to:

- command: `hubcli`
- args: `mcp`

If your client accepts env vars, set:

- `HUBCLI_HOME` to the auth profile directory containing `auth.json`
- `HUBCLI_MCP_PROFILE` to force strict profile isolation

## Tool catalog

### Contacts
- `crm_contacts_list`
- `crm_contacts_get`
- `crm_contacts_search`
- `crm_contacts_create` *(write, dry-run by default)*
- `crm_contacts_update` *(write, dry-run by default)*
- `crm_contacts_delete` *(write, dry-run by default)*
- `crm_contacts_merge` *(write, dry-run by default)*
- `crm_contacts_batch_read`
- `crm_contacts_batch_upsert` *(write, dry-run by default)*
- `crm_contacts_batch_archive` *(write, dry-run by default)*

### Companies
- `crm_companies_list`
- `crm_companies_get`
- `crm_companies_search`
- `crm_companies_create` *(write, dry-run by default)*
- `crm_companies_update` *(write, dry-run by default)*
- `crm_companies_delete` *(write, dry-run by default)*
- `crm_companies_merge` *(write, dry-run by default)*
- `crm_companies_batch_read`
- `crm_companies_batch_upsert` *(write, dry-run by default)*
- `crm_companies_batch_archive` *(write, dry-run by default)*

### Deals
- `crm_deals_list`
- `crm_deals_get`
- `crm_deals_search`
- `crm_deals_create` *(write, dry-run by default)*
- `crm_deals_update` *(write, dry-run by default)*
- `crm_deals_delete` *(write, dry-run by default)*
- `crm_deals_merge` *(write, dry-run by default)*
- `crm_deals_batch_read`
- `crm_deals_batch_upsert` *(write, dry-run by default)*
- `crm_deals_batch_archive` *(write, dry-run by default)*

### Tickets
- `crm_tickets_list`
- `crm_tickets_get`
- `crm_tickets_search`
- `crm_tickets_create` *(write, dry-run by default)*
- `crm_tickets_update` *(write, dry-run by default)*
- `crm_tickets_delete` *(write, dry-run by default)*
- `crm_tickets_merge` *(write, dry-run by default)*
- `crm_tickets_batch_read`
- `crm_tickets_batch_upsert` *(write, dry-run by default)*
- `crm_tickets_batch_archive` *(write, dry-run by default)*

### Engagements
- `crm_notes_*` (`list/get/search/create/update/delete`)
- `crm_calls_*` (`list/get/search/create/update/delete`)
- `crm_tasks_*` (`list/get/search/create/update/delete`)
- `crm_emails_*` (`list/get/search/create/update/delete`)
- `crm_meetings_*` (`list/get/search/create/update/delete`)

### Properties
- `crm_properties_list`
- `crm_properties_get`
- `crm_properties_create` *(write, dry-run by default)*
- `crm_properties_update` *(write, dry-run by default)*

### Associations
- `crm_associations_list`
- `crm_associations_create` *(write, dry-run by default)*
- `crm_associations_remove` *(write, dry-run by default)*

### Imports
- `crm_imports_create` *(write, dry-run by default)*
- `crm_imports_list`
- `crm_imports_get`
- `crm_imports_errors`

### Owners
- `crm_owners_list`

### Pipelines
- `crm_pipelines_list`
- `crm_pipelines_get`

### Custom Objects
- `crm_custom_schemas_list|get|create|update`
- `crm_custom_records_list|get|search|create|update|delete`

### Raw API
- `hub_api_request` *(write methods dry-run by default)*

## Notes

- MCP transport is stdio only in this implementation.
- Existing auth + HTTP core logic is reused (`getToken`, `HubSpotClient`, `maybeWrite`, redaction).
