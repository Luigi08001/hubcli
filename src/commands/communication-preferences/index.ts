import { Command } from "commander";
import { getToken } from "../../core/auth.js";
import { HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";

export function registerCommunicationPreferences(program: Command, getCtx: () => CliContext): void {
  const commPrefs = program.command("communication-preferences").description("HubSpot communication preferences / subscription management");

  commPrefs
    .command("subscription-types")
    .description("List subscription types")
    .action(async () => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const res = await client.request("/communication-preferences/v3/definitions");
      printResult(ctx, res);
    });

  commPrefs
    .command("status")
    .argument("<email>")
    .description("Get subscription status for an email address")
    .action(async (email) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const res = await client.request(`/communication-preferences/v3/status/email/${encodePathSegment(email, "email")}`);
      printResult(ctx, res);
    });

  commPrefs
    .command("subscribe")
    .requiredOption("--data <payload>", "Subscribe payload JSON (emailAddress, subscriptionId)")
    .description("Subscribe a contact")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication-preferences/v3/subscribe", payload);
      printResult(ctx, res);
    });

  commPrefs
    .command("unsubscribe")
    .requiredOption("--data <payload>", "Unsubscribe payload JSON (emailAddress, subscriptionId)")
    .description("Unsubscribe a contact")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication-preferences/v3/unsubscribe", payload);
      printResult(ctx, res);
    });
}
