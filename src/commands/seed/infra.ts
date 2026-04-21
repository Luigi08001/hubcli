import { errorReason, safeAssociate, safeCreate } from "./shared.js";
import type { SeedContext, SeedResult } from "./types.js";

/**
 * Portal infrastructure: custom pipelines, custom object schemas, timeline
 * event templates, webhook subscriptions, workflow (Ops Hub Pro+).
 */
export async function seedInfra(ctx: SeedContext, result: SeedResult): Promise<void> {
  const { client, runSuffix } = ctx;

  // --- Custom deal pipeline ---
  try {
    const rec = await safeCreate(client, "/crm/v3/pipelines/deals", {
      label: `HubCLI Seed Pipeline ${runSuffix}`,
      displayOrder: 99,
      stages: [
        { label: "Lead", metadata: { probability: "0.1" }, displayOrder: 0 },
        { label: "Qualified", metadata: { probability: "0.3" }, displayOrder: 1 },
        { label: "Proposal", metadata: { probability: "0.7" }, displayOrder: 2 },
        { label: "Won", metadata: { probability: "1.0" }, displayOrder: 3 },
      ],
    });
    if (rec) result.created.push({ type: "pipeline:deals", name: `HubCLI Seed Pipeline ${runSuffix}`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "pipeline:deals", name: "HubCLI Seed Pipeline", reason: errorReason(err) });
  }

  // --- Custom ticket pipeline ---
  try {
    const rec = await safeCreate(client, "/crm/v3/pipelines/tickets", {
      label: `HubCLI Seed Ticket Pipeline ${runSuffix}`,
      displayOrder: 99,
      stages: [
        { label: "New", metadata: { ticketState: "OPEN" }, displayOrder: 0 },
        { label: "Waiting on Contact", metadata: { ticketState: "OPEN" }, displayOrder: 1 },
        { label: "Closed", metadata: { ticketState: "CLOSED" }, displayOrder: 2 },
      ],
    });
    if (rec) result.created.push({ type: "pipeline:tickets", name: `HubCLI Seed Ticket Pipeline ${runSuffix}`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "pipeline:tickets", name: "HubCLI Seed Ticket Pipeline", reason: errorReason(err) });
  }

  // --- Workflow (Ops Hub Pro+; tier-locked on Free) ---
  try {
    const rec = await safeCreate(client, "/automation/v4/flows", {
      name: `HubCLI Seed Workflow ${runSuffix}`,
      type: "WORKFLOW",
      flowType: "CONTACT_FLOW",
      objectTypeId: "0-1",
      isEnabled: false,
    });
    if (rec) result.created.push({ type: "workflow", name: `HubCLI Seed Workflow ${runSuffix}`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "workflow", name: "HubCLI Seed Workflow", reason: `${errorReason(err)} (Ops Hub Pro+ required)` });
  }

  // --- Timeline event template + one event (best-effort; dev-only in practice) ---
  try {
    const tmplRec = await safeCreate(client, "/crm/v3/timeline/event-templates", {
      name: "hubcli_seed_event",
      objectType: "contacts",
      headerTemplate: "HubCLI Seed Event",
      detailTemplate: "Event created by hubcli seed for testing.",
    });
    if (tmplRec) {
      result.created.push({ type: "timeline_template", name: "hubcli_seed_event", id: tmplRec.id });
      if (ctx.contactIds[0]) {
        try {
          const evRec = await safeCreate(client, "/crm/v3/timeline/events", {
            eventTemplateId: tmplRec.id,
            objectId: ctx.contactIds[0],
            tokens: {},
          });
          if (evRec) result.created.push({ type: "timeline_event", name: "HubCLI Seed Event", id: evRec.id });
        } catch { /* skip */ }
      }
    }
  } catch (err) {
    result.skipped.push({ type: "timeline_template", name: "hubcli_seed_event", reason: errorReason(err) });
  }

  // --- Webhook subscription (dev-app context required) ---
  try {
    const rec = await safeCreate(client, "/webhooks/v3/subscriptions", {
      eventType: "contact.creation",
      propertyName: "",
      active: false,
    });
    if (rec) result.created.push({ type: "webhook_subscription", name: "contact.creation (inactive)", id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "webhook_subscription", name: "contact.creation", reason: errorReason(err) });
  }

  // --- Integrators timeline template (app-dev; best-effort) ---
  try {
    const rec = await safeCreate(client, `/integrators/timeline/v3/${runSuffix}/event/templates`, {
      name: `hubcli_seed_template_${runSuffix}`,
      objectType: "contacts",
      headerTemplate: "HubCLI Seed Event",
      detailTemplate: "Event emitted by hubcli seed.",
    });
    if (rec) result.created.push({ type: "integrator_timeline_template", name: `hubcli_seed_template_${runSuffix}`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "integrator_timeline_template", name: "hubcli_seed_template", reason: errorReason(err) });
  }

  // --- Custom object schema (if none exist on portal) ---
  if (ctx.customSchemas.length === 0) {
    try {
      const rec = await safeCreate(client, "/crm/v3/schemas", {
        name: `hubcli_seed_object_${runSuffix}`,
        labels: { singular: `Seed Object ${runSuffix}`, plural: `Seed Objects ${runSuffix}` },
        primaryDisplayProperty: "name",
        requiredProperties: ["name"],
        searchableProperties: ["name"],
        properties: [{ name: "name", label: "Name", type: "string", fieldType: "text" }],
        associatedObjects: ["CONTACT"],
      });
      if (rec) {
        result.created.push({ type: "custom_object_schema", name: `hubcli_seed_object_${runSuffix}`, id: rec.id });
        try {
          const objRec = await safeCreate(client, `/crm/v3/objects/hubcli_seed_object_${runSuffix}`, {
            properties: { name: `Sample ${runSuffix}` },
          });
          if (objRec) result.created.push({ type: `custom:hubcli_seed_object_${runSuffix}`, name: `Sample ${runSuffix}`, id: objRec.id });
        } catch { /* skip */ }
      }
    } catch (err) {
      result.skipped.push({ type: "custom_object_schema", name: "hubcli_seed_object", reason: errorReason(err) });
    }
  }

  // --- Sample record per existing custom object schema ---
  for (const schema of ctx.customSchemas) {
    const props: Record<string, string> = { [schema.primaryDisplayProperty]: `Seed — ${schema.name} sample` };
    const rec = await safeCreate(client, `/crm/v3/objects/${schema.objectTypeId}`, { properties: props });
    if (rec) {
      result.created.push({
        type: `custom:${schema.name}`,
        name: props[schema.primaryDisplayProperty],
        id: rec.id,
        url: ctx.recordUrl(schema.objectTypeId, rec.id),
      });
      if (ctx.companyIds[0]) {
        const status = await safeAssociate(client, schema.objectTypeId, rec.id, "companies", ctx.companyIds[0]);
        if (status === "ok") {
          result.associations.push({ from: `${schema.name}:${rec.id}`, to: `company:${ctx.companyIds[0]}`, status });
        } else {
          result.tips.push(`Association ${schema.name} ↔ companies not configured. Create it in HubSpot Settings → Data Management → Associations, then run: hubcli crm associations create ${schema.name} ${rec.id} companies ${ctx.companyIds[0]} --force`);
        }
      }
    }
  }
}
