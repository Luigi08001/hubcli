import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";

type GuideGoal = "portal-migration" | "property-preflight" | "audit-trace" | "explore";

const GOAL_ALIASES: Record<string, GuideGoal> = {
  "1": "portal-migration",
  migration: "portal-migration",
  "portal-migration": "portal-migration",
  properties: "property-preflight",
  "property-preflight": "property-preflight",
  "2": "property-preflight",
  audit: "audit-trace",
  trace: "audit-trace",
  "audit-trace": "audit-trace",
  "3": "audit-trace",
  explore: "explore",
  help: "explore",
  "4": "explore",
};

function resolveGoal(raw: string | undefined): GuideGoal {
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
      "2) Preflight property migration payloads",
      "3) Trace/audit writes",
      "4) Explore available commands",
      "Choose 1-4: ",
    ].join("\n"));
    return resolveGoal(answer);
  } finally {
    rl.close();
  }
}

function guidePayload(goal: GuideGoal): Record<string, unknown> {
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
}
