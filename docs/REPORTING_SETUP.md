# Reporting & Analytics Setup Guide

> See also: [[PORTAL_SETUP]] · [[MARKETING_SETUP]] · [[SALES_SETUP]] · [[OPERATIONS_SETUP]]

Complete configuration guide for HubSpot reporting and analytics. Covers dashboards, custom reports, attribution, analytics tools, and report sharing.

**Prerequisites:**
- Portal authenticated (`hscli auth whoami`)
- Users & Teams configured (see [PORTAL_SETUP.md](./PORTAL_SETUP.md))
- CRM data populated (contacts, deals, tickets, etc.)

---

## 1. Dashboards

**Where:** Reports > Dashboards

### 1.1 Dashboard Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Dashboard name | Descriptive name per audience (e.g., "Sales Leadership", "Marketing Overview") | Quick identification |
| Visibility | Private, team, or everyone | Access control |
| Default dashboard | Which dashboard loads first per user | Immediate visibility of key metrics |
| Layout | 1, 2, or 3 column grid | Information density |
| Date range | Default date filter (this month, this quarter, custom) | Consistent time window |
| Filters | Dashboard-level filters (owner, team, pipeline) | Interactive exploration |

### 1.2 Recommended Dashboards

| Dashboard | Audience | Key reports |
|-----------|----------|-------------|
| Executive Summary | C-suite | Revenue, pipeline, conversion rates, NPS |
| Marketing Performance | Marketing team | Traffic, leads, email metrics, campaign ROI |
| Sales Pipeline | Sales leadership | Pipeline value, stage conversion, forecast |
| Sales Rep Activity | Sales managers | Calls, emails, meetings, deals per rep |
| Service Overview | Service leadership | Tickets, resolution time, CSAT, SLA compliance |
| Revenue Operations | RevOps | Funnel, lifecycle stage conversion, data quality |
| Website Analytics | Marketing/Content | Traffic, top pages, conversion rates, SEO |
| ABM Dashboard | ABM team | Target account engagement, pipeline by tier |

### 1.3 Dashboard Best Practices

| Practice | Why |
|----------|-----|
| One dashboard per audience | Different teams need different views |
| 8–12 reports per dashboard | Focused, not overwhelming |
| Lead with KPIs at top | Most important metrics first |
| Include trend charts | Context over point-in-time numbers |
| Add comparison periods | Month-over-month, year-over-year |
| Set recurring email delivery | Automated reporting cadence |

---

## 2. Custom Reports

**Where:** Reports > Reports > Create Report

### 2.1 Report Types

| Type | Description | Best for |
|------|-------------|----------|
| Single object | One CRM object (contacts, deals, etc.) | Simple counts, lists, breakdowns |
| Cross-object | Multiple related objects | Contacts with deals, deals with tickets |
| Funnel | Stage-to-stage conversion | Sales funnel, lifecycle progression |
| Attribution | Multi-touch revenue attribution | Marketing ROI |
| Custom report builder | Drag-and-drop visual builder | Complex multi-dimensional reports |
| Dataset-based | Built on Operations Hub datasets | Advanced calculated metrics |

### 2.2 Visualization Types

| Chart type | Best for | Example |
|------------|----------|---------|
| Bar chart | Comparisons | Deals by stage, leads by source |
| Line chart | Trends over time | Monthly revenue, traffic growth |
| Area chart | Volume trends | Cumulative deals over time |
| Pie/donut | Proportions | Lead source distribution |
| KPI/number | Single metric | Total revenue, open tickets |
| Table | Detailed data | Contact list with properties |
| Pivot table | Multi-dimensional | Revenue by rep by quarter |
| Funnel | Stage progression | Lead → MQL → SQL → Customer |
| Combo chart | Dual axis | Revenue (bars) + deal count (line) |

### 2.3 Common Custom Reports

| Report | Objects | Metrics | Dimensions |
|--------|---------|---------|------------|
| Pipeline velocity | Deals | Average days in stage | Pipeline stage |
| Lead source ROI | Contacts + Deals | Revenue, conversion rate | Original source |
| Rep performance | Deals | Total revenue, win rate, avg deal size | Owner |
| Ticket resolution | Tickets | Avg time to close, volume | Priority, category |
| Email engagement | Marketing emails | Open rate, click rate, unsubscribes | Campaign, date |
| Landing page conversion | Landing pages | Views, submissions, conversion rate | Page, source |
| MQL → SQL conversion | Contacts | Conversion rate, time to convert | Source, date |
| Customer lifecycle | Contacts | Count per lifecycle stage | Stage, date |

---

## 3. Attribution Reporting

**Where:** Reports > Attribution (Marketing Hub Enterprise / CMS Hub Enterprise)

### 3.1 Attribution Models

| Model | Description | Best for |
|-------|-------------|----------|
| First touch | 100% credit to first interaction | Understanding acquisition channels |
| Last touch | 100% credit to last interaction before conversion | Understanding closing channels |
| Linear | Equal credit to all touchpoints | Balanced view of all interactions |
| U-shaped | 40% first, 40% last, 20% middle | Valuing both discovery and conversion |
| W-shaped | 30% first, 30% lead create, 30% deal create, 10% middle | Full funnel visibility |
| Time decay | More credit to recent interactions | Recency-weighted analysis |
| Full path | 22.5% each for 4 key stages, 10% remaining | Most comprehensive model |
| Custom | Define your own weights | Tailored to your business |

### 3.2 Attribution Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Content types | Which interactions to track (pages, emails, ads, etc.) | Attribution scope |
| Conversion events | What counts as a conversion (form submit, deal create) | Define success metrics |
| Lookback window | How far back to attribute (30, 60, 90 days) | Attribution time frame |
| Revenue attribution | Connect deal revenue to marketing touchpoints | Marketing ROI |

### 3.3 Contact vs. Revenue Attribution

| Type | Question it answers | Data needed |
|------|-------------------|-------------|
| Contact attribution | "Which channels create the most leads?" | Contacts + interactions |
| Revenue attribution | "Which channels drive the most revenue?" | Contacts + deals + interactions |

---

## 4. Analytics Tools

**Where:** Reports > Analytics Tools

### 4.1 Traffic Analytics

| Report | What it shows | Where |
|--------|--------------|-------|
| Sources | Traffic by channel (organic, paid, social, email, direct) | Analytics > Traffic |
| Topic clusters | SEO performance by topic | Analytics > Traffic > Topics |
| Pages | Performance per page (views, bounce rate, time on page) | Analytics > Traffic > Pages |
| UTM parameters | Campaign tracking performance | Analytics > Traffic > UTM |

### 4.2 Contact Analytics

| Report | What it shows | Where |
|--------|--------------|-------|
| Contact create attribution | How contacts were created | Analytics > Contacts |
| Lifecycle stage funnel | Conversion through stages | Analytics > Contacts > Lifecycle |
| List performance | Growth and engagement per list | Analytics > Contacts > Lists |

### 4.3 Sales Analytics

| Report | What it shows | Where |
|--------|--------------|-------|
| Deal forecast | Weighted pipeline by category | Reports > Sales Analytics |
| Sales activities | Calls, emails, meetings per rep | Reports > Sales Analytics |
| Deal velocity | Time in each pipeline stage | Reports > Sales Analytics |
| Win/loss analysis | Win rate by source, rep, product | Reports > Sales Analytics |
| Quota attainment | Actual vs. target per rep | Reports > Sales Analytics |

### 4.4 Service Analytics

| Report | What it shows | Where |
|--------|--------------|-------|
| Ticket volume | Tickets created over time | Reports > Service Analytics |
| Resolution time | Average time to close by priority | Reports > Service Analytics |
| SLA performance | % tickets meeting SLA targets | Reports > Service Analytics |
| Agent performance | Tickets handled, resolution time per agent | Reports > Service Analytics |
| CSAT/NPS trends | Customer satisfaction over time | Reports > Service Analytics |

---

## 5. Report Sharing & Scheduling

**Where:** Reports > Dashboards > Share/Email

### 5.1 Sharing Options

| Method | Configuration | Use case |
|--------|--------------|----------|
| Dashboard sharing | Share with specific users, teams, or everyone | Ongoing access |
| Scheduled email | Recurring dashboard email (daily, weekly, monthly) | Automated reporting |
| Slack integration | Send reports to Slack channels | Real-time team visibility |
| Export | PDF, CSV, XLSX export | Offline analysis, presentations |
| Embed | Embed dashboard in external page | Portal or intranet |

### 5.2 Scheduled Report Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Recipients | Email addresses (internal + external) | Who receives the report |
| Frequency | Daily, weekly, monthly | Reporting cadence |
| Day/time | When the email is sent | Convenient delivery |
| Subject line | Custom email subject | Clear identification |
| Message | Optional note with context | Explain what to look for |
| Dashboard filters | Pre-set filters for the emailed version | Relevant data per audience |

---

## 6. Goals & Tracking

**Where:** Reports > Goals

### 6.1 Goal Types

| Goal type | Metric | Example |
|-----------|--------|---------|
| Revenue | Deal revenue closed | $500K/quarter |
| Deals | Number of deals closed | 20 deals/month |
| Contacts | New contacts created | 500 leads/month |
| Calls | Calls logged | 50 calls/week per rep |
| Meetings | Meetings booked | 15 meetings/week per rep |
| Custom | Any numeric property | Custom KPIs |

### 6.2 Goal Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Goal name | Descriptive name | Identification |
| Contributors | Users, teams, or pipelines | Who is responsible |
| Target value | Numeric target per period | Clear objective |
| Duration | Monthly, quarterly, annual | Time-bounded targets |
| Tracking property | Which CRM property to measure | Accurate measurement |
| Pipeline filter | Which pipeline(s) count | Relevant scope |

---

## 7. Custom Behavioral Events

**Where:** Reports > Analytics > Custom Behavioral Events (Marketing Hub Enterprise)

### 7.1 Event Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Event name | Descriptive name (e.g., "Pricing Page Viewed") | Clear identification |
| Event properties | Custom data with the event (plan type, feature viewed) | Granular analysis |
| Tracking method | JavaScript API, HTTP API, or integration | Implementation approach |
| Completion trigger | API call when event occurs | Real-time tracking |

### 7.2 Event Use Cases

| Event | Tracking method | Purpose |
|-------|----------------|---------|
| Product feature usage | JavaScript API in app | Product-led metrics |
| Pricing page interaction | JavaScript tracking | Purchase intent signals |
| API usage | HTTP API from backend | Developer engagement |
| In-app NPS response | HTTP API from app | Product satisfaction |
| Onboarding step completion | HTTP API from app | Activation tracking |

---

## Setup Checklist

### Dashboards
```
[ ] Executive summary dashboard created
[ ] Marketing performance dashboard created
[ ] Sales pipeline dashboard created
[ ] Service overview dashboard created
[ ] Dashboard permissions set per team
[ ] Default dashboard assigned per role
```

### Custom Reports
```
[ ] Key reports built for each department
[ ] Pipeline velocity report created
[ ] Lead source ROI report created
[ ] Rep performance report created
[ ] Ticket resolution report created
[ ] Reports added to appropriate dashboards
```

### Attribution
```
[ ] Attribution model selected (start with linear or U-shaped)
[ ] Content types configured
[ ] Conversion events defined
[ ] Lookback window set
[ ] Revenue attribution enabled (if deals exist)
```

### Analytics Tools
```
[ ] Traffic analytics reviewed and bookmarked
[ ] UTM parameter convention established
[ ] Contact analytics baseline recorded
[ ] Sales analytics reports reviewed
```

### Sharing & Scheduling
```
[ ] Weekly dashboard email scheduled for leadership
[ ] Monthly dashboard email scheduled for stakeholders
[ ] Slack integration configured for key metrics
[ ] Export templates created for board reporting
```

### Goals
```
[ ] Revenue goals set per rep and team
[ ] Activity goals set (calls, meetings) per rep
[ ] Goals visible on dashboards
[ ] Monthly goal review process established
```
