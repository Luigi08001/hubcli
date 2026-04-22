import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getHubcliHomeDir, getProfile, saveProfile, getApiBaseUrl } from "./auth.js";
import { CliError } from "./output.js";

type ProbeMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type CapabilityStatus = "supported" | "unsupported" | "unknown";

export interface EndpointCapabilityDefinition {
  id: string;
  label: string;
  pathPrefix: string;
  probePath: string;
  probeMethod: ProbeMethod;
  requiredScopes: string[];
  scopeHints: string[];
  tierHint?: string;
  fallbackCommand: string;
}

interface CachedCapabilityStatus {
  status: CapabilityStatus;
  statusCode?: number;
  checkedAt: string;
  note?: string;
}

interface CapabilityCacheEntry {
  key: string;
  portalId: string;
  scopes: string[];
  profile: string;
  probedAt: string;
  updatedAt: string;
  expiresAt: string;
  capabilities: Record<string, CachedCapabilityStatus>;
}

interface CapabilityCacheFile {
  version: 1;
  entries: CapabilityCacheEntry[];
}

interface PortalContext {
  portalId: string;
  scopes: string[];
  source: "profile" | "token-info";
}

interface CapabilityContext {
  key: string;
  portalId: string;
  scopes: string[];
}

interface CapabilityLookup {
  status: CapabilityStatus;
  statusCode?: number;
  checkedAt?: string;
  reason: "missing_context" | "missing_entry" | "expired" | "cached";
  context?: CapabilityContext;
}

export interface CapabilityProbeResult {
  profile: string;
  portalId: string;
  scopes: string[];
  source: "profile" | "token-info";
  cacheKey: string;
  refreshed: boolean;
  cacheExpiresAt: string;
  ttlHours: number;
  summary: {
    supported: number;
    unsupported: number;
    unknown: number;
  };
  capabilities: Array<EndpointCapabilityDefinition & CachedCapabilityStatus>;
}

const CAPABILITY_CACHE_VERSION = 1;
const CAPABILITY_CACHE_FILENAME = "capabilities.json";
const DEFAULT_CAPABILITY_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 30_000;

const ENDPOINT_CAPABILITIES: EndpointCapabilityDefinition[] = [
  {
    id: "crm-core",
    label: "CRM core objects",
    pathPrefix: "/crm/v3/objects",
    probePath: "/crm/v3/objects/contacts?limit=1",
    probeMethod: "GET",
    requiredScopes: ["crm.objects.contacts.read"],
    scopeHints: ["crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"],
    tierHint: "Available on most HubSpot tiers with CRM object access",
    fallbackCommand: "hscli auth token-info",
  },
  {
    id: "marketing-emails",
    label: "Marketing emails API",
    pathPrefix: "/marketing/v3/emails",
    probePath: "/marketing/v3/emails?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["content", "content.read", "automation"],
    tierHint: "Often depends on Marketing Hub enablement and subscription tier",
    fallbackCommand: "hscli crm contacts list --limit 5",
  },
  {
    id: "marketing-campaigns",
    label: "Marketing campaigns API",
    pathPrefix: "/marketing/v3/campaigns",
    probePath: "/marketing/v3/campaigns?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["campaigns", "content", "content.read"],
    tierHint: "May require Marketing Hub tier and campaign tooling enabled",
    fallbackCommand: "hscli crm deals list --limit 5",
  },
  {
    id: "forms-v3",
    label: "Forms API",
    pathPrefix: "/marketing/v3/forms",
    probePath: "/marketing/v3/forms?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["forms", "forms-uploaded-files"],
    tierHint: "May vary with marketing/forms product availability",
    fallbackCommand: "hscli crm contacts list --limit 5",
  },
  {
    id: "files-v3",
    label: "Files API",
    pathPrefix: "/files/v3/files",
    probePath: "/files/v3/files?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["files", "files.ui_hidden.read"],
    tierHint: "Depends on Files tooling and app permissions",
    fallbackCommand: "hscli crm contacts list --limit 5",
  },
  {
    id: "cms-pages",
    label: "CMS pages API",
    pathPrefix: "/cms/v3/pages/site-pages",
    probePath: "/cms/v3/pages/site-pages?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["content", "content.read", "cms.pages.read"],
    tierHint: "Typically requires CMS Hub features in the target portal",
    fallbackCommand: "hscli marketing campaigns list --limit 5",
  },
  {
    id: "cms-blogs",
    label: "CMS blog posts API",
    pathPrefix: "/cms/v3/blogs/posts",
    probePath: "/cms/v3/blogs/posts?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["content", "content.read", "cms.blogs.read"],
    tierHint: "May require CMS Hub / blog tooling in portal",
    fallbackCommand: "hscli marketing emails list --limit 5",
  },
  {
    id: "workflows-flows",
    label: "Workflow automation API",
    pathPrefix: "/automation/v4/flows",
    probePath: "/automation/v4/flows?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["automation", "workflows"],
    tierHint: "Depends on workflow automation access by tier/product",
    fallbackCommand: "hscli crm contacts list --limit 5",
  },
  {
    id: "service-conversations",
    label: "Conversations API",
    pathPrefix: "/conversations/v3/conversations/threads",
    probePath: "/conversations/v3/conversations/threads?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["conversations.read", "tickets", "crm.objects.tickets.read"],
    tierHint: "Depends on Service Hub channels/conversations setup",
    fallbackCommand: "hscli crm tickets list --limit 5",
  },
  {
    id: "service-feedback",
    label: "Feedback submissions object",
    pathPrefix: "/crm/v3/objects/feedback_submissions",
    probePath: "/crm/v3/objects/feedback_submissions?limit=1",
    probeMethod: "GET",
    requiredScopes: [],
    scopeHints: ["crm.objects.feedback_submissions.read", "service"],
    tierHint: "Service Hub feedback tooling may be required",
    fallbackCommand: "hscli crm tickets list --limit 5",
  },
];

const SORTED_CAPABILITIES = ENDPOINT_CAPABILITIES
  .slice()
  .sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);

function normalizeScopes(scopes: string[]): string[] {
  return Array.from(new Set(
    scopes
      .map((scope) => scope.trim().toLowerCase())
      .filter(Boolean),
  )).sort();
}

function buildCapabilityKey(portalId: string, scopes: string[]): string {
  return `${portalId.trim()}|${normalizeScopes(scopes).join(",")}`;
}

function cachePaths(): { dir: string; file: string } {
  const dir = getHubcliHomeDir();
  return { dir, file: join(dir, CAPABILITY_CACHE_FILENAME) };
}

function readCapabilityCache(): CapabilityCacheFile {
  const { file } = cachePaths();
  if (!existsSync(file)) return { version: CAPABILITY_CACHE_VERSION, entries: [] };

  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<CapabilityCacheFile>;
    if (parsed.version !== CAPABILITY_CACHE_VERSION || !Array.isArray(parsed.entries)) {
      return { version: CAPABILITY_CACHE_VERSION, entries: [] };
    }
    return {
      version: CAPABILITY_CACHE_VERSION,
      entries: parsed.entries,
    };
  } catch {
    return { version: CAPABILITY_CACHE_VERSION, entries: [] };
  }
}

function writeCapabilityCache(cache: CapabilityCacheFile): void {
  const { dir, file } = cachePaths();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    chmodSync(dir, 0o700);
  }
  writeFileSync(file, JSON.stringify(cache, null, 2), { mode: 0o600 });
  if (process.platform !== "win32") {
    chmodSync(file, 0o600);
  }
}

function parseScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeScopes(value.filter((item): item is string => typeof item === "string"));
  }
  if (typeof value === "string") {
    return normalizeScopes(value.split(/\s+/));
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

async function safeJson(response: Response): Promise<unknown> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    try { return await response.json(); } catch { return {}; }
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function portalContextFromProfile(profileName: string): PortalContext | undefined {
  try {
    const profile = getProfile(profileName);
    if (!profile.portalId?.trim()) return undefined;
    const scopes = parseScopes(profile.scopes ?? []);
    if (scopes.length === 0) return undefined;
    return {
      portalId: profile.portalId.trim(),
      scopes,
      source: "profile",
    };
  } catch {
    return undefined;
  }
}

async function fetchPortalContext(token: string): Promise<{ portalId: string; scopes: string[] }> {
  const response = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(token)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    throw new CliError("CAPABILITY_TOKEN_INFO_FAILED", `Failed to resolve portal context (${response.status})`, response.status, payload);
  }

  const data = asRecord(payload);
  const hubIdRaw = data.hub_id;
  const portalId = typeof hubIdRaw === "number" || typeof hubIdRaw === "string"
    ? String(hubIdRaw).trim()
    : "";

  if (!portalId) {
    throw new CliError("CAPABILITY_TOKEN_INFO_INVALID", "Token info did not return hub_id", response.status, data);
  }

  const scopes = parseScopes(data.scopes ?? data.scope ?? []);
  return { portalId, scopes };
}

async function ensurePortalContext(profileName: string, token: string): Promise<PortalContext> {
  const fromProfile = portalContextFromProfile(profileName);
  if (fromProfile) return fromProfile;

  const tokenInfo = await fetchPortalContext(token);
  saveProfile(profileName, {
    token,
    portalId: tokenInfo.portalId,
    scopes: tokenInfo.scopes,
  });

  return {
    portalId: tokenInfo.portalId,
    scopes: tokenInfo.scopes,
    source: "token-info",
  };
}

function capabilityContextForProfile(profileName: string): CapabilityContext | undefined {
  const context = portalContextFromProfile(profileName);
  if (!context) return undefined;
  return {
    key: buildCapabilityKey(context.portalId, context.scopes),
    portalId: context.portalId,
    scopes: context.scopes,
  };
}

function resolveCapability(pathname: string): EndpointCapabilityDefinition | undefined {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return SORTED_CAPABILITIES.find((definition) => (
    normalized === definition.pathPrefix || normalized.startsWith(`${definition.pathPrefix}/`)
  ));
}

function classifyStatusCode(statusCode: number): CapabilityStatus {
  if (statusCode >= 200 && statusCode < 300) return "supported";
  if (statusCode === 403 || statusCode === 404) return "unsupported";
  return "unknown";
}

function lookupCapability(profileName: string, capabilityId: string): CapabilityLookup {
  const context = capabilityContextForProfile(profileName);
  if (!context) {
    return { status: "unknown", reason: "missing_context" };
  }

  const cache = readCapabilityCache();
  const entry = cache.entries.find((candidate) => candidate.key === context.key);
  if (!entry) {
    return { status: "unknown", reason: "missing_entry", context };
  }

  const expiresAtMs = Date.parse(entry.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    return { status: "unknown", reason: "expired", context };
  }

  const cached = entry.capabilities[capabilityId];
  if (!cached) {
    return { status: "unknown", reason: "cached", context };
  }

  return {
    status: cached.status,
    statusCode: cached.statusCode,
    checkedAt: cached.checkedAt,
    reason: "cached",
    context,
  };
}

function evaluateScopes(profileName: string, requiredScopes: string[]): "unknown" | "ok" | "missing" {
  if (requiredScopes.length === 0) return "ok";
  const context = portalContextFromProfile(profileName);
  if (!context) return "unknown";

  const granted = new Set(context.scopes.map((scope) => scope.toLowerCase()));
  const hasRequired = requiredScopes.some((required) => granted.has(required.toLowerCase()));
  return hasRequired ? "ok" : "missing";
}

function recordCapability(profileName: string, capabilityId: string, statusCode: number, note?: string): void {
  try {
    const context = capabilityContextForProfile(profileName);
    if (!context) return;

    const nowIso = new Date().toISOString();
    const cache = readCapabilityCache();
    const index = cache.entries.findIndex((entry) => entry.key === context.key);

    const status = classifyStatusCode(statusCode);
    const payload: CachedCapabilityStatus = {
      status,
      statusCode,
      checkedAt: nowIso,
      note,
    };

    if (index === -1) {
      cache.entries.push({
        key: context.key,
        portalId: context.portalId,
        scopes: context.scopes,
        profile: profileName,
        probedAt: nowIso,
        updatedAt: nowIso,
        expiresAt: new Date(Date.now() + DEFAULT_CAPABILITY_TTL_MS).toISOString(),
        capabilities: { [capabilityId]: payload },
      });
      writeCapabilityCache(cache);
      return;
    }

    const entry = cache.entries[index];
    const current = entry.capabilities[capabilityId];
    if (
      current &&
      current.status === payload.status &&
      current.statusCode === payload.statusCode &&
      current.note === payload.note
    ) {
      return;
    }

    entry.portalId = context.portalId;
    entry.scopes = context.scopes;
    entry.profile = profileName;
    entry.updatedAt = nowIso;
    entry.expiresAt = new Date(Date.now() + DEFAULT_CAPABILITY_TTL_MS).toISOString();
    entry.capabilities[capabilityId] = payload;
    writeCapabilityCache(cache);
  } catch {
    // Capability observation is best-effort; never break command execution.
  }
}

function formatCapabilityMessage(definition: EndpointCapabilityDefinition): string {
  return `Endpoint '${definition.pathPrefix}' appears unavailable for this portal/tier setup. Try '${definition.fallbackCommand}' or run 'hscli doctor capabilities --refresh'.`;
}

export function preflightEndpointCapability(options: {
  profile: string;
  path: string;
  strict: boolean;
}): void {
  const definition = resolveCapability(options.path);
  if (!definition) return;

  const scopeState = evaluateScopes(options.profile, definition.requiredScopes);
  if (options.strict && scopeState === "missing") {
    throw new CliError(
      "CAPABILITY_SCOPE_MISSING",
      `Token scopes do not satisfy '${definition.id}'. Run 'hscli auth token-info' and then 'hscli doctor capabilities --refresh'.`,
      undefined,
      {
        capabilityId: definition.id,
        requiredScopes: definition.requiredScopes,
        scopeHints: definition.scopeHints,
        fallbackCommand: definition.fallbackCommand,
      },
    );
  }

  const cached = lookupCapability(options.profile, definition.id);

  if (cached.status === "unsupported") {
    throw new CliError(
      "CAPABILITY_UNSUPPORTED",
      formatCapabilityMessage(definition),
      cached.statusCode,
      {
        capabilityId: definition.id,
        pathPrefix: definition.pathPrefix,
        fallbackCommand: definition.fallbackCommand,
        requiredScopes: definition.requiredScopes,
        scopeHints: definition.scopeHints,
        tierHint: definition.tierHint,
        cacheStatus: cached.status,
        cacheReason: cached.reason,
        checkedAt: cached.checkedAt,
        portalId: cached.context?.portalId,
      },
    );
  }

  if (options.strict && cached.status !== "supported") {
    throw new CliError(
      "CAPABILITY_UNKNOWN",
      `Capability '${definition.id}' is unknown for this portal. Run 'hscli doctor capabilities --refresh' first.`,
      undefined,
      {
        capabilityId: definition.id,
        pathPrefix: definition.pathPrefix,
        requiredScopes: definition.requiredScopes,
        scopeHints: definition.scopeHints,
        tierHint: definition.tierHint,
        cacheReason: cached.reason,
        fallbackCommand: definition.fallbackCommand,
      },
    );
  }
}

/**
 * Check whether a request path targets a specific record (e.g. /crm/v3/objects/contacts/123)
 * vs a collection endpoint (e.g. /crm/v3/objects/contacts or /crm/v3/objects/contacts/search).
 * Record-level 404s are normal "not found" responses, not capability/tier issues.
 */
function isRecordLevelPath(pathPrefix: string, requestPath: string): boolean {
  const rest = requestPath.slice(pathPrefix.length).split("?")[0];
  const segments = rest.split("/").filter(Boolean);
  // e.g. pathPrefix="/crm/v3/objects", path="/crm/v3/objects/contacts/123"
  // segments = ["contacts", "123"] — 2+ segments where last is not a known sub-resource
  if (segments.length < 2) return false;
  const lastSegment = segments[segments.length - 1];
  const knownSubResources = new Set(["search", "batch", "merge", "gdpr-delete", "associations"]);
  return !knownSubResources.has(lastSegment);
}

export function mapEndpointAvailabilityError(options: {
  profile: string;
  path: string;
  statusCode: number;
  details: unknown;
}): CliError | undefined {
  if (options.statusCode !== 403 && options.statusCode !== 404) return undefined;
  const definition = resolveCapability(options.path);
  if (!definition) return undefined;

  // A 404 on a specific record (e.g. /crm/v3/objects/contacts/123) is "record not found",
  // not "endpoint unavailable". Only remap 404 for collection/endpoint-level paths.
  if (options.statusCode === 404 && isRecordLevelPath(definition.pathPrefix, options.path)) {
    return undefined;
  }

  recordCapability(options.profile, definition.id, options.statusCode, "runtime-http-status");

  return new CliError(
    "ENDPOINT_NOT_AVAILABLE",
    formatCapabilityMessage(definition),
    options.statusCode,
    {
      capabilityId: definition.id,
      pathPrefix: definition.pathPrefix,
      fallbackCommand: definition.fallbackCommand,
      requiredScopes: definition.requiredScopes,
      scopeHints: definition.scopeHints,
      tierHint: definition.tierHint,
      original: options.details,
    },
  );
}

export function recordEndpointSuccess(options: { profile: string; path: string; statusCode: number }): void {
  const definition = resolveCapability(options.path);
  if (!definition) return;
  recordCapability(options.profile, definition.id, options.statusCode, "runtime-success");
}

async function probeCapability(token: string, definition: EndpointCapabilityDefinition, apiBaseUrl = "https://api.hubapi.com"): Promise<CachedCapabilityStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(`${apiBaseUrl}${definition.probePath}`, {
      method: definition.probeMethod,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    return {
      status: classifyStatusCode(response.status),
      statusCode: response.status,
      checkedAt,
      note: response.ok ? "probe-ok" : `probe-status-${response.status}`,
    };
  } catch (error) {
    return {
      status: "unknown",
      checkedAt,
      note: `probe-network-error:${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function summarize(entry: CapabilityCacheEntry): { supported: number; unsupported: number; unknown: number } {
  let supported = 0;
  let unsupported = 0;
  let unknown = 0;

  for (const definition of ENDPOINT_CAPABILITIES) {
    const status = entry.capabilities[definition.id]?.status ?? "unknown";
    if (status === "supported") supported += 1;
    else if (status === "unsupported") unsupported += 1;
    else unknown += 1;
  }

  return { supported, unsupported, unknown };
}

function toProbeResult(
  profileName: string,
  context: PortalContext,
  entry: CapabilityCacheEntry,
  refreshed: boolean,
  ttlMs: number,
): CapabilityProbeResult {
  return {
    profile: profileName,
    portalId: context.portalId,
    scopes: context.scopes,
    source: context.source,
    cacheKey: entry.key,
    refreshed,
    cacheExpiresAt: entry.expiresAt,
    ttlHours: Number((ttlMs / 3_600_000).toFixed(2)),
    summary: summarize(entry),
    capabilities: ENDPOINT_CAPABILITIES.map((definition) => {
      const cached = entry.capabilities[definition.id];
      return {
        ...definition,
        status: cached?.status ?? "unknown",
        statusCode: cached?.statusCode,
        checkedAt: cached?.checkedAt ?? entry.updatedAt,
        note: cached?.note,
      };
    }),
  };
}

export async function probeCapabilities(options: {
  profile: string;
  token: string;
  refresh?: boolean;
  ttlMs?: number;
}): Promise<CapabilityProbeResult> {
  const ttlMs = options.ttlMs && options.ttlMs > 0 ? options.ttlMs : DEFAULT_CAPABILITY_TTL_MS;
  const context = await ensurePortalContext(options.profile, options.token);
  const cache = readCapabilityCache();
  const key = buildCapabilityKey(context.portalId, context.scopes);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const existing = cache.entries.find((entry) => entry.key === key);
  if (existing && !options.refresh) {
    const expiresAtMs = Date.parse(existing.expiresAt);
    if (Number.isFinite(expiresAtMs) && expiresAtMs > nowMs) {
      return toProbeResult(options.profile, context, existing, false, ttlMs);
    }
  }

  const capabilityResults: Record<string, CachedCapabilityStatus> = {};
  for (const definition of ENDPOINT_CAPABILITIES) {
    capabilityResults[definition.id] = await probeCapability(options.token, definition, getApiBaseUrl(options.profile));
  }

  const updatedEntry: CapabilityCacheEntry = {
    key,
    portalId: context.portalId,
    scopes: context.scopes,
    profile: options.profile,
    probedAt: nowIso,
    updatedAt: nowIso,
    expiresAt: new Date(nowMs + ttlMs).toISOString(),
    capabilities: {
      ...(existing?.capabilities ?? {}),
      ...capabilityResults,
    },
  };

  if (existing) {
    const index = cache.entries.findIndex((entry) => entry.key === key);
    cache.entries[index] = updatedEntry;
  } else {
    cache.entries.push(updatedEntry);
  }

  writeCapabilityCache(cache);
  return toProbeResult(options.profile, context, updatedEntry, true, ttlMs);
}

export function listEndpointCapabilities(): EndpointCapabilityDefinition[] {
  return ENDPOINT_CAPABILITIES.slice();
}
