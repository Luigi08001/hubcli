import { Command } from "commander";
import { getToken } from "../../core/auth.js";
import { HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, parseNumberFlag } from "./shared.js";

export function registerOwners(crm: Command, getCtx: () => CliContext): void {
  const owners = crm.command("owners").description("HubSpot owners");

  owners
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .option("--email <email>", "Filter by owner email")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      appendOptional(params, "email", opts.email);
      const res = await client.request(`/crm/v3/owners/?${params.toString()}`);
      printResult(ctx, res);
    });
}
