import { Command } from "commander";
import { createClient } from "../../core/http.js";
import { loadFlatIdMapFile, stringifyId, type FlatIdMap } from "../../core/id-maps.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";
import { addBrowserSessionOptions, resolveBrowserSession } from "../internal-session.js";

type BusinessUnitMode = "strict" | "drop" | "preserve";

export function registerCommunicationPreferences(program: Command, getCtx: () => CliContext): void {
  const commPrefs = program.command("communication-preferences").description("HubSpot communication preferences / subscription management");

  commPrefs
    .command("subscription-types")
    .description("List subscription types")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/communication-preferences/v3/definitions");
      printResult(ctx, res);
    });

  const definitions = commPrefs.command("definitions").description("Subscription definition replay helpers");

  definitions
    .command("list")
    .description("List subscription definitions")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/communication-preferences/v3/definitions");
      printResult(ctx, res);
    });

  definitions
    .command("create")
    .description("Create a subscription definition with optional business-unit ID remapping")
    .requiredOption("--data <payload>", "Subscription definition JSON payload")
    .option("--business-unit-map <file>", "ID map JSON for businessUnitId remapping")
    .option("--business-unit-mode <mode>", "How to handle unmapped businessUnitId: strict|drop|preserve", "strict")
    .option("--skip-existing", "Skip create when a target definition with the same name already exists")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = normalizeSubscriptionDefinitionPayload(
        parseJsonPayload(opts.data),
        opts.businessUnitMap ? loadFlatIdMapFile(opts.businessUnitMap) : {},
        parseBusinessUnitMode(opts.businessUnitMode),
      );

      if (opts.skipExisting) {
        const name = typeof payload.name === "string" ? payload.name : undefined;
        if (!name) throw new CliError("INVALID_PAYLOAD", "--skip-existing requires payload.name");
        const existing = await findExistingDefinition(client, payload);
        if (existing) {
          printResult(ctx, { skipped: true, reason: "subscription-definition-exists", matchKey: "name+purpose+communicationMethod+businessUnitId", existing });
          return;
        }
      }

      const res = await maybeWrite(ctx, client, "POST", "/communication-preferences/v3/definitions", payload);
      printResult(ctx, res);
    });

  addBrowserSessionOptions(
    definitions
      .command("create-internal")
      .description("Create an Email > Subscription Types definition via the internal browser-session endpoint")
      .requiredOption("--data <payload>", "Subscription definition JSON payload")
      .option("--business-unit-map <file>", "ID map JSON for businessUnitId remapping")
      .option("--business-unit-mode <mode>", "How to handle unmapped businessUnitId: strict|drop|preserve", "strict")
      .option("--skip-existing", "Skip create when a target definition with the same composite key already exists"),
  ).action(async (opts) => {
    const ctx = getCtx();
    const payload = normalizeSubscriptionDefinitionPayload(
      parseJsonPayload(opts.data),
      opts.businessUnitMap ? loadFlatIdMapFile(opts.businessUnitMap) : {},
      parseBusinessUnitMode(opts.businessUnitMode),
    );
    assertEmailSubscriptionDefinition(payload);
    const session = resolveBrowserSession(ctx, opts, "Internal subscription-definition commands", true);
    const publicClient = createClient(ctx.profile);
    const internalPayload = buildInternalSubscriptionDefinitionPayload(payload, session.portalId!);

    if (opts.skipExisting) {
      const existing = await findExistingDefinition(publicClient, payload);
      if (existing) {
        printResult(ctx, { skipped: true, reason: "subscription-definition-exists", matchKey: "name+purpose+communicationMethod+businessUnitId", existing });
        return;
      }
    }

    const path = `/api/subscriptions/v1/definitions?portalId=${encodeURIComponent(session.portalId!)}`;
    const res = await maybeWrite(ctx, session.client, "POST", path, internalPayload);
    printResult(ctx, res);
  });

  commPrefs
    .command("status")
    .argument("<email>")
    .description("Get subscription status for an email address")
    .action(async (email) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request(`/communication-preferences/v3/status/email/${encodePathSegment(email, "email")}`);
      printResult(ctx, res);
    });

  commPrefs
    .command("subscribe")
    .requiredOption("--data <payload>", "Subscribe payload JSON (emailAddress, subscriptionId)")
    .description("Subscribe a contact")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication-preferences/v3/subscribe", payload);
      printResult(ctx, res);
    });

  commPrefs
    .command("unsubscribe")
    .requiredOption("--data <payload>", "Unsubscribe payload JSON (emailAddress, subscriptionId)")
    .description("Unsubscribe a contact")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication-preferences/v3/unsubscribe", payload);
      printResult(ctx, res);
    });

  // V4 batch endpoints (latest API, for portals using the new contact-centric preferences model)
  const v4 = commPrefs.command("v4").description("Communication Preferences v4 (contact-centric, batch-capable)");
  v4.command("status-batch-read")
    .description("Batch-read subscription statuses for up to 100 contacts")
    .requiredOption("--data <payload>", "Batch input JSON: { inputs: [{ subscriberIdString, channel, subscriptionId }, ...] }")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await client.request(
        "/communication-preferences/v4/statuses/batch/read",
        { method: "POST", body: payload, permissionMode: "read" },
      );
      printResult(ctx, res);
    });
  v4.command("status-update-batch")
    .description("Batch-update subscription statuses")
    .requiredOption("--data <payload>", "Batch update payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication-preferences/v4/statuses/batch/write", payload);
      printResult(ctx, res);
    });
  v4.command("subscribe-batch")
    .description("Batch-subscribe")
    .requiredOption("--data <payload>", "Batch subscribe payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication-preferences/v4/statuses/batch/write", payload);
      printResult(ctx, res);
    });
  v4.command("unsubscribe-batch")
    .description("Batch-unsubscribe")
    .requiredOption("--data <payload>", "Batch unsubscribe payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication-preferences/v4/statuses/batch/write", payload);
      printResult(ctx, res);
    });
  v4.command("subscriptions-list")
    .description("List subscription definitions (v4)")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/communication-preferences/v4/definitions");
      printResult(ctx, res);
    });
  v4.command("channels-list")
    .description("List supported channels (email, sms, whatsapp, etc.)")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/communication-preferences/v4/channels");
      printResult(ctx, res);
    });
}

function parseBusinessUnitMode(raw: string | undefined): BusinessUnitMode {
  if (raw === undefined || raw === "strict") return "strict";
  if (raw === "drop" || raw === "preserve") return raw;
  throw new CliError("INVALID_FLAG", "--business-unit-mode must be one of: strict, drop, preserve");
}

function normalizeSubscriptionDefinitionPayload(
  input: Record<string, unknown>,
  businessUnitMap: FlatIdMap,
  businessUnitMode: BusinessUnitMode,
): Record<string, unknown> {
  const payload = { ...input };
  delete payload.id;
  delete payload.createdAt;
  delete payload.updatedAt;

  const sourceBusinessUnitId = stringifyId(input.businessUnitId);
  if (!sourceBusinessUnitId) {
    delete payload.businessUnitId;
    return payload;
  }

  const mapped = businessUnitMap[sourceBusinessUnitId];
  if (mapped !== undefined) {
    payload.businessUnitId = toHubSpotIdValue(mapped);
    return payload;
  }

  if (businessUnitMode === "drop") {
    delete payload.businessUnitId;
    return payload;
  }
  if (businessUnitMode === "preserve") return payload;

  throw new CliError(
    "BUSINESS_UNIT_REMAP_REQUIRED",
    `Subscription definition references source businessUnitId ${sourceBusinessUnitId}. Provide --business-unit-map, use --business-unit-mode drop, or use --business-unit-mode preserve.`,
    undefined,
    { sourceBusinessUnitId },
  );
}

function buildInternalSubscriptionDefinitionPayload(input: Record<string, unknown>, portalId: string): Record<string, unknown> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new CliError("INVALID_PAYLOAD", "Internal subscription definition create requires payload.name.");
  const description = typeof input.description === "string" ? input.description : "";
  const primaryLanguage = firstString(
    typeof input.primaryLanguage === "string" ? input.primaryLanguage : undefined,
    typeof input.language === "string" ? input.language : undefined,
    "en",
  )!;
  return {
    portalId: Number(portalId) || portalId,
    primaryLanguage,
    name,
    description,
    process: valueOrEmpty(input.process ?? input.purpose),
    operation: valueOrEmpty(input.operation),
    ...(input.businessUnitId !== undefined ? { businessUnitId: toHubSpotIdValue(String(input.businessUnitId)) } : {}),
  };
}

function assertEmailSubscriptionDefinition(input: Record<string, unknown>): void {
  const rawChannel = firstString(
    typeof input.communicationMethod === "string" ? input.communicationMethod : undefined,
    typeof input.channel === "string" ? input.channel : undefined,
    typeof input.method === "string" ? input.method : undefined,
  );
  if (!rawChannel) return;
  const channel = rawChannel.toUpperCase();
  if (channel === "EMAIL") return;
  throw new CliError(
    "UNSUPPORTED_INTERNAL_SUBSCRIPTION_CHANNEL",
    `create-internal uses HubSpot's Email > Subscription Types endpoint and cannot safely create ${rawChannel} definitions. Probe/add a dedicated internal adapter for that channel.`,
    undefined,
    { channel: rawChannel },
  );
}

async function findExistingDefinition(
  client: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | undefined> {
  const res = await client.request("/communication-preferences/v3/definitions");
  const name = typeof payload.name === "string" ? payload.name : undefined;
  if (!name) return undefined;
  const candidates = extractDefinitionRecords(res).filter((record) => record.name === name);
  if (candidates.length === 0) return undefined;
  const exact = candidates.find((record) => isSameSubscriptionDefinition(record, payload));
  if (exact) return exact;
  if (candidates.length === 1 && !hasSubscriptionDisambiguators(payload)) return candidates[0];
  return undefined;
}

function extractDefinitionRecords(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw.filter(isRecord);
  const record = isRecord(raw) ? raw : {};
  const candidates = [
    record.results,
    record.subscriptionDefinitions,
    record.definitions,
    isRecord(record.data) ? record.data.results : undefined,
    isRecord(record.data) ? record.data.subscriptionDefinitions : undefined,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function toHubSpotIdValue(raw: string): string | number {
  const numeric = Number(raw);
  return Number.isSafeInteger(numeric) && String(numeric) === raw ? numeric : raw;
}

function firstString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function valueOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isSameSubscriptionDefinition(record: Record<string, unknown>, payload: Record<string, unknown>): boolean {
  if (record.name !== payload.name) return false;
  if (normalizeBusinessUnitId(record.businessUnitId) !== normalizeBusinessUnitId(payload.businessUnitId)) return false;
  const payloadPurpose = firstDefinitionText(payload, ["purpose", "process"]);
  if (payloadPurpose && normalizeText(firstDefinitionText(record, ["purpose", "process"])) !== normalizeText(payloadPurpose)) return false;
  const payloadMethod = firstDefinitionText(payload, ["communicationMethod", "operation", "channel", "method"]);
  if (payloadMethod && normalizeText(firstDefinitionText(record, ["communicationMethod", "operation", "channel", "method"])) !== normalizeText(payloadMethod)) return false;
  return true;
}

function hasSubscriptionDisambiguators(payload: Record<string, unknown>): boolean {
  return payload.businessUnitId !== undefined
    || Boolean(firstDefinitionText(payload, ["purpose", "process"]))
    || Boolean(firstDefinitionText(payload, ["communicationMethod", "operation", "channel", "method"]));
}

function normalizeBusinessUnitId(value: unknown): string {
  return stringifyId(value) ?? "0";
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstDefinitionText(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (hasText(value)) return value.trim();
  }
  return undefined;
}
