import { Command } from "commander";
import { createClient, HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";
import { addBrowserSessionOptions, resolveBrowserSession, type BrowserSessionOptions } from "../internal-session.js";

function resolvePermissionSetSession(
  ctx: CliContext,
  opts: BrowserSessionOptions,
): { client: HubSpotClient; portalId: string } {
  const session = resolveBrowserSession(ctx, opts, "Permission-set commands", true);
  return { client: session.client, portalId: session.portalId! };
}

function resolveBusinessUnitSession(
  ctx: CliContext,
  opts: BrowserSessionOptions,
  requirePortalId = false,
): { client: HubSpotClient; portalId?: string } {
  return resolveBrowserSession(ctx, opts, "Business-unit internal commands", requirePortalId);
}

function permissionSetsPath(portalId: string): string {
  return `/api/app-users/v1/permission-sets?portalId=${encodeURIComponent(portalId)}`;
}

function permissionSetPath(portalId: string, id: string): string {
  return `/api/app-users/v1/permission-sets/${encodePathSegment(id, "permissionSetId")}?portalId=${encodeURIComponent(portalId)}`;
}

function businessUnitsInternalPath(portalId?: string): string {
  const query = portalId ? `?portalId=${encodeURIComponent(portalId)}` : "";
  return `/api/business-units/v1/business-units${query}`;
}

async function maybeWritePermissionSetWithRoleRetry(
  ctx: CliContext,
  client: HubSpotClient,
  method: "POST" | "PUT" | "PATCH",
  path: string,
  body: Record<string, unknown>,
  stripUnknownRoles: boolean,
): Promise<unknown> {
  try {
    return await maybeWrite(ctx, client, method, path, body);
  } catch (error) {
    const missingRoles = stripUnknownRoles ? extractMissingRoles(error) : [];
    const strippedBody = missingRoles.length > 0 ? stripRoles(body, missingRoles) : undefined;
    if (!strippedBody) throw error;

    const result = await maybeWrite(ctx, client, method, path, strippedBody);
    return {
      result,
      strippedRoleNames: missingRoles,
    };
  }
}

async function findExistingPermissionSetByName(
  client: HubSpotClient,
  portalId: string,
  name: string,
): Promise<Record<string, unknown> | undefined> {
  const response = await client.request(permissionSetsPath(portalId));
  return extractPermissionSets(response).find((item) => item.name === name);
}

function extractPermissionSets(response: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];
  for (const key of ["results", "permissionSets", "items"]) {
    const value = response[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function buildBusinessUnitIdMapSeed(response: unknown): Record<string, Record<string, unknown>> {
  const seed: Record<string, Record<string, unknown>> = {};
  for (const unit of extractBusinessUnits(response)) {
    const id = firstString(
      stringFromUnknown(unit.id),
      stringFromUnknown(unit.businessUnitId),
      stringFromUnknown(unit.unitId),
    );
    if (!id) continue;
    seed[id] = {
      sourceName: firstString(stringFromUnknown(unit.name), stringFromUnknown(unit.label)),
      target_id: "",
    };
  }
  return seed;
}

function extractBusinessUnits(response: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];
  for (const key of ["results", "businessUnits", "items"]) {
    const value = response[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  const data = isRecord(response.data) ? response.data : undefined;
  if (data) {
    for (const key of ["results", "businessUnits", "items"]) {
      const value = data[key];
      if (Array.isArray(value)) return value.filter(isRecord);
    }
  }
  return [];
}

async function findExistingBusinessUnitByName(
  client: HubSpotClient,
  name: string,
  portalId?: string,
): Promise<Record<string, unknown> | undefined> {
  const response = await client.request(businessUnitsInternalPath(portalId));
  return extractBusinessUnits(response).find((unit) => unit.name === name);
}

function normalizeBusinessUnitCreatePayload(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new CliError("INVALID_BUSINESS_UNIT_PAYLOAD", "Business-unit create payload must be a JSON object.");
  }
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    throw new CliError("BUSINESS_UNIT_NAME_REQUIRED", "Business-unit create payload requires a non-empty name.");
  }
  const payload: Record<string, unknown> = { name };
  for (const key of ["label", "description", "logoMetadata"]) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== "") payload[key] = raw[key];
  }
  return payload;
}

function stringFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function extractMissingRoles(error: unknown): string[] {
  if (!(error instanceof CliError) || error.status !== 400) return [];
  const details = error.details === undefined ? error.message : JSON.stringify(error.details);
  const match = details.match(/Cannot find roles\s*\[([^\]]+)\]/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((role) => role.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function stripRoles(body: Record<string, unknown>, rolesToStrip: string[]): Record<string, unknown> | undefined {
  const roles = Array.isArray(body.roleNames) ? body.roleNames.filter((role): role is string => typeof role === "string") : [];
  if (roles.length === 0) return undefined;
  const missing = new Set(rolesToStrip);
  const kept = roles.filter((role) => !missing.has(role));
  if (kept.length === roles.length) return undefined;
  return { ...body, roleNames: kept };
}

function firstString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeUserCreatePayload(raw: unknown, allowInviteEmail: boolean): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new CliError("INVALID_USER_PAYLOAD", "User create payload must be a JSON object.");
  }
  const payload = { ...raw };
  const inviteFields = [
    payload.sendWelcomeEmail === true ? "sendWelcomeEmail=true" : undefined,
    payload.sendInviteEmail === true ? "sendInviteEmail=true" : undefined,
    payload.skipInviteEmail === false ? "skipInviteEmail=false" : undefined,
  ].filter(Boolean);

  if (!allowInviteEmail && inviteFields.length > 0) {
    throw new CliError(
      "USER_INVITE_EMAIL_BLOCKED",
      `User invite email blocked by default (${inviteFields.join(", ")}). Set sendWelcomeEmail:false or pass --allow-invite-email.`,
    );
  }
  if (!allowInviteEmail) {
    payload.sendWelcomeEmail = false;
  }
  return payload;
}

export function registerSettings(program: Command, getCtx: () => CliContext): void {
  const settings = program.command("settings").description("HubSpot Settings APIs");

  // Users
  const users = settings.command("users").description("User provisioning");

  users
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/settings/v3/users/?${params.toString()}`);
      printResult(ctx, res);
    });

  users.command("get").argument("<userId>").action(async (userId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/settings/v3/users/${encodePathSegment(userId, "userId")}`);
    printResult(ctx, res);
  });

  users
    .command("create")
    .requiredOption("--data <payload>", "User creation payload JSON")
    .option("--allow-invite-email", "Allow the create payload to send welcome/invite email")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = normalizeUserCreatePayload(parseJsonPayload(opts.data), Boolean(opts.allowInviteEmail));
      const res = await maybeWrite(ctx, client, "POST", "/settings/v3/users/", payload);
      printResult(ctx, res);
    });

  users
    .command("update")
    .argument("<userId>")
    .requiredOption("--data <payload>", "User update payload JSON")
    .action(async (userId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PUT", `/settings/v3/users/${encodePathSegment(userId, "userId")}`, payload);
      printResult(ctx, res);
    });

  users
    .command("delete")
    .argument("<userId>")
    .action(async (userId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "DELETE", `/settings/v3/users/${encodePathSegment(userId, "userId")}`);
      printResult(ctx, res);
    });

  users
    .command("roles")
    .description("List available user roles")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/settings/v3/users/roles");
      printResult(ctx, res);
    });

  // Business Units
  const businessUnits = settings.command("business-units").description("Business unit management");

  businessUnits
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/settings/v3/business-units/?${params.toString()}`);
      printResult(ctx, res);
    });

  addBrowserSessionOptions(
    businessUnits
      .command("capture")
      .description("Capture full business-unit metadata via internal HubSpot session-auth endpoint")
      .option("--include-id-map-seed", "Include a source-ID keyed business-unit map seed"),
  ).action(async (opts) => {
    const ctx = getCtx();
    const { client, portalId } = resolveBusinessUnitSession(ctx, opts);
    const res = await client.request(businessUnitsInternalPath(portalId));
    printResult(ctx, opts.includeIdMapSeed ? { result: res, idMapSeed: buildBusinessUnitIdMapSeed(res) } : res);
  });

  addBrowserSessionOptions(
    businessUnits
      .command("create-internal")
      .description("Create a business unit via the internal browser-session endpoint")
      .requiredOption("--data <payload>", "Business-unit payload JSON: { name, label?, description?, logoMetadata? }")
      .option("--skip-existing", "Skip create when a target business unit with the same name already exists"),
  ).action(async (opts) => {
    const ctx = getCtx();
    const { client, portalId } = resolveBusinessUnitSession(ctx, opts, true);
    const payload = normalizeBusinessUnitCreatePayload(parseJsonPayload(opts.data));

    if (!ctx.dryRun && opts.skipExisting) {
      const existing = await findExistingBusinessUnitByName(client, String(payload.name), portalId);
      if (existing) {
        printResult(ctx, { skipped: true, reason: "business-unit-exists", matchKey: "name", existing });
        return;
      }
    }

    const res = await maybeWrite(ctx, client, "POST", businessUnitsInternalPath(portalId), payload);
    printResult(ctx, res);
  });

  // Teams
  const teams = settings.command("teams").description("Team management");

  teams
    .command("list")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/settings/v3/users/teams");
      printResult(ctx, res);
    });

  // Permission sets — internal HubSpot endpoint, requires browser session cookies.
  const permissionSets = settings.command("permission-sets").description("Permission-set management via internal HubSpot session-auth endpoint");

  addBrowserSessionOptions(permissionSets.command("list"))
    .action(async (opts) => {
      const ctx = getCtx();
      const { client, portalId } = resolvePermissionSetSession(ctx, opts);
      const res = await client.request(permissionSetsPath(portalId));
      printResult(ctx, res);
    });

  addBrowserSessionOptions(permissionSets.command("get").argument("<id>"))
    .action(async (id, opts) => {
      const ctx = getCtx();
      const { client, portalId } = resolvePermissionSetSession(ctx, opts);
      const res = await client.request(permissionSetPath(portalId, id));
      printResult(ctx, res);
    });

  addBrowserSessionOptions(
    permissionSets.command("create")
      .requiredOption("--data <payload>", "Permission-set payload JSON: { name, description?, roleNames[] }")
      .option("--skip-existing", "Fetch existing permission sets first and skip when name already exists")
      .option("--no-strip-unknown-roles", "Do not auto-retry after removing roles rejected by HubSpot"),
  ).action(async (opts) => {
    const ctx = getCtx();
    const { client, portalId } = resolvePermissionSetSession(ctx, opts);
    const payload = parseJsonPayload(opts.data);
    const path = permissionSetsPath(portalId);

    if (!ctx.dryRun && opts.skipExisting) {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!name) throw new CliError("PERMISSION_SET_NAME_REQUIRED", "--skip-existing requires payload.name.");
      const existing = await findExistingPermissionSetByName(client, portalId, name);
      if (existing) {
        printResult(ctx, { skipped: true, reason: "permission-set-exists", existing });
        return;
      }
    }

    const res = await maybeWritePermissionSetWithRoleRetry(ctx, client, "POST", path, payload, opts.stripUnknownRoles !== false);
    printResult(ctx, res);
  });

  addBrowserSessionOptions(
    permissionSets.command("update")
      .argument("<id>")
      .requiredOption("--data <payload>", "Permission-set update payload JSON")
      .option("--method <method>", "HTTP method for update: PUT|PATCH", "PUT")
      .option("--no-strip-unknown-roles", "Do not auto-retry after removing roles rejected by HubSpot"),
  ).action(async (id, opts) => {
    const ctx = getCtx();
    const method = String(opts.method).trim().toUpperCase();
    if (method !== "PUT" && method !== "PATCH") {
      throw new CliError("INVALID_FLAG", "--method must be PUT or PATCH");
    }
    const { client, portalId } = resolvePermissionSetSession(ctx, opts);
    const payload = parseJsonPayload(opts.data);
    const res = await maybeWritePermissionSetWithRoleRetry(
      ctx,
      client,
      method,
      permissionSetPath(portalId, id),
      payload,
      opts.stripUnknownRoles !== false,
    );
    printResult(ctx, res);
  });

  addBrowserSessionOptions(permissionSets.command("delete").argument("<id>"))
    .action(async (id, opts) => {
      const ctx = getCtx();
      const { client, portalId } = resolvePermissionSetSession(ctx, opts);
      const res = await maybeWrite(ctx, client, "DELETE", permissionSetPath(portalId, id));
      printResult(ctx, res);
    });

  // Currencies
  const currencies = settings.command("currencies").description("Multi-currency management");

  currencies
    .command("list")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/settings/v3/currencies");
      printResult(ctx, res);
    });

  // Audit Logs
  const auditLogs = settings.command("audit-logs").description("Account audit logs");

  auditLogs
    .command("list")
    .description("List HubSpot account audit-log events (/account-info/v3/activity/audit-logs)")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .option("--occurred-before <iso>", "Events that occurred before this ISO-8601 datetime")
    .option("--occurred-after <iso>", "Events that occurred after this ISO-8601 datetime")
    .option("--acting-user-id <id>", "Filter by the user id that performed the action")
    .option("--event-type <type>", "Filter by event type (e.g. USER_LOGIN, PERMISSION_CHANGE)")
    .option("--object-type <type>", "Filter by the object type the action was performed on")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      if (opts.occurredBefore) params.set("occurredBefore", opts.occurredBefore);
      if (opts.occurredAfter) params.set("occurredAfter", opts.occurredAfter);
      if (opts.actingUserId) params.set("actingUserId", opts.actingUserId);
      if (opts.eventType) params.set("eventType", opts.eventType);
      if (opts.objectType) params.set("objectType", opts.objectType);
      const res = await client.request(`/account-info/v3/activity/audit-logs?${params.toString()}`);
      printResult(ctx, res);
    });

  // GDPR
  const gdpr = settings.command("gdpr").description("GDPR compliance tools");

  gdpr
    .command("delete-contact")
    .requiredOption("--data <payload>", "GDPR delete payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/crm/v3/objects/contacts/gdpr-delete", payload);
      printResult(ctx, res);
    });
}
