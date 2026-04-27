import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CliError } from "./output.js";

export type FlatIdMap = Record<string, string>;

export interface PipelineIdMap {
  target_pipelineId?: string;
  stageMap: FlatIdMap;
}

export interface MigrationIdMaps {
  subscriptionTypes: FlatIdMap;
  businessUnits: FlatIdMap;
  emails: FlatIdMap;
  lists: FlatIdMap;
  campaigns: FlatIdMap;
  workflows: FlatIdMap;
  users: FlatIdMap;
  owners: FlatIdMap;
  sequences: FlatIdMap;
  customObjects: FlatIdMap;
  associations: FlatIdMap;
  pipelines: Record<string, PipelineIdMap>;
}

export function loadJsonFile(path: string): unknown {
  if (!existsSync(path)) {
    throw new CliError("ID_MAP_NOT_FOUND", `ID map file not found: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new CliError("ID_MAP_INVALID_JSON", `Invalid ID map JSON: ${path}`);
  }
}

export function loadFlatIdMapFile(path: string): FlatIdMap {
  return flattenIdMap(loadJsonFile(path));
}

export function loadOptionalFlatIdMapFile(path: string): FlatIdMap {
  if (!existsSync(path)) return {};
  return loadFlatIdMapFile(path);
}

export function flattenIdMap(input: unknown): FlatIdMap {
  const out: FlatIdMap = {};
  const root = asRecord(input);
  if (!root) return out;

  const hasExplicitCollection = root.mapping !== undefined || root.mappings !== undefined || root.records !== undefined;
  const candidates = hasExplicitCollection
    ? [root.mapping, root.mappings, root.records]
    : [root];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) addArrayMapping(out, item);
    } else if (candidate && typeof candidate === "object") {
      for (const [source, target] of Object.entries(candidate as Record<string, unknown>)) {
        const resolved = resolveTargetId(target);
        if (resolved !== undefined) out[String(source)] = resolved;
      }
    }
  }
  return out;
}

export function loadMigrationIdMaps(dir: string): MigrationIdMaps {
  return {
    subscriptionTypes: loadOptionalFlatIdMapFile(join(dir, "subscription-types.json")),
    businessUnits: loadOptionalFlatIdMapFile(join(dir, "business-units.json")),
    emails: loadOptionalFlatIdMapFile(join(dir, "marketing-emails.json")),
    lists: loadOptionalFlatIdMapFile(join(dir, "lists.json")),
    campaigns: loadOptionalFlatIdMapFile(join(dir, "marketing-campaigns.json")),
    workflows: loadOptionalFlatIdMapFile(join(dir, "workflows.json")),
    users: loadOptionalFlatIdMapFile(join(dir, "users.json")),
    owners: loadOptionalFlatIdMapFile(join(dir, "owners.json")),
    sequences: loadOptionalFlatIdMapFile(join(dir, "sequences.json")),
    customObjects: loadCustomObjectIdMap(join(dir, "custom-objects.json")),
    associations: loadAssociationIdMap(join(dir, "associations.json")),
    pipelines: loadPipelineIdMap(join(dir, "pipelines.json")),
  };
}

export function findPipelineStageTarget(pipelines: Record<string, PipelineIdMap>, sourceStageId: unknown): string | undefined {
  const source = stringifyId(sourceStageId);
  if (!source) return undefined;
  for (const pipeline of Object.values(pipelines)) {
    const target = pipeline.stageMap[source];
    if (target !== undefined) return target;
  }
  return undefined;
}

export function isStandardObjectTypeId(value: unknown): boolean {
  const text = stringifyId(value);
  return Boolean(text && /^0-\d+$/.test(text));
}

export function stringifyId(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function addArrayMapping(out: FlatIdMap, item: unknown): void {
  const record = asRecord(item);
  if (!record) return;
  const source = stringifyId(
    record.source_id
      ?? record.sourceId
      ?? record.src_id
      ?? record.src
      ?? record.source_objectTypeId
      ?? record.src_pipelineId
      ?? record.source,
  );
  const target = resolveTargetId(record);
  if (source && target) out[source] = target;
}

function resolveTargetId(value: unknown): string | undefined {
  const primitive = stringifyId(value);
  if (primitive) return primitive;
  const record = asRecord(value);
  if (!record) return undefined;
  const arrayTarget = Array.isArray(record.target_typeIds) ? record.target_typeIds[0] : undefined;
  return stringifyId(
    record.target_id
      ?? record.targetId
      ?? record.target
      ?? record.target_objectTypeId
      ?? record.target_pipelineId
      ?? record.target_typeId
      ?? arrayTarget
      ?? record.tgt,
  );
}

function loadCustomObjectIdMap(path: string): FlatIdMap {
  if (!existsSync(path)) return {};
  const json = loadJsonFile(path);
  const root = asRecord(json);
  if (!root) return {};
  const out = flattenIdMap(json);
  const mapping = root.mapping;
  if (Array.isArray(mapping)) {
    for (const entry of mapping) {
      const record = asRecord(entry);
      const source = stringifyId(record?.source_objectTypeId);
      const target = stringifyId(record?.target_objectTypeId);
      if (source && target) out[source] = target;
    }
  }
  return out;
}

function loadAssociationIdMap(path: string): FlatIdMap {
  if (!existsSync(path)) return {};
  const json = loadJsonFile(path);
  const out = flattenIdMap(json);
  const root = asRecord(json);
  for (const collection of [root?.mapping, root?.mappings]) {
    if (!Array.isArray(collection)) continue;
    for (const entry of collection) {
      const record = asRecord(entry);
      const source = stringifyId(record?.src_id ?? record?.source_id);
      const target = stringifyId(record?.target_typeId)
        ?? (Array.isArray(record?.target_typeIds) ? stringifyId(record?.target_typeIds[0]) : undefined);
      if (source && target) out[source] = target;
    }
  }
  return out;
}

function loadPipelineIdMap(path: string): Record<string, PipelineIdMap> {
  if (!existsSync(path)) return {};
  const json = loadJsonFile(path);
  const root = asRecord(json);
  if (!root) return {};
  const out: Record<string, PipelineIdMap> = {};
  for (const key of ["deals", "tickets"]) {
    const entries = root[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const record = asRecord(entry);
      const source = stringifyId(record?.src_pipelineId ?? record?.source_pipelineId);
      if (!source) continue;
      out[source] = {
        target_pipelineId: stringifyId(record?.target_pipelineId),
        stageMap: normalizeStageMap(record?.stageMap ?? record?.stages),
      };
    }
  }
  return out;
}

function normalizeStageMap(raw: unknown): FlatIdMap {
  const record = asRecord(raw);
  if (!record) return {};
  const out: FlatIdMap = {};
  for (const [source, target] of Object.entries(record)) {
    const resolved = resolveTargetId(target);
    if (resolved !== undefined) out[source] = resolved;
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}
