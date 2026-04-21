import { Command } from "commander";
import { createClient, HubSpotClient } from "../core/http.js";
import type { CliContext } from "../core/output.js";
import { CliError, printResult } from "../core/output.js";
import { resolvePortalContext } from "../core/urls.js";

interface SeedResult {
  created: Array<{ type: string; name: string; id: string; url?: string }>;
  associations: Array<{ from: string; to: string; status: string }>;
  skipped: Array<{ type: string; name: string; reason: string }>;
  tips: string[];
}

// --- Data generators ---

const CONTACTS = [
  { firstname: "Alice", lastname: "Martin", email: "alice.martin@acmetech.io", jobtitle: "VP of Engineering", lifecyclestage: "opportunity" },
  { firstname: "Bob", lastname: "Chen", email: "bob.chen@globalsync.co", jobtitle: "CTO", lifecyclestage: "lead" },
  { firstname: "Clara", lastname: "Johansson", email: "clara.johansson@nordicdata.se", jobtitle: "Head of Product", lifecyclestage: "customer" },
];

const COMPANIES = [
  { name: "AcmeTech", domain: "acmetech.io", industry: "COMPUTER_SOFTWARE", city: "San Francisco", country: "United States", numberofemployees: "150", annualrevenue: "12000000" },
  { name: "GlobalSync", domain: "globalsync.co", industry: "INFORMATION_TECHNOLOGY_AND_SERVICES", city: "London", country: "United Kingdom", numberofemployees: "80", annualrevenue: "5500000" },
  { name: "NordicData", domain: "nordicdata.se", industry: "COMPUTER_SOFTWARE", city: "Stockholm", country: "Sweden", numberofemployees: "200", annualrevenue: "18000000" },
];

const DEALS = [
  { dealname: "AcmeTech — Platform License", amount: "65000", closedate: "", contactIndex: 0, companyIndex: 0 },
  { dealname: "GlobalSync — API Integration", amount: "38000", closedate: "", contactIndex: 1, companyIndex: 1 },
  { dealname: "NordicData — Enterprise Suite", amount: "150000", closedate: "", contactIndex: 2, companyIndex: 2 },
];

const TICKETS = [
  { subject: "AcmeTech API rate limit issue", content: "Alice reports intermittent 429 errors during peak hours.", hs_ticket_priority: "HIGH", contactIndex: 0 },
  { subject: "GlobalSync SSO configuration", content: "Bob needs help configuring SAML for their IdP.", hs_ticket_priority: "MEDIUM", contactIndex: 1 },
];

const NOTES = [
  { hs_note_body: "Call recap: Alice confirmed Q2 budget is approved. EU data residency is a requirement.", contactIndex: 0 },
  { hs_note_body: "Bob sent SAML configuration guide. Follow up in 48h if no progress.", contactIndex: 1 },
];

const TASKS = [
  { hs_task_subject: "Prepare integration demo for AcmeTech", hs_task_body: "Build demo environment with sample API calls and webhooks.", hs_task_status: "NOT_STARTED", hs_task_priority: "HIGH", contactIndex: 0 },
  { hs_task_subject: "Follow up on GlobalSync SSO issue", hs_task_body: "Check if Bob resolved the SAML configuration.", hs_task_status: "NOT_STARTED", hs_task_priority: "MEDIUM", contactIndex: 1 },
];

const CALLS = [
  { hs_call_title: "Discovery call — NordicData", hs_call_body: "Discussed multi-region deployment needs. Budget range 120-180K.", hs_call_direction: "OUTBOUND", hs_call_duration: "1800000", contactIndex: 2 },
];

const MEETINGS = [
  { hs_meeting_title: "Kickoff — AcmeTech onboarding", hs_meeting_body: "Walk through integration plan + Q2 milestones.", hs_meeting_outcome: "COMPLETED", hs_meeting_start_time: new Date(Date.now() + 86400000 * 3).toISOString(), hs_meeting_end_time: new Date(Date.now() + 86400000 * 3 + 3600000).toISOString(), contactIndex: 0 },
  { hs_meeting_title: "Quarterly review — NordicData", hs_meeting_body: "Q1 progress + Q2 expansion discussion.", hs_meeting_outcome: "SCHEDULED", hs_meeting_start_time: new Date(Date.now() + 86400000 * 10).toISOString(), hs_meeting_end_time: new Date(Date.now() + 86400000 * 10 + 1800000).toISOString(), contactIndex: 2 },
];

const PRODUCTS = [
  { name: "Platform License — Starter", description: "Single-portal license, 10k contacts, standard support.", price: "5000", hs_sku: "HUBCLI-PLAT-STARTER", hs_cost_of_goods_sold: "800" },
  { name: "Platform License — Pro", description: "Multi-portal, 100k contacts, dedicated CSM.", price: "25000", hs_sku: "HUBCLI-PLAT-PRO", hs_cost_of_goods_sold: "2500" },
  { name: "Professional Services — Onboarding", description: "6-week guided onboarding engagement.", price: "12000", hs_sku: "HUBCLI-PS-ONBD", hs_cost_of_goods_sold: "6000" },
];

const LEADS = [
  { firstname: "Eve", lastname: "Barros", email: "eve.barros@prospecttech.io", jobtitle: "Head of RevOps", lifecyclestage: "subscriber" },
  { firstname: "Marco", lastname: "Keller", email: "marco.keller@inboundco.de", jobtitle: "Founder", lifecyclestage: "marketingqualifiedlead" },
];

const GOALS = [
  { hs_goal_name: "Q2 Pipeline Coverage Target", hs_goal_description: "Maintain 3x coverage over Q2 booked ARR target." },
];

// --- Helpers ---

async function safeCreate(client: HubSpotClient, path: string, body: unknown): Promise<{ id: string } | null> {
  try {
    const res = await client.request(path, { method: "POST", body }) as { id?: string };
    if (res?.id) return { id: res.id };
    return null;
  } catch (err) {
    if (err instanceof CliError && err.status === 409) return null; // duplicate
    throw err;
  }
}

async function safeAssociate(client: HubSpotClient, fromType: string, fromId: string, toType: string, toId: string): Promise<string> {
  try {
    await client.request(
      `/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`,
      { method: "PUT" },
    );
    return "ok";
  } catch (err) {
    if (err instanceof CliError && err.status === 400) return "no_default_association";
    throw err;
  }
}

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

function nowIso(): string {
  return new Date().toISOString();
}

// --- Main seed logic ---

async function runSeed(ctx: CliContext): Promise<void> {
  const client = createClient(ctx.profile);
  const portal = resolvePortalContext(ctx.profile);
  const result: SeedResult = { created: [], associations: [], skipped: [], tips: [] };

  // 1. Detect current owner
  let ownerId: string | undefined;
  try {
    const owners = await client.request("/crm/v3/owners?limit=1") as { results?: Array<{ id?: string; email?: string }> };
    if (owners.results?.[0]?.id) {
      ownerId = owners.results[0].id;
    }
  } catch { /* no owner access */ }

  // 2. Detect default deal pipeline + first stage
  let dealPipeline: string | undefined;
  let dealStage: string | undefined;
  try {
    const pipelines = await client.request("/crm/v3/pipelines/deals") as { results?: Array<{ id?: string; stages?: Array<{ id?: string }> }> };
    const defaultPipeline = pipelines.results?.[0];
    if (defaultPipeline) {
      dealPipeline = defaultPipeline.id;
      // Pick a mid-stage (qualified/proposal) if available, otherwise first
      const stages = defaultPipeline.stages ?? [];
      dealStage = stages.length > 2 ? stages[Math.floor(stages.length / 2)]?.id : stages[0]?.id;
    }
  } catch { /* no pipeline access */ }

  // 3. Detect default ticket pipeline + first stage
  let ticketPipeline: string | undefined;
  let ticketStage: string | undefined;
  try {
    const pipelines = await client.request("/crm/v3/pipelines/tickets") as { results?: Array<{ id?: string; stages?: Array<{ id?: string }> }> };
    if (pipelines.results?.[0]) {
      ticketPipeline = pipelines.results[0].id;
      ticketStage = pipelines.results[0].stages?.[0]?.id;
    }
  } catch { /* no pipeline access */ }

  // 4. Detect custom object schemas
  const customSchemas: Array<{ name: string; objectTypeId: string; primaryDisplayProperty: string }> = [];
  try {
    const schemas = await client.request("/crm/v3/schemas") as { results?: Array<{ name?: string; objectTypeId?: string; primaryDisplayProperty?: string; requiredProperties?: string[] }> };
    for (const s of schemas.results ?? []) {
      if (s.name && s.objectTypeId && s.primaryDisplayProperty) {
        customSchemas.push({ name: s.name, objectTypeId: s.objectTypeId, primaryDisplayProperty: s.primaryDisplayProperty });
      }
    }
  } catch { /* no schema access */ }

  const baseUrl = portal?.uiDomain ? `https://${portal.uiDomain}/contacts/${portal.portalId}` : undefined;
  function recordUrl(objectTypeId: string, recordId: string): string | undefined {
    return baseUrl ? `${baseUrl}/record/${objectTypeId}/${recordId}` : undefined;
  }

  // --- Create contacts ---
  const contactIds: (string | null)[] = [];
  for (const c of CONTACTS) {
    // Check if already exists
    const search = await client.request("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: c.email }] }], limit: 1 },
    }) as { total?: number; results?: Array<{ id: string }> };

    if (search.total && search.total > 0) {
      const id = search.results![0].id;
      contactIds.push(id);
      result.skipped.push({ type: "contact", name: `${c.firstname} ${c.lastname}`, reason: `already exists (${id})` });
      continue;
    }

    const props: Record<string, string> = { ...c };
    if (ownerId) props.hubspot_owner_id = ownerId;
    const rec = await safeCreate(client, "/crm/v3/objects/contacts", { properties: props });
    if (rec) {
      contactIds.push(rec.id);
      result.created.push({ type: "contact", name: `${c.firstname} ${c.lastname}`, id: rec.id, url: recordUrl("0-1", rec.id) });
    } else {
      contactIds.push(null);
      result.skipped.push({ type: "contact", name: `${c.firstname} ${c.lastname}`, reason: "create failed (duplicate?)" });
    }
  }

  // --- Create companies ---
  const companyIds: (string | null)[] = [];
  for (const co of COMPANIES) {
    const search = await client.request("/crm/v3/objects/companies/search", {
      method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: co.domain }] }], limit: 1 },
    }) as { total?: number; results?: Array<{ id: string }> };

    if (search.total && search.total > 0) {
      const id = search.results![0].id;
      companyIds.push(id);
      result.skipped.push({ type: "company", name: co.name, reason: `already exists (${id})` });
      continue;
    }

    const props: Record<string, string> = { ...co };
    if (ownerId) props.hubspot_owner_id = ownerId;
    const rec = await safeCreate(client, "/crm/v3/objects/companies", { properties: props });
    if (rec) {
      companyIds.push(rec.id);
      result.created.push({ type: "company", name: co.name, id: rec.id, url: recordUrl("0-2", rec.id) });
    } else {
      companyIds.push(null);
      result.skipped.push({ type: "company", name: co.name, reason: "create failed" });
    }
  }

  // --- Create deals ---
  const dealIds: (string | null)[] = [];
  for (const d of DEALS) {
    const props: Record<string, string> = {
      dealname: d.dealname,
      amount: d.amount,
      closedate: futureDate(60 + Math.floor(Math.random() * 90)),
    };
    if (dealPipeline) props.pipeline = dealPipeline;
    if (dealStage) props.dealstage = dealStage;
    if (ownerId) props.hubspot_owner_id = ownerId;

    const rec = await safeCreate(client, "/crm/v3/objects/deals", { properties: props });
    if (rec) {
      dealIds.push(rec.id);
      result.created.push({ type: "deal", name: d.dealname, id: rec.id, url: recordUrl("0-3", rec.id) });
    } else {
      dealIds.push(null);
      result.skipped.push({ type: "deal", name: d.dealname, reason: "create failed" });
    }
  }

  // --- Create tickets ---
  const ticketIds: (string | null)[] = [];
  for (const t of TICKETS) {
    const props: Record<string, string> = {
      subject: t.subject,
      content: t.content,
      hs_ticket_priority: t.hs_ticket_priority,
    };
    if (ticketPipeline) props.hs_pipeline = ticketPipeline;
    if (ticketStage) props.hs_pipeline_stage = ticketStage;
    if (ownerId) props.hubspot_owner_id = ownerId;

    const rec = await safeCreate(client, "/crm/v3/objects/tickets", { properties: props });
    if (rec) {
      ticketIds.push(rec.id);
      result.created.push({ type: "ticket", name: t.subject, id: rec.id, url: recordUrl("0-5", rec.id) });
    } else {
      ticketIds.push(null);
      result.skipped.push({ type: "ticket", name: t.subject, reason: "create failed" });
    }
  }

  // --- Create engagements ---
  const engagementTypes: Array<{ type: string; path: string; items: Array<{ props: Record<string, string>; contactIndex: number }> }> = [
    {
      type: "note", path: "/crm/v3/objects/notes",
      items: NOTES.map(n => ({
        props: { hs_note_body: n.hs_note_body, hs_timestamp: nowIso() },
        contactIndex: n.contactIndex,
      })),
    },
    {
      type: "task", path: "/crm/v3/objects/tasks",
      items: TASKS.map(t => ({
        props: {
          hs_task_subject: t.hs_task_subject,
          hs_task_body: t.hs_task_body,
          hs_task_status: t.hs_task_status,
          hs_task_priority: t.hs_task_priority,
          hs_timestamp: nowIso(),
        },
        contactIndex: t.contactIndex,
      })),
    },
    {
      type: "call", path: "/crm/v3/objects/calls",
      items: CALLS.map(c => ({
        props: {
          hs_call_title: c.hs_call_title,
          hs_call_body: c.hs_call_body,
          hs_call_direction: c.hs_call_direction,
          hs_call_duration: c.hs_call_duration,
          hs_call_status: "COMPLETED",
          hs_timestamp: nowIso(),
        },
        contactIndex: c.contactIndex,
      })),
    },
  ];

  for (const eng of engagementTypes) {
    for (const item of eng.items) {
      const props = { ...item.props };
      if (ownerId) props.hubspot_owner_id = ownerId;
      const rec = await safeCreate(client, eng.path, { properties: props });
      if (rec) {
        result.created.push({ type: eng.type, name: props.hs_note_body || props.hs_task_subject || props.hs_call_title || eng.type, id: rec.id });
        // Associate to contact
        const contactId = contactIds[item.contactIndex];
        if (contactId) {
          const plural = eng.type === "call" ? "calls" : eng.type + "s";
          const status = await safeAssociate(client, plural, rec.id, "contacts", contactId);
          result.associations.push({ from: `${eng.type}:${rec.id}`, to: `contact:${contactId}`, status });
        }
      }
    }
  }

  // --- Associations: contact ↔ company ---
  for (let i = 0; i < CONTACTS.length; i++) {
    const contactId = contactIds[i];
    const companyId = companyIds[i];
    if (!contactId || !companyId) continue;
    const status = await safeAssociate(client, "contacts", contactId, "companies", companyId);
    result.associations.push({ from: `contact:${contactId}`, to: `company:${companyId}`, status });
  }

  // --- Associations: deal ↔ contact + deal ↔ company ---
  for (let i = 0; i < DEALS.length; i++) {
    const dealId = dealIds[i];
    if (!dealId) continue;
    const contactId = contactIds[DEALS[i].contactIndex];
    const companyId = companyIds[DEALS[i].companyIndex];
    if (contactId) {
      const status = await safeAssociate(client, "deals", dealId, "contacts", contactId);
      result.associations.push({ from: `deal:${dealId}`, to: `contact:${contactId}`, status });
    }
    if (companyId) {
      const status = await safeAssociate(client, "deals", dealId, "companies", companyId);
      result.associations.push({ from: `deal:${dealId}`, to: `company:${companyId}`, status });
    }
  }

  // --- Associations: ticket ↔ contact ---
  for (let i = 0; i < TICKETS.length; i++) {
    const ticketId = ticketIds[i];
    if (!ticketId) continue;
    const contactId = contactIds[TICKETS[i].contactIndex];
    if (contactId) {
      const status = await safeAssociate(client, "tickets", ticketId, "contacts", contactId);
      result.associations.push({ from: `ticket:${ticketId}`, to: `contact:${contactId}`, status });
    }
  }

  // --- Meetings (as engagement objects) ---
  for (const m of MEETINGS) {
    const props: Record<string, string> = {
      hs_meeting_title: m.hs_meeting_title,
      hs_meeting_body: m.hs_meeting_body,
      hs_meeting_outcome: m.hs_meeting_outcome,
      hs_meeting_start_time: m.hs_meeting_start_time,
      hs_meeting_end_time: m.hs_meeting_end_time,
      hs_timestamp: nowIso(),
    };
    if (ownerId) props.hubspot_owner_id = ownerId;
    const rec = await safeCreate(client, "/crm/v3/objects/meetings", { properties: props });
    if (rec) {
      result.created.push({ type: "meeting", name: m.hs_meeting_title, id: rec.id });
      const contactId = contactIds[m.contactIndex];
      if (contactId) {
        const status = await safeAssociate(client, "meetings", rec.id, "contacts", contactId);
        result.associations.push({ from: `meeting:${rec.id}`, to: `contact:${contactId}`, status });
      }
    } else {
      result.skipped.push({ type: "meeting", name: m.hs_meeting_title, reason: "create failed" });
    }
  }

  // --- Products (commerce object) ---
  const productIds: (string | null)[] = [];
  // Uniqueness suffix to avoid collisions across repeat runs
  const runSuffix = Date.now().toString(36).slice(-5);
  for (const p of PRODUCTS) {
    try {
      // SKU must be unique across portal — add run suffix
      const uniqueSku = `${p.hs_sku}-${runSuffix}`;
      const rec = await safeCreate(client, "/crm/v3/objects/products", {
        properties: {
          name: p.name,
          description: p.description,
          price: p.price,
          hs_sku: uniqueSku,
        },
      });
      if (rec) {
        productIds.push(rec.id);
        result.created.push({ type: "product", name: p.name, id: rec.id, url: recordUrl("0-7", rec.id) });
      } else {
        productIds.push(null);
        result.skipped.push({ type: "product", name: p.name, reason: "create failed" });
      }
    } catch (err) {
      productIds.push(null);
      result.skipped.push({ type: "product", name: p.name, reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
    }
  }

  // --- Line Items (linked to deals) ---
  for (let i = 0; i < dealIds.length && i < productIds.length; i++) {
    const dealId = dealIds[i];
    const productId = productIds[i];
    if (!dealId || !productId) continue;
    try {
      const rec = await safeCreate(client, "/crm/v3/objects/line_items", {
        properties: {
          name: `${PRODUCTS[i].name} — on deal ${DEALS[i].dealname}`,
          hs_product_id: productId,
          quantity: "1",
          price: PRODUCTS[i].price,
        },
      });
      if (rec) {
        result.created.push({ type: "line_item", name: `${PRODUCTS[i].name} × 1`, id: rec.id });
        const status = await safeAssociate(client, "line_items", rec.id, "deals", dealId);
        result.associations.push({ from: `line_item:${rec.id}`, to: `deal:${dealId}`, status });
      }
    } catch (err) {
      result.skipped.push({ type: "line_item", name: PRODUCTS[i].name, reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
    }
  }

  // --- Quotes (one per deal, best-effort) ---
  for (let i = 0; i < Math.min(dealIds.length, 1); i++) {
    const dealId = dealIds[i];
    if (!dealId) continue;
    try {
      const rec = await safeCreate(client, "/crm/v3/objects/quotes", {
        properties: {
          hs_title: `Quote — ${DEALS[i].dealname}`,
          hs_expiration_date: futureDate(30),
          hs_status: "DRAFT",
          hs_language: "en",
        },
      });
      if (rec) {
        result.created.push({ type: "quote", name: `Quote — ${DEALS[i].dealname}`, id: rec.id });
        const status = await safeAssociate(client, "quotes", rec.id, "deals", dealId);
        result.associations.push({ from: `quote:${rec.id}`, to: `deal:${dealId}`, status });
      }
    } catch (err) {
      result.skipped.push({ type: "quote", name: DEALS[i].dealname, reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
    }
  }

  // --- Leads (new CRM object — needs an associated contact/company and a lead type) ---
  for (let i = 0; i < LEADS.length; i++) {
    const l = LEADS[i];
    const contactForLead = contactIds[i] || contactIds[0];
    if (!contactForLead) {
      result.skipped.push({ type: "lead", name: `${l.firstname} ${l.lastname}`, reason: "no contact to associate" });
      continue;
    }
    try {
      const rec = await safeCreate(client, "/crm/v3/objects/leads", {
        properties: {
          hs_lead_name: `${l.firstname} ${l.lastname}`,
          hs_lead_type: "NEW_BUSINESS",
        },
        associations: [
          {
            to: { id: contactForLead },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 578 }],
          },
        ],
      });
      if (rec) {
        result.created.push({ type: "lead", name: `${l.firstname} ${l.lastname}`, id: rec.id });
      }
    } catch (err) {
      result.skipped.push({ type: "lead", name: `${l.firstname} ${l.lastname}`, reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
    }
  }

  // --- Goals (best-effort; requires hs_assignee_user_id) ---
  for (const g of GOALS) {
    try {
      const props: Record<string, string> = {
        hs_goal_name: g.hs_goal_name,
        hs_target_amount: "500000",
      };
      if (ownerId) props.hs_assignee_user_id = ownerId;
      const rec = await safeCreate(client, "/crm/v3/objects/goal_targets", { properties: props });
      if (rec) result.created.push({ type: "goal", name: g.hs_goal_name, id: rec.id });
    } catch (err) {
      result.skipped.push({ type: "goal", name: g.hs_goal_name, reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
    }
  }

  // --- Marketing Form (full payload: requires createdAt + valid sub type id) ---
  try {
    // First, discover an available subscription type id (required by lawfulBasis=lead)
    let subTypeId: number | undefined;
    try {
      const defs = await client.request("/communication-preferences/v3/definitions") as { subscriptionDefinitions?: Array<{ id?: string | number; active?: boolean }> };
      const activeSub = defs.subscriptionDefinitions?.find(s => s.active !== false);
      if (activeSub?.id) subTypeId = Number(activeSub.id);
    } catch { /* no subs — skip form */ }

    if (subTypeId) {
      const formName = `HubCLI Seed Contact Form ${runSuffix}`;
      const now = nowIso();
      const formRec = await safeCreate(client, "/marketing/v3/forms/", {
        name: formName,
        formType: "hubspot",
        archived: false,
        createdAt: now,
        updatedAt: now,
        fieldGroups: [{
          groupType: "default_group",
          richTextType: "text",
          fields: [
            { objectTypeId: "0-1", name: "email", label: "Email", required: true, hidden: false, fieldType: "email", validation: { blockedEmailDomains: [], useDefaultBlockList: false } },
            { objectTypeId: "0-1", name: "firstname", label: "First name", required: false, hidden: false, fieldType: "single_line_text" },
          ],
        }],
        configuration: {
          allowLinkToResetForEditors: false,
          archivable: true,
          cloneable: true,
          createNewContactForNewEmail: true,
          editable: true,
          language: "en",
          notifyContactOwner: false,
          notifyRecipients: [],
          postSubmitAction: { type: "thank_you", value: "Thanks!" },
          recaptchaEnabled: false,
          prePopulateKnownValues: false,
        },
        displayOptions: {
          renderRawHtml: false,
          theme: "default_style",
          submitButtonText: "Submit",
        },
        legalConsentOptions: {
          type: "legitimate_interest",
          lawfulBasis: "lead",
          privacyText: "HubCLI seed test form — not for production use.",
          subscriptionTypeIds: [subTypeId],
        },
      });
      if (formRec) result.created.push({ type: "form", name: formName, id: formRec.id });
    } else {
      result.skipped.push({ type: "form", name: "HubCLI Seed Form", reason: "no active subscription type on portal" });
    }
  } catch (err) {
    result.skipped.push({ type: "form", name: "HubCLI Seed Form", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Marketing campaign (Marketing Hub Starter+) ---
  try {
    const campaignRec = await safeCreate(client, "/marketing/v3/campaigns", {
      properties: {
        hs_name: `HubCLI Seed Campaign ${runSuffix}`,
        hs_start_date: new Date().toISOString().split("T")[0],
        hs_end_date: futureDate(60),
      },
    });
    if (campaignRec) result.created.push({ type: "campaign", name: `HubCLI Seed Campaign ${runSuffix}`, id: campaignRec.id });
  } catch (err) {
    result.skipped.push({ type: "campaign", name: "HubCLI Seed Campaign", reason: err instanceof CliError ? `${err.code}:${err.status} (needs Marketing Hub Starter+)` : "error" });
  }

  // --- Static contact list ---
  try {
    const listName = `HubCLI Seed — Sample Contacts ${runSuffix}`;
    const listRec = await safeCreate(client, "/crm/v3/lists", {
      name: listName,
      processingType: "MANUAL",
      objectTypeId: "0-1",
    });
    if (listRec) {
      result.created.push({ type: "list", name: listName, id: listRec.id });
      // Try to add members
      const validContacts = contactIds.filter((c): c is string => Boolean(c));
      if (validContacts.length > 0) {
        try {
          await client.request(`/crm/v3/lists/${listRec.id}/memberships/add`, { method: "PUT", body: validContacts });
          result.associations.push({ from: `list:${listRec.id}`, to: `contacts:${validContacts.length}`, status: "ok" });
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    result.skipped.push({ type: "list", name: "HubCLI Seed — Sample Contacts", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Custom property group + property on contacts ---
  try {
    const groupRec = await safeCreate(client, "/crm/v3/properties/contacts/groups", {
      name: "hubcli_seed_group",
      label: "HubCLI Seed",
      displayOrder: -1,
    });
    if (groupRec) result.created.push({ type: "property_group", name: "hubcli_seed_group", id: "hubcli_seed_group" });
  } catch (err) {
    result.skipped.push({ type: "property_group", name: "hubcli_seed_group", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }
  try {
    const propRec = await safeCreate(client, "/crm/v3/properties/contacts", {
      name: "hubcli_seed_tag",
      label: "HubCLI Seed Tag",
      type: "string",
      fieldType: "text",
      groupName: "hubcli_seed_group",
      description: "Tag set by hubcli seed command for testing.",
    });
    if (propRec) result.created.push({ type: "property", name: "hubcli_seed_tag", id: "hubcli_seed_tag" });
  } catch (err) {
    result.skipped.push({ type: "property", name: "hubcli_seed_tag", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- URL redirect ---
  try {
    const redirectRec = await safeCreate(client, "/cms/v3/url-redirects", {
      routePrefix: "/hubcli-seed-redirect",
      destination: "https://hubcli.dev",
      redirectStyle: 301,
      precedence: 100,
      isOnlyAfterNotFound: false,
      isMatchFullUrl: false,
      isMatchQueryString: false,
      isPattern: false,
      isTrailingSlashOptional: true,
      isProtocolAgnostic: true,
      updated: Date.now(),
      created: Date.now(),
    });
    if (redirectRec) result.created.push({ type: "url_redirect", name: "/hubcli-seed-redirect", id: redirectRec.id });
  } catch (err) {
    result.skipped.push({ type: "url_redirect", name: "/hubcli-seed-redirect", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Timeline event template + one event ---
  try {
    // Timeline templates require an appId — use the portal's hub as fallback. This often fails on non-app-dev portals.
    const tmplRec = await safeCreate(client, `/crm/v3/timeline/event-templates`, {
      name: "hubcli_seed_event",
      objectType: "contacts",
      headerTemplate: "HubCLI Seed Event",
      detailTemplate: "Event created by hubcli seed for testing.",
    });
    if (tmplRec) {
      result.created.push({ type: "timeline_template", name: "hubcli_seed_event", id: tmplRec.id });
      // Try to emit an event using the first contact
      if (contactIds[0]) {
        try {
          const evRec = await safeCreate(client, `/crm/v3/timeline/events`, {
            eventTemplateId: tmplRec.id,
            objectId: contactIds[0],
            tokens: {},
          });
          if (evRec) result.created.push({ type: "timeline_event", name: "HubCLI Seed Event", id: evRec.id });
        } catch { /* ignore */ }
      }
    }
  } catch (err) {
    result.skipped.push({ type: "timeline_template", name: "hubcli_seed_event", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Webhook subscription (requires app context; usually fails on non-app-dev portals) ---
  try {
    const whRec = await safeCreate(client, "/webhooks/v3/subscriptions", {
      eventType: "contact.creation",
      propertyName: "",
      active: false,
    });
    if (whRec) result.created.push({ type: "webhook_subscription", name: "contact.creation (inactive)", id: whRec.id });
  } catch (err) {
    result.skipped.push({ type: "webhook_subscription", name: "contact.creation", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- CMS site page (draft, best-effort — Free CMS allows drafts) ---
  try {
    const pageName = `HubCLI Seed Site Page ${runSuffix}`;
    const pageRec = await safeCreate(client, "/cms/v3/pages/site-pages", {
      name: pageName,
      slug: `hubcli-seed-${runSuffix}`,
      htmlTitle: "HubCLI Seed Page",
      metaDescription: "A sample site page created by hubcli seed for testing.",
      language: "en",
    });
    if (pageRec) result.created.push({ type: "site_page", name: pageName, id: pageRec.id });
  } catch (err) {
    result.skipped.push({ type: "site_page", name: "HubCLI Seed Site Page", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- CMS landing page (draft) ---
  try {
    const lpName = `HubCLI Seed Landing Page ${runSuffix}`;
    const lpRec = await safeCreate(client, "/cms/v3/pages/landing-pages", {
      name: lpName,
      slug: `hubcli-seed-lp-${runSuffix}`,
      htmlTitle: "HubCLI Seed Landing Page",
      language: "en",
    });
    if (lpRec) result.created.push({ type: "landing_page", name: lpName, id: lpRec.id });
  } catch (err) {
    result.skipped.push({ type: "landing_page", name: "HubCLI Seed Landing Page", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- CMS blog post (draft, if blog available) ---
  try {
    const blogs = await client.request("/cms/v3/blogs/posts?limit=1") as { results?: Array<{ contentGroupId?: string }> };
    const blogId = blogs.results?.[0]?.contentGroupId;
    if (blogId) {
      const postName = `HubCLI Seed Blog Post ${runSuffix}`;
      const postRec = await safeCreate(client, "/cms/v3/blogs/posts", {
        name: postName,
        slug: `hubcli-seed-post-${runSuffix}`,
        contentGroupId: blogId,
        language: "en",
      });
      if (postRec) result.created.push({ type: "blog_post", name: postName, id: postRec.id });
    } else {
      result.skipped.push({ type: "blog_post", name: "HubCLI Seed Blog Post", reason: "no blog configured on portal" });
    }
  } catch (err) {
    result.skipped.push({ type: "blog_post", name: "HubCLI Seed Blog Post", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Blog authors + tags ---
  try {
    const authorRec = await safeCreate(client, "/cms/v3/blogs/authors", {
      fullName: `HubCLI Seed Author ${runSuffix}`,
      email: `hubcli-seed-${runSuffix}@example.com`,
    });
    if (authorRec) result.created.push({ type: "blog_author", name: `HubCLI Seed Author ${runSuffix}`, id: authorRec.id });
  } catch (err) {
    result.skipped.push({ type: "blog_author", name: "HubCLI Seed Author", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }
  try {
    const tagRec = await safeCreate(client, "/cms/v3/blogs/tags", {
      name: `hubcli-seed-tag-${runSuffix}`,
      slug: `hubcli-seed-tag-${runSuffix}`,
      language: "en",
    });
    if (tagRec) result.created.push({ type: "blog_tag", name: `hubcli-seed-tag-${runSuffix}`, id: tagRec.id });
  } catch (err) {
    result.skipped.push({ type: "blog_tag", name: "HubCLI Seed Tag", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- File upload via URL import (correct path: /import-from-url/async) ---
  try {
    const fileRec = await client.request("/files/v3/files/import-from-url/async", {
      method: "POST",
      body: {
        access: "PUBLIC_NOT_INDEXABLE",
        name: `hubcli-seed-${runSuffix}.ico`,
        url: "https://www.hubspot.com/favicon.ico",
        folderPath: "/hubcli-seed",
      },
    }) as { id?: string };
    if (fileRec?.id) result.created.push({ type: "file_import_task", name: `hubcli-seed-${runSuffix}.ico`, id: fileRec.id });
  } catch (err) {
    result.skipped.push({ type: "file_import_task", name: "hubcli-seed file", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Transactional SMTP token (best-effort, Marketing Hub Pro+) ---
  try {
    const smtpRec = await safeCreate(client, "/marketing/v3/transactional/smtp-tokens", {
      createContact: false,
      campaignName: `HubCLI Seed ${runSuffix}`,
    });
    if (smtpRec) result.created.push({ type: "smtp_token", name: `HubCLI Seed Campaign ${runSuffix}`, id: smtpRec.id });
  } catch (err) {
    result.skipped.push({ type: "smtp_token", name: "HubCLI Seed Campaign", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Marketing email (draft) ---
  try {
    const mktgEmailName = `HubCLI Seed Email ${runSuffix}`;
    const emailRec = await safeCreate(client, "/marketing/v3/emails/", {
      name: mktgEmailName,
      subject: "Test from HubCLI seed",
      language: "en",
      subcategory: "batch",
      sendOnPublish: false,
      useRssHeadlineAsSubject: false,
      content: { html: "<p>Test content from hubcli seed.</p>" },
      subscriptionDetails: { subscriptionId: 0 },
    });
    if (emailRec) result.created.push({ type: "marketing_email", name: mktgEmailName, id: emailRec.id });
  } catch (err) {
    result.skipped.push({ type: "marketing_email", name: "HubCLI Seed Email", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- HubDB table + rows + publish ---
  try {
    const hdbRec = await safeCreate(client, "/cms/v3/hubdb/tables", {
      name: `hubcli_seed_table_${runSuffix}`,
      label: `HubCLI Seed Table ${runSuffix}`,
      useForPages: false,
      columns: [
        { name: "key", label: "Key", type: "TEXT" },
        { name: "value", label: "Value", type: "TEXT" },
      ],
    });
    if (hdbRec) {
      result.created.push({ type: "hubdb_table", name: `hubcli_seed_table_${runSuffix}`, id: hdbRec.id });
      // Add a row to the draft
      try {
        const rowRec = await safeCreate(client, `/cms/v3/hubdb/tables/${hdbRec.id}/rows/draft/batch/create`, {
          inputs: [{ values: { key: "sample-key", value: "sample-value" } }],
        });
        if (rowRec) result.created.push({ type: "hubdb_row", name: "sample-row", id: String(rowRec.id) });
      } catch { /* ignore row failure */ }
      // Publish the table
      try {
        await client.request(`/cms/v3/hubdb/tables/${hdbRec.id}/draft/publish`, { method: "POST", body: {} });
        result.created.push({ type: "hubdb_publish", name: "table published", id: hdbRec.id });
      } catch { /* ignore publish failure */ }
    }
  } catch (err) {
    result.skipped.push({ type: "hubdb_table", name: "hubcli_seed_table", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Create revisions by EDITING + push-live site/landing pages ---
  // PATCH /draft creates a revision entry (unblocks /revisions/{id} GETs).
  // POST /draft/push-live publishes so the page has both a draft and a published version.
  try {
    const sitePages = await client.request("/cms/v3/pages/site-pages?limit=5") as { results?: Array<{ id?: string; name?: string }> };
    for (const sp of sitePages.results?.slice(0, 2) ?? []) {
      if (!sp.id) continue;
      try {
        await client.request(`/cms/v3/pages/site-pages/${sp.id}/draft`, {
          method: "PATCH",
          body: { metaDescription: `Revised by hubcli seed at ${nowIso()}` },
        });
        result.created.push({ type: "revision:site_page", name: sp.name || sp.id, id: sp.id });
        // Push-live: promotes the draft revision to the published version
        try {
          await client.request(`/cms/v3/pages/site-pages/${sp.id}/draft/push-live`, { method: "POST", body: {} });
          result.created.push({ type: "publish:site_page", name: sp.name || sp.id, id: sp.id });
        } catch { /* publishing may fail if missing template — skip */ }
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  try {
    const lpList = await client.request("/cms/v3/pages/landing-pages?limit=5") as { results?: Array<{ id?: string; name?: string }> };
    for (const lp of lpList.results?.slice(0, 2) ?? []) {
      if (!lp.id) continue;
      try {
        await client.request(`/cms/v3/pages/landing-pages/${lp.id}/draft`, {
          method: "PATCH",
          body: { metaDescription: `Revised by hubcli seed at ${nowIso()}` },
        });
        result.created.push({ type: "revision:landing_page", name: lp.name || lp.id, id: lp.id });
        try {
          await client.request(`/cms/v3/pages/landing-pages/${lp.id}/draft/push-live`, { method: "POST", body: {} });
          result.created.push({ type: "publish:landing_page", name: lp.name || lp.id, id: lp.id });
        } catch { /* skip */ }
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }

  // --- Custom deal pipeline (creatable on any tier, unlocks pipeline edit endpoints) ---
  try {
    const pipeRec = await safeCreate(client, "/crm/v3/pipelines/deals", {
      label: `HubCLI Seed Pipeline ${runSuffix}`,
      displayOrder: 99,
      stages: [
        { label: "Lead", metadata: { probability: "0.1" }, displayOrder: 0 },
        { label: "Qualified", metadata: { probability: "0.3" }, displayOrder: 1 },
        { label: "Proposal", metadata: { probability: "0.7" }, displayOrder: 2 },
        { label: "Won", metadata: { probability: "1.0" }, displayOrder: 3 },
      ],
    });
    if (pipeRec) result.created.push({ type: "pipeline:deals", name: `HubCLI Seed Pipeline ${runSuffix}`, id: pipeRec.id });
  } catch (err) {
    result.skipped.push({ type: "pipeline:deals", name: "HubCLI Seed Pipeline", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Custom ticket pipeline ---
  try {
    const pipeRec = await safeCreate(client, "/crm/v3/pipelines/tickets", {
      label: `HubCLI Seed Ticket Pipeline ${runSuffix}`,
      displayOrder: 99,
      stages: [
        { label: "New", metadata: { ticketState: "OPEN" }, displayOrder: 0 },
        { label: "Waiting on Contact", metadata: { ticketState: "OPEN" }, displayOrder: 1 },
        { label: "Closed", metadata: { ticketState: "CLOSED" }, displayOrder: 2 },
      ],
    });
    if (pipeRec) result.created.push({ type: "pipeline:tickets", name: `HubCLI Seed Ticket Pipeline ${runSuffix}`, id: pipeRec.id });
  } catch (err) {
    result.skipped.push({ type: "pipeline:tickets", name: "HubCLI Seed Ticket Pipeline", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Workflow (Ops Hub Pro+; free portal returns 400 with confusing enum error) ---
  // HubSpot's API asks for both type + flowType with mutually-exclusive enums on
  // the validation side depending on tier. We try the most-common-shape payload
  // and capture the tier-locked failure if it returns 400/403.
  try {
    const wfRec = await safeCreate(client, "/automation/v4/flows", {
      name: `HubCLI Seed Workflow ${runSuffix}`,
      type: "WORKFLOW",
      flowType: "CONTACT_FLOW",
      objectTypeId: "0-1",
      isEnabled: false,
    });
    if (wfRec) result.created.push({ type: "workflow", name: `HubCLI Seed Workflow ${runSuffix}`, id: wfRec.id });
  } catch (err) {
    result.skipped.push({ type: "workflow", name: "HubCLI Seed Workflow", reason: err instanceof CliError ? `${err.code}:${err.status} (Ops Hub Pro+ required)` : "error" });
  }

  // --- Attempt to create a blog (requires CMS Hub + connected domain — often fails) ---
  // Documented failure mode: BLOG_HS_SITE_DOMAIN_WRITE_SCOPE_MISSING when no
  // domain is connected. hubcli can't create a domain (that's a UI action),
  // so we surface a clear tip.
  try {
    const existingBlogs = await client.request("/cms/v3/blogs/posts?limit=1") as { results?: Array<{ contentGroupId?: string }> };
    if (!existingBlogs.results?.[0]?.contentGroupId) {
      try {
        await client.request("/content/api/v2/blogs", {
          method: "POST",
          body: { name: `HubCLI Seed Blog ${runSuffix}`, slug: `hubcli-seed-blog-${runSuffix}` },
        });
        result.created.push({ type: "blog", name: `HubCLI Seed Blog ${runSuffix}`, id: "new" });
      } catch (err) {
        const reason = err instanceof CliError ? (err.status === 403 ? "no connected domain (connect one in HubSpot Settings → Website → Domains first)" : `${err.code}:${err.status}`) : "error";
        result.skipped.push({ type: "blog", name: "HubCLI Seed Blog", reason });
        result.tips.push("Blog creation requires a connected domain. Go to HubSpot Settings → Website → Domains & URLs → Connect a domain, then re-run hubcli seed to create a blog + blog posts automatically.");
      }
    }
  } catch { /* ignore */ }

  // --- Custom object schema (creates a new object type if none exist) ---
  if (customSchemas.length === 0) {
    try {
      const schemaRec = await safeCreate(client, "/crm/v3/schemas", {
        name: `hubcli_seed_object_${runSuffix}`,
        labels: { singular: `Seed Object ${runSuffix}`, plural: `Seed Objects ${runSuffix}` },
        primaryDisplayProperty: "name",
        requiredProperties: ["name"],
        searchableProperties: ["name"],
        properties: [
          { name: "name", label: "Name", type: "string", fieldType: "text" },
        ],
        associatedObjects: ["CONTACT"],
      }) as { id: string } | null;
      if (schemaRec) {
        result.created.push({ type: "custom_object_schema", name: `hubcli_seed_object_${runSuffix}`, id: schemaRec.id });
        // Create one record against the new schema
        try {
          const rec = await safeCreate(client, `/crm/v3/objects/hubcli_seed_object_${runSuffix}`, {
            properties: { name: `Sample ${runSuffix}` },
          });
          if (rec) result.created.push({ type: `custom:hubcli_seed_object_${runSuffix}`, name: `Sample ${runSuffix}`, id: rec.id });
        } catch { /* skip */ }
      }
    } catch (err) {
      result.skipped.push({ type: "custom_object_schema", name: "hubcli_seed_object", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
    }
  }

  // --- Timeline event template via integration API (requires OAuth devapp; skipped on PA) ---
  // Left here to document the expected path — will 404 on Private App tokens (documented).
  try {
    const tmplRec = await safeCreate(client, `/integrators/timeline/v3/${runSuffix}/event/templates`, {
      name: `hubcli_seed_template_${runSuffix}`,
      objectType: "contacts",
      headerTemplate: "HubCLI Seed Event",
      detailTemplate: "Event emitted by hubcli seed.",
    });
    if (tmplRec) result.created.push({ type: "integrator_timeline_template", name: `hubcli_seed_template_${runSuffix}`, id: tmplRec.id });
  } catch (err) {
    result.skipped.push({ type: "integrator_timeline_template", name: "hubcli_seed_template", reason: err instanceof CliError ? `${err.code}:${err.status}` : "error" });
  }

  // --- Custom objects: create a sample record per schema ---
  for (const schema of customSchemas) {
    const props: Record<string, string> = {
      [schema.primaryDisplayProperty]: `Seed — ${schema.name} sample`,
    };
    const rec = await safeCreate(client, `/crm/v3/objects/${schema.objectTypeId}`, { properties: props });
    if (rec) {
      result.created.push({ type: `custom:${schema.name}`, name: props[schema.primaryDisplayProperty], id: rec.id, url: recordUrl(schema.objectTypeId, rec.id) });
      // Try to associate to first company
      if (companyIds[0]) {
        const status = await safeAssociate(client, schema.objectTypeId, rec.id, "companies", companyIds[0]);
        if (status === "ok") {
          result.associations.push({ from: `${schema.name}:${rec.id}`, to: `company:${companyIds[0]}`, status });
        } else {
          result.tips.push(`Association ${schema.name} ↔ companies not configured. Create it in HubSpot Settings → Data Management → Associations, then run: hubcli crm associations create ${schema.name} ${rec.id} companies ${companyIds[0]} --force`);
        }
      }
    }
  }

  // --- Summary tips ---
  if (!ownerId) result.tips.push("No owner detected. Records created without an owner. Run 'hubcli crm owners list' to verify.");
  if (!dealPipeline) result.tips.push("No deal pipeline found. Deals created without pipeline/stage.");
  if (!ticketPipeline) result.tips.push("No ticket pipeline found. Tickets created without pipeline/stage.");
  if (customSchemas.length === 0) result.tips.push("No custom objects found. Create one in HubSpot Settings → Data Management → Custom Objects.");

  const failedAssociations = result.associations.filter(a => a.status === "no_default_association");
  if (failedAssociations.length > 0) {
    result.tips.push(`${failedAssociations.length} association(s) skipped (no default association type configured). Configure them in HubSpot Settings → Data Management → Associations.`);
  }

  printResult(ctx, {
    summary: {
      created: result.created.length,
      skipped: result.skipped.length,
      associations: result.associations.filter(a => a.status === "ok").length,
      associationsFailed: failedAssociations.length,
    },
    created: result.created,
    skipped: result.skipped.length > 0 ? result.skipped : undefined,
    tips: result.tips.length > 0 ? result.tips : undefined,
  });
}

export function registerSeed(program: Command, getCtx: () => CliContext): void {
  program
    .command("seed")
    .description("Seed a test portal with comprehensive sample data: contacts, companies, deals, tickets, engagements (notes/tasks/calls/meetings), products + line-items, quotes, leads, goals, a marketing form, a static list, a custom property group + property, a URL redirect, a timeline event template + event, and (best-effort) a webhook subscription + HubDB table + custom-object records. Associations wired up automatically.")
    .action(async () => {
      const ctx = getCtx();
      if (ctx.dryRun) {
        printResult(ctx, {
          dryRun: true,
          message: "Dry-run mode: no records will be created. Remove --dry-run and use --force to execute.",
          wouldCreate: {
            contacts: CONTACTS.length,
            companies: COMPANIES.length,
            deals: DEALS.length,
            tickets: TICKETS.length,
            notes: NOTES.length,
            tasks: TASKS.length,
            calls: CALLS.length,
            meetings: MEETINGS.length,
            products: PRODUCTS.length,
            line_items: "1 per deal+product pair",
            quotes: "1 (best-effort)",
            leads: LEADS.length,
            goals: GOALS.length,
            form: 1,
            list: 1,
            property_group: 1,
            custom_property: 1,
            url_redirect: 1,
            timeline_event_template: "1 (best-effort)",
            timeline_event: "1 (best-effort)",
            webhook_subscription: "1 (best-effort, usually fails w/o app)",
            hubdb_table: "1 (best-effort, CMS Hub only)",
            custom_object_records: "1 per schema detected",
          },
        });
        return;
      }
      if (!ctx.force) {
        throw new CliError(
          "WRITE_CONFIRMATION_REQUIRED",
          "seed creates records in your portal. Preview with --dry-run, then run with --force to execute.",
        );
      }
      await runSeed(ctx);
    });
}
