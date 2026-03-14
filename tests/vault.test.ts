import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  encryptVault,
  decryptVault,
  isVaultEncrypted,
  readVaultData,
  writeVaultData,
  encryptExistingVault,
  decryptExistingVault,
} from "../src/core/vault.js";

function makeTmpHome(): string {
  const home = mkdtempSync(join(tmpdir(), "hubcli-vault-"));
  const dir = join(home, ".hubcli");
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("vault encryption", () => {
  const PASSPHRASE = "test-passphrase-2024!";
  const AUTH_DATA = { profiles: { default: { token: "pat-eu1-secret-token" } } };

  beforeEach(() => {
    delete process.env.HUBCLI_VAULT_PASSPHRASE;
  });

  // -----------------------------------------------------------------------
  // Low-level encrypt/decrypt
  // -----------------------------------------------------------------------

  it("encrypt then decrypt roundtrip", () => {
    const plaintext = JSON.stringify(AUTH_DATA);
    const encrypted = encryptVault(plaintext, PASSPHRASE);
    const decrypted = decryptVault(encrypted, PASSPHRASE);
    expect(JSON.parse(decrypted)).toEqual(AUTH_DATA);
  });

  it("wrong passphrase fails to decrypt", () => {
    const encrypted = encryptVault("secret data", PASSPHRASE);
    expect(() => decryptVault(encrypted, "wrong-passphrase")).toThrow("Decryption failed");
  });

  it("tampered data fails to decrypt", () => {
    const encrypted = encryptVault("secret data", PASSPHRASE);
    // Flip a byte in the ciphertext
    encrypted[encrypted.length - 1] ^= 0xff;
    expect(() => decryptVault(encrypted, PASSPHRASE)).toThrow();
  });

  it("too-short data throws", () => {
    expect(() => decryptVault(Buffer.alloc(10), PASSPHRASE)).toThrow("too short");
  });

  it("encrypted output differs each time (random salt+iv)", () => {
    const a = encryptVault("same data", PASSPHRASE);
    const b = encryptVault("same data", PASSPHRASE);
    expect(a.equals(b)).toBe(false);
  });

  // -----------------------------------------------------------------------
  // isVaultEncrypted
  // -----------------------------------------------------------------------

  it("isVaultEncrypted returns false when no auth.enc", () => {
    const dir = makeTmpHome();
    expect(isVaultEncrypted(dir)).toBe(false);
  });

  it("isVaultEncrypted returns true when auth.enc exists", () => {
    const dir = makeTmpHome();
    writeFileSync(join(dir, "auth.enc"), "dummy");
    expect(isVaultEncrypted(dir)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // readVaultData / writeVaultData
  // -----------------------------------------------------------------------

  it("readVaultData reads plain auth.json", () => {
    const dir = makeTmpHome();
    writeFileSync(join(dir, "auth.json"), JSON.stringify(AUTH_DATA));
    const data = readVaultData(dir);
    expect(data).toEqual(AUTH_DATA);
  });

  it("readVaultData reads encrypted auth.enc with passphrase", () => {
    const dir = makeTmpHome();
    const encrypted = encryptVault(JSON.stringify(AUTH_DATA), PASSPHRASE);
    writeFileSync(join(dir, "auth.enc"), encrypted);
    const data = readVaultData(dir, PASSPHRASE);
    expect(data).toEqual(AUTH_DATA);
  });

  it("readVaultData throws when encrypted but no passphrase", () => {
    const dir = makeTmpHome();
    writeFileSync(join(dir, "auth.enc"), Buffer.alloc(100));
    expect(() => readVaultData(dir)).toThrow("HUBCLI_VAULT_PASSPHRASE");
  });

  it("readVaultData returns empty profiles when nothing exists", () => {
    const dir = makeTmpHome();
    const data = readVaultData(dir) as { profiles: object };
    expect(data.profiles).toEqual({});
  });

  it("writeVaultData writes plain json without passphrase", () => {
    const dir = makeTmpHome();
    writeVaultData(dir, AUTH_DATA);
    expect(existsSync(join(dir, "auth.json"))).toBe(true);
    expect(existsSync(join(dir, "auth.enc"))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, "auth.json"), "utf8"))).toEqual(AUTH_DATA);
  });

  it("writeVaultData writes encrypted and removes auth.json", () => {
    const dir = makeTmpHome();
    // Start with a plain file
    writeFileSync(join(dir, "auth.json"), "{}");
    writeVaultData(dir, AUTH_DATA, PASSPHRASE);
    expect(existsSync(join(dir, "auth.enc"))).toBe(true);
    expect(existsSync(join(dir, "auth.json"))).toBe(false);
    // Verify we can read it back
    const data = readVaultData(dir, PASSPHRASE);
    expect(data).toEqual(AUTH_DATA);
  });

  // -----------------------------------------------------------------------
  // encryptExistingVault / decryptExistingVault
  // -----------------------------------------------------------------------

  it("encryptExistingVault encrypts and removes auth.json", () => {
    const dir = makeTmpHome();
    writeFileSync(join(dir, "auth.json"), JSON.stringify(AUTH_DATA));
    encryptExistingVault(dir, PASSPHRASE);
    expect(existsSync(join(dir, "auth.json"))).toBe(false);
    expect(existsSync(join(dir, "auth.enc"))).toBe(true);
  });

  it("encryptExistingVault throws when no auth.json", () => {
    const dir = makeTmpHome();
    expect(() => encryptExistingVault(dir, PASSPHRASE)).toThrow("No auth.json");
  });

  it("decryptExistingVault decrypts and removes auth.enc", () => {
    const dir = makeTmpHome();
    writeFileSync(join(dir, "auth.json"), JSON.stringify(AUTH_DATA));
    encryptExistingVault(dir, PASSPHRASE);
    decryptExistingVault(dir, PASSPHRASE);
    expect(existsSync(join(dir, "auth.json"))).toBe(true);
    expect(existsSync(join(dir, "auth.enc"))).toBe(false);
    expect(JSON.parse(readFileSync(join(dir, "auth.json"), "utf8"))).toEqual(AUTH_DATA);
  });

  it("decryptExistingVault throws when no auth.enc", () => {
    const dir = makeTmpHome();
    expect(() => decryptExistingVault(dir, PASSPHRASE)).toThrow("No auth.enc");
  });

  it("full lifecycle: plain → encrypt → read encrypted → decrypt → read plain", () => {
    const dir = makeTmpHome();
    // 1. Write plain
    writeVaultData(dir, AUTH_DATA);
    expect(readVaultData(dir)).toEqual(AUTH_DATA);
    // 2. Encrypt
    encryptExistingVault(dir, PASSPHRASE);
    expect(isVaultEncrypted(dir)).toBe(true);
    // 3. Read encrypted
    expect(readVaultData(dir, PASSPHRASE)).toEqual(AUTH_DATA);
    // 4. Decrypt
    decryptExistingVault(dir, PASSPHRASE);
    expect(isVaultEncrypted(dir)).toBe(false);
    // 5. Read plain again
    expect(readVaultData(dir)).toEqual(AUTH_DATA);
  });
});
