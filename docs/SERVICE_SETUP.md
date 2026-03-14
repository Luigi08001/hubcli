# Service Setup Guide

> See also: [[PORTAL_SETUP]] · [[SALES_SETUP]] · [[OPERATIONS_SETUP]] · [[REPORTING_SETUP]]

Complete configuration guide for HubSpot Service Hub settings. Covers tickets, knowledge base, customer portal, feedback surveys, SLAs, and service automation.

**Prerequisites:**
- Portal authenticated (`hubcli auth whoami`)
- Private App scopes: `tickets`, `crm.schemas.tickets.read/write`
- Users & Teams configured (see [PORTAL_SETUP.md](./PORTAL_SETUP.md))

---

## 1. Tickets & Pipelines

**Where:** Settings > Objects > Tickets

### 1.1 Ticket Pipeline Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Pipeline name | Name per support process (e.g., "Support", "Bug Reports", "Feature Requests") | Separate workflows for different request types |
| Ticket statuses | Ordered statuses: Open → In Progress → Waiting on Contact → Closed | Tracks ticket lifecycle |
| Status categories | Map each status to Open, In Progress, or Closed | Powers reporting and SLAs |
| Conditional properties | Required properties per status | Data quality at each stage |
| Multiple pipelines | Different pipelines for different support tiers or request types | Tailored processes |

**hubcli:**
```bash
# List ticket pipelines
hubcli crm pipelines list tickets

# Get pipeline details
hubcli crm pipelines get tickets <pipelineId>

# Create a support pipeline
hubcli crm pipelines create tickets --data '{
  "label": "Customer Support",
  "displayOrder": 0,
  "stages": [
    {"label": "New", "displayOrder": 0, "metadata": {"ticketState": "OPEN"}},
    {"label": "In Progress", "displayOrder": 1, "metadata": {"ticketState": "OPEN"}},
    {"label": "Waiting on Contact", "displayOrder": 2, "metadata": {"ticketState": "OPEN"}},
    {"label": "Waiting on Third Party", "displayOrder": 3, "metadata": {"ticketState": "OPEN"}},
    {"label": "Resolved", "displayOrder": 4, "metadata": {"ticketState": "CLOSED"}},
    {"label": "Closed", "displayOrder": 5, "metadata": {"ticketState": "CLOSED"}}
  ]
}' --force
```

### 1.2 Ticket Properties

| Property | Type | Purpose |
|----------|------|---------|
| `subject` | Text | Ticket subject line |
| `content` | Text | Ticket description |
| `hs_ticket_priority` | Select | Priority level (Low, Medium, High, Urgent) |
| `hs_ticket_category` | Select | Category (Billing, Technical, General, etc.) |
| `hubspot_owner_id` | Owner | Assigned agent |
| `hs_pipeline` | Select | Which pipeline |
| `hs_pipeline_stage` | Select | Current status |
| `source_type` | Select | How ticket was created (Email, Chat, Form, Phone) |

**hubcli:**
```bash
# Create custom ticket property
hubcli crm properties create tickets --data '{
  "name": "ticket_product_area",
  "label": "Product Area",
  "type": "enumeration",
  "fieldType": "select",
  "groupName": "ticketinformation",
  "options": [
    {"label": "Core Platform", "value": "core_platform", "displayOrder": 0},
    {"label": "Integrations", "value": "integrations", "displayOrder": 1},
    {"label": "Billing", "value": "billing", "displayOrder": 2},
    {"label": "Mobile App", "value": "mobile_app", "displayOrder": 3}
  ]
}' --force

# Search tickets by priority
hubcli crm tickets search --data '{
  "filterGroups": [{
    "filters": [{
      "propertyName": "hs_ticket_priority",
      "operator": "EQ",
      "value": "HIGH"
    }]
  }],
  "limit": 20
}'
```

---

## 2. Help Desk & Inbox

**Where:** Settings > Inbox > Inboxes (or Settings > Help Desk)

### 2.1 Help Desk Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Help desk workspace | Enable help desk view | Unified agent workspace |
| Default pipeline | Which pipeline for new tickets | Auto-routing |
| SLA settings | Response and resolution time targets | Service quality management |
| Working hours | Business hours for SLA calculation | SLAs pause outside hours |
| Auto-assignment | Round-robin or skill-based routing | Fair distribution, faster response |

### 2.2 Channels

| Channel | Configuration | Creates ticket? |
|---------|--------------|----------------|
| Team email | Forward support@ to HubSpot | Yes, automatically |
| Live chat | Chat widget on website | Yes, when converted |
| Facebook Messenger | Connect Facebook page | Yes, when converted |
| Form submissions | Connect support forms | Yes, per form settings |
| Calling | HubSpot or third-party calling | Manual ticket creation |
| WhatsApp Business | Connect WhatsApp (requires Meta Business) | Yes, when converted |

### 2.3 Routing Rules

| Rule | Configuration | Example |
|------|--------------|---------|
| By topic/category | Route based on form field or keyword | Billing → Finance team |
| By language | Route based on detected language | Spanish → Spanish-speaking agents |
| By customer tier | Route based on company property | Enterprise → Senior agents |
| Round-robin | Equal distribution within team | Default for general inquiries |
| Skill-based | Match ticket properties to agent skills | Technical → Engineering support |

---

## 3. Knowledge Base

**Where:** Service > Knowledge Base | Settings > Content > Knowledge Base

### 3.1 Knowledge Base Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Domain | Subdomain for KB (e.g., `help.yourcompany.com`) | Professional, branded help center |
| Template | Theme and layout | Match brand design |
| Logo & favicon | Brand assets | Visual consistency |
| Navigation | Category structure | Easy content discovery |
| Search | Built-in search functionality | Self-service resolution |
| Language | Primary language + translations | Serve global customers |
| Contact support link | Link/button to submit ticket | Escalation path when self-service fails |

### 3.2 Category Structure

| Level | Example | Purpose |
|-------|---------|---------|
| Category | "Getting Started" | Top-level grouping |
| Subcategory | "Account Setup" | Second-level grouping |
| Article | "How to Reset Your Password" | Individual help article |

### 3.3 Article Best Practices

| Element | Configuration |
|---------|--------------|
| Title | Clear, question-based (matches search queries) |
| Body | Step-by-step with screenshots |
| Tags | Keywords for search discoverability |
| Related articles | Cross-linked articles for deeper context |
| Feedback | Enable "Was this helpful?" rating |
| Visibility | Public (all) or Private (logged-in customers only) |

> **API:** Knowledge base articles are not currently exposed via public API. Management is UI-only.

---

## 4. Customer Portal

**Where:** Settings > Content > Customer Portal (Service Hub Professional+)

### 4.1 Portal Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Portal URL | Custom domain or subdomain | Branded self-service |
| Login method | Email + password, SSO | Secure customer access |
| Template | Theme matching your brand | Consistent experience |
| Logo & colors | Brand assets | Visual consistency |
| Navigation | Links to KB, ticket submission, account | Easy self-service |

### 4.2 Portal Features

| Feature | Configuration | Purpose |
|---------|--------------|---------|
| Ticket list | Customers see their open/closed tickets | Transparency |
| Ticket submission | Form to create new tickets | Self-service |
| Ticket detail | Full conversation history | Context |
| Knowledge base | Embedded KB search | Self-resolution |
| File attachment | Allow file uploads on tickets | Rich support context |

### 4.3 Portal Access Control

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Registration | Open registration or invite-only | Control who can access |
| Required properties | Contact properties needed at registration | Data collection |
| Visibility | Which tickets visible (own only, company-wide) | Privacy/transparency balance |
| Branding | Custom CSS for advanced styling | Pixel-perfect branding |

---

## 5. Feedback Surveys

**Where:** Service > Feedback Surveys | Settings > Service > Feedback Surveys

### 5.1 Survey Types

| Survey type | Metric | Question | Scale |
|-------------|--------|----------|-------|
| NPS (Net Promoter Score) | Loyalty | "How likely are you to recommend us?" | 0–10 |
| CSAT (Customer Satisfaction) | Satisfaction | "How satisfied are you with your experience?" | 1–5 or 1–7 |
| CES (Customer Effort Score) | Ease | "How easy was it to get your issue resolved?" | 1–5 or 1–7 |
| Custom survey | Custom | Your own questions | Custom |

### 5.2 Survey Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Delivery method | Email, web page, or chat | Choose based on context |
| Trigger | After ticket close, after purchase, periodic | Timely feedback collection |
| Delay | Time after trigger to send (e.g., 1 hour after ticket close) | Avoid surveying too early |
| Frequency | Max surveys per contact per period | Survey fatigue prevention |
| Follow-up questions | Open-text follow-up based on score | Qualitative insights |
| Thank you message | Custom response per score range | Acknowledge feedback |
| Automation | Trigger workflow based on score | Act on feedback |

### 5.3 Score-Based Automation

| Score range (NPS) | Classification | Recommended action |
|-------------------|----------------|-------------------|
| 9–10 | Promoter | Ask for review/referral, enroll in advocacy program |
| 7–8 | Passive | Send thank you, identify improvement areas |
| 0–6 | Detractor | Alert CS manager, create follow-up ticket, personal outreach |

---

## 6. SLAs (Service Level Agreements)

**Where:** Settings > Help Desk > SLAs (Service Hub Professional+)

### 6.1 SLA Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| First response time | Max time to first reply (by priority) | Customer expectations |
| Time to close | Max time to resolve (by priority) | Resolution accountability |
| Working hours | Business hours for SLA clock | Realistic time calculations |
| Priority levels | Map ticket priority to SLA targets | Higher priority = faster response |

### 6.2 SLA Targets by Priority

| Priority | First Response | Time to Close |
|----------|---------------|---------------|
| Urgent | 1 hour | 4 hours |
| High | 4 hours | 8 hours |
| Medium | 8 hours | 24 hours |
| Low | 24 hours | 72 hours |

### 6.3 SLA Escalation

| Trigger | Action | Purpose |
|---------|--------|---------|
| 50% of SLA elapsed | Warning notification to agent | Proactive awareness |
| 75% of SLA elapsed | Escalate to team lead | Prevent breach |
| SLA breached | Alert manager, reassign if needed | Immediate attention |
| SLA at risk (pattern) | Flag in reporting | Systemic issue identification |

---

## 7. Snippets & Saved Replies

**Where:** Conversations > Snippets

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Snippet name | Descriptive name with shortcut (e.g., `#greeting`) | Quick insertion via shortcut |
| Content | Pre-written response text | Consistency, speed |
| Personalization | Include tokens (contact name, ticket #) | Personalized yet efficient |
| Categories | Organize by type (greetings, closings, FAQs, escalation) | Easy discovery |
| Team sharing | Share across team | Consistent messaging |

### Common Snippet Categories

| Category | Examples |
|----------|---------|
| Greetings | Welcome message, acknowledgment |
| Status updates | "We're investigating", "Awaiting your response" |
| Resolutions | "Issue resolved", "Bug fixed in latest release" |
| Escalations | "Escalating to engineering", "Transferring to billing" |
| Closings | "Is there anything else?", "Thank you for your patience" |
| FAQs | Common question answers (linked to KB articles) |

---

## 8. Service Automation & Workflows

**Where:** Automation > Workflows | Settings > Objects > Tickets > Automate

### 8.1 Common Service Workflows

| Trigger | Actions | Purpose |
|---------|---------|---------|
| New ticket created | Auto-assign, set priority, send acknowledgment | Fast first response |
| Ticket idle > X hours | Notify agent, escalate if SLA at risk | Prevent SLA breaches |
| Ticket status → Waiting on Contact | Send reminder after 48 hours | Re-engage customer |
| Ticket status → Closed | Send CSAT survey after 1 hour | Collect feedback |
| CSAT score ≤ 2 | Create follow-up ticket, alert manager | Recover unhappy customers |
| Ticket reopened | Reassign to original agent, reset SLA clock | Continuity |
| High-priority ticket created | Slack notification to on-call team | Immediate attention |

### 8.2 Ticket-Based Automation

**Where:** Settings > Objects > Tickets > Automate tab (per pipeline)

| Trigger | Action | Example |
|---------|--------|---------|
| Ticket enters status | Create task | "Review and classify" when ticket is New |
| Ticket enters status | Update property | Set resolution date when Closed |
| Ticket enters status | Send email | Acknowledgment when ticket created |
| Ticket enters status | Send notification | Alert team when escalated |

---

## Setup Checklist

### Tickets & Pipelines
```
[ ] Primary support pipeline created with statuses
[ ] Status categories mapped (Open, In Progress, Closed)
[ ] Custom ticket properties created (category, product area, etc.)
[ ] Priority levels configured
[ ] Conditional properties set per status
```

### Help Desk & Inbox
```
[ ] Help desk workspace enabled
[ ] Team email channel connected (support@)
[ ] Live chat widget configured and deployed
[ ] Routing rules set up (round-robin or skill-based)
[ ] Working hours configured
[ ] Auto-assignment enabled
```

### Knowledge Base
```
[ ] Knowledge base domain configured
[ ] Template/theme selected and branded
[ ] Category structure created
[ ] Initial articles published (top 10 FAQs)
[ ] Search enabled and tested
[ ] "Contact support" link configured
```

### Customer Portal
```
[ ] Portal URL configured
[ ] Login method set (email or SSO)
[ ] Template branded (logo, colors)
[ ] Ticket visibility settings configured
[ ] Registration flow tested
```

### Feedback Surveys
```
[ ] NPS survey configured and scheduled
[ ] CSAT survey set to trigger after ticket close
[ ] Follow-up questions added per score range
[ ] Score-based automation workflows created
[ ] Survey frequency limits set
```

### SLAs
```
[ ] SLA targets defined per priority level
[ ] Working hours set for SLA calculation
[ ] Escalation rules configured (warning, breach)
[ ] SLA reporting dashboard created
```

### Snippets
```
[ ] Greeting snippets created
[ ] FAQ response snippets created
[ ] Status update snippets created
[ ] Closing snippets created
[ ] Snippets shared with team
```

### Service Automation
```
[ ] New ticket auto-assignment workflow active
[ ] Ticket idle alert workflow active
[ ] CSAT survey trigger workflow active
[ ] Detractor follow-up workflow active
[ ] SLA breach escalation workflow active
[ ] Ticket closure automation configured
```
