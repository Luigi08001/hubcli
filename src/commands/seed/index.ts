import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { CALLS, COMPANIES, CONTACTS, DEALS, GOALS, LEADS, MEETINGS, NOTES, PRODUCTS, TASKS, TICKETS } from "./data.js";
import { buildSeedContext } from "./context.js";
import { seedCrmCore } from "./crm-core.js";
import { seedEngagements } from "./engagements.js";
import { seedCommerce } from "./commerce.js";
import { seedMarketing } from "./marketing.js";
import { seedCms } from "./cms.js";
import { seedInfra } from "./infra.js";
import type { SeedResult } from "./types.js";

/**
 * Run every seed module in a stable order. Order matters: CRM core must run
 * first (contacts/companies/deals/tickets provide IDs that commerce, marketing,
 * and infra modules reference). Each module mutates the shared result object.
 */
async function runSeed(cliCtx: CliContext): Promise<void> {
  const ctx = await buildSeedContext(cliCtx);
  const result: SeedResult = { created: [], associations: [], skipped: [], tips: [] };

  await seedCrmCore(ctx, result);
  await seedEngagements(ctx, result);
  await seedCommerce(ctx, result);
  await seedMarketing(ctx, result);
  await seedCms(ctx, result);
  await seedInfra(ctx, result);

  // --- Summary tips ---
  if (!ctx.ownerId) result.tips.push("No owner detected. Records created without an owner. Run 'hscli crm owners list' to verify.");
  if (!ctx.dealPipeline) result.tips.push("No deal pipeline found. Deals created without pipeline/stage.");
  if (!ctx.ticketPipeline) result.tips.push("No ticket pipeline found. Tickets created without pipeline/stage.");
  if (ctx.customSchemas.length === 0) result.tips.push("No custom objects found. Create one in HubSpot Settings → Data Management → Custom Objects.");

  const failedAssociations = result.associations.filter(a => a.status === "no_default_association");
  if (failedAssociations.length > 0) {
    result.tips.push(`${failedAssociations.length} association(s) skipped (no default association type configured). Configure them in HubSpot Settings → Data Management → Associations.`);
  }

  printResult(cliCtx, {
    summary: {
      created: result.created.length,
      skipped: result.skipped.length,
      associations: result.associations.filter(a => a.status === "ok").length,
      associationsFailed: failedAssociations.length,
    },
    created: result.created,
    skipped: result.skipped.length > 0 ? result.skipped : undefined,
    tips: result.tips.length > 0 ? result.tips : undefined,
  });
}

export function registerSeed(program: Command, getCtx: () => CliContext): void {
  program
    .command("seed")
    .description("Seed a test portal with comprehensive sample data: contacts, companies, deals, tickets, engagements (notes/tasks/calls/meetings), products + line-items, quotes, leads, goals, a marketing form, a static list, a custom property group + property, a URL redirect, a timeline event template + event, and (best-effort) a webhook subscription + HubDB table + custom-object records. Associations wired up automatically.")
    .action(async () => {
      const ctx = getCtx();
      if (ctx.dryRun) {
        printResult(ctx, {
          dryRun: true,
          message: "Dry-run mode: no records will be created. Remove --dry-run and use --force to execute.",
          wouldCreate: {
            contacts: CONTACTS.length,
            companies: COMPANIES.length,
            deals: DEALS.length,
            tickets: TICKETS.length,
            notes: NOTES.length,
            tasks: TASKS.length,
            calls: CALLS.length,
            meetings: MEETINGS.length,
            products: PRODUCTS.length,
            line_items: "1 per deal+product pair",
            quotes: "1 (best-effort)",
            leads: LEADS.length,
            goals: GOALS.length,
            form: 1,
            list: 1,
            property_group: 1,
            custom_property: 1,
            url_redirect: 1,
            timeline_event_template: "1 (best-effort)",
            timeline_event: "1 (best-effort)",
            webhook_subscription: "1 (best-effort, usually fails w/o app)",
            hubdb_table: "1 (best-effort, CMS Hub only)",
            custom_object_records: "1 per schema detected",
            pipelines: "1 deals + 1 tickets",
            custom_object_schema: "1 (only if none exist)",
          },
        });
        return;
      }
      if (!ctx.force) {
        throw new CliError(
          "WRITE_CONFIRMATION_REQUIRED",
          "seed creates records in your portal. Preview with --dry-run, then run with --force to execute.",
        );
      }
      await runSeed(ctx);
    });
}
