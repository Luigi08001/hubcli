import { Command } from "commander";
import { createClient, type HubSpotClient } from "../../core/http.js";
import { CliError, printResult, type CliContext } from "../../core/output.js";
import { encodePathSegment } from "../crm/shared.js";

const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_LIMIT = 1_000;
const MAX_OBJECT_PAGE_SIZE = 100;
const MAX_BATCH_READ_SIZE = 100;
const LARGE_PROPERTY_READ_THRESHOLD = 80;

const DEFAULT_EMAIL_EVENT_TYPES = ["SENT", "DELIVERED", "BOUNCE", "OPEN", "CLICK", "DROPPED", "SUPPRESSED", "DEFERRED"];

const HARD_BOUNCE_CATEGORIES = new Set([
  "UNKNOWN_USER",
  "POLICY",
  "SPAM",
  "DMARC",
  "FILTERED",
  "SENDING_DOMAIN_MISCONFIGURATION",
]);

const SOFT_BOUNCE_CATEGORIES = new Set([
  "THROTTLED",
  "TEMPORARY_PROBLEM",
  "MAILBOX_FULL",
  "MAILBOX_MISCONFIGURATION",
  "IP_REPUTATION",
  "DOMAIN_REPUTATION",
  "TIMEOUT",
  "DNS_FAILURE",
]);

interface HubSpotListPage {
  results?: Array<{ id?: string; properties?: Record<string, unknown>; archived?: boolean }>;
  paging?: { next?: { after?: string } };
}

interface HubSpotSearchCount {
  total?: number;
}

interface HubSpotProperty {
  name?: string;
  label?: string;
  type?: string;
  fieldType?: string;
  archived?: boolean;
}

interface EmailEvent {
  recipient?: string;
  email?: string;
  recipientEmail?: string;
  type?: string;
  created?: number;
  category?: string;
  status?: string | number;
  response?: string;
  obsoletedBy?: unknown;
}

interface EmailEventsPage {
  events?: EmailEvent[];
  results?: EmailEvent[];
  hasMore?: boolean;
  offset?: string;
}

interface EmailRecipientAccumulator {
  campaignId: string;
  email: string;
  events: Set<string>;
  bounceCategories: Set<string>;
  bounceStatuses: Set<string>;
  firstEventAt?: number;
  lastEventAt?: number;
  contactProperties?: Record<string, unknown>;
}

export function registerReports(program: Command, getCtx: () => CliContext): void {
  const reports = program.command("reports").description("Reusable reporting pulls and audit recipes");
  const pull = reports.command("pull").description("Run a report recipe and print json/table/csv/yaml output");

  pull
    .command("object-fill-rate")
    .description("Fill rate for selected or all properties on a CRM object")
    .requiredOption("--object <type>", "CRM object type, e.g. contacts, companies, deals, tickets, or 2-123")
    .option("--properties <csv>", "Property names. Omit to use every non-archived property in the object schema")
    .option("--limit <n>", "Max records to sample", String(DEFAULT_LIMIT))
    .option("--page-size <n>", "CRM page size, max 100", String(DEFAULT_PAGE_SIZE))
    .option("--archived <bool>", "Include archived records (true/false)", "false")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectType = parseRequired(opts.object, "--object");
      const schema = await maybeFetchPropertySchema(client, objectType, opts.properties);
      const properties = opts.properties ? splitCsv(opts.properties) : schema.map((property) => property.name).filter(Boolean);
      if (properties.length === 0) throw new CliError("INVALID_FLAG", "--properties resolved to an empty property list");
      const records = await fetchObjectRecords(client, objectType, properties, {
        limit: parsePositiveInt(opts.limit, "--limit"),
        pageSize: parsePageSize(opts.pageSize),
        archived: parseBoolean(opts.archived, "--archived"),
      });
      const schemaByName = new Map(schema.map((property) => [property.name, property]));
      const results = buildFillRateRows(records, properties, schemaByName);
      printResult(ctx, {
        recipe: "object-fill-rate",
        objectType,
        sampled: records.length,
        properties: properties.length,
        results,
      });
    });

  pull
    .command("property-distribution")
    .description("Distribution/top values for one CRM object property")
    .requiredOption("--object <type>", "CRM object type, e.g. contacts, companies, deals, tickets, or 2-123")
    .requiredOption("--property <name>", "Property name")
    .option("--limit <n>", "Max records to sample", String(DEFAULT_LIMIT))
    .option("--page-size <n>", "CRM page size, max 100", String(DEFAULT_PAGE_SIZE))
    .option("--top <n>", "Max values to return", "100")
    .option("--archived <bool>", "Include archived records (true/false)", "false")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectType = parseRequired(opts.object, "--object");
      const property = parseRequired(opts.property, "--property");
      const records = await fetchObjectRecords(client, objectType, [property], {
        limit: parsePositiveInt(opts.limit, "--limit"),
        pageSize: parsePageSize(opts.pageSize),
        archived: parseBoolean(opts.archived, "--archived"),
      });
      const report = buildPropertyDistribution(records, property, parsePositiveInt(opts.top, "--top"));
      printResult(ctx, {
        recipe: "property-distribution",
        objectType,
        property,
        sampled: records.length,
        ...report,
      });
    });

  pull
    .command("email-recipients")
    .description("Per-recipient marketing email event pull for campaign ids")
    .requiredOption("--campaign-ids <csv>", "Marketing email campaign ids")
    .option("--event-types <csv>", `Event types (${DEFAULT_EMAIL_EVENT_TYPES.join(",")})`, DEFAULT_EMAIL_EVENT_TYPES.join(","))
    .option("--contact-properties <csv>", "Optional contact properties to enrich by email")
    .option("--limit-per-event <n>", "Max events per campaign/event type", "100000")
    .option("--page-size <n>", "Email event API page size", "1000")
    .option("--start-timestamp <ms>", "Earliest event epoch ms")
    .option("--end-timestamp <ms>", "Latest event epoch ms")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const campaignIds = splitCsv(opts.campaignIds);
      const eventTypes = splitCsv(opts.eventTypes).map((eventType) => eventType.toUpperCase());
      const contactProperties = opts.contactProperties ? splitCsv(opts.contactProperties) : [];
      const recipients = await pullEmailRecipients(client, {
        campaignIds,
        eventTypes,
        limitPerEvent: parsePositiveInt(opts.limitPerEvent, "--limit-per-event"),
        pageSize: parsePositiveInt(opts.pageSize, "--page-size"),
        startTimestamp: opts.startTimestamp,
        endTimestamp: opts.endTimestamp,
      });
      if (contactProperties.length > 0) {
        await enrichRecipientsWithContacts(client, recipients, contactProperties);
      }
      printResult(ctx, {
        recipe: "email-recipients",
        campaigns: campaignIds,
        eventTypes,
        contactProperties,
        results: recipients.map(formatEmailRecipient),
      });
    });

  pull
    .command("source-target-parity")
    .description("Compare object counts between two auth profiles")
    .requiredOption("--source-profile <name>", "Source auth profile")
    .requiredOption("--target-profile <name>", "Target/sandbox auth profile")
    .requiredOption("--objects <csv>", "Object types to compare")
    .option("--filters <json>", "Optional CRM search filterGroups JSON applied to every object")
    .action(async (opts) => {
      const ctx = getCtx();
      const sourceProfile = parseRequired(opts.sourceProfile, "--source-profile");
      const targetProfile = parseRequired(opts.targetProfile, "--target-profile");
      const sourceClient = createClient(sourceProfile);
      const targetClient = createClient(targetProfile);
      const objectTypes = splitCsv(opts.objects);
      const filterGroups = opts.filters ? parseJson(opts.filters, "--filters") : undefined;
      const results = [];
      for (const objectType of objectTypes) {
        const sourceTotal = await countObject(sourceClient, objectType, filterGroups);
        const targetTotal = await countObject(targetClient, objectType, filterGroups);
        results.push({
          objectType,
          sourceTotal,
          targetTotal,
          delta: targetTotal - sourceTotal,
          parityRatio: sourceTotal === 0 ? (targetTotal === 0 ? 1 : null) : targetTotal / sourceTotal,
        });
      }
      printResult(ctx, {
        recipe: "source-target-parity",
        sourceProfile,
        targetProfile,
        results,
      });
    });
}

async function maybeFetchPropertySchema(
  client: HubSpotClient,
  objectType: string,
  explicitProperties?: string,
): Promise<Array<Required<Pick<HubSpotProperty, "name">> & HubSpotProperty>> {
  if (explicitProperties) return [];
  const objectSegment = encodePathSegment(objectType, "object");
  const res = await client.request(`/crm/v3/properties/${objectSegment}`);
  const properties = asRecord(res).results;
  if (!Array.isArray(properties)) return [];
  return properties
    .filter((property): property is HubSpotProperty => Boolean(property && typeof property === "object"))
    .filter((property) => Boolean(property.name) && !property.archived)
    .map((property) => ({ ...property, name: String(property.name) }));
}

async function fetchObjectRecords(
  client: HubSpotClient,
  objectType: string,
  properties: string[],
  opts: { limit: number; pageSize: number; archived: boolean },
): Promise<Array<{ id?: string; properties: Record<string, unknown> }>> {
  if (properties.length > LARGE_PROPERTY_READ_THRESHOLD) {
    const ids = await fetchObjectIds(client, objectType, opts);
    return batchReadObjectRecords(client, objectType, ids, properties);
  }

  const objectSegment = encodePathSegment(objectType, "object");
  const results: Array<{ id?: string; properties: Record<string, unknown> }> = [];
  let after: string | undefined;
  while (results.length < opts.limit) {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(opts.pageSize, opts.limit - results.length)));
    params.set("archived", String(opts.archived));
    params.set("properties", properties.join(","));
    if (after) params.set("after", after);
    const page = await client.request(`/crm/v3/objects/${objectSegment}?${params.toString()}`) as HubSpotListPage;
    for (const row of page.results ?? []) {
      results.push({ id: row.id, properties: row.properties ?? {} });
      if (results.length >= opts.limit) break;
    }
    after = page.paging?.next?.after;
    if (!after || (page.results ?? []).length === 0) break;
  }
  return results;
}

async function fetchObjectIds(
  client: HubSpotClient,
  objectType: string,
  opts: { limit: number; pageSize: number; archived: boolean },
): Promise<string[]> {
  const objectSegment = encodePathSegment(objectType, "object");
  const ids: string[] = [];
  let after: string | undefined;
  while (ids.length < opts.limit) {
    const params = new URLSearchParams();
    params.set("limit", String(Math.min(opts.pageSize, opts.limit - ids.length)));
    params.set("archived", String(opts.archived));
    if (after) params.set("after", after);
    const page = await client.request(`/crm/v3/objects/${objectSegment}?${params.toString()}`) as HubSpotListPage;
    for (const row of page.results ?? []) {
      if (row.id) ids.push(row.id);
      if (ids.length >= opts.limit) break;
    }
    after = page.paging?.next?.after;
    if (!after || (page.results ?? []).length === 0) break;
  }
  return ids;
}

async function batchReadObjectRecords(
  client: HubSpotClient,
  objectType: string,
  ids: string[],
  properties: string[],
): Promise<Array<{ id?: string; properties: Record<string, unknown> }>> {
  const objectSegment = encodePathSegment(objectType, "object");
  const out: Array<{ id?: string; properties: Record<string, unknown> }> = [];
  for (let i = 0; i < ids.length; i += MAX_BATCH_READ_SIZE) {
    const inputs = ids.slice(i, i + MAX_BATCH_READ_SIZE).map((id) => ({ id }));
    const res = await client.request(`/crm/v3/objects/${objectSegment}/batch/read`, {
      method: "POST",
      permissionMode: "read",
      body: { properties, inputs },
    }) as HubSpotListPage;
    for (const row of res.results ?? []) {
      out.push({ id: row.id, properties: row.properties ?? {} });
    }
  }
  return out;
}

function buildFillRateRows(
  records: Array<{ properties: Record<string, unknown> }>,
  properties: string[],
  schemaByName: Map<string | undefined, HubSpotProperty>,
): Array<Record<string, unknown>> {
  return properties.map((property) => {
    const filled = records.filter((record) => !isBlank(record.properties[property])).length;
    const blank = records.length - filled;
    const schema = schemaByName.get(property);
    return compactObject({
      property,
      label: schema?.label,
      type: schema?.type,
      fieldType: schema?.fieldType,
      filled,
      blank,
      fillRate: records.length === 0 ? 0 : filled / records.length,
    });
  });
}

function buildPropertyDistribution(
  records: Array<{ properties: Record<string, unknown> }>,
  property: string,
  top: number,
): { blank: number; distinct: number; results: Array<{ value: string; count: number; percent: number }> } {
  const counts = new Map<string, number>();
  let blank = 0;
  for (const record of records) {
    const value = record.properties[property];
    if (isBlank(value)) {
      blank += 1;
      continue;
    }
    for (const part of splitPropertyValue(value)) {
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }
  }
  const results = [...counts.entries()]
    .map(([value, count], index) => ({ value, count, percent: records.length === 0 ? 0 : count / records.length, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, top);
  return { blank, distinct: counts.size, results: results.map(({ index: _index, ...row }) => row) };
}

async function pullEmailRecipients(
  client: HubSpotClient,
  opts: {
    campaignIds: string[];
    eventTypes: string[];
    limitPerEvent: number;
    pageSize: number;
    startTimestamp?: string;
    endTimestamp?: string;
  },
): Promise<EmailRecipientAccumulator[]> {
  const byKey = new Map<string, EmailRecipientAccumulator>();
  for (const campaignId of opts.campaignIds) {
    for (const eventType of opts.eventTypes) {
      const events = await fetchEmailEvents(client, campaignId, eventType, opts);
      for (const event of events) {
        const email = normalizeEmail(event.recipient ?? event.email ?? event.recipientEmail);
        if (!email) continue;
        const key = `${campaignId}\n${email}`;
        const row = byKey.get(key) ?? {
          campaignId,
          email,
          events: new Set<string>(),
          bounceCategories: new Set<string>(),
          bounceStatuses: new Set<string>(),
        };
        row.events.add((event.type ?? eventType).toUpperCase());
        if (event.created !== undefined) {
          row.firstEventAt = row.firstEventAt === undefined ? event.created : Math.min(row.firstEventAt, event.created);
          row.lastEventAt = row.lastEventAt === undefined ? event.created : Math.max(row.lastEventAt, event.created);
        }
        if ((event.type ?? eventType).toUpperCase() === "BOUNCE") {
          for (const category of bounceCategories(event)) row.bounceCategories.add(category);
          for (const status of bounceStatuses(event)) row.bounceStatuses.add(status);
        }
        byKey.set(key, row);
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.campaignId.localeCompare(b.campaignId) || a.email.localeCompare(b.email));
}

async function fetchEmailEvents(
  client: HubSpotClient,
  campaignId: string,
  eventType: string,
  opts: { limitPerEvent: number; pageSize: number; startTimestamp?: string; endTimestamp?: string },
): Promise<EmailEvent[]> {
  const out: EmailEvent[] = [];
  let offset: string | undefined;
  while (out.length < opts.limitPerEvent) {
    const params = new URLSearchParams();
    params.set("campaignId", campaignId);
    params.set("eventType", eventType);
    params.set("limit", String(Math.min(opts.pageSize, opts.limitPerEvent - out.length)));
    if (opts.startTimestamp) params.set("startTimestamp", opts.startTimestamp);
    if (opts.endTimestamp) params.set("endTimestamp", opts.endTimestamp);
    if (offset) params.set("offset", offset);
    const page = await client.request(`/email/public/v1/events?${params.toString()}`) as EmailEventsPage;
    const events = page.events ?? page.results ?? [];
    out.push(...events.slice(0, opts.limitPerEvent - out.length));
    offset = page.offset;
    if (!page.hasMore || !offset || events.length === 0) break;
  }
  return out;
}

async function enrichRecipientsWithContacts(
  client: HubSpotClient,
  recipients: EmailRecipientAccumulator[],
  properties: string[],
): Promise<void> {
  const emails = [...new Set(recipients.map((recipient) => recipient.email))];
  const byEmail = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < emails.length; i += MAX_BATCH_READ_SIZE) {
    const inputs = emails.slice(i, i + MAX_BATCH_READ_SIZE).map((email) => ({ id: email }));
    const res = await client.request("/crm/v3/objects/contacts/batch/read", {
      method: "POST",
      permissionMode: "read",
      body: { idProperty: "email", properties, inputs },
    }) as HubSpotListPage;
    for (const row of res.results ?? []) {
      const email = normalizeEmail(row.properties?.email);
      if (email) byEmail.set(email, row.properties ?? {});
    }
  }
  for (const recipient of recipients) {
    recipient.contactProperties = byEmail.get(recipient.email);
  }
}

function formatEmailRecipient(row: EmailRecipientAccumulator): Record<string, unknown> {
  const events = [...row.events].sort();
  const received = events.some((event) => event === "DELIVERED" || event === "OPEN" || event === "CLICK");
  const hardBounce = isHardBounce(row);
  const softBounce = !hardBounce && isSoftBounce(row);
  const notDeliveredReason = received
    ? ""
    : hardBounce
      ? "Hard bounce"
      : softBounce
        ? "Soft bounce"
        : events.includes("SUPPRESSED")
          ? "Suppressed"
          : events.includes("DROPPED")
            ? "Dropped"
            : events.includes("DEFERRED")
              ? "Deferred"
              : events.includes("SENT")
                ? "Sent, no delivery event"
                : "";
  return compactObject({
    campaignId: row.campaignId,
    email: row.email,
    events,
    received,
    hardBounce,
    softBounce,
    notDeliveredReason,
    contactProperties: row.contactProperties,
  });
}

async function countObject(
  client: HubSpotClient,
  objectType: string,
  filterGroups: unknown,
): Promise<number> {
  const objectSegment = encodePathSegment(objectType, "object");
  const body: Record<string, unknown> = { limit: 1 };
  if (filterGroups !== undefined) body.filterGroups = Array.isArray(filterGroups) ? filterGroups : [filterGroups];
  const res = await client.request(`/crm/v3/objects/${objectSegment}/search`, {
    method: "POST",
    permissionMode: "read",
    body,
  }) as HubSpotSearchCount;
  return Number(res.total ?? 0);
}

function isHardBounce(row: EmailRecipientAccumulator): boolean {
  return [...row.bounceStatuses].some((status) => status.startsWith("5"))
    || [...row.bounceCategories].some((category) => HARD_BOUNCE_CATEGORIES.has(category));
}

function isSoftBounce(row: EmailRecipientAccumulator): boolean {
  return [...row.bounceStatuses].some((status) => status.startsWith("4"))
    || [...row.bounceCategories].some((category) => SOFT_BOUNCE_CATEGORIES.has(category))
    || row.events.has("BOUNCE");
}

function bounceCategories(event: EmailEvent): string[] {
  const raw = event.category;
  if (!raw) return [];
  return String(raw).split(/[,;]/).map((category) => category.trim().toUpperCase()).filter(Boolean);
}

function bounceStatuses(event: EmailEvent): string[] {
  const explicit = event.status !== undefined ? [String(event.status)] : [];
  const fromResponse = String(event.response ?? "").match(/\b[45]\d{2}\b/g) ?? [];
  return [...new Set([...explicit, ...fromResponse])];
}

function splitPropertyValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((part) => part.trim()).filter(Boolean);
  return String(value).split(";").map((part) => part.trim()).filter(Boolean);
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function splitCsv(raw: string): string[] {
  return String(raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseRequired(raw: string | undefined, flagName: string): string {
  const value = raw?.trim();
  if (!value) throw new CliError("INVALID_FLAG", `${flagName} is required`);
  return value;
}

function parsePositiveInt(raw: string, flagName: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new CliError("INVALID_FLAG", `${flagName} must be a positive integer`);
  return parsed;
}

function parsePageSize(raw: string): number {
  return Math.min(MAX_OBJECT_PAGE_SIZE, parsePositiveInt(raw, "--page-size"));
}

function parseBoolean(raw: string | undefined, flagName: string): boolean {
  if (raw === undefined) return false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new CliError("INVALID_FLAG", `${flagName} must be true or false`);
}

function parseJson(raw: string, flagName: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new CliError("INVALID_JSON", `${flagName} must be valid JSON`);
  }
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compactObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
