import { readFileSync } from "node:fs";
import type { HubSpotClient } from "../../core/http.js";
import { CliError } from "../../core/output.js";

const READONLY_PROPERTY_KEYS = new Set([
  "archived",
  "archivedAt",
  "calculated",
  "createdAt",
  "createdUserId",
  "hubspotDefined",
  "modificationMetadata",
  "referencedObjectType",
  "updatedAt",
  "updatedUserId",
]);

export type PropertyInput = Record<string, unknown>;

export type EmptyEnumMode = "skip" | "demote";

export interface NormalizePropertyBatchOptions {
  includeReadonly?: boolean;
  includeReserved?: boolean;
  emptyEnumMode?: EmptyEnumMode;
}

export interface PropertyBatchIssue {
  code: string;
  name: string;
  message: string;
}

export interface NormalizedPropertyBatch {
  rawInputs: PropertyInput[];
  inputs: PropertyInput[];
  skippedReadonly: string[];
  skippedReserved: string[];
  skippedInvalid: PropertyBatchIssue[];
  cleanedOptions: PropertyBatchIssue[];
  demotedEnums: PropertyBatchIssue[];
}

export interface ExistingPropertyMetadata {
  names: Set<string>;
  labels: Map<string, string>;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonInput(raw: string): unknown {
  const value = raw.trim();
  if (value.startsWith("@")) {
    const filePath = value.slice(1).trim();
    if (!filePath) {
      throw new CliError("INVALID_JSON_FILE", "--data @file requires a file path");
    }
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

function coercePropertyInputs(payload: unknown): PropertyInput[] {
  const unwrapped = isRecord(payload) && "data" in payload ? payload.data : payload;
  let inputs: unknown;
  if (Array.isArray(unwrapped)) {
    inputs = unwrapped;
  } else if (isRecord(unwrapped) && Array.isArray(unwrapped.inputs)) {
    inputs = unwrapped.inputs;
  } else if (isRecord(unwrapped) && Array.isArray(unwrapped.results)) {
    inputs = unwrapped.results;
  } else {
    throw new CliError("INVALID_PROPERTY_BATCH", "--data must be an array, { inputs: [...] }, a properties list dump with { results: [...] }, or hscli JSON output with data.results");
  }
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new CliError("INVALID_PROPERTY_BATCH", "--data must include at least one property");
  }
  return inputs.map((input, index) => {
    if (!isRecord(input)) {
      throw new CliError("INVALID_PROPERTY_BATCH", `Property at index ${index} must be an object`);
    }
    return input;
  });
}

export function readPropertyInputs(raw: string): PropertyInput[] {
  return coercePropertyInputs(parseJsonInput(raw));
}

function isReadonlyProperty(input: PropertyInput): boolean {
  if (input.hubspotDefined === true) return true;
  const metadata = input.modificationMetadata;
  return isRecord(metadata) && metadata.readOnlyDefinition === true;
}

function isReservedProperty(input: PropertyInput): boolean {
  const name = propertyName(input, "");
  return name.startsWith("hs_");
}

export function propertyName(input: PropertyInput, fallback: string): string {
  return typeof input.name === "string" && input.name.trim() ? input.name.trim() : fallback;
}

function normalizePropertyInput(input: PropertyInput): PropertyInput {
  const normalized: PropertyInput = {};
  for (const [key, value] of Object.entries(input)) {
    if (READONLY_PROPERTY_KEYS.has(key)) continue;
    normalized[key] = value;
  }
  return normalized;
}

function isEnumerationProperty(input: PropertyInput): boolean {
  return input.type === "enumeration";
}

function cleanOptions(input: PropertyInput): { input: PropertyInput; removed: number } {
  const options = input.options;
  if (!Array.isArray(options)) return { input, removed: 0 };
  const cleaned = options.filter((option) => {
    if (!isRecord(option)) return false;
    return typeof option.label === "string"
      && option.label.trim().length > 0
      && typeof option.value === "string"
      && option.value.trim().length > 0;
  });
  return {
    input: { ...input, options: cleaned },
    removed: options.length - cleaned.length,
  };
}

function demoteEmptyEnum(input: PropertyInput): PropertyInput {
  const demoted = { ...input };
  demoted.type = "string";
  demoted.fieldType = "text";
  delete demoted.options;
  return demoted;
}

function parseEmptyEnumMode(mode?: EmptyEnumMode): EmptyEnumMode {
  return mode === "demote" ? "demote" : "skip";
}

export function normalizePropertyBatch(
  rawInputs: PropertyInput[],
  options: NormalizePropertyBatchOptions = {},
): NormalizedPropertyBatch {
  const includeReadonly = Boolean(options.includeReadonly);
  const includeReserved = Boolean(options.includeReserved);
  const emptyEnumMode = parseEmptyEnumMode(options.emptyEnumMode);
  const skippedReadonly: string[] = [];
  const skippedReserved: string[] = [];
  const skippedInvalid: PropertyBatchIssue[] = [];
  const cleanedOptions: PropertyBatchIssue[] = [];
  const demotedEnums: PropertyBatchIssue[] = [];
  const inputs: PropertyInput[] = [];

  for (const [index, input] of rawInputs.entries()) {
    const name = propertyName(input, `<index:${index}>`);
    if (!includeReadonly && isReadonlyProperty(input)) {
      skippedReadonly.push(name);
      continue;
    }
    if (!includeReserved && isReservedProperty(input)) {
      skippedReserved.push(name);
      continue;
    }

    const normalized = normalizePropertyInput(input);
    const cleaned = cleanOptions(normalized);
    if (cleaned.removed > 0) {
      cleanedOptions.push({
        code: "BLANK_OPTION_REMOVED",
        name,
        message: `Removed ${cleaned.removed} option(s) with blank label/value.`,
      });
    }

    if (isEnumerationProperty(cleaned.input)) {
      const validOptions = Array.isArray(cleaned.input.options) ? cleaned.input.options.length : 0;
      if (validOptions === 0) {
        if (emptyEnumMode === "demote") {
          inputs.push(demoteEmptyEnum(cleaned.input));
          demotedEnums.push({
            code: "EMPTY_ENUM_DEMOTED",
            name,
            message: "Demoted enumeration with no valid options to string/text.",
          });
          continue;
        }
        skippedInvalid.push({
          code: "EMPTY_ENUM_OPTIONS",
          name,
          message: "Skipped enumeration property with no valid options.",
        });
        continue;
      }
    }

    inputs.push(cleaned.input);
  }

  return { rawInputs, inputs, skippedReadonly, skippedReserved, skippedInvalid, cleanedOptions, demotedEnums };
}

export function chunkInputs<T>(inputs: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < inputs.length; i += chunkSize) {
    chunks.push(inputs.slice(i, i + chunkSize));
  }
  return chunks;
}

export async function loadExistingPropertyNames(client: HubSpotClient, objectTypeSegment: string): Promise<Set<string>> {
  return (await loadExistingPropertyMetadata(client, objectTypeSegment)).names;
}

export function normalizePropertyLabel(label: unknown): string {
  return typeof label === "string" ? label.trim().toLowerCase() : "";
}

export async function loadExistingPropertyMetadata(client: HubSpotClient, objectTypeSegment: string): Promise<ExistingPropertyMetadata> {
  const res = await client.request(`/crm/v3/properties/${objectTypeSegment}`);
  const metadata: ExistingPropertyMetadata = { names: new Set(), labels: new Map() };
  if (!isRecord(res) || !Array.isArray(res.results)) return metadata;
  for (const item of res.results.filter(isRecord)) {
    const name = propertyName(item, "");
    if (!name) continue;
    metadata.names.add(name);
    const label = normalizePropertyLabel(item.label);
    if (label && !metadata.labels.has(label)) {
      metadata.labels.set(label, name);
    }
  }
  return metadata;
}
