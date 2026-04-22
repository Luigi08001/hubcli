import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

function setupHomeWithToken(
  profile = "default",
  token = "pat-na1-test-abc-123",
  extra: Record<string, unknown> = {},
): string {
  const home = mkdtempSync(join(tmpdir(), "hscli-perm-"));
  const dir = join(home, ".hscli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "auth.json"),
    JSON.stringify({ profiles: { [profile]: { token, ...extra } } }),
  );
  process.env.HSCLI_HOME = dir;
  return home;
}

describe("permission profiles", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.HSCLI_HOME;
  });

  it("read-only profile blocks POST", async () => {
    setupHomeWithToken("default", "pat-na1-test", { mode: "read-only" });
    const { enforcePermissionProfile } = await import("../src/core/permissions.js");
    expect(() => enforcePermissionProfile("default", "POST")).toThrow("read-only");
  });

  it("read-only profile blocks PATCH", async () => {
    setupHomeWithToken("default", "pat-na1-test", { mode: "read-only" });
    const { enforcePermissionProfile } = await import("../src/core/permissions.js");
    expect(() => enforcePermissionProfile("default", "PATCH")).toThrow("read-only");
  });

  it("read-only profile blocks PUT", async () => {
    setupHomeWithToken("default", "pat-na1-test", { mode: "read-only" });
    const { enforcePermissionProfile } = await import("../src/core/permissions.js");
    expect(() => enforcePermissionProfile("default", "PUT")).toThrow("read-only");
  });

  it("read-only profile blocks DELETE", async () => {
    setupHomeWithToken("default", "pat-na1-test", { mode: "read-only" });
    const { enforcePermissionProfile } = await import("../src/core/permissions.js");
    expect(() => enforcePermissionProfile("default", "DELETE")).toThrow("read-only");
  });

  it("read-only profile allows GET", async () => {
    setupHomeWithToken("default", "pat-na1-test", { mode: "read-only" });
    const { enforcePermissionProfile } = await import("../src/core/permissions.js");
    expect(() => enforcePermissionProfile("default", "GET")).not.toThrow();
  });

  it("read-write profile allows all methods", async () => {
    setupHomeWithToken("default", "pat-na1-test", { mode: "read-write" });
    const { enforcePermissionProfile } = await import("../src/core/permissions.js");
    for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
      expect(() => enforcePermissionProfile("default", method)).not.toThrow();
    }
  });

  it("default (no mode) allows all methods", async () => {
    setupHomeWithToken("default", "pat-na1-test");
    const { enforcePermissionProfile } = await import("../src/core/permissions.js");
    for (const method of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
      expect(() => enforcePermissionProfile("default", method)).not.toThrow();
    }
  });

  it("isReadOnlyProfile returns true for read-only", async () => {
    setupHomeWithToken("prod", "pat-na1-test", { mode: "read-only" });
    const { isReadOnlyProfile } = await import("../src/core/permissions.js");
    expect(isReadOnlyProfile("prod")).toBe(true);
  });

  it("isReadOnlyProfile returns false for missing profile", async () => {
    setupHomeWithToken("default", "pat-na1-test");
    const { isReadOnlyProfile } = await import("../src/core/permissions.js");
    expect(isReadOnlyProfile("nonexistent")).toBe(false);
  });

  it("auth set-mode persists mode to profile", async () => {
    const home = setupHomeWithToken("myprofile", "pat-na1-test");

    vi.spyOn(console, "log").mockImplementation(() => {});
    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "auth", "set-mode", "myprofile", "read-only"]);

    const auth = JSON.parse(readFileSync(join(home, ".hscli", "auth.json"), "utf8"));
    expect(auth.profiles.myprofile.mode).toBe("read-only");
  });

  it("auth set-mode rejects invalid mode", async () => {
    setupHomeWithToken("default", "pat-na1-test");

    vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "auth", "set-mode", "default", "admin"]);

    const allOutput = [...errSpy.mock.calls.flat()].join("");
    expect(allOutput).toContain("INVALID_MODE");
  });
});
