import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

// ──────────────────────────────────────────────────────────────────────────
// Legacy + niche HubSpot modules
//
// HubSpot exposes many path segments that are either legacy (v1/v2) or niche
// app-developer surfaces (broadcast, visitor-identification, scheduler, tax,
// appinstalls, submissions). Each gets a dedicated top-level command so users
// with portal configurations that depend on them have first-class coverage,
// not just the `api request` escape hatch.
// ──────────────────────────────────────────────────────────────────────────

function rawGet(getCtx: () => CliContext) {
  return async (path: string) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    return client.request(path);
  };
}

// ── Broadcast / scheduled social posts (legacy social API) ────────────────
export function registerBroadcast(program: Command, getCtx: () => CliContext): void {
  const bc = program.command("broadcast").description("Legacy social broadcast / scheduled post API");
  bc.command("list-channels").action(async () => printResult(getCtx(), await rawGet(getCtx)(`/broadcast/v1/channels/setting/publish/current`)));
  bc.command("list-broadcasts").option("--limit <n>", "Max records", "50").option("--offset <n>", "Paging offset").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "offset", o.offset);
    const res = await client.request(`/broadcast/v1/broadcasts?${params.toString()}`);
    printResult(ctx, res);
  });
  bc.command("get-broadcast").argument("<broadcastId>").action(async (broadcastId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(broadcastId, "broadcastId");
    const res = await client.request(`/broadcast/v1/broadcasts/${seg}`);
    printResult(ctx, res);
  });
  bc.command("create-broadcast").requiredOption("--data <payload>", "Broadcast payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/broadcast/v1/broadcasts`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  bc.command("cancel-broadcast").argument("<broadcastId>").action(async (broadcastId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(broadcastId, "broadcastId");
    const res = await maybeWrite(ctx, client, "POST", `/broadcast/v1/broadcasts/${seg}/cancel`);
    printResult(ctx, res);
  });
}

// ── Visitor Identification ────────────────────────────────────────────────
export function registerVisitorIdentification(program: Command, getCtx: () => CliContext): void {
  const vi = program.command("visitor-identification").description("HubSpot Visitor Identification API (chat widget identity)");
  vi.command("token").description("Generate an identification token for a visitor")
    .requiredOption("--data <payload>", "Payload JSON: { email, firstName?, lastName? }")
    .action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request(`/visitor-identification/v3/tokens/create`, { method: "POST", body: parseJsonPayload(o.data) });
      printResult(ctx, res);
    });
}

// ── Business Units root path (/business-units/v3) — alternate of /settings/v3/business-units ──
export function registerBusinessUnits(program: Command, getCtx: () => CliContext): void {
  const bu = program.command("business-units").description("Business Units API (/business-units/v3) — root path, complements /settings/v3/business-units");
  bu.command("list-for-user").argument("<userId>").action(async (userId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(userId, "userId");
    const res = await client.request(`/business-units/v3/business-units/user/${seg}`);
    printResult(ctx, res);
  });
}

// ── Broadcasts root alias ─────────────────────────────────────────────────
export function registerBroadcastsRoot(program: Command, getCtx: () => CliContext): void {
  const b = program.command("broadcasts-root").description("Root /broadcasts path (shortcut alias)");
  b.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/broadcasts`);
    printResult(ctx, res);
  });
}

// ── Form integrations (file upload signed URL redirect) ───────────────────
export function registerFormIntegrations(program: Command, getCtx: () => CliContext): void {
  const f = program.command("form-integrations").description("Form integrations API (file upload signed URLs)");
  f.command("file-signed-url").argument("<fileId>").action(async (fileId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(fileId, "fileId");
    const res = await client.request(`/form/integrations/v1/uploaded/files/signed/url/redirect/${seg}`);
    printResult(ctx, res);
  });
}

// ── Submissions (Forms submissions) ───────────────────────────────────────
export function registerSubmissions(program: Command, getCtx: () => CliContext): void {
  const subs = program.command("submissions").description("Form submissions (cross-cutting access)");
  subs.command("list")
    .description("List submissions for a form")
    .argument("<formGuid>")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (formGuid, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(formGuid, "formGuid");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
      appendOptional(params, "after", o.after);
      const res = await client.request(`/form-integrations/v1/submissions/forms/${seg}?${params.toString()}`);
      printResult(ctx, res);
    });
  subs.command("search").argument("<portalId>").argument("<formGuid>").action(async (portalId, formGuid) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const portalSeg = encodePathSegment(portalId, "portalId");
    const formSeg = encodePathSegment(formGuid, "formGuid");
    const res = await client.request(`/submissions/v3/integration/${portalSeg}/forms/${formSeg}/submissions`);
    printResult(ctx, res);
  });
}

// ── Meetings Scheduler (booking links, availability) ──────────────────────
export function registerScheduler(program: Command, getCtx: () => CliContext): void {
  const sch = program.command("scheduler").description("HubSpot Meetings Scheduler API (booking pages)");
  sch.command("links-list").option("--limit <n>", "Max records", "50").option("--after <cursor>", "Paging cursor").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "after", o.after);
    const res = await client.request(`/scheduler/v3/meetings/meeting-links?${params.toString()}`);
    printResult(ctx, res);
  });
  sch.command("link-get").argument("<slug>").action(async (slug) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(slug, "slug");
    const res = await client.request(`/scheduler/v3/meetings/meeting-links/book/${seg}`);
    printResult(ctx, res);
  });
  sch.command("book").argument("<slug>").requiredOption("--data <payload>", "Booking payload JSON").action(async (slug, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(slug, "slug");
    const res = await maybeWrite(ctx, client, "POST", `/scheduler/v3/meetings/meeting-links/book/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  sch.command("reschedule").argument("<slug>").requiredOption("--data <payload>", "Reschedule payload JSON").action(async (slug, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(slug, "slug");
    const res = await maybeWrite(ctx, client, "POST", `/scheduler/v3/meetings/meeting-links/book/${seg}/reschedule`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  sch.command("cancel").argument("<slug>").argument("<bookingId>").action(async (slug, bookingId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(slug, "slug");
    const bookingSeg = encodePathSegment(bookingId, "bookingId");
    const res = await maybeWrite(ctx, client, "DELETE", `/scheduler/v3/meetings/meeting-links/book/${seg}/${bookingSeg}`);
    printResult(ctx, res);
  });
}

// ── Tax Rates ─────────────────────────────────────────────────────────────
export function registerTax(program: Command, getCtx: () => CliContext): void {
  const tax = program.command("tax").description("HubSpot tax rates API (commerce)");
  tax.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/tax/v3/taxes`);
    printResult(ctx, res);
  });
  tax.command("get").argument("<taxId>").action(async (taxId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(taxId, "taxId");
    const res = await client.request(`/tax/v3/taxes/${seg}`);
    printResult(ctx, res);
  });
  tax.command("create").requiredOption("--data <payload>", "Tax rate payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/tax/v3/taxes`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  tax.command("update").argument("<taxId>").requiredOption("--data <payload>", "Tax rate patch JSON").action(async (taxId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(taxId, "taxId");
    const res = await maybeWrite(ctx, client, "PATCH", `/tax/v3/taxes/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  tax.command("delete").argument("<taxId>").action(async (taxId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(taxId, "taxId");
    const res = await maybeWrite(ctx, client, "DELETE", `/tax/v3/taxes/${seg}`);
    printResult(ctx, res);
  });
}

// ── App installs (external install lifecycle for partner apps) ────────────
export function registerAppinstalls(program: Command, getCtx: () => CliContext): void {
  const ai = program.command("appinstalls").description("Partner app external install lifecycle");
  ai.command("uninstall").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "DELETE", `/appinstalls/v3/external/install/${seg}`);
    printResult(ctx, res);
  });
}

// ── Marketing: Ads Events, Marketing Analytics ────────────────────────────
export function registerMarketingExtras(program: Command, getCtx: () => CliContext): void {
  const me = program.command("marketing-extras").description("Marketing extras: analytics, email events delivery, publishing channel integrations");

  // Ads events — event submission for ad-click attribution
  me.command("ads-events").description("Submit ads events for attribution")
    .requiredOption("--data <payload>", "Ads event payload JSON")
    .action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `/marketing/v3/ads/events`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  // Email publish state (legacy /marketing-emails v1 wrapper already covered)
  // AB Test ops at marketing-emails v1 level
  me.command("legacy-email-ab-test").argument("<emailId>")
    .description("Start or manage A/B test on a legacy marketing email")
    .requiredOption("--data <payload>", "AB-test payload JSON")
    .action(async (emailId, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(emailId, "emailId");
      const res = await maybeWrite(ctx, client, "POST", `/marketing-emails/v1/emails/${seg}/ab-test`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
}

// ── CRM Owners extras (owner-centric endpoints we haven't wrapped) ────────
export function registerOwnersExtras(program: Command, getCtx: () => CliContext): void {
  const oe = program.command("owners-extras").description("Extra owner endpoints (partner/legacy)");
  oe.command("archived-list").option("--limit <n>", "Max records", "100").option("--after <cursor>", "Paging cursor").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "after", o.after);
    params.set("archived", "true");
    const res = await client.request(`/crm/v3/owners?${params.toString()}`);
    printResult(ctx, res);
  });
}
