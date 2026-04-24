import { Command } from "commander";
import { writeFileSync } from "node:fs";
import { createClient, type HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment } from "./shared.js";

const DEFAULT_OBJECTS = ["contacts", "companies", "deals", "tickets"];
const DEFAULT_PIPELINE_OBJECTS = ["deals", "tickets"];
const DEFAULT_ASSOCIATION_PAIRS = [
  ["contacts", "companies"],
  ["companies", "contacts"],
  ["contacts", "deals"],
  ["deals", "contacts"],
  ["companies", "deals"],
  ["deals", "companies"],
  ["deals", "tickets"],
  ["tickets", "deals"],
];

type CapturedResponse = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string; status?: number } };

interface PipelineDetail {
  id: string;
  pipeline: CapturedResponse;
  stages: CapturedResponse;
}

function parseCsv(raw: string | undefined, fallback: string[]): string[] {
  const source = raw?.trim() ? raw : fallback.join(",");
  return source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePairs(raw: string | undefined): string[][] {
  const source = raw?.trim() ? raw : DEFAULT_ASSOCIATION_PAIRS.map(([from, to]) => `${from}:${to}`).join(",");
  return source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(":").map((segment) => segment.trim()))
    .filter((pair): pair is string[] => pair.length === 2 && pair.every(Boolean));
}

function serializeError(err: unknown): { code: string; message: string; status?: number } {
  if (err && typeof err === "object") {
    const record = err as { code?: unknown; message?: unknown; status?: unknown };
    return {
      code: typeof record.code === "string" ? record.code : "REQUEST_FAILED",
      message: typeof record.message === "string" ? record.message : String(err),
      ...(typeof record.status === "number" ? { status: record.status } : {}),
    };
  }
  return { code: "REQUEST_FAILED", message: String(err) };
}

async function capture(client: HubSpotClient, path: string): Promise<CapturedResponse> {
  try {
    return { ok: true, data: await client.request(path) };
  } catch (err) {
    return { ok: false, error: serializeError(err) };
  }
}

function responseResults(value: CapturedResponse): Array<Record<string, unknown>> {
  if (!value.ok || !value.data || typeof value.data !== "object" || Array.isArray(value.data)) return [];
  const results = (value.data as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  return results.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item));
}

async function collectPipelineMetadata(client: HubSpotClient, objectType: string): Promise<{
  list: CapturedResponse;
  details: PipelineDetail[];
}> {
  const objectTypeSegment = encodePathSegment(objectType, "objectType");
  const list = await capture(client, `/crm/v3/pipelines/${objectTypeSegment}`);
  const details: PipelineDetail[] = [];
  for (const pipeline of responseResults(list)) {
    if (typeof pipeline.id !== "string" || !pipeline.id.trim()) continue;
    const pipelineIdSegment = encodePathSegment(pipeline.id, "pipelineId");
    details.push({
      id: pipeline.id,
      pipeline: await capture(client, `/crm/v3/pipelines/${objectTypeSegment}/${pipelineIdSegment}`),
      stages: await capture(client, `/crm/v3/pipelines/${objectTypeSegment}/${pipelineIdSegment}/stages`),
    });
  }
  return { list, details };
}

export function registerMigration(crm: Command, getCtx: () => CliContext): void {
  const migration = crm.command("migration").description("Migration planning and metadata export helpers");

  migration
    .command("export-metadata")
    .description("Export schema/pipeline metadata needed before migrating a HubSpot portal")
    .option("--objects <csv>", "Object types for properties + property groups", DEFAULT_OBJECTS.join(","))
    .option("--pipeline-objects <csv>", "Object types for pipelines + stages", DEFAULT_PIPELINE_OBJECTS.join(","))
    .option("--no-owners", "Do not include CRM owners")
    .option("--no-teams", "Do not include settings teams")
    .option("--no-business-units", "Do not include business units")
    .option("--no-currencies", "Do not include currencies")
    .option("--no-custom-schemas", "Do not include custom object schemas")
    .option("--no-association-labels", "Do not include standard association label metadata")
    .option("--association-pairs <csv>", "Association label pairs as from:to,from:to; supports custom object type IDs")
    .option("--out <file>", "Write the manifest to a JSON file")
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const objects = parseCsv(opts.objects, DEFAULT_OBJECTS);
      const pipelineObjects = parseCsv(opts.pipelineObjects, DEFAULT_PIPELINE_OBJECTS);

      const propertyGroups: Record<string, CapturedResponse> = {};
      const properties: Record<string, CapturedResponse> = {};
      for (const objectType of objects) {
        const objectTypeSegment = encodePathSegment(objectType, "objectType");
        propertyGroups[objectType] = await capture(client, `/crm/v3/properties/${objectTypeSegment}/groups`);
        properties[objectType] = await capture(client, `/crm/v3/properties/${objectTypeSegment}`);
      }

      const pipelines: Record<string, Awaited<ReturnType<typeof collectPipelineMetadata>>> = {};
      for (const objectType of pipelineObjects) {
        pipelines[objectType] = await collectPipelineMetadata(client, objectType);
      }

      const associationLabels: Record<string, CapturedResponse> = {};
      if (opts.associationLabels) {
        for (const [from, to] of parsePairs(opts.associationPairs)) {
          associationLabels[`${from}:${to}`] = await capture(
            client,
            `/crm/v4/associations/${encodePathSegment(from, "fromObjectType")}/${encodePathSegment(to, "toObjectType")}/labels`,
          );
        }
      }

      const manifest = {
        manifestVersion: 1,
        generatedAt: new Date().toISOString(),
        profile: ctx.profile,
        intent: "portal-migration-metadata",
        requiredForReplayOrder: [
          "customSchemas",
          "propertyGroups",
          "properties",
          "pipelines",
          "associationLabels",
          "ownersAndTeamsMapping",
        ],
        notes: [
          "Property group labels/displayOrder come from the source portal response; do not derive labels from groupName.",
          "Pipeline metadata includes pipeline detail and stage detail so stage IDs, labels, displayOrder, and metadata can be mapped before record migration.",
          "Owners, teams, currencies, and business units are mapping inputs. They are exported for planning, not blindly replayed.",
        ],
        objects,
        pipelineObjects,
        propertyGroups,
        properties,
        pipelines,
        customSchemas: opts.customSchemas ? await capture(client, "/crm/v3/schemas") : undefined,
        owners: opts.owners ? await capture(client, "/crm/v3/owners/?limit=500") : undefined,
        teams: opts.teams ? await capture(client, "/settings/v3/users/teams") : undefined,
        businessUnits: opts.businessUnits ? await capture(client, "/settings/v3/business-units/?limit=100") : undefined,
        currencies: opts.currencies ? await capture(client, "/settings/v3/currencies") : undefined,
        associationLabels: opts.associationLabels ? associationLabels : undefined,
        recommendedNextCommands: [
          "hscli --dry-run crm properties batch-create contacts --skip-existing --skip-label-collisions --data @contacts-properties.json",
          "hscli --force crm properties batch-create contacts --skip-existing --skip-label-collisions --data @contacts-properties.json",
          "hscli crm pipelines list deals",
          "hscli crm pipelines get deals <pipelineId>",
        ],
      };

      if (opts.out) {
        writeFileSync(String(opts.out), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      }
      printResult(ctx, opts.out ? { written: opts.out, ...manifest } : manifest);
    });
}
