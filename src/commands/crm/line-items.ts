import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerObjectCommands } from "./shared.js";

export function registerLineItems(crm: Command, getCtx: () => CliContext): void {
  registerObjectCommands(crm, "line_items", getCtx);
}
