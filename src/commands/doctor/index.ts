import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getToken, getProfile, detectHublet, resolveApiDomain } from "../../core/auth.js";
import { probeCapabilities } from "../../core/capabilities.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
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
}
