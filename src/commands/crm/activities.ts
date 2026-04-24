import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { createClient, type HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, parseNumberFlag } from "./shared.js";

const DEFAULT_ENGAGEMENT_TYPES = ["notes", "emails", "calls", "tasks", "meetings"];
const DEFAULT_HISTORY_PROPERTIES = [
  "createdate",
  "lifecyclestage",
  "hubspot_owner_id",
  "hs_analytics_source",
  "hs_analytics_source_data_1",
  "hs_analytics_source_data_2",
  "hs_latest_source",
  "hs_latest_source_data_1",
  "hs_latest_source_data_2",
  "hs_object_source",
  "hs_object_source_label",
];

const OBJECT_TYPE_IDS: Record<string, string> = {
  contacts: "0-1",
  contact: "0-1",
  companies: "0-2",
  company: "0-2",
  deals: "0-3",
  deal: "0-3",
  tickets: "0-5",
  ticket: "0-5",
};

const ENGAGEMENT_PROPERTIES: Record<string, string[]> = {
  notes: ["hs_timestamp", "hs_note_body", "hs_attachment_ids", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate"],
  emails: ["hs_timestamp", "hs_email_subject", "hs_email_text", "hs_email_html", "hs_email_direction", "hs_email_status", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate"],
  calls: ["hs_timestamp", "hs_call_title", "hs_call_body", "hs_call_duration", "hs_call_direction", "hs_call_disposition", "hs_call_recording_url", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate"],
  tasks: ["hs_timestamp", "hs_task_subject", "hs_task_body", "hs_task_status", "hs_task_priority", "hs_task_type", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate"],
  meetings: ["hs_timestamp", "hs_meeting_title", "hs_meeting_body", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate"],
};

type CapturedResponse = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; status?: number } };

function parseCsv(raw: string | undefined, fallback: string[]): string[] {
  const source = raw?.trim() ? raw : fallback.join(",");
  return source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function serializeError(err: unknown): { code: string; message: string; status?: number } {
  if (err && typeof err === "object") {
    const record = err as { code?: unknown; message?: unknown; status?: unknown };
    return {
      code: typeof record.code === "string" ? record.code : "REQUEST_FAILED",
      message: typeof record.message === "string" ? record.message : String(err),
      ...(typeof record.status === "number" ? { status: record.status } : {}),
    };
  }
  return { code: "REQUEST_FAILED", message: String(err) };
}

async function capture(client: HubSpotClient, path: string, options?: { method?: "POST"; body?: unknown }): Promise<CapturedResponse> {
  try {
    return { ok: true, data: await client.request(path, options) };
  } catch (err) {
    return { ok: false, error: serializeError(err) };
  }
}

function responseResults(value: CapturedResponse): Array<Record<string, unknown>> {
  if (!value.ok || !value.data || typeof value.data !== "object" || Array.isArray(value.data)) return [];
  const results = (value.data as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item));
}

function associationIds(value: CapturedResponse): string[] {
  return responseResults(value)
    .map((item) => item.toObjectId ?? item.id)
    .filter((id): id is string | number => typeof id === "string" || typeof id === "number")
    .map(String);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function objectTypeIdFor(objectType: string, override?: string): string {
  if (override?.trim()) return override.trim();
  return OBJECT_TYPE_IDS[objectType.trim().toLowerCase()] ?? objectType;
}

async function exportEngagementType(
  client: HubSpotClient,
  objectTypeSegment: string,
  recordIdSegment: string,
  engagementType: string,
  limit: number,
): Promise<{ associations: CapturedResponse; ids: string[]; batches: CapturedResponse[] }> {
  const engagementTypeSegment = encodePathSegment(engagementType, "engagementType");
  const associations = await capture(
    client,
    `/crm/v4/objects/${objectTypeSegment}/${recordIdSegment}/associations/${engagementTypeSegment}?limit=${limit}`,
  );
  const ids = associationIds(associations);
  const batches: CapturedResponse[] = [];
  const properties = ENGAGEMENT_PROPERTIES[engagementType] ?? ["hs_timestamp", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate"];
  for (const idChunk of chunk(ids, 100)) {
    batches.push(await capture(client, `/crm/v3/objects/${engagementTypeSegment}/batch/read`, {
      method: "POST",
      body: {
        properties,
        inputs: idChunk.map((id) => ({ id })),
      },
    }));
  }
  return { associations, ids, batches };
}

async function exportMemberships(
  client: HubSpotClient,
  objectTypeId: string,
  recordIdSegment: string,
  hydrateLists: boolean,
): Promise<{ memberships: CapturedResponse; lists?: Record<string, CapturedResponse> }> {
  const memberships = await capture(
    client,
    `/crm/v3/lists/records/${encodePathSegment(objectTypeId, "objectTypeId")}/${recordIdSegment}/memberships`,
  );
  if (!hydrateLists) return { memberships };
  const lists: Record<string, CapturedResponse> = {};
  for (const membership of responseResults(memberships)) {
    const listId = membership.listId;
    if (typeof listId !== "string" && typeof listId !== "number") continue;
    const key = String(listId);
    if (lists[key]) continue;
    lists[key] = await capture(client, `/crm/v3/lists/${encodePathSegment(key, "listId")}`);
  }
  return { memberships, lists };
}

export function registerActivities(crm: Command, getCtx: () => CliContext): void {
  const activities = crm.command("activities").description("Recoverable CRM activity export helpers");

  activities
    .command("export")
    .description("Export recoverable activities for one CRM record: engagements, segment memberships, and selected property history")
    .argument("<objectType>")
    .argument("<recordId>")
    .option("--engagement-types <csv>", "Engagement object types to include", DEFAULT_ENGAGEMENT_TYPES.join(","))
    .option("--history-properties <csv>", "Properties to request with history", DEFAULT_HISTORY_PROPERTIES.join(","))
    .option("--membership-object-type-id <id>", "Override Lists API objectTypeId, e.g. 0-1 for contacts")
    .option("--limit <n>", "Max association records per engagement type", "100")
    .option("--no-engagements", "Do not export associated notes/emails/calls/tasks/meetings")
    .option("--no-memberships", "Do not export segment/list memberships")
    .option("--no-list-details", "Do not hydrate list names/details for memberships")
    .option("--no-property-history", "Do not request propertiesWithHistory")
    .option("--out <file>", "Write the activity bundle to a JSON file")
    .action(async (objectType, recordId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectTypeSegment = encodePathSegment(objectType, "objectType");
      const recordIdSegment = encodePathSegment(recordId, "recordId");
      const limit = parseNumberFlag(opts.limit, "--limit");
      const historyProperties = parseCsv(opts.historyProperties, DEFAULT_HISTORY_PROPERTIES);

      const recordParams = new URLSearchParams();
      if (opts.propertyHistory) {
        recordParams.set("properties", historyProperties.join(","));
        recordParams.set("propertiesWithHistory", historyProperties.join(","));
      }
      const recordPath = `/crm/v3/objects/${objectTypeSegment}/${recordIdSegment}${recordParams.size ? `?${recordParams.toString()}` : ""}`;

      const engagements: Record<string, Awaited<ReturnType<typeof exportEngagementType>>> = {};
      if (opts.engagements) {
        for (const engagementType of parseCsv(opts.engagementTypes, DEFAULT_ENGAGEMENT_TYPES)) {
          engagements[engagementType] = await exportEngagementType(client, objectTypeSegment, recordIdSegment, engagementType, limit);
        }
      }

      const memberships = opts.memberships
        ? await exportMemberships(client, objectTypeIdFor(objectType, opts.membershipObjectTypeId), recordIdSegment, Boolean(opts.listDetails))
        : undefined;

      const bundle = {
        manifestVersion: 1,
        generatedAt: new Date().toISOString(),
        profile: ctx.profile,
        objectType,
        recordId,
        coverage: {
          recovered: [
            ...(opts.engagements ? ["notes", "emails", "calls", "tasks", "meetings"] : []),
            ...(opts.memberships ? ["current segment/list memberships with first/last added timestamps"] : []),
            ...(opts.propertyHistory ? ["selected property history such as lifecycle stage, owner, source, createdate"] : []),
          ],
          limits: [
            "HubSpot does not expose the full CRM record activity feed as one public replay endpoint.",
            "Segment/list membership export captures membership state/timestamps available from the Lists API; removed historical memberships may not be present.",
            "Created-from and moved-to-stage UI cards are reconstructed from object properties/history where available, not copied as native activity cards.",
          ],
        },
        record: await capture(client, recordPath),
        memberships,
        engagements,
      };

      if (opts.out) {
        writeFileSync(String(opts.out), `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
      }
      printResult(ctx, opts.out ? { written: opts.out, ...bundle } : bundle);
    });
}
