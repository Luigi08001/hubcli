# Operations Setup Guide

> See also: [[PORTAL_SETUP]] · [[REPORTING_SETUP]] · [[INTEGRATIONS_NOTIFICATIONS_SETUP]]

Complete configuration guide for HubSpot Operations Hub settings. Covers data sync, data quality, workflows, datasets, custom properties, and data management.

**Prerequisites:**
- Portal authenticated (`hubcli auth whoami`)
- Private App scopes: `crm.objects.contacts.read/write`, `crm.schemas.contacts.read`
- Operations Hub license (Starter/Professional/Enterprise for advanced features)

---

## 1. Data Sync

**Where:** Settings > Integrations > Data Sync (or Connected Apps)

### 1.1 Two-Way Sync Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Connected app | Select third-party app to sync | Bidirectional data flow |
| Sync direction | Two-way, HubSpot → app, or app → HubSpot | Controls data flow direction |
| Object mapping | Map HubSpot objects to app objects | Correct data alignment |
| Field mapping | Map HubSpot properties to app fields | Accurate data transfer |
| Sync rules | How conflicts are resolved (most recent wins, prefer HubSpot, prefer app) | Data consistency |
| Filter rules | Which records to sync (e.g., only active customers) | Prevent syncing irrelevant data |
| Initial sync | Full historical sync vs. going-forward only | Complete vs. fresh-start data |

### 1.2 Common Data Sync Integrations

| App | Objects synced | Use case |
|-----|---------------|----------|
| Salesforce | Contacts, Companies, Deals, Activities | CRM bidirectional sync |
| Microsoft Dynamics | Contacts, Companies, Deals | CRM sync |
| Mailchimp | Contacts, Lists | Email marketing sync |
| Google Contacts | Contacts | Address book sync |
| NetSuite | Contacts, Companies, Products, Invoices | ERP sync |
| QuickBooks | Contacts, Invoices, Products | Accounting sync |
| Zendesk | Contacts, Tickets | Support data sync |

### 1.3 Sync Health Monitoring

| Metric | What to monitor | Action |
|--------|----------------|--------|
| Sync errors | Failed record syncs | Review and fix field mapping issues |
| Sync lag | Time delay between systems | Check API rate limits |
| Record count | Total records synced | Verify expected volume |
| Conflict resolution | How conflicts were handled | Audit data accuracy |

---

## 2. Data Quality

**Where:** Operations > Data Quality (Operations Hub Professional+)

### 2.1 Data Quality Command Center

| Feature | Configuration | Purpose |
|---------|--------------|---------|
| Property insights | Auto-detected issues per property | Identify data problems |
| Data health trends | Dashboard of data quality over time | Track improvement |
| Fix recommendations | Suggested fixes for common issues | Guided cleanup |
| Duplicate management | Detect and merge duplicate records | Data deduplication |

### 2.2 Data Quality Automation

| Rule type | Example | Purpose |
|-----------|---------|---------|
| Capitalize names | "john doe" → "John Doe" | Consistent formatting |
| Fix phone format | Various formats → standardized | Consistent phone numbers |
| Clean dates | Various date formats → ISO standard | Consistent date formatting |
| Trim whitespace | Remove leading/trailing spaces | Clean data entry |
| Standardize state | "calif." → "California" | Consistent address data |

**hubcli:**
```bash
# Search for contacts with data issues (e.g., missing email)
hubcli crm contacts search --data '{
  "filterGroups": [{
    "filters": [{
      "propertyName": "email",
      "operator": "NOT_HAS_PROPERTY"
    }]
  }],
  "limit": 50
}'

# Bulk update to fix formatting
hubcli crm contacts batch update --data '{
  "inputs": [
    {"id": "123", "properties": {"firstname": "John"}},
    {"id": "456", "properties": {"firstname": "Jane"}}
  ]
}' --force
```

### 2.3 Duplicate Management

**Where:** Contacts > Actions > Manage Duplicates (or Operations > Data Quality)

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Detection rules | Match by email, name, phone, company | Find potential duplicates |
| Auto-merge rules | Which record wins (most recent, most complete) | Automated cleanup |
| Manual review queue | Review suggested merges before applying | Prevent false merges |
| Merge behavior | Primary record + merged data | Data preservation |

---

## 3. Workflows (Programmable Automation)

**Where:** Automation > Workflows

### 3.1 Operations-Specific Workflow Actions

| Action | Description | Use case |
|--------|-------------|----------|
| **Custom code** | Run JavaScript/Python in workflow | Complex data transformations |
| **Webhook** | Call external API | Trigger actions in other systems |
| **Format data** | Transform property values | Standardize data on the fly |
| **Create/update records** | CRM operations within workflow | Cross-object automation |
| **Data sync trigger** | Trigger sync on record change | Real-time data sync |

### 3.2 Custom Code Actions (Operations Hub Professional+)

| Feature | Configuration | Purpose |
|---------|--------------|---------|
| Language | Node.js 18 (JavaScript) | Custom logic |
| Inputs | Define input properties from enrollment trigger | Pass data into code |
| Outputs | Define output properties | Pass results to next action |
| Secrets | Store API keys securely | Secure external API calls |
| Timeout | Max 20 seconds execution | Performance guardrail |

```javascript
// Example: Enrich company data with external API
exports.main = async (event, callback) => {
  const domain = event.inputFields['company_domain'];
  const response = await fetch(`https://api.enrichment.com/company?domain=${domain}`, {
    headers: { 'Authorization': `Bearer ${process.env.ENRICHMENT_API_KEY}` }
  });
  const data = await response.json();
  callback({
    outputFields: {
      industry: data.industry,
      employee_count: data.employees,
      annual_revenue: data.revenue
    }
  });
};
```

### 3.3 Webhook Actions

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| URL | Endpoint to call | External system integration |
| Method | POST, GET, PUT, DELETE | API operation type |
| Headers | Auth headers, content type | API authentication |
| Body | JSON payload with HubSpot data | Data to send |
| Response mapping | Map response to HubSpot properties | Update CRM from response |

---

## 4. Datasets

**Where:** Reports > Datasets (Operations Hub Professional+)

### 4.1 Dataset Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Data sources | Select CRM objects to include | Define data scope |
| Joins | How objects relate (contacts + deals + companies) | Cross-object analysis |
| Calculated fields | Custom formulas on existing data | Derived metrics |
| Filters | Which records to include | Focused datasets |
| Permissions | Who can use the dataset | Data governance |

### 4.2 Calculated Field Types

| Type | Example | Formula |
|------|---------|---------|
| Date math | Days since last activity | `DATEDIFF(NOW(), last_activity_date)` |
| String manipulation | Full name from first + last | `CONCAT(firstname, " ", lastname)` |
| Conditional | Lead grade based on score | `IF(score > 80, "A", IF(score > 50, "B", "C"))` |
| Aggregation | Total deal value per company | `SUM(deal_amount)` |
| Math | Discount percentage | `(original_price - sale_price) / original_price` |

### 4.3 Dataset Best Practices

| Practice | Why |
|----------|-----|
| Name clearly | Easy discovery for report builders |
| Document calculated fields | Others understand the logic |
| Limit scope | Performance and relevance |
| Test with sample data | Verify calculations before sharing |
| Set permissions | Prevent unauthorized access to sensitive data |

---

## 5. Custom Properties & Objects

### 5.1 Property Management Strategy

**Where:** Settings > Properties

| Guideline | Recommendation | Why |
|-----------|---------------|-----|
| Naming convention | `snake_case` with prefix (e.g., `ops_sync_status`) | Avoid conflicts, easy identification |
| Property groups | Organize related properties into groups | Clean UI for users |
| Required fields | Only require what's truly necessary | Balance data quality with usability |
| Field validation | Use appropriate field types and validation | Prevent bad data at entry |
| Documentation | Maintain a property dictionary | Team knows what each property means |

**hubcli:**
```bash
# List all contact properties
hubcli crm properties list contacts --limit 100

# Create a custom property
hubcli crm properties create contacts --data '{
  "name": "ops_data_source",
  "label": "Data Source",
  "type": "enumeration",
  "fieldType": "select",
  "groupName": "contactinformation",
  "options": [
    {"label": "Website", "value": "website", "displayOrder": 0},
    {"label": "Import", "value": "import", "displayOrder": 1},
    {"label": "API", "value": "api", "displayOrder": 2},
    {"label": "Integration", "value": "integration", "displayOrder": 3}
  ]
}' --force

# Delete a property (careful!)
hubcli crm properties delete contacts <propertyName> --force
```

### 5.2 Custom Objects (Enterprise)

**Where:** Settings > Objects > Custom Objects

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Object name | Singular and plural labels | UI display |
| Primary display property | Which property shows in record title | Quick identification |
| Properties | Custom properties for the object | Data model |
| Associations | Links to standard objects (contacts, companies, deals) | Relational data |
| Pipelines | Optional pipeline for status tracking | Process management |

**hubcli:**
```bash
# List custom objects (schemas)
hubcli crm schemas list

# Create a custom object
hubcli crm schemas create --data '{
  "name": "project",
  "labels": {"singular": "Project", "plural": "Projects"},
  "primaryDisplayProperty": "project_name",
  "properties": [
    {"name": "project_name", "label": "Project Name", "type": "string", "fieldType": "text"},
    {"name": "project_status", "label": "Status", "type": "enumeration", "fieldType": "select",
     "options": [{"label": "Active", "value": "active"}, {"label": "Complete", "value": "complete"}]},
    {"name": "start_date", "label": "Start Date", "type": "date", "fieldType": "date"}
  ],
  "associatedObjects": ["CONTACT", "COMPANY"]
}' --force
```

---

## 6. Import & Export

**Where:** Contacts > Import (or any object > Import)

### 6.1 Import Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| File format | CSV or XLSX | Data source format |
| Object type | Which CRM object to import to | Target destination |
| Column mapping | Map file columns to HubSpot properties | Correct data placement |
| Import type | Create new, update existing, or both | Control record creation |
| Deduplication | Match on email, record ID, or custom property | Prevent duplicates |
| List creation | Auto-create list of imported records | Track imported batch |

### 6.2 Import Best Practices

| Practice | Why |
|----------|-----|
| Clean data before import | Garbage in, garbage out |
| Test with small sample first | Verify mapping before bulk import |
| Include unique identifier | Email for contacts, domain for companies |
| Use consistent date format | YYYY-MM-DD or MM/DD/YYYY |
| Remove duplicates in source file | Don't create duplicate CRM records |
| Back up before large imports | Safety net |

**hubcli:**
```bash
# Import contacts from CSV
hubcli crm imports create --file ./contacts.csv --object contacts --force

# Check import status
hubcli crm imports list --limit 10
```

---

## Setup Checklist

### Data Sync
```
[ ] Key integrations identified for data sync
[ ] Sync direction configured per integration
[ ] Field mappings defined and tested
[ ] Conflict resolution rules set
[ ] Filter rules configured (which records to sync)
[ ] Sync health monitoring in place
```

### Data Quality
```
[ ] Data quality command center reviewed
[ ] Formatting automation rules created (names, phones, dates)
[ ] Duplicate detection rules configured
[ ] Initial duplicate review and merge completed
[ ] Ongoing data quality monitoring established
```

### Workflows
```
[ ] Custom code actions created for complex logic (if needed)
[ ] Webhook integrations configured
[ ] Data formatting workflows active
[ ] Cross-object automation workflows built
```

### Datasets
```
[ ] Key datasets created for reporting
[ ] Calculated fields defined and tested
[ ] Dataset permissions set
[ ] Report builders trained on available datasets
```

### Properties & Objects
```
[ ] Property naming convention established
[ ] Property groups organized
[ ] Unnecessary properties archived
[ ] Custom objects created (if needed)
[ ] Association relationships configured
```

### Import/Export
```
[ ] Import process documented
[ ] Import templates created (CSV with correct columns)
[ ] Initial data import completed and verified
[ ] Ongoing import process established (if recurring)
```
