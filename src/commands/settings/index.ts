import { Command } from "commander";
import { getToken } from "../../core/auth.js";
import { HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerSettings(program: Command, getCtx: () => CliContext): void {
  const settings = program.command("settings").description("HubSpot Settings APIs");

  // Users
  const users = settings.command("users").description("User provisioning");

  users
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/settings/v3/users/?${params.toString()}`);
      printResult(ctx, res);
    });

  users.command("get").argument("<userId>").action(async (userId) => {
    const ctx = getCtx();
    const client = new HubSpotClient(getToken(ctx.profile));
    const res = await client.request(`/settings/v3/users/${encodePathSegment(userId, "userId")}`);
    printResult(ctx, res);
  });

  users
    .command("create")
    .requiredOption("--data <payload>", "User creation payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/settings/v3/users/", payload);
      printResult(ctx, res);
    });

  users
    .command("update")
    .argument("<userId>")
    .requiredOption("--data <payload>", "User update payload JSON")
    .action(async (userId, opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PUT", `/settings/v3/users/${encodePathSegment(userId, "userId")}`, payload);
      printResult(ctx, res);
    });

  users
    .command("delete")
    .argument("<userId>")
    .action(async (userId) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const res = await maybeWrite(ctx, client, "DELETE", `/settings/v3/users/${encodePathSegment(userId, "userId")}`);
      printResult(ctx, res);
    });

  // Business Units
  const businessUnits = settings.command("business-units").description("Business unit management");

  businessUnits
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/settings/v3/business-units/?${params.toString()}`);
      printResult(ctx, res);
    });

  // Currencies
  const currencies = settings.command("currencies").description("Multi-currency management");

  currencies
    .command("list")
    .action(async () => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const res = await client.request("/settings/v3/currencies");
      printResult(ctx, res);
    });
}
