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

  // V4 batch endpoints (latest API, for portals using the new contact-centric preferences model)
  const v4 = commPrefs.command("v4").description("Communication Preferences v4 (contact-centric, batch-capable)");
  v4.command("status-batch-read")
    .description("Batch-read subscription statuses for up to 100 contacts")
    .requiredOption("--data <payload>", "Batch input JSON: { inputs: [{ subscriberIdString, channel, subscriptionId }, ...] }")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await client.request("/communication/preferences/v4/statuses/batch-read", { method: "POST", body: payload });
      printResult(ctx, res);
    });
  v4.command("status-update-batch")
    .description("Batch-update subscription statuses")
    .requiredOption("--data <payload>", "Batch update payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication/preferences/v4/statuses/batch-update", payload);
      printResult(ctx, res);
    });
  v4.command("subscribe-batch")
    .description("Batch-subscribe")
    .requiredOption("--data <payload>", "Batch subscribe payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication/preferences/v4/subscribe-batch", payload);
      printResult(ctx, res);
    });
  v4.command("unsubscribe-batch")
    .description("Batch-unsubscribe")
    .requiredOption("--data <payload>", "Batch unsubscribe payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/communication/preferences/v4/unsubscribe-batch", payload);
      printResult(ctx, res);
    });
  v4.command("subscriptions-list")
    .description("List subscription definitions (v4)")
    .action(async () => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const res = await client.request("/communication/preferences/v4/subscriptions");
      printResult(ctx, res);
    });
  v4.command("channels-list")
    .description("List supported channels (email, sms, whatsapp, etc.)")
    .action(async () => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const res = await client.request("/communication/preferences/v4/channels");
      printResult(ctx, res);
    });
}
