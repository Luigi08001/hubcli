import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerAutomation(program: Command, getCtx: () => CliContext): void {
  const automation = program.command("automation").description("HubSpot Automation APIs (v4 workflows)");

  const workflows = automation.command("workflows").description("Automation workflows (v4)");
  workflows
    .command("list")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      appendOptional(params, "after", opts.after);
      const res = await client.request(`/automation/v4/flows?${params.toString()}`);
      printResult(ctx, res);
    });

  workflows
    .command("get")
    .argument("<flowId>")
    .action(async (flowId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(flowId, "flowId");
      const res = await client.request(`/automation/v4/flows/${id}`);
      printResult(ctx, res);
    });

  // Custom Workflow Actions (app-defined code actions)
  const actions = automation.command("actions").description("Custom workflow actions (app-developer defined code blocks)");
  actions.command("list").argument("<appId>").option("--limit <n>", "Max records", "50").option("--after <cursor>", "Paging cursor").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "after", o.after);
    const res = await client.request(`/automation/v4/actions/${seg}?${params.toString()}`);
    printResult(ctx, res);
  });
  actions.command("get").argument("<appId>").argument("<definitionId>").action(async (appId, definitionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const defSeg = encodePathSegment(definitionId, "definitionId");
    const res = await client.request(`/automation/v4/actions/${appSeg}/${defSeg}`);
    printResult(ctx, res);
  });
  actions.command("create").argument("<appId>").requiredOption("--data <payload>", "Action definition JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "POST", `/automation/v4/actions/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  actions.command("update").argument("<appId>").argument("<definitionId>").requiredOption("--data <payload>", "Action patch JSON").action(async (appId, definitionId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const defSeg = encodePathSegment(definitionId, "definitionId");
    const res = await maybeWrite(ctx, client, "PATCH", `/automation/v4/actions/${appSeg}/${defSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  actions.command("delete").argument("<appId>").argument("<definitionId>").action(async (appId, definitionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const defSeg = encodePathSegment(definitionId, "definitionId");
    const res = await maybeWrite(ctx, client, "DELETE", `/automation/v4/actions/${appSeg}/${defSeg}`);
    printResult(ctx, res);
  });
  actions.command("revisions-list").argument("<appId>").argument("<definitionId>").action(async (appId, definitionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const defSeg = encodePathSegment(definitionId, "definitionId");
    const res = await client.request(`/automation/v4/actions/${appSeg}/${defSeg}/revisions`);
    printResult(ctx, res);
  });
  actions.command("revisions-get").argument("<appId>").argument("<definitionId>").argument("<revisionId>").action(async (appId, definitionId, revisionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const defSeg = encodePathSegment(definitionId, "definitionId");
    const revSeg = encodePathSegment(revisionId, "revisionId");
    const res = await client.request(`/automation/v4/actions/${appSeg}/${defSeg}/revisions/${revSeg}`);
    printResult(ctx, res);
  });
  actions.command("functions-list").argument("<appId>").argument("<definitionId>").action(async (appId, definitionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const defSeg = encodePathSegment(definitionId, "definitionId");
    const res = await client.request(`/automation/v4/actions/${appSeg}/${defSeg}/functions`);
    printResult(ctx, res);
  });
  actions.command("functions-create").argument("<appId>").argument("<definitionId>").argument("<functionType>").argument("<functionId>").requiredOption("--data <payload>", "Function payload JSON").action(async (appId, definitionId, functionType, functionId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const defSeg = encodePathSegment(definitionId, "definitionId");
    const typeSeg = encodePathSegment(functionType, "functionType");
    const fnSeg = encodePathSegment(functionId, "functionId");
    const res = await maybeWrite(ctx, client, "PUT", `/automation/v4/actions/${appSeg}/${defSeg}/functions/${typeSeg}/${fnSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  actions.command("functions-delete").argument("<appId>").argument("<definitionId>").argument("<functionType>").argument("<functionId>").action(async (appId, definitionId, functionType, functionId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const defSeg = encodePathSegment(definitionId, "definitionId");
    const typeSeg = encodePathSegment(functionType, "functionType");
    const fnSeg = encodePathSegment(functionId, "functionId");
    const res = await maybeWrite(ctx, client, "DELETE", `/automation/v4/actions/${appSeg}/${defSeg}/functions/${typeSeg}/${fnSeg}`);
    printResult(ctx, res);
  });
}
