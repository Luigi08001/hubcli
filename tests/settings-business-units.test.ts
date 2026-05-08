import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function setupHomeWithToken(): void {
  const home = mkdtempSync(join(tmpdir(), "hscli-bu-"));
  const dir = join(home, ".hscli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles: { default: { token: "pat-na1-test" } } }));
  process.env.HSCLI_HOME = dir;
}

describe("settings business-units", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    process.exitCode = undefined;
  });

  it("dry-runs internal business-unit creates with a portal-scoped path", async () => {
    setupHomeWithToken();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run([
      "node",
      "hscli",
      "--json",
      "--dry-run",
      "settings",
      "business-units",
      "create-internal",
      "--portal-id",
      "12345",
      "--cookie",
      "csrf.app=test-csrf",
      "--data",
      '{"name":"Rentokil Initial Plc","description":"Mirror BU"}',
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
    const output = JSON.parse(String(logSpy.mock.calls[0]?.[0] ?? "{}"));
    expect(output.data).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "/api/business-units/v1/business-units?portalId=12345",
      body: {
        name: "Rentokil Initial Plc",
        description: "Mirror BU",
      },
    });
  });
});
