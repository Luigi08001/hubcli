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
import { CliError, type CliContext, printError } from "./core/output.js";
import pkg from "../package.json" with { type: "json" };

export function createProgram(): Command {
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
  registerMcp(program);

  program.configureOutput({
    outputError: (str, write) => {
      const msg = str.trim();
      printError(ctx, new CliError("CLI_PARSE_ERROR", msg));
      write("");
    },
  });

  return program;
}

export async function run(argv = process.argv): Promise<void> {
  const program = createProgram();
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

if (import.meta.url === `file://${process.argv[1]}`) {
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
