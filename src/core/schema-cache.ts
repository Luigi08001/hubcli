import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getHscliHomeDir, getProfile, getApiBaseUrl } from "./auth.js";
import { HubSpotClient } from "./http.js";
import { CliError } from "./output.js";

const SCHEMA_CACHE_VERSION = 1;
const SCHEMA_CACHE_FILENAME = "schema-cache.json";
const DEFAULT_SCHEMA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ASSOCIATION_OBJECT_TYPES = ["contacts", "companies", "deals", "tickets", "notes", "calls", "tasks", "emails", "meetings"] as const;

export interface CrmPropertyOption {
  label: string;
  value: string;
}

export interface CrmPropertySchema {
  name: string;
  label: string;
  type: string;
  fieldType?: string;
  required: boolean;
  options: CrmPropertyOption[];
}

export interface CrmPipelineSchema {
  id: string;
  label: string;
  stages: Array<{ id: string; label: string }>;
}

export interface CrmAssociationLabelSchema {
  category?: string;
  typeId?: number;
  label: string;
}

export interface CrmObjectSchema {
  objectType: string;
  fetchedAt: string;
  properties: CrmPropertySchema[];
  pipelines: CrmPipelineSchema[];
  associationLabels: Record<string, CrmAssociationLabelSchema[]>;
}

interface SchemaCacheEntry {
  key: string;
  profile: string;
  portalId?: string;
  objectType: string;
  fetchedAt: string;
  expiresAt: string;
  schema: CrmObjectSchema;
}

interface SchemaCacheFile {
  version: 1;
  entries: SchemaCacheEntry[];
}

export interface LoadCrmObjectSchemaOptions {
  profile: string;
  token: string;
  objectType: string;
  offline?: boolean;
  refresh?: boolean;
  ttlMs?: number;
}

export interface LoadedCrmObjectSchema {
  source: "cache" | "api";
  stale?: boolean;
  schema: CrmObjectSchema;
}

export interface PayloadValidationIssue {
  field: string;
  message: string;
}

export interface PayloadValidationResult {
  valid: boolean;
  errors: PayloadValidationIssue[];
  warnings: PayloadValidationIssue[];
}

export async function loadCrmObjectSchema(options: LoadCrmObjectSchemaOptions): Promise<LoadedCrmObjectSchema> {
  const objectType = options.objectType.trim().toLowerCase();
  if (!objectType) {
    throw new CliError("SCHEMA_OBJECT_TYPE_REQUIRED", "objectType cannot be empty");
  }

  const ttlMs = options.ttlMs && options.ttlMs > 0 ? options.ttlMs : DEFAULT_SCHEMA_CACHE_TTL_MS;
  const portalId = resolvePortalId(options.profile);
  const key = buildSchemaCacheKey(options.profile, objectType, portalId);
  const cache = readSchemaCache();
  const existing = cache.entries.find((entry) => entry.key === key);

  if (options.offline) {
    if (!existing) {
      throw new CliError(
        "SCHEMA_CACHE_MISS",
        `No cached schema found for '${objectType}'. Run 'hscli crm describe ${objectType}' online first.`,
      );
    }
    return {
      source: "cache",
      stale: isExpired(existing.expiresAt),
      schema: existing.schema,
    };
  }

  if (existing && !options.refresh && !isExpired(existing.expiresAt)) {
    return {
      source: "cache",
      schema: existing.schema,
    };
  }

  try {
    const schema = await fetchCrmObjectSchema({
      profile: options.profile,
      token: options.token,
      objectType,
    });

    const nowIso = new Date().toISOString();
    const updated: SchemaCacheEntry = {
      key,
      profile: options.profile,
      portalId,
      objectType,
      fetchedAt: nowIso,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      schema,
    };

    if (existing) {
      const index = cache.entries.findIndex((entry) => entry.key === key);
      cache.entries[index] = updated;
    } else {
      cache.entries.push(updated);
    }

    writeSchemaCache(cache);
    return {
      source: "api",
      schema,
    };
  } catch (error) {
    if (existing) {
      return {
        source: "cache",
        stale: true,
        schema: existing.schema,
      };
    }
    throw error;
  }
}

export function validateCrmPayload(schema: CrmObjectSchema, payload: Record<string, unknown>): PayloadValidationResult {
  const errors: PayloadValidationIssue[] = [];
  const warnings: PayloadValidationIssue[] = [];

  const propertiesValue = payload.properties ?? payload;
  if (!propertiesValue || typeof propertiesValue !== "object" || Array.isArray(propertiesValue)) {
    errors.push({ field: "properties", message: "Payload must be an object or include a 'properties' object." });
    return { valid: false, errors, warnings };
  }

  const provided = propertiesValue as Record<string, unknown>;
  const index = new Map(schema.properties.map((property) => [property.name, property]));

  for (const property of schema.properties) {
    if (!property.required) continue;
    if (!(property.name in provided)) {
      errors.push({ field: property.name, message: "Required property is missing." });
    }
  }

  for (const [field, value] of Object.entries(provided)) {
    const property = index.get(field);
    if (!property) {
      warnings.push({ field, message: "Property not found in local schema cache (cache may be stale)." });
      continue;
    }

    if (property.options.length > 0 && value !== undefined && value !== null) {
      const allowed = new Set(property.options.map((option) => option.value));
      const submittedValues = normalizeCandidateValues(value);
      for (const candidate of submittedValues) {
        if (!allowed.has(candidate)) {
          errors.push({
            field,
            message: `Value '${candidate}' is not allowed. Allowed: ${Array.from(allowed).join(", ")}`,
          });
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

async function fetchCrmObjectSchema(options: {
  profile: string;
  token: string;
  objectType: string;
}): Promise<CrmObjectSchema> {
  const client = new HubSpotClient(options.token, { profile: options.profile, apiBaseUrl: getApiBaseUrl(options.profile) });
  const objectTypeSegment = encodePathSegment(options.objectType, "objectType");

  const propertiesResponse = await client.request(`/crm/v3/properties/${objectTypeSegment}`);
  const properties = parseProperties(propertiesResponse);

  const pipelines = await maybeLoadPipelines(client, objectTypeSegment, options.objectType);
  const associationLabels = await loadAssociationLabels(client, objectTypeSegment, options.objectType);

  return {
    objectType: options.objectType,
    fetchedAt: new Date().toISOString(),
    properties,
    pipelines,
    associationLabels,
  };
}

async function maybeLoadPipelines(
  client: HubSpotClient,
  objectTypeSegment: string,
  objectType: string,
): Promise<CrmPipelineSchema[]> {
  if (objectType !== "deals" && objectType !== "tickets") {
    return [];
  }
  try {
    const response = await client.request(`/crm/v3/pipelines/${objectTypeSegment}`);
    return parsePipelines(response);
  } catch (error) {
    if (error instanceof CliError && (error.status === 403 || error.status === 404)) {
      return [];
    }
    throw error;
  }
}

async function loadAssociationLabels(
  client: HubSpotClient,
  fromObjectTypeSegment: string,
  fromObjectType: string,
): Promise<Record<string, CrmAssociationLabelSchema[]>> {
  const output: Record<string, CrmAssociationLabelSchema[]> = {};

  for (const toObjectType of ASSOCIATION_OBJECT_TYPES) {
    const toObjectTypeSegment = encodePathSegment(toObjectType, "toObjectType");
    try {
      const response = await client.request(`/crm/v4/associations/${fromObjectTypeSegment}/${toObjectTypeSegment}/labels`);
      output[toObjectType] = parseAssociationLabels(response);
    } catch (error) {
      if (error instanceof CliError && (error.status === 403 || error.status === 404)) {
        output[toObjectType] = [];
        continue;
      }
      if (error instanceof CliError && error.code === "UNSUPPORTED_OBJECT_TYPE" && fromObjectType !== toObjectType) {
        output[toObjectType] = [];
        continue;
      }
      throw error;
    }
  }

  return output;
}

function parseProperties(payload: unknown): CrmPropertySchema[] {
  return asResultArray(payload).map((item) => {
    const name = asString(item.name) || "";
    const label = asString(item.label) || name;
    const type = asString(item.type) || "string";
    const fieldType = asString(item.fieldType) || undefined;
    const required = typeof item.required === "boolean" ? item.required : false;
    const options = Array.isArray(item.options)
      ? item.options
        .map((value) => {
          const record = asRecord(value);
          const optionValue = asString(record.value);
          if (!optionValue) return undefined;
          return {
            label: asString(record.label) || optionValue,
            value: optionValue,
          };
        })
        .filter((value): value is CrmPropertyOption => Boolean(value))
      : [];

    return {
      name,
      label,
      type,
      fieldType,
      required,
      options,
    };
  }).filter((property) => property.name.length > 0);
}

function parsePipelines(payload: unknown): CrmPipelineSchema[] {
  return asResultArray(payload).map((item) => {
    const id = asString(item.id) || "";
    const label = asString(item.label) || id;
    const stages = Array.isArray(item.stages)
      ? item.stages
        .map((stage) => {
          const record = asRecord(stage);
          const stageId = asString(record.id);
          if (!stageId) return undefined;
          return {
            id: stageId,
            label: asString(record.label) || stageId,
          };
        })
        .filter((stage): stage is { id: string; label: string } => Boolean(stage))
      : [];

    return { id, label, stages };
  }).filter((pipeline) => pipeline.id.length > 0);
}

function parseAssociationLabels(payload: unknown): CrmAssociationLabelSchema[] {
  return asResultArray(payload).map((item) => {
    const typeIdValue = item.typeId;
    const typeId = typeof typeIdValue === "number"
      ? typeIdValue
      : (typeof typeIdValue === "string" && Number.isFinite(Number(typeIdValue)) ? Number(typeIdValue) : undefined);

    return {
      category: asString(item.category) || undefined,
      typeId,
      label: asString(item.label) || "",
    };
  }).filter((label) => label.label.length > 0);
}

function normalizeCandidateValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    if (value.includes(";")) {
      return value.split(";").map((item) => item.trim()).filter(Boolean);
    }
    return [value.trim()].filter(Boolean);
  }

  return [String(value)];
}

function asResultArray(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.map((item) => asRecord(item));
  }
  const record = asRecord(payload);
  if (Array.isArray(record.results)) {
    return record.results.map((item) => asRecord(item));
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

function buildSchemaCacheKey(profile: string, objectType: string, portalId?: string): string {
  return `${profile.trim()}|${portalId?.trim() || "unknown"}|${objectType.trim().toLowerCase()}`;
}

function resolvePortalId(profile: string): string | undefined {
  try {
    const value = getProfile(profile).portalId?.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function isExpired(expiresAt: string): boolean {
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) return true;
  return parsed <= Date.now();
}

function schemaCachePaths(): { dir: string; file: string } {
  const dir = getHscliHomeDir();
  return { dir, file: join(dir, SCHEMA_CACHE_FILENAME) };
}

function readSchemaCache(): SchemaCacheFile {
  const { file } = schemaCachePaths();
  if (!existsSync(file)) {
    return { version: SCHEMA_CACHE_VERSION, entries: [] };
  }

  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<SchemaCacheFile>;
    if (parsed.version !== SCHEMA_CACHE_VERSION || !Array.isArray(parsed.entries)) {
      return { version: SCHEMA_CACHE_VERSION, entries: [] };
    }
    return {
      version: SCHEMA_CACHE_VERSION,
      entries: parsed.entries,
    };
  } catch {
    return { version: SCHEMA_CACHE_VERSION, entries: [] };
  }
}

function writeSchemaCache(cache: SchemaCacheFile): void {
  const { dir, file } = schemaCachePaths();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") {
    chmodSync(dir, 0o700);
  }

  writeFileSync(file, JSON.stringify(cache, null, 2), { mode: 0o600 });
  if (process.platform !== "win32") {
    chmodSync(file, 0o600);
  }
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x1f\x7f]/;

function encodePathSegment(raw: string, segmentName: string): string {
  const value = raw?.trim();
  if (!value) {
    throw new CliError("INVALID_PATH_SEGMENT", `${segmentName} cannot be empty`);
  }
  if (CONTROL_CHAR_PATTERN.test(value)) {
    throw new CliError("INVALID_PATH_SEGMENT", `${segmentName} must not contain control characters`);
  }
  if (value.includes("/") || value.includes("\\")) {
    throw new CliError("INVALID_PATH_SEGMENT", `${segmentName} must not contain path separators`);
  }
  if (value === "." || value === "..") {
    throw new CliError("INVALID_PATH_SEGMENT", `${segmentName} cannot be '.' or '..'`);
  }
  return encodeURIComponent(value);
}
