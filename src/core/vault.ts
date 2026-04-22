/**
 * Optional encrypted token vault for ~/.revfleet/auth.json.
 *
 * Uses AES-256-GCM with PBKDF2 key derivation — Node.js built-in crypto only.
 * Passphrase is read from HSCLI_VAULT_PASSPHRASE env var.
 *
 * File format (auth.enc): salt(32) | iv(16) | authTag(16) | ciphertext
 */
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_DIGEST = "sha512";

const AUTH_JSON = "auth.json";
const AUTH_ENC = "auth.enc";

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST);
}

/**
 * Encrypt plaintext data with a passphrase.
 * Returns: salt(32) + iv(16) + authTag(16) + ciphertext
 */
export function encryptVault(data: string, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(passphrase, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypt encrypted vault data with a passphrase.
 * Throws on wrong passphrase or tampered data.
 */
export function decryptVault(encrypted: Buffer, passphrase: string): string {
  if (encrypted.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Encrypted vault data is too short — file may be corrupted.");
  }

  const salt = encrypted.subarray(0, SALT_LENGTH);
  const iv = encrypted.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encrypted.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Decryption failed — wrong passphrase or corrupted vault.");
  }
}

/**
 * Check if the vault is encrypted (auth.enc exists).
 */
export function isVaultEncrypted(hscliHome: string): boolean {
  return existsSync(join(hscliHome, AUTH_ENC));
}

/**
 * Get the vault passphrase from environment.
 * Returns undefined if not set (plain-text mode).
 */
export function getVaultPassphrase(): string | undefined {
  const v = process.env.HSCLI_VAULT_PASSPHRASE?.trim();
  return v || undefined;
}

/**
 * Read vault data — plain JSON or encrypted, depending on what exists.
 * Priority: if auth.enc exists and passphrase is available, decrypt it.
 * Otherwise, fall back to auth.json.
 */
export function readVaultData(hscliHome: string, passphrase?: string): object {
  const encPath = join(hscliHome, AUTH_ENC);
  const jsonPath = join(hscliHome, AUTH_JSON);

  if (existsSync(encPath)) {
    const pp = passphrase ?? getVaultPassphrase();
    if (!pp) {
      throw new Error("Vault is encrypted but HSCLI_VAULT_PASSPHRASE is not set.");
    }
    const encrypted = readFileSync(encPath);
    const plaintext = decryptVault(encrypted, pp);
    return JSON.parse(plaintext);
  }

  if (existsSync(jsonPath)) {
    return JSON.parse(readFileSync(jsonPath, "utf8"));
  }

  return { profiles: {} };
}

/**
 * Write vault data — encrypted if passphrase is provided, plain JSON otherwise.
 */
export function writeVaultData(hscliHome: string, data: object, passphrase?: string): void {
  const pp = passphrase ?? getVaultPassphrase();
  const jsonPath = join(hscliHome, AUTH_JSON);
  const encPath = join(hscliHome, AUTH_ENC);

  if (pp) {
    const plaintext = JSON.stringify(data, null, 2);
    const encrypted = encryptVault(plaintext, pp);
    writeFileSync(encPath, encrypted);
    // Remove plain-text version for security
    if (existsSync(jsonPath)) {
      unlinkSync(jsonPath);
    }
  } else {
    writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf8");
  }
}

/**
 * Encrypt existing auth.json → auth.enc and remove the plain file.
 */
export function encryptExistingVault(hscliHome: string, passphrase: string): void {
  const jsonPath = join(hscliHome, AUTH_JSON);
  if (!existsSync(jsonPath)) {
    throw new Error("No auth.json found to encrypt.");
  }
  const data = readFileSync(jsonPath, "utf8");
  const encrypted = encryptVault(data, passphrase);
  writeFileSync(join(hscliHome, AUTH_ENC), encrypted);
  unlinkSync(jsonPath);
}

/**
 * Decrypt auth.enc → auth.json and remove the encrypted file.
 */
export function decryptExistingVault(hscliHome: string, passphrase: string): void {
  const encPath = join(hscliHome, AUTH_ENC);
  if (!existsSync(encPath)) {
    throw new Error("No auth.enc found to decrypt.");
  }
  const encrypted = readFileSync(encPath);
  const plaintext = decryptVault(encrypted, passphrase);
  // Validate it's valid JSON
  JSON.parse(plaintext);
  writeFileSync(join(hscliHome, AUTH_JSON), plaintext, "utf8");
  unlinkSync(encPath);
}
