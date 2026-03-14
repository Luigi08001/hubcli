import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";

export function registerWebhooks(program: Command, getCtx: () => CliContext): void {
  const webhooks = program.command("webhooks").description("HubSpot webhooks subscriptions");

  webhooks
    .command("list")
    .requiredOption("--app-id <id>", "HubSpot app id")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appIdSegment = encodePathSegment(String(opts.appId), "appId");
      const res = await client.request(`/webhooks/v3/${appIdSegment}/subscriptions`);
      printResult(ctx, res);
    });

  webhooks
    .command("subscribe")
    .requiredOption("--app-id <id>", "HubSpot app id")
    .requiredOption("--data <payload>", "Webhook subscription payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appIdSegment = encodePathSegment(String(opts.appId), "appId");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", `/webhooks/v3/${appIdSegment}/subscriptions`, payload);
      printResult(ctx, res);
    });

  webhooks
    .command("delete")
    .requiredOption("--app-id <id>", "HubSpot app id")
    .requiredOption("--subscription-id <id>", "Webhook subscription id")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appIdSegment = encodePathSegment(String(opts.appId), "appId");
      const subscriptionIdSegment = encodePathSegment(String(opts.subscriptionId), "subscriptionId");
      const res = await maybeWrite(ctx, client, "DELETE", `/webhooks/v3/${appIdSegment}/subscriptions/${subscriptionIdSegment}`);
      printResult(ctx, res);
    });
}
