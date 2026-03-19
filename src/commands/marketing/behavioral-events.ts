import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";

export function registerBehavioralEvents(marketing: Command, getCtx: () => CliContext): void {
  const events = marketing.command("behavioral-events").description("Custom behavioral events");

  events
    .command("definitions")
    .description("List event definitions")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request("/events/v3/event-definitions");
      printResult(ctx, res);
    });

  events
    .command("send")
    .description("Send a custom behavioral event")
    .requiredOption("--data <payload>", "Event payload JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/events/v3/send", payload);
      printResult(ctx, res);
    });

  events
    .command("completions")
    .description("List event completions for a contact")
    .argument("<objectId>")
    .action(async (objectId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objectIdSegment = encodePathSegment(objectId, "objectId");
      const res = await client.request(`/events/v3/events?objectType=contact&objectId=${objectIdSegment}`);
      printResult(ctx, res);
    });
}
