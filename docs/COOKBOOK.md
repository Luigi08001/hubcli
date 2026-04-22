# hscli Cookbook

Practical examples for common HubSpot CRM operations using `hscli`.

All write operations are **dry-run by default**. Omit flags to see the safety error, use `--dry-run` to preview, and `--force` to execute.

---

## 1. Auth and Setup

### Login with a private app token

```bash
hscli auth login --token "pat-eu1-a1b2c3d4-5678-9abc-def0-1234567890ab"
```

Hublet is auto-detected from the token prefix (e.g. `pat-eu1-...` routes to `api-eu1.hubapi.com`).

### Login via stdin (CI pipelines)

```bash
echo "$HUBSPOT_TOKEN" | hscli auth login --token-stdin --profile production
```

### Switch between profiles

```bash
hscli auth profiles
hscli auth whoami --profile staging
hscli auth profile-show --profile production
```

### Inspect token scopes and expiry

```bash
hscli auth token-info --profile production
```

### Lock a profile to read-only

```bash
hscli auth set-mode production read-only
```

Re-enable writes:

```bash
hscli auth set-mode production read-write
```

### Encrypt and decrypt the credential vault

Requires `HSCLI_VAULT_PASSPHRASE` environment variable.

```bash
export HSCLI_VAULT_PASSPHRASE="my-secure-passphrase"
hscli auth encrypt
hscli auth decrypt
```

### Generate an OAuth authorization URL

```bash
hscli auth oauth-url \
  --client-id "a1b2c3d4-5678-9abc-def0-1234567890ab" \
  --redirect-uri "https://app.example.com/oauth/callback" \
  --scopes "crm.objects.contacts.read,crm.objects.contacts.write"
```

### Exchange an OAuth code for a token

```bash
hscli auth oauth-exchange \
  --client-id "a1b2c3d4-5678-9abc-def0-1234567890ab" \
  --client-secret "secret-value" \
  --code "auth-code-from-redirect" \
  --redirect-uri "https://app.example.com/oauth/callback" \
  --profile oauth-prod
```

---

## 2. CRM Operations (Contacts, Companies, Deals, Tickets)

All four object types share the same subcommands: `list`, `get`, `search`, `create`, `update`, `delete`, `merge`, `batch-read`, `batch-upsert`, `batch-archive`.

### List contacts with specific properties

```bash
hscli crm contacts list --limit 20 --properties "firstname,lastname,email,company"
```

### Paginate through companies

```bash
hscli crm companies list --limit 50 --after "NTI1"
```

### Get a single deal by ID

```bash
hscli crm deals get 18294750312 --properties "dealname,amount,dealstage,closedate"
```

### Search contacts by name

```bash
hscli crm contacts search --query "Sarah Chen" --limit 5
```

### Create a contact (dry-run first, then execute)

```bash
# Preview what would be sent
hscli crm contacts create --dry-run \
  --data '{"properties":{"firstname":"Maria","lastname":"Gonzalez","email":"maria.gonzalez@acmecorp.com","company":"Acme Corp","phone":"+1-415-555-0198"}}'

# Execute the create
hscli crm contacts create --force \
  --data '{"properties":{"firstname":"Maria","lastname":"Gonzalez","email":"maria.gonzalez@acmecorp.com","company":"Acme Corp","phone":"+1-415-555-0198"}}'
```

### Update a deal stage

```bash
hscli crm deals update 18294750312 --dry-run \
  --data '{"properties":{"dealstage":"contractsent","amount":"45000"}}'

hscli crm deals update 18294750312 --force \
  --data '{"properties":{"dealstage":"contractsent","amount":"45000"}}'
```

### Delete (archive) a ticket

```bash
hscli crm tickets delete 9871234567 --dry-run
hscli crm tickets delete 9871234567 --force
```

### Merge duplicate contacts

```bash
hscli crm contacts merge --dry-run \
  --data '{"primaryObjectId":"551","objectIdToMerge":"552"}'

hscli crm contacts merge --force \
  --data '{"primaryObjectId":"551","objectIdToMerge":"552"}'
```

### Batch read multiple contacts by ID

```bash
hscli crm contacts batch-read \
  --data '{"inputs":[{"id":"551"},{"id":"552"},{"id":"553"}],"properties":["firstname","lastname","email"]}'
```

### Batch upsert companies

```bash
hscli crm companies batch-upsert --force \
  --data '{"inputs":[{"idProperty":"domain","id":"acmecorp.com","properties":{"name":"Acme Corp","industry":"Technology"}},{"idProperty":"domain","id":"globex.com","properties":{"name":"Globex Inc","industry":"Manufacturing"}}]}'
```

### Batch archive deals

```bash
hscli crm deals batch-archive --dry-run \
  --data '{"inputs":[{"id":"100"},{"id":"101"},{"id":"102"}]}'
```

### Include archived records

```bash
hscli crm contacts list --archived true --limit 10
```

---

## 3. Custom Objects

### List all custom object schemas

```bash
hscli crm custom-objects schemas list
```

### Get a specific schema

```bash
hscli crm custom-objects schemas get vehicles
```

### Create a custom object schema

```bash
hscli crm custom-objects schemas create --dry-run \
  --data '{"name":"vehicles","labels":{"singular":"Vehicle","plural":"Vehicles"},"primaryDisplayProperty":"vin","properties":[{"name":"vin","label":"VIN","type":"string","fieldType":"text"},{"name":"make","label":"Make","type":"string","fieldType":"text"},{"name":"model","label":"Model","type":"string","fieldType":"text"}]}'

hscli crm custom-objects schemas create --force \
  --data '{"name":"vehicles","labels":{"singular":"Vehicle","plural":"Vehicles"},"primaryDisplayProperty":"vin","properties":[{"name":"vin","label":"VIN","type":"string","fieldType":"text"},{"name":"make","label":"Make","type":"string","fieldType":"text"},{"name":"model","label":"Model","type":"string","fieldType":"text"}]}'
```

### Update a custom object schema

```bash
hscli crm custom-objects schemas update vehicles --force \
  --data '{"labels":{"singular":"Vehicle","plural":"Vehicles"},"secondaryDisplayProperties":["make","model"]}'
```

### List records of a custom object type

```bash
hscli crm custom-objects records list vehicles --limit 25
```

### Create a custom object record

```bash
hscli crm custom-objects records create vehicles --force \
  --data '{"properties":{"vin":"1HGCM82633A004352","make":"Honda","model":"Accord"}}'
```

### Search custom object records

```bash
hscli crm custom-objects records search vehicles \
  --data '{"query":"Honda","limit":10}'
```

### Delete a custom object record

```bash
hscli crm custom-objects records delete vehicles 29384756 --force
```

---

## 4. Engagements (Notes, Calls, Tasks, Emails, Meetings)

All engagement types share the same subcommands as standard CRM objects: `list`, `get`, `search`, `create`, `update`, `delete`, `merge`, `batch-read`, `batch-upsert`, `batch-archive`.

### Create a note

```bash
hscli crm engagements notes create --force \
  --data '{"properties":{"hs_note_body":"Spoke with Maria about Q2 renewal. She requested a discount proposal by Friday.","hs_timestamp":"2026-03-14T10:30:00Z"}}'
```

### List recent calls

```bash
hscli crm engagements calls list --limit 10 \
  --properties "hs_call_title,hs_call_duration,hs_call_direction,hs_timestamp"
```

### Create a task assigned to an owner

```bash
hscli crm engagements tasks create --dry-run \
  --data '{"properties":{"hs_task_subject":"Follow up on Acme Corp proposal","hs_task_body":"Send revised pricing deck and schedule demo.","hs_task_status":"NOT_STARTED","hs_task_priority":"HIGH","hs_timestamp":"2026-03-18T09:00:00Z","hubspot_owner_id":"284719503"}}'

hscli crm engagements tasks create --force \
  --data '{"properties":{"hs_task_subject":"Follow up on Acme Corp proposal","hs_task_body":"Send revised pricing deck and schedule demo.","hs_task_status":"NOT_STARTED","hs_task_priority":"HIGH","hs_timestamp":"2026-03-18T09:00:00Z","hubspot_owner_id":"284719503"}}'
```

### Search for meetings

```bash
hscli crm engagements meetings search --query "product demo" --limit 5
```

### Log an email engagement

```bash
hscli crm engagements emails create --force \
  --data '{"properties":{"hs_email_subject":"Re: Acme Corp Renewal Pricing","hs_email_text":"Hi Maria, attached is the revised pricing.","hs_email_direction":"EMAIL","hs_timestamp":"2026-03-14T14:00:00Z"}}'
```

---

## 5. Properties and Associations

### List all properties for contacts

```bash
hscli crm properties list contacts
```

### Get a specific property definition

```bash
hscli crm properties get deals dealstage
```

### Create a custom property

```bash
hscli crm properties create contacts --dry-run \
  --data '{"name":"preferred_language","label":"Preferred Language","type":"enumeration","fieldType":"select","groupName":"contactinformation","options":[{"label":"English","value":"en"},{"label":"Spanish","value":"es"},{"label":"French","value":"fr"}]}'

hscli crm properties create contacts --force \
  --data '{"name":"preferred_language","label":"Preferred Language","type":"enumeration","fieldType":"select","groupName":"contactinformation","options":[{"label":"English","value":"en"},{"label":"Spanish","value":"es"},{"label":"French","value":"fr"}]}'
```

### Update a property label

```bash
hscli crm properties update contacts preferred_language --force \
  --data '{"label":"Preferred Communication Language"}'
```

### List associations from a contact to companies

```bash
hscli crm associations list contacts 551 companies
```

### Create an association between a deal and a company

```bash
hscli crm associations create deals 18294750312 companies 9182736450 --dry-run
hscli crm associations create deals 18294750312 companies 9182736450 --force
```

### Remove an association

```bash
hscli crm associations remove contacts 551 companies 9182736450 --force
```

---

## 6. Pipelines and Owners

### List deal pipelines

```bash
hscli crm pipelines list deals
```

### Get a specific ticket pipeline

```bash
hscli crm pipelines get tickets 0
```

### List owners

```bash
hscli crm owners list --limit 50
```

### Filter owners by email

```bash
hscli crm owners list --email "sarah.chen@company.com"
```

---

## 7. Describe and Validate

### Describe the schema for deals (properties, pipelines, enums)

```bash
hscli crm describe deals
```

### Force a cache refresh

```bash
hscli crm describe contacts --refresh-cache
```

### Use a custom cache TTL

```bash
hscli crm describe tickets --ttl-hours 4
```

### Validate a payload before creating a record

```bash
hscli crm validate contacts \
  --data '{"properties":{"firstname":"Maria","lastname":"Gonzalez","email":"maria@acmecorp.com"}}'
```

### Offline validation (cached schema only)

```bash
hscli crm validate deals --offline \
  --data '{"properties":{"dealname":"Acme Renewal","amount":"45000","dealstage":"appointmentscheduled"}}'
```

---

## 8. Marketing, Forms, Files, CMS, Workflows, Service

### Marketing emails

```bash
hscli marketing emails list --limit 10
hscli marketing emails get 87654321
hscli marketing emails create --dry-run \
  --data '{"name":"March Newsletter","subject":"Your March Product Updates"}'
```

### Marketing campaigns

```bash
hscli marketing campaigns list --limit 5
hscli marketing campaigns get 12345678
```

### Forms

```bash
hscli forms list --limit 10
hscli forms get "f47ac10b-58cc-4372-a567-0e02b2c3d479"

hscli forms create --dry-run \
  --data '{"name":"Q2 Webinar Signup","formType":"hubspot","configuration":{"language":"en"}}'

hscli forms update "f47ac10b-58cc-4372-a567-0e02b2c3d479" --force \
  --data '{"name":"Q2 Webinar Signup (Updated)"}'
```

### File assets

```bash
hscli files assets list --limit 20
hscli files assets get 48192837465
hscli files assets update 48192837465 --force \
  --data '{"name":"proposal-final-v2.pdf"}'
hscli files assets delete 48192837465 --force
```

### CMS pages and blog posts

```bash
hscli cms pages list --limit 10
hscli cms blogs list --limit 5
hscli cms blogs get 19283746501

hscli cms pages create --dry-run \
  --data '{"name":"Q2 Product Update","slug":"q2-product-update"}'

hscli cms blogs delete 19283746501 --force
```

### Workflows

```bash
hscli workflows flows list --limit 10
hscli workflows flows get 39172845

hscli workflows flows create --dry-run \
  --data '{"name":"New Lead Nurture Sequence","type":"PLATFORM_FLOW"}'
```

### Service conversations and feedback

```bash
hscli service conversations list --limit 10
hscli service feedback list --limit 10
hscli service feedback get 56789012

hscli service feedback create --force \
  --data '{"properties":{"hs_content":"Great onboarding experience.","hs_rating":"5"}}'
```

---

## 9. Webhooks

### List webhook subscriptions for an app

```bash
hscli webhooks list --app-id 12345
```

### Create a webhook subscription

```bash
hscli webhooks subscribe --app-id 12345 --dry-run \
  --data '{"eventType":"contact.creation","propertyName":"email","active":true}'

hscli webhooks subscribe --app-id 12345 --force \
  --data '{"eventType":"contact.creation","propertyName":"email","active":true}'
```

### Delete a webhook subscription

```bash
hscli webhooks delete --app-id 12345 --subscription-id 67890 --force
```

---

## 10. Imports

### Start an import

```bash
hscli crm imports create --force \
  --data '{"name":"Q1 Lead List","importOperations":{"0":"CREATE"},"dateFormat":"YEAR_MONTH_DAY","files":[{"fileName":"q1-leads.csv","fileFormat":"CSV","fileImportPage":{"hasHeader":true,"columnMappings":[{"columnObjectTypeId":"0-1","columnName":"Email","propertyName":"email"},{"columnObjectTypeId":"0-1","columnName":"First Name","propertyName":"firstname"}]}}]}'
```

### Check import status

```bash
hscli crm imports list
hscli crm imports get 84726153
```

### View import errors

```bash
hscli crm imports errors 84726153
```

---

## 11. Incremental Sync

### Full pull of all contacts (paginated)

```bash
hscli crm sync pull contacts --limit 100 --max-pages 10
```

State is saved to `.hscli-sync-contacts.json` by default. Subsequent runs resume from the last cursor.

### Pull contacts modified since a specific date

```bash
hscli crm sync pull contacts --since "2026-03-01T00:00:00Z"
```

### Custom state file and output file

```bash
hscli crm sync pull deals \
  --state-file "./sync-state/deals.json" \
  --out-file "./exports/deals-latest.json" \
  --limit 50 \
  --max-pages 20
```

### Cron-friendly sync (run periodically, automatically resumes)

```bash
hscli crm sync pull companies --limit 100 --max-pages 5 --json
```

---

## 12. Raw API Requests

For endpoints not covered by built-in commands, use `api request`. Write methods go through the same safety controls.

### GET request

```bash
hscli api request --path "/crm/v3/objects/contacts" --method GET
```

### POST search with payload

```bash
hscli api request --path "/crm/v3/objects/contacts/search" --method POST \
  --data '{"query":"acme","limit":5}'
```

### PATCH with safety controls

```bash
hscli api request --path "/crm/v3/objects/deals/18294750312" --method PATCH --dry-run \
  --data '{"properties":{"dealstage":"closedwon"}}'

hscli api request --path "/crm/v3/objects/deals/18294750312" --method PATCH --force \
  --data '{"properties":{"dealstage":"closedwon"}}'
```

### DELETE via raw API

```bash
hscli api request --path "/crm/v3/objects/contacts/551" --method DELETE --force
```

### Hit an endpoint not in the CLI (e.g. timeline events)

```bash
hscli api request --path "/crm/v3/timeline/events" --method POST --force \
  --data '{"eventTemplateId":"12345","objectId":"551","tokens":{"action":"Logged in"}}'
```

---

## 13. Safety Controls

### Dry-run (preview without executing)

Every write command supports `--dry-run`. It returns the method, path, and body that would be sent, without making the API call.

```bash
hscli crm contacts create --dry-run \
  --data '{"properties":{"email":"test@example.com"}}'
```

### Force (execute the write)

Without `--force`, write operations fail with `WRITE_CONFIRMATION_REQUIRED`.

```bash
hscli crm contacts create --force \
  --data '{"properties":{"email":"test@example.com"}}'
```

### Policy file

A JSON policy file can restrict writes and deletes per profile. See `docs/POLICY_EXAMPLE.json`.

```bash
hscli crm contacts delete 551 --force --policy-file ./policy.json
```

Example policy file:

```json
{
  "defaults": {
    "allowWrite": true,
    "allowDelete": false,
    "requireChangeTicket": false
  },
  "profiles": {
    "production": {
      "allowDelete": false,
      "requireChangeTicket": true
    }
  },
  "blockedMethodPathPrefixes": {
    "DELETE": ["/crm/v3/schemas"]
  }
}
```

### Change ticket requirement

When a policy requires change tickets, all writes must include `--change-ticket`:

```bash
hscli --profile production crm deals update 18294750312 --force \
  --change-ticket "JIRA-4521" \
  --data '{"properties":{"dealstage":"closedwon"}}'
```

### Read-only profile mode

Lock a profile so all writes are blocked at the auth layer:

```bash
hscli auth set-mode production read-only
```

### Environment variable for policy

The policy file can also be set via environment variable:

```bash
export HSCLI_POLICY_FILE=./policy.json
hscli crm contacts create --force \
  --data '{"properties":{"email":"test@example.com"}}'
```

---

## 14. MCP Server

Run hscli as a Model Context Protocol server over stdio, suitable for integration with AI agents.

```bash
hscli mcp
```

Configure in your MCP client (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "hscli",
      "args": ["mcp"]
    }
  }
}
```

With a specific profile:

```json
{
  "mcpServers": {
    "hubspot": {
      "command": "hscli",
      "args": ["--profile", "production", "mcp"]
    }
  }
}
```

The MCP server exposes the same operations as the CLI with the same safety model (`force: true` required for writes).

---

## 15. Doctor / Diagnostics

### Check hublet configuration consistency

Verifies that hscli's detected hublet, token prefix, and `@hubspot/cli` config all agree:

```bash
hscli doctor hublet-check
hscli doctor hublet-check --profile production
```

### Probe endpoint capabilities

Discovers which API endpoints are available for the current portal and caches the results:

```bash
hscli doctor capabilities
hscli doctor capabilities --refresh
hscli doctor capabilities --ttl-hours 12
```

### Strict capabilities mode

Fail fast when an endpoint's capability status is unknown:

```bash
hscli --strict-capabilities crm contacts list
```

---

## 16. Output Formats

All commands support `--format` and `--json` flags.

```bash
hscli crm contacts list --format json
hscli crm contacts list --format csv
hscli crm contacts list --format yaml
hscli crm contacts list --format table   # default
hscli crm contacts list --json           # shorthand for --format json
```

### Telemetry logging

Append request telemetry to a local JSONL file for auditing:

```bash
hscli --telemetry-file ./telemetry.jsonl crm contacts list
hscli --telemetry-file ./telemetry.jsonl crm deals create --force \
  --data '{"properties":{"dealname":"Tracked Deal","pipeline":"default"}}'
```

---

## 17. Multi-Profile Workflows

### Manage staging and production side by side

```bash
hscli auth login --token "pat-na1-staging-token" --profile staging
hscli auth login --token "pat-eu1-production-token" --profile production

# Read from staging
hscli --profile staging crm contacts search --query "test"

# Write to production (with safety)
hscli --profile production crm contacts create --force \
  --data '{"properties":{"email":"verified@customer.com","firstname":"Verified","lastname":"Customer"}}'
```

### Audit which profiles exist

```bash
hscli auth profiles
hscli auth profile-show --profile staging
hscli auth profile-show --profile production
```

### Remove a profile

```bash
hscli auth logout --profile staging
```
