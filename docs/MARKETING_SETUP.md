# Marketing Setup Guide

> See also: [[PORTAL_SETUP]] · [[SALES_SETUP]] · [[REPORTING_SETUP]] · [[hubspot-rules]]

Complete configuration guide for HubSpot Marketing Hub settings. Covers email, campaigns, forms, ads, social, SEO, lead scoring, and ABM. Each section shows the UI path, settings, and hscli commands where API support exists.

**Prerequisites:**
- Portal authenticated (`hscli auth whoami`)
- Private App scopes: `marketing-email`, `marketing.campaigns.read/write`, `forms`, `content`
- Domain and email authentication complete (see [PORTAL_SETUP.md](./PORTAL_SETUP.md) Phase 2)

---

## 1. Email Configuration

**Where:** Settings > Marketing > Email

### 1.1 Sending Domains

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Sending domain | Your authenticated email domain (e.g., `yourcompany.com`) | Emails sent from unauthenticated domains land in spam |
| DKIM/SPF records | DNS records provided by HubSpot | Proves email authenticity, improves deliverability |
| DMARC policy | TXT record at your DNS registrar | Controls what happens when authentication fails |

> **API:** Domain verification is UI + DNS only. No hscli command.

### 1.2 Subscription Types

**Where:** Settings > Marketing > Email > Subscription Types

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Subscription types | Define categories (Marketing, Sales, Newsletter, Product Updates, etc.) | Contacts opt in/out per type — required for CAN-SPAM/GDPR |
| Default subscription | Which type new contacts are enrolled in | Controls initial email eligibility |
| Opt-in process | Single opt-in vs double opt-in | Double opt-in required in some jurisdictions (Germany, Austria) |

> **API:** Subscription types can be managed via the Email Subscriptions API. Scope: `communication_preferences.read/write`.

### 1.3 Email Footer & Compliance

**Where:** Settings > Marketing > Email > Configuration > Footer

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Company name | Legal entity name | CAN-SPAM requirement |
| Company address | Full physical mailing address | CAN-SPAM requirement — must appear in every marketing email |
| Unsubscribe link | Automatically included by HubSpot | Required by law — do not remove |

### 1.4 Frequency Caps

**Where:** Settings > Marketing > Email > Configuration > Frequency

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Max emails per contact | Limit per time period (e.g., max 3/week) | Prevents over-sending and unsubscribes |
| Non-marketing emails | Whether transactional emails count toward the cap | Transactional emails typically bypass frequency caps |
| Time window | Daily, weekly, or monthly cap period | Match to your sending cadence |

### 1.5 Email Health

**Where:** Settings > Marketing > Email > Health

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Hard bounce handling | Auto-remove hard bounces | Protects sender reputation |
| Graymail suppression | Enable/disable | Stops sending to contacts who never open |
| Spam complaint threshold | Monitor via postmaster tools | High complaint rates trigger ISP blocks |

> **API:** UI only. Monitor via HubSpot email health dashboard.

---

## 2. Email Templates & Design

**Where:** Marketing > Email > Templates (or Design Manager)

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Brand kit colors | Primary, secondary, accent colors | Consistent branding across all emails |
| Default font | Font family and sizes | Brand consistency |
| Logo placement | Header logo and dimensions | Automatic inclusion in templates |
| Saved sections | Reusable content blocks (headers, footers, CTAs) | Speeds up email creation |
| Global modules | Shared modules across templates | Single update propagates everywhere |

**hscli:**
```bash
# List email templates
hscli marketing emails list --limit 20

# Get email details
hscli marketing emails get <emailId>

# Create an email (requires template ID)
hscli marketing emails create --data '{
  "name": "March Newsletter",
  "subject": "Your Monthly Update",
  "type": "REGULAR"
}' --force
```

> **API:** `marketing-email` scope. Emails can be created, updated, and listed via API. Template design is primarily UI-based.

---

## 3. Marketing Campaigns

**Where:** Marketing > Campaigns

Campaigns are containers that group related marketing assets (emails, landing pages, forms, CTAs, social posts, ads, workflows) for unified tracking and ROI reporting.

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Campaign name | Descriptive name (e.g., "Q1 2026 Product Launch") | Organizes marketing efforts |
| Goal | Campaign objective (awareness, lead gen, etc.) | Tracks success metrics |
| Audience | Target segment or list | Defines who sees the campaign |
| Start/end dates | Campaign duration | Bounds reporting windows |
| Budget | Planned spend | ROI calculation |
| Associated assets | Emails, landing pages, forms, CTAs, blog posts, social posts | All attributed to this campaign |

**hscli:**
```bash
# List campaigns
hscli marketing campaigns list --limit 20

# Get campaign details
hscli marketing campaigns get <campaignId>

# Create a campaign
hscli marketing campaigns create --data '{
  "name": "Q1 Product Launch",
  "type": "CONTENT_CAMPAIGN"
}' --force
```

> **API:** `marketing.campaigns.read/write` scope. Campaign CRUD is supported. Asset association is done via each asset's campaign property.

---

## 4. Landing Pages

**Where:** Marketing > Landing Pages (creation) | Settings > Content > Templates (defaults)

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Default template | Choose starter template or custom theme template | Consistency across landing pages |
| Custom domain | Landing page subdomain (e.g., `go.yourcompany.com`) | Professional URLs, branded experience |
| Default meta description | SEO meta for new pages | Search engine visibility |
| Thank-you redirect | Default post-submission URL or inline thank-you message | Conversion flow completion |
| A/B testing | Enable variation testing | Optimize conversion rates |
| Stylesheets | Global CSS for landing pages | Consistent design without per-page styling |

> **API:** Landing pages are a subset of CMS pages. Use the Pages API with `content` scope. hscli `cms pages` commands can manage landing pages.

**hscli:**
```bash
# List landing pages
hscli cms pages list --limit 10

# Get a specific page
hscli cms pages get <pageId>
```

---

## 5. Forms

**Where:** Marketing > Forms (creation) | Settings > Marketing > Forms (defaults)

### 5.1 Form Defaults

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Submission notifications | Email address(es) to notify on form submit | Sales team gets notified of new leads |
| Follow-up emails | Auto-send email after submission | Confirm receipt, deliver promised content |
| Cookie tracking | Enable/disable form pre-fill from cookies | Progressive profiling depends on this |
| CAPTCHA | Enable reCAPTCHA | Block spam submissions |

### 5.2 Form Field Types

| Field type | Use case |
|------------|----------|
| Text (single-line) | Names, titles, short answers |
| Text (multi-line) | Comments, descriptions |
| Dropdown select | Predefined options (industry, country) |
| Radio buttons | Single selection from small set |
| Checkboxes | Multi-selection (interests, products) |
| Date picker | Dates (event dates, birthdays) |
| File upload | Documents, images |
| Number | Numeric values (employee count, revenue) |
| Dependent fields | Show field B only when field A = X |

### 5.3 Progressive Profiling

**Where:** Form editor > Field settings > Progressive fields

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Queued questions | Fields shown only when known fields are already populated | Gathers more data over time without long forms |
| Max queued per visit | How many progressive fields per submission | Balances data collection with user experience |

**hscli:**
```bash
# List all forms
hscli forms list --limit 20

# Get form details (fields, configuration)
hscli forms get <formId>

# Create a form
hscli forms create --data '{
  "name": "Contact Us",
  "formType": "HUBSPOT",
  "configuration": {
    "language": "en",
    "postSubmitAction": {"type": "thank_you", "value": "Thanks for reaching out!"}
  },
  "fieldGroups": [
    {"fields": [{"name": "email", "required": true}]},
    {"fields": [{"name": "firstname"}, {"name": "lastname"}]},
    {"fields": [{"name": "message", "fieldType": "textarea"}]}
  ]
}' --force
```

> **API:** `forms` scope. Full CRUD on forms including field configuration.

---

## 6. Ads

**Where:** Settings > Marketing > Ads

### 6.1 Connect Ad Accounts

| Platform | What to connect | Requirements |
|----------|----------------|--------------|
| Google Ads | Google Ads account | Google account with Ads access |
| Facebook/Meta Ads | Facebook Business Manager | Admin access to ad account |
| LinkedIn Ads | LinkedIn Campaign Manager | Campaign Manager access |

### 6.2 Ad Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Auto-tracking | Automatically add tracking parameters to ad URLs | Attributes conversions to specific ads |
| Audience sync | Sync HubSpot lists to ad audiences | Target/exclude contacts in ad platforms |
| ROI reporting | Connect revenue data to ad spend | Measure true ad ROI |
| Lead sync | Auto-create contacts from lead gen forms | Facebook/LinkedIn lead form submissions create HubSpot contacts |
| Attribution window | How long after ad click to count conversion | Accurate attribution reporting |

> **API:** UI only for account connection. Ad performance data is available via the Analytics API.

---

## 7. Social Media

**Where:** Settings > Marketing > Social

### 7.1 Connect Social Accounts

| Platform | Supported features |
|----------|-------------------|
| Facebook Pages | Publish, monitor, report |
| Instagram Business | Publish, monitor, report |
| Twitter/X | Publish, monitor |
| LinkedIn (company + personal) | Publish, report |
| YouTube | Monitoring only |

### 7.2 Social Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Publishing defaults | Default accounts for new posts | Saves time in publishing workflow |
| Auto-publish blog posts | Share new blog posts automatically | Consistent promotion |
| Link shortening | Use HubSpot link shortener | Cleaner URLs, tracking |
| Social monitoring | Keywords, hashtags, mentions to track | Brand awareness, engagement |

> **API:** Social publishing is primarily UI. Some endpoints exist for reading social data via the Analytics API.

---

## 8. SEO

**Where:** Marketing > SEO (tool) | Settings > Content > SEO

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Target domains | Which domains to track for SEO | Focus SEO efforts on your properties |
| Topic clusters | Core topics + pillar pages + subtopic content | Content strategy aligned to search intent |
| Recommendations | On-page SEO suggestions per page | Improves search ranking |
| Google Search Console | Connect for keyword data | See actual search queries driving traffic |
| Canonical URLs | Default canonical URL strategy | Prevents duplicate content penalties |
| Sitemap | Auto-generated sitemap | Search engines discover your pages |

> **API:** UI only. SEO tools are interactive and not exposed via API.

---

## 9. Lead Scoring

**Where:** Settings > Properties > Contact scoring (or Marketing > Lead Scoring for HubSpot Score)

### 9.1 HubSpot Score (Manual)

| Criteria type | Examples | Points |
|---------------|----------|--------|
| **Positive attributes** | Viewed pricing page, downloaded whitepaper, attended webinar | +5 to +20 |
| **Negative attributes** | Unsubscribed, competitor domain, no activity in 90 days | -5 to -20 |
| **Demographic** | Job title = VP+, company size > 50, industry match | +10 to +15 |
| **Behavioral** | Form submissions, email opens/clicks, page views | +5 to +10 |

### 9.2 Score Thresholds

| Threshold | Action |
|-----------|--------|
| Score >= 50 | Lifecycle stage → MQL |
| Score >= 80 | Lifecycle stage → SQL, notify sales |
| Score < 0 | Suppress from marketing emails |

### 9.3 Predictive Lead Scoring (Enterprise)

**Where:** Settings > Properties > Predictive lead scoring (Enterprise only)

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Likelihood to close | HubSpot AI model, auto-calculated | Prioritizes sales outreach |
| Contact priority | Tier 1/2/3 based on predictive score | Focus on highest-value leads |

> **API:** Lead score is a contact property (`hubspotscore`). Readable via API but scoring rules are configured in UI only.

**hscli:**
```bash
# Read a contact's lead score
hscli crm contacts get <contactId> --json

# Search for MQLs with score above threshold
hscli crm contacts search --data '{
  "filterGroups": [{
    "filters": [{
      "propertyName": "hubspotscore",
      "operator": "GTE",
      "value": "50"
    }]
  }],
  "limit": 20
}'
```

---

## 10. ABM (Account-Based Marketing)

**Where:** Contacts > Target Accounts (tool) | Settings > Properties > Company scoring

### 10.1 Ideal Customer Profile (ICP)

| Property | Example criteria |
|----------|-----------------|
| Industry | SaaS, FinTech, Healthcare |
| Company size | 50–500 employees |
| Revenue | $5M–$50M ARR |
| Geography | North America, EU |
| Technology stack | Uses Salesforce, Slack, AWS |

### 10.2 Target Account Tiers

| Tier | Description | Treatment |
|------|-------------|-----------|
| Tier 1 | Perfect ICP match, high revenue potential | 1:1 personalized outreach, dedicated rep |
| Tier 2 | Good ICP match, moderate potential | 1:few campaigns, semi-personalized |
| Tier 3 | Partial match, lower potential | 1:many programmatic campaigns |

### 10.3 Company Scoring

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| ICP tier property | Custom company property for tier assignment | Segments target accounts |
| Buying role property | Contact role within the buying committee | Maps stakeholders per account |
| Target account flag | Boolean property on company | Enables ABM reporting and automation |

> **API:** Company properties are fully manageable via API. Target account designation is a company property.

**hscli:**
```bash
# Search for Tier 1 target accounts
hscli crm companies search --data '{
  "filterGroups": [{
    "filters": [{
      "propertyName": "icp_tier",
      "operator": "EQ",
      "value": "tier_1"
    }]
  }],
  "limit": 50
}'

# Create ICP tier property
hscli crm properties create companies --data '{
  "name": "icp_tier",
  "label": "ICP Tier",
  "type": "enumeration",
  "fieldType": "select",
  "groupName": "companyinformation",
  "options": [
    {"label": "Tier 1", "value": "tier_1", "displayOrder": 0},
    {"label": "Tier 2", "value": "tier_2", "displayOrder": 1},
    {"label": "Tier 3", "value": "tier_3", "displayOrder": 2}
  ]
}' --force
```

---

## Setup Checklist

### Email Configuration
```
[ ] Sending domain authenticated (DKIM + SPF verified)
[ ] DMARC record configured at DNS registrar
[ ] Subscription types defined (Marketing, Sales, Newsletter, etc.)
[ ] Default subscription type selected
[ ] Double opt-in enabled (if required by jurisdiction)
[ ] Email footer configured (company name + physical address)
[ ] Frequency caps set (max emails per contact per time period)
[ ] Hard bounce auto-removal enabled
[ ] Graymail suppression configured
```

### Email Templates & Design
```
[ ] Brand kit colors configured
[ ] Default fonts set
[ ] Logo uploaded and placed in default header
[ ] Saved sections created (header, footer, CTA blocks)
[ ] Default email template selected
```

### Campaigns
```
[ ] Campaign naming convention established
[ ] First campaign created with goal and dates
[ ] Assets associated (email, landing page, form, CTA)
```

### Landing Pages
```
[ ] Default landing page template selected
[ ] Custom landing page domain configured (if applicable)
[ ] Default meta description set
[ ] Thank-you page/redirect configured
```

### Forms
```
[ ] Default submission notification recipients set
[ ] CAPTCHA enabled on public-facing forms
[ ] Cookie tracking enabled for progressive profiling
[ ] At least one lead capture form created
[ ] Follow-up email configured for primary forms
```

### Ads
```
[ ] Google Ads account connected (if applicable)
[ ] Facebook/Meta Ads account connected (if applicable)
[ ] LinkedIn Ads account connected (if applicable)
[ ] Auto-tracking enabled
[ ] Audience sync configured for key lists
```

### Social Media
```
[ ] Facebook Page connected
[ ] LinkedIn company page connected
[ ] Instagram Business account connected (if applicable)
[ ] Twitter/X account connected (if applicable)
[ ] Auto-publish for blog posts configured (if desired)
```

### SEO
```
[ ] Target domains configured
[ ] Google Search Console connected
[ ] At least one topic cluster created
[ ] Sitemap verified
```

### Lead Scoring
```
[ ] Positive scoring attributes defined
[ ] Negative scoring attributes defined
[ ] Score thresholds set (MQL, SQL triggers)
[ ] Lifecycle stage automation tied to score thresholds
```

### ABM
```
[ ] Ideal Customer Profile criteria defined
[ ] ICP tier property created on companies
[ ] Target accounts identified and tiered
[ ] Buying role property created on contacts (if applicable)
```
