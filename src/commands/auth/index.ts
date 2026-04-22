import { Command } from "commander";
import { readFileSync } from "node:fs";
import { HubSpotClient } from "../../core/http.js";
import { getProfile, getToken, hasProfile, listProfiles, removeToken, saveProfile, saveToken, detectHublet, resolveApiDomain, getHubcliHomeDir } from "../../core/auth.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { encryptExistingVault, decryptExistingVault, getVaultPassphrase, isVaultEncrypted } from "../../core/vault.js";

async function fetchPortalDetails(token: string): Promise<{ portalId?: string; uiDomain?: string }> {
  const result: { portalId?: string; uiDomain?: string } = {};
  try {
    const res = await fetch("https://api.hubapi.com/account-info/v3/details", {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      if (data.portalId) result.portalId = String(data.portalId);
      if (data.uiDomain) result.uiDomain = String(data.uiDomain);
    }
  } catch {
    // Non-critical — URL generation will just be unavailable.
  }
  if (!result.portalId) {
    try {
      const res = await fetch("https://api.hubapi.com/integrations/v1/me", {
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
    .action(async (opts) => {
      const ctx = getCtx();
      const profile = opts.profile ?? ctx.profile;
      const token = resolveLoginToken(opts);
      saveToken(profile, token);
      const details = await fetchPortalDetails(token);
      // Auto-detect hublet and resolve API domain
      const hublet = detectHublet({ token, uiDomain: details.uiDomain });
      const apiDomain = resolveApiDomain(hublet);
      if (details.portalId || details.uiDomain) {
        saveProfile(profile, { token, ...details, hublet, apiDomain });
      }
      printResult(ctx, {
        message: `Token saved for profile '${profile}'`,
        portalId: details.portalId ?? null,
        uiDomain: details.uiDomain ?? null,
        hublet: hublet ?? "na",
        apiDomain,
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
    const token = getToken(profile);
    const client = new HubSpotClient(token);
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
      const hscliHome = getHubcliHomeDir();
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
      const hscliHome = getHubcliHomeDir();
      if (!isVaultEncrypted(hscliHome)) {
        throw new CliError("VAULT_NOT_ENCRYPTED", "No auth.enc found — vault is not encrypted.");
      }
      decryptExistingVault(hscliHome, passphrase);
      printResult(ctx, { decrypted: true, message: "auth.enc decrypted to auth.json and removed." });
    });
}
