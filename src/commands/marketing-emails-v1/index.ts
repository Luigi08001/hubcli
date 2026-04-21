import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerMarketingEmailsV1(program: Command, getCtx: () => CliContext): void {
  const me = program.command("marketing-emails-v1").description("Legacy marketing emails v1 API (for portals still using v1 email campaigns)");

  me.command("list").option("--limit <n>", "Max records", "50").option("--offset <n>", "Paging offset").option("--search <text>", "Search term").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "offset", o.offset);
    appendOptional(params, "search", o.search);
    const res = await client.request(`/marketing-emails/v1/emails?${params.toString()}`);
    printResult(ctx, res);
  });

  me.command("get").argument("<emailId>").action(async (emailId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(emailId, "emailId");
    const res = await client.request(`/marketing-emails/v1/emails/${seg}`);
    printResult(ctx, res);
  });

  me.command("create").requiredOption("--data <payload>", "Email payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/marketing-emails/v1/emails`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });

  me.command("update").argument("<emailId>").requiredOption("--data <payload>", "Email patch JSON").action(async (emailId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(emailId, "emailId");
    const res = await maybeWrite(ctx, client, "PUT", `/marketing-emails/v1/emails/${seg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });

  me.command("delete").argument("<emailId>").action(async (emailId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(emailId, "emailId");
    const res = await maybeWrite(ctx, client, "DELETE", `/marketing-emails/v1/emails/${seg}`);
    printResult(ctx, res);
  });

  me.command("clone").argument("<emailId>").requiredOption("--data <payload>", "Clone payload JSON (typically { name })").action(async (emailId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(emailId, "emailId");
    const res = await maybeWrite(ctx, client, "POST", `/marketing-emails/v1/emails/${seg}/clone`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });

  me.command("publish").argument("<emailId>").action(async (emailId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(emailId, "emailId");
    const res = await maybeWrite(ctx, client, "POST", `/marketing-emails/v1/emails/${seg}/publish`);
    printResult(ctx, res);
  });

  me.command("unpublish").argument("<emailId>").action(async (emailId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(emailId, "emailId");
    const res = await maybeWrite(ctx, client, "POST", `/marketing-emails/v1/emails/${seg}/unpublish`);
    printResult(ctx, res);
  });

  me.command("statistics").argument("<emailId>").action(async (emailId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(emailId, "emailId");
    const res = await client.request(`/marketing-emails/v1/emails/${seg}/statistics`);
    printResult(ctx, res);
  });
}
