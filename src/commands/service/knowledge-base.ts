import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";

export function registerKnowledgeBase(service: Command, getCtx: () => CliContext): void {
  const kb = service.command("kb").description("Knowledge base (best-effort, API may not be publicly available)");

  kb.command("status")
    .description("Check knowledge base availability")
    .action(async () => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      try {
        const res = await client.request("/cms/v3/blogs/posts?contentGroupId=kb&limit=1");
        printResult(ctx, res);
      } catch (err) {
        printResult(ctx, { status: "unavailable", message: "Knowledge base API is not available or not configured", error: err instanceof Error ? err.message : String(err) });
      }
    });
}
