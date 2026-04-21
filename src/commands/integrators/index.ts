import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

// /integrators/timeline/v3 — Timeline events API for app developers
// This is distinct from /crm/v3/timeline (already covered). It's the app-dev surface that
// backs the public HubSpot app timeline extension.
export function registerIntegrators(program: Command, getCtx: () => CliContext): void {
  const integ = program.command("integrators").description("HubSpot integrator/app-dev APIs (timeline event templates + integrations application timeline)");

  const tmpls = integ.command("timeline-event-templates").description("Timeline event templates for an app");
  tmpls.command("list").argument("<appId>").option("--limit <n>", "Max records", "50").option("--after <cursor>", "Paging cursor").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "after", o.after);
    const res = await client.request(`/integrators/timeline/v3/${seg}/event/templates?${params.toString()}`);
    printResult(ctx, res);
  });
  tmpls.command("get").argument("<appId>").argument("<templateId>").action(async (appId, templateId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const tmplSeg = encodePathSegment(templateId, "templateId");
    const res = await client.request(`/integrators/timeline/v3/${appSeg}/event/templates/${tmplSeg}`);
    printResult(ctx, res);
  });
  tmpls.command("create").argument("<appId>").requiredOption("--data <payload>", "Template payload JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "POST", `/integrators/timeline/v3/${seg}/event/templates`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  tmpls.command("update").argument("<appId>").argument("<templateId>").requiredOption("--data <payload>", "Template patch JSON").action(async (appId, templateId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const tmplSeg = encodePathSegment(templateId, "templateId");
    const res = await maybeWrite(ctx, client, "PUT", `/integrators/timeline/v3/${appSeg}/event/templates/${tmplSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  tmpls.command("delete").argument("<appId>").argument("<templateId>").action(async (appId, templateId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const tmplSeg = encodePathSegment(templateId, "templateId");
    const res = await maybeWrite(ctx, client, "DELETE", `/integrators/timeline/v3/${appSeg}/event/templates/${tmplSeg}`);
    printResult(ctx, res);
  });

  const tokens = tmpls.command("tokens").description("Template tokens (custom fields on timeline events)");
  tokens.command("create").argument("<appId>").argument("<templateId>").requiredOption("--data <payload>", "Token payload JSON").action(async (appId, templateId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const tmplSeg = encodePathSegment(templateId, "templateId");
    const res = await maybeWrite(ctx, client, "POST", `/integrators/timeline/v3/${appSeg}/event/templates/${tmplSeg}/tokens`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  tokens.command("update").argument("<appId>").argument("<templateId>").argument("<tokenName>").requiredOption("--data <payload>", "Token patch JSON").action(async (appId, templateId, tokenName, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const tmplSeg = encodePathSegment(templateId, "templateId");
    const tokenSeg = encodePathSegment(tokenName, "tokenName");
    const res = await maybeWrite(ctx, client, "PUT", `/integrators/timeline/v3/${appSeg}/event/templates/${tmplSeg}/tokens/${tokenSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  tokens.command("delete").argument("<appId>").argument("<templateId>").argument("<tokenName>").action(async (appId, templateId, tokenName) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const tmplSeg = encodePathSegment(templateId, "templateId");
    const tokenSeg = encodePathSegment(tokenName, "tokenName");
    const res = await maybeWrite(ctx, client, "DELETE", `/integrators/timeline/v3/${appSeg}/event/templates/${tmplSeg}/tokens/${tokenSeg}`);
    printResult(ctx, res);
  });
}
