import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export interface ContentTypeOptions {
  drafts?: boolean;
  revisions?: boolean;
  abTest?: boolean;
  multiLanguage?: boolean;
  clone?: boolean;
  schedule?: boolean;
  pushLive?: boolean;
  batch?: boolean;
}

// CMS content types (pages, posts, authors, tags) share a common set of operations.
// This helper registers all of them for a given base path.
export function registerCmsContentCommands(
  parent: Command,
  subName: string,
  description: string,
  basePath: string,
  getCtx: () => CliContext,
  opts: ContentTypeOptions = {},
): Command {
  const cmd = parent.command(subName).description(description);

  cmd
    .command("list")
    .description(`List ${subName}`)
    .option("--limit <n>", "Max records", "50")
    .option("--after <cursor>", "Paging cursor")
    .option("--archived", "Include archived items")
    .action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
      appendOptional(params, "after", o.after);
      if (o.archived) params.set("archived", "true");
      const res = await client.request(`${basePath}?${params.toString()}`);
      printResult(ctx, res);
    });

  cmd
    .command("get")
    .argument("<id>")
    .description(`Get a ${subName} by id`)
    .option("--archived", "Include archived version")
    .action(async (id, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const params = new URLSearchParams();
      if (o.archived) params.set("archived", "true");
      const qs = params.toString();
      const res = await client.request(`${basePath}/${seg}${qs ? `?${qs}` : ""}`);
      printResult(ctx, res);
    });

  cmd
    .command("create")
    .description(`Create a ${subName}`)
    .requiredOption("--data <payload>", "Resource payload JSON")
    .action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", basePath, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  cmd
    .command("update")
    .argument("<id>")
    .description(`Update a ${subName}`)
    .requiredOption("--data <payload>", "Partial JSON patch")
    .action(async (id, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const res = await maybeWrite(ctx, client, "PATCH", `${basePath}/${seg}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  cmd
    .command("delete")
    .argument("<id>")
    .description(`Archive (soft-delete) a ${subName}`)
    .action(async (id) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const res = await maybeWrite(ctx, client, "DELETE", `${basePath}/${seg}`);
      printResult(ctx, res);
    });

  if (opts.batch !== false) {
    const batch = cmd.command("batch").description("Batch operations");
    batch.command("read")
      .requiredOption("--data <payload>", "Batch read input JSON")
      .action(async (o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const res = await client.request(`${basePath}/batch-read`, { method: "POST", body: parseJsonPayload(o.data) });
        printResult(ctx, res);
      });
    batch.command("create")
      .requiredOption("--data <payload>", "Batch create input JSON")
      .action(async (o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const res = await maybeWrite(ctx, client, "POST", `${basePath}/batch-create`, parseJsonPayload(o.data));
        printResult(ctx, res);
      });
    batch.command("update")
      .requiredOption("--data <payload>", "Batch update input JSON")
      .action(async (o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const res = await maybeWrite(ctx, client, "POST", `${basePath}/batch-update`, parseJsonPayload(o.data));
        printResult(ctx, res);
      });
    batch.command("archive")
      .requiredOption("--data <payload>", "Batch archive input JSON")
      .action(async (o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const res = await maybeWrite(ctx, client, "POST", `${basePath}/batch-archive`, parseJsonPayload(o.data));
        printResult(ctx, res);
      });
  }

  if (opts.clone) {
    cmd
      .command("clone")
      .description(`Clone a ${subName}`)
      .requiredOption("--data <payload>", "Clone payload JSON: { id, cloneName? }")
      .action(async (o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const res = await maybeWrite(ctx, client, "POST", `${basePath}/clone`, parseJsonPayload(o.data));
        printResult(ctx, res);
      });
  }

  if (opts.schedule) {
    cmd
      .command("schedule")
      .description(`Schedule a ${subName} for publication`)
      .requiredOption("--data <payload>", "Schedule payload JSON: { id, publishDate }")
      .action(async (o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const res = await maybeWrite(ctx, client, "POST", `${basePath}/schedule`, parseJsonPayload(o.data));
        printResult(ctx, res);
      });
  }

  if (opts.drafts) {
    const draft = cmd.command("draft").description("Draft operations");
    draft.command("get").argument("<id>").action(async (id) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const res = await client.request(`${basePath}/${seg}/draft`);
      printResult(ctx, res);
    });
    draft.command("update").argument("<id>").requiredOption("--data <payload>", "Draft patch JSON").action(async (id, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const res = await maybeWrite(ctx, client, "PATCH", `${basePath}/${seg}/draft`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
    if (opts.pushLive !== false) {
      draft.command("push-live").argument("<id>").action(async (id) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const seg = encodePathSegment(id, "id");
        const res = await maybeWrite(ctx, client, "POST", `${basePath}/${seg}/draft/push-live`);
        printResult(ctx, res);
      });
    }
    draft.command("reset").argument("<id>").action(async (id) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/${seg}/draft/reset`);
      printResult(ctx, res);
    });
  }

  if (opts.revisions) {
    const rev = cmd.command("revisions").description("Revisions for a content item");
    rev.command("list").argument("<id>")
      .option("--limit <n>", "Max records", "50")
      .option("--after <cursor>", "Paging cursor")
      .action(async (id, o) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const seg = encodePathSegment(id, "id");
        const params = new URLSearchParams();
        params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
        appendOptional(params, "after", o.after);
        const res = await client.request(`${basePath}/${seg}/revisions?${params.toString()}`);
        printResult(ctx, res);
      });
    rev.command("get").argument("<id>").argument("<revisionId>").action(async (id, revisionId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const revSeg = encodePathSegment(revisionId, "revisionId");
      const res = await client.request(`${basePath}/${seg}/revisions/${revSeg}`);
      printResult(ctx, res);
    });
    rev.command("restore").argument("<id>").argument("<revisionId>").action(async (id, revisionId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const revSeg = encodePathSegment(revisionId, "revisionId");
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/${seg}/revisions/${revSeg}/restore`);
      printResult(ctx, res);
    });
    rev.command("restore-to-draft").argument("<id>").argument("<revisionId>").action(async (id, revisionId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(id, "id");
      const revSeg = encodePathSegment(revisionId, "revisionId");
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/${seg}/revisions/${revSeg}/restore/to/draft`);
      printResult(ctx, res);
    });
  }

  if (opts.abTest) {
    const ab = cmd.command("ab-test").description("A/B test operations");
    ab.command("create-variation").requiredOption("--data <payload>", "Variation payload JSON").action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/ab-test/create/variation`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
    ab.command("end").requiredOption("--data <payload>", "End payload JSON").action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/ab-test/end`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
    ab.command("rerun").requiredOption("--data <payload>", "Rerun payload JSON").action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/ab-test/rerun`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
  }

  if (opts.multiLanguage) {
    const ml = cmd.command("multi-language").description("Multi-language group operations");
    ml.command("attach").requiredOption("--data <payload>", "Attach payload JSON").action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/multi-language/attach/to/lang-group`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
    ml.command("create-variation").requiredOption("--data <payload>", "Variation payload JSON").action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/multi-language/create/language/variation`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
    ml.command("detach").requiredOption("--data <payload>", "Detach payload JSON").action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/multi-language/detach/from/lang-group`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
    ml.command("set-primary").requiredOption("--data <payload>", "Set-primary payload JSON").action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "PUT", `${basePath}/multi-language/set/new/lang/primary`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
    ml.command("update-languages").requiredOption("--data <payload>", "Update-languages payload JSON").action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `${basePath}/multi-language/update/languages`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });
  }

  return cmd;
}
