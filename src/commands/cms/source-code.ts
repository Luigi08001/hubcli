import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodeFilePath, encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";

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
      const pathSeg = encodeFilePath(path, "path");
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
      const pathSeg = encodeFilePath(path, "path");
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
      const pathSeg = encodeFilePath(path, "path");
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
      const pathSeg = encodeFilePath(path, "path");
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
      const pathSeg = encodeFilePath(path, "path");
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
      const pathSeg = encodeFilePath(path, "path");
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

  // HubSpot's `@hubspot` namespace is system-hidden — the folder
  // metadata endpoint returns an empty `children` array. To enumerate
  // the built-in modules we probe a known wordlist (drawn from
  // HubSpot's developer docs + the email/web modules split
  // changelog). Any module that returns a 200 for its fields.json is
  // present on this portal.
  const KNOWN_HUBSPOT_MODULES = [
    // Universal + web
    "rich_text", "text", "header", "section_header", "button", "cta",
    "divider", "horizontal_spacer", "form", "icon", "linked_image",
    "image_grid", "gallery", "image_slider_gallery", "logo", "logo_grid",
    "video", "menu", "simple_menu", "language_switcher", "social_sharing",
    "social_follow", "page_footer", "meetings", "payments", "product",
    "whatsapp_link",
    // Blog
    "blog_content", "blog_subscribe", "blog_comments", "post_filter",
    "post_listing", "rss_listing", "blog_posts",
    // System
    "search_input", "search_results", "password_prompt",
    "membership_social_logins",
    // Email-specific
    "email_header", "email_footer", "email_cta", "email_text",
    "email_section_header", "email_linked_image", "email_logo",
    "email_post_filter", "email_post_listing", "email_social_sharing",
    "email_subscriptions", "email_subscriptions_confirmation",
    "email_simple_subscription", "email_body", "raw_html_email",
    "email_can_spam", "image_email", "video_email", "one_line_of_text",
    "view_as_web_page", "whitespace", "spacer", "follow_me",
    "rss_email", "product_markdown",
    // Legacy quotes
    "quote_download", "quote_payment", "quote_signature", "line_items",
  ];

  sc.command("list-modules")
    .description("Enumerate available @hubspot/* built-in modules + their field schemas")
    .option("--environment <env>", "Environment: draft or published", "published")
    .option("--schemas", "Include full field schema for each module in output")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const envSeg = encodePathSegment(opts.environment, "environment");
      const results: Array<{
        path: string;
        available: boolean;
        fieldCount?: number;
        fields?: unknown;
      }> = [];
      for (const name of KNOWN_HUBSPOT_MODULES) {
        const modulePath = encodeFilePath(`@hubspot/${name}.module/fields.json`, "path");
        try {
          const resp = await client.request(`/cms/v3/source-code/${envSeg}/content/${modulePath}`);
          const fields = (resp as { data?: unknown; }) as unknown;
          const fieldArray = Array.isArray(fields) ? fields : [];
          results.push({
            path: `@hubspot/${name}`,
            available: true,
            fieldCount: fieldArray.length,
            ...(opts.schemas ? { fields: fieldArray } : {}),
          });
        } catch {
          results.push({ path: `@hubspot/${name}`, available: false });
        }
      }
      const available = results.filter((r) => r.available).length;
      printResult(ctx, {
        totalProbed: results.length,
        available,
        missing: results.length - available,
        modules: results,
      });
    });
}
