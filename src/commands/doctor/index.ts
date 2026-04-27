import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getToken, getProfile, detectHublet, resolveApiDomain } from "../../core/auth.js";
import { probeCapabilities } from "../../core/capabilities.js";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import {
  HUBSPOT_SCOPE_CATALOG,
  diffScopes,
  getScopeDefinition,
  listScopePresetNames,
  parseScopeList,
  resolveScopeSet,
} from "../../core/scopes.js";
import { parseNumberFlag } from "../crm/shared.js";

interface HsCliAccount {
  name?: string;
  accountId?: number;
  env?: string;
  authType?: string;
}

interface HsCliConfig {
  defaultAccount?: string | number;
  accounts?: HsCliAccount[];
}

/**
 * Parse ~/.hscli/config.yml with a minimal YAML parser (no dependency needed).
 * Handles the simple flat/list structure used by @hubspot/cli config.
 */
function parseHsCliConfig(): HsCliConfig | null {
  const configPath = join(homedir(), ".hscli", "config.yml");
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, "utf8");
    const result: HsCliConfig = {};
    const accounts: HsCliAccount[] = [];
    let currentAccount: HsCliAccount | null = null;

    for (const line of raw.split("\n")) {
      const trimmed = line.trimEnd();
      if (!trimmed || trimmed.startsWith("#")) continue;

      // Top-level key
      const topMatch = trimmed.match(/^(\w+):\s*(.*)$/);
      if (topMatch) {
        if (topMatch[1] === "defaultAccount") {
          result.defaultAccount = topMatch[2].replace(/['"]/g, "").trim();
        }
        if (topMatch[1] === "accounts") {
          // accounts: starts a list
          continue;
        }
      }

      // List item start
      if (trimmed.match(/^\s+-\s+/)) {
        if (currentAccount) accounts.push(currentAccount);
        currentAccount = {};
        const kv = trimmed.replace(/^\s+-\s+/, "");
        const m = kv.match(/^(\w+):\s*(.*)$/);
        if (m) {
          assignAccountField(currentAccount, m[1], m[2]);
        }
        continue;
      }

      // Continuation of current account
      if (currentAccount) {
        const kvMatch = trimmed.match(/^\s+(\w+):\s*(.*)$/);
        if (kvMatch) {
          assignAccountField(currentAccount, kvMatch[1], kvMatch[2]);
        }
      }
    }

    if (currentAccount) accounts.push(currentAccount);
    if (accounts.length > 0) result.accounts = accounts;
    return result;
  } catch {
    return null;
  }
}

function assignAccountField(account: HsCliAccount, key: string, value: string): void {
  const clean = value.replace(/['"]/g, "").trim();
  if (key === "name") account.name = clean;
  if (key === "accountId") account.accountId = Number(clean) || undefined;
  if (key === "env") account.env = clean;
  if (key === "authType") account.authType = clean;
}

async function resolveGrantedScopes(profile: string, rawScopes?: string): Promise<{ scopes: string[]; source: "flag" | "profile" | "token-info" }> {
  const fromFlag = parseScopeList(rawScopes);
  if (fromFlag.length > 0) return { scopes: fromFlag, source: "flag" };

  try {
    const profileScopes = parseScopeList(getProfile(profile).scopes ?? []);
    if (profileScopes.length > 0) return { scopes: profileScopes, source: "profile" };
  } catch {
    // Fall through to token-info so the error message can be more useful.
  }

  const token = getToken(profile);
  const client = createClient(profile);
  const tokenInfo = await client.request(`/oauth/v1/access-tokens/${encodeURIComponent(token)}`);
  const scopes = extractTokenInfoScopes(tokenInfo);
  if (scopes.length === 0) {
    throw new CliError("TOKEN_SCOPES_UNAVAILABLE", "Token metadata did not include scopes. Pass --granted-scopes explicitly.");
  }
  return { scopes, source: "token-info" };
}

function extractTokenInfoScopes(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return parseScopeList(
    Array.isArray(record.scopes)
      ? record.scopes.filter((item): item is string => typeof item === "string")
      : typeof record.scope === "string"
        ? record.scope
        : undefined,
  );
}

export function registerDoctor(program: Command, getCtx: () => CliContext): void {
  const doctor = program.command("doctor").description("Diagnostics and capability checks");

  doctor
    .command("capabilities")
    .description("Probe endpoint capabilities for the active portal/profile and update local cache")
    .option("--refresh", "Force reprobe even when cache is still valid")
    .option("--ttl-hours <n>", "Capability cache TTL in hours", "24")
    .action(async (opts) => {
      const ctx = getCtx();
      const profile = ctx.profile;
      const token = getToken(profile);
      const ttlHours = parseNumberFlag(String(opts.ttlHours), "--ttl-hours");
      const result = await probeCapabilities({
        profile,
        token,
        refresh: Boolean(opts.refresh),
        ttlMs: ttlHours * 3_600_000,
      });
      printResult(ctx, result);
    });

  const scopes = doctor.command("scopes").description("Inspect HubSpot OAuth/private-app scope catalog and compare required presets");

  scopes
    .command("list")
    .description("List known HubSpot scopes")
    .option("--filter <text>", "Filter by substring")
    .option("--category <name>", "Filter by inferred category, e.g. crm.objects, settings, cms")
    .option("--access <mode>", "Filter by access: read|write|read_write|other")
    .option("--preset <name>", "Show scopes in a preset instead of the whole catalog")
    .action((opts) => {
      const ctx = getCtx();
      const preset = opts.preset ? resolveScopeSet(String(opts.preset)) : undefined;
      const allowed = preset ? new Set(preset.scopes) : undefined;
      const filter = typeof opts.filter === "string" ? opts.filter.trim().toLowerCase() : "";
      const category = typeof opts.category === "string" ? opts.category.trim().toLowerCase() : "";
      const access = typeof opts.access === "string" ? opts.access.trim().toLowerCase() : "";
      const rows = HUBSPOT_SCOPE_CATALOG
        .filter((definition) => !allowed || allowed.has(definition.scope))
        .filter((definition) => !filter || definition.scope.toLowerCase().includes(filter))
        .filter((definition) => !category || definition.category.toLowerCase() === category)
        .filter((definition) => !access || definition.access === access)
        .map((definition) => ({
          scope: definition.scope,
          category: definition.category,
          access: definition.access,
          sensitivity: definition.sensitivity,
          deprecated: definition.deprecated,
          notes: definition.notes,
        }));
      printResult(ctx, {
        preset: preset?.name ?? null,
        count: rows.length,
        scopes: rows,
      });
    });

  scopes
    .command("presets")
    .description("List built-in scope presets")
    .action(() => {
      const ctx = getCtx();
      printResult(ctx, {
        presets: listScopePresetNames().map((name) => {
          const preset = resolveScopeSet(name);
          return { name, count: preset.scopes.length, scopes: preset.scopes };
        }),
      });
    });

  scopes
    .command("explain")
    .argument("<scope>", "Scope name")
    .description("Explain one scope from the local catalog")
    .action((scope) => {
      const ctx = getCtx();
      const definition = getScopeDefinition(scope);
      if (!definition) {
        printResult(ctx, {
          scope,
          known: false,
          message: "Scope is not in hscli's local catalog. Check HubSpot's current private-app scope UI.",
        });
        return;
      }
      printResult(ctx, { known: true, ...definition });
    });

  scopes
    .command("diff")
    .description("Compare granted scopes with a built-in preset or CSV scope list")
    .option("--required <presetOrCsv>", "Preset name or comma/space-separated scope list", "real-mirror-read")
    .option("--granted-scopes <csv>", "Granted scopes CSV/space list; defaults to profile scopes or token-info")
    .action(async (opts) => {
      const ctx = getCtx();
      const required = resolveScopeSet(String(opts.required ?? "real-mirror-read"));
      const granted = await resolveGrantedScopes(ctx.profile, opts.grantedScopes ? String(opts.grantedScopes) : undefined);
      const diff = diffScopes(required.scopes, granted.scopes);
      printResult(ctx, {
        profile: ctx.profile,
        required: { name: required.name, count: diff.required.length },
        granted: { source: granted.source, count: diff.granted.length },
        ok: diff.missing.length === 0,
        presentCount: diff.present.length,
        missingCount: diff.missing.length,
        missing: diff.missing,
        unknownGranted: diff.unknownGranted,
        extraKnown: diff.extraKnown,
      });
    });

  doctor
    .command("hublet-check")
    .description("Verify hublet configuration consistency between hscli and @hubspot/cli")
    .action(async (_opts) => {
      const ctx = getCtx();
      const profile = ctx.profile;
      const checks: Array<{ check: string; status: "ok" | "warning" | "error"; detail: string }> = [];

      // 1. Check hscli profile exists and has hublet info
      let hscliHublet: string | undefined;
      let hscliPortalId: string | undefined;
      let hscliApiDomain: string | undefined;
      try {
        const profileData = getProfile(profile);
        hscliHublet = detectHublet(profileData);
        hscliPortalId = profileData.portalId;
        hscliApiDomain = profileData.apiDomain;

        if (hscliHublet) {
          checks.push({
            check: "hscli_hublet_detected",
            status: "ok",
            detail: `Hublet '${hscliHublet}' detected for profile '${profile}'`,
          });
        } else {
          checks.push({
            check: "hscli_hublet_detected",
            status: "warning",
            detail: `No hublet detected for profile '${profile}'. API calls use global routing (api.hubapi.com). Re-run 'hscli auth login' to auto-detect.`,
          });
        }

        if (hscliApiDomain) {
          checks.push({
            check: "hscli_api_domain",
            status: "ok",
            detail: `API domain: ${hscliApiDomain}`,
          });
        } else {
          const resolved = resolveApiDomain(hscliHublet);
          checks.push({
            check: "hscli_api_domain",
            status: hscliHublet ? "warning" : "ok",
            detail: `No apiDomain saved in profile. Resolved dynamically: ${resolved}. Re-run 'hscli auth login' to persist.`,
          });
        }
      } catch {
        checks.push({
          check: "hscli_profile",
          status: "error",
          detail: `Profile '${profile}' not found. Run 'hscli auth login --token <token>'.`,
        });
      }

      // 2. Check @hubspot/cli config
      const hsConfig = parseHsCliConfig();
      if (!hsConfig) {
        checks.push({
          check: "hscli_config_exists",
          status: "warning",
          detail: "~/.hscli/config.yml not found. @hubspot/cli may not be configured.",
        });
      } else {
        checks.push({
          check: "hscli_config_exists",
          status: "ok",
          detail: "~/.hscli/config.yml found.",
        });

        // Find matching account by portal ID
        const matchingAccount = hscliPortalId
          ? hsConfig.accounts?.find((a) => String(a.accountId) === hscliPortalId)
          : undefined;

        if (matchingAccount) {
          const hsEnv = matchingAccount.env || "prod";
          const expectedEnv = hscliHublet || "prod";

          if (hsEnv === expectedEnv || (hsEnv === "prod" && !hscliHublet)) {
            checks.push({
              check: "hscli_env_match",
              status: "ok",
              detail: `@hubspot/cli env '${hsEnv}' matches hscli hublet for portal ${hscliPortalId}.`,
            });
          } else {
            checks.push({
              check: "hscli_env_match",
              status: "error",
              detail: `MISMATCH: @hubspot/cli has env '${hsEnv}' but hscli detected hublet '${expectedEnv}' for portal ${hscliPortalId}. Fix ~/.hscli/config.yml to set env: ${expectedEnv}`,
            });
          }
        } else if (hscliPortalId) {
          checks.push({
            check: "hscli_portal_match",
            status: "warning",
            detail: `Portal ${hscliPortalId} not found in @hubspot/cli accounts. 'hs project upload' may need --account=${hscliPortalId}.`,
          });
        }
      }

      // 3. Token hublet prefix check
      try {
        const token = getToken(profile);
        const tokenMatch = token.match(/^pat-([a-z0-9]+)-/);
        if (tokenMatch) {
          const tokenHublet = tokenMatch[1] === "na1" ? undefined : tokenMatch[1];
          if (tokenHublet && hscliHublet && tokenHublet !== hscliHublet) {
            checks.push({
              check: "token_hublet_consistency",
              status: "error",
              detail: `Token prefix indicates hublet '${tokenHublet}' but profile has hublet '${hscliHublet}'.`,
            });
          } else {
            checks.push({
              check: "token_hublet_consistency",
              status: "ok",
              detail: `Token prefix ${tokenHublet ? `'${tokenHublet}'` : "'na (global)'"} is consistent.`,
            });
          }
        }
      } catch {
        // Token check is best-effort
      }

      const hasErrors = checks.some((c) => c.status === "error");
      const hasWarnings = checks.some((c) => c.status === "warning");

      printResult(ctx, {
        profile,
        hublet: hscliHublet ?? "na (global)",
        apiDomain: hscliApiDomain ?? resolveApiDomain(hscliHublet),
        portalId: hscliPortalId ?? null,
        overallStatus: hasErrors ? "ERRORS_FOUND" : hasWarnings ? "WARNINGS" : "ALL_OK",
        checks,
      });
    });

  doctor
    .command("internal-adapters")
    .description("List allowlisted browser-session/internal migration adapters")
    .action(() => {
      const ctx = getCtx();
      printResult(ctx, {
        warning: "Internal adapters are explicit migration/setup commands, not a generic internal API passthrough. They require browser-session auth and normal hscli dry-run/force guardrails for writes.",
        adapters: [
          {
            kind: "setup",
            command: "settings business-units capture",
            endpoint: "/api/business-units/v1/business-units",
            auth: "browser-session",
            access: "read",
            status: "supported",
          },
          {
            kind: "setup",
            command: "settings permission-sets list|get|create|update|delete",
            endpoint: "/api/app-users/v1/permission-sets",
            auth: "browser-session",
            access: "read/write",
            status: "supported",
          },
          {
            kind: "migration",
            command: "communication-preferences definitions create-internal",
            endpoint: "/api/subscriptions/v1/definitions",
            auth: "browser-session",
            access: "write",
            status: "supported",
            notes: "Email > Subscription Types creation; use composite idempotency and business-unit remapping.",
          },
          {
            kind: "migration",
            command: "reports capture --session",
            endpoint: "/reports/v2/reports",
            auth: "browser-session",
            access: "read",
            status: "planned",
          },
          {
            kind: "migration",
            command: "dashboards capture --session",
            endpoint: "/dashboard/v2",
            auth: "browser-session",
            access: "read",
            status: "planned",
          },
        ],
      });
    });
}
