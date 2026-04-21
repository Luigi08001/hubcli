import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { enforceWritePolicy, findMatchingRule, readPolicyFile, type PolicyConfig } from "../src/core/policy.js";
import { CliError, type CliContext } from "../src/core/output.js";

function writePolicy(content: PolicyConfig): string {
  const dir = mkdtempSync(join(tmpdir(), "hscli-policy-"));
  const file = join(dir, "policy.json");
  writeFileSync(file, JSON.stringify(content), "utf8");
  return file;
}

function makeCtx(overrides: Partial<CliContext> = {}): CliContext {
  return {
    profile: "default",
    json: false,
    dryRun: false,
    force: true,
    strictCapabilities: false,
    format: "json",
    ...overrides,
  };
}

describe("policy", () => {
  const tmpFiles: string[] = [];
  afterEach(() => {
    for (const f of tmpFiles) {
      try { rmSync(f, { force: true }); } catch { /* ignore */ }
    }
    tmpFiles.length = 0;
    delete process.env.HSCLI_POLICY_FILE;
  });

  // ────────────────────────────────────────────
  // readPolicyFile
  // ────────────────────────────────────────────

  it("readPolicyFile parses a valid v2 policy", () => {
    const f = writePolicy({
      version: 2,
      profiles: {
        default: {
          defaultAction: "deny",
          rules: [{ name: "r1", match: { method: "GET", path: "**" }, action: "allow" }],
        },
      },
    });
    tmpFiles.push(f);
    const cfg = readPolicyFile(f);
    expect(cfg.version).toBe(2);
    expect(cfg.profiles?.default?.rules?.[0]?.name).toBe("r1");
  });

  it("readPolicyFile throws on missing file", () => {
    expect(() => readPolicyFile("/tmp/does-not-exist-" + Date.now())).toThrow(/not found/i);
  });

  it("readPolicyFile throws on invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "hscli-policy-bad-"));
    const file = join(dir, "policy.json");
    writeFileSync(file, "not-json{", "utf8");
    tmpFiles.push(file);
    expect(() => readPolicyFile(file)).toThrow(/invalid policy json/i);
  });

  // ────────────────────────────────────────────
  // findMatchingRule + glob matching
  // ────────────────────────────────────────────

  it("findMatchingRule — exact path match", () => {
    const cfg = { rules: [{ name: "r", match: { method: "GET", path: "/crm/v3/objects/contacts" } }] };
    expect(findMatchingRule(cfg, "GET", "/crm/v3/objects/contacts")?.name).toBe("r");
    expect(findMatchingRule(cfg, "GET", "/crm/v3/objects/deals")).toBeNull();
  });

  it("findMatchingRule — single-* glob matches within segment", () => {
    const cfg = { rules: [{ name: "r", match: { method: "GET", path: "/crm/v3/objects/*" } }] };
    expect(findMatchingRule(cfg, "GET", "/crm/v3/objects/contacts")?.name).toBe("r");
    // * does NOT cross /
    expect(findMatchingRule(cfg, "GET", "/crm/v3/objects/contacts/123")).toBeNull();
  });

  it("findMatchingRule — ** globstar matches across segments", () => {
    const cfg = { rules: [{ name: "r", match: { method: "*", path: "**/gdpr-delete**" } }] };
    expect(findMatchingRule(cfg, "POST", "/crm/v3/objects/contacts/gdpr-delete")?.name).toBe("r");
    expect(findMatchingRule(cfg, "DELETE", "/crm/v3/objects/contacts/gdpr-delete/batch")?.name).toBe("r");
    expect(findMatchingRule(cfg, "POST", "/crm/v3/objects/contacts")).toBeNull();
  });

  it("findMatchingRule — method '*' matches any", () => {
    const cfg = { rules: [{ name: "r", match: { method: "*", path: "**" } }] };
    expect(findMatchingRule(cfg, "GET", "/any")?.name).toBe("r");
    expect(findMatchingRule(cfg, "DELETE", "/any")?.name).toBe("r");
  });

  it("findMatchingRule — first match wins", () => {
    const cfg = { rules: [
      { name: "first", match: { method: "POST", path: "/crm/v3/**" } },
      { name: "second", match: { method: "POST", path: "**" } },
    ]};
    expect(findMatchingRule(cfg, "POST", "/crm/v3/objects/contacts")?.name).toBe("first");
  });

  it("findMatchingRule — returns null when no rules", () => {
    expect(findMatchingRule({}, "POST", "/any")).toBeNull();
    expect(findMatchingRule({ rules: [] }, "POST", "/any")).toBeNull();
  });

  // ────────────────────────────────────────────
  // enforceWritePolicy — v2 rules
  // ────────────────────────────────────────────

  it("enforceWritePolicy — no policy file is a no-op", () => {
    expect(() => enforceWritePolicy(makeCtx(), "POST", "/anything")).not.toThrow();
  });

  it("enforceWritePolicy — rule 'deny' blocks", () => {
    const f = writePolicy({
      version: 2,
      profiles: {
        default: {
          rules: [{ name: "block-deletes", match: { method: "DELETE", path: "**" }, action: "deny" }],
        },
      },
    });
    tmpFiles.push(f);
    const ctx = makeCtx({ policyFile: f });
    expect(() => enforceWritePolicy(ctx, "DELETE", "/crm/v3/objects/contacts/123"))
      .toThrowError(/denies/i);
    // POST should pass (no rule matches + default is allow)
    expect(() => enforceWritePolicy(ctx, "POST", "/crm/v3/objects/contacts")).not.toThrow();
  });

  it("enforceWritePolicy — defaultAction 'deny' + no match blocks", () => {
    const f = writePolicy({
      version: 2,
      profiles: {
        default: {
          defaultAction: "deny",
          rules: [{ name: "allow-reads", match: { method: "GET", path: "**" }, action: "allow" }],
        },
      },
    });
    tmpFiles.push(f);
    const ctx = makeCtx({ policyFile: f });
    expect(() => enforceWritePolicy(ctx, "POST", "/anything"))
      .toThrowError(/no policy rule matched/i);
  });

  it("enforceWritePolicy — requireChangeTicket is enforced", () => {
    const f = writePolicy({
      version: 2,
      profiles: {
        default: {
          rules: [{
            name: "writes-need-ticket",
            match: { method: "POST", path: "**" },
            action: "allow",
            requireChangeTicket: true,
          }],
        },
      },
    });
    tmpFiles.push(f);
    const ctxNoTicket = makeCtx({ policyFile: f });
    expect(() => enforceWritePolicy(ctxNoTicket, "POST", "/crm/v3/objects/contacts"))
      .toThrowError(/requires --change-ticket/i);

    const ctxWithTicket = makeCtx({ policyFile: f, changeTicket: "JIRA-123" });
    expect(() => enforceWritePolicy(ctxWithTicket, "POST", "/crm/v3/objects/contacts")).not.toThrow();
  });

  it("enforceWritePolicy — requireApproval returns POLICY_APPROVAL_REQUIRED", () => {
    const f = writePolicy({
      version: 2,
      profiles: {
        default: {
          rules: [{
            name: "sensitive",
            match: { method: "DELETE", path: "**" },
            action: "allow",
            requireApproval: "manual",
          }],
        },
      },
    });
    tmpFiles.push(f);
    expect(() => enforceWritePolicy(makeCtx({ policyFile: f }), "DELETE", "/any"))
      .toThrowError(/requires approval/i);
  });

  it("enforceWritePolicy — legacy v1 flat format still works (allowWrite: false)", () => {
    const f = writePolicy({
      defaults: { allowWrite: false },
    } as PolicyConfig);
    tmpFiles.push(f);
    expect(() => enforceWritePolicy(makeCtx({ policyFile: f }), "POST", "/anything"))
      .toThrowError(/blocks write operations/i);
  });

  it("enforceWritePolicy — legacy blockedMethodPathPrefixes still works", () => {
    const f = writePolicy({
      blockedMethodPathPrefixes: { DELETE: ["/crm/v3/objects/contacts"] },
    });
    tmpFiles.push(f);
    expect(() => enforceWritePolicy(makeCtx({ policyFile: f }), "DELETE", "/crm/v3/objects/contacts/123"))
      .toThrowError(/blocks DELETE on path/i);
    // Other paths should pass
    expect(() => enforceWritePolicy(makeCtx({ policyFile: f }), "DELETE", "/crm/v3/objects/deals/123"))
      .not.toThrow();
  });

  it("enforceWritePolicy — per-profile rules override defaults", () => {
    const f = writePolicy({
      version: 2,
      defaults: { defaultAction: "deny" },
      profiles: {
        prod: { defaultAction: "allow" },
      },
    });
    tmpFiles.push(f);
    // "prod" profile → allow
    expect(() => enforceWritePolicy(makeCtx({ profile: "prod", policyFile: f }), "POST", "/any")).not.toThrow();
    // Other profile → falls to defaults → deny
    expect(() => enforceWritePolicy(makeCtx({ profile: "staging", policyFile: f }), "POST", "/any"))
      .toThrowError(/no policy rule matched/i);
  });

  // ────────────────────────────────────────────
  // HSCLI_POLICY_FILE env var fallback
  // ────────────────────────────────────────────

  it("enforceWritePolicy — HSCLI_POLICY_FILE env var is honored", () => {
    const f = writePolicy({
      version: 2,
      profiles: { default: { defaultAction: "deny" } },
    });
    tmpFiles.push(f);
    process.env.HSCLI_POLICY_FILE = f;
    expect(() => enforceWritePolicy(makeCtx(), "POST", "/any")).toThrowError(/no policy rule matched/i);
  });

  // ────────────────────────────────────────────
  // Time window enforcement
  // ────────────────────────────────────────────

  it("enforceWritePolicy — window.days 'mon-fri' on Saturday → throws OUT_OF_WINDOW", () => {
    const saturday = new Date("2026-04-18T12:00:00Z"); // Saturday UTC
    const realDate = Date;
     
    (globalThis as any).Date = class extends realDate {
      constructor() { super(); return saturday; }
      static now() { return saturday.getTime(); }
    };
    try {
      const f = writePolicy({
        version: 2,
        profiles: {
          default: {
            rules: [{
              name: "weekdays-only",
              match: { method: "POST", path: "**" },
              action: "allow",
              window: { days: "mon-fri" },
            }],
          },
        },
      });
      tmpFiles.push(f);
      expect(() => enforceWritePolicy(makeCtx({ policyFile: f }), "POST", "/any"))
        .toThrowError(/outside its allowed time window/i);
    } finally {
       
      (globalThis as any).Date = realDate;
    }
  });

  it("enforceWritePolicy — must have a CliError code constant", () => {
    const f = writePolicy({
      version: 2,
      profiles: { default: { rules: [{ match: { method: "DELETE", path: "**" }, action: "deny" }] } },
    });
    tmpFiles.push(f);
    let caught: unknown;
    try { enforceWritePolicy(makeCtx({ policyFile: f }), "DELETE", "/any"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(CliError);
    expect((caught as CliError).code).toBe("POLICY_RULE_DENY");
  });
});
