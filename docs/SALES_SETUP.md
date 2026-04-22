# Sales Setup Guide

> See also: [[PORTAL_SETUP]] · [[MARKETING_SETUP]] · [[COMMERCE_SETUP]] · [[REPORTING_SETUP]]

Complete configuration guide for HubSpot Sales Hub settings. Covers deals pipeline, quotes, meetings, sequences, playbooks, forecasting, and sales automation.

**Prerequisites:**
- Portal authenticated (`hscli auth whoami`)
- Private App scopes: `crm.objects.deals.read/write`, `sales-email-read`, `crm.schemas.deals.read/write`
- Users & Teams configured (see [PORTAL_SETUP.md](./PORTAL_SETUP.md))

---

## 1. Deals & Pipeline

**Where:** Settings > Objects > Deals

### 1.1 Pipeline Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Pipeline name | Name for each sales process (e.g., "New Business", "Renewals") | Separate pipelines for different sales motions |
| Deal stages | Ordered stages with win probability % | Tracks deal progression, powers forecasting |
| Stage probability | Win likelihood per stage (e.g., Discovery = 20%, Proposal = 60%) | Weighted pipeline value and forecasting |
| Stage requirements | Required properties before moving to next stage | Data quality and process enforcement |
| Multiple pipelines | Separate pipelines for different deal types | Each sales motion has unique stages |

**hscli:**
```bash
# List all pipelines
hscli crm pipelines list deals

# Get pipeline details (stages, probabilities)
hscli crm pipelines get deals <pipelineId>

# Create a new pipeline
hscli crm pipelines create deals --data '{
  "label": "New Business",
  "displayOrder": 0,
  "stages": [
    {"label": "Appointment Scheduled", "displayOrder": 0, "metadata": {"probability": "0.2"}},
    {"label": "Qualified to Buy", "displayOrder": 1, "metadata": {"probability": "0.4"}},
    {"label": "Presentation Scheduled", "displayOrder": 2, "metadata": {"probability": "0.6"}},
    {"label": "Decision Maker Bought-In", "displayOrder": 3, "metadata": {"probability": "0.8"}},
    {"label": "Contract Sent", "displayOrder": 4, "metadata": {"probability": "0.9"}},
    {"label": "Closed Won", "displayOrder": 5, "metadata": {"probability": "1.0"}},
    {"label": "Closed Lost", "displayOrder": 6, "metadata": {"probability": "0.0"}}
  ]
}' --force

# Update a pipeline stage
hscli crm pipelines stages update deals <pipelineId> <stageId> --data '{
  "label": "Negotiation",
  "metadata": {"probability": "0.85"}
}' --force
```

### 1.2 Deal Properties

| Property | Type | Purpose |
|----------|------|---------|
| `dealname` | Text | Deal name (auto or manual) |
| `amount` | Currency | Deal value |
| `closedate` | Date | Expected close date |
| `dealstage` | Select | Current pipeline stage |
| `pipeline` | Select | Which pipeline |
| `hubspot_owner_id` | Owner | Assigned sales rep |
| `deal_currency_code` | Select | Currency (if multi-currency enabled) |

**hscli:**
```bash
# Create custom deal property
hscli crm properties create deals --data '{
  "name": "deal_source",
  "label": "Deal Source",
  "type": "enumeration",
  "fieldType": "select",
  "groupName": "dealinformation",
  "options": [
    {"label": "Inbound", "value": "inbound", "displayOrder": 0},
    {"label": "Outbound", "value": "outbound", "displayOrder": 1},
    {"label": "Partner Referral", "value": "partner", "displayOrder": 2},
    {"label": "Event", "value": "event", "displayOrder": 3}
  ]
}' --force
```

### 1.3 Deal Automation

**Where:** Settings > Objects > Deals > Pipelines > Automate tab

| Trigger | Action | Example |
|---------|--------|---------|
| Deal enters stage | Create task | "Send proposal" task when deal enters Proposal stage |
| Deal enters stage | Send notification | Alert manager when deal enters Negotiation |
| Deal enters stage | Update property | Set close date to 30 days from now when qualified |
| Deal won | Trigger workflow | Send welcome email, create onboarding ticket |
| Deal lost | Trigger workflow | Add to re-engagement nurture |

---

## 2. Quotes

**Where:** Settings > Objects > Quotes

### 2.1 Quote Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Quote template | Default template with branding | Professional-looking quotes |
| Quote expiration | Default validity period (e.g., 30 days) | Creates urgency |
| E-signature | Enable electronic signatures | Streamlines deal closing |
| Payment collection | Collect payment via quote | Combines quote acceptance + payment |
| Quote numbering | Auto-numbering prefix and sequence | Professional quote tracking |
| Terms & conditions | Default legal terms on quotes | Legal compliance |
| Countersignature | Require internal countersign | Approval process for large deals |

**hscli:**
```bash
# List quotes
hscli crm quotes list --limit 20

# Get quote details
hscli crm quotes get <quoteId>
```

---

## 3. Products & Line Items

**Where:** Settings > Objects > Products

**hscli:**
```bash
# List products
hscli crm products list --limit 50

# Create a product
hscli crm products create --data '{
  "properties": {
    "name": "Enterprise License",
    "description": "Annual enterprise software license",
    "price": "25000",
    "hs_sku": "ENT-001",
    "hs_recurring_billing_period": "P12M"
  }
}' --force

# Create a line item (associated with a deal)
hscli crm line-items create --data '{
  "properties": {
    "name": "Enterprise License",
    "quantity": "1",
    "price": "25000",
    "hs_product_id": "<productId>"
  }
}' --force
```

---

## 4. Meetings & Scheduling

**Where:** Settings > Sales > Meetings

### 4.1 Meeting Link Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Calendar connection | Google Calendar or Outlook 365 | Real-time availability sync |
| Meeting link URL | Custom slug (e.g., `meetings.yourcompany.com/john`) | Clean booking links |
| Duration options | 15, 30, 45, 60 min | Match meeting types to durations |
| Availability window | Working hours + buffer time | Prevent back-to-back meetings |
| Buffer time | Minutes before/after meetings | Prep time |
| Minimum notice | Hours before a meeting can be booked | Prevent last-minute bookings |

### 4.2 Meeting Types

| Type | Configuration | Use case |
|------|--------------|----------|
| Personal | 1:1 with specific rep | Discovery calls, demos |
| Team (round-robin) | Rotates among team members | Inbound lead distribution |
| Group | Multiple reps on same call | Panel interviews, complex demos |

---

## 5. Sequences

**Where:** Sales > Sequences | Settings > Sales > Sequences

### 5.1 Sequence Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Sending window | Days and hours when emails send | Respect business hours |
| Throttle | Max enrollments per day per user | Avoid spam flags |
| Unenroll triggers | Contact replies, books meeting, deal created | Stop when goal met |
| Sender | Individual user's connected email | Sends from rep's email |

### 5.2 Sequence Steps

| Step type | Description | Timing |
|-----------|-------------|--------|
| Automated email | Sent automatically | Delay in days from previous step |
| Manual email task | Task for rep to personalize | Appears in task queue |
| Call task | Task to make a phone call | Appears in task queue |
| LinkedIn task | Task for LinkedIn outreach | Manual execution |
| General task | Any custom task | Flexible follow-up |

---

## 6. Playbooks

**Where:** Sales > Playbooks (Sales Hub Professional+)

| Type | Use case | Example |
|------|----------|---------|
| Discovery | First call qualification | BANT questions, pain points |
| Demo | Product demonstration | Feature walkthrough |
| Negotiation | Price/terms discussion | Discount authority, objections |
| Onboarding | Post-sale kickoff | Implementation timeline |

---

## 7. Forecasting

**Where:** Sales > Forecasting | Settings > Sales > Forecasting

### 7.1 Forecast Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Forecast period | Monthly or quarterly | Match your business cadence |
| Pipeline(s) | Which pipelines to include | Scope of forecast |
| Forecast categories | Pipeline, Best Case, Commit, Closed | Deal confidence classification |
| Targets/quotas | Revenue targets per rep, team, period | Forecast vs. target comparison |

### 7.2 Forecast Categories

| Category | Definition |
|----------|-----------|
| Pipeline | In pipeline, not yet qualified |
| Best Case | Could close if things go well |
| Commit | High confidence, verbal commitment |
| Closed | Won and signed |
| Omit | Excluded from forecast |

---

## 8. Sales Automation & Workflows

### 8.1 Common Sales Workflows

| Trigger | Actions | Purpose |
|---------|---------|---------|
| New deal created | Assign owner, create tasks | New deal setup |
| Deal stage change | Update properties, create tasks | Enforce process |
| Deal idle > X days | Reminder + escalation | Prevent stagnation |
| Deal amount > threshold | Require approval | Oversight on large deals |
| Deal closed won | Onboarding ticket, welcome email | Handoff to CS |
| Deal closed lost | Nurture sequence, log reason | Feedback + re-engagement |

---

## 9. Connected Email & Calling

### 9.1 Email Integration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Email provider | Gmail or Outlook 365 | Two-way email sync |
| Log emails | Auto-log sent/received to CRM | Complete communication history |
| Track opens/clicks | Enable tracking | Know when prospects engage |

### 9.2 Calling

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Calling provider | HubSpot, Twilio, or third-party | Make calls from CRM |
| Call recording | Enable/disable (check local laws) | Training, compliance |
| Call outcomes | Connected, left voicemail, no answer | Track call effectiveness |

---

## 10. Documents & Templates

### 10.1 Documents

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Document library | Upload sales collateral | Centralized content |
| Tracking | Track views and time spent | Buyer engagement signals |
| Require email | Require email before access | Identify viewers |

### 10.2 Email Templates

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Template library | Pre-built email templates | Saves time, ensures quality |
| Personalization tokens | Dynamic fields | Personalized at scale |
| Folders | Organize by use case | Easy discovery |

---

## Setup Checklist

### Deals & Pipeline
```
[ ] Primary pipeline created with stages and probabilities
[ ] Stage requirements configured
[ ] Deal automation rules set
[ ] Custom deal properties created
[ ] Additional pipelines created (if needed)
```

### Quotes
```
[ ] Quote template branded
[ ] Default expiration set
[ ] E-signature enabled
[ ] Quote numbering configured
```

### Products
```
[ ] Product library populated
[ ] Pricing and billing frequency set
[ ] SKUs assigned
```

### Meetings
```
[ ] Calendar connected for all reps
[ ] Meeting links configured per rep
[ ] Round-robin team link set up
[ ] Availability and buffer times configured
```

### Sequences
```
[ ] Sending windows configured
[ ] Throttle limits set
[ ] Unenroll triggers configured
[ ] At least one sequence created
```

### Forecasting
```
[ ] Forecast period set
[ ] Forecast categories defined
[ ] Targets/quotas set per rep and team
```

### Sales Automation
```
[ ] New deal workflow created
[ ] Deal stage automations configured
[ ] Idle deal alerts set up
[ ] Closed-won handoff workflow active
[ ] Closed-lost feedback workflow active
```

### Email & Calling
```
[ ] All reps connected personal email
[ ] Email tracking enabled
[ ] Calling provider configured
[ ] Call outcomes defined
```
