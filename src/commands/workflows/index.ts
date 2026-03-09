import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerResource } from "../domains/shared.js";

export function registerWorkflows(program: Command, getCtx: () => CliContext): void {
  const workflows = program.command("workflows").description("HubSpot Workflow Automation APIs");

  registerResource(workflows, getCtx, {
    name: "flows",
    description: "Automation flows",
    listPath: "/automation/v4/flows",
    itemPath: (id) => `/automation/v4/flows/${id}`,
    createPath: "/automation/v4/flows",
    updatePath: (id) => `/automation/v4/flows/${id}`,
  });
}
