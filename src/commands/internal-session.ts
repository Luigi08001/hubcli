import { Command } from "commander";
import { readFileSync } from "node:fs";
import { getProfile } from "../core/auth.js";
import { createBrowserSessionClient, HubSpotClient } from "../core/http.js";
import type { CliContext } from "../core/output.js";
import { CliError } from "../core/output.js";

export interface BrowserSessionOptions {
  portalId?: string;
  uiDomain?: string;
  cookie?: string;
  cookieFile?: string;
  csrf?: string;
}

export function addBrowserSessionOptions(command: Command): Command {
  return command
    .option("--portal-id <id>", "HubSpot portal ID (or HSCLI_PORTAL_ID / profile.portalId)")
    .option("--ui-domain <domain>", "HubSpot app domain, e.g. app.hubspot.com or app-eu1.hubspot.com")
    .option("--cookie <header>", "Browser Cookie header for app.hubspot.com")
    .option("--cookie-file <path>", "Cookie header, Netscape cookie jar, or JSON cookie export")
    .option("--csrf <token>", "x-hubspot-csrf-hubspotapi header value");
}

export function resolveBrowserSession(
  ctx: CliContext,
  opts: BrowserSessionOptions,
  featureLabel: string,
  requirePortalId: boolean,
): { client: HubSpotClient; portalId?: string } {
  const profile = safeProfile(ctx.profile);
  const portalId = firstString(opts.portalId, process.env.HSCLI_PORTAL_ID, profile?.portalId);
  if (requirePortalId && !portalId) {
    throw new CliError("SESSION_PORTAL_ID_REQUIRED", `${featureLabel} require --portal-id, HSCLI_PORTAL_ID, or profile.portalId.`);
  }

  const uiDomain = normalizeUiDomain(firstString(
    opts.uiDomain,
    process.env.HSCLI_HUBSPOT_UI_DOMAIN,
    profile?.uiDomain,
    "app.hubspot.com",
  ) ?? "app.hubspot.com");
  const cookie = firstString(
    opts.cookie,
    process.env.HSCLI_HUBSPOT_COOKIE,
  ) ?? readCookieFile(firstString(opts.cookieFile, process.env.HSCLI_HUBSPOT_COOKIE_FILE), uiDomain);
  if (!cookie) {
    throw new CliError(
      "SESSION_COOKIE_REQUIRED",
      `${featureLabel} require --cookie, --cookie-file, HSCLI_HUBSPOT_COOKIE, or HSCLI_HUBSPOT_COOKIE_FILE.`,
    );
  }

  const csrfToken = firstString(opts.csrf, process.env.HSCLI_HUBSPOT_CSRF, extractCsrfToken(cookie));
  if (!csrfToken) {
    throw new CliError(
      "SESSION_CSRF_REQUIRED",
      `${featureLabel} require --csrf or HSCLI_HUBSPOT_CSRF. A csrf.app cookie is also accepted when present.`,
    );
  }

  return {
    portalId,
    client: createBrowserSessionClient(ctx.profile, {
      apiBaseUrl: `https://${uiDomain}`,
      cookie,
      csrfToken,
      telemetryFile: ctx.telemetryFile,
      strictCapabilities: ctx.strictCapabilities,
    }),
  };
}

function safeProfile(profile: string): ReturnType<typeof getProfile> | undefined {
  try {
    return getProfile(profile);
  } catch {
    return undefined;
  }
}

function firstString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function normalizeUiDomain(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new CliError("INVALID_UI_DOMAIN", "HubSpot UI domain cannot be empty.");
  const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  if (url.username || url.password) {
    throw new CliError("INVALID_UI_DOMAIN", "HubSpot UI domain must not include userinfo.");
  }
  const hostname = url.hostname.toLowerCase();
  if (!/^app(?:-[a-z0-9]+)?\.hubspot\.com$/.test(hostname)) {
    throw new CliError("INVALID_UI_DOMAIN", "--ui-domain must be a HubSpot app host such as app.hubspot.com or app-eu1.hubspot.com.");
  }
  return hostname;
}

function readCookieFile(path: string | undefined, uiDomain: string): string | undefined {
  if (!path) return undefined;
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return undefined;
  return normalizeCookieFile(raw, uiDomain);
}

function normalizeCookieFile(raw: string, uiDomain: string): string {
  const parsed = parseCookieJson(raw, uiDomain);
  if (parsed) return parsed;

  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const netscapeCookies = lines
    .map(parseNetscapeCookieLine)
    .filter((cookie): cookie is { domain: string; name: string; value: string } => Boolean(cookie))
    .filter((cookie) => cookieDomainMatches(uiDomain, cookie.domain))
    .map((cookie) => `${cookie.name}=${cookie.value}`);
  if (netscapeCookies.length > 0) return netscapeCookies.join("; ");

  return lines.filter((line) => !line.startsWith("#")).join("; ");
}

function parseNetscapeCookieLine(line: string): { domain: string; name: string; value: string } | undefined {
  let source = line;
  if (source.startsWith("#HttpOnly_")) {
    source = source.slice("#HttpOnly_".length);
  } else if (source.startsWith("#")) {
    return undefined;
  }
  const parts = source.split(/\t+/);
  if (parts.length < 7) return undefined;
  return { domain: parts[0], name: parts[5], value: parts.slice(6).join("\t") };
}

function parseCookieJson(raw: string, uiDomain: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string") return parsed;
    if (isRecord(parsed) && typeof parsed.cookie === "string") return parsed.cookie;
    const cookies = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.cookies) ? parsed.cookies : undefined;
    if (!cookies) return undefined;
    const pairs = cookies
      .filter(isRecord)
      .filter((cookie) => {
        const domain = typeof cookie.domain === "string" ? cookie.domain : undefined;
        return !domain || cookieDomainMatches(uiDomain, domain);
      })
      .map((cookie) => {
        const name = typeof cookie.name === "string" ? cookie.name.trim() : "";
        const value = typeof cookie.value === "string" ? cookie.value : "";
        return name ? `${name}=${value}` : "";
      })
      .filter(Boolean);
    return pairs.length > 0 ? pairs.join("; ") : undefined;
  } catch {
    return undefined;
  }
}

function cookieDomainMatches(hostname: string, rawDomain: string): boolean {
  const domain = rawDomain.trim().replace(/^#HttpOnly_/i, "").replace(/^\./, "").toLowerCase();
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function extractCsrfToken(cookieHeader: string): string | undefined {
  const candidates = new Set(["csrf.app", "csrf", "hubspotapi-csrf", "hs-csrf"]);
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || rawValue.length === 0) continue;
    if (candidates.has(rawName.trim().toLowerCase())) {
      const value = rawValue.join("=").trim();
      return value ? decodeURIComponent(value) : undefined;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
