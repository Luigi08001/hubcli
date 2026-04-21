import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerObjectCommands } from "./shared.js";

export function registerCommunications(crm: Command, getCtx: () => CliContext): void {
  registerObjectCommands(crm, "communications", getCtx);
}
