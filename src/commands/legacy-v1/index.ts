import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

/**
 * Legacy HubSpot v1/v2 API surface.
 *
 * HubSpot keeps many older endpoints alive alongside the v3/v4 APIs because portals
 * with long-running integrations (Zapier recipes, custom middleware, old apps) still
 * hit them. Each legacy module is registered as its own top-level command so users
 * who need these paths don't have to fall back to `hscli api request`.
 *
 * All covered paths come from the HubSpot dev-doc scrape at
 *   ~/Desktop/vault/HubSpot Audit/api-mapping/endpoints.json
 * and are kept intentionally lean (list/get/create/update/delete + the most common
 * extras); app-developer surfaces that target <10 endpoints are flattened onto a
 * single command group for simplicity.
 */

// ── CRM Contacts v1 (legacy) ──────────────────────────────────────────────
export function registerContactsV1(program: Command, getCtx: () => CliContext): void {
  const c = program.command("contacts-v1").description("Legacy /contacts/v1 API (lifecycle stage, form submissions, lists, search)");

  c.command("list").option("--count <n>", "Records per page", "20").option("--offset <n>", "Paging offset").option("--property <csv>", "Comma-separated properties").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("count", String(parseNumberFlag(o.count, "--count")));
    appendOptional(params, "vidOffset", o.offset);
    if (o.property) for (const p of String(o.property).split(",")) params.append("property", p.trim());
    const res = await client.request(`/contacts/v1/lists/all/contacts/all?${params.toString()}`);
    printResult(ctx, res);
  });
  c.command("get-by-id").argument("<contactId>").action(async (contactId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(contactId, "contactId");
    const res = await client.request(`/contacts/v1/contact/vid/${seg}/profile`);
    printResult(ctx, res);
  });
  c.command("get-by-email").argument("<email>").action(async (email) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(email, "email");
    const res = await client.request(`/contacts/v1/contact/email/${seg}/profile`);
    printResult(ctx, res);
  });
  c.command("get-by-utk").argument("<utk>", "Hubspot user token").action(async (utk) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(utk, "utk");
    const res = await client.request(`/contacts/v1/contact/utk/${seg}/profile`);
    printResult(ctx, res);
  });
  c.command("create-or-update").argument("<email>").requiredOption("--data <payload>", "Contact payload JSON").action(async (email, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(email, "email");
    const res = await maybeWrite(ctx, client, "POST", `/contacts/v1/contact/createOrUpdate/email/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  c.command("update-by-id").argument("<contactId>").requiredOption("--data <payload>", "Contact patch JSON").action(async (contactId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(contactId, "contactId");
    const res = await maybeWrite(ctx, client, "POST", `/contacts/v1/contact/vid/${seg}/profile`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  c.command("delete").argument("<contactId>").action(async (contactId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(contactId, "contactId");
    const res = await maybeWrite(ctx, client, "DELETE", `/contacts/v1/contact/vid/${seg}`);
    printResult(ctx, res);
  });
  c.command("recent").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/contacts/v1/lists/recently_updated/contacts/recent`);
    printResult(ctx, res);
  });
  c.command("search").requiredOption("--q <text>", "Search term").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("q", String(o.q));
    const res = await client.request(`/contacts/search/query?${params.toString()}`);
    printResult(ctx, res);
  });
  c.command("lists").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/contacts/v1/lists`);
    printResult(ctx, res);
  });
  c.command("list-contacts").argument("<listId>").action(async (listId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(listId, "listId");
    const res = await client.request(`/contacts/v1/lists/${seg}/contacts/all`);
    printResult(ctx, res);
  });
}

// ── Companies v2 (legacy) ─────────────────────────────────────────────────
export function registerCompaniesV2(program: Command, getCtx: () => CliContext): void {
  const c = program.command("companies-v2").description("Legacy /companies/v2 API");
  c.command("list").option("--limit <n>", "Records per page", "50").option("--offset <n>", "Paging offset").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "offset", o.offset);
    const res = await client.request(`/companies/v2/companies/paged?${params.toString()}`);
    printResult(ctx, res);
  });
  c.command("get").argument("<companyId>").action(async (companyId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(companyId, "companyId");
    const res = await client.request(`/companies/v2/companies/${seg}`);
    printResult(ctx, res);
  });
  c.command("create").requiredOption("--data <payload>", "Company payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/companies/v2/companies`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  c.command("update").argument("<companyId>").requiredOption("--data <payload>", "Company patch JSON").action(async (companyId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(companyId, "companyId");
    const res = await maybeWrite(ctx, client, "PUT", `/companies/v2/companies/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  c.command("delete").argument("<companyId>").action(async (companyId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(companyId, "companyId");
    const res = await maybeWrite(ctx, client, "DELETE", `/companies/v2/companies/${seg}`);
    printResult(ctx, res);
  });
  c.command("recent").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/companies/v2/companies/recent/modified`);
    printResult(ctx, res);
  });
  c.command("get-contacts").argument("<companyId>").action(async (companyId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(companyId, "companyId");
    const res = await client.request(`/companies/v2/companies/${seg}/contacts`);
    printResult(ctx, res);
  });
}

// ── Deals v1 (legacy) ─────────────────────────────────────────────────────
export function registerDealsV1(program: Command, getCtx: () => CliContext): void {
  const d = program.command("deals-v1").description("Legacy /deals/v1 API");
  d.command("list").option("--limit <n>", "Records per page", "50").option("--offset <n>", "Paging offset").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "offset", o.offset);
    const res = await client.request(`/deals/v1/deal/paged?${params.toString()}`);
    printResult(ctx, res);
  });
  d.command("get").argument("<dealId>").action(async (dealId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(dealId, "dealId");
    const res = await client.request(`/deals/v1/deal/${seg}`);
    printResult(ctx, res);
  });
  d.command("create").requiredOption("--data <payload>", "Deal payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/deals/v1/deal`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  d.command("update").argument("<dealId>").requiredOption("--data <payload>", "Deal patch JSON").action(async (dealId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(dealId, "dealId");
    const res = await maybeWrite(ctx, client, "PUT", `/deals/v1/deal/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  d.command("delete").argument("<dealId>").action(async (dealId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(dealId, "dealId");
    const res = await maybeWrite(ctx, client, "DELETE", `/deals/v1/deal/${seg}`);
    printResult(ctx, res);
  });
  d.command("recent").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/deals/v1/deal/recent/modified`);
    printResult(ctx, res);
  });
  d.command("associate").argument("<dealId>").argument("<objectType>").argument("<objectId>").action(async (dealId, objectType, objectId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const dealSeg = encodePathSegment(dealId, "dealId");
    const typeSeg = encodePathSegment(objectType, "objectType");
    const idSeg = encodePathSegment(objectId, "objectId");
    const res = await maybeWrite(ctx, client, "PUT", `/deals/v1/deal/${dealSeg}/associations/${typeSeg}/${idSeg}`);
    printResult(ctx, res);
  });
}

// ── Owners v2 (legacy) ────────────────────────────────────────────────────
export function registerOwnersV2(program: Command, getCtx: () => CliContext): void {
  const o = program.command("owners-v2").description("Legacy /owners/v2 API");
  o.command("list").option("--email <email>", "Filter by email").option("--include-inactive", "Include deactivated owners").action(async (opt) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    appendOptional(params, "email", opt.email);
    if (opt.includeInactive) params.set("includeInactive", "true");
    const res = await client.request(`/owners/v2/owners?${params.toString()}`);
    printResult(ctx, res);
  });
  o.command("get").argument("<ownerId>").action(async (ownerId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(ownerId, "ownerId");
    const res = await client.request(`/owners/v2/owners/${seg}`);
    printResult(ctx, res);
  });
}

// ── Engagements v1 (legacy) ───────────────────────────────────────────────
export function registerEngagementsV1(program: Command, getCtx: () => CliContext): void {
  const e = program.command("engagements-v1").description("Legacy /engagements/v1 API");
  e.command("list").option("--limit <n>", "Records per page", "100").option("--offset <n>", "Paging offset").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "offset", o.offset);
    const res = await client.request(`/engagements/v1/engagements/paged?${params.toString()}`);
    printResult(ctx, res);
  });
  e.command("get").argument("<engagementId>").action(async (engagementId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(engagementId, "engagementId");
    const res = await client.request(`/engagements/v1/engagements/${seg}`);
    printResult(ctx, res);
  });
  e.command("create").requiredOption("--data <payload>", "Engagement payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/engagements/v1/engagements`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  e.command("update").argument("<engagementId>").requiredOption("--data <payload>", "Engagement patch JSON").action(async (engagementId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(engagementId, "engagementId");
    const res = await maybeWrite(ctx, client, "PATCH", `/engagements/v1/engagements/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  e.command("delete").argument("<engagementId>").action(async (engagementId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(engagementId, "engagementId");
    const res = await maybeWrite(ctx, client, "DELETE", `/engagements/v1/engagements/${seg}`);
    printResult(ctx, res);
  });
  e.command("associated").argument("<objectType>").argument("<objectId>").action(async (objectType, objectId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const idSeg = encodePathSegment(objectId, "objectId");
    const res = await client.request(`/engagements/v1/engagements/associated/${typeSeg}/${idSeg}/paged`);
    printResult(ctx, res);
  });
}

// ── Properties v1 + v2 (legacy) ───────────────────────────────────────────
export function registerPropertiesLegacy(program: Command, getCtx: () => CliContext): void {
  const p = program.command("properties-legacy").description("Legacy /properties/v1 + /properties/v2 APIs (pre-CRM-v3 property definitions)");

  // /properties/v1/{objectType}/properties/named/{name}
  const v1 = p.command("v1").description("/properties/v1");
  v1.command("list").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await client.request(`/properties/v1/${seg}/properties`);
    printResult(ctx, res);
  });
  v1.command("get").argument("<objectType>").argument("<name>").action(async (objectType, name) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(name, "name");
    const res = await client.request(`/properties/v1/${typeSeg}/properties/named/${nameSeg}`);
    printResult(ctx, res);
  });
  v1.command("create").argument("<objectType>").requiredOption("--data <payload>", "Property definition JSON").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "POST", `/properties/v1/${seg}/properties`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  v1.command("update").argument("<objectType>").argument("<name>").requiredOption("--data <payload>", "Property patch JSON").action(async (objectType, name, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(name, "name");
    const res = await maybeWrite(ctx, client, "PUT", `/properties/v1/${typeSeg}/properties/named/${nameSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  v1.command("delete").argument("<objectType>").argument("<name>").action(async (objectType, name) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(name, "name");
    const res = await maybeWrite(ctx, client, "DELETE", `/properties/v1/${typeSeg}/properties/named/${nameSeg}`);
    printResult(ctx, res);
  });
  v1.command("groups-list").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await client.request(`/properties/v1/${seg}/groups`);
    printResult(ctx, res);
  });
  v1.command("groups-create").argument("<objectType>").requiredOption("--data <payload>", "Group payload JSON").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "POST", `/properties/v1/${seg}/groups`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  v1.command("groups-update").argument("<objectType>").argument("<groupName>").requiredOption("--data <payload>", "Group patch JSON").action(async (objectType, groupName, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const groupSeg = encodePathSegment(groupName, "groupName");
    const res = await maybeWrite(ctx, client, "PUT", `/properties/v1/${typeSeg}/groups/named/${groupSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  v1.command("groups-delete").argument("<objectType>").argument("<groupName>").action(async (objectType, groupName) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const groupSeg = encodePathSegment(groupName, "groupName");
    const res = await maybeWrite(ctx, client, "DELETE", `/properties/v1/${typeSeg}/groups/named/${groupSeg}`);
    printResult(ctx, res);
  });

  const v2 = p.command("v2").description("/properties/v2 (same shape as v1 plus company/contact shortcuts)");
  v2.command("list").argument("<objectType>").action(async (objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await client.request(`/properties/v2/${seg}/properties`);
    printResult(ctx, res);
  });
  v2.command("get").argument("<objectType>").argument("<name>").action(async (objectType, name) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(name, "name");
    const res = await client.request(`/properties/v2/${typeSeg}/properties/named/${nameSeg}`);
    printResult(ctx, res);
  });
  v2.command("create").argument("<objectType>").requiredOption("--data <payload>", "Property definition JSON").action(async (objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "POST", `/properties/v2/${seg}/properties`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  v2.command("update").argument("<objectType>").argument("<name>").requiredOption("--data <payload>", "Property patch JSON").action(async (objectType, name, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(name, "name");
    const res = await maybeWrite(ctx, client, "PUT", `/properties/v2/${typeSeg}/properties/named/${nameSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  v2.command("delete").argument("<objectType>").argument("<name>").action(async (objectType, name) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const typeSeg = encodePathSegment(objectType, "objectType");
    const nameSeg = encodePathSegment(name, "name");
    const res = await maybeWrite(ctx, client, "DELETE", `/properties/v2/${typeSeg}/properties/named/${nameSeg}`);
    printResult(ctx, res);
  });
}

// ── Reports v2 (legacy) ───────────────────────────────────────────────────
export function registerReportsV2(program: Command, getCtx: () => CliContext): void {
  const r = program.command("reports-v2").description("Legacy /reports/v2 API");
  r.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/reports/v2/reports`);
    printResult(ctx, res);
  });
  r.command("get").argument("<reportId>").action(async (reportId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(reportId, "reportId");
    const res = await client.request(`/reports/v2/reports/${seg}`);
    printResult(ctx, res);
  });
  r.command("data").argument("<reportId>").action(async (reportId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(reportId, "reportId");
    const res = await client.request(`/reports/v2/reports/${seg}/data`);
    printResult(ctx, res);
  });
}

// ── Payments Subscriptions (commerce subscriptions beyond /crm/v3/objects) ─
export function registerPaymentsSubscriptions(program: Command, getCtx: () => CliContext): void {
  const ps = program.command("payments-subscriptions").description("Payments subscriptions top-level commerce endpoints");
  ps.command("get").argument("<subscriptionId>").action(async (subscriptionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(subscriptionId, "subscriptionId");
    const res = await client.request(`/payments/subscriptions/v1/subscriptions/${seg}`);
    printResult(ctx, res);
  });
  ps.command("cancel").argument("<subscriptionId>").action(async (subscriptionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(subscriptionId, "subscriptionId");
    const res = await maybeWrite(ctx, client, "POST", `/payments/subscriptions/v1/subscriptions/${seg}/cancel`);
    printResult(ctx, res);
  });
  ps.command("pause").argument("<subscriptionId>").requiredOption("--data <payload>", "Pause payload JSON").action(async (subscriptionId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(subscriptionId, "subscriptionId");
    const res = await maybeWrite(ctx, client, "POST", `/payments/subscriptions/v1/subscriptions/${seg}/pause`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
}

// ── CMS Content v2 legacy (Pages, Blogs v3, Templates, Layouts, Modules, UrlMappings, DomainBy) ──
export function registerContentV2(program: Command, getCtx: () => CliContext): void {
  const c = program.command("content-v2").description("Legacy /content/api/v2 CMS endpoints (Pages, Blogs v3, Templates, Layouts, Modules, UrlMappings, Domains)");

  for (const [name, path] of [
    ["pages", "/content/api/v2/pages"],
    ["page-versions", "/content/api/v2/pages/{p}/versions"],
    ["page-buffer", "/content/api/v2/pages/{p}/buffer"],
    ["blogs-v3", "/content/api/v2/blogs"],
    ["blog-by-id", "/content/api/v2/blogs/{p}"],
    ["blog-versions", "/content/api/v2/blogs/{p}/versions"],
    ["blog-topics", "/content/api/v2/topics"],
    ["blog-topic-by-id", "/content/api/v2/topics/{p}"],
    ["templates", "/content/api/v2/templates"],
    ["template-by-id", "/content/api/v2/templates/{p}"],
    ["template-buffer", "/content/api/v2/templates/{p}/buffer"],
    ["template-versions", "/content/api/v2/templates/{p}/versions"],
    ["layouts", "/content/api/v2/layouts"],
    ["layout-by-id", "/content/api/v2/layouts/{p}"],
    ["layout-buffer", "/content/api/v2/layouts/{p}/buffer"],
    ["layout-buffered-changes", "/content/api/v2/layouts/{p}/buffered_changes"],
    ["layout-versions", "/content/api/v2/layouts/{p}/versions"],
    ["modules", "/content/api/v2/custom_modules"],
    ["module-by-id", "/content/api/v2/custom_modules/{p}"],
    ["module-by-path", "/content/api/v2/custom_modules/by_path/{p}"],
    ["url-mappings", "/content/api/v2/url-mappings"],
    ["domains", "/content/api/v2/domains"],
    ["domain-by-id", "/content/api/v2/domains/{p}"],
    ["indexed-properties", "/content/api/v2/indexed-properties"],
  ] as const) {
    const cmd = c.command(name).description(`Legacy ${path}`);
    if (path.includes("{p}")) {
      cmd.argument("<id>").option("--method <m>", "HTTP method", "GET").option("--data <payload>", "Optional JSON body").action(async (id, o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const resolved = path.replace("{p}", encodePathSegment(id, "id"));
        const method = String(o.method).toUpperCase();
        const body = o.data ? parseJsonPayload(o.data) : undefined;
        const res = method === "GET" ? await client.request(resolved) : await maybeWrite(ctx, client, method as "POST" | "PUT" | "PATCH" | "DELETE", resolved, body);
        printResult(ctx, res);
      });
    } else {
      cmd.option("--method <m>", "HTTP method", "GET").option("--data <payload>", "Optional JSON body").action(async (o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const method = String(o.method).toUpperCase();
        const body = o.data ? parseJsonPayload(o.data) : undefined;
        const res = method === "GET" ? await client.request(path) : await maybeWrite(ctx, client, method as "POST" | "PUT" | "PATCH" | "DELETE", path, body);
        printResult(ctx, res);
      });
    }
  }
}

// ── Sales Extensions (/crm/v3/extensions/sales + /extensions/sales) ───────
export function registerSalesExtensions(program: Command, getCtx: () => CliContext): void {
  const se = program.command("sales-extensions").description("Sales extensions API for app-dev integrations");
  se.command("videoconferencing-settings").argument("<appId>").option("--method <m>", "GET|PUT|DELETE", "GET").option("--data <payload>", "Optional JSON body").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const path = `/extensions/sales/videoconferencing/${seg}/settings`;
    const method = String(o.method).toUpperCase();
    const body = o.data ? parseJsonPayload(o.data) : undefined;
    const res = method === "GET" ? await client.request(path) : await maybeWrite(ctx, client, method as "PUT" | "DELETE" | "POST" | "PATCH", path, body);
    printResult(ctx, res);
  });
  se.command("accounting-settings").argument("<appId>").option("--method <m>", "GET|PUT|DELETE", "GET").option("--data <payload>", "Optional JSON body").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const path = `/extensions/sales/accounting/${seg}/settings`;
    const method = String(o.method).toUpperCase();
    const body = o.data ? parseJsonPayload(o.data) : undefined;
    const res = method === "GET" ? await client.request(path) : await maybeWrite(ctx, client, method as "PUT" | "DELETE" | "POST" | "PATCH", path, body);
    printResult(ctx, res);
  });
}

// ── Comments (CMS comments on blog posts) ─────────────────────────────────
export function registerComments(program: Command, getCtx: () => CliContext): void {
  const c = program.command("comments").description("CMS blog post comments");
  c.command("list").option("--limit <n>", "Max records", "50").option("--after <cursor>", "Paging cursor").option("--content-id <id>", "Filter by content id").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "after", o.after);
    appendOptional(params, "contentId", o.contentId);
    const res = await client.request(`/comments/v3/comments?${params.toString()}`);
    printResult(ctx, res);
  });
  c.command("get").argument("<commentId>").action(async (commentId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(commentId, "commentId");
    const res = await client.request(`/comments/v3/comments/${seg}`);
    printResult(ctx, res);
  });
  c.command("update-state").argument("<commentId>").requiredOption("--data <payload>", "Moderation state payload JSON").action(async (commentId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(commentId, "commentId");
    const res = await maybeWrite(ctx, client, "PATCH", `/comments/v3/comments/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
}

// ── Calling v1 legacy ─────────────────────────────────────────────────────
export function registerCallingV1(program: Command, getCtx: () => CliContext): void {
  const c = program.command("calling-v1").description("Legacy /calling/v1 API");
  c.command("status").argument("<callId>").action(async (callId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(callId, "callId");
    const res = await client.request(`/calling/v1/dispositions/${seg}`);
    printResult(ctx, res);
  });
}

// ── Channels (root-level channel inventory) ───────────────────────────────
export function registerChannels(program: Command, getCtx: () => CliContext): void {
  const c = program.command("channels").description("Root channel inventory (cross-cutting helper)");
  c.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/channels/v1/channels`);
    printResult(ctx, res);
  });
}
