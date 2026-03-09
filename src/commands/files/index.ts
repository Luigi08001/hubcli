import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerResource } from "../domains/shared.js";

export function registerFiles(program: Command, getCtx: () => CliContext): void {
  const files = program.command("files").description("HubSpot Files APIs");

  registerResource(files, getCtx, {
    name: "assets",
    description: "File assets",
    listPath: "/files/v3/files",
    itemPath: (id) => `/files/v3/files/${id}`,
    updatePath: (id) => `/files/v3/files/${id}`,
    deletePath: (id) => `/files/v3/files/${id}`,
  });
}
