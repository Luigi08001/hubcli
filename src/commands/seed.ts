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
    .description("Create sample CRM data (contacts, companies, deals, tickets, engagements) using the connected portal's pipelines and owner")
    .action(async () => {
      const ctx = getCtx();
      if (!ctx.force) {
        throw new CliError(
          "WRITE_CONFIRMATION_REQUIRED",
          "seed creates records in your portal. Preview with --dry-run, then run with --force to execute.",
        );
      }
      await runSeed(ctx);
    });
}
