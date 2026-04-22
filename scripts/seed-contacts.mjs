/**
 * Seed 100 test contacts into HubSpot with realistic data.
 *
 * Distribution:
 *   35 leads (lifecycle: lead, pipeline stage: prospect/qualification)
 *   50 customers (lifecycle: customer, pipeline stage: won/customer)
 *   15 ex-customers (lifecycle: other, pipeline stage: lost, hs_lead_status: churned)
 *
 * Brand assignment:
 *   50 contacts → LvnCLI  (brand=lvncli, owner=Louis 75179818, company 420001842424)
 *   30 contacts → MCP_LVN (brand=mcp_lvn, owner=Gonzalo 44551336, company 419725867199)
 *   20 contacts → unassigned (no brand, no company)
 *
 * Usage: HSCLI_HOME=~/.hscli node scripts/seed-contacts.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const HSCLI_HOME = process.env.HSCLI_HOME || join(homedir(), ".hscli");
const authFile = JSON.parse(readFileSync(join(HSCLI_HOME, "auth.json"), "utf8"));
const TOKEN = authFile.profiles.default.token;
const HEADERS = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

/**
 * Error threshold tracker.
 * If more than MAX_SAME_ERRORS errors occur on the same action/error pattern,
 * the script stops and requires a code fix before retrying.
 */
const MAX_SAME_ERRORS = 5;
const errorCounts = new Map(); // key: "action:errorCode" → count

function trackError(action, errorMessage) {
  // Extract a stable error key (first 80 chars of message to group similar errors)
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

const LVN_COMPANY_ID = "420001842424";
const MCP_COMPANY_ID = "419725867199";
const LOUIS_OWNER_ID = "75179818";
const GONZALO_OWNER_ID = "44551336";

// Pipeline: Sales Pipeline - Custom (3636915449)
const STAGES = {
  prospect: "5000872142",
  qualification: "5000872143",
  won: "5000872144",
  lost: "5000872145",
  customer: "5000872146",
};

const FIRST_NAMES = [
  "James", "Emma", "Liam", "Olivia", "Noah", "Ava", "William", "Sophia", "Lucas", "Isabella",
  "Henry", "Mia", "Alexander", "Charlotte", "Benjamin", "Amelia", "Mason", "Harper", "Ethan", "Evelyn",
  "Daniel", "Abigail", "Sebastian", "Emily", "Jack", "Ella", "Aiden", "Elizabeth", "Owen", "Camila",
  "Samuel", "Luna", "Ryan", "Sofia", "Nathan", "Avery", "Caleb", "Scarlett", "Leo", "Grace",
  "Max", "Chloe", "Isaac", "Victoria", "Thomas", "Riley", "Charles", "Aria", "Gabriel", "Lily",
  "Julian", "Aurora", "Miles", "Zoey", "Mateo", "Nora", "Levi", "Hannah", "David", "Stella",
  "Theo", "Hazel", "Elijah", "Penelope", "Andrew", "Layla", "Joshua", "Ellie", "Adam", "Violet",
  "Luke", "Claire", "Dylan", "Audrey", "Michael", "Bella", "Robert", "Lucy", "Marcus", "Anna",
  "Kai", "Sadie", "Finn", "Ruby", "Oscar", "Alice", "Jayden", "Zara", "Hugo", "Maya",
  "Axel", "Ivy", "Felix", "Naomi", "Jasper", "Elena", "Silas", "Sarah", "Remy", "Leah",
];

const LAST_NAMES = [
  "Anderson", "Baker", "Campbell", "Davis", "Edwards", "Fisher", "Garcia", "Harris", "Ivanov", "Jensen",
  "Kim", "Lopez", "Martinez", "Nelson", "O'Brien", "Patel", "Quinn", "Rodriguez", "Smith", "Taylor",
  "Ueda", "Vasquez", "Walker", "Xu", "Yamamoto", "Zhang", "Bennett", "Clark", "Dunn", "Evans",
  "Foster", "Grant", "Hill", "Ingram", "Jones", "King", "Lee", "Moore", "Nguyen", "Olsen",
  "Park", "Reed", "Scott", "Turner", "Underwood", "Vance", "Webb", "Young", "Zhou", "Adams",
];

const JOB_TITLES = [
  "CTO", "VP of Engineering", "Engineering Manager", "Senior Developer", "DevOps Lead",
  "Platform Engineer", "Staff Engineer", "Tech Lead", "Director of Engineering", "Head of Infrastructure",
  "Site Reliability Engineer", "Cloud Architect", "Software Engineer", "Principal Engineer", "Lead Developer",
  "Developer Experience Lead", "Product Engineer", "Backend Engineer", "Full Stack Developer", "Solutions Architect",
];

const CITIES = [
  { city: "London", state: "England", country: "United Kingdom", zip: "EC2A 1NT" },
  { city: "Berlin", state: "Berlin", country: "Germany", zip: "10115" },
  { city: "Paris", state: "Ile-de-France", country: "France", zip: "75001" },
  { city: "Amsterdam", state: "North Holland", country: "Netherlands", zip: "1012 AB" },
  { city: "Barcelona", state: "Catalonia", country: "Spain", zip: "08001" },
  { city: "Dublin", state: "Leinster", country: "Ireland", zip: "D02 Y006" },
  { city: "Stockholm", state: "Stockholm", country: "Sweden", zip: "111 57" },
  { city: "Lisbon", state: "Lisbon", country: "Portugal", zip: "1100-148" },
  { city: "Milan", state: "Lombardy", country: "Italy", zip: "20121" },
  { city: "Copenhagen", state: "Capital Region", country: "Denmark", zip: "1050" },
  { city: "New York", state: "New York", country: "United States", zip: "10001" },
  { city: "San Francisco", state: "California", country: "United States", zip: "94105" },
  { city: "Austin", state: "Texas", country: "United States", zip: "73301" },
  { city: "Toronto", state: "Ontario", country: "Canada", zip: "M5V 3L9" },
  { city: "Singapore", state: "Singapore", country: "Singapore", zip: "048583" },
  { city: "Sydney", state: "New South Wales", country: "Australia", zip: "2000" },
  { city: "Tokyo", state: "Tokyo", country: "Japan", zip: "100-0001" },
  { city: "Seoul", state: "Seoul", country: "South Korea", zip: "04524" },
  { city: "Zurich", state: "Zurich", country: "Switzerland", zip: "8001" },
  { city: "Munich", state: "Bavaria", country: "Germany", zip: "80331" },
];

const COMPANIES = [
  "TechVault Systems", "CloudNine Labs", "Nextera Digital", "DataStream Corp", "QuantumBridge AI",
  "CypherStack", "HorizonDev Solutions", "ApexCode Inc", "Stellar Platforms", "VectorWave Tech",
  "CodePilot.io", "InfraCore Systems", "NovaPipeline", "ByteForge Labs", "Stratos Engineering",
  "OmniScale Tech", "PrismOps", "FluxPoint Labs", "CoreLoop Systems", "TerraCode Solutions",
  "KineticAPI", "BridgeStack", "LatticeDev", "GridSpark", "MeridianTech",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function phoneNumber() {
  return `+${1 + Math.floor(Math.random() * 50)} ${100 + Math.floor(Math.random() * 900)} ${1000 + Math.floor(Math.random() * 9000)} ${100 + Math.floor(Math.random() * 900)}`;
}

function generateContact(index) {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
  const lastName = LAST_NAMES[index % LAST_NAMES.length];
  const loc = CITIES[index % CITIES.length];
  const company = COMPANIES[index % COMPANIES.length];
  const emailDomain = company.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace("'", "")}@${emailDomain}`;

  // Determine segment: 0-34 = lead, 35-84 = customer, 85-99 = ex-customer
  let lifecyclestage, hs_lead_status, dealstage, segment;
  if (index < 35) {
    segment = "lead";
    lifecyclestage = "lead";
    hs_lead_status = index < 18 ? "NEW" : "OPEN";
    dealstage = index < 18 ? STAGES.prospect : STAGES.qualification;
  } else if (index < 85) {
    segment = "customer";
    lifecyclestage = "customer";
    hs_lead_status = "CONNECTED";
    dealstage = index < 65 ? STAGES.won : STAGES.customer;
  } else {
    segment = "ex-customer";
    lifecyclestage = "other";
    hs_lead_status = "BAD_TIMING";
    dealstage = STAGES.lost;
  }

  // Brand assignment: 0-49 = LvnCLI, 50-79 = MCP_LVN, 80-99 = unassigned
  let brand, ownerId, companyId;
  if (index < 50) {
    brand = "lvncli";
    ownerId = LOUIS_OWNER_ID;
    companyId = LVN_COMPANY_ID;
  } else if (index < 80) {
    brand = "mcp_lvn";
    ownerId = GONZALO_OWNER_ID;
    companyId = MCP_COMPANY_ID;
  } else {
    brand = undefined;
    ownerId = undefined;
    companyId = undefined;
  }

  const numEmployeesOptions = ["1-5", "5-25", "25-50", "50-100", "100-500", "500-1000", "1000+"];
  const numEmployees = pick(numEmployeesOptions);

  const properties = {
    firstname: firstName,
    lastname: lastName,
    email,
    phone: phoneNumber(),
    company,
    jobtitle: pick(JOB_TITLES),
    city: loc.city,
    state: loc.state,
    country: loc.country,
    zip: loc.zip,
    website: `https://${emailDomain}`,
    lifecyclestage,
    hs_lead_status,
    numemployees: numEmployees,
    industry: "INFORMATION_TECHNOLOGY_AND_SERVICES",
  };

  if (brand) properties.brand = brand;
  if (ownerId) properties.hubspot_owner_id = ownerId;

  return { properties, segment, companyId, dealstage };
}

async function createContact(contactData) {
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ properties: contactData.properties }),
  });
  if (!res.ok) {
    const err = await res.json();
    const msg = err.message || JSON.stringify(err);
    console.error(`FAIL ${contactData.properties.email}: ${msg}`);
    trackError("createContact", msg);
    return null;
  }
  return res.json();
}

async function associateContactToCompany(contactId, companyId) {
  const res = await fetch(
    `https://api.hubapi.com/crm/v4/objects/contacts/${contactId}/associations/default/companies/${companyId}`,
    { method: "PUT", headers: HEADERS },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`  assoc FAIL contact=${contactId} company=${companyId}:`, err.message || res.status);
  }
}

async function createDeal(contactId, contactData) {
  const dealName = `${contactData.properties.firstname} ${contactData.properties.lastname} - ${contactData.properties.company}`;
  const amount = String(500 + Math.floor(Math.random() * 9500));
  const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      properties: {
        dealname: dealName,
        pipeline: "3636915449",
        dealstage: contactData.dealstage,
        amount,
        hubspot_owner_id: contactData.properties.hubspot_owner_id || "",
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.message || String(res.status);
    console.error(`  deal FAIL ${dealName}: ${msg}`);
    trackError("createDeal", msg);
    return null;
  }
  const deal = await res.json();

  // Associate deal to contact
  await fetch(
    `https://api.hubapi.com/crm/v4/objects/deals/${deal.id}/associations/default/contacts/${contactId}`,
    { method: "PUT", headers: HEADERS },
  );

  // Associate deal to company if applicable
  if (contactData.companyId) {
    await fetch(
      `https://api.hubapi.com/crm/v4/objects/deals/${deal.id}/associations/default/companies/${contactData.companyId}`,
      { method: "PUT", headers: HEADERS },
    );
  }

  return deal;
}

// --- Pre-flight validation: create one test contact, verify, then delete ---
console.log("Pre-flight: validating contact schema...");
const testContact = generateContact(0);
const testRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
  method: "POST", headers: HEADERS,
  body: JSON.stringify({ properties: { ...testContact.properties, email: `preflight-test-${Date.now()}@validation.local` } }),
});
if (!testRes.ok) {
  const err = await testRes.json();
  console.error("Pre-flight FAILED — fix the contact schema before running:");
  console.error(JSON.stringify(err, null, 2));
  process.exit(1);
}
const testRecord = await testRes.json();
// Clean up the test record
await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${testRecord.id}`, {
  method: "DELETE", headers: HEADERS,
});
console.log("Pre-flight passed. Starting bulk creation...\n");

// Main
const contacts = Array.from({ length: 100 }, (_, i) => generateContact(i));
const stats = { leads: 0, customers: 0, exCustomers: 0, lvncli: 0, mcp_lvn: 0, unassigned: 0, deals: 0 };

// Process sequentially in small batches with retries to respect rate limits
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await fn();
    if (result !== null) return result;
    if (attempt < maxRetries) {
      const wait = 2000 * (attempt + 1);
      process.stdout.write(`    (rate-limited, waiting ${wait}ms...)\n`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  return null;
}

for (let i = 0; i < 100; i++) {
  const c = contacts[i];

  // Check if contact already exists
  const checkRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/search`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: c.properties.email }] }], limit: 1 }),
  });
  const checkData = await checkRes.json();
  if (checkData.total > 0) {
    const existingId = checkData.results[0].id;
    process.stdout.write(`  [${i + 1}/100] ${c.properties.email} (exists, skipping contact creation)\n`);
    // Still track stats
    if (c.segment === "lead") stats.leads++;
    else if (c.segment === "customer") stats.customers++;
    else stats.exCustomers++;
    if (c.properties.brand === "lvncli") stats.lvncli++;
    else if (c.properties.brand === "mcp_lvn") stats.mcp_lvn++;
    else stats.unassigned++;
    continue;
  }

  const record = await withRetry(() => createContact(c));
  if (!record) {
    process.stdout.write(`  [${i + 1}/100] FAILED ${c.properties.email}\n`);
    continue;
  }

  const contactId = record.id;

  // Associate to company
  if (c.companyId) {
    await associateContactToCompany(contactId, c.companyId);
  }

  // Create deal in the custom pipeline
  const deal = await withRetry(() => createDeal(contactId, c));
  if (deal) stats.deals++;

  // Track stats
  if (c.segment === "lead") stats.leads++;
  else if (c.segment === "customer") stats.customers++;
  else stats.exCustomers++;

  if (c.properties.brand === "lvncli") stats.lvncli++;
  else if (c.properties.brand === "mcp_lvn") stats.mcp_lvn++;
  else stats.unassigned++;

  process.stdout.write(`  [${i + 1}/100] ${c.properties.email} (${c.segment}, ${c.properties.brand || "none"})\n`);

  // Throttle: pause every 5 contacts
  if ((i + 1) % 5 === 0) await new Promise(r => setTimeout(r, 1200));
}

console.log("\n--- SUMMARY ---");
console.log(`Contacts: ${stats.leads} leads, ${stats.customers} customers, ${stats.exCustomers} ex-customers`);
console.log(`Brands: ${stats.lvncli} LvnCLI, ${stats.mcp_lvn} MCP_LVN, ${stats.unassigned} unassigned`);
console.log(`Deals: ${stats.deals} created in Sales Pipeline - Custom`);
