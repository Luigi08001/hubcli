import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";

export function registerIntegrations(program: Command, getCtx: () => CliContext): void {
  const integ = program.command("integrations").description("HubSpot Integrations API (partner app introspection)");

  integ.command("me")
    .description("Get info about the currently authenticated app/integration (partner-tier)")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request(`/integrations/v1/me`);
      printResult(ctx, res);
    });

  // /integrations/v1/application/{id}/timeline/event — app-side timeline event creation
  const timeline = integ.command("timeline").description("Integrations application timeline events (app-side event emission)");
  timeline.command("create")
    .description("Create a single timeline event from the integration application")
    .argument("<appId>")
    .requiredOption("--data <payload>", "Timeline event payload JSON")
    .action(async (appId, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(appId, "appId");
      const res = await maybeWrite(ctx, client, "POST", `/integrations/v1/application/${seg}/timeline/event`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  timeline.command("batch-create")
    .description("Create multiple timeline events in a single call")
    .argument("<appId>")
    .requiredOption("--data <payload>", "Batch payload JSON: { eventWrappers: [...] }")
    .action(async (appId, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(appId, "appId");
      const res = await maybeWrite(ctx, client, "POST", `/integrations/v1/application/${seg}/timeline/event/batch`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  timeline.command("update")
    .description("Update a previously-created timeline event")
    .argument("<appId>")
    .argument("<eventId>")
    .requiredOption("--data <payload>", "Event patch JSON")
    .action(async (appId, eventId, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const eventSeg = encodePathSegment(eventId, "eventId");
      const res = await maybeWrite(ctx, client, "PUT", `/integrations/v1/application/${appSeg}/timeline/event/${eventSeg}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  timeline.command("delete")
    .description("Delete a timeline event emitted by the integration")
    .argument("<appId>")
    .argument("<eventId>")
    .action(async (appId, eventId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const eventSeg = encodePathSegment(eventId, "eventId");
      const res = await maybeWrite(ctx, client, "DELETE", `/integrations/v1/application/${appSeg}/timeline/event/${eventSeg}`);
      printResult(ctx, res);
    });
}
