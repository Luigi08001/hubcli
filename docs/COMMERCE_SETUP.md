# Commerce Setup Guide

> See also: [[PORTAL_SETUP]] · [[SALES_SETUP]] · [[REPORTING_SETUP]]

Complete configuration guide for HubSpot Commerce Hub settings. Covers products, payment processing, payment links, quotes, invoices, subscriptions, tax, and commerce automation.

**Prerequisites:**
- Portal authenticated (`hubcli auth whoami`)
- Private App scopes: `e-commerce`, `crm.objects.line_items.read/write`
- HubSpot Payments enabled (US only) or Stripe integration connected

---

## 1. Products

**Where:** Settings > Objects > Products

### 1.1 Product Library

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Product name | Name of each product/service | Appears on quotes, invoices, payment links |
| SKU | Stock keeping unit identifier | Internal tracking and reporting |
| Unit price | Default selling price | Pre-populated on line items |
| Description | Product description | Customer-facing on quotes/invoices |
| Billing frequency | One-time, monthly, quarterly, annually | Revenue recognition and subscription handling |
| Cost of goods sold | COGS per unit | Margin and profitability reporting |
| Product image | Product photo/icon | Visual on quotes and payment links |

**hubcli:**
```bash
# List all products
hubcli crm products list --limit 50

# Create a product
hubcli crm products create --data '{
  "properties": {
    "name": "Professional Plan",
    "description": "Monthly professional subscription",
    "price": "99.00",
    "hs_sku": "PRO-001",
    "hs_recurring_billing_period": "P1M",
    "hs_cost_of_goods_sold": "20.00"
  }
}' --force

# Update a product
hubcli crm products update <productId> --data '{
  "properties": {
    "price": "109.00"
  }
}' --force
```

### 1.2 Product Properties

| Property | Type | Purpose |
|----------|------|---------|
| `name` | Text | Product name |
| `price` | Currency | Unit price |
| `hs_sku` | Text | SKU |
| `description` | Text | Description |
| `hs_recurring_billing_period` | Select | Billing frequency (P1M, P3M, P12M) |
| `hs_cost_of_goods_sold` | Currency | COGS |
| `hs_images` | Text | Image URL |
| `tax` | Number | Tax rate (if applicable) |

---

## 2. Payment Processing

**Where:** Settings > Commerce > Payments

### 2.1 HubSpot Payments (US Only)

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Business verification | Legal entity name, EIN, address | Required for processing |
| Bank account | Payout bank account | Where funds are deposited |
| Statement descriptor | What appears on customer bank statements | Brand recognition on statements |
| Payment methods | Credit card, ACH/bank transfer | Offer customer payment options |
| Payout schedule | Daily, weekly, or monthly payouts | Cash flow management |

### 2.2 Stripe Integration (Global)

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Stripe account | Connect existing Stripe account | Leverage existing payment infrastructure |
| Sync settings | Products, customers, subscriptions | Keep HubSpot and Stripe in sync |
| Webhook events | Payment success, failure, refund | Real-time status updates |

### 2.3 Payment Methods

| Method | Availability | Processing fee (typical) |
|--------|-------------|------------------------|
| Credit card | HubSpot Payments + Stripe | 2.9% + $0.30 |
| Debit card | HubSpot Payments + Stripe | 2.9% + $0.30 |
| ACH/Bank transfer | HubSpot Payments | 0.5% (cap $10) |
| Wire transfer | Manual (outside HubSpot) | Varies |

> **API:** Payment processing setup is UI-only. Payment events trigger CRM updates accessible via API.

---

## 3. Payment Links

**Where:** Commerce > Payment Links

### 3.1 Payment Link Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Link name | Internal name for the payment link | Organization and tracking |
| Products | Select products from library | What the customer is buying |
| Quantity | Fixed or customer-selectable | Flexibility for customers |
| Discounts | Percentage or fixed amount | Promotions and special pricing |
| Checkout page | Branding, custom fields | Professional checkout experience |
| Redirect URL | Post-payment redirect page | Thank you page or onboarding |
| Expiration | Optional expiry date | Time-limited offers |

### 3.2 Checkout Customization

| Element | Configuration |
|---------|--------------|
| Company logo | Brand logo on checkout page |
| Colors | Match brand palette |
| Custom fields | Additional info collection (company name, address, etc.) |
| Terms & conditions | Link to terms page |
| Billing address | Require billing address collection |
| Shipping address | Require shipping address (physical products) |

**hubcli:**
```bash
# List payment links
hubcli commerce payment-links list --limit 20

# Create a payment link
hubcli commerce payment-links create --data '{
  "name": "Pro Plan Monthly",
  "lineItems": [
    {"productId": "<productId>", "quantity": 1}
  ]
}' --force
```

---

## 4. Quotes (Commerce)

**Where:** Settings > Objects > Quotes

### 4.1 Quote Configuration

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Quote templates | Branded templates (logo, colors, layout) | Professional appearance |
| Default expiration | Validity period (e.g., 30 days) | Urgency and expectation management |
| E-signature | Enable native or integrated e-sign | Streamline deal closing |
| Payment on quote | Enable payment collection | Combine quote + payment |
| Countersignature | Internal approval before sending | Control on pricing/terms |
| Snippet | Pre-built text blocks for quotes | Consistency and speed |
| Quote numbering | Prefix and auto-increment | Professional tracking |

### 4.2 Quote Workflow

```
Create Quote → Add Line Items → Apply Discounts → Add Terms
    → Preview → Send for Signature → Collect Payment → Mark Won
```

### 4.3 Quote Approval Workflow

| Condition | Action |
|-----------|--------|
| Discount > 20% | Require manager approval |
| Deal amount > $50K | Require VP approval |
| Non-standard terms | Require legal review |
| Custom pricing | Require finance approval |

---

## 5. Invoices

**Where:** Commerce > Invoices | Settings > Commerce > Invoices

### 5.1 Invoice Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Invoice template | Branded template (logo, colors) | Professional invoicing |
| Invoice numbering | Prefix + auto-increment (e.g., INV-0001) | Accounting compliance |
| Payment terms | Net 15, Net 30, Net 60, Due on receipt | Cash flow expectations |
| Default currency | Primary currency | Multi-currency support |
| Tax settings | Tax rates, tax IDs | Compliance |
| Late payment terms | Late fee percentage or flat amount | Incentivize timely payment |
| Remittance info | Bank details for wire transfer | Alternative payment method |
| Notes | Default footer notes | Standard terms or thank-you |

### 5.2 Invoice Automation

| Trigger | Action | Purpose |
|---------|--------|---------|
| Invoice created | Send to customer via email | Prompt delivery |
| Payment due in 7 days | Send reminder email | Proactive collection |
| Invoice overdue | Send overdue notice | Collections process |
| Invoice overdue > 30 days | Escalate to manager | Escalated collections |
| Payment received | Send receipt, update deal | Confirmation and bookkeeping |

**hubcli:**
```bash
# List invoices
hubcli commerce invoices list --limit 20

# Get invoice details
hubcli commerce invoices get <invoiceId>

# Create an invoice
hubcli commerce invoices create --data '{
  "properties": {
    "hs_invoice_date": "2026-03-15",
    "hs_due_date": "2026-04-14",
    "hs_currency_code": "USD"
  },
  "associations": [
    {"to": {"id": "<contactId>"}, "types": [{"associationCategory": "HUBSPOT_DEFINED", "associationTypeId": 100}]}
  ]
}' --force
```

---

## 6. Subscriptions

**Where:** Commerce > Subscriptions

### 6.1 Subscription Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Billing frequency | Monthly, quarterly, annual | Recurring revenue cadence |
| Auto-renewal | Enable/disable auto-renewal | Revenue continuity |
| Cancellation policy | Immediate, end of period, with notice | Customer expectations |
| Proration | Prorate upgrades/downgrades | Fair billing on plan changes |
| Trial periods | Free trial duration (if applicable) | Customer acquisition |
| Grace period | Days after failed payment before suspension | Reduce involuntary churn |

### 6.2 Subscription Lifecycle

```
Trial (optional) → Active → Renewal
    ↓                         ↓
  Cancel              Payment Failed
    ↓                         ↓
  Expired            Retry (dunning)
                              ↓
                    Suspended → Canceled
```

### 6.3 Dunning Management (Failed Payments)

| Attempt | Timing | Action |
|---------|--------|--------|
| 1st retry | 3 days after failure | Auto-retry payment |
| 2nd retry | 5 days after failure | Auto-retry + email notification |
| 3rd retry | 7 days after failure | Auto-retry + escalation email |
| Final | 10 days after failure | Suspend subscription, notify customer |

---

## 7. Tax Configuration

**Where:** Settings > Commerce > Tax

### 7.1 Tax Settings

| Setting | What to configure | Why it matters |
|---------|-------------------|----------------|
| Tax calculation | Automatic or manual | Compliance complexity |
| Tax rates | Per product or per region | Correct tax collection |
| Tax ID display | Show tax ID on invoices | B2B compliance |
| Tax-exempt customers | Flag tax-exempt contacts/companies | Avoid over-charging |
| Tax reporting | Integration with accounting software | Simplified tax filing |

### 7.2 Tax by Region

| Region | Tax type | Configuration |
|--------|----------|--------------|
| United States | Sales tax | State-by-state rates, nexus rules |
| European Union | VAT | Country rates, reverse charge for B2B |
| Canada | GST/HST/PST | Province-based |
| Australia | GST | Flat 10% |
| United Kingdom | VAT | Standard 20%, reduced rates |

> **API:** Tax configuration is primarily UI-based. Tax amounts on line items are accessible via the API.

---

## 8. Commerce Automation

**Where:** Automation > Workflows (commerce triggers)

### 8.1 Payment Workflows

| Trigger | Actions | Purpose |
|---------|---------|---------|
| Payment received | Send receipt email, update deal stage, create task | Post-payment processing |
| Payment failed | Notify customer, create retry task, alert finance | Payment recovery |
| Refund issued | Send confirmation, update deal, adjust revenue | Refund processing |
| Subscription created | Welcome email, create onboarding ticket | Customer onboarding |
| Subscription canceled | Exit survey, notify CSM, update lifecycle | Churn management |
| Invoice overdue | Send reminders (3, 7, 14, 30 days) | Collections automation |

### 8.2 Revenue Workflows

| Trigger | Actions | Purpose |
|---------|---------|---------|
| MRR change | Update dashboards, notify finance | Revenue tracking |
| Upgrade | Thank you email, update plan property | Expansion revenue |
| Downgrade | Retention offer email, alert CSM | Churn prevention |
| Renewal due in 30 days | Notify account manager, create renewal task | Proactive renewal |

---

## Setup Checklist

### Products
```
[ ] Product library populated with all products/services
[ ] Pricing configured (one-time and recurring)
[ ] SKUs assigned
[ ] Product descriptions written
[ ] COGS entered (for margin reporting)
[ ] Billing frequencies set for subscription products
```

### Payment Processing
```
[ ] HubSpot Payments verified OR Stripe connected
[ ] Payout bank account configured
[ ] Statement descriptor set
[ ] Payment methods enabled (card, ACH)
[ ] Test payment processed successfully
```

### Payment Links
```
[ ] At least one payment link created
[ ] Checkout page branded (logo, colors)
[ ] Redirect URL configured (thank you page)
[ ] Custom fields added (if needed)
[ ] Payment link tested end-to-end
```

### Quotes
```
[ ] Quote template branded
[ ] Default expiration set
[ ] E-signature enabled (if applicable)
[ ] Payment on quotes enabled (if applicable)
[ ] Approval workflows configured (discount thresholds)
[ ] Quote numbering configured
```

### Invoices
```
[ ] Invoice template branded
[ ] Invoice numbering configured
[ ] Payment terms set (Net 30, etc.)
[ ] Tax settings configured
[ ] Reminder email automation set up
[ ] Overdue notice automation set up
```

### Subscriptions
```
[ ] Billing frequencies defined per product
[ ] Auto-renewal settings configured
[ ] Cancellation policy defined
[ ] Proration rules set
[ ] Dunning management configured (retry schedule)
[ ] Grace period set for failed payments
```

### Tax
```
[ ] Tax calculation method chosen (auto/manual)
[ ] Tax rates configured per product or region
[ ] Tax-exempt customers flagged
[ ] Tax ID displayed on invoices (if B2B)
```

### Commerce Automation
```
[ ] Payment received workflow active
[ ] Payment failed workflow active
[ ] Invoice overdue reminder workflow active
[ ] Subscription created onboarding workflow active
[ ] Subscription canceled churn workflow active
[ ] Renewal reminder workflow active
```
