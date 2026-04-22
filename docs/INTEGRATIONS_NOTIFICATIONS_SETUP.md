# Integrations, Notifications & Account Settings Setup Guide

> See also: [[PORTAL_SETUP]] · [[OPERATIONS_SETUP]] · [[SECURITY]] · [[hubspot-rules]]

Complete configuration guide for HubSpot integrations, marketplace apps, notifications, user preferences, and account-wide settings.

**Prerequisites:**
- Portal authenticated (`hscli auth whoami`)
- Super Admin access for account-wide settings
- See [PORTAL_SETUP.md](./PORTAL_SETUP.md) for initial portal configuration

---

## 1. Marketplace Integrations

**Where:** Settings > Integrations > Connected Apps (or App Marketplace)

### 1.1 Essential Integrations

| Category | Top integrations | Purpose |
|----------|-----------------|---------|
| **CRM** | Salesforce, Microsoft Dynamics | Bidirectional CRM sync |
| **Email** | Gmail, Outlook 365 | Email logging + tracking |
| **Calendar** | Google Calendar, Outlook Calendar | Meeting scheduling |
| **Communication** | Slack, Microsoft Teams | Notifications + CRM updates from chat |
| **Calling** | Zoom, Aircall, RingCentral, Twilio | Call logging + recording |
| **Video** | Zoom, Vidyard, Loom | Video hosting + tracking |
| **Advertising** | Google Ads, Facebook Ads, LinkedIn Ads | Ad management + attribution |
| **Social** | Facebook, Instagram, LinkedIn, Twitter/X | Social publishing + monitoring |
| **Accounting** | QuickBooks, Xero, NetSuite | Invoice + payment sync |
| **Support** | Zendesk, Intercom, Freshdesk | Ticket sync |
| **E-commerce** | Shopify, WooCommerce, Stripe | Product + order sync |
| **Analytics** | Google Analytics 4, Hotjar, Databox | Enhanced analytics |
| **Document** | PandaDoc, DocuSign, Google Drive, Dropbox | Document management + e-sign |
| **Project** | Asana, Monday.com, Jira | Task + project sync |

### 1.2 Integration Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Authentication | OAuth or API key connection | Secure access |
| Sync settings | What data to sync and direction | Data flow control |
| Field mapping | Map fields between systems | Data accuracy |
| Sync frequency | Real-time vs. periodic | Data freshness |
| Error handling | Notification on sync failures | Data reliability |
| User permissions | Who can manage the integration | Access control |

### 1.3 Private Apps (Custom Integrations)

**Where:** Settings > Integrations > Private Apps

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| App name | Descriptive name | Identification in logs |
| Description | What the integration does | Documentation |
| Scopes | API permissions granted | Principle of least privilege |
| Access token | Generated token for API calls | Authentication |
| Webhook subscriptions | Events to listen for | Real-time triggers |

**hscli:**
```bash
# Verify current authentication
hscli auth whoami

# Test API access
hscli crm contacts list --limit 1
```

---

## 2. Webhooks & API

**Where:** Settings > Integrations > Private Apps > Webhooks

### 2.1 Webhook Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Target URL | Your endpoint that receives events | Where HubSpot sends data |
| Event subscriptions | Which events trigger webhooks | Control what data is sent |
| Throttling | Max events per second | Prevent overwhelming your endpoint |
| Retry policy | Retry on failure (up to 10 retries) | Delivery reliability |
| Signature validation | Verify webhook authenticity | Security |

### 2.2 Common Webhook Events

| Event category | Events | Use case |
|----------------|--------|----------|
| Contact | Create, update, delete, merge | Sync contact changes to external system |
| Company | Create, update, delete, merge | Keep company data in sync |
| Deal | Create, update, delete, stage change | Trigger actions on deal progression |
| Ticket | Create, update, delete, status change | Alert external systems on new tickets |
| Conversation | New message, assignment change | Real-time support routing |
| Form | Submission | Trigger external processing |

### 2.3 API Rate Limits

| Tier | Rate limit | Applies to |
|------|-----------|------------|
| Private Apps | 200 requests/10 seconds per app | Standard API calls |
| OAuth Apps | 200 requests/10 seconds per account | OAuth integrations |
| Search API | 4 requests/second | CRM search endpoints |
| Batch API | 100 records per batch call | Bulk operations |
| Daily limit | 500,000 requests/day (varies by tier) | Total daily API calls |

---

## 3. Notifications

**Where:** Settings > Notifications (per user)

### 3.1 Notification Channels

| Channel | Configuration | Best for |
|---------|--------------|----------|
| Email notifications | Per-event email alerts | Async, non-urgent updates |
| Desktop notifications | Browser push notifications | Real-time, in-browser alerts |
| Mobile push | HubSpot mobile app notifications | On-the-go alerts |
| In-app bell | Notification center in HubSpot | Low-priority updates |

### 3.2 Notification Categories

| Category | Events to configure | Recommended |
|----------|-------------------|-------------|
| **CRM** | Record assigned, mentioned in note, task due | Email + desktop |
| **Deals** | Deal assigned, stage change, deal won/lost | Email + desktop |
| **Email tracking** | Email opened, link clicked, reply received | Desktop only (high volume) |
| **Forms** | New submission on your forms | Email |
| **Calling** | Missed call, voicemail | Email + mobile push |
| **Chat** | New chat, chat assigned | Desktop + mobile push |
| **Tickets** | Ticket assigned, SLA warning, ticket updated | Email + desktop |
| **Workflows** | Workflow errors, enrollment notifications | Email |
| **Sequences** | Task due, contact replied, sequence completed | Desktop |
| **Meetings** | Meeting booked, meeting reminder | Email + mobile push |
| **Quotes** | Quote viewed, quote signed | Email + desktop |
| **Payments** | Payment received, payment failed | Email |

### 3.3 Notification Best Practices

| Practice | Why |
|----------|-----|
| Start conservative, add as needed | Prevent notification fatigue |
| Use desktop for time-sensitive items | Immediate visibility |
| Use email for daily digest items | Batched review |
| Disable redundant channels | Same alert on 3 channels is noisy |
| Review quarterly | Adjust as role/needs change |

---

## 4. User Preferences

**Where:** Settings > General (per user)

### 4.1 Profile Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Name | Full name | Appears in CRM activities |
| Email | User email | Login + notifications |
| Phone number | Direct number | Caller ID for calling |
| Avatar | Profile photo | Team identification |
| Language | UI language preference | Localized interface |
| Date/time format | Regional format | Consistent date display |
| Number format | Decimal/thousands separator | Regional number display |

### 4.2 Email Integration Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Email provider | Connect Gmail or Outlook | Two-way email sync |
| Logging | Auto-log all emails or selective | Communication history |
| Tracking | Open + click tracking | Engagement insights |
| Signature | HTML email signature | Professional emails |
| Send-as alias | Send from team aliases | Department-level sending |

### 4.3 Calendar Integration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Calendar provider | Google or Outlook calendar | Availability sync |
| Meeting link | Personal scheduling link | Self-service booking |
| Availability | Working hours | Meeting scheduling window |
| Video conferencing | Default video platform (Zoom, Meet, Teams) | Auto-add video link to meetings |

---

## 5. Security Settings

**Where:** Settings > Account Defaults > Security

### 5.1 Authentication & Access

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Two-factor authentication | Require 2FA for all users | Account security |
| SSO (Single Sign-On) | SAML-based SSO with IdP | Enterprise authentication |
| Session timeout | Max idle session duration | Prevent unauthorized access |
| Login activity | Audit login history | Security monitoring |
| IP restrictions | Limit access to specific IPs | Network-level security |

### 5.2 Data Privacy

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| GDPR settings | Enable GDPR features | EU compliance |
| Data processing consent | Lawful basis tracking per contact | Legal compliance |
| Cookie consent banner | Cookie policy on website | GDPR/CCPA compliance |
| Data retention | How long to keep data | Compliance + storage |
| Right to be forgotten | Process for data deletion requests | GDPR Article 17 |
| Data export | Process for data portability requests | GDPR Article 20 |

### 5.3 Audit Logs

**Where:** Settings > Account Defaults > Audit Logs (Enterprise)

| What's logged | Detail |
|--------------|--------|
| Login/logout | User, time, IP address |
| CRM changes | Create, update, delete records |
| Setting changes | Who changed what setting and when |
| Integration changes | App connected, disconnected, permissions changed |
| Export events | Who exported data and what |
| Security events | Failed logins, 2FA changes, permission changes |

---

## 6. Account Defaults

**Where:** Settings > Account Defaults

### 6.1 General Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Account name | Company/portal name | Identification |
| Company domain | Primary domain | Default for tracking |
| Time zone | Account default timezone | Consistent scheduling |
| Currency | Default + additional currencies | Financial data |
| Fiscal year | Start month for fiscal year | Reporting alignment |
| Language | Default portal language | UI default for new users |

### 6.2 Branding

**Where:** Settings > Account Defaults > Branding

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Logo | Primary company logo | Used across emails, forms, quotes |
| Favicon | Browser tab icon | Brand recognition |
| Brand colors | Primary + secondary colors | Consistent branding |
| Default fonts | Heading + body fonts | Design consistency |
| Brand kit | Complete brand guidelines | Single source of truth |

### 6.3 Communication Preferences

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Email footer | Default CAN-SPAM footer | Legal compliance |
| Subscription types | Email categories contacts can opt into/out of | Preference management |
| Double opt-in | Require confirmation for subscriptions | GDPR compliance |
| Opt-out link | Unsubscribe behavior | Legal compliance |

---

## 7. Marketplace Automation (Workflows)

**Where:** Automation > Workflows > Integration triggers/actions

### 7.1 Slack Integration Workflows

| Trigger | Slack action | Use case |
|---------|-------------|----------|
| Deal closed won | Post to #wins channel | Team celebration |
| High-priority ticket | Post to #support-urgent | Immediate awareness |
| New MQL | Post to #marketing-leads | Lead visibility |
| Form submission | Post to relevant channel | Real-time notifications |
| NPS detractor | Post to #customer-success | Quick response |

### 7.2 Zoom/Video Integration

| Feature | Configuration | Purpose |
|---------|--------------|---------|
| Auto-create Zoom | Zoom link on meetings | Automatic video conferencing |
| Recording sync | Sync recordings to CRM | Call documentation |
| Attendance tracking | Log who attended | Engagement tracking |
| Webinar sync | Sync registrations and attendance | Event marketing |

---

## Setup Checklist

### Integrations
```
[ ] Email provider connected (Gmail/Outlook) for all users
[ ] Calendar connected for all users
[ ] Slack/Teams connected for notifications
[ ] Video conferencing connected (Zoom/Meet/Teams)
[ ] CRM integration connected (if applicable — Salesforce, etc.)
[ ] Advertising accounts connected (Google, Facebook, LinkedIn)
[ ] Accounting software connected (if applicable)
[ ] E-commerce platform connected (if applicable)
```

### Private Apps & API
```
[ ] Private app created with appropriate scopes
[ ] Access token securely stored
[ ] Webhook subscriptions configured
[ ] API rate limits understood and planned for
[ ] Signature validation implemented
```

### Notifications
```
[ ] Each user reviewed notification preferences
[ ] Time-sensitive events set to desktop/mobile push
[ ] Digest items set to email only
[ ] Workflow error notifications enabled for admins
[ ] Redundant notifications disabled
```

### User Preferences
```
[ ] All users completed profile setup
[ ] Email integration configured per user
[ ] Calendar integration configured per user
[ ] Meeting links created per user
[ ] Video conferencing default set
```

### Security
```
[ ] Two-factor authentication required for all users
[ ] SSO configured (if enterprise)
[ ] Session timeout set
[ ] IP restrictions configured (if applicable)
[ ] GDPR settings enabled (if applicable)
[ ] Cookie consent banner deployed
[ ] Data retention policy configured
[ ] Audit log reviewed
```

### Account Defaults
```
[ ] Account name and domain verified
[ ] Time zone set correctly
[ ] Default currency configured
[ ] Fiscal year start month set
[ ] Branding configured (logo, colors, fonts, favicon)
[ ] Email footer configured (CAN-SPAM compliance)
[ ] Subscription types defined
```
