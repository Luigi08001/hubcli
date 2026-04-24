import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";

export type GuideGoal = "portal-migration" | "setup" | "read" | "fetch" | "write" | "guardrails" | "property-preflight" | "audit-trace" | "explore";

const GOAL_ALIASES: Record<string, GuideGoal> = {
  "1": "portal-migration",
  "/migration": "portal-migration",
  migration: "portal-migration",
  "portal-migration": "portal-migration",
  "2": "setup",
  "/setup": "setup",
  setup: "setup",
  "3": "read",
  "/read": "read",
  read: "read",
  "4": "fetch",
  "/fetch": "fetch",
  fetch: "fetch",
  "/get": "fetch",
  get: "fetch",
  "5": "write",
  "/write": "write",
  write: "write",
  "6": "guardrails",
  "/guardrails": "guardrails",
  guardrails: "guardrails",
  safety: "guardrails",
  policy: "guardrails",
  properties: "property-preflight",
  "property-preflight": "property-preflight",
  "7": "property-preflight",
  audit: "audit-trace",
  trace: "audit-trace",
  "audit-trace": "audit-trace",
  "8": "audit-trace",
  explore: "explore",
  help: "explore",
  "9": "explore",
};

export function resolveGoal(raw: string | undefined): GuideGoal {
  const value = raw?.trim().toLowerCase();
  if (!value) return "portal-migration";
  return GOAL_ALIASES[value] ?? "portal-migration";
}

async function askGoal(): Promise<GuideGoal> {
  if (!input.isTTY) return "portal-migration";
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question([
      "What do you want to do with hscli?",
      "1) Prepare a portal/schema migration",
      "2) Set up auth, hublet routing, scopes, and capabilities",
      "3) Read safely from a source portal",
      "4) Fetch/get records or metadata",
      "5) Write safely to a target portal",
      "6) Configure guardrails",
      "7) Preflight property migration payloads",
      "8) Trace/audit writes",
      "9) Explore available commands",
      "Choose 1-9: ",
    ].join("\n"));
    return resolveGoal(answer);
  } finally {
    rl.close();
  }
}

export function guidePayload(goal: GuideGoal): Record<string, unknown> {
  if (goal === "setup") {
    return {
      goal,
      purpose: "Create a safe profile, confirm hublet routing, then inspect portal capabilities before any migration work.",
      nextCommands: [
        "hscli auth login --profile live --token-stdin --hublet eu1",
        "hscli auth set-mode live read-only",
        "hscli --profile live doctor hublet-check",
        "hscli --profile live doctor scopes diff --required real-mirror-read",
        "hscli --profile live doctor capabilities --refresh",
      ],
      decisions: [
        "Use read-only mode for live/source portals.",
        "Use a separate read-write profile for sandbox/target portals.",
        "Use --hublet eu1|na1|na2|ap1 when token metadata is not enough to infer routing.",
      ],
    };
  }
  if (goal === "read") {
    return {
      goal,
      purpose: "Read from a source portal without accidental writes.",
      nextCommands: [
        "hscli auth set-mode live read-only",
        "hscli --profile live crm migration export-metadata --out migration-metadata.json",
        "hscli --profile live crm activities export contacts <contactId> --out contact-activities.json",
        "hscli --profile live crm properties list contacts --format json > contacts-properties.json",
        "hscli --profile live trace start --scope read",
      ],
      guardrails: [
        "Profile read-only mode blocks POST/PATCH/PUT/DELETE even if the token has write scopes.",
        "Use separate source/target profiles instead of switching tokens in place.",
      ],
    };
  }
  if (goal === "fetch") {
    return {
      goal,
      purpose: "Fetch one record, list a small sample, or pull metadata without mutating the portal.",
      nextCommands: [
        "hscli --profile live account info",
        "hscli --profile live crm contacts get <contactId>",
        "hscli --profile live crm companies list --limit 10",
        "hscli --profile live crm properties list contacts --format json > contacts-properties.json",
        "hscli --profile live crm activities export contacts <contactId> --out contact-activities.json",
        "hscli --profile live api request --path /crm/v3/objects/contacts/<contactId>",
      ],
      guardrails: [
        "Use this for read-only inspection and spot checks.",
        "For source portals, run `hscli auth set-mode live read-only` first.",
      ],
    };
  }
  if (goal === "write") {
    return {
      goal,
      purpose: "Write to a sandbox or target portal with dry-runs, change tickets, and traceability.",
      nextCommands: [
        "hscli auth set-mode sandbox read-write",
        "hscli --profile sandbox trace start --scope write --include-bodies",
        "hscli --profile sandbox --dry-run crm properties batch-create contacts --skip-existing --data @contacts-properties.json",
        "hscli --profile sandbox --force --change-ticket CHG-123 crm properties batch-create contacts --skip-existing --data @contacts-properties.json",
        "hscli --profile sandbox trace stop",
      ],
      guardrails: [
        "Writes still require --force.",
        "Use --dry-run first, then rerun the same command with --force.",
        "Use --change-ticket when policy requires audited writes.",
      ],
    };
  }
  if (goal === "guardrails") {
    return {
      goal,
      purpose: "Turn on the safety rails before a client migration or production-adjacent run.",
      nextCommands: [
        "hscli auth set-mode live read-only",
        "hscli policy templates extract read-only --to ./policy.json",
        "export HSCLI_POLICY_FILE=./policy.json",
        "hscli trace start --scope all --include-bodies",
        "hscli --profile live doctor hublet-check",
        "hscli --profile live doctor scopes diff --required real-mirror-read",
      ],
      checks: [
        "Live/source profiles should be read-only.",
        "Target profiles can be read-write but still need --force.",
        "Trace/audit entries include request id, profile, tool name, and change ticket when provided.",
      ],
    };
  }
  if (goal === "property-preflight") {
    return {
      goal,
      nextCommands: [
        "hscli --json crm properties list contacts > contacts-properties.json",
        "hscli --dry-run crm properties batch-create contacts --skip-existing --skip-label-collisions --data @contacts-properties.json",
        "hscli --dry-run crm properties batch-create contacts --empty-enum demote --data @contacts-properties.json",
      ],
      checks: [
        "Reserved hs_* names are skipped unless --include-reserved is set.",
        "Read-only/HubSpot-defined properties are skipped unless --include-readonly is set.",
        "Enum options with blank labels/values are removed before write.",
      ],
    };
  }
  if (goal === "audit-trace") {
    return {
      goal,
      nextCommands: [
        "hscli trace start --scope write --include-bodies",
        "hscli --force --change-ticket CHG-123 crm contacts update <id> --data '{...}'",
        "hscli trace stop",
        "hscli audit by-ticket --ticket CHG-123",
      ],
      checks: [
        "Use --change-ticket when policy requires traceable writes.",
        "Trace bodies are redacted before being written.",
      ],
    };
  }
  if (goal === "explore") {
    return {
      goal,
      nextCommands: [
        "hscli doctor capabilities --refresh",
        "hscli crm describe contacts --refresh-cache",
        "hscli crm migration export-metadata --out migration-metadata.json",
        "hscli --help",
      ],
    };
  }
  return {
    goal,
    nextCommands: [
      "hscli crm migration export-metadata --out migration-metadata.json",
      "hscli crm activities export contacts <contactId> --out contact-activities.json",
      "hscli --json crm properties list contacts > contacts-properties.json",
      "hscli --dry-run crm properties batch-create contacts --skip-existing --skip-label-collisions --data @contacts-properties.json",
      "hscli crm pipelines list deals",
      "hscli crm pipelines get deals <pipelineId>",
    ],
    capturedByMigrationExport: [
      "property groups with labels/displayOrder",
      "property definitions",
      "deal/ticket pipelines with stage detail",
      "custom object schemas",
      "owners, teams, business units, currencies",
      "standard association labels",
      "recoverable record activities via crm activities export",
    ],
    replayOrder: [
      "custom schemas",
      "property groups",
      "properties",
      "pipelines and stages",
      "association labels",
      "owner/team remapping",
      "records and associations",
    ],
  };
}

export function registerGuide(program: Command, getCtx: () => CliContext): void {
  program
    .command("guide")
    .description("Guided workflows for migration, preflight, and audit tasks")
    .option("--goal <goal>", "portal-migration|property-preflight|audit-trace|explore")
    .action(async (opts) => {
      const ctx = getCtx();
      const goal = opts.goal ? resolveGoal(opts.goal) : await askGoal();
      printResult(ctx, guidePayload(goal));
    });

  registerSlashGuide(program, getCtx, "/migration", "portal-migration", "Portal/schema migration workflow");
  registerSlashGuide(program, getCtx, "/setup", "setup", "Initial profile, hublet, scope, and capability setup");
  registerSlashGuide(program, getCtx, "/read", "read", "Safe source-portal read workflow");
  registerSlashGuide(program, getCtx, "/fetch", "fetch", "Fetch records or metadata without mutating the portal");
  registerSlashGuide(program, getCtx, "/get", "fetch", "Get records or metadata without mutating the portal");
  registerSlashGuide(program, getCtx, "/write", "write", "Target-portal write workflow with dry-run and trace");
  registerSlashGuide(program, getCtx, "/guardrails", "guardrails", "Safety policy, read-only, and trace workflow");
}

function registerSlashGuide(program: Command, getCtx: () => CliContext, name: string, goal: GuideGoal, description: string): void {
  const action = () => {
    const ctx = getCtx();
    printResult(ctx, guidePayload(goal));
  };
  program.command(name).description(description).action(action);
  program.command(name.slice(1)).description(`${description} (alias for ${name})`).action(action);
}
