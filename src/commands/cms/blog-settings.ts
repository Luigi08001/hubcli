import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerBlogSettings(cms: Command, getCtx: () => CliContext): void {
  const bs = cms.command("blog-settings").description("CMS blog global settings (multi-language, defaults)");

  bs.command("get")
    .description("Get current blog settings")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await client.request(`/cms/v3/blog-settings/settings`);
      printResult(ctx, res);
    });

  bs.command("update")
    .description("Update blog settings")
    .requiredOption("--data <payload>", "Blog settings patch JSON")
    .action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `/cms/v3/blog-settings/settings`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  bs.command("revisions")
    .argument("<id>")
    .description("List revisions for a blog settings record")
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .action(async (id, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
      appendOptional(params, "after", o.after);
      const res = await client.request(`/cms/v3/blog-settings/settings/${seg}/revisions?${params.toString()}`);
      printResult(ctx, res);
    });

  const ml = bs.command("multi-language").description("Multi-language group operations on blog settings");
  ml.command("attach").requiredOption("--data <payload>", "Attach payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/cms/v3/blog-settings/settings/multi-language/attach/to/lang-group`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  ml.command("create-variation").requiredOption("--data <payload>", "Variation payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/cms/v3/blog-settings/settings/multi-language/create/language/variation`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  ml.command("detach").requiredOption("--data <payload>", "Detach payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/cms/v3/blog-settings/settings/multi-language/detach/from/lang-group`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  ml.command("set-primary").requiredOption("--data <payload>", "Set-primary payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "PUT", `/cms/v3/blog-settings/settings/multi-language/set/new/lang/primary`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  ml.command("update-languages").requiredOption("--data <payload>", "Update-languages payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/cms/v3/blog-settings/settings/multi-language/update/languages`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
}
