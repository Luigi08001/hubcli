import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerResource } from "../domains/shared.js";
import { registerChatflows } from "./chatflows.js";
import { registerTicketPipelines } from "./pipelines.js";
import { registerKnowledgeBase } from "./knowledge-base.js";

export function registerService(program: Command, getCtx: () => CliContext): void {
  const service = program.command("service").description("HubSpot Service APIs");

  registerResource(service, getCtx, {
    name: "conversations",
    description: "Conversation threads",
    listPath: "/conversations/v3/conversations/threads",
    itemPath: (id) => `/conversations/v3/conversations/threads/${id}`,
  });

  registerResource(service, getCtx, {
    name: "feedback",
    description: "Feedback submissions",
    listPath: "/crm/v3/objects/feedback_submissions",
    itemPath: (id) => `/crm/v3/objects/feedback_submissions/${id}`,
    createPath: "/crm/v3/objects/feedback_submissions",
    updatePath: (id) => `/crm/v3/objects/feedback_submissions/${id}`,
  });

  registerChatflows(service, getCtx);
  registerTicketPipelines(service, getCtx);
  registerKnowledgeBase(service, getCtx);
}
