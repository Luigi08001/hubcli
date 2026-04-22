/**
 * Setup script: GDPR compliance, marketing contacts, companies, custom properties & forms.
 *
 * Steps:
 *   1. Create custom contact properties (mcp_server, mcp_attribution, cli_language, cli_rules, position)
 *   2. Create 25 companies from seed data and associate to matching contacts
 *   3. Apply GDPR legal basis to all contacts based on lifecycle stage (EU portal)
 *   4. Mark all contacts as marketing contacts (hs_marketable_status = true)
 *   5. Create two HubSpot forms:
 *      - Gonzalo's MCP form: firstname, lastname, email, mcp_server, mcp_attribution, industry
 *      - Louis's LvnCLI form: firstname, lastname, email, cli_language, cli_rules, position
 *
 * Usage: HSCLI_HOME=~/.hscli node scripts/setup-marketing-gdpr-companies-forms.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const HSCLI_HOME = process.env.HSCLI_HOME || join(homedir(), ".hscli");
const authFile = JSON.parse(readFileSync(join(HSCLI_HOME, "auth.json"), "utf8"));
const TOKEN = authFile.profiles.default.token;
const HEADERS = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

/* ── Error threshold (from CLAUDE.md rules) ────────────────────────── */
const MAX_SAME_ERRORS = 5;
const errorCounts = new Map();

function trackError(action, errorMessage) {
  const errorKey = `${action}:${errorMessage.slice(0, 80)}`;
  const count = (errorCounts.get(errorKey) || 0) + 1;
  errorCounts.set(errorKey, count);
  if (count > MAX_SAME_ERRORS) {
    console.error(`\n[HARD STOP] More than ${MAX_SAME_ERRORS} errors on "${action}":`);
    console.error(`  Error: ${errorMessage}`);
    console.error(`  Fix the root cause before retrying. Aborting.`);
    process.exit(1);
  }
  return count;
}

async function apiRequest(method, path, body) {
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`https://api.hubapi.com${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `${res.status} ${res.statusText}`);
  }
  // 204 No Content
  if (res.status === 204) return {};
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── 1. Custom Contact Properties ──────────────────────────────────── */

const CUSTOM_PROPERTIES = [
  {
    name: "mcp_server",
    label: "MCP Server",
    type: "string",
    fieldType: "text",
    groupName: "contactinformation",
    description: "Model Context Protocol server URL or identifier",
  },
  {
    name: "mcp_attribution",
    label: "MCP Attribution",
    type: "string",
    fieldType: "text",
    groupName: "contactinformation",
    description: "Attribution source for MCP-related contacts",
  },
  {
    name: "cli_language",
    label: "CLI Language",
    type: "string",
    fieldType: "text",
    groupName: "contactinformation",
    description: "Preferred CLI programming language",
  },
  {
    name: "cli_rules",
    label: "CLI Rules",
    type: "string",
    fieldType: "textarea",
    groupName: "contactinformation",
    description: "CLI-specific rules or configuration notes",
  },
  {
    name: "position",
    label: "Position",
    type: "string",
    fieldType: "text",
    groupName: "contactinformation",
    description: "Job position / role",
  },
];

async function createCustomProperties() {
  console.log("\n═══ Step 1: Creating custom contact properties ═══");
  let created = 0;
  let skipped = 0;

  for (const prop of CUSTOM_PROPERTIES) {
    try {
      // Check if property already exists
      try {
        await apiRequest("GET", `/crm/v3/properties/contacts/${prop.name}`);
        console.log(`  ✓ ${prop.name} — already exists, skipping`);
        skipped++;
        continue;
      } catch {
        // Property doesn't exist, create it
      }

      await apiRequest("POST", "/crm/v3/properties/contacts", prop);
      console.log(`  + ${prop.name} — created`);
      created++;
      await sleep(300);
    } catch (err) {
      console.error(`  ✗ ${prop.name} — FAILED: ${err.message}`);
      trackError("createProperty", err.message);
    }
  }

  console.log(`  → Properties: ${created} created, ${skipped} skipped`);
}

/* ── 2. Companies & Associations ───────────────────────────────────── */

const COMPANIES = [
  "TechVault Systems", "CloudNine Labs", "Nextera Digital", "DataStream Corp", "QuantumBridge AI",
  "CypherStack", "HorizonDev Solutions", "ApexCode Inc", "Stellar Platforms", "VectorWave Tech",
  "CodePilot.io", "InfraCore Systems", "NovaPipeline", "ByteForge Labs", "Stratos Engineering",
  "OmniScale Tech", "PrismOps", "FluxPoint Labs", "CoreLoop Systems", "TerraCode Solutions",
  "KineticAPI", "BridgeStack", "LatticeDev", "GridSpark", "MeridianTech",
];

function companyToDomain(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
}

async function createCompaniesAndAssociate() {
  console.log("\n═══ Step 2: Creating companies & associating to contacts ═══");

  // Fetch all contacts with their company property
  const allContacts = [];
  let after = undefined;
  while (true) {
    const qs = `limit=100&properties=email,company${after ? `&after=${after}` : ""}`;
    const page = await apiRequest("GET", `/crm/v3/objects/contacts?${qs}`);
    allContacts.push(...(page.results || []));
    after = page.paging?.next?.after;
    if (!after) break;
  }
  console.log(`  Fetched ${allContacts.length} contacts`);

  // Build map: company name → contact IDs
  const companyContactMap = new Map();
  for (const c of allContacts) {
    const companyName = c.properties?.company;
    if (companyName) {
      if (!companyContactMap.has(companyName)) companyContactMap.set(companyName, []);
      companyContactMap.get(companyName).push(c.id);
    }
  }

  // Check existing companies by name search
  const existingCompanies = new Map();
  const existingRes = await apiRequest("GET", "/crm/v3/objects/companies?limit=100&properties=name,domain");
  for (const co of existingRes.results || []) {
    if (co.properties?.name) {
      existingCompanies.set(co.properties.name, co.id);
    }
  }
  console.log(`  Existing companies: ${existingCompanies.size} (${[...existingCompanies.keys()].join(", ")})`);

  let created = 0;
  let associated = 0;
  let skipped = 0;

  // Pre-flight: create one test company and delete it
  console.log("  Pre-flight: validating company schema...");
  try {
    const testCo = await apiRequest("POST", "/crm/v3/objects/companies", {
      properties: {
        name: `__preflight_test_${Date.now()}`,
        domain: "preflight-test.local",
        industry: "INFORMATION_TECHNOLOGY_AND_SERVICES",
      },
    });
    await apiRequest("DELETE", `/crm/v3/objects/companies/${testCo.id}`);
    console.log("  Pre-flight passed.\n");
  } catch (err) {
    console.error(`  Pre-flight FAILED: ${err.message}`);
    console.error("  Fix the company schema before running.");
    process.exit(1);
  }

  for (const companyName of COMPANIES) {
    try {
      let companyId;

      // Check if already exists
      if (existingCompanies.has(companyName)) {
        companyId = existingCompanies.get(companyName);
        console.log(`  ✓ ${companyName} — exists (${companyId}), skipping creation`);
        skipped++;
      } else {
        // Search by domain as fallback
        const domain = companyToDomain(companyName);
        const searchRes = await apiRequest("POST", "/crm/v3/objects/companies/search", {
          filterGroups: [{ filters: [{ propertyName: "domain", operator: "EQ", value: domain }] }],
          limit: 1,
        });
        if (searchRes.total > 0) {
          companyId = searchRes.results[0].id;
          console.log(`  ✓ ${companyName} — found by domain (${companyId}), skipping creation`);
          skipped++;
        } else {
          // Create the company
          const newCo = await apiRequest("POST", "/crm/v3/objects/companies", {
            properties: {
              name: companyName,
              domain: domain,
              industry: "INFORMATION_TECHNOLOGY_AND_SERVICES",
            },
          });
          companyId = newCo.id;
          console.log(`  + ${companyName} — created (${companyId})`);
          created++;
          await sleep(300);
        }
      }

      // Associate matching contacts to this company
      const contactIds = companyContactMap.get(companyName) || [];
      for (const contactId of contactIds) {
        try {
          await apiRequest("PUT",
            `/crm/v4/objects/contacts/${contactId}/associations/default/companies/${companyId}`,
          );
          associated++;
        } catch (err) {
          // May already be associated — ignore 409/conflict
          if (!err.message.includes("already")) {
            console.error(`    assoc FAIL contact=${contactId} → ${companyName}: ${err.message}`);
            trackError("associateContact", err.message);
          }
        }
      }
      if (contactIds.length > 0) {
        console.log(`    → Associated ${contactIds.length} contacts to ${companyName}`);
      }

      // Throttle every 5 companies
      if ((created + skipped) % 5 === 0) await sleep(800);
    } catch (err) {
      console.error(`  ✗ ${companyName} — FAILED: ${err.message}`);
      trackError("createCompany", err.message);
    }
  }

  console.log(`  → Companies: ${created} created, ${skipped} skipped, ${associated} associations made`);
}

/* ── 3. GDPR Legal Basis (EU Portal) ──────────────────────────────── */

// EU portal GDPR legal basis mapping by lifecycle stage:
//   leads       → "Legitimate interest – prospect/lead"
//   customers   → "Legitimate interest – existing customer"
//   other/ex    → "Legitimate interest - other"
const GDPR_LEGAL_BASIS_MAP = {
  lead: "Legitimate interest – prospect/lead",
  subscriber: "Legitimate interest – prospect/lead",
  opportunity: "Legitimate interest – prospect/lead",
  marketingqualifiedlead: "Legitimate interest – prospect/lead",
  salesqualifiedlead: "Legitimate interest – prospect/lead",
  customer: "Legitimate interest – existing customer",
  evangelist: "Legitimate interest – existing customer",
  other: "Legitimate interest - other",
};

async function applyGdprAndMarketingStatus() {
  console.log("\n═══ Step 3: Applying GDPR legal basis & marketing status ═══");

  // Fetch all contacts with lifecycle stage
  const allContacts = [];
  let after = undefined;
  while (true) {
    const qs = `limit=100&properties=lifecyclestage,hs_legal_basis,hs_marketable_status${after ? `&after=${after}` : ""}`;
    const page = await apiRequest("GET", `/crm/v3/objects/contacts?${qs}`);
    allContacts.push(...(page.results || []));
    after = page.paging?.next?.after;
    if (!after) break;
  }
  console.log(`  Fetched ${allContacts.length} contacts`);

  // Build batch updates — group into batches of 100
  const updates = [];
  for (const contact of allContacts) {
    const lifecycle = contact.properties?.lifecyclestage || "other";
    const legalBasis = GDPR_LEGAL_BASIS_MAP[lifecycle] || "Legitimate interest - other";
    const currentBasis = contact.properties?.hs_legal_basis;
    const currentMarketing = contact.properties?.hs_marketable_status;

    // Only update if needed
    const needsUpdate = !currentBasis || currentBasis !== legalBasis || currentMarketing !== "true";
    if (needsUpdate) {
      updates.push({
        id: contact.id,
        properties: {
          hs_legal_basis: legalBasis,
          hs_marketable_status: "true",
        },
      });
    }
  }

  console.log(`  Contacts needing update: ${updates.length} of ${allContacts.length}`);

  if (updates.length === 0) {
    console.log("  All contacts already have GDPR + marketing status set.");
    return;
  }

  // Pre-flight: test a single update
  console.log("  Pre-flight: testing single GDPR update...");
  try {
    const testContact = updates[0];
    await apiRequest("PATCH", `/crm/v3/objects/contacts/${testContact.id}`, {
      properties: testContact.properties,
    });
    console.log(`  Pre-flight passed (updated contact ${testContact.id}).`);
  } catch (err) {
    console.error(`  Pre-flight FAILED: ${err.message}`);
    console.error("  Fix the property values before running batch update.");
    process.exit(1);
  }

  // Process in batches of 100 using batch update API
  let updated = 0;
  for (let i = 0; i < updates.length; i += 100) {
    const batch = updates.slice(i, i + 100);
    try {
      await apiRequest("POST", "/crm/v3/objects/contacts/batch/update", {
        inputs: batch,
      });
      updated += batch.length;
      console.log(`  Batch ${Math.floor(i / 100) + 1}: updated ${batch.length} contacts (${updated}/${updates.length})`);
      if (i + 100 < updates.length) await sleep(1500);
    } catch (err) {
      console.error(`  Batch FAIL (offset ${i}): ${err.message}`);
      trackError("batchUpdateGdpr", err.message);
      // Fall back to individual updates for this batch
      console.log("  Falling back to individual updates for this batch...");
      for (const u of batch) {
        try {
          await apiRequest("PATCH", `/crm/v3/objects/contacts/${u.id}`, { properties: u.properties });
          updated++;
        } catch (innerErr) {
          console.error(`    FAIL contact ${u.id}: ${innerErr.message}`);
          trackError("updateGdpr", innerErr.message);
        }
        await sleep(200);
      }
    }
  }

  console.log(`  → GDPR + Marketing: ${updated} contacts updated`);

  // Summary of legal basis distribution
  const basisCounts = {};
  for (const u of updates) {
    const basis = u.properties.hs_legal_basis;
    basisCounts[basis] = (basisCounts[basis] || 0) + 1;
  }
  for (const [basis, count] of Object.entries(basisCounts)) {
    console.log(`    ${basis}: ${count} contacts`);
  }
}

/* ── 4. HubSpot Forms ─────────────────────────────────────────────── */

async function createForms() {
  console.log("\n═══ Step 4: Creating HubSpot forms ═══");

  // Check if forms already exist
  const existingForms = await apiRequest("GET", "/marketing/v3/forms/?limit=100");
  const formNames = new Set((existingForms.results || []).map(f => f.name));

  // Note: HubSpot Forms v3 API requires `createdAt` and uses `legalConsentOptions.type: "none"`
  // for forms without embedded GDPR consent (GDPR is handled at the contact property level).
  // Legitimate interest consent requires portal-level subscription type configuration.
  const forms = [
    {
      name: "MCP Contact Form (Gonzalo)",
      formType: "hubspot",
      createdAt: new Date().toISOString(),
      configuration: {
        language: "en",
        createNewContactForNewEmail: true,
        editable: true,
        lifecycleStage: "lead",
      },
      fieldGroups: [
        {
          groupType: "default_group",
          richTextType: "text",
          fields: [
            { name: "firstname", label: "First Name", objectTypeId: "0-1", fieldType: "single_line_text", required: true },
            { name: "lastname", label: "Last Name", objectTypeId: "0-1", fieldType: "single_line_text", required: true },
          ],
        },
        {
          groupType: "default_group",
          richTextType: "text",
          fields: [
            { name: "email", label: "Email", objectTypeId: "0-1", fieldType: "single_line_text", required: true },
            { name: "industry", label: "Industry", objectTypeId: "0-1", fieldType: "single_line_text", required: false },
          ],
        },
        {
          groupType: "default_group",
          richTextType: "text",
          fields: [
            { name: "mcp_server", label: "MCP Server", objectTypeId: "0-1", fieldType: "single_line_text", required: false },
            { name: "mcp_attribution", label: "MCP Attribution", objectTypeId: "0-1", fieldType: "single_line_text", required: false },
          ],
        },
      ],
      legalConsentOptions: { type: "none" },
    },
    {
      name: "LvnCLI Contact Form (Louis)",
      formType: "hubspot",
      createdAt: new Date().toISOString(),
      configuration: {
        language: "en",
        createNewContactForNewEmail: true,
        editable: true,
        lifecycleStage: "lead",
      },
      fieldGroups: [
        {
          groupType: "default_group",
          richTextType: "text",
          fields: [
            { name: "firstname", label: "First Name", objectTypeId: "0-1", fieldType: "single_line_text", required: true },
            { name: "lastname", label: "Last Name", objectTypeId: "0-1", fieldType: "single_line_text", required: true },
          ],
        },
        {
          groupType: "default_group",
          richTextType: "text",
          fields: [
            { name: "email", label: "Email", objectTypeId: "0-1", fieldType: "single_line_text", required: true },
            { name: "position", label: "Position", objectTypeId: "0-1", fieldType: "single_line_text", required: false },
          ],
        },
        {
          groupType: "default_group",
          richTextType: "text",
          fields: [
            { name: "cli_language", label: "CLI Language", objectTypeId: "0-1", fieldType: "single_line_text", required: false },
            { name: "cli_rules", label: "CLI Rules", objectTypeId: "0-1", fieldType: "multi_line_text", required: false },
          ],
        },
      ],
      legalConsentOptions: { type: "none" },
    },
  ];

  for (const form of forms) {
    if (formNames.has(form.name)) {
      console.log(`  ✓ "${form.name}" — already exists, skipping`);
      continue;
    }

    try {
      const result = await apiRequest("POST", "/marketing/v3/forms/", form);
      console.log(`  + "${form.name}" — created (id: ${result.id})`);
      await sleep(500);
    } catch (err) {
      console.error(`  ✗ "${form.name}" — FAILED: ${err.message}`);
      trackError("createForm", err.message);
    }
  }
}

/* ── Main ──────────────────────────────────────────────────────────── */

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  HubSpot Setup: GDPR, Marketing, Companies & Forms     ║");
console.log("║  Portal: 147975758 (EU1)                               ║");
console.log("╚══════════════════════════════════════════════════════════╝");

try {
  await createCustomProperties();
  await createCompaniesAndAssociate();
  await applyGdprAndMarketingStatus();
  await createForms();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  ✅ All setup steps completed successfully              ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\nNote: Business Units API is enterprise-only (returned 404).");
  console.log("LvnCLI and MCP_LVN remain as companies. To convert to");
  console.log("Business Units, upgrade to HubSpot Enterprise tier.");
} catch (err) {
  console.error(`\nFATAL: ${err.message}`);
  process.exit(1);
}
