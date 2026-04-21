import { DEALS, GOALS, LEADS, PRODUCTS } from "./data.js";
import { errorReason, futureDate, safeAssociate, safeCreate } from "./shared.js";
import type { SeedContext, SeedResult } from "./types.js";

/** Products, line_items, quotes, leads, goals. Commerce Hub + CRM Pro+ surface. */
export async function seedCommerce(ctx: SeedContext, result: SeedResult): Promise<void> {
  const { client, runSuffix } = ctx;

  // --- Products (SKU uniquified per run) ---
  for (const p of PRODUCTS) {
    try {
      const uniqueSku = `${p.hs_sku}-${runSuffix}`;
      const rec = await safeCreate(client, "/crm/v3/objects/products", {
        properties: { name: p.name, description: p.description, price: p.price, hs_sku: uniqueSku },
      });
      if (rec) {
        ctx.productIds.push(rec.id);
        result.created.push({ type: "product", name: p.name, id: rec.id, url: ctx.recordUrl("0-7", rec.id) });
      } else {
        ctx.productIds.push(null);
        result.skipped.push({ type: "product", name: p.name, reason: "create failed" });
      }
    } catch (err) {
      ctx.productIds.push(null);
      result.skipped.push({ type: "product", name: p.name, reason: errorReason(err) });
    }
  }

  // --- Line Items (one per deal+product pair) ---
  for (let i = 0; i < ctx.dealIds.length && i < ctx.productIds.length; i++) {
    const dealId = ctx.dealIds[i];
    const productId = ctx.productIds[i];
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
      result.skipped.push({ type: "line_item", name: PRODUCTS[i].name, reason: errorReason(err) });
    }
  }

  // --- Quote (best-effort, requires hs_language on create) ---
  for (let i = 0; i < Math.min(ctx.dealIds.length, 1); i++) {
    const dealId = ctx.dealIds[i];
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
      result.skipped.push({ type: "quote", name: DEALS[i].dealname, reason: errorReason(err) });
    }
  }

  // --- Leads (requires hs_lead_type + a contact association) ---
  for (let i = 0; i < LEADS.length; i++) {
    const l = LEADS[i];
    const contactForLead = ctx.contactIds[i] || ctx.contactIds[0];
    if (!contactForLead) {
      result.skipped.push({ type: "lead", name: `${l.firstname} ${l.lastname}`, reason: "no contact to associate" });
      continue;
    }
    try {
      const rec = await safeCreate(client, "/crm/v3/objects/leads", {
        properties: { hs_lead_name: `${l.firstname} ${l.lastname}`, hs_lead_type: "NEW_BUSINESS" },
        associations: [{
          to: { id: contactForLead },
          types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 578 }],
        }],
      });
      if (rec) result.created.push({ type: "lead", name: `${l.firstname} ${l.lastname}`, id: rec.id });
    } catch (err) {
      result.skipped.push({ type: "lead", name: `${l.firstname} ${l.lastname}`, reason: errorReason(err) });
    }
  }

  // --- Goals (requires hs_assignee_user_id) ---
  for (const g of GOALS) {
    try {
      const props: Record<string, string> = {
        hs_goal_name: g.hs_goal_name,
        hs_target_amount: "500000",
      };
      if (ctx.ownerId) props.hs_assignee_user_id = ctx.ownerId;
      const rec = await safeCreate(client, "/crm/v3/objects/goal_targets", { properties: props });
      if (rec) result.created.push({ type: "goal", name: g.hs_goal_name, id: rec.id });
    } catch (err) {
      result.skipped.push({ type: "goal", name: g.hs_goal_name, reason: errorReason(err) });
    }
  }
}
