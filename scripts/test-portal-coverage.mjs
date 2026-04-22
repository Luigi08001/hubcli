#!/usr/bin/env node
// Portal coverage probe — read-only smoke test of every scraped HubSpot endpoint
// against the connected portal (defaults to the `default` profile in ~/.hscli).
//
// Usage:
//   node scripts/test-portal-coverage.mjs > report.md
//
// Categories in the output:
//   PASS         — 2xx response
//   TIER         — 403 tier-locked (paid/enterprise feature)
//   AUTH         — 401 unauthorized (scope missing on the token)
//   404          — endpoint exists but resource not found (needs ID substitution)
//   METHOD       — 405 wrong method (scrape imprecision)
//   400          — bad request (scrape imprecision or missing query params)
//   429          — rate limited
//   5XX          — HubSpot server error
//   SKIP-PARAM   — path has unresolved {param}; dynamic IDs not available
//   ERROR        — network/timeout
//
// This script intentionally does NOT perform any writes. It samples GETs only
// (and a handful of safe POST search endpoints that don't mutate state).

import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const PORTAL_PROFILE = process.env.HSCLI_PROFILE || "default";
const API_BASE = "https://api.hubapi.com";
const CONCURRENCY = 4;
const TIMEOUT_MS = 20_000;
// Location of the HubSpot endpoints scrape used to drive the probe. Default
// is the author's private vault path, but any contributor can point this at
// their own scrape via HSCLI_ENDPOINTS_JSON env var.
const ENDPOINTS_JSON = process.env.HSCLI_ENDPOINTS_JSON || `${homedir()}/Desktop/vault/HubSpot Audit/api-mapping/endpoints.json`;

const authPath = `${homedir()}/.hscli/auth.json`;
const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
const profile = auth.profiles ? auth.profiles[PORTAL_PROFILE] : auth[PORTAL_PROFILE] || auth.default || auth;
const token = profile.token || profile.accessToken;
const portalId = profile.portalId;
if (!token) throw new Error(`No token found in ${authPath} for profile ${PORTAL_PROFILE}`);

console.error(`[probe] portal=${portalId} profile=${PORTAL_PROFILE}`);

const eps = JSON.parse(fs.readFileSync(ENDPOINTS_JSON, "utf8")).endpoints;
console.error(`[probe] scrape has ${eps.length} endpoints`);

// Cache of resolved param values (discovered dynamically from GET list calls)
const dynamicIds = {};

async function discoverIds() {
  // List-and-cache-first-id for every "natural" list endpoint we know works.
  // This eliminates most false 404s caused by the probe using `0` as a placeholder.
  const list = async (url) => {
    try {
      const r = await fetch(`${API_BASE}${url}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) return null;
      const j = await r.json();
      const first = j.results?.[0] || j.objects?.[0] || j.contacts?.[0] || j[Object.keys(j)[0]]?.[0];
      return first;
    } catch { return null; }
  };

  const probes = [
    ["contactId", "/crm/v3/objects/contacts?limit=1", "id"],
    ["companyId", "/crm/v3/objects/companies?limit=1", "id"],
    ["dealId", "/crm/v3/objects/deals?limit=1", "id"],
    ["ticketId", "/crm/v3/objects/tickets?limit=1", "id"],
    ["ownerId", "/crm/v3/owners?limit=1", "id"],
    ["pipelineId", "/crm/v3/pipelines/deals", "id"],
    ["emailId", "/marketing/v3/emails?limit=1", "id"],
    ["campaignId", "/marketing/v3/campaigns?limit=1", "id"],
    ["fileId", "/files/v3/files/search?limit=1", "id"],
    ["folderId", "/files/v3/folders?limit=1", "id"],
    ["listId", "/crm/v3/lists/folders?limit=1", "id"],
    ["userId", "/settings/v3/users?limit=1", "id"],
    ["formGuid", "/marketing/v3/forms?limit=1", "id"],
    ["formId", "/marketing/v3/forms?limit=1", "id"],
    ["domainId", "/cms/v3/domains?limit=1", "id"],
    ["topicId", "/cms/v3/topics?limit=1", "id"],
    ["tableId", "/cms/v3/hubdb/tables?limit=1", "id"],
    ["postId", "/cms/v3/blogs/posts?limit=1", "id"],
    ["pageId", "/cms/v3/pages/site-pages?limit=1", "id"],
    ["authorId", "/cms/v3/blogs/authors?limit=1", "id"],
    ["tagId", "/cms/v3/blogs/tags?limit=1", "id"],
    ["flowId", "/automation/v4/flows?limit=1", "id"],
    ["noteId", "/crm/v3/objects/notes?limit=1", "id"],
    ["taskId", "/crm/v3/objects/tasks?limit=1", "id"],
    ["callId", "/crm/v3/objects/calls?limit=1", "id"],
    ["meetingId", "/crm/v3/objects/meetings?limit=1", "id"],
    ["quoteId", "/crm/v3/objects/quotes?limit=1", "id"],
    ["productId", "/crm/v3/objects/products?limit=1", "id"],
    ["lineItemId", "/crm/v3/objects/line_items?limit=1", "id"],
    ["invoiceId", "/crm/v3/objects/invoices?limit=1", "id"],
    ["subscriptionId", "/crm/v3/objects/subscriptions?limit=1", "id"],
    ["paymentId", "/crm/v3/objects/payments?limit=1", "id"],
    ["goalId", "/crm/v3/objects/goals?limit=1", "id"],
    ["leadId", "/crm/v3/objects/leads?limit=1", "id"],
    ["orderId", "/crm/v3/objects/orders?limit=1", "id"],
    ["cartId", "/crm/v3/objects/carts?limit=1", "id"],
    ["feedbackId", "/crm/v3/objects/feedback_submissions?limit=1", "id"],
    ["customObjectId", "/crm/v3/schemas?limit=1", "objectTypeId"],
    ["threadId", "/conversations/v3/conversations/threads?limit=1", "id"],
    ["channelId", "/conversations/v3/conversations/channels?limit=1", "id"],
    ["inboxId", "/conversations/v3/conversations/inboxes?limit=1", "id"],
    ["chatflowId", "/conversations/v3/chatflows?limit=1", "id"],
    ["importId", "/crm/v3/imports?limit=1", "id"],
    ["webhookId", "/webhooks/v3/subscriptions?limit=1", "id"],
    ["businessUnitId", "/settings/v3/business-units?limit=1", "id"],
    ["teamId", "/settings/v3/users/teams?limit=1", "id"],
    ["groupName", "/crm/v3/properties/contacts/groups?limit=1", "name"],
    ["landingPageId", "/cms/v3/pages/landing-pages?limit=1", "id"],
    ["sitePageId", "/cms/v3/pages/site-pages?limit=1", "id"],
    ["redirectId", "/cms/v3/url-redirects?limit=1", "id"],
    ["tableIdOrName", "/cms/v3/hubdb/tables?limit=1", "id"],
    ["campaignGuid", "/marketing/v3/campaigns?limit=1", "id"],
    ["marketingEventId", "/marketing/v3/marketing-events?limit=1", "id"],
    ["workflowId", "/automation/v4/flows?limit=1", "id"],
    ["blogId", "/cms/v3/blogs/posts?limit=1", "contentGroupId"],
  ];

  // Also proper crm list discovery (the "list" object, not folders)
  try {
    const r = await fetch(`${API_BASE}/crm/v3/lists/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });
    if (r.ok) {
      const j = await r.json();
      const first = j.lists?.[0];
      if (first?.listId) dynamicIds["{listId}"] = String(first.listId);
    }
  } catch {}

  await Promise.all(probes.map(async ([name, url, field]) => {
    const item = await list(url);
    if (item && item[field]) dynamicIds[`{${name}}`] = String(item[field]);
    else if (item && item.guid) dynamicIds[`{${name}}`] = String(item.guid);
  }));

  // Sales sequences needs userId query; try to find sequences via any owner userId
  if (dynamicIds["{ownerId}"]) {
    try {
      const r = await fetch(`${API_BASE}/automation/v4/sequences?userId=${dynamicIds["{ownerId}"]}&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) {
        const j = await r.json();
        const first = j.results?.[0];
        if (first?.id) dynamicIds["{sequenceId}"] = String(first.id);
      }
    } catch {}
  }

  // Legacy v1/v2 IDs
  if (dynamicIds["{contactId}"]) dynamicIds["{vid}"] = dynamicIds["{contactId}"];

  console.error(`[probe] discovered dynamic IDs:`, Object.keys(dynamicIds).length);
  for (const [k, v] of Object.entries(dynamicIds)) console.error(`        ${k.padEnd(15)} = ${v}`);
}

// Known safe substitutions for path segments we can't easily discover
// If HSCLI_DEV_APP_ID is set, use it for {appId} substitution (unlocks dev-platform endpoints
// for an OAuth-installed Developer App). Otherwise fall back to "0" which will 401/403/404 as expected.
const DEV_APP_ID = process.env.HSCLI_DEV_APP_ID || "0";

const KNOWN_SUBS = {
  "{appId}": DEV_APP_ID,
  "{applicationId}": DEV_APP_ID,
  "{definitionId}": "0",
  "{revisionId}": "0",
  "{functionType}": "PRE_FETCH_OPTIONS",
  "{functionId}": "primary",
  "{cardId}": "0",
  "{flagName}": "__hscli_probe_flag",
  "{fromObjectType}": "contacts",
  "{toObjectType}": "companies",
  "{fromObjectId}": "0",
  "{toObjectId}": "0",
  "{associationTypeId}": "1",
  "{formId}": "00000000-0000-0000-0000-000000000000",
  "{formGuid}": "00000000-0000-0000-0000-000000000000",
  "{portalId}": String(portalId || "0"),
  "{emailId}": "0",
  "{campaignId}": "0",
  "{subscriptionId}": "0",
  "{sequenceId}": "0",
  "{enrollmentId}": "0",
  "{flowId}": "0",
  "{meetingId}": "0",
  "{fileId}": "0",
  "{folderId}": "0",
  "{domainId}": "0",
  "{reportId}": "0",
  "{topicId}": "0",
  "{postId}": "0",
  "{pageId}": "0",
  "{authorId}": "0",
  "{tagId}": "0",
  "{tableId}": "0",
  "{eventId}": "0",
  "{invoiceId}": "0",
  "{quoteId}": "0",
  "{orderId}": "0",
  "{dealId}": "0",
  "{contactId}": "0",
  "{companyId}": "0",
  "{ticketId}": "0",
  "{listId}": "0",
  "{channelId}": "0",
  "{inboxId}": "0",
  "{threadId}": "0",
  "{messageId}": "0",
  "{actorId}": "A-0",
  "{externalEventId}": "0",
  "{state}": "register",
  "{subscriberState}": "register",
  "{userId}": "0",
  "{ownerId}": "0",
  "{groupName}": "companyinformation",
  "{propertyName}": "email",
  "{objectType}": "contacts",
  "{objectTypeId}": "0-1",
  "{objectId}": "0",
  "{id}": "0",
  "{name}": "email",
  "{slug}": "probe",
  "{bookingId}": "0",
  "{taxId}": "0",
  "{importId}": "0",
  "{exportId}": "0",
  "{feedId}": "0",
  "{pipelineId}": "0",
  "{stageId}": "0",
  "{eventType}": "pe0_click",
  "{eventTypeId}": "0",
  "{tokenName}": "email",
  "{language}": "en",
  "{variant}": "A",
  "{categoryId}": "0",
  "{path}": "theme/css/main.css",
  "{environment}": "published",
  "{utk}": "0",
  "{email}": "probe@hscli-probe.invalid",
  "{created}": String(Date.now()),
  "{channelAccountId}": "0",
  "{broadcastId}": "0",
  "{cartId}": "0",
  "{discountId}": "0",
  "{feeId}": "0",
  "{communicationId}": "0",
  "{leadId}": "0",
  "{engagementId}": "0",
  "{noteId}": "0",
  "{taskId}": "0",
  "{callId}": "0",
  "{templateId}": "0",
};

// Paths in the scrape with placeholders like `{0}`, `{3}`, `{162}`, `{410}` are
// scraping artifacts where HTTP status codes or sample ints leaked into path
// templates. Skip them cleanly rather than marking SKIP-PARAM.
function isScrapeArtifact(p) {
  return /\{\d+\}/.test(p);
}

function substitutePath(p) {
  if (isScrapeArtifact(p)) return { path: p, leftover: ["<scrape-artifact>"] };
  let result = p;
  const leftover = [];
  // Detect {objectType} earlier in the path — use it to route {objectId} to the right dynamic id
  const m = p.match(/\/objects\/([a-z_-]+)/);
  const objectTypeFromPath = m ? m[1] : null;
  const objectTypeIdMap = {
    "contacts": "{contactId}", "companies": "{companyId}", "deals": "{dealId}",
    "tickets": "{ticketId}", "meetings": "{meetingId}", "notes": "{noteId}",
    "tasks": "{taskId}", "calls": "{callId}", "products": "{productId}",
    "line_items": "{lineItemId}", "quotes": "{quoteId}", "leads": "{leadId}",
  };

  result = result.replace(/\{[^}]+\}/g, (match) => {
    // Dynamic IDs take priority (real portal data)
    if (dynamicIds[match] != null) return encodeURIComponent(dynamicIds[match]);
    // {objectId} fallback: if path has /objects/{objectType}, use the matching dynamic id
    if (match === "{objectId}" && objectTypeFromPath) {
      const hintedId = objectTypeIdMap[objectTypeFromPath];
      if (hintedId && dynamicIds[hintedId] != null) return encodeURIComponent(dynamicIds[hintedId]);
    }
    // {id} fallback: use contactId as the generic "some-real-id" default
    if (match === "{id}" && dynamicIds["{contactId}"]) return encodeURIComponent(dynamicIds["{contactId}"]);
    if (KNOWN_SUBS[match] != null) return encodeURIComponent(KNOWN_SUBS[match]);
    leftover.push(match);
    return match;
  });
  return { path: result, leftover };
}

// Classify a response code → bucket
function classify(status, bodyText) {
  if (status === 429) return "429";
  if (status >= 500) return "5XX";
  if (status >= 200 && status < 300) return "PASS";
  if (status === 401) return "AUTH";
  if (status === 403) {
    // Tier-locked vs missing scope — use body heuristic
    if (/tier|plan|feature|subscription|not available/i.test(bodyText || "")) return "TIER";
    return "AUTH";
  }
  if (status === 404) return "404";
  if (status === 405) return "METHOD";
  if (status === 400) return "400";
  return `HTTP_${status}`;
}

// Only probe GETs (read-only) + explicit safe POST-search endpoints
function isSafeEndpoint(ep) {
  if (ep.method === "GET") return true;
  if (ep.method === "POST" && /\/search(\?.*)?$/.test(ep.path) && !/\/create|\/update|\/archive|\/delete|\/cancel|\/send|\/publish|\/unpublish|\/restore|\/clone|\/import|\/export|\/batch-(create|update|archive|upsert)/.test(ep.path)) return true;
  return false;
}

// Fire one probe; return category + status + short body snippet
async function probe(ep) {
  const { path: resolvedPath, leftover } = substitutePath(ep.path);
  if (leftover.length > 0) {
    return { category: "SKIP-PARAM", status: 0, note: `unresolved: ${leftover.join(",")}`, ep };
  }
  const url = `${API_BASE}${resolvedPath}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const init = { method: ep.method, signal: ctrl.signal, headers: { Authorization: `Bearer ${token}` } };
    // For POST /search, send empty body
    if (ep.method === "POST") {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify({ limit: 1 });
    }
    const r = await fetch(url, init);
    clearTimeout(timer);
    const bodyText = await r.text().catch(() => "");
    const category = classify(r.status, bodyText);
    return { category, status: r.status, note: bodyText.slice(0, 200).replace(/\s+/g, " "), ep };
  } catch (e) {
    clearTimeout(timer);
    return { category: "ERROR", status: 0, note: e.name === "AbortError" ? "timeout" : e.message, ep };
  }
}

async function main() {
  console.error(`[probe] discovering real IDs...`);
  await discoverIds();

  const candidates = eps.filter(isSafeEndpoint);
  console.error(`[probe] ${candidates.length} read-only candidates (of ${eps.length} total)`);

  const results = [];
  let done = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const next = candidates.shift();
      if (!next) break;
      const res = await probe(next);
      results.push(res);
      done++;
      if (done % 25 === 0) console.error(`[probe] ${done} / ${done + candidates.length}`);
      // Be polite — respect rate limit
      if (res.status === 429) await sleep(500);
      else await sleep(20);
    }
  });
  await Promise.all(workers);

  // Aggregate
  const counts = new Map();
  const byModule = new Map();
  for (const r of results) {
    counts.set(r.category, (counts.get(r.category) || 0) + 1);
    const mod = r.ep.module || "other";
    if (!byModule.has(mod)) byModule.set(mod, new Map());
    byModule.get(mod).set(r.category, (byModule.get(mod).get(r.category) || 0) + 1);
  }

  // Emit Markdown report on stdout
  const gitSha = (() => {
    try {
      return (fs.readFileSync(".git/HEAD", "utf8").trim().startsWith("ref:")
        ? fs.readFileSync(`.git/${fs.readFileSync(".git/HEAD","utf8").trim().slice(5)}`, "utf8").trim().slice(0,7)
        : fs.readFileSync(".git/HEAD","utf8").trim().slice(0,7));
    } catch { return "unknown"; }
  })();
  const now = new Date().toISOString();
  const ORDER = ["PASS", "TIER", "AUTH", "404", "METHOD", "400", "429", "5XX", "SKIP-PARAM", "ERROR"];

  let md = "";
  md += `# Portal Coverage Probe — 147975758 (EU1, free tier)\n\n`;
  md += `Generated: ${now}  •  hscli @ ${gitSha}  •  profile: \`${PORTAL_PROFILE}\`\n\n`;
  md += `Probed ${results.length} read-only endpoints of ${eps.length} total HubSpot API endpoints (only GET + safe POST /search).\n\n`;
  md += `## Summary\n\n| Category | Count | % |\n|---|---:|---:|\n`;
  for (const k of ORDER) {
    if (!counts.has(k)) continue;
    const c = counts.get(k);
    md += `| **${k}** | ${c} | ${(c/results.length*100).toFixed(1)}% |\n`;
  }
  md += `\n## Legend\n\n`;
  md += `- **PASS** — 2xx, endpoint fully accessible on the portal\n`;
  md += `- **TIER** — 403 from a paid/enterprise feature; token is OK, portal plan isn't\n`;
  md += `- **AUTH** — 401/403 from missing scope on the Private App token\n`;
  md += `- **404** — endpoint exists but probe used a placeholder ID (substitution used \`0\` or similar)\n`;
  md += `- **METHOD** — 405, scrape metadata listed wrong verb\n`;
  md += `- **400** — bad request, typically missing required query parameter\n`;
  md += `- **429** — rate limit hit; retry count is in the detailed section\n`;
  md += `- **5XX** — HubSpot server error\n`;
  md += `- **SKIP-PARAM** — path has unresolved \`{param}\` (nested list discovery needed)\n`;
  md += `- **ERROR** — network/timeout\n\n`;

  md += `## Per-module breakdown\n\n`;
  const modules = [...byModule.keys()].sort();
  md += `| Module | Probed | ` + ORDER.join(" | ") + ` |\n`;
  md += `|---|---:|` + ORDER.map(() => "---:|").join("") + `\n`;
  for (const m of modules) {
    const modCounts = byModule.get(m);
    const total = [...modCounts.values()].reduce((s,n)=>s+n,0);
    let row = `| ${m} | ${total} |`;
    for (const k of ORDER) row += ` ${modCounts.get(k) || ""} |`;
    md += row + "\n";
  }

  md += `\n## Endpoints by category (non-PASS, up to 30 each)\n\n`;
  for (const k of ORDER) {
    if (k === "PASS") continue;
    const rs = results.filter(r => r.category === k);
    if (!rs.length) continue;
    md += `### ${k} (${rs.length} endpoints)\n\n`;
    for (const r of rs.slice(0, 30)) {
      md += `- \`${r.ep.method} ${r.ep.path}\``;
      if (r.status) md += ` → **${r.status}**`;
      if (r.note) md += `  _${r.note.slice(0, 140)}_`;
      md += "\n";
    }
    if (rs.length > 30) md += `\n_(+${rs.length - 30} more)_\n`;
    md += "\n";
  }

  md += `\n## PASS endpoints (first 60)\n\n`;
  const passList = results.filter(r => r.category === "PASS");
  for (const r of passList.slice(0, 60)) {
    md += `- \`${r.ep.method} ${r.ep.path}\`\n`;
  }
  if (passList.length > 60) md += `\n_(+${passList.length - 60} more)_\n`;

  console.log(md);
  console.error(`[probe] done — ${results.length} endpoints probed`);
  console.error(`[probe] category breakdown:`);
  for (const k of ORDER) if (counts.has(k)) console.error(`  ${k.padEnd(12)} ${counts.get(k)}`);
}

main().catch((e) => {
  console.error("[probe] fatal:", e);
  process.exit(1);
});
