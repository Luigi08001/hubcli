import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerObjectCommands } from "./shared.js";

export function registerProducts(crm: Command, getCtx: () => CliContext): void {
  registerObjectCommands(crm, "products", getCtx);
}
