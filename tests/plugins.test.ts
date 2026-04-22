/**
 * Tests for the plugin system: discovery, loading, error isolation, safety gates.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function setupHomeWithToken(
  profile = "default",
  token = "test-token",
): string {
  const home = mkdtempSync(join(tmpdir(), "hscli-plugin-"));
  const dir = join(home, ".hscli");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "auth.json"), JSON.stringify({ profiles: { [profile]: { token } } }));
  process.env.HSCLI_HOME = dir;
  return home;
}

describe("plugin system", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_PLUGINS;
    delete process.env.HSCLI_PROFILE;
  });

  it("loads a plugin from HSCLI_PLUGINS and registers its command", async () => {
    setupHomeWithToken();
    const pluginDir = mkdtempSync(join(tmpdir(), "hscli-test-plugin-"));
    // Create a simple plugin
    writeFileSync(join(pluginDir, "index.mjs"), `
      export function register(program, ctx) {
        program
          .command("test-plugin-cmd")
          .description("Test plugin command")
          .action(() => {
            const cliCtx = ctx.getCtx();
            ctx.printResult(cliCtx, { pluginLoaded: true });
          });
      }
    `);

    process.env.HSCLI_PLUGINS = pluginDir + "/index.mjs";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "test-plugin-cmd"]);

    expect(logSpy).toHaveBeenCalled();
    const output = String(logSpy.mock.calls[0][0]);
    expect(output).toContain("pluginLoaded");
  });

  it("skips plugins without register() function gracefully", async () => {
    setupHomeWithToken();
    const pluginDir = mkdtempSync(join(tmpdir(), "hscli-bad-plugin-"));
    writeFileSync(join(pluginDir, "index.mjs"), `export const name = "no-register";`);

    process.env.HSCLI_PLUGINS = pluginDir + "/index.mjs";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    // Should not crash — just log a warning
    await run(["node", "hscli", "--help"]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("missing register()"))).toBe(true);
  });

  it("isolates plugin load failures — does not crash CLI", async () => {
    setupHomeWithToken();
    const pluginDir = mkdtempSync(join(tmpdir(), "hscli-crash-plugin-"));
    writeFileSync(join(pluginDir, "index.mjs"), `throw new Error("plugin init crash");`);

    process.env.HSCLI_PLUGINS = pluginDir + "/index.mjs";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    // CLI should still work despite plugin crash
    await run(["node", "hscli", "--help"]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("Failed to load"))).toBe(true);
  });

  it("plugin write operations are gated by maybeWrite", async () => {
    setupHomeWithToken();
    const pluginDir = mkdtempSync(join(tmpdir(), "hscli-write-plugin-"));
    writeFileSync(join(pluginDir, "index.mjs"), `
      export function register(program, ctx) {
        program
          .command("plugin-write")
          .action(async () => {
            const cliCtx = ctx.getCtx();
            const client = ctx.createClient(cliCtx.profile);
            try {
              const result = await ctx.maybeWrite(cliCtx, client, "POST", "/crm/v3/objects/contacts", { properties: {} });
              ctx.printResult(cliCtx, result);
            } catch (err) {
              ctx.printError(cliCtx, err);
            }
          });
      }
    `);

    process.env.HSCLI_PLUGINS = pluginDir + "/index.mjs";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    // Without --force, write should be blocked
    await run(["node", "hscli", "plugin-write"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("WRITE_CONFIRMATION_REQUIRED"))).toBe(true);
  });

  it("plugin dry-run returns preview without API call", async () => {
    setupHomeWithToken();
    const pluginDir = mkdtempSync(join(tmpdir(), "hscli-dryrun-plugin-"));
    writeFileSync(join(pluginDir, "index.mjs"), `
      export function register(program, ctx) {
        program
          .command("plugin-create")
          .action(async () => {
            const cliCtx = ctx.getCtx();
            const client = ctx.createClient(cliCtx.profile);
            const result = await ctx.maybeWrite(cliCtx, client, "POST", "/crm/v3/objects/contacts", { properties: { email: "test@example.com" } });
            ctx.printResult(cliCtx, result);
          });
      }
    `);

    process.env.HSCLI_PLUGINS = pluginDir + "/index.mjs";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--dry-run", "--json", "plugin-create"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    const output = String(logSpy.mock.calls[0][0]);
    expect(output).toContain("dryRun");
    expect(output).toContain("POST");
  });

  it("does nothing when no plugins are configured", async () => {
    setupHomeWithToken();
    // No HSCLI_PLUGINS set, no hscli-plugin packages in node_modules
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--help"]);

    // No plugin-related errors
    expect(errSpy.mock.calls.filter((c) => String(c[0]).includes("[plugin]"))).toHaveLength(0);
  });
});
