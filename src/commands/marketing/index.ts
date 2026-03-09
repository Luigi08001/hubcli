import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerResource } from "../domains/shared.js";

export function registerMarketing(program: Command, getCtx: () => CliContext): void {
  const marketing = program.command("marketing").description("HubSpot Marketing APIs");

  registerResource(marketing, getCtx, {
    name: "emails",
    description: "Marketing emails",
    listPath: "/marketing/v3/emails",
    itemPath: (id) => `/marketing/v3/emails/${id}`,
    createPath: "/marketing/v3/emails",
    updatePath: (id) => `/marketing/v3/emails/${id}`,
  });

  registerResource(marketing, getCtx, {
    name: "campaigns",
    description: "Marketing campaigns",
    listPath: "/marketing/v3/campaigns",
    itemPath: (id) => `/marketing/v3/campaigns/${id}`,
    createPath: "/marketing/v3/campaigns",
    updatePath: (id) => `/marketing/v3/campaigns/${id}`,
  });
}
