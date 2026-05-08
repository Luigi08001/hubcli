import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function setupHomeWithToken(): void {
  const home = mkdtempSync(join(tmpdir(), "hscli-users-"));
  const dir = join(home, ".hscli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles: { default: { token: "pat-na1-test" } } }));
  process.env.HSCLI_HOME = dir;
}

describe("settings users", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    process.exitCode = undefined;
  });

  it("forces sendWelcomeEmail=false by default on user create", async () => {
    setupHomeWithToken();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hscli",
      "--json",
      "--dry-run",
      "settings",
      "users",
      "create",
      "--data",
      '{"email":"new@example.com","firstName":"New"}',
    ]);

    const output = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"));
    expect(output.ok).toBe(true);
    expect(output.data.body).toMatchObject({
      email: "new@example.com",
      firstName: "New",
      sendWelcomeEmail: false,
    });
  });

  it("blocks invite email fields unless explicitly allowed", async () => {
    setupHomeWithToken();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hscli",
      "--json",
      "--dry-run",
      "settings",
      "users",
      "create",
      "--data",
      '{"email":"new@example.com","sendWelcomeEmail":true}',
    ]);

    expect(String(errSpy.mock.calls[0]?.[0] ?? "")).toContain("USER_INVITE_EMAIL_BLOCKED");
  });
});
