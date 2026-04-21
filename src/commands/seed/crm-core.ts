import { CONTACTS, COMPANIES, DEALS, TICKETS } from "./data.js";
import { futureDate, safeAssociate, safeCreate } from "./shared.js";
import type { SeedContext, SeedResult } from "./types.js";

/** Contacts, companies, deals, tickets + their cross-associations. */
export async function seedCrmCore(ctx: SeedContext, result: SeedResult): Promise<void> {
  const { client, ownerId } = ctx;

  // --- Contacts ---
  for (const c of CONTACTS) {
    const search = await client.request("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: c.email }] }], limit: 1 },
    }) as { total?: number; results?: Array<{ id: string }> };

    if (search.total && search.total > 0) {
      const id = search.results![0].id;
      ctx.contactIds.push(id);
      result.skipped.push({ type: "contact", name: `${c.firstname} ${c.lastname}`, reason: `already exists (${id})` });
      continue;
    }
    const props: Record<string, string> = { ...c };
    if (ownerId) props.hubspot_owner_id = ownerId;
    const rec = await safeCreate(client, "/crm/v3/objects/contacts", { properties: props });
    if (rec) {
      ctx.contactIds.push(rec.id);
      result.created.push({ type: "contact", name: `${c.firstname} ${c.lastname}`, id: rec.id, url: ctx.recordUrl("0-1", rec.id) });
    } else {
      ctx.contactIds.push(null);
      result.skipped.push({ type: "contact", name: `${c.firstname} ${c.lastname}`, reason: "create failed (duplicate?)" });
    }
  }

  // --- Companies ---
  for (const co of COMPANIES) {
    const search = await client.request("/crm/v3/objects/companies/search", {
      method: "POST",
      body: { filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: co.domain }] }], limit: 1 },
    }) as { total?: number; results?: Array<{ id: string }> };

    if (search.total && search.total > 0) {
      const id = search.results![0].id;
      ctx.companyIds.push(id);
      result.skipped.push({ type: "company", name: co.name, reason: `already exists (${id})` });
      continue;
    }
    const props: Record<string, string> = { ...co };
    if (ownerId) props.hubspot_owner_id = ownerId;
    const rec = await safeCreate(client, "/crm/v3/objects/companies", { properties: props });
    if (rec) {
      ctx.companyIds.push(rec.id);
      result.created.push({ type: "company", name: co.name, id: rec.id, url: ctx.recordUrl("0-2", rec.id) });
    } else {
      ctx.companyIds.push(null);
      result.skipped.push({ type: "company", name: co.name, reason: "create failed" });
    }
  }

  // --- Deals ---
  for (const d of DEALS) {
    const props: Record<string, string> = {
      dealname: d.dealname,
      amount: d.amount,
      closedate: futureDate(60 + Math.floor(Math.random() * 90)),
    };
    if (ctx.dealPipeline) props.pipeline = ctx.dealPipeline;
    if (ctx.dealStage) props.dealstage = ctx.dealStage;
    if (ownerId) props.hubspot_owner_id = ownerId;

    const rec = await safeCreate(client, "/crm/v3/objects/deals", { properties: props });
    if (rec) {
      ctx.dealIds.push(rec.id);
      result.created.push({ type: "deal", name: d.dealname, id: rec.id, url: ctx.recordUrl("0-3", rec.id) });
    } else {
      ctx.dealIds.push(null);
      result.skipped.push({ type: "deal", name: d.dealname, reason: "create failed" });
    }
  }

  // --- Tickets ---
  for (const t of TICKETS) {
    const props: Record<string, string> = {
      subject: t.subject,
      content: t.content,
      hs_ticket_priority: t.hs_ticket_priority,
    };
    if (ctx.ticketPipeline) props.hs_pipeline = ctx.ticketPipeline;
    if (ctx.ticketStage) props.hs_pipeline_stage = ctx.ticketStage;
    if (ownerId) props.hubspot_owner_id = ownerId;

    const rec = await safeCreate(client, "/crm/v3/objects/tickets", { properties: props });
    if (rec) {
      ctx.ticketIds.push(rec.id);
      result.created.push({ type: "ticket", name: t.subject, id: rec.id, url: ctx.recordUrl("0-5", rec.id) });
    } else {
      ctx.ticketIds.push(null);
      result.skipped.push({ type: "ticket", name: t.subject, reason: "create failed" });
    }
  }

  // --- Cross-associations ---
  for (let i = 0; i < CONTACTS.length; i++) {
    const contactId = ctx.contactIds[i];
    const companyId = ctx.companyIds[i];
    if (!contactId || !companyId) continue;
    const status = await safeAssociate(client, "contacts", contactId, "companies", companyId);
    result.associations.push({ from: `contact:${contactId}`, to: `company:${companyId}`, status });
  }

  for (let i = 0; i < DEALS.length; i++) {
    const dealId = ctx.dealIds[i];
    if (!dealId) continue;
    const contactId = ctx.contactIds[DEALS[i].contactIndex];
    const companyId = ctx.companyIds[DEALS[i].companyIndex];
    if (contactId) {
      const status = await safeAssociate(client, "deals", dealId, "contacts", contactId);
      result.associations.push({ from: `deal:${dealId}`, to: `contact:${contactId}`, status });
    }
    if (companyId) {
      const status = await safeAssociate(client, "deals", dealId, "companies", companyId);
      result.associations.push({ from: `deal:${dealId}`, to: `company:${companyId}`, status });
    }
  }

  for (let i = 0; i < TICKETS.length; i++) {
    const ticketId = ctx.ticketIds[i];
    if (!ticketId) continue;
    const contactId = ctx.contactIds[TICKETS[i].contactIndex];
    if (contactId) {
      const status = await safeAssociate(client, "tickets", ticketId, "contacts", contactId);
      result.associations.push({ from: `ticket:${ticketId}`, to: `contact:${contactId}`, status });
    }
  }
}
