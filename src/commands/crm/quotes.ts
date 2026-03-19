import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerObjectCommands } from "./shared.js";

export function registerQuotes(crm: Command, getCtx: () => CliContext): void {
  registerObjectCommands(crm, "quotes", getCtx);
}
