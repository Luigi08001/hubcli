/**
 * `hscli crm engagements` — notes, calls, tasks, emails, meetings (each with the full CRUD + batch surface).
 */
import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { ENGAGEMENT_OBJECT_TYPES, registerObjectCommands } from "./shared.js";

export function registerEngagements(crm: Command, getCtx: () => CliContext): void {
  const engagements = crm.command("engagements").description("Engagement objects: notes, calls, tasks, emails, meetings");
  for (const objectType of ENGAGEMENT_OBJECT_TYPES) {
    registerObjectCommands(engagements, objectType, getCtx);
  }
}
