import { existsSync, readFileSync } from "node:fs";
import type { CliContext } from "./output.js";
import { CliError } from "./output.js";

/**
 * Policy-as-code for HSCLI writes.
 *
 * Two supported policy formats:
 *
 * 1. LEGACY (v0.1-v0.6) — flat JSON with `defaults`, `profiles`, and
 *    `blockedMethodPathPrefixes`. Still supported for backward compat.
 *
 * 2. v0.7+ — structured rules with glob patterns, time windows, and
 *    approval requirements. Shape:
 *
 *    {
 *      "version": 2,
 *      "profiles": {
 *        "<profile-name>": {
 *          "defaultAction": "allow" | "deny",
 *          "rules": [
 *            {
 *              "match": { "method": "DELETE", "path": "/crm/v3/objects/*" },
 *              "action": "allow" | "deny",
 *              "requireChangeTicket": true,
 *              "requireApproval": "webhook:<url>" | "manual" | null,
 *              "rateLimit": { "maxPerHour": 10 },
 *              "window": { "tz": "US/Eastern", "hours": "09-17", "days": "mon-fri" }
 *            }
 *          ]
 *        }
 *      }
 *    }
 *
 * Rule evaluation: first match wins. If no rule matches, use `defaultAction`
 * (or fall back to the legacy flat field `allowWrite` for v1 files).
 */

export interface PolicyRuleMatch {
  method?: "POST" | "PATCH" | "PUT" | "DELETE" | "*";
  path?: string; // glob-like pattern, supports `*` and `**`
}

export interface PolicyWindow {
  tz?: string; // IANA timezone
  hours?: string; // "09-17"
  days?: string; // "mon-fri" or "mon,wed,fri"
}

export interface PolicyRateLimit {
  maxPerHour?: number;
}

export interface PolicyRule {
  // v2 fields
  name?: string;
  match?: PolicyRuleMatch;
  action?: "allow" | "deny";
  requireChangeTicket?: boolean;
  requireApproval?: string | null;
  rateLimit?: PolicyRateLimit;
  window?: PolicyWindow;

  // v1 fields (legacy, kept for backward compat)
  allowWrite?: boolean;
  allowDelete?: boolean;
}

export interface PolicyProfileConfig {
  // v2
  defaultAction?: "allow" | "deny";
  rules?: PolicyRule[];

  // v1 (flat) — still honored
  allowWrite?: boolean;
  allowDelete?: boolean;
  requireChangeTicket?: boolean;
}

export interface PolicyConfig {
  version?: 1 | 2;
  defaults?: PolicyProfileConfig;
  profiles?: Record<string, PolicyProfileConfig>;
  blockedMethodPathPrefixes?: Record<string, string[]>;
}

export function readPolicyFile(path: string): PolicyConfig {
  if (!existsSync(path)) {
    throw new CliError("POLICY_FILE_NOT_FOUND", `Policy file not found: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PolicyConfig;
  } catch {
    throw new CliError("POLICY_INVALID_JSON", `Invalid policy JSON: ${path}`);
  }
}

/** Convert a glob pattern to a regex. `*` matches path segment (no `/`), `**` matches across segments. */
function globToRegex(pattern: string): RegExp {
  // Escape regex special chars except * and /
  let re = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  // ** matches any (including /)
  re = re.replace(/\*\*/g, "__GLOBSTAR__");
  // * matches anything except /
  re = re.replace(/\*/g, "[^/]*");
  re = re.replace(/__GLOBSTAR__/g, ".*");
  return new RegExp("^" + re + "$");
}

function methodMatches(ruleMethod: string | undefined, requestMethod: string): boolean {
  if (!ruleMethod || ruleMethod === "*") return true;
  return ruleMethod.toUpperCase() === requestMethod.toUpperCase();
}

function pathMatches(rulePath: string | undefined, requestPath: string): boolean {
  if (!rulePath || rulePath === "*" || rulePath === "**") return true;
  return globToRegex(rulePath).test(requestPath);
}

function isWithinWindow(window: PolicyWindow | undefined): boolean {
  if (!window) return true;
  const now = new Date();
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

  // Both days and hours must be evaluated in window.tz (or system local time
  // when omitted). UTC was a latent bug: "mon-fri, US/Eastern" would let a
  // Friday write land on Saturday UTC — or block a Monday write still in
  // Sunday local time.
  const tz = window.tz;

  // Days
  if (window.days) {
    let todayIdx: number;
    if (tz) {
      try {
        const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" });
        const weekday = fmt.format(now).toLowerCase().slice(0, 3);
        todayIdx = dayNames.indexOf(weekday as typeof dayNames[number]);
        if (todayIdx === -1) todayIdx = now.getDay();
      } catch {
        todayIdx = now.getDay();
      }
    } else {
      todayIdx = now.getDay();
    }
    const allowed = parseDays(window.days);
    if (!allowed.includes(dayNames[todayIdx])) return false;
  }

  // Hours
  if (window.hours) {
    const [fromStr, toStr] = window.hours.split("-");
    const fromHour = Number(fromStr);
    const toHour = Number(toStr);
    let currentHour: number;
    if (tz) {
      try {
        const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false });
        currentHour = Number(fmt.format(now).replace(/\D/g, "").slice(0, 2));
      } catch {
        currentHour = now.getHours();
      }
    } else {
      currentHour = now.getHours();
    }
    if (currentHour < fromHour || currentHour >= toHour) return false;
  }

  return true;
}

function parseDays(spec: string): string[] {
  const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  // "mon-fri"
  if (/^[a-z]{3}-[a-z]{3}$/i.test(spec)) {
    const [from, to] = spec.toLowerCase().split("-");
    const fi = map.indexOf(from);
    const ti = map.indexOf(to);
    if (fi === -1 || ti === -1) return [];
    const out: string[] = [];
    for (let i = fi; i !== ti; i = (i + 1) % 7) out.push(map[i]);
    out.push(map[ti]);
    return out;
  }
  // "mon,wed,fri"
  return spec.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Find the first matching rule for a (method, path) pair in a profile config.
 * Returns null if no rule matches. Supports both v1 and v2 shapes.
 */
export function findMatchingRule(
  profileConfig: PolicyProfileConfig,
  method: string,
  path: string,
): PolicyRule | null {
  if (profileConfig.rules && profileConfig.rules.length > 0) {
    for (const rule of profileConfig.rules) {
      if (methodMatches(rule.match?.method, method) && pathMatches(rule.match?.path, path)) {
        return rule;
      }
    }
  }
  return null;
}

export function enforceWritePolicy(ctx: CliContext, method: "POST" | "PATCH" | "PUT" | "DELETE", path: string): void {
  const policyPath = ctx.policyFile?.trim() || process.env.HSCLI_POLICY_FILE?.trim();
  if (!policyPath) return;

  const config = readPolicyFile(policyPath);
  const profileConfig: PolicyProfileConfig = config.profiles?.[ctx.profile] ?? config.defaults ?? {};
  const defaults: PolicyProfileConfig = config.defaults ?? {};

  // v2 style: find matching rule, apply its action
  const matched = findMatchingRule(profileConfig, method, path) ?? findMatchingRule(defaults, method, path);
  if (matched) {
    // Time window check first — outside window always denies
    if (!isWithinWindow(matched.window)) {
      throw new CliError(
        "POLICY_OUT_OF_WINDOW",
        `Policy rule '${matched.name ?? "(unnamed)"}' is outside its allowed time window (${matched.window?.days ?? "any"} ${matched.window?.hours ?? "any"} ${matched.window?.tz ?? "UTC"}).`,
      );
    }

    if (matched.action === "deny") {
      throw new CliError(
        "POLICY_RULE_DENY",
        `Policy rule '${matched.name ?? "(unnamed)"}' denies ${method} ${path}.`,
      );
    }

    if (matched.requireChangeTicket && !ctx.changeTicket?.trim()) {
      throw new CliError(
        "POLICY_CHANGE_TICKET_REQUIRED",
        `Policy rule '${matched.name ?? "(unnamed)"}' requires --change-ticket for ${method} ${path}.`,
      );
    }

    if (matched.requireApproval) {
      // v0.7.0: approval flow is not yet implemented. Log + deny with
      // actionable error. Approvals land in v0.7.1 (webhook/Slack).
      throw new CliError(
        "POLICY_APPROVAL_REQUIRED",
        `Policy rule '${matched.name ?? "(unnamed)"}' requires approval (${matched.requireApproval}). Approval workflow lands in v0.7.1.`,
      );
    }

    // action === "allow" (or undefined → allow by default when matched)
  } else {
    // No rule matched → use defaultAction
    const defaultAction = profileConfig.defaultAction ?? defaults.defaultAction;
    if (defaultAction === "deny") {
      throw new CliError(
        "POLICY_DEFAULT_DENY",
        `No policy rule matched ${method} ${path} and profile default action is 'deny'.`,
      );
    }
  }

  // v1 legacy flat fields — still honored for backward compat
  const profileFlat: PolicyProfileConfig = profileConfig;
  const allowWrite = profileFlat.allowWrite ?? defaults.allowWrite ?? true;
  const allowDelete = profileFlat.allowDelete ?? defaults.allowDelete ?? true;
  const requireChangeTicketLegacy = profileFlat.requireChangeTicket ?? defaults.requireChangeTicket ?? false;

  if (!allowWrite) {
    throw new CliError("POLICY_WRITE_BLOCKED", `Policy blocks write operations for profile '${ctx.profile}'.`);
  }
  if (method === "DELETE" && !allowDelete) {
    throw new CliError("POLICY_DELETE_BLOCKED", `Policy blocks delete operations for profile '${ctx.profile}'.`);
  }
  if (requireChangeTicketLegacy && !ctx.changeTicket?.trim()) {
    throw new CliError("POLICY_CHANGE_TICKET_REQUIRED", `Profile '${ctx.profile}' requires --change-ticket for write operations.`);
  }

  const blockedPrefixes = config.blockedMethodPathPrefixes?.[method] ?? [];
  if (blockedPrefixes.some((prefix) => path.startsWith(prefix))) {
    throw new CliError("POLICY_PATH_BLOCKED", `Policy blocks ${method} on path '${path}'.`);
  }
}
