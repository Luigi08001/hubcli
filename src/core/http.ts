import { CliError } from "./output.js";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

/**
 * Read the active trace session file (written by `hscli trace start`).
 * Returns the full session (file path + scope + includeBodies) if a
 * session is active, or undefined. Keeps session awareness decoupled
 * from the CLI command layer: the http client reads the state file on
 * construction, so ANY code path that opens a HubSpotClient
 * automatically participates in the trace.
 */
interface ActiveTraceSession {
  file: string;
  scope: "read" | "write" | "all";
  includeBodies: boolean;
}
function readActiveTraceSession(): ActiveTraceSession | undefined {
  const home = process.env.HSCLI_HOME?.trim() || join(homedir(), ".revfleet");
  const sessionPath = join(home, "trace-session.json");
  if (!existsSync(sessionPath)) return undefined;
  try {
    const session = JSON.parse(readFileSync(sessionPath, "utf8")) as {
      file?: string;
      scope?: string;
      includeBodies?: boolean;
    };
    if (!session.file) return undefined;
    const scope = session.scope === "read" || session.scope === "write" ? session.scope : "all";
    return { file: session.file, scope, includeBodies: Boolean(session.includeBodies) };
  } catch {
    return undefined;
  }
}
import { mapEndpointAvailabilityError, preflightEndpointCapability, recordEndpointSuccess } from "./capabilities.js";
import { getToken, getApiBaseUrl } from "./auth.js";
import { enforcePermissionProfile } from "./permissions.js";

/**
 * Create a HubSpotClient that is hublet-aware.
 * Automatically resolves the API base URL from the profile's hublet setting.
 */
export function createClient(profile: string, options: Omit<HubSpotClientOptions, "apiBaseUrl"> = {}): HubSpotClient {
  const token = getToken(profile);
  const apiBaseUrl = getApiBaseUrl(profile);
  return new HubSpotClient(token, { ...options, apiBaseUrl, profile });
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  /**
   * Override the default `Content-Type: application/json`. Used when
   * HubSpot endpoints expect `text/plain`, `text/html`, or
   * `multipart/form-data` — e.g. `/cms/v3/source-code/*` template
   * uploads. When set, `rawBody` is sent verbatim instead of
   * JSON-stringifying `body`.
   */
  contentType?: string;
  /** Raw body string used when `contentType` is non-JSON. */
  rawBody?: string;
}

interface HubSpotClientOptions {
  requestId?: string;
  telemetryFile?: string;
  profile?: string;
  strictCapabilities?: boolean;
  /** Override the API base URL (e.g. "https://api-eu1.hubapi.com" for EU1 portals). */
  apiBaseUrl?: string;
}

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const MAX_BACKOFF_MS = 10_000;
const ROLLING_SAFETY_BUFFER = 1;
const DAILY_MIN_REMAINING_BUFFER = 5;
const DAILY_LOW_WATERMARK_RATIO = 0.02;
const ALLOWED_PATH_SCOPES = [
  "crm",
  "oauth",
  "marketing",
  "files",
  "forms",
  "cms",
  "automation",
  "conversations",
  "settings",
  "events",
  "communication-preferences",
  "webhooks",
  "account-info",
  "integrations",
  "analytics",
  "email",
  "media-bridge",
  "feature",
  "broadcast",
  "broadcasts",
  "channels",
  "companies",
  "contacts",
  "content",
  "deals",
  "engagements",
  "extensions",
  "form",
  "owners",
  "reports",
  "submissions",
  "marketing-emails",
  "communication",
  "visitor-identification",
  "integrators",
  "calling",
  "properties",
  "tax",
  "scheduler",
  "appinstalls",
  "payments",
  "business-units",
  "form-integrations",
  "comments",
  // Survey + feedback endpoints (e.g. /feedback/v3/submissions)
  "feedback",
  // Legacy goals API (/goals/v1/*) — modern alternative is /crm/v3/objects/goal_targets
  "goals",
  // CMS content folder tree listing (used by design-manager tooling)
  "content-folders",
];

interface RollingQuotaState {
  max: number;
  remaining: number;
  intervalMs: number;
  resetAtMs: number;
}

interface DailyQuotaState {
  max: number;
  remaining: number;
  resetAtMs: number;
}

interface RateLimitSnapshot {
  rolling?: RollingQuotaState;
  daily?: DailyQuotaState;
  nextRequestAtMs: number;
}

export class HubSpotClient {
  private readonly baseUrl: URL;
  private readonly requestId: string;
  private readonly telemetryFile?: string;
  private readonly traceScope: "read" | "write" | "all";
  private readonly traceIncludeBodies: boolean;
  private readonly profile: string;
  private readonly strictCapabilities: boolean;
  private readonly rateLimitState: RateLimitSnapshot = { nextRequestAtMs: 0 };
  // Portal timezone (e.g. "US/Eastern"). Fetched lazily from
  // /account-info/v3/details the first time daily quota headers appear,
  // then used so the daily reset calculation matches HubSpot's actual
  // reset time (HubSpot resets daily usage at midnight in the portal's
  // own timezone, not UTC). Falls back to "UTC" if detection fails.
  private portalTimeZone: string | undefined;
  private portalTimeZoneFetching: Promise<void> | undefined;

  constructor(private readonly token: string, options: HubSpotClientOptions = {}) {
    this.baseUrl = new URL(options.apiBaseUrl?.trim() || "https://api.hubapi.com");
    this.requestId = options.requestId?.trim() || process.env.HSCLI_REQUEST_ID?.trim() || randomUUID();
    // Telemetry priority:
    //   1. explicit --telemetry-file flag / options.telemetryFile
    //   2. HSCLI_TELEMETRY_FILE env var
    //   3. active trace session file (set by `hscli trace start`)
    // Users never need to re-pass --telemetry-file after `trace start`.
    const activeSession = readActiveTraceSession();
    this.telemetryFile = options.telemetryFile?.trim()
      || process.env.HSCLI_TELEMETRY_FILE?.trim()
      || activeSession?.file
      || undefined;
    // Only honor session scope/bodies when the telemetry file actually
    // comes from the active session. If the caller passed an explicit
    // --telemetry-file, they own the filtering policy.
    const telemetryFromSession = !options.telemetryFile?.trim()
      && !process.env.HSCLI_TELEMETRY_FILE?.trim()
      && activeSession?.file !== undefined;
    this.traceScope = telemetryFromSession ? (activeSession?.scope ?? "all") : "all";
    this.traceIncludeBodies = telemetryFromSession
      ? Boolean(activeSession?.includeBodies)
      : isEnvTrue(process.env.HSCLI_TRACE_BODIES);
    this.profile = options.profile?.trim() || process.env.HSCLI_PROFILE?.trim() || "default";
    this.strictCapabilities = options.strictCapabilities ?? isEnvTrue(process.env.HSCLI_STRICT_CAPABILITIES);
  }

  async request(path: string, options: RequestOptions = {}, attempt = 0): Promise<unknown> {
    const method = options.method ?? "GET";
    enforcePermissionProfile(this.profile, method);
    const url = this.resolveUrl(path);
    const pathname = new URL(url).pathname;
    const idempotencyKey = resolveIdempotencyKey(method, options.idempotencyKey);
    const startedAt = Date.now();

    await this.beforeRateLimitedRequest(pathname);
    preflightEndpointCapability({
      profile: this.profile,
      path: pathname,
      strict: this.strictCapabilities,
    });

    try {
      const contentType = options.contentType ?? "application/json";
      const bodyToSend =
        options.rawBody !== undefined
          ? options.rawBody
          : options.body !== undefined
            ? JSON.stringify(options.body)
            : undefined;
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": contentType,
          "X-Hubcli-Request-Id": this.requestId,
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: bodyToSend,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      this.observeRateLimitHeaders(response.headers);

      if (response.status === 429 || response.status >= 500) {
        if (response.status === 429) {
          this.observeTooManyRequests(response.headers);
        }
        if (attempt >= MAX_RETRIES) {
          throw new CliError("HTTP_RETRY_EXHAUSTED", `Request failed after ${MAX_RETRIES + 1} attempts`, response.status);
        }
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const backoff = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, Math.min(backoff, MAX_BACKOFF_MS)));
        return this.request(path, { ...options, idempotencyKey }, attempt + 1);
      }

      if (!response.ok) {
        const details = await safeJson(response);
        this.emitTelemetry({
          method,
          path: pathname,
          status: response.status,
          durationMs: Date.now() - startedAt,
          attempt,
          ...(this.traceIncludeBodies ? { requestBody: options.body, responseBody: details } : {}),
        });
        const endpointError = mapEndpointAvailabilityError({
          profile: this.profile,
          path: pathname,
          statusCode: response.status,
          details,
        });
        if (endpointError) throw endpointError;
        throw new CliError("HTTP_ERROR", `HubSpot API request failed (${response.status})`, response.status, details);
      }

      recordEndpointSuccess({ profile: this.profile, path: pathname, statusCode: response.status });
      if (response.status === 204) {
        this.emitTelemetry({
          method,
          path: pathname,
          status: response.status,
          durationMs: Date.now() - startedAt,
          attempt,
          ...(this.traceIncludeBodies ? { requestBody: options.body } : {}),
        });
        return { ok: true };
      }
      const responseBody = await safeJson(response);
      this.emitTelemetry({
        method,
        path: pathname,
        status: response.status,
        durationMs: Date.now() - startedAt,
        attempt,
        ...(this.traceIncludeBodies ? { requestBody: options.body, responseBody } : {}),
      });
      return responseBody;
    } catch (error) {
      this.emitTelemetry({
        method,
        path: pathname,
        durationMs: Date.now() - startedAt,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof CliError) throw error;
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new CliError("HTTP_TIMEOUT", `Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      if (attempt >= MAX_RETRIES) {
        throw new CliError("NETWORK_ERROR", "Network request failed", undefined, { cause: String(error) });
      }
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      return this.request(path, { ...options, idempotencyKey }, attempt + 1);
    }
  }

  private resolveUrl(path: string): string {
    if (!path.startsWith("/")) {
      throw new CliError("INVALID_PATH", "Request path must start with '/'");
    }

    const url = new URL(path, this.baseUrl);
    if (url.origin !== this.baseUrl.origin) {
      throw new CliError("INVALID_PATH", "Request URL origin is not allowed");
    }

    if (!ALLOWED_PATH_SCOPES.some((scope) => url.pathname === `/${scope}` || url.pathname.startsWith(`/${scope}/`))) {
      throw new CliError("INVALID_PATH_SCOPE", "Request path escapes allowed HubSpot API scope");
    }

    return url.toString();
  }

  private emitTelemetry(event: {
    method: string;
    path: string;
    status?: number;
    durationMs: number;
    attempt: number;
    error?: string;
    requestBody?: unknown;
    responseBody?: unknown;
    requestBytes?: number;
    responseBytes?: number;
  }): void {
    if (!this.telemetryFile) return;
    // Scope filter — set by `hscli trace start --scope read|write|all`.
    // THROTTLE pseudo-events are always emitted (diagnostic signal, not
    // a real request, so scope doesn't apply).
    if (this.traceScope !== "all" && event.method !== "THROTTLE") {
      const isWrite = event.method === "POST" || event.method === "PUT"
        || event.method === "PATCH" || event.method === "DELETE";
      if (this.traceScope === "read" && isWrite) return;
      if (this.traceScope === "write" && !isWrite) return;
    }
    try {
      // Baseline event: always includes ts + requestId + profile. toolName
      // is set from HSCLI_MCP_TOOL_NAME so MCP tool invocations show up
      // distinctly in `hscli trace stats` (byToolName breakdown).
      appendFileSync(this.telemetryFile, JSON.stringify({
        ts: new Date().toISOString(),
        requestId: this.requestId,
        profile: this.profile,
        toolName: process.env.HSCLI_MCP_TOOL_NAME?.trim() || undefined,
        ...event,
      }) + "\n", "utf8");
    } catch {
      // Telemetry must not break CLI execution.
    }
  }

  private async beforeRateLimitedRequest(path: string): Promise<void> {
    const waitMs = this.computeWaitMs();
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.emitTelemetry({
        method: "THROTTLE",
        path,
        durationMs: waitMs,
        attempt: 0,
      });
    }
    this.reserveBudget();

    const now = Date.now();
    const daily = this.rateLimitState.daily;
    if (daily && now < daily.resetAtMs && daily.remaining <= 0) {
      throw new CliError(
        "RATE_LIMIT_DAILY_EXHAUSTED",
        "HubSpot daily API quota appears exhausted for current credentials.",
        429,
        {
          resetAt: new Date(daily.resetAtMs).toISOString(),
          dailyMax: daily.max,
          dailyRemaining: daily.remaining,
        },
      );
    }
  }

  private computeWaitMs(): number {
    const now = Date.now();
    let waitMs = 0;

    const rolling = this.rateLimitState.rolling;
    if (rolling) {
      if (now >= rolling.resetAtMs) {
        rolling.remaining = rolling.max;
      } else if (rolling.remaining <= ROLLING_SAFETY_BUFFER) {
        waitMs = Math.max(waitMs, rolling.resetAtMs - now + 25);
      }
    }

    const nextRequestAt = this.rateLimitState.nextRequestAtMs;
    if (nextRequestAt > now) {
      waitMs = Math.max(waitMs, nextRequestAt - now);
    }

    return waitMs;
  }

  private reserveBudget(): void {
    const now = Date.now();
    const rolling = this.rateLimitState.rolling;
    if (rolling && now < rolling.resetAtMs && rolling.remaining > 0) {
      rolling.remaining -= 1;
    }
    const daily = this.rateLimitState.daily;
    if (daily && now < daily.resetAtMs && daily.remaining > 0) {
      daily.remaining -= 1;
    }
  }

  private observeRateLimitHeaders(headers: Headers): void {
    const now = Date.now();

    const intervalMs = parsePositiveInt(headers.get("x-hubspot-ratelimit-interval-milliseconds"));
    const max = parsePositiveInt(headers.get("x-hubspot-ratelimit-max"));
    const remaining = parseNonNegativeInt(headers.get("x-hubspot-ratelimit-remaining"));
    if (intervalMs !== undefined && max !== undefined && remaining !== undefined) {
      this.rateLimitState.rolling = {
        intervalMs,
        max,
        remaining,
        resetAtMs: now + intervalMs,
      };
    }

    const dailyMax = parsePositiveInt(headers.get("x-hubspot-ratelimit-daily"));
    const dailyRemaining = parseNonNegativeInt(headers.get("x-hubspot-ratelimit-daily-remaining"));
    if (dailyMax !== undefined && dailyRemaining !== undefined) {
      const resetAtMs = nextMidnightMs(now, this.portalTimeZone ?? "UTC");
      this.rateLimitState.daily = {
        max: dailyMax,
        remaining: dailyRemaining,
        resetAtMs,
      };
      this.rateLimitState.nextRequestAtMs = this.computeDailyPacingNextAt(resetAtMs, dailyMax, dailyRemaining);
      // Lazily fetch the portal's timezone on first daily-quota sighting so
      // subsequent resets use the correct local midnight.
      this.ensurePortalTimeZoneFetched();
    }
  }

  /**
   * Fetch the portal's timezone once and cache it on the client instance.
   * /account-info/v3/details returns a `timeZone` string (e.g. "US/Eastern").
   * If the request fails or times out, fall back to "UTC" silently — daily
   * quota tracking still works, just off by a few hours for non-UTC portals.
   */
  private ensurePortalTimeZoneFetched(): void {
    if (this.portalTimeZone || this.portalTimeZoneFetching) return;
    const url = this.resolveUrl("/account-info/v3/details");
    this.portalTimeZoneFetching = (async () => {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "X-Hubcli-Request-Id": this.requestId,
          },
          signal: AbortSignal.timeout(5_000),
        });
        if (response.ok) {
          const body = await response.json().catch(() => null) as { timeZone?: string } | null;
          if (body?.timeZone && typeof body.timeZone === "string") {
            this.portalTimeZone = body.timeZone;
            return;
          }
        }
      } catch {
        // silent fallback
      }
      this.portalTimeZone = "UTC";
    })();
  }

  private observeTooManyRequests(headers: Headers): void {
    const now = Date.now();
    const retryAfterSeconds = parsePositiveInt(headers.get("retry-after"));
    const retryAtMs = retryAfterSeconds !== undefined
      ? now + retryAfterSeconds * 1000
      : now + 1000;

    this.rateLimitState.nextRequestAtMs = Math.max(this.rateLimitState.nextRequestAtMs, retryAtMs);
    if (this.rateLimitState.rolling) {
      this.rateLimitState.rolling.remaining = 0;
      this.rateLimitState.rolling.resetAtMs = Math.max(this.rateLimitState.rolling.resetAtMs, retryAtMs);
      return;
    }

    this.rateLimitState.rolling = {
      max: 1,
      remaining: 0,
      intervalMs: Math.max(1000, retryAtMs - now),
      resetAtMs: retryAtMs,
    };
  }

  private computeDailyPacingNextAt(resetAtMs: number, dailyMax: number, dailyRemaining: number): number {
    const now = Date.now();
    if (dailyRemaining <= 0) return now;

    const lowWatermark = Math.max(DAILY_MIN_REMAINING_BUFFER, Math.floor(dailyMax * DAILY_LOW_WATERMARK_RATIO));
    if (dailyRemaining > lowWatermark) return 0;

    const msUntilReset = Math.max(0, resetAtMs - now);
    const spreadMs = Math.max(200, Math.floor(msUntilReset / Math.max(dailyRemaining, 1)));
    return now + spreadMs;
  }
}

function isEnvTrue(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function safeJson(response: Response): Promise<unknown> {
  // Read body as text first, then JSON.parse, to avoid "Body is unusable"
  // error when response.json() consumes the stream and fails on non-JSON.
  let text: string;
  try {
    text = await response.text();
  } catch {
    // Fallback if text() is unavailable (shouldn't happen with real fetch)
    try { return await response.json(); } catch { return {}; }
  }
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function resolveIdempotencyKey(method: string, provided?: string): string | undefined {
  if (!isWriteMethod(method)) return undefined;
  const normalized = provided?.trim();
  if (normalized) return normalized;
  return randomUUID();
}

function isWriteMethod(method: string): boolean {
  return method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE";
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

function parseNonNegativeInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.floor(parsed);
}

function nextUtcMidnightMs(nowMs: number): number {
  const now = new Date(nowMs);
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  );
}

/**
 * Return the epoch ms of the next midnight in the given IANA timezone.
 * HubSpot resets daily usage at midnight in the portal's own timezone.
 * Falls back to UTC if the timeZone is "UTC" or if Intl formatting fails.
 */
function nextMidnightMs(nowMs: number, timeZone: string): number {
  if (!timeZone || timeZone === "UTC") return nextUtcMidnightMs(nowMs);

  try {
    // Render the current instant as the local date in the target timezone.
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(nowMs)).map(p => [p.type, p.value]));
    const localNow = new Date(`${parts.year}-${parts.month}-${parts.day}T${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}:${parts.second}Z`).getTime();

    // Offset between UTC and local wall time (ms)
    const offsetMs = localNow - nowMs;

    // Compute midnight in local wall time, expressed in UTC-epoch ms
    const localDate = new Date(localNow);
    const localMidnightUtcMs = Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate() + 1,
      0, 0, 0, 0,
    );
    // Adjust back from "local wall time expressed as UTC" to actual UTC epoch
    return localMidnightUtcMs - offsetMs;
  } catch {
    return nextUtcMidnightMs(nowMs);
  }
}
