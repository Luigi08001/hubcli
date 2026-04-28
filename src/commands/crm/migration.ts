import { Command } from "commander";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient, type HubSpotClient } from "../../core/http.js";
import { flattenIdMap, loadJsonFile, type FlatIdMap } from "../../core/id-maps.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
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

interface IdMapFieldRule {
  field: string;
  mapFile: string;
  map: FlatIdMap;
}

interface IdMapFieldStats {
  field: string;
  mapFile: string;
  recordsWithField: number;
  recordsChanged: number;
  recordsDroppedField: number;
  valuesTotal: number;
  valuesMapped: number;
  valuesUnmapped: number;
  uniqueUnmapped: number;
  unmappedSamples: Array<{ sourceId: string; count: number }>;
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

function collectRepeated(value: string, previous: string[] = []): string[] {
  previous.push(value);
  return previous;
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CliError("INVALID_FLAG", "Expected a positive integer");
  }
  return parsed;
}

function parseJsonInput(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("@")) {
    const filePath = trimmed.slice(1).trim();
    if (!filePath) throw new CliError("INVALID_JSON_FILE", "--data @file requires a file path");
    try {
      return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new CliError("INVALID_JSON", `Invalid JSON payload in ${filePath}`);
      }
      throw err;
    }
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new CliError("INVALID_JSON", "Invalid JSON payload");
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function parseIdMapFieldRule(raw: string): IdMapFieldRule {
  const eq = raw.indexOf("=");
  if (eq <= 0 || eq === raw.length - 1) {
    throw new CliError("INVALID_ID_MAP_FIELD", "--field must use propertyName=path/to/id-map.json");
  }
  const field = raw.slice(0, eq).trim();
  const mapFile = raw.slice(eq + 1).trim();
  if (!field || !mapFile) {
    throw new CliError("INVALID_ID_MAP_FIELD", "--field must use propertyName=path/to/id-map.json");
  }
  const map = flattenIdMap(loadJsonFile(mapFile));
  return { field, mapFile, map };
}

function payloadRecords(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
  }
  const record = asRecord(payload);
  if (!record) {
    throw new CliError("INVALID_PAYLOAD", "Expected a JSON object, array, or { inputs|results } payload");
  }
  for (const key of ["inputs", "results", "records"]) {
    const collection = record[key];
    if (Array.isArray(collection)) {
      return collection.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
    }
  }
  return [record];
}

function recordProperties(record: Record<string, unknown>): Record<string, unknown> {
  return asRecord(record.properties) ?? record;
}

function remapFieldValue(
  value: unknown,
  rule: IdMapFieldRule,
  delimiter: string,
  onUnmapped: "drop" | "error" | "keep",
  unmappedCounts: Map<string, number>,
): { value?: string; changed: boolean; droppedField: boolean; stats: Pick<IdMapFieldStats, "valuesTotal" | "valuesMapped" | "valuesUnmapped"> } {
  const text = value === undefined || value === null ? "" : String(value);
  const sourceValues = delimiter
    ? text.split(delimiter).map((part) => part.trim()).filter(Boolean)
    : [text.trim()].filter(Boolean);
  const mappedValues: string[] = [];
  let changed = false;
  let valuesMapped = 0;
  let valuesUnmapped = 0;

  for (const source of sourceValues) {
    const target = rule.map[source];
    if (target !== undefined) {
      mappedValues.push(target);
      valuesMapped += 1;
      if (target !== source) changed = true;
      continue;
    }
    valuesUnmapped += 1;
    unmappedCounts.set(source, (unmappedCounts.get(source) ?? 0) + 1);
    if (onUnmapped === "error") {
      throw new CliError("ID_MAP_UNMAPPED", `No target mapping for ${rule.field} source ID ${source}`);
    }
    if (onUnmapped === "keep") mappedValues.push(source);
    else changed = true;
  }

  const nextValues = Array.from(new Set(mappedValues));
  const next = delimiter ? nextValues.join(delimiter) : (nextValues[0] ?? "");
  return {
    value: next,
    changed: changed || next !== text,
    droppedField: nextValues.length === 0,
    stats: {
      valuesTotal: sourceValues.length,
      valuesMapped,
      valuesUnmapped,
    },
  };
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
  const idMap = migration.command("id-map").description("Apply and inspect migration ID maps");

  idMap
    .command("apply")
    .description("Apply one or more source→target ID maps to local JSON payload fields; no HubSpot API calls are made")
    .requiredOption("--data <payload>", "Payload JSON or @file. Supports { inputs }, { results }, arrays, or one record")
    .requiredOption("--field <property=mapFile>", "Property to remap with an ID map JSON file; repeatable", collectRepeated, [])
    .option("--delimiter <value>", "Delimiter for multi-value ID fields", ";")
    .option("--on-unmapped <mode>", "What to do with unmapped IDs: error|drop|keep", "error")
    .option("--allow-empty", "Keep a remapped field as an empty string when every source ID is dropped")
    .option("--sample-size <n>", "Number of unmapped source IDs to include per field", "20")
    .option("--out <file>", "Write the remapped payload JSON to a file")
    .option("--report-out <file>", "Write a remap report JSON to a file")
    .option("--include-payload", "Include the remapped payload in stdout even when --out is used")
    .action((opts) => {
      const ctx = getCtx();
      const onUnmapped = String(opts.onUnmapped ?? "error");
      if (!["error", "drop", "keep"].includes(onUnmapped)) {
        throw new CliError("INVALID_FLAG", "--on-unmapped must be one of: error, drop, keep");
      }
      const sampleSize = parsePositiveInteger(opts.sampleSize, 20);
      const delimiter = String(opts.delimiter ?? ";");
      const payload = parseJsonInput(String(opts.data));
      const records = payloadRecords(payload);
      const rules = (opts.field as string[]).map(parseIdMapFieldRule);
      if (rules.length === 0) {
        throw new CliError("INVALID_ID_MAP_FIELD", "At least one --field property=map.json rule is required");
      }

      const fieldReports = rules.map((rule) => {
        const unmappedCounts = new Map<string, number>();
        const stats: Omit<IdMapFieldStats, "uniqueUnmapped" | "unmappedSamples"> = {
          field: rule.field,
          mapFile: rule.mapFile,
          recordsWithField: 0,
          recordsChanged: 0,
          recordsDroppedField: 0,
          valuesTotal: 0,
          valuesMapped: 0,
          valuesUnmapped: 0,
        };

        for (const record of records) {
          const properties = recordProperties(record);
          if (!Object.prototype.hasOwnProperty.call(properties, rule.field)) continue;
          stats.recordsWithField += 1;
          const remapped = remapFieldValue(
            properties[rule.field],
            rule,
            delimiter,
            onUnmapped as "drop" | "error" | "keep",
            unmappedCounts,
          );
          stats.valuesTotal += remapped.stats.valuesTotal;
          stats.valuesMapped += remapped.stats.valuesMapped;
          stats.valuesUnmapped += remapped.stats.valuesUnmapped;
          if (remapped.changed) stats.recordsChanged += 1;
          if (remapped.droppedField && !opts.allowEmpty) {
            delete properties[rule.field];
            stats.recordsDroppedField += 1;
          } else {
            properties[rule.field] = remapped.value ?? "";
          }
        }

        const unmappedSamples = Array.from(unmappedCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, sampleSize)
          .map(([sourceId, count]) => ({ sourceId, count }));

        return {
          ...stats,
          uniqueUnmapped: unmappedCounts.size,
          unmappedSamples,
        } satisfies IdMapFieldStats;
      });

      const report = {
        generatedAt: new Date().toISOString(),
        intent: "migration-id-map-apply",
        inputRecords: records.length,
        delimiter,
        onUnmapped,
        allowEmpty: Boolean(opts.allowEmpty),
        fields: fieldReports,
        notes: [
          "This command only rewrites local JSON payloads; it never calls HubSpot APIs.",
          "Use --on-unmapped error for final migrations unless an explicit drop/keep policy has been documented.",
        ],
      };

      if (opts.out) writeFileSync(String(opts.out), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      if (opts.reportOut) writeFileSync(String(opts.reportOut), `${JSON.stringify(report, null, 2)}\n`, "utf8");

      printResult(ctx, {
        ...report,
        ...(opts.out ? { written: String(opts.out) } : { payload }),
        ...(opts.reportOut ? { reportWritten: String(opts.reportOut) } : {}),
        ...(opts.includePayload && opts.out ? { payload } : {}),
      });
    });

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
