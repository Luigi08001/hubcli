import { Command } from "commander";
import { readFileSync } from "node:fs";
import { createClient } from "../../core/http.js";
import {
  getProfile,
  getToken,
  hasProfile,
  listProfiles,
  removeToken,
  saveProfile,
  saveToken,
  detectHublet,
  resolveApiDomain,
  getHscliHomeDir,
  normalizeApiDomain,
  normalizeStoredHublet,
} from "../../core/auth.js";

/**
 * Derive an API base URL from what we can see *before* the profile exists
 * — used during `auth login` to verify the token against the right hublet
 * on the first call, so EU/AP portals don't first 4xx against na1 and
 * then succeed on retry.
 */
function resolveVerifyBaseUrl(token: string, hubletOverride?: string, apiDomainOverride?: string): string {
  if (apiDomainOverride?.trim()) return `https://${normalizeApiDomain(apiDomainOverride)}`;
  const hublet = hubletOverride ? normalizeStoredHublet(hubletOverride) : detectHublet({ token });
  return `https://${resolveApiDomain(hublet)}`;
}
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { encryptExistingVault, decryptExistingVault, getVaultPassphrase, isVaultEncrypted } from "../../core/vault.js";

async function fetchPortalDetails(token: string, routing: { hublet?: string; apiDomain?: string } = {}): Promise<{ portalId?: string; uiDomain?: string; dataHostingLocation?: string }> {
  const result: { portalId?: string; uiDomain?: string; dataHostingLocation?: string } = {};
  const baseUrl = resolveVerifyBaseUrl(token, routing.hublet, routing.apiDomain);
  try {
    const res = await fetch(`${baseUrl}/account-info/v3/details`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (data.portalId) result.portalId = String(data.portalId);
      if (data.uiDomain) result.uiDomain = String(data.uiDomain);
      if (data.dataHostingLocation) result.dataHostingLocation = String(data.dataHostingLocation);
    }
  } catch {
    // Non-critical — URL generation will just be unavailable.
  }
  if (!result.portalId) {
    try {
      const res = await fetch(`${baseUrl}/integrations/v1/me`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        if (data.portalId) result.portalId = String(data.portalId);
      }
    } catch {
      // Non-critical fallback.
    }
  }
  return result;
}

interface LoginOptions {
  token?: string;
  tokenStdin?: boolean;
  profile?: string;
  hublet?: string;
  apiDomain?: string;
}

function resolveLoginToken(opts: LoginOptions): string {
  const hasInlineToken = Boolean(opts.token?.trim());
  const useStdin = Boolean(opts.tokenStdin);

  if (hasInlineToken && useStdin) {
    throw new CliError("AUTH_TOKEN_INPUT_CONFLICT", "Use either --token or --token-stdin, not both.");
  }
  if (!hasInlineToken && !useStdin) {
    throw new CliError("AUTH_TOKEN_REQUIRED", "Provide --token or --token-stdin.");
  }
  if (useStdin) {
    if (process.stdin.isTTY) {
      throw new CliError("AUTH_STDIN_REQUIRED", "--token-stdin requires piped stdin input.");
    }
    const stdinToken = readFileSync(0, "utf8").trim();
    if (!stdinToken) {
      throw new CliError("AUTH_INVALID_TOKEN", "Token cannot be empty");
    }
    return stdinToken;
  }
  return opts.token!.trim();
}

export function registerAuth(program: Command, getCtx: () => CliContext): void {
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("login")
    .option("--token <token>", "HubSpot private app token")
    .option("--token-stdin", "Read HubSpot private app token from stdin")
    .option("--profile <name>", "Profile name override")
    .option("--hublet <id>", "Force hublet routing during verification and persist it (eu1, na1, na2, ap1)")
    .option("--api-domain <domain>", "Advanced: force and persist API domain (api.hubapi.com or api-<hublet>.hubapi.com)")
    .option("--no-verify", "Skip portal verification (token is saved without contacting HubSpot)")
    .action(async (opts) => {
      const ctx = getCtx();
      const profile = opts.profile ?? ctx.profile;
      const token = resolveLoginToken(opts);
      const hubletOverride = opts.hublet ?? ctx.hublet;
      const apiDomainOverride = opts.apiDomain ?? (!hubletOverride ? ctx.apiBaseUrl : undefined);
      if (hubletOverride && apiDomainOverride) {
        throw new CliError("API_ROUTING_CONFLICT", "Use either --hublet or --api-domain, not both.");
      }
      const shouldVerify = opts.verify !== false;
      const details = shouldVerify ? await fetchPortalDetails(token, { hublet: hubletOverride, apiDomain: apiDomainOverride }) : {};
      const verificationFailed = shouldVerify && !details.portalId && !details.uiDomain;
      if (verificationFailed) {
        // Emit a loud warning but don't abort: the user may be on a
        // restricted network or intentionally seeding a profile before
        // the portal is reachable. `--no-verify` skips the check entirely.
        console.error(
          `[auth] WARNING: portal verification failed for '${profile}'. ` +
          `Could not reach /account-info/v3/details or /integrations/v1/me. ` +
          `Token has been saved but may be invalid. Re-run without this warning ` +
          `once the portal is reachable, or pass --no-verify to silence.`,
        );
      }
      saveToken(profile, token);
      const storedHublet = hubletOverride
        ? normalizeStoredHublet(hubletOverride)
        : details.dataHostingLocation
          ? normalizeStoredHublet(details.dataHostingLocation)
          : detectHublet({ token, uiDomain: details.uiDomain }) ?? undefined;
      const apiDomain = apiDomainOverride ? normalizeApiDomain(apiDomainOverride) : resolveApiDomain(storedHublet);
      if (details.portalId || details.uiDomain || storedHublet || apiDomainOverride) {
        saveProfile(profile, { token, ...details, hublet: storedHublet, apiDomain });
      }
      printResult(ctx, {
        message: `Token saved for profile '${profile}'`,
        portalId: details.portalId ?? null,
        uiDomain: details.uiDomain ?? null,
        dataHostingLocation: details.dataHostingLocation ?? null,
        hublet: storedHublet ?? "na",
        apiDomain,
        verified: shouldVerify && !verificationFailed,
      });
    });

  auth.command("whoami").action(() => {
    const ctx = getCtx();
    printResult(ctx, { profile: ctx.profile, authenticated: hasProfile(ctx.profile) });
  });

  auth.command("profiles").description("List local auth profiles").action(() => {
    const ctx = getCtx();
    printResult(ctx, { profiles: listProfiles() });
  });

  auth.command("logout").option("--profile <name>", "Profile name override").action((opts) => {
    const ctx = getCtx();
    const profile = opts.profile ?? ctx.profile;
    const removed = removeToken(profile);
    printResult(ctx, { profile, removed });
  });

  auth.command("token-info").option("--profile <name>", "Profile name override").description("Inspect token metadata/scopes").action(async (opts) => {
    const ctx = getCtx();
    const profile = opts.profile ?? ctx.profile;
    const client = createClient(profile);
    // The token is embedded in the URL path by HubSpot's design; trace
    // events redact this path via redactTokenPath() in http.ts so the
    // raw secret never hits disk.
    const token = getToken(profile);
    const res = await client.request(`/oauth/v1/access-tokens/${encodeURIComponent(token)}`);
    printResult(ctx, { profile, tokenInfo: res });
  });

  auth.command("profile-show").option("--profile <name>", "Profile name override").description("Show local stored profile metadata").action((opts) => {
    const ctx = getCtx();
    const profile = opts.profile ?? ctx.profile;
    const data = getProfile(profile);
    printResult(ctx, { profile, data });
  });

  auth.command("set-mode")
    .argument("<profile>", "Profile name")
    .argument("<mode>", "Permission mode: read-only or read-write")
    .description("Set permission mode on a profile (read-only blocks all writes)")
    .action((profileArg, modeArg) => {
      const ctx = getCtx();
      const mode = String(modeArg).trim();
      if (mode !== "read-only" && mode !== "read-write") {
        throw new CliError("INVALID_MODE", `Mode must be 'read-only' or 'read-write', got '${mode}'`);
      }
      const profile = String(profileArg).trim();
      const data = getProfile(profile);
      saveProfile(profile, { ...data, mode });
      printResult(ctx, { profile, mode, message: `Profile '${profile}' set to ${mode}` });
    });

  auth.command("set-hublet")
    .argument("<profile>", "Profile name")
    .argument("<hublet>", "Hublet id: eu1, na1, na2, ap1, etc.")
    .description("Set hublet-aware API routing on a stored profile")
    .action((profileArg, hubletArg) => {
      const ctx = getCtx();
      const profile = String(profileArg).trim();
      const hublet = normalizeStoredHublet(String(hubletArg));
      const data = getProfile(profile);
      const apiDomain = resolveApiDomain(hublet);
      saveProfile(profile, { ...data, hublet, apiDomain });
      printResult(ctx, {
        profile,
        hublet,
        apiDomain,
        apiBaseUrl: `https://${apiDomain}`,
        message: `Profile '${profile}' routes through ${apiDomain}`,
      });
    });

  auth.command("oauth-url")
    .requiredOption("--client-id <id>", "OAuth app client id")
    .requiredOption("--redirect-uri <uri>", "OAuth redirect URI")
    .option("--scopes <csv>", "Comma-separated scopes")
    .option("--state <value>", "OAuth state")
    .description("Generate OAuth authorization URL")
    .action((opts) => {
      const ctx = getCtx();
      const params = new URLSearchParams();
      params.set("client_id", String(opts.clientId));
      params.set("redirect_uri", String(opts.redirectUri));
      params.set("response_type", "code");
      params.set("scope", String(opts.scopes ?? ""));
      if (opts.state) params.set("state", String(opts.state));
      const url = `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
      printResult(ctx, { authorizeUrl: url });
    });

  auth.command("oauth-exchange")
    .requiredOption("--client-id <id>", "OAuth app client id")
    .requiredOption("--client-secret <secret>", "OAuth app client secret")
    .requiredOption("--code <code>", "Authorization code")
    .requiredOption("--redirect-uri <uri>", "OAuth redirect URI")
    .option("--profile <name>", "Profile name override")
    .description("Exchange OAuth code for access token and save profile")
    .action(async (opts) => {
      const ctx = getCtx();
      const profile = opts.profile ?? ctx.profile;
      const payload = new URLSearchParams();
      payload.set("grant_type", "authorization_code");
      payload.set("client_id", String(opts.clientId));
      payload.set("client_secret", String(opts.clientSecret));
      payload.set("redirect_uri", String(opts.redirectUri));
      payload.set("code", String(opts.code));

      const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: payload.toString(),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) {
        throw new CliError("AUTH_OAUTH_EXCHANGE_FAILED", `OAuth exchange failed (${response.status})`, response.status, data);
      }
      const accessToken = String(data.access_token ?? "");
      if (!accessToken) {
        throw new CliError("AUTH_OAUTH_EXCHANGE_FAILED", "Missing access_token in OAuth exchange response", response.status, data);
      }

      const scopes = typeof data.scope === "string" ? data.scope.split(" ").filter(Boolean) : undefined;
      const expiresIn = Number(data.expires_in ?? 0);
      const expiresAt = Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined;

      saveProfile(profile, {
        token: accessToken,
        refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : undefined,
        scopes,
        expiresAt,
      });

      printResult(ctx, {
        profile,
        saved: true,
        hasRefreshToken: typeof data.refresh_token === "string",
        expiresAt,
        scopes,
      });
    });

  auth.command("encrypt")
    .description("Encrypt auth.json with AES-256-GCM (passphrase from HSCLI_VAULT_PASSPHRASE)")
    .action(() => {
      const ctx = getCtx();
      const passphrase = getVaultPassphrase();
      if (!passphrase) {
        throw new CliError("VAULT_NO_PASSPHRASE", "Set HSCLI_VAULT_PASSPHRASE env var before encrypting.");
      }
      const hscliHome = getHscliHomeDir();
      encryptExistingVault(hscliHome, passphrase);
      printResult(ctx, { encrypted: true, message: "auth.json encrypted to auth.enc and removed." });
    });

  auth.command("decrypt")
    .description("Decrypt auth.enc back to auth.json (passphrase from HSCLI_VAULT_PASSPHRASE)")
    .action(() => {
      const ctx = getCtx();
      const passphrase = getVaultPassphrase();
      if (!passphrase) {
        throw new CliError("VAULT_NO_PASSPHRASE", "Set HSCLI_VAULT_PASSPHRASE env var before decrypting.");
      }
      const hscliHome = getHscliHomeDir();
      if (!isVaultEncrypted(hscliHome)) {
        throw new CliError("VAULT_NOT_ENCRYPTED", "No auth.enc found — vault is not encrypted.");
      }
      decryptExistingVault(hscliHome, passphrase);
      printResult(ctx, { decrypted: true, message: "auth.enc decrypted to auth.json and removed." });
    });
}
