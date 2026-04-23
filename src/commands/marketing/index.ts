import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerResource } from "../domains/shared.js";
import { encodePathSegment, maybeWrite } from "../crm/shared.js";
import { getToken } from "../../core/auth.js";
import { createClient, HubSpotClient } from "../../core/http.js";
import { printResult } from "../../core/output.js";
import { CliError } from "../../core/output.js";
import { registerAds } from "./ads.js";
import { registerSocial } from "./social.js";
import { registerSeo } from "./seo.js";
import { registerLandingPages } from "./landing-pages.js";
import { registerTransactional } from "./transactional.js";
import { registerSubscriptions } from "./subscriptions.js";
import { registerMarketingEvents } from "./events.js";
import { registerBehavioralEvents } from "./behavioral-events.js";

export function registerMarketing(program: Command, getCtx: () => CliContext): void {
  const marketing = program.command("marketing").description("HubSpot Marketing APIs");

  registerResource(marketing, getCtx, {
    name: "emails",
    description: "Marketing emails",
    listPath: "/marketing/v3/emails",
    itemPath: (id) => `/marketing/v3/emails/${id}`,
    createPath: "/marketing/v3/emails",
    updatePath: (id) => `/marketing/v3/emails/${id}`,
  });

  // Per-email engagement statistics (opens, clicks, bounces, unsubscribes)
  const emails = marketing.commands.find((c) => c.name() === "emails");
  if (emails) {
    emails
      .command("stats")
      .argument("<emailId>", "Marketing email ID")
      .description("Per-email engagement metrics (opens, clicks, bounces, unsubscribes)")
      .action(async (emailId) => {
        const ctx = getCtx();
        const client = new HubSpotClient(getToken(ctx.profile));
        const res = await client.request(
          `/marketing/v3/emails/${encodePathSegment(emailId, "emailId")}/statistics`,
        );
        printResult(ctx, res);
      });

    // Publish a marketing email (transition AUTOMATED_DRAFT → PUBLISHED).
    // Verified live endpoint: `POST /marketing/v3/emails/{id}/publish`
    // returns a validation error on malformed emails (confirming the
    // endpoint exists). For emails that pass HubSpot's validation
    // (subscription type set, required fields filled, template valid)
    // the call transitions state to PUBLISHED.
    emails
      .command("publish")
      .argument("<emailId>", "Marketing email ID")
      .description("Publish an AUTOMATED_DRAFT email (transitions state to PUBLISHED/AUTOMATED)")
      .action(async (emailId) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const id = encodePathSegment(emailId, "emailId");
        const res = await maybeWrite(
          ctx,
          client,
          "POST",
          `/marketing/v3/emails/${id}/publish`,
          {},
        );
        printResult(ctx, res);
      });

    // Clone a marketing email — v3 endpoint rediscovered via a
    // docs re-audit (the id goes in the request body, not the path).
    emails
      .command("clone")
      .argument("<emailId>", "Source email ID to clone")
      .option("--name <name>", "Name for the cloned email", "Clone")
      .option("--language <lang>", "Target language code (e.g. 'en', 'fr')")
      .description("Clone an existing marketing email (POST /marketing/v3/emails/clone)")
      .action(async (emailId, opts) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const body: Record<string, unknown> = {
          id: String(emailId).trim(),
          cloneName: String(opts.name).trim(),
        };
        if (opts.language) body.language = String(opts.language).trim();
        const res = await maybeWrite(ctx, client, "POST", `/marketing/v3/emails/clone`, body);
        printResult(ctx, res);
      });

    // Create an A/B variant of an existing marketing email.
    // Endpoint: POST /marketing/v3/emails/ab-test/create-variation
    // (ids in body, NOT in path — rediscovered via docs re-audit).
    emails
      .command("ab-variant")
      .requiredOption("--content-id <id>", "Source email ID (contentId)")
      .requiredOption("--name <name>", "Variation name (e.g. 'Variant B')")
      .description("Create an A/B variant of a marketing email")
      .action(async (opts) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const body = {
          contentId: String(opts.contentId).trim(),
          variationName: String(opts.name).trim(),
        };
        const res = await maybeWrite(
          ctx, client, "POST",
          `/marketing/v3/emails/ab-test/create-variation`,
          body,
        );
        printResult(ctx, res);
      });

    // Upload an image for use inside an email body. Wraps
    // `POST /files/v3/files/import-from-url/async` + status polling.
    // Returns the final HubFS CDN URL once the async task completes,
    // so the caller can slot it straight into an <img src="..."> inside
    // a rich_text module (the only image surface that renders in
    // HubSpot's email canvas).
    emails
      .command("upload-image")
      .requiredOption("--url <url>", "Source image URL to import into HubSpot files")
      .option("--folder <folderPath>", "Destination folder path in HubSpot Files", "/Images")
      .option("--filename <name>", "Target filename (defaults to source URL basename)")
      .option("--access <visibility>", "PUBLIC_NOT_INDEXABLE | PUBLIC_INDEXABLE | PRIVATE", "PUBLIC_NOT_INDEXABLE")
      .option("--timeout-ms <ms>", "Polling timeout in ms", "30000")
      .description("Import an image into HubSpot Files + return its HubFS URL (ready to embed)")
      .action(async (opts) => {
        const ctx = getCtx();
        const client = createClient(ctx.profile);
        const sourceUrl = String(opts.url).trim();
        if (!/^https?:\/\//.test(sourceUrl)) {
          throw new CliError("INVALID_URL", "--url must be a full http(s) URL");
        }
        const filename =
          opts.filename?.trim() || sourceUrl.split("/").pop() || "uploaded-image";
        const timeoutMs = Math.max(2000, Number.parseInt(String(opts.timeoutMs ?? "30000"), 10) || 30000);

        // Step 1 — kick off async import
        const kickoff = (await maybeWrite(
          ctx,
          client,
          "POST",
          "/files/v3/files/import-from-url/async",
          {
            url: sourceUrl,
            fileName: filename,
            folderPath: String(opts.folder).trim(),
            access: String(opts.access).trim(),
            duplicateValidationStrategy: "NONE",
            duplicateValidationScope: "ENTIRE_PORTAL",
          },
        )) as { id?: string };

        if (ctx.dryRun) {
          printResult(ctx, kickoff);
          return;
        }
        const taskId = kickoff?.id;
        if (!taskId) {
          throw new CliError("UPLOAD_FAILED", "Import task did not return an id");
        }

        // Step 2 — poll status
        const deadline = Date.now() + timeoutMs;
        let last: {
          status?: string;
          result?: { url?: string; defaultHostingUrl?: string; id?: string; name?: string };
        } = {};
        while (Date.now() < deadline) {
          const poll = (await client.request(
            `/files/v3/files/import-from-url/async/tasks/${encodePathSegment(taskId, "taskId")}/status`,
          )) as typeof last;
          last = poll;
          if (poll.status === "COMPLETE") break;
          if (poll.status === "FAILED" || poll.status === "CANCELED") {
            throw new CliError("UPLOAD_FAILED", `Import task ${poll.status}`);
          }
          await new Promise((r) => setTimeout(r, 1000));
        }

        if (last.status !== "COMPLETE") {
          throw new CliError(
            "UPLOAD_TIMEOUT",
            `Import still ${last.status ?? "pending"} after ${timeoutMs}ms`,
          );
        }

        printResult(ctx, {
          taskId,
          fileId: last.result?.id,
          fileName: last.result?.name,
          url: last.result?.url ?? last.result?.defaultHostingUrl,
          status: last.status,
        });
      });
  }

  registerResource(marketing, getCtx, {
    name: "campaigns",
    description: "Marketing campaigns",
    listPath: "/marketing/v3/campaigns",
    itemPath: (id) => `/marketing/v3/campaigns/${id}`,
    createPath: "/marketing/v3/campaigns",
    updatePath: (id) => `/marketing/v3/campaigns/${id}`,
  });

  registerAds(marketing, getCtx);
  registerSocial(marketing, getCtx);
  registerSeo(marketing, getCtx);
  registerLandingPages(marketing, getCtx);
  registerTransactional(marketing, getCtx);
  registerSubscriptions(marketing, getCtx);
  registerMarketingEvents(marketing, getCtx);
  registerBehavioralEvents(marketing, getCtx);
}
