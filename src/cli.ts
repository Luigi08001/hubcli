#!/usr/bin/env node
import { Command } from "commander";
import { randomUUID } from "node:crypto";
import { registerAuth } from "./commands/auth/index.js";
import { registerDoctor } from "./commands/doctor/index.js";
import { registerCrm } from "./commands/crm/index.js";
import { registerMcp } from "./commands/mcp.js";
import { registerApi } from "./commands/api/index.js";
import { registerMarketing } from "./commands/marketing/index.js";
import { registerFiles } from "./commands/files/index.js";
import { registerForms } from "./commands/forms/index.js";
import { registerCms } from "./commands/cms/index.js";
import { registerWorkflows } from "./commands/workflows/index.js";
import { registerService } from "./commands/service/index.js";
import { registerWebhooks } from "./commands/webhooks/index.js";
import { registerSeed } from "./commands/seed/index.js";
import { registerLists } from "./commands/lists/index.js";
import { registerSales } from "./commands/sales/index.js";
import { registerReporting } from "./commands/reporting/index.js";
import { registerExports } from "./commands/exports/index.js";
import { registerSiteSearch } from "./commands/site-search/index.js";
import { registerTimeline } from "./commands/timeline/index.js";
import { registerConversations } from "./commands/conversations/index.js";
import { registerAutomation } from "./commands/automation/index.js";
import { registerSettings } from "./commands/settings/index.js";
import { registerAccount } from "./commands/account/index.js";
import { registerCommunicationPreferences } from "./commands/communication-preferences/index.js";
import { registerEvents } from "./commands/events/index.js";
import { registerEmailEvents } from "./commands/email-events/index.js";
import { registerMediaBridge } from "./commands/media-bridge/index.js";
import { registerFeatureFlags } from "./commands/feature-flags/index.js";
import { registerMarketingEmailsV1 } from "./commands/marketing-emails-v1/index.js";
import { registerIntegrators } from "./commands/integrators/index.js";
import { registerIntegrations } from "./commands/integrations/index.js";
import { registerExtensions } from "./commands/extensions/index.js";
import {
  registerBroadcast,
  registerVisitorIdentification,
  registerSubmissions,
  registerScheduler,
  registerTax,
  registerAppinstalls,
  registerMarketingExtras,
  registerOwnersExtras,
  registerBusinessUnits,
  registerBroadcastsRoot,
  registerFormIntegrations,
} from "./commands/legacy/index.js";
import {
  registerContactsV1,
  registerCompaniesV2,
  registerDealsV1,
  registerOwnersV2,
  registerEngagementsV1,
  registerPropertiesLegacy,
  registerReportsV2,
  registerPaymentsSubscriptions,
  registerContentV2,
  registerSalesExtensions,
  registerComments,
  registerCallingV1,
  registerChannels,
} from "./commands/legacy-v1/index.js";
import { CliError, type CliContext, printError } from "./core/output.js";
import { loadPlugins } from "./core/plugins.js";
import pkg from "../package.json" with { type: "json" };

export function createProgram(): { program: Command; getCtx: () => CliContext } {
  const program = new Command();
  let ctx: CliContext = { profile: "default", json: false, dryRun: false, force: false, strictCapabilities: false, format: "table" };
  const runId = randomUUID();

  program
    .name("hubcli")
    .description("HubSpot CLI")
    .version(pkg.version)
    .option("--profile <name>", "Auth profile", "default")
    .option("--json", "JSON output")
    .option("--format <mode>", "Output format: json|table|csv|yaml")
    .option("--dry-run", "Simulate writes")
    .option("--force", "Confirm write operations")
    .option("--strict-capabilities", "Fail fast when endpoint capability status is unknown")
    .option("--policy-file <path>", "Policy file controlling write/delete permissions")
    .option("--change-ticket <id>", "Change ticket reference for guarded writes")
    .option("--telemetry-file <path>", "Append request telemetry JSON lines to a local file")
    .hook("preAction", (cmd) => {
      const opts = cmd.optsWithGlobals();
      const telemetryFile = opts.telemetryFile ? String(opts.telemetryFile).trim() : undefined;
      ctx = {
        profile: opts.profile ?? "default",
        json: Boolean(opts.json),
        format: resolveOutputFormat(opts.format, Boolean(opts.json)),
        dryRun: Boolean(opts.dryRun),
        force: Boolean(opts.force),
        strictCapabilities: Boolean(opts.strictCapabilities),
        policyFile: opts.policyFile ? String(opts.policyFile).trim() : undefined,
        changeTicket: opts.changeTicket ? String(opts.changeTicket).trim() : undefined,
        runId,
        telemetryFile,
      };
      process.env.HUBCLI_PROFILE = ctx.profile;
      process.env.HUBCLI_STRICT_CAPABILITIES = ctx.strictCapabilities ? "1" : "0";
      process.env.HUBCLI_REQUEST_ID = runId;
      if (telemetryFile) process.env.HUBCLI_TELEMETRY_FILE = telemetryFile;
    });

  registerAuth(program, () => ctx);
  registerDoctor(program, () => ctx);
  registerCrm(program, () => ctx);
  registerMarketing(program, () => ctx);
  registerForms(program, () => ctx);
  registerFiles(program, () => ctx);
  registerCms(program, () => ctx);
  registerWorkflows(program, () => ctx);
  registerService(program, () => ctx);
  registerWebhooks(program, () => ctx);
  registerApi(program, () => ctx);
  registerSeed(program, () => ctx);
  registerLists(program, () => ctx);
  registerSales(program, () => ctx);
  registerReporting(program, () => ctx);
  registerExports(program, () => ctx);
  registerSiteSearch(program, () => ctx);
  registerTimeline(program, () => ctx);
  registerConversations(program, () => ctx);
  registerAutomation(program, () => ctx);
  registerSettings(program, () => ctx);
  registerAccount(program, () => ctx);
  registerCommunicationPreferences(program, () => ctx);
  registerEvents(program, () => ctx);
  registerEmailEvents(program, () => ctx);
  registerMediaBridge(program, () => ctx);
  registerFeatureFlags(program, () => ctx);
  registerMarketingEmailsV1(program, () => ctx);
  registerIntegrators(program, () => ctx);
  registerIntegrations(program, () => ctx);
  registerExtensions(program, () => ctx);
  registerBroadcast(program, () => ctx);
  registerVisitorIdentification(program, () => ctx);
  registerSubmissions(program, () => ctx);
  registerScheduler(program, () => ctx);
  registerTax(program, () => ctx);
  registerAppinstalls(program, () => ctx);
  registerMarketingExtras(program, () => ctx);
  registerOwnersExtras(program, () => ctx);
  registerContactsV1(program, () => ctx);
  registerCompaniesV2(program, () => ctx);
  registerDealsV1(program, () => ctx);
  registerOwnersV2(program, () => ctx);
  registerEngagementsV1(program, () => ctx);
  registerPropertiesLegacy(program, () => ctx);
  registerReportsV2(program, () => ctx);
  registerPaymentsSubscriptions(program, () => ctx);
  registerContentV2(program, () => ctx);
  registerSalesExtensions(program, () => ctx);
  registerComments(program, () => ctx);
  registerCallingV1(program, () => ctx);
  registerChannels(program, () => ctx);
  registerBusinessUnits(program, () => ctx);
  registerBroadcastsRoot(program, () => ctx);
  registerFormIntegrations(program, () => ctx);
  registerMcp(program);

  program.configureOutput({
    outputError: (str, write) => {
      const msg = str.trim();
      printError(ctx, new CliError("CLI_PARSE_ERROR", msg));
      write("");
    },
  });

  return { program, getCtx: () => ctx };
}

export async function run(argv = process.argv): Promise<void> {
  const { program, getCtx } = createProgram();
  await loadPlugins(program, getCtx);
  try {
    await program.parseAsync(argv);
  } catch (err) {
    const opts = program.opts();
    let format: "json" | "table" | "csv" | "yaml";
    try {
      format = resolveOutputFormat(opts.format, Boolean(opts.json));
    } catch {
      format = opts.json ? "json" : "table";
    }
    const ctx: CliContext = {
      profile: opts.profile ?? "default",
      json: Boolean(opts.json),
      format,
      dryRun: Boolean(opts.dryRun),
      force: Boolean(opts.force),
      strictCapabilities: Boolean(opts.strictCapabilities),
      policyFile: opts.policyFile ? String(opts.policyFile).trim() : undefined,
      changeTicket: opts.changeTicket ? String(opts.changeTicket).trim() : undefined,
      runId: process.env.HUBCLI_REQUEST_ID,
      telemetryFile: opts.telemetryFile ? String(opts.telemetryFile).trim() : undefined,
    };
    printError(ctx, err);
    process.exitCode = 1;
  }
}

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void run();
}

function resolveOutputFormat(raw: unknown, jsonFlag: boolean): "json" | "table" | "csv" | "yaml" {
  const fallback = "table";
  const value = (raw === undefined || raw === null) ? fallback : String(raw).trim().toLowerCase();
  const allowed = new Set(["json", "table", "csv", "yaml"]);
  if (!allowed.has(value)) {
    throw new CliError("INVALID_FORMAT", "format must be one of: json, table, csv, yaml");
  }
  if (jsonFlag && value !== "json" && raw !== undefined && raw !== null) {
    throw new CliError("INVALID_FORMAT", "--json cannot be combined with --format != json");
  }
  return jsonFlag ? "json" : (value as "json" | "table" | "csv" | "yaml");
}
