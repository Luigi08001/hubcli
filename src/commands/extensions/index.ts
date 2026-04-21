import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";

export function registerExtensions(program: Command, getCtx: () => CliContext): void {
  const ext = program.command("extensions").description("HubSpot Extensions APIs (calling, videoconferencing, accounting app-dev surfaces)");

  // Calling Extensions SDK settings — covers /crm/v3/extensions/calling/{appId}/*
  const calling = ext.command("calling").description("Calling Extensions SDK — register a calling integration");
  calling.command("settings-get").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await client.request(`/crm/v3/extensions/calling/${seg}/settings`);
    printResult(ctx, res);
  });
  calling.command("settings-create").argument("<appId>").requiredOption("--data <payload>", "Calling settings JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/extensions/calling/${seg}/settings`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  calling.command("settings-update").argument("<appId>").requiredOption("--data <payload>", "Calling settings patch JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/extensions/calling/${seg}/settings`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  calling.command("settings-delete").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/extensions/calling/${seg}/settings`);
    printResult(ctx, res);
  });
  calling.command("recording-settings-get").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await client.request(`/crm/v3/extensions/calling/${seg}/settings/recording`);
    printResult(ctx, res);
  });
  calling.command("recording-settings-update").argument("<appId>").requiredOption("--data <payload>", "Recording settings JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/extensions/calling/${seg}/settings/recording`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });

  // Video Conferencing Extension
  const video = ext.command("videoconferencing").description("Video conferencing extension (Zoom/Meet/Teams)");
  video.command("settings-get").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await client.request(`/crm/v3/extensions/videoconferencing/settings/${seg}`);
    printResult(ctx, res);
  });
  video.command("settings-update").argument("<appId>").requiredOption("--data <payload>", "Settings JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "PUT", `/crm/v3/extensions/videoconferencing/settings/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  video.command("settings-delete").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "DELETE", `/crm/v3/extensions/videoconferencing/settings/${seg}`);
    printResult(ctx, res);
  });

  // Accounting Extension
  const acc = ext.command("accounting").description("Accounting extension (QBO/Xero partner integrations)");
  acc.command("invoice-pdf").argument("<invoiceId>").action(async (invoiceId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(invoiceId, "invoiceId");
    const res = await client.request(`/crm/v3/extensions/accounting/invoice/${seg}/pdf`);
    printResult(ctx, res);
  });
  acc.command("search-invoices").requiredOption("--data <payload>", "Search payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/crm/v3/extensions/accounting/invoice/search`, { method: "POST", body: parseJsonPayload(o.data) });
    printResult(ctx, res);
  });
  acc.command("invoice-update").argument("<invoiceId>").requiredOption("--data <payload>", "Invoice patch JSON").action(async (invoiceId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(invoiceId, "invoiceId");
    const res = await maybeWrite(ctx, client, "PATCH", `/crm/v3/extensions/accounting/invoice/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  acc.command("sync-customer").requiredOption("--data <payload>", "Customer payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/crm/v3/extensions/accounting/customer/search`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });

  // Raw escape hatch under /crm/v3/extensions — for app devs using endpoints we don't yet expose
  ext.command("raw")
    .description("Raw call under /crm/v3/extensions/* (for future HubSpot extension APIs)")
    .argument("<method>", "GET|POST|PUT|PATCH|DELETE")
    .argument("<subPath>", "Path starting after /crm/v3/extensions/")
    .option("--data <payload>", "Optional body JSON")
    .action(async (method, subPath, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const clean = subPath.replace(/^\/+/, "");
      const m = method.toUpperCase();
      const body = o.data ? parseJsonPayload(o.data) : undefined;
      const path = `/crm/v3/extensions/${clean}`;
      const res = m === "GET" ? await client.request(path) : await maybeWrite(ctx, client, m as "POST" | "PUT" | "PATCH" | "DELETE", path, body);
      printResult(ctx, res);
    });
}
