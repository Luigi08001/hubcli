/**
 * `hscli forms` — HubSpot Marketing Forms: list/get, definitions, submissions.
 */
import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";
import { normalizeFormPayloadForV3, parseFormPayloadFormat } from "./legacy-v2.js";
import {
  loadTargetFormPropertyNames,
  parseFormPropertyPreflightMode,
  preflightLegacyFormProperties,
  shouldRunFormPropertyPreflight,
  type SkippedFormField,
} from "./property-preflight.js";

interface FormWriteOptions {
  data: string;
  sourceFormat?: string;
  propertyPreflight?: string;
  strict?: boolean;
}

async function prepareFormBody(
  ctx: CliContext,
  client: ReturnType<typeof createClient>,
  opts: FormWriteOptions,
): Promise<{ body: Record<string, unknown>; skippedFields: SkippedFormField[] }> {
  let payload = parseJsonPayload(opts.data);
  const format = parseFormPayloadFormat(opts.sourceFormat);
  const preflightMode = opts.strict ? "strict" : parseFormPropertyPreflightMode(opts.propertyPreflight);
  let skippedFields: SkippedFormField[] = [];

  if (format !== "v3" && shouldRunFormPropertyPreflight(payload, preflightMode, ctx.dryRun)) {
    const preflight = await preflightLegacyFormProperties(
      payload,
      (objectType) => loadTargetFormPropertyNames(client, objectType),
      preflightMode === "strict",
    );
    payload = preflight.payload;
    skippedFields = preflight.skippedFields;
  }

  return {
    body: normalizeFormPayloadForV3(payload, format),
    skippedFields,
  };
}

function attachSkippedFields(result: unknown, skippedFields: SkippedFormField[]): unknown {
  if (skippedFields.length === 0) return result;
  return { result, skippedFields };
}

export function registerForms(program: Command, getCtx: () => CliContext): void {
  const forms = program.command("forms").description("HubSpot Forms APIs");

  forms.command("list").option("--limit <n>", "Max records", "50").option("--after <cursor>", "Paging cursor").action(async (opts) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(opts.limit, "--limit")));
    if (opts.after) params.set("after", opts.after);
    const res = await client.request(`/marketing/v3/forms?${params.toString()}`);
    printResult(ctx, res);
  });

  forms.command("get").argument("<id>").action(async (id) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/marketing/v3/forms/${encodePathSegment(id, "id")}`);
    printResult(ctx, res);
  });

  forms.command("create")
    .requiredOption("--data <payload>", "JSON payload")
    .option("--source-format <format>", "Payload shape: auto|v2|v3", "auto")
    .option("--property-preflight <mode>", "Target property preflight for legacy forms: auto|skip|strict", "auto")
    .option("--strict", "Fail when target-property preflight finds missing form fields")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const { body, skippedFields } = await prepareFormBody(ctx, client, opts);
      const res = await maybeWrite(ctx, client, "POST", "/marketing/v3/forms", body);
      printResult(ctx, attachSkippedFields(res, skippedFields));
    });

  forms.command("update")
    .argument("<id>")
    .requiredOption("--data <payload>", "JSON payload")
    .option("--source-format <format>", "Payload shape: auto|v2|v3", "auto")
    .option("--property-preflight <mode>", "Target property preflight for legacy forms: auto|skip|strict", "auto")
    .option("--strict", "Fail when target-property preflight finds missing form fields")
    .action(async (id, opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const { body, skippedFields } = await prepareFormBody(ctx, client, opts);
      const res = await maybeWrite(ctx, client, "PATCH", `/marketing/v3/forms/${encodePathSegment(id, "id")}`, body);
      printResult(ctx, attachSkippedFields(res, skippedFields));
    });

  forms.command("translate-v2")
    .description("Convert a legacy /forms/v2/forms payload into /marketing/v3/forms shape")
    .requiredOption("--data <payload>", "Legacy forms/v2 JSON payload")
    .action(async (opts) => {
      const ctx = getCtx();
      const body = normalizeFormPayloadForV3(parseJsonPayload(opts.data), "v2");
      printResult(ctx, body);
    });
}
