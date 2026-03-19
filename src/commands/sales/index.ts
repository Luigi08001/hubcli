import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerSequences } from "./sequences.js";
import { registerMeetings } from "./meetings.js";
import { registerCalling } from "./calling.js";

export function registerSales(program: Command, getCtx: () => CliContext): void {
  const sales = program.command("sales").description("HubSpot Sales tools");
  registerSequences(sales, getCtx);
  registerMeetings(sales, getCtx);
  registerCalling(sales, getCtx);
}
