/**
 * `hscli mcp` — spawn the stdio MCP server. Thin wrapper around src/mcp/server.ts.
 */
import { Command } from "commander";
import { runMcpServer } from "../mcp/server.js";

export function registerMcp(program: Command): void {
  program
    .command("mcp")
    .description("Run MCP server over stdio")
    .action(async () => {
      await runMcpServer();
    });
}
