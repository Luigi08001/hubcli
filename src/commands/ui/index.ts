import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { detectHublet, getApiBaseUrl, getProfile, hasProfile } from "../../core/auth.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { guidePayload, resolveGoal, type GuideGoal } from "../guide/index.js";

type UiChoice = "setup" | "migration" | "read" | "fetch" | "write" | "guardrails" | "scopes" | "hublet" | "quit";

const CHOICE_TO_GOAL: Partial<Record<UiChoice, GuideGoal>> = {
  setup: "setup",
  migration: "portal-migration",
  read: "read",
  fetch: "fetch",
  write: "write",
  guardrails: "guardrails",
};

const CHOICE_ALIASES: Record<string, UiChoice> = {
  "1": "setup",
  setup: "setup",
  "2": "migration",
  migration: "migration",
  migrate: "migration",
  "3": "read",
  read: "read",
  "4": "fetch",
  fetch: "fetch",
  get: "fetch",
  "5": "write",
  write: "write",
  "6": "guardrails",
  guardrails: "guardrails",
  safety: "guardrails",
  "7": "scopes",
  scopes: "scopes",
  scope: "scopes",
  "8": "hublet",
  hublet: "hublet",
  routing: "hublet",
  q: "quit",
  quit: "quit",
  exit: "quit",
};

interface ProfileSummary {
  profile: string;
  authenticated: boolean;
  portalId: string | null;
  hublet: string;
  apiBaseUrl: string;
  uiDomain: string | null;
  mode: string;
}

export function registerUi(program: Command, getCtx: () => CliContext): void {
  const register = (name: string, description: string) => {
    program
      .command(name)
      .description(description)
      .option("--goal <goal>", "setup|portal-migration|read|fetch|write|guardrails|property-preflight|audit-trace|explore")
      .option("--no-interactive", "Render the terminal home without prompting")
      .action(async (opts) => {
        const ctx = getCtx();
        const summary = summarizeProfile(ctx.profile);
        const goal = opts.goal ? resolveGoal(opts.goal) : undefined;
        const selectedWorkflow = goal ? guidePayload(goal) : undefined;

        if (ctx.json) {
          printResult(ctx, {
            profile: summary,
            workflow: selectedWorkflow ?? null,
            choices: terminalChoices(),
          });
          return;
        }

        output.write(renderHome(summary, selectedWorkflow));
        if (goal || opts.interactive === false || !input.isTTY) return;

        const choice = await askChoice();
        if (choice === "quit") return;
        output.write(renderChoice(choice));
      });
  };

  register("ui", "Interactive terminal home for hscli operator workflows");
  register("home", "Terminal home for hscli operator workflows (alias for ui)");
}

function summarizeProfile(profile: string): ProfileSummary {
  try {
    if (hasProfile(profile)) {
      const data = getProfile(profile);
      const hublet = detectHublet(data);
      return {
        profile,
        authenticated: true,
        portalId: data.portalId ?? null,
        hublet: data.hublet ?? hublet ?? "na1",
        apiBaseUrl: data.apiDomain ? `https://${data.apiDomain}` : getApiBaseUrl(profile),
        uiDomain: data.uiDomain ?? (hublet ? `app-${hublet}.hubspot.com` : "app.hubspot.com"),
        mode: data.mode ?? "unset",
      };
    }
  } catch {
    // Fall through to the unauthenticated view. The detailed auth error
    // will surface when the user runs a real command.
  }

  return {
    profile,
    authenticated: false,
    portalId: null,
    hublet: "unknown",
    apiBaseUrl: "https://api.hubapi.com",
    uiDomain: null,
    mode: "not configured",
  };
}

async function askChoice(): Promise<UiChoice> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(dim("Select 1-8, or q to quit: "));
    return CHOICE_ALIASES[answer.trim().toLowerCase()] ?? "quit";
  } finally {
    rl.close();
  }
}

function renderChoice(choice: UiChoice): string {
  const goal = CHOICE_TO_GOAL[choice];
  if (goal) return renderWorkflow(guidePayload(goal));
  if (choice === "scopes") {
    return renderPanel("Scope Check", [
      "hscli doctor scopes diff --required real-mirror-read",
      "hscli doctor scopes presets",
      "hscli doctor scopes explain sales-email-read",
    ]);
  }
  if (choice === "hublet") {
    return renderPanel("Hublet Routing", [
      "hscli doctor hublet-check",
      "hscli auth set-hublet live eu1",
      "hscli --hublet eu1 --profile live account info",
    ]);
  }
  return "";
}

function renderHome(summary: ProfileSummary, workflow?: Record<string, unknown>): string {
  const lines = [
    "",
    accent("hscli"),
    dim("agentic HubSpot CLI + MCP server"),
    "",
    renderStatus(summary),
    "",
    renderPanel("Operator Workflows", terminalChoices()),
    workflow ? renderWorkflow(workflow) : "",
  ].filter(Boolean);
  return `${lines.join("\n")}\n`;
}

function renderStatus(summary: ProfileSummary): string {
  const rows = [
    ["Profile", summary.profile],
    ["Auth", summary.authenticated ? "ok" : "missing"],
    ["Mode", summary.mode],
    ["Hublet", summary.hublet],
    ["API", summary.apiBaseUrl],
    ["Portal", summary.portalId ?? "-"],
  ];
  return renderPanel("Current Context", rows.map(([label, value]) => `${label.padEnd(8)} ${value}`));
}

function terminalChoices(): string[] {
  return [
    "1  /setup       auth, hublet routing, scopes, capabilities",
    "2  /migration   portal/schema migration sequence",
    "3  /read        source-portal read workflow",
    "4  /fetch      get records or metadata without mutation",
    "5  /write       target-portal write workflow",
    "6  /guardrails  read-only, policy, trace, scope checks",
    "7  scopes       compare token scopes to real-mirror-read",
    "8  hublet       verify or pin EU/AP/NA routing",
  ];
}

function renderWorkflow(workflow: Record<string, unknown>): string {
  const goal = String(workflow.goal ?? "workflow");
  const commands = Array.isArray(workflow.nextCommands)
    ? workflow.nextCommands.map(String)
    : [];
  const purpose = typeof workflow.purpose === "string" ? [workflow.purpose] : [];
  return renderPanel(`Workflow: ${goal}`, [...purpose, ...commands]);
}

function renderPanel(title: string, rows: string[]): string {
  const width = Math.max(title.length + 4, ...rows.map((row) => row.length + 4), 44);
  const border = `+${"-".repeat(width - 2)}+`;
  const titlePadding = " ".repeat(Math.max(0, width - visibleLength(title) - 4));
  return [
    border,
    `| ${accent(title)}${titlePadding} |`,
    border,
    ...rows.map((row) => `| ${row.padEnd(width - 4)} |`),
    border,
  ].join("\n");
}

function accent(value: string): string {
  return color(value, "38;5;209");
}

function dim(value: string): string {
  return color(value, "2");
}

function color(value: string, code: string): string {
  if (!output.isTTY || process.env.NO_COLOR) return value;
  return `\u001b[${code}m${value}\u001b[0m`;
}

function visibleLength(value: string): number {
  const escape = String.fromCharCode(27);
  return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, "g"), "").length;
}
