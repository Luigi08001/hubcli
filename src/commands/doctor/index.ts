import { Command } from "commander";
import { getToken } from "../../core/auth.js";
import { probeCapabilities } from "../../core/capabilities.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { parseNumberFlag } from "../crm/shared.js";

export function registerDoctor(program: Command, getCtx: () => CliContext): void {
  const doctor = program.command("doctor").description("Diagnostics and capability checks");

  doctor
    .command("capabilities")
    .description("Probe endpoint capabilities for the active portal/profile and update local cache")
    .option("--refresh", "Force reprobe even when cache is still valid")
    .option("--ttl-hours <n>", "Capability cache TTL in hours", "24")
    .action(async (opts) => {
      const ctx = getCtx();
      const profile = ctx.profile;
      const token = getToken(profile);
      const ttlHours = parseNumberFlag(String(opts.ttlHours), "--ttl-hours");
      const result = await probeCapabilities({
        profile,
        token,
        refresh: Boolean(opts.refresh),
        ttlMs: ttlHours * 3_600_000,
      });
      printResult(ctx, result);
    });
}
