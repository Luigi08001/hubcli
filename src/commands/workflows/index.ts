/**
 * `hscli workflows` — v4 flows + legacy v3 workflows.
 *
 * Two workflow APIs ship side-by-side on every Marketing-Hub portal:
 *
 * - **v4 `/automation/v4/flows`** (current) — returns 500 on POST
 *   with populated `actions[]` (schema undocumented; verified
 *   2026-04-23). Works for create-metadata + enrollment triggers
 *   only.
 * - **v3 `/automation/v3/workflows`** (legacy, still live) —
 *   **accepts a populated `actions[]` array with DELAY,
 *   SET_CONTACT_PROPERTY, BRANCH, EMAIL, WEBHOOK,
 *   UPDATE_LIST, TASK, TICKET, DEAL, NOTIFICATION, WEBHOOK,
 *   and more.** Workflows created via v3 are dual-backed: they
 *   surface in v4 (`migrationStatus.flowId`) and render in the
 *   modern HubSpot canvas UI with visible action nodes.
 *
 * Use `hscli workflows flows` for the v4 surface (enrollment criteria
 * + metadata) and `hscli workflows v3` for creating multi-step
 * workflows with real action nodes.
 */
import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { createClient } from "../../core/http.js";
import { printResult } from "../../core/output.js";
import { registerResource } from "../domains/shared.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerWorkflows(program: Command, getCtx: () => CliContext): void {
  const workflows = program.command("workflows").description("HubSpot Workflow Automation APIs");

  registerResource(workflows, getCtx, {
    name: "flows",
    description: "Automation flows (v4 API)",
    listPath: "/automation/v4/flows",
    itemPath: (id) => `/automation/v4/flows/${id}`,
    createPath: "/automation/v4/flows",
    updatePath: (id) => `/automation/v4/flows/${id}`,
  });

  // Enable/disable a v4 flow. Requires PUT (not PATCH — 405 on PATCH)
  // with the full flow body including `revisionId`. Rediscovered via
  // the docs re-audit after earlier probes that used PATCH.
  const flows = workflows.commands.find((c) => c.name() === "flows");
  if (flows) {
    flows
      .command("enable")
      .argument("<flowId>", "Flow ID")
      .description("Enable a flow (PUT /automation/v4/flows/{id} with isEnabled:true)")
      .action(async (flowId) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const id = encodePathSegment(flowId, "flowId");
        // Fetch current body — revisionId must match, and `type` is
        // required on the PUT.
        const current = (await client.request(
          `/automation/v4/flows/${id}`,
        )) as Record<string, unknown>;
        const put = { ...current, isEnabled: true };
        const res = await maybeWrite(ctx, client, "PUT", `/automation/v4/flows/${id}`, put);
        printResult(ctx, res);
      });
    flows
      .command("disable")
      .argument("<flowId>", "Flow ID")
      .description("Disable a flow (PUT /automation/v4/flows/{id} with isEnabled:false)")
      .action(async (flowId) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const id = encodePathSegment(flowId, "flowId");
        const current = (await client.request(
          `/automation/v4/flows/${id}`,
        )) as Record<string, unknown>;
        const put = { ...current, isEnabled: false };
        const res = await maybeWrite(ctx, client, "PUT", `/automation/v4/flows/${id}`, put);
        printResult(ctx, res);
      });
  }

  // Legacy v3 workflows — the only public API that accepts
  // populated multi-step actions on create. Contact-based only.
  const v3 = workflows.command("v3").description("Legacy v3 workflows API (accepts populated actions[] — contact-based only)");

  v3.command("list")
    .option("--limit <n>", "Max workflows (client-side cap; endpoint returns all)", "50")
    .description("List all v3 workflows")
    .action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const limit = parseNumberFlag(o.limit, "--limit");
      const res = (await client.request(`/automation/v3/workflows`)) as { data?: { workflows?: unknown[] } };
      const workflowsArr = ((res as unknown as { workflows?: unknown[] }).workflows) || (res.data?.workflows) || [];
      printResult(ctx, { total: workflowsArr.length, workflows: workflowsArr.slice(0, limit) });
    });

  v3.command("get")
    .argument("<workflowId>")
    .description("Get a v3 workflow by id (includes full actions tree)")
    .action(async (workflowId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(workflowId, "workflowId");
      const res = await client.request(`/automation/v3/workflows/${id}`);
      printResult(ctx, res);
    });

  v3.command("create")
    .requiredOption(
      "--data <payload>",
      "JSON payload. Required: name, type (DRIP_DELAY|STATIC_ANCHOR|PROPERTY_ANCHOR), actions[]. Actions support: DELAY, SET_CONTACT_PROPERTY, BRANCH, EMAIL, WEBHOOK, UPDATE_LIST, TASK, TICKET, DEAL, NOTIFICATION. See https://legacydocs.hubspot.com/docs/methods/workflows/v3/create_workflow",
    )
    .description("Create a v3 workflow with populated actions (multi-step)")
    .action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `/automation/v3/workflows`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  v3.command("delete")
    .argument("<workflowId>")
    .description("Delete a v3 workflow")
    .action(async (workflowId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(workflowId, "workflowId");
      const res = await maybeWrite(ctx, client, "DELETE", `/automation/v3/workflows/${id}`);
      printResult(ctx, res);
    });

  v3.command("enroll")
    .argument("<workflowId>")
    .argument("<email>")
    .description("Enroll a contact (by email) in a v3 workflow")
    .action(async (workflowId, email) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(workflowId, "workflowId");
      const e = encodePathSegment(email, "email");
      const res = await maybeWrite(ctx, client, "POST", `/automation/v3/workflows/${id}/enrollments/contacts/${e}`);
      printResult(ctx, res);
    });

  v3.command("unenroll")
    .argument("<workflowId>")
    .argument("<email>")
    .description("Remove a contact (by email) from a v3 workflow")
    .action(async (workflowId, email) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const id = encodePathSegment(workflowId, "workflowId");
      const e = encodePathSegment(email, "email");
      const res = await maybeWrite(ctx, client, "DELETE", `/automation/v3/workflows/${id}/enrollments/contacts/${e}`);
      printResult(ctx, res);
    });

  v3.command("enrollments")
    .argument("<email>")
    .description("Get current workflow enrollments for a contact (by email)")
    .action(async (email) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const e = encodePathSegment(email, "email");
      const res = await client.request(`/automation/v3/contacts/${e}/workflowEnrollments`);
      printResult(ctx, res);
    });
}
