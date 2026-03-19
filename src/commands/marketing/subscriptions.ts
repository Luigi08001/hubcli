import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment } from "../crm/shared.js";

export function registerSubscriptions(marketing: Command, getCtx: () => CliContext): void {
  const subs = marketing.command("subscriptions").description("Communication subscription preferences");

  const types = subs.command("types").description("Subscription types");
  types
    .command("list")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/communication-preferences/v3/definitions");
      printResult(ctx, res);
    });

  subs
    .command("status")
    .argument("<email>")
    .description("Get subscription status for an email")
    .action(async (email) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const emailSegment = encodePathSegment(email, "email");
      const res = await client.request(`/communication-preferences/v3/status/email/${emailSegment}`);
      printResult(ctx, res);
    });
}
