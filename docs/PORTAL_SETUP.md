# Portal Setup Guide

How to set up a new HubSpot portal from scratch for use with hscli, in the correct order. Each phase builds on the previous one — skip nothing, follow the sequence.

Use the **Setup Checklist** at the bottom to audit an existing portal and find what's missing.

### Related Setup Guides

This guide covers the portal foundation. For hub-specific configuration, see:

| Guide | Covers |
|-------|--------|
| [[MARKETING_SETUP]] | Email, campaigns, forms, ads, social, SEO, lead scoring, ABM |
| [[SALES_SETUP]] | Pipelines, quotes, meetings, sequences, playbooks, forecasting |
| [[SERVICE_SETUP]] | Tickets, knowledge base, customer portal, SLAs, feedback surveys |
| [[COMMERCE_SETUP]] | Products, payments, invoices, subscriptions, tax |
| [[CMS_SETUP]] | Domains, templates, blog, pages, file manager, developer tools |
| [[OPERATIONS_SETUP]] | Data sync, data quality, datasets, custom objects, imports |
| [[REPORTING_SETUP]] | Dashboards, custom reports, attribution, analytics, goals |
| [[INTEGRATIONS_NOTIFICATIONS_SETUP]] | Marketplace apps, webhooks, notifications, security, account defaults |

> Also see: [[hubspot-rules]] · [[COMMAND_TREE]] for CLI commands to automate portal setup

---

## Phase 1: Account Foundation (UI only)

These settings affect everything downstream. Get them right first.

### 1.1 Account Defaults

**Where:** Settings > Account Management > Account Defaults > General

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Account name | Your company or project name | Appears in emails, quotes, reports |
| Time zone | Your primary business timezone | Affects workflow triggers, email send times, reporting windows |
| Fiscal year | Start month (e.g., January–December) | Affects goal tracking, forecasting, fiscal-period reports |
| Company name | Legal entity name | Used in email footers (CAN-SPAM), quotes, invoices |
| Company address | Full physical address | Required for email compliance (CAN-SPAM/GDPR) |
| Company domain | Your main website domain | Used as default for tracking and branding |

> **API:** Read-only (`GET /account-info/v3/details`). These must be set in the UI.

### 1.2 Currency

**Where:** Settings > Account Defaults > Currency

Set your company (home) currency. Add additional currencies if you sell internationally.

| Setting | What to configure |
|---------|-------------------|
| Company currency | Your primary currency (e.g., USD, EUR, GBP) |
| Additional currencies | Any secondary currencies + exchange rates |
| Number format | Regional format (e.g., 1,234.56 vs 1 234,56) |

> **API:** `settings.currencies.read/write` scopes. Currencies can be read and managed via API after initial setup.
>
> **Important:** Company currency cannot be changed once set. Choose carefully.

### 1.3 Branding

**Where:** Settings > Account Defaults > Branding (if available on your plan)

| Setting | What to configure |
|---------|-------------------|
| Logo | Company logo (used in emails, quotes, chat widget) |
| Favicon | Browser tab icon for hosted pages |
| Brand colors | Primary and secondary colors |
| Fonts | Default fonts for emails and pages |

> **API:** UI only. No public API for branding settings.

### 1.4 Privacy & Consent

**Where:** Settings > Privacy & Consent

| Setting | What to configure |
|---------|-------------------|
| GDPR toggle | Enable if you process EU personal data |
| Consent types | Define legal basis types (legitimate interest, consent, etc.) |
| Cookie banner | Configure consent banner for tracking |
| Subscription types | Email opt-in/out categories |

> **API:** Partial. Consent properties can be set via API; GDPR mode itself is UI-only.
>
> **Why now:** Enabling GDPR after data exists creates retroactive compliance problems. Set it before any data enters the portal.

---

## Phase 2: Domain & Email Setup (UI + DNS)

### 2.1 Connect Your Domain

**Where:** Settings > Content > Domains (or via the domain setup wizard)

| Domain type | Purpose | Example |
|-------------|---------|---------|
| Website domain | Landing pages, website pages | `www.yourcompany.com` |
| Email sending domain | Authenticated email delivery | `yourcompany.com` |
| Blog domain | Blog hosting | `blog.yourcompany.com` |
| Knowledge base | Help center hosting | `help.yourcompany.com` |

**Process:**
1. Add the domain in HubSpot
2. HubSpot provides DNS records (CNAME, TXT)
3. Add records at your DNS registrar
4. Wait for verification (can take up to 48h, usually minutes)

> **API:** Read-only (`GET /cms/v3/domains`). Domain connection requires the UI + DNS configuration.

### 2.2 Email Authentication (DKIM, SPF)

**Where:** Settings > Marketing > Email > Configuration

| Record | Purpose |
|--------|---------|
| CNAME (DKIM) | Proves emails are from your domain, not spoofed |
| TXT (SPF) | Authorizes HubSpot to send email on your behalf |
| DMARC | Policy for handling failed authentication (set at your DNS) |

HubSpot provides the specific DNS records. Add them at your registrar and verify.

> **Why now:** Without email authentication, marketing and transactional emails may land in spam. Must be done before sending any emails.

### 2.3 Tracking Code

**Where:** Settings > Tracking & Analytics > Tracking Code

Install the HubSpot tracking code on your website:
- **HubSpot-hosted pages:** Automatic, no action needed
- **External website:** Copy the JavaScript snippet and add it to your site's `<head>` tag

> **API:** The tracking code API can push events, but installing the snippet is manual.

---

## Phase 3: Users & Teams (UI + API)

### 3.1 Invite Users

**Where:** Settings > Account Management > Users & Teams > Add users

| Setting | What to configure |
|---------|-------------------|
| Email addresses | Invite by email |
| Seats | Assign seat types (Core, Sales, Service, etc.) |
| Permission set | Super Admin, Admin, or custom permission sets |

**Process:**
1. Click **Add users** and enter email addresses
2. Assign a seat type (determines which tools they access)
3. Assign a permission set (determines what they can do)
4. Users receive an email invitation and must accept

> **API:** Yes — `settings.users.read/write` scopes. The User Provisioning API (`/settings/v3/users`) supports inviting and managing users.

### 3.2 Create Teams

**Where:** Settings > Users & Teams > Teams tab

Teams enable:
- Record ownership segmentation (e.g., "Sales East" vs "Sales West")
- Team-based reporting and dashboards
- Permission hierarchies

> **API:** Teams are readable via API (`GET /settings/v3/users/teams`). Creation is done in the UI.

### 3.3 Verify Owners

Users who can own CRM records appear as "owners." After inviting users, verify they show up:

```bash
# List all owners in the portal
hscli crm owners list

# Filter by email
hscli crm owners list --email "user@yourcompany.com"
```

> **Important:** Note owner IDs — you'll need them for record creation, imports, and bulk operations.

---

## Phase 4: Private App & CLI Authentication (UI + CLI)

### 4.1 Create a Private App

**Where:** Settings > Integrations > Private Apps (or Legacy Apps)

1. Click **Create legacy app** (or **Create a private app**)
2. Name it (e.g., `hscli`)
3. Grant the required scopes:

**Minimum scopes for full hscli functionality:**

| Category | Scopes |
|----------|--------|
| **CRM Objects** | `crm.objects.contacts.read/write`, `crm.objects.companies.read/write`, `crm.objects.deals.read/write`, `crm.objects.deals.sensitive.read` |
| **CRM Schemas** | `crm.schemas.contacts.read/write`, `crm.schemas.companies.read/write`, `crm.schemas.deals.read/write` |
| **Tickets** | `tickets`, `tickets.sensitive` |
| **Pipelines** | `crm.pipelines.orders.read/write` |
| **Owners** | `crm.objects.owners.read` |
| **Lists** | `crm.lists.read/write` |
| **Custom Objects** | `crm.objects.custom.sensitive.read/write` |
| **Imports** | `crm.import` |
| **Marketing** | `marketing-email`, `marketing.campaigns.read/write` |
| **Forms** | `forms` |
| **Files** | `files` |
| **CMS** | `content` |
| **Workflows** | `automation` |
| **Conversations** | `conversations.read/write` |
| **Settings** | `settings.users.read/write`, `settings.currencies.read/write` |

4. Click **Create app** and copy the access token

**Token format by hublet:**
- US: `pat-na1-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
- EU: `pat-eu1-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`

### 4.2 Authenticate hscli

```bash
# Build hscli (first time only)
cd hscli-main && npm install && npm run build

# Authenticate (pipe to avoid token in shell history)
printf '%s' 'pat-eu1-XXXX' | hscli auth login --token-stdin

# Verify
hscli auth whoami
hscli auth token-info

# Check capabilities
hscli doctor capabilities --refresh
```

**Expected `auth whoami` output:** Portal ID, hublet, uiDomain, authenticated user email.

---

## Phase 5: Data Model — Properties (CLI)

Properties define the fields on each CRM object. Standard properties exist by default; add custom properties before importing any data.

### 5.1 Review existing properties

```bash
# List properties per object type
hscli crm properties list contacts
hscli crm properties list companies
hscli crm properties list deals
hscli crm properties list tickets

# Full schema introspection (includes metadata)
hscli crm describe contacts
hscli crm describe deals
```

### 5.2 Create custom properties

```bash
# Example: dropdown property on contacts
hscli crm properties create contacts --data '{
  "name": "lead_source_detail",
  "label": "Lead Source Detail",
  "type": "enumeration",
  "fieldType": "select",
  "groupName": "contactinformation",
  "options": [
    {"label": "Organic Search", "value": "organic_search", "displayOrder": 0},
    {"label": "Paid Ads", "value": "paid_ads", "displayOrder": 1},
    {"label": "Referral", "value": "referral", "displayOrder": 2}
  ]
}' --force

# Example: number property on deals
hscli crm properties create deals --data '{
  "name": "mrr",
  "label": "Monthly Recurring Revenue",
  "type": "number",
  "fieldType": "number",
  "groupName": "dealinformation"
}' --force
```

> Default behavior is `--dry-run`. Always dry-run first, then add `--force` to commit.

### 5.3 Update existing properties

```bash
hscli crm properties update contacts --data '{
  "name": "lead_source_detail",
  "label": "Lead Source (Detailed)",
  "options": [
    {"label": "Organic Search", "value": "organic_search", "displayOrder": 0},
    {"label": "Paid Ads", "value": "paid_ads", "displayOrder": 1},
    {"label": "Referral", "value": "referral", "displayOrder": 2},
    {"label": "Partner", "value": "partner", "displayOrder": 3}
  ]
}' --force
```

---

## Phase 6: Data Model — Pipelines (UI + CLI)

Pipelines define how deals and tickets flow through your process.

### 6.1 Configure Deal Pipeline

**Where:** Settings > Objects > Deals > Pipelines tab

Design your stages with probabilities:

| Stage | Probability | Meaning |
|-------|-------------|---------|
| Prospect | 10% | Initial contact, not yet qualified |
| Qualification | 30% | Evaluating fit and budget |
| Proposal | 60% | Proposal sent, awaiting decision |
| Negotiation | 80% | Terms being discussed |
| Won | 100% | Deal closed successfully |
| Lost | 0% | Deal did not close |

### 6.2 Configure Ticket Pipeline

**Where:** Settings > Objects > Tickets > Pipelines tab

Design your statuses:

| Status | Open/Closed |
|--------|-------------|
| New | Open |
| Waiting on contact | Open |
| Waiting on us | Open |
| Closed | Closed |

### 6.3 Verify via CLI

```bash
# List pipelines and their stages
hscli crm pipelines list deals
hscli crm pipelines list tickets

# Get detailed pipeline info (stage IDs, probabilities)
hscli crm pipelines get deals
hscli crm pipelines get tickets
```

> **Note:** The Pipelines API (`/crm/v3/pipelines`) supports full CRUD. Pipelines can also be created via API if you have the `crm.pipelines.orders.read/write` scope.

---

## Phase 7: Data Model — Custom Objects (CLI, if needed)

Custom objects extend the CRM beyond contacts, companies, deals, and tickets.

### 7.1 List existing schemas

```bash
hscli crm custom-objects schemas list
```

### 7.2 Create a custom object

```bash
hscli crm custom-objects schemas create --data '{
  "name": "project",
  "labels": {"singular": "Project", "plural": "Projects"},
  "primaryDisplayProperty": "project_name",
  "requiredProperties": ["project_name"],
  "properties": [
    {"name": "project_name", "label": "Project Name", "type": "string", "fieldType": "text"},
    {"name": "status", "label": "Status", "type": "enumeration", "fieldType": "select",
     "options": [
       {"label": "Planning", "value": "planning"},
       {"label": "Active", "value": "active"},
       {"label": "Complete", "value": "complete"}
     ]},
    {"name": "budget", "label": "Budget", "type": "number", "fieldType": "number"}
  ],
  "associatedObjects": ["CONTACT", "COMPANY", "DEAL"]
}' --force
```

---

## Phase 8: Test & Validate (CLI)

Before importing data at scale, create one record of each type to verify the data model.

### 8.1 Create a test contact

```bash
# Dry-run first
hscli crm contacts create --data '{
  "properties": {
    "email": "setup-test@example.com",
    "firstname": "Setup",
    "lastname": "Test",
    "hubspot_owner_id": "<OWNER_ID>"
  }
}'

# Execute
hscli crm contacts create --data '{
  "properties": {
    "email": "setup-test@example.com",
    "firstname": "Setup",
    "lastname": "Test",
    "hubspot_owner_id": "<OWNER_ID>"
  }
}' --force
```

### 8.2 Create and associate records

```bash
# Create a company
hscli crm companies create --data '{
  "properties": {"name": "Test Company", "domain": "testco.com"}
}' --force

# Associate contact → company
hscli crm associations create contacts <contactId> companies <companyId> --force

# Create a deal in the pipeline
hscli crm deals create --data '{
  "properties": {
    "dealname": "Test Deal",
    "pipeline": "<pipelineId>",
    "dealstage": "<stageId>",
    "amount": "10000",
    "hubspot_owner_id": "<OWNER_ID>"
  }
}' --force

# Associate deal → contact and deal → company
hscli crm associations create deals <dealId> contacts <contactId> --force
hscli crm associations create deals <dealId> companies <companyId> --force
```

### 8.3 Validate data

```bash
# Validate a payload against the schema before creating
hscli crm validate contacts --data '{
  "properties": {"email": "test@example.com", "firstname": "Test"}
}'
```

---

## Phase 9: Data Import (CLI)

Once the data model is validated, import your data.

### 9.1 Single records

```bash
hscli crm contacts create --data '{...}' --force
hscli crm companies create --data '{...}' --force
```

### 9.2 Batch operations

```bash
hscli crm contacts batch-upsert --data '{
  "inputs": [
    {"properties": {"email": "alice@example.com", "firstname": "Alice"}, "idProperty": "email"},
    {"properties": {"email": "bob@example.com", "firstname": "Bob"}, "idProperty": "email"}
  ]
}' --force
```

### 9.3 CSV imports

```bash
hscli crm imports create --data '<import-payload>' --force

# Check import status
hscli crm imports list
hscli crm imports get <importId>
hscli crm imports errors <importId>
```

### Import safety rules

- **Validate first:** Create a single test record before bulk operations
- **5-error hard stop:** If >5 errors on the same endpoint, stop and diagnose
- **Rate limits:** ~100 requests/10s for private apps. Use sequential processing with 1-2s pauses per 5 records
- **Idempotent re-runs:** Check for existing records before creating duplicates
- **Always assign owners:** Never import records without an owner

---

## Phase 10: Engagement Tools (UI + CLI)

### 10.1 Email Configuration

**Where:** Settings > Marketing > Email

| Setting | What to configure |
|---------|-------------------|
| Subscription types | Define email categories (Marketing, Sales, Newsletter, etc.) |
| Email footer | Company name, address (required by CAN-SPAM) |
| Default "from" address | noreply@, marketing@, etc. |

### 10.2 Forms

```bash
# List existing forms
hscli forms list

# Create a form
hscli forms create --data '{...}' --force
```

### 10.3 Workflows

**Where:** Automation > Workflows (UI only for building; `automation` scope for custom actions)

```bash
# List workflows
hscli workflows flows list
```

---

## Setup Checklist

Use this to verify a new portal or audit an existing one. Items are in dependency order.

### Phase 1 — Account Foundation (UI)
```
[ ] Account name set
[ ] Time zone configured
[ ] Fiscal year set
[ ] Company name and address filled in (email compliance)
[ ] Company currency set (cannot be changed later)
[ ] Additional currencies added (if multi-currency)
[ ] Branding configured (logo, colors, favicon)
[ ] Privacy & consent settings enabled (GDPR if applicable)
```

### Phase 2 — Domains & Email (UI + DNS)
```
[ ] Website domain connected and verified
[ ] Email sending domain authenticated (DKIM + SPF)
[ ] DMARC record configured at DNS registrar
[ ] Tracking code installed on external website
```

### Phase 3 — Users & Teams (UI)
```
[ ] Users invited with correct seats and permissions
[ ] Teams created (if using team-based segmentation)
[ ] Owners verified: hscli crm owners list
```

### Phase 4 — CLI Authentication
```
[ ] Private App created with required scopes
[ ] hscli authenticated: hscli auth whoami
[ ] Token info verified: hscli auth token-info
[ ] Capabilities checked: hscli doctor capabilities --refresh
```

### Phase 5 — Properties (CLI)
```
[ ] Contact properties reviewed/created
[ ] Company properties reviewed/created
[ ] Deal properties reviewed/created
[ ] Ticket properties reviewed/created
```

### Phase 6 — Pipelines (UI, verified via CLI)
```
[ ] Deal pipeline stages configured with probabilities
[ ] Ticket pipeline statuses configured (open/closed)
[ ] Pipelines verified: hscli crm pipelines list deals
```

### Phase 7 — Custom Objects (CLI, if needed)
```
[ ] Custom object schemas created
[ ] Custom object properties defined
[ ] Associations configured
```

### Phase 8 — Validation (CLI)
```
[ ] Test contact created and verified
[ ] Test company created and associated
[ ] Test deal created in correct pipeline/stage
[ ] Associations verified between objects
```

### Phase 9 — Data Import (CLI)
```
[ ] Data imported (contacts, companies, deals, tickets)
[ ] Import errors reviewed and resolved
[ ] Owner assignment verified on imported records
```

### Phase 10 — Engagement Tools (UI + CLI)
```
[ ] Email subscription types configured
[ ] Email footer set (company address)
[ ] Forms created (if needed)
[ ] Workflows built (if needed)
```

---

## Quick Audit Script

Run this to quickly assess what's configured in an existing portal:

```bash
#!/bin/bash
echo "=== Auth & Connectivity ==="
hscli auth whoami
hscli doctor capabilities --refresh

echo "=== Owners ==="
hscli crm owners list

echo "=== Pipelines ==="
hscli crm pipelines list deals
hscli crm pipelines list tickets

echo "=== Property Counts ==="
hscli crm properties list contacts --json 2>/dev/null | grep -c '"name"' || echo "contacts: error"
hscli crm properties list companies --json 2>/dev/null | grep -c '"name"' || echo "companies: error"
hscli crm properties list deals --json 2>/dev/null | grep -c '"name"' || echo "deals: error"
hscli crm properties list tickets --json 2>/dev/null | grep -c '"name"' || echo "tickets: error"

echo "=== Custom Objects ==="
hscli crm custom-objects schemas list

echo "=== Record Counts ==="
hscli crm contacts search --data '{"filterGroups":[], "limit": 1}' --json 2>/dev/null
hscli crm companies search --data '{"filterGroups":[], "limit": 1}' --json 2>/dev/null
hscli crm deals search --data '{"filterGroups":[], "limit": 1}' --json 2>/dev/null
```

---

## API vs UI Reference

| Step | What | API support | hscli command |
|------|------|-------------|----------------|
| Account defaults | Name, timezone, currency | Read-only | — |
| Branding | Logo, colors, fonts | None | — |
| Domains | Website, email sending | Read-only | — |
| Email auth | DKIM, SPF | None (DNS manual) | — |
| Tracking code | JS snippet | Push events only | — |
| Privacy/consent | GDPR, cookie banner | Partial | — |
| Users | Invite, permissions | Full CRUD | — |
| Owners | List portal owners | Read | `hscli crm owners list` |
| Properties | Object fields | Full CRUD | `hscli crm properties list/create/update` |
| Pipelines | Deal/ticket stages | Full CRUD | `hscli crm pipelines list/get` |
| Custom objects | Schema + records | Full CRUD | `hscli crm custom-objects schemas list/create` |
| Data import | Bulk CSV | Full | `hscli crm imports create` |
| Records | CRUD + search | Full | `hscli crm <object> list/get/create/update/delete` |
| Associations | Record linking | Full | `hscli crm associations create/list/remove` |
| Forms | Lead capture | Full CRUD | `hscli forms list/create` |
| Workflows | Automation | Limited | `hscli workflows flows list` |
| Marketing | Email, campaigns | Partial | `hscli marketing emails/campaigns list` |

---

## Hublet Reference

hscli auto-detects the hublet from the token prefix and routes API calls to the correct endpoint.

| Hublet | Token prefix | API base URL | UI domain |
|--------|-------------|-------------|-----------|
| US | `pat-na1-*` | `https://api.hubapi.com` | `app.hubspot.com` |
| EU | `pat-eu1-*` | `https://api-eu1.hubapi.com` | `app-eu1.hubspot.com` |

Never hardcode `api.hubapi.com` — it defaults to US and will fail for EU portals.
