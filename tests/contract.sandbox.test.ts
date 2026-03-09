import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const enabled = process.env.HUBCLI_ENABLE_SANDBOX_CONTRACT === "1";

const maybeDescribe = enabled ? describe : describe.skip;

maybeDescribe("sandbox contract (opt-in)", () => {
  it("runs read-only smoke checks against HubSpot sandbox", async () => {
    const token = process.env.HUBCLI_SANDBOX_TOKEN;
    if (!token) {
      throw new Error("HUBCLI_SANDBOX_TOKEN is required when HUBCLI_ENABLE_SANDBOX_CONTRACT=1");
    }

    const home = mkdtempSync(join(tmpdir(), "hubcli-contract-"));
    const dir = join(home, ".hubcli");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles: { sandbox: { token } } }));
    process.env.HOME = home;
    process.env.HUBCLI_HOME = dir;

    const { run } = await import("../src/cli.js");
    await run(["node", "hubcli", "--profile", "sandbox", "--json", "crm", "contacts", "list", "--limit", "1"]);
    await run(["node", "hubcli", "--profile", "sandbox", "--json", "crm", "tickets", "list", "--limit", "1"]);
    await run(["node", "hubcli", "--profile", "sandbox", "--json", "files", "assets", "list", "--limit", "1"]);
    await run(["node", "hubcli", "--profile", "sandbox", "--json", "forms", "list", "--limit", "1"]);

    expect(true).toBe(true);
  });
});
