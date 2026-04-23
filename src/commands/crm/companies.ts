/**
 * `hscli crm companies` — CRUD + search + batch over /crm/v3/objects/companies.
 */
import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerObjectCommands } from "./shared.js";

export function registerCompanies(crm: Command, getCtx: () => CliContext): void {
  registerObjectCommands(crm, "companies", getCtx);
}
