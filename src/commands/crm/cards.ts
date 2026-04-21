import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "./shared.js";

export function registerCards(crm: Command, getCtx: () => CliContext): void {
  const cards = crm.command("cards").description("CRM UI Extension cards (app-defined record sidebar cards)");

  cards
    .command("list")
    .description("List all cards defined by an app")
    .argument("<appId>")
    .action(async (appId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const res = await client.request(`/crm/v3/extensions/cards/${appSeg}`);
      printResult(ctx, res);
    });

  cards
    .command("get")
    .description("Get a card definition by card id")
    .argument("<appId>")
    .argument("<cardId>")
    .action(async (appId, cardId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const cardSeg = encodePathSegment(cardId, "cardId");
      const res = await client.request(`/crm/v3/extensions/cards/${appSeg}/${cardSeg}`);
      printResult(ctx, res);
    });

  cards
    .command("create")
    .description("Create a card definition for an app")
    .argument("<appId>")
    .requiredOption("--data <payload>", "Card definition JSON (title, fetch, actions, objectTypes, ...)")
    .action(async (appId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", `/crm/v3/extensions/cards/${appSeg}`, payload);
      printResult(ctx, res);
    });

  cards
    .command("update")
    .description("Update a card definition")
    .argument("<appId>")
    .argument("<cardId>")
    .requiredOption("--data <payload>", "Card patch payload JSON")
    .action(async (appId, cardId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const cardSeg = encodePathSegment(cardId, "cardId");
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/extensions/cards/${appSeg}/${cardSeg}`, payload);
      printResult(ctx, res);
    });

  cards
    .command("delete")
    .description("Delete a card definition")
    .argument("<appId>")
    .argument("<cardId>")
    .action(async (appId, cardId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const cardSeg = encodePathSegment(cardId, "cardId");
      const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/extensions/cards/${appSeg}/${cardSeg}`);
      printResult(ctx, res);
    });
}
