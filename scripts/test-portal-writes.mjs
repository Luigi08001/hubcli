#!/usr/bin/env node
// Write probe — enumerate every POST/PUT/PATCH/DELETE in the HubSpot scrape
// and hit each one against the connected portal. Unlike the read probe, this
// script focuses on **reachability**, not "does my guessed payload work":
//
//   PASS       — 2xx returned (write succeeded with our minimal body)
//   CONFLICT   — 409 (duplicate — endpoint works, resource already exists)
//   VALIDATION — 400 (endpoint is reachable + authenticated; body is wrong)
//                this counts as "headless-accessible" because the CLI user
//                controls the body via `--data`
//   AUTH       — 401/403 (true zombie: legacy hapikey-only or missing scope)
//   404        — path not found (scrape stale OR portal feature missing)
//   METHOD     — 405 (scrape listed wrong verb)
//   429        — rate limited
//   5XX        — server error
//   SKIP-PARAM — unresolved {param}
//   SKIP-ARTIFACT — scrape artifact like /{0}
//
// The write probe never crashes and never spams — it sends minimal empty-ish
// bodies, uses runSuffix for uniqueness, and tags all created records so they
// can be cleaned up later. Cleanup is intentionally NOT automated: we leave
// the probe-created records in place so the follow-up read probe benefits
// from them.

import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";

const PORTAL_PROFILE = process.env.HSCLI_PROFILE || "default";
const API_BASE = "https://api.hubapi.com";
const CONCURRENCY = 3;
const TIMEOUT_MS = 20_000;
// See scripts/test-portal-coverage.mjs — set HSCLI_ENDPOINTS_JSON to point
// at your own scrape.
const ENDPOINTS_JSON = process.env.HSCLI_ENDPOINTS_JSON || `${homedir()}/Desktop/vault/HubSpot Audit/api-mapping/endpoints.json`;
const DEV_APP_ID = process.env.HSCLI_DEV_APP_ID || "0";
const RUN_SUFFIX = Date.now().toString(36).slice(-5);

const authPath = `${homedir()}/.hscli/auth.json`;
const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
const profile = auth.profiles ? auth.profiles[PORTAL_PROFILE] : auth[PORTAL_PROFILE] || auth.default || auth;
const token = profile.token || profile.accessToken;
const portalId = profile.portalId;

console.error(`[write-probe] portal=${portalId} profile=${PORTAL_PROFILE} runSuffix=${RUN_SUFFIX}`);

const eps = JSON.parse(fs.readFileSync(ENDPOINTS_JSON, "utf8")).endpoints;

// ──────────────────────────────────────────────────────────────────────────
// Dynamic ID discovery (same as read probe, keeps these in sync)
// ──────────────────────────────────────────────────────────────────────────
const dynamicIds = {};

async function discoverIds() {
  const fetchList = async (url, field = "id") => {
    try {
      const r = await fetch(`${API_BASE}${url}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
      if (!r.ok) return null;
      const j = await r.json();
      const first = j.results?.[0] || j.objects?.[0] || j.lists?.[0];
      return first?.[field];
    } catch { return null; }
  };

  const probes = [
    ["contactId", "/crm/v3/objects/contacts?limit=1"],
    ["companyId", "/crm/v3/objects/companies?limit=1"],
    ["dealId", "/crm/v3/objects/deals?limit=1"],
    ["ticketId", "/crm/v3/objects/tickets?limit=1"],
    ["ownerId", "/crm/v3/owners?limit=1"],
    ["pipelineId", "/crm/v3/pipelines/deals"],
    ["emailId", "/marketing/v3/emails?limit=1"],
    ["fileId", "/files/v3/files/search?limit=1"],
    ["folderId", "/files/v3/folders?limit=1"],
    ["userId", "/settings/v3/users?limit=1"],
    ["formGuid", "/marketing/v3/forms?limit=1"],
    ["formId", "/marketing/v3/forms?limit=1"],
    ["domainId", "/cms/v3/domains?limit=1"],
    ["topicId", "/cms/v3/topics?limit=1"],
    ["tableId", "/cms/v3/hubdb/tables?limit=1"],
    ["tableIdOrName", "/cms/v3/hubdb/tables?limit=1"],
    ["pageId", "/cms/v3/pages/site-pages?limit=1"],
    ["sitePageId", "/cms/v3/pages/site-pages?limit=1"],
    ["landingPageId", "/cms/v3/pages/landing-pages?limit=1"],
    ["authorId", "/cms/v3/blogs/authors?limit=1"],
    ["tagId", "/cms/v3/blogs/tags?limit=1"],
    ["flowId", "/automation/v4/flows?limit=1"],
    ["workflowId", "/automation/v4/flows?limit=1"],
    ["noteId", "/crm/v3/objects/notes?limit=1"],
    ["taskId", "/crm/v3/objects/tasks?limit=1"],
    ["callId", "/crm/v3/objects/calls?limit=1"],
    ["meetingId", "/crm/v3/objects/meetings?limit=1"],
    ["quoteId", "/crm/v3/objects/quotes?limit=1"],
    ["productId", "/crm/v3/objects/products?limit=1"],
    ["lineItemId", "/crm/v3/objects/line_items?limit=1"],
    ["leadId", "/crm/v3/objects/leads?limit=1"],
    ["redirectId", "/cms/v3/url-redirects?limit=1"],
  ];
  await Promise.all(probes.map(async ([name, url]) => {
    const id = await fetchList(url);
    if (id) dynamicIds[`{${name}}`] = String(id);
  }));

  // List v3 via search
  try {
    const r = await fetch(`${API_BASE}/crm/v3/lists/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });
    if (r.ok) {
      const j = await r.json();
      if (j.lists?.[0]?.listId) dynamicIds["{listId}"] = String(j.lists[0].listId);
    }
  } catch {}

  // Blog contentGroupId
  try {
    const r = await fetch(`${API_BASE}/cms/v3/blogs/posts?limit=1`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const j = await r.json();
      if (j.results?.[0]?.contentGroupId) dynamicIds["{blogId}"] = String(j.results[0].contentGroupId);
    }
  } catch {}

  console.error(`[write-probe] discovered ${Object.keys(dynamicIds).length} dynamic IDs`);
}

const KNOWN_SUBS = {
  "{appId}": DEV_APP_ID,
  "{applicationId}": DEV_APP_ID,
  "{portalId}": String(portalId || "0"),
  "{fromObjectType}": "contacts",
  "{toObjectType}": "companies",
  "{objectType}": "contacts",
  "{objectTypeId}": "0-1",
  "{associationTypeId}": "1",
  "{state}": "register",
  "{subscriberState}": "register",
  "{environment}": "draft",
  "{path}": "probe.css",
  "{name}": "probe_field",
  "{propertyName}": "email",
  "{groupName}": "companyinformation",
  "{slug}": `hscli-probe-${RUN_SUFFIX}`,
  "{email}": `probe-${RUN_SUFFIX}@hscli-probe.invalid`,
  "{utk}": "0",
  "{language}": "en",
  "{eventType}": "pe0_click",
  "{eventTypeId}": "0",
  "{tokenName}": "email",
  "{functionType}": "PRE_FETCH_OPTIONS",
  "{functionId}": "primary",
  "{flagName}": `__hscli_probe_flag_${RUN_SUFFIX}`,
  "{cardId}": "0",
  "{definitionId}": "0",
  "{revisionId}": "0",
  "{eventTemplateId}": "0",
  "{variant}": "A",
  "{channelAccountId}": "0",
  "{broadcastId}": "0",
  "{categoryId}": "0",
  "{rowId}": "0",
  "{cartId}": "0",
  "{discountId}": "0",
  "{feeId}": "0",
  "{communicationId}": "0",
  "{orderId}": "0",
  "{reportId}": "0",
  "{subscriptionId}": "0",
  "{paymentId}": "0",
  "{goalId}": "0",
  "{invoiceId}": "0",
  "{campaignId}": "0",
  "{campaignGuid}": "00000000-0000-0000-0000-000000000000",
  "{sequenceId}": "0",
  "{enrollmentId}": "0",
  "{webhookId}": "0",
  "{importId}": "0",
  "{exportId}": "0",
  "{feedId}": "0",
  "{stageId}": "0",
  "{customPropertyName}": "email",
  "{externalEventId}": "0",
  "{externalAccountId}": "0",
  "{marketingEventId}": "0",
  "{externalContactId}": "0",
  "{created}": String(Date.now()),
  "{from}": "0",
  "{taskId}": "0",
  "{id}": "0",
};

function isScrapeArtifact(p) { return /\{\d+\}/.test(p); }

function substitutePath(p) {
  if (isScrapeArtifact(p)) return { path: p, leftover: ["<artifact>"] };
  const objectMatch = p.match(/\/objects\/([a-z_-]+)/);
  const objectType = objectMatch ? objectMatch[1] : null;
  const objectTypeIdMap = {
    "contacts": "{contactId}", "companies": "{companyId}", "deals": "{dealId}",
    "tickets": "{ticketId}", "meetings": "{meetingId}", "notes": "{noteId}",
    "tasks": "{taskId}", "calls": "{callId}", "products": "{productId}",
    "line_items": "{lineItemId}", "quotes": "{quoteId}", "leads": "{leadId}",
  };
  const leftover = [];
  const result = p.replace(/\{[^}]+\}/g, (m) => {
    if (dynamicIds[m] != null) return encodeURIComponent(dynamicIds[m]);
    if (m === "{objectId}" && objectType) {
      const hint = objectTypeIdMap[objectType];
      if (hint && dynamicIds[hint]) return encodeURIComponent(dynamicIds[hint]);
    }
    if (m === "{id}" && dynamicIds["{contactId}"]) return encodeURIComponent(dynamicIds["{contactId}"]);
    if (KNOWN_SUBS[m] != null) return encodeURIComponent(KNOWN_SUBS[m]);
    leftover.push(m);
    return m;
  });
  return { path: result, leftover };
}

// ──────────────────────────────────────────────────────────────────────────
// Body generator — produce a minimal plausible body for each write
// ──────────────────────────────────────────────────────────────────────────
function generateBody(ep) {
  const p = ep.path;

  // Batch endpoints — inputs array
  if (/\/batch[/-](read|archive|create|update|upsert)/.test(p)) {
    if (/batch[/-]read/.test(p)) return { inputs: dynamicIds["{contactId}"] ? [{ id: dynamicIds["{contactId}"] }] : [] };
    if (/batch[/-]archive/.test(p)) return { inputs: [] };
    return { inputs: [] };
  }

  // Search endpoints
  if (/\/search$/.test(p)) return { limit: 1 };

  // /crm/v3/objects/{objectType} POST (create)
  if (/\/crm\/v[34]\/objects\/[a-z_]+$/.test(p) && ep.method === "POST") {
    return { properties: { [/contacts|leads/.test(p) ? "email" : "name"]: `probe-${RUN_SUFFIX}@example.invalid` } };
  }

  // Property groups create
  if (/\/properties\/[a-z_]+\/groups$/.test(p) && ep.method === "POST") {
    return { name: `hscli_probe_${RUN_SUFFIX}`, label: "Probe", displayOrder: -1 };
  }

  // Properties create
  if (/\/properties\/[a-z_]+$/.test(p) && ep.method === "POST") {
    return { name: `hscli_probe_${RUN_SUFFIX}`, label: "Probe", type: "string", fieldType: "text", groupName: "contactinformation" };
  }

  // URL redirects
  if (/\/url-redirects$/.test(p) && ep.method === "POST") {
    return { routePrefix: `/probe-${RUN_SUFFIX}`, destination: "https://hscli.dev", redirectStyle: 301, precedence: 100 };
  }

  // Lists create
  if (p === "/crm/v3/lists" && ep.method === "POST") {
    return { name: `hscli_probe_list_${RUN_SUFFIX}`, processingType: "MANUAL", objectTypeId: "0-1" };
  }

  // Timeline event templates
  if (/\/timeline\/event-templates$/.test(p)) {
    return { name: `hscli_probe_${RUN_SUFFIX}`, objectType: "contacts", headerTemplate: "H", detailTemplate: "D" };
  }

  // HubDB tables
  if (p === "/cms/v3/hubdb/tables" && ep.method === "POST") {
    return { name: `hscli_probe_table_${RUN_SUFFIX}`, label: "Probe", useForPages: false, columns: [{ name: "key", label: "Key", type: "TEXT" }] };
  }

  // Webhooks subscriptions
  if (/\/webhooks\/v3\/[^/]+\/subscriptions$/.test(p) && ep.method === "POST") {
    return { eventType: "contact.creation", active: false };
  }

  // Forms
  if (p === "/marketing/v3/forms/" || p === "/marketing/v3/forms") {
    return { name: `probe-form-${RUN_SUFFIX}`, formType: "hubspot", fieldGroups: [], configuration: { language: "en" } };
  }

  // Email / SMTP
  if (/\/transactional\/single-email\/send$/.test(p)) return { emailId: 0, message: { to: `probe@example.invalid` } };

  // Marketing events attendance
  if (/\/marketing-events\/attendance\//.test(p)) return { inputs: [] };

  // Associations
  if (/\/associations\/v\d.*\/labels$/.test(p) && ep.method === "POST") return { label: `probe_${RUN_SUFFIX}`, name: `probe_${RUN_SUFFIX}` };

  // Default: empty object
  return {};
}

// Classify response → bucket
function classify(status, bodyText) {
  if (status === 429) return "429";
  if (status >= 500) return "5XX";
  if (status >= 200 && status < 300) return "PASS";
  if (status === 409) return "CONFLICT";
  if (status === 401) return "AUTH";
  if (status === 403) {
    if (/tier|plan|feature|subscription|not available/i.test(bodyText || "")) return "TIER";
    if (/hapikey|developer API key/i.test(bodyText || "")) return "ZOMBIE";
    return "AUTH";
  }
  if (status === 404) return "404";
  if (status === 405) return "METHOD";
  if (status === 400) {
    // 400 often means "endpoint reached you, body invalid" — that's accessible
    return "VALIDATION";
  }
  return `HTTP_${status}`;
}

// Should we skip this endpoint for safety? (truly destructive or one-way)
function shouldSkip(ep) {
  // Skip mass deletes / portal-wide destructive ops
  if (/\/portal-delete|\/gdpr-delete.*\/ALL/.test(ep.path)) return true;
  // Skip if our token can't do anything with it (legacy settings write)
  return false;
}

async function hitOnce(method, url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const init = {
      method,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    };
    if (method !== "DELETE" && method !== "GET" && body !== undefined) init.body = JSON.stringify(body);
    const r = await fetch(url, init);
    clearTimeout(timer);
    const text = await r.text().catch(() => "");
    // Parse Allow header on 405 to retry with the correct verb
    const allow = r.headers.get("allow") || r.headers.get("Allow") || "";
    return { status: r.status, text, allow };
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, text: e.name === "AbortError" ? "timeout" : e.message, allow: "" };
  }
}

async function probeWrite(ep) {
  if (shouldSkip(ep)) return { category: "SKIP-UNSAFE", status: 0, note: "skipped for safety", ep };

  const { path: resolvedPath, leftover } = substitutePath(ep.path);
  if (leftover.length > 0) {
    const why = leftover[0] === "<artifact>" ? "SKIP-ARTIFACT" : "SKIP-PARAM";
    return { category: why, status: 0, note: `unresolved: ${leftover.join(",")}`, ep };
  }

  const url = `${API_BASE}${resolvedPath}`;
  const body = generateBody(ep);
  let first = await hitOnce(ep.method, url, body);

  // Auto-retry on 405: try the Allow header's first write-like verb if present,
  // otherwise cycle through {POST, PATCH, PUT, DELETE} except the one we tried.
  let retried = false;
  let actualMethod = ep.method;
  if (first.status === 405) {
    const candidates = first.allow
      ? first.allow.split(",").map(s => s.trim().toUpperCase()).filter(m => m && m !== ep.method && m !== "OPTIONS" && m !== "HEAD")
      : ["POST", "PATCH", "PUT", "DELETE"].filter(m => m !== ep.method);
    for (const m of candidates) {
      const r = await hitOnce(m, url, body);
      if (r.status !== 405) {
        first = r;
        actualMethod = m;
        retried = true;
        break;
      }
    }
  }

  const category = classify(first.status, first.text);
  const note = first.text.slice(0, 180).replace(/\s+/g, " ");
  return {
    category,
    status: first.status,
    note: retried ? `[auto-retried as ${actualMethod}] ${note}` : note,
    ep: retried ? { ...ep, method: `${ep.method}→${actualMethod}` } : ep,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  await discoverIds();

  // Probe all writes. Explicitly include DELETE/PATCH/PUT/POST (non-search).
  const candidates = eps.filter(e => {
    if (e.method === "GET") return false; // handled by read probe
    if (e.method === "POST" && /\/search$/.test(e.path) && !/batch/.test(e.path)) return false;
    return true;
  });
  console.error(`[write-probe] ${candidates.length} write candidates (of ${eps.length} total)`);

  const results = [];
  let done = 0;
  const queue = [...candidates];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) break;
      const r = await probeWrite(next);
      results.push(r);
      done++;
      if (done % 50 === 0) console.error(`[write-probe] ${done} / ${candidates.length}`);
      if (r.status === 429) await sleep(800);
      else await sleep(30);
    }
  });
  await Promise.all(workers);

  const counts = new Map();
  const byModule = new Map();
  const byMethod = new Map();
  for (const r of results) {
    counts.set(r.category, (counts.get(r.category) || 0) + 1);
    const mod = r.ep.module || "other";
    if (!byModule.has(mod)) byModule.set(mod, new Map());
    byModule.get(mod).set(r.category, (byModule.get(mod).get(r.category) || 0) + 1);
    const method = r.ep.method;
    if (!byMethod.has(method)) byMethod.set(method, new Map());
    byMethod.get(method).set(r.category, (byMethod.get(method).get(r.category) || 0) + 1);
  }

  const ORDER = ["PASS", "CONFLICT", "VALIDATION", "AUTH", "ZOMBIE", "TIER", "404", "METHOD", "400", "429", "5XX", "SKIP-PARAM", "SKIP-ARTIFACT", "SKIP-UNSAFE", "ERROR"];
  const now = new Date().toISOString();
  const gitSha = (() => {
    try {
      const head = fs.readFileSync(".git/HEAD", "utf8").trim();
      if (head.startsWith("ref:")) return fs.readFileSync(`.git/${head.slice(5)}`, "utf8").trim().slice(0, 7);
      return head.slice(0, 7);
    } catch { return "unknown"; }
  })();

  let md = "";
  md += `# Portal Write Probe\n\n`;
  md += `Generated: ${now}  •  hscli @ ${gitSha}  •  profile: \`${PORTAL_PROFILE}\`  •  runSuffix: \`${RUN_SUFFIX}\`  •  HSCLI_DEV_APP_ID: \`${DEV_APP_ID}\`\n\n`;
  md += `Probed ${results.length} write endpoints (POST non-search + PUT + PATCH + DELETE) of ${eps.length} total HubSpot API endpoints.\n\n`;

  md += `## Summary\n\n| Category | Count | % |\n|---|---:|---:|\n`;
  for (const k of ORDER) {
    if (!counts.has(k)) continue;
    const c = counts.get(k);
    md += `| **${k}** | ${c} | ${(c/results.length*100).toFixed(1)}% |\n`;
  }

  md += `\n## Legend\n\n`;
  md += `- **PASS** — 2xx; write succeeded with our minimal body\n`;
  md += `- **CONFLICT** — 409; endpoint works, resource already exists (semantic PASS)\n`;
  md += `- **VALIDATION** — 400; endpoint reachable + authenticated, but our minimal body is incomplete. User must provide real data via \`--data\`. **Counts as headless-accessible.**\n`;
  md += `- **AUTH** — 401/403 (scope or auth issue, non-zombie)\n`;
  md += `- **ZOMBIE** — 403 with explicit "requires legacy hapikey" — HubSpot's dead developer auth style\n`;
  md += `- **TIER** — 403 paid-plan-only (Marketing Hub Pro+, Service Hub Pro, etc.)\n`;
  md += `- **404** — path not found (scrape stale OR portal missing feature)\n`;
  md += `- **METHOD** — 405; scrape metadata listed wrong verb\n`;
  md += `- **5XX / 429** — server-side error or rate limit\n`;
  md += `- **SKIP-PARAM** — unresolved \`{param}\`\n`;
  md += `- **SKIP-ARTIFACT** — scrape artifact placeholder\n`;
  md += `- **SKIP-UNSAFE** — intentionally skipped for safety (portal-wide destructive)\n\n`;

  md += `## Headless accessibility\n\n`;
  const pass = (counts.get("PASS") || 0) + (counts.get("CONFLICT") || 0);
  const reachable = pass + (counts.get("VALIDATION") || 0);
  md += `- **Directly succeeding**: ${pass} / ${results.length} (${(pass/results.length*100).toFixed(1)}%)\n`;
  md += `- **Reachable via hscli** (PASS + CONFLICT + VALIDATION): ${reachable} / ${results.length} (${(reachable/results.length*100).toFixed(1)}%)\n`;
  md += `\nThe headless accessibility rate treats VALIDATION responses as "reachable" because they confirm the endpoint authenticates the call and HubSpot accepted the path — what's missing is just richer payload data which is the user's domain, not the CLI's.\n`;

  md += `\n## Per-method breakdown\n\n`;
  md += `| Method | Total | ${ORDER.join(" | ")} |\n`;
  md += `|---|---:|${ORDER.map(() => "---:|").join("")}\n`;
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
    const mc = byMethod.get(m);
    if (!mc) continue;
    const total = [...mc.values()].reduce((s,n)=>s+n,0);
    let row = `| ${m} | ${total} |`;
    for (const k of ORDER) row += ` ${mc.get(k) || ""} |`;
    md += row + "\n";
  }

  md += `\n## Per-module breakdown\n\n`;
  md += `| Module | Probed | ${ORDER.join(" | ")} |\n`;
  md += `|---|---:|${ORDER.map(() => "---:|").join("")}\n`;
  for (const mod of [...byModule.keys()].sort()) {
    const mc = byModule.get(mod);
    const total = [...mc.values()].reduce((s,n)=>s+n,0);
    let row = `| ${mod} | ${total} |`;
    for (const k of ORDER) row += ` ${mc.get(k) || ""} |`;
    md += row + "\n";
  }

  md += `\n## Zombie endpoints (${counts.get("ZOMBIE") || 0}) — require legacy hapikey\n\n`;
  for (const r of results.filter(r => r.category === "ZOMBIE").slice(0, 40)) {
    md += `- \`${r.ep.method} ${r.ep.path}\` → **${r.status}**\n`;
  }

  md += `\n## Tier-locked endpoints (${counts.get("TIER") || 0})\n\n`;
  for (const r of results.filter(r => r.category === "TIER").slice(0, 40)) {
    md += `- \`${r.ep.method} ${r.ep.path}\` → **${r.status}**  _${r.note?.slice(0, 100)}_\n`;
  }

  md += `\n## First 40 VALIDATION (reachable, body-incomplete)\n\n`;
  for (const r of results.filter(r => r.category === "VALIDATION").slice(0, 40)) {
    md += `- \`${r.ep.method} ${r.ep.path}\` → **400**  _${r.note?.slice(0, 120)}_\n`;
  }

  md += `\n## First 40 AUTH (non-zombie auth failure)\n\n`;
  for (const r of results.filter(r => r.category === "AUTH").slice(0, 40)) {
    md += `- \`${r.ep.method} ${r.ep.path}\` → **${r.status}**  _${r.note?.slice(0, 120)}_\n`;
  }

  md += `\n## First 40 404s\n\n`;
  for (const r of results.filter(r => r.category === "404").slice(0, 40)) {
    md += `- \`${r.ep.method} ${r.ep.path}\` → **404**  _${r.note?.slice(0, 100)}_\n`;
  }

  console.log(md);
  console.error(`[write-probe] done — ${results.length} endpoints probed`);
  console.error(`[write-probe] category breakdown:`);
  for (const k of ORDER) if (counts.has(k)) console.error(`  ${k.padEnd(15)} ${counts.get(k)}`);
}

main().catch(e => {
  console.error("[write-probe] fatal:", e);
  process.exit(1);
});
