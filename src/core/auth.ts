import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { CliError } from "./output.js";
import { isVaultEncrypted, readVaultData, writeVaultData, getVaultPassphrase } from "./vault.js";

export interface AuthProfile {
  token: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  portalId?: string;
  uiDomain?: string;
  apiDomain?: string;
  hublet?: string;
  mode?: "read-only" | "read-write";
}

/**
 * Detect the hublet from available profile data.
 * Priority: explicit hublet field > uiDomain > token prefix.
 */
export function detectHublet(profile: Partial<AuthProfile>): string | undefined {
  if (profile.hublet) return profile.hublet;

  // Detect from uiDomain (e.g. "app-eu1.hubspot.com" → "eu1")
  if (profile.uiDomain) {
    const match = profile.uiDomain.match(/^app-([a-z0-9]+)\./);
    if (match) return match[1];
  }

  // Detect from token prefix (e.g. "pat-eu1-..." → "eu1")
  if (profile.token) {
    const tokenMatch = profile.token.match(/^pat-([a-z0-9]+)-/);
    if (tokenMatch && tokenMatch[1] !== "na1") return tokenMatch[1];
  }

  return undefined;
}

/**
 * Resolve the HubSpot API base domain for a given hublet.
 * NA/default → "api.hubapi.com", EU1 → "api-eu1.hubapi.com", etc.
 */
export function resolveApiDomain(hublet?: string): string {
  if (!hublet) return "api.hubapi.com";
  return `api-${hublet}.hubapi.com`;
}

/**
 * Get the API base URL for a profile (hublet-aware).
 */
export function getApiBaseUrl(profile: string): string {
  try {
    const data = getProfile(profile);
    if (data.apiDomain) return `https://${data.apiDomain}`;
    const hublet = detectHublet(data);
    return `https://${resolveApiDomain(hublet)}`;
  } catch {
    return "https://api.hubapi.com";
  }
}

interface AuthFile {
  profiles: Record<string, AuthProfile>;
}

export function getHubcliHomeDir(): string {
  return process.env.HUBCLI_HOME?.trim() || join(homedir(), ".hubcli");
}

function authPaths(): { dir: string; file: string } {
  const root = getHubcliHomeDir();
  return { dir: root, file: join(root, "auth.json") };
}

function readAuthFile(): AuthFile {
  const { dir } = authPaths();
  // If vault is encrypted, read through vault
  if (isVaultEncrypted(dir)) {
    const passphrase = getVaultPassphrase();
    if (passphrase) {
      return readVaultData(dir, passphrase) as AuthFile;
    }
    // Encrypted but no passphrase — fall through to plain file
  }
  const { file } = authPaths();
  if (!existsSync(file)) return { profiles: {} };
  return JSON.parse(readFileSync(file, "utf8")) as AuthFile;
}

function writeAuthFile(data: AuthFile): void {
  const { dir, file } = authPaths();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    chmodSync(dir, 0o700);
  }
  // If vault is encrypted, write through vault
  if (isVaultEncrypted(dir)) {
    const passphrase = getVaultPassphrase();
    if (passphrase) {
      writeVaultData(dir, data, passphrase);
      return;
    }
  }
  writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  if (process.platform !== "win32") {
    chmodSync(file, 0o600);
  }
}

export function saveToken(profile: string, token: string): void {
  if (!token?.trim()) throw new CliError("AUTH_INVALID_TOKEN", "Token cannot be empty");
  const file = readAuthFile();
  file.profiles[profile] = { ...(file.profiles[profile] ?? {}), token };
  writeAuthFile(file);
}

export function saveProfile(profile: string, data: AuthProfile): void {
  if (!data.token?.trim()) throw new CliError("AUTH_INVALID_TOKEN", "Token cannot be empty");
  const file = readAuthFile();
  file.profiles[profile] = { ...file.profiles[profile], ...data, token: data.token.trim() };
  writeAuthFile(file);
}

export function getToken(profile: string): string {
  const file = readAuthFile();
  const token = file.profiles[profile]?.token;
  if (!token) {
    throw new CliError("AUTH_PROFILE_NOT_FOUND", `No token found for profile '${profile}'. Run 'hubcli auth login --token <token>'.`);
  }
  return token;
}

export function removeToken(profile: string): boolean {
  const file = readAuthFile();
  if (!file.profiles[profile]) return false;
  delete file.profiles[profile];
  writeAuthFile(file);
  return true;
}

export function hasProfile(profile: string): boolean {
  const file = readAuthFile();
  return Boolean(file.profiles[profile]);
}

export function listProfiles(): string[] {
  return Object.keys(readAuthFile().profiles).sort();
}

export function getProfile(profile: string): AuthProfile {
  const value = readAuthFile().profiles[profile];
  if (!value) {
    throw new CliError("AUTH_PROFILE_NOT_FOUND", `No profile found for '${profile}'.`);
  }
  return value;
}
