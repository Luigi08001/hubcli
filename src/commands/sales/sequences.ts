import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerSequences(sales: Command, getCtx: () => CliContext): void {
  const sequences = sales.command("sequences").description("HubSpot Sequences");

  sequences
    .command("list")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .option("--user-id <id>", "Owner/user ID (required by HubSpot API)")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      // Sequences API requires userId — auto-detect from owners if not provided
      let userId = opts.userId;
      if (!userId) {
        try {
          const owners = await client.request("/crm/v3/owners?limit=1") as { results?: Array<{ userId?: number }> };
          userId = owners.results?.[0]?.userId?.toString();
        } catch { /* fallback: omit userId */ }
      }
      if (userId) params.set("userId", userId);
      const res = await client.request(`/automation/v4/sequences?${params.toString()}`);
      printResult(ctx, res);
    });

  sequences.command("get").argument("<sequenceId>").action(async (sequenceId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const sequenceIdSegment = encodePathSegment(sequenceId, "sequenceId");
    const res = await client.request(`/automation/v4/sequences/${sequenceIdSegment}`);
    printResult(ctx, res);
  });

  sequences
    .command("enrollments")
    .argument("<sequenceId>")
    .option("--limit <n>", "Max records", "100")
    .option("--after <cursor>", "Paging cursor")
    .action(async (sequenceId, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const sequenceIdSegment = encodePathSegment(sequenceId, "sequenceId");
      const params = new URLSearchParams();
      params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
      if (opts.after) params.set("after", opts.after);
      const res = await client.request(`/automation/v4/sequences/${sequenceIdSegment}/enrollments?${params.toString()}`);
      printResult(ctx, res);
    });

  sequences
    .command("enroll")
    .description("Enroll a contact in a sequence (requires --data with sequenceId, senderEmail, contactId)")
    .requiredOption("--data <payload>", "Enrollment payload JSON: { sequenceId, senderEmail, contactId, startTime?, overrideDailyLimit? }")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const payload = parseJsonPayload(opts.data);
      const res = await maybeWrite(ctx, client, "POST", "/automation/v4/sequences/enrollments", payload);
      printResult(ctx, res);
    });

  sequences
    .command("unenroll")
    .description("Cancel/unenroll a contact from an active sequence enrollment")
    .argument("<enrollmentId>")
    .action(async (enrollmentId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(enrollmentId, "enrollmentId");
      const res = await maybeWrite(ctx, client, "POST", `/automation/v4/sequences/enrollments/${seg}/cancel`);
      printResult(ctx, res);
    });
}
