import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerSequences } from "./sequences.js";

export function registerSales(program: Command, getCtx: () => CliContext): void {
  const sales = program.command("sales").description("HubSpot Sales tools");
  registerSequences(sales, getCtx);
}
