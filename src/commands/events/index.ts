/**
 * `hscli events` — emit + fetch Events API entries (CRM behavioral events + analytics event stream).
 */
import { Command } from "commander";
import { getToken } from "../../core/auth.js";
import { HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerEvents(program: Command, getCtx: () => CliContext): void {
  const events = program.command("events").description("HubSpot Events APIs");

  events
    .command("send")
    .requiredOption("--data <payload>", "Event payload JSON")
    .description("Send a custom behavioral event")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/events/v3/send", payload);
      printResult(ctx, res);
    });

  events
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .option("--object-type <type>", "Object type filter")
    .option("--object-id <id>", "Object ID filter")
    .description("List custom behavioral events")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      if (opts.objectType) params.set("objectType", opts.objectType);
      if (opts.objectId) params.set("objectId", opts.objectId);
      const res = await client.request(`/events/v3/events?${params.toString()}`);
      printResult(ctx, res);
    });

  const definitions = events.command("definitions").description("Event definitions");

  definitions
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/events/v3/event-definitions?${params.toString()}`);
      printResult(ctx, res);
    });

  definitions.command("get").argument("<eventName>").action(async (eventName) => {
    const ctx = getCtx();
    const client = new HubSpotClient(getToken(ctx.profile));
    const res = await client.request(`/events/v3/event-definitions/${encodePathSegment(eventName, "eventName")}`);
    printResult(ctx, res);
  });

  definitions
    .command("create")
    .requiredOption("--data <payload>", "Event definition JSON")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/events/v3/event-definitions", payload);
      printResult(ctx, res);
    });

  definitions
    .command("delete")
    .argument("<eventName>")
    .action(async (eventName) => {
      const ctx = getCtx();
      const client = new HubSpotClient(getToken(ctx.profile));
      const res = await maybeWrite(ctx, client, "DELETE", `/events/v3/event-definitions/${encodePathSegment(eventName, "eventName")}`);
      printResult(ctx, res);
    });
}
