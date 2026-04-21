import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerObjectCommands } from "./shared.js";

export function registerOrders(crm: Command, getCtx: () => CliContext): void {
  registerObjectCommands(crm, "orders", getCtx);
}
