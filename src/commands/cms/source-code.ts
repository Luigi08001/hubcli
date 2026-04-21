import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";

export function registerSourceCode(cms: Command, getCtx: () => CliContext): void {
  const sc = cms.command("source-code").description("CMS theme/module source code via public API");

  sc.command("get")
    .description("Get source-code file content by environment + path")
    .argument("<environment>", "Environment: draft or published")
    .argument("<path>", "File path relative to project root")
    .action(async (environment, path) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const envSeg = encodePathSegment(environment, "environment");
      const pathSeg = encodePathSegment(path, "path");
      const res = await client.request(`/cms/v3/source-code/${envSeg}/content/${pathSeg}`);
      printResult(ctx, res);
    });

  sc.command("create")
    .description("Create a new source-code file at environment/path")
    .argument("<environment>", "Environment: draft or published")
    .argument("<path>", "Destination path")
    .requiredOption("--data <payload>", "File payload JSON")
    .action(async (environment, path, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const envSeg = encodePathSegment(environment, "environment");
      const pathSeg = encodePathSegment(path, "path");
      const res = await maybeWrite(ctx, client, "POST", `/cms/v3/source-code/${envSeg}/content/${pathSeg}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  sc.command("update")
    .description("Replace contents of an existing source-code file")
    .argument("<environment>", "Environment: draft or published")
    .argument("<path>", "Destination path")
    .requiredOption("--data <payload>", "File payload JSON")
    .action(async (environment, path, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const envSeg = encodePathSegment(environment, "environment");
      const pathSeg = encodePathSegment(path, "path");
      const res = await maybeWrite(ctx, client, "PUT", `/cms/v3/source-code/${envSeg}/content/${pathSeg}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  sc.command("delete")
    .description("Delete a source-code file at environment/path")
    .argument("<environment>", "Environment: draft or published")
    .argument("<path>", "Destination path")
    .action(async (environment, path) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const envSeg = encodePathSegment(environment, "environment");
      const pathSeg = encodePathSegment(path, "path");
      const res = await maybeWrite(ctx, client, "DELETE", `/cms/v3/source-code/${envSeg}/content/${pathSeg}`);
      printResult(ctx, res);
    });

  sc.command("metadata")
    .description("Get metadata for a source-code file")
    .argument("<environment>", "Environment: draft or published")
    .argument("<path>", "File path")
    .action(async (environment, path) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const envSeg = encodePathSegment(environment, "environment");
      const pathSeg = encodePathSegment(path, "path");
      const res = await client.request(`/cms/v3/source-code/${envSeg}/metadata/${pathSeg}`);
      printResult(ctx, res);
    });

  sc.command("validate")
    .description("Validate a source-code file before publishing")
    .argument("<environment>", "Environment: draft or published")
    .argument("<path>", "File path")
    .requiredOption("--data <payload>", "Validation payload JSON")
    .action(async (environment, path, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const envSeg = encodePathSegment(environment, "environment");
      const pathSeg = encodePathSegment(path, "path");
      const res = await maybeWrite(ctx, client, "POST", `/cms/v3/source-code/${envSeg}/validate/${pathSeg}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  sc.command("extract")
    .description("Kick off an async extract of source-code as a zip")
    .requiredOption("--data <payload>", "Extract payload JSON")
    .action(async (o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const res = await maybeWrite(ctx, client, "POST", `/cms/v3/source-code/extract/async`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  sc.command("extract-status")
    .description("Poll status for an async extract task")
    .argument("<taskId>")
    .action(async (taskId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(taskId, "taskId");
      const res = await client.request(`/cms/v3/source-code/extract/async/tasks/${seg}/status`);
      printResult(ctx, res);
    });
}
