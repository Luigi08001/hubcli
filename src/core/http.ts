import { CliError } from "./output.js";
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
  private readonly profile: string;
  private readonly strictCapabilities: boolean;
  private readonly rateLimitState: RateLimitSnapshot = { nextRequestAtMs: 0 };

  constructor(private readonly token: string, options: HubSpotClientOptions = {}) {
    this.baseUrl = new URL(options.apiBaseUrl?.trim() || "https://api.hubapi.com");
    this.requestId = options.requestId?.trim() || process.env.HUBCLI_REQUEST_ID?.trim() || randomUUID();
    this.telemetryFile = options.telemetryFile?.trim() || process.env.HUBCLI_TELEMETRY_FILE?.trim() || undefined;
    this.profile = options.profile?.trim() || process.env.HUBCLI_PROFILE?.trim() || "default";
    this.strictCapabilities = options.strictCapabilities ?? isEnvTrue(process.env.HUBCLI_STRICT_CAPABILITIES);
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
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "X-Hubcli-Request-Id": this.requestId,
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
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
        this.emitTelemetry({ method, path: pathname, status: response.status, durationMs: Date.now() - startedAt, attempt });
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
      if (response.status === 204) return { ok: true };
      this.emitTelemetry({ method, path: pathname, status: response.status, durationMs: Date.now() - startedAt, attempt });
      return safeJson(response);
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
  }): void {
    if (!this.telemetryFile) return;
    try {
      appendFileSync(this.telemetryFile, JSON.stringify({
        ts: new Date().toISOString(),
        requestId: this.requestId,
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
      const resetAtMs = nextUtcMidnightMs(now);
      this.rateLimitState.daily = {
        max: dailyMax,
        remaining: dailyRemaining,
        resetAtMs,
      };
      this.rateLimitState.nextRequestAtMs = this.computeDailyPacingNextAt(resetAtMs, dailyMax, dailyRemaining);
    }
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
  try {
    return await response.json();
  } catch {
    return { message: await response.text() };
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
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return next;
}
