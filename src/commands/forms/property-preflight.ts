import type { HubSpotClient } from "../../core/http.js";
import { CliError } from "../../core/output.js";
import { encodePathSegment } from "../crm/shared.js";
import { isLegacyFormV2Payload, legacyFormFieldPropertyObjectType } from "./legacy-v2.js";

export type FormPropertyPreflightMode = "auto" | "skip" | "strict";

export interface SkippedFormField {
  name: string;
  objectType: string;
  label?: string;
  groupIndex: number;
  fieldIndex: number;
  reason: "property-missing-on-target";
}

export interface FormPropertyPreflightResult {
  payload: Record<string, unknown>;
  skippedFields: SkippedFormField[];
}

type PropertyNameLoader = (objectType: string) => Promise<Set<string>>;

export function parseFormPropertyPreflightMode(raw: string | undefined): FormPropertyPreflightMode {
  if (raw === undefined || raw === "auto") return "auto";
  if (raw === "skip" || raw === "strict") return raw;
  throw new CliError("INVALID_FLAG", "--property-preflight must be one of: auto, skip, strict");
}

export function shouldRunFormPropertyPreflight(
  payload: Record<string, unknown>,
  mode: FormPropertyPreflightMode,
  dryRun: boolean,
): boolean {
  if (!isLegacyFormV2Payload(payload)) return false;
  if (mode === "skip") return false;
  if (mode === "strict") return true;
  return !dryRun;
}

export async function preflightLegacyFormProperties(
  payload: Record<string, unknown>,
  loadPropertyNames: PropertyNameLoader,
  strict: boolean,
): Promise<FormPropertyPreflightResult> {
  const formFieldGroups = Array.isArray(payload.formFieldGroups) ? payload.formFieldGroups : [];
  const cache = new Map<string, Promise<Set<string>>>();
  const skippedFields: SkippedFormField[] = [];
  let changed = false;

  const groups = await Promise.all(formFieldGroups.map(async (group, groupIndex) => {
    if (!isRecord(group)) return group;
    const fields = Array.isArray(group.fields) ? group.fields : undefined;
    if (!fields) return group;

    const keptFields: unknown[] = [];
    let groupChanged = false;
    for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex += 1) {
      const field = fields[fieldIndex];
      if (!isRecord(field) || field.enabled === false) {
        keptFields.push(field);
        continue;
      }

      const name = stringValue(field.name);
      if (!name) {
        keptFields.push(field);
        continue;
      }

      const objectType = legacyFormFieldPropertyObjectType(field);
      const names = await getCachedPropertyNames(cache, loadPropertyNames, objectType);
      if (names.has(name)) {
        keptFields.push(field);
        continue;
      }

      changed = true;
      groupChanged = true;
      skippedFields.push({
        name,
        objectType,
        label: stringValue(field.label),
        groupIndex,
        fieldIndex,
        reason: "property-missing-on-target",
      });
    }

    return groupChanged ? { ...group, fields: keptFields } : group;
  }));

  if (strict && skippedFields.length > 0) {
    throw new CliError(
      "FORM_PROPERTY_PREFLIGHT_FAILED",
      "Legacy form references properties missing on the target portal.",
      undefined,
      { skippedFields },
    );
  }

  return {
    payload: changed ? { ...payload, formFieldGroups: groups } : payload,
    skippedFields,
  };
}

export async function loadTargetFormPropertyNames(client: HubSpotClient, objectType: string): Promise<Set<string>> {
  const objectTypeSegment = encodePathSegment(objectType, "objectType");
  const response = await client.request(`/crm/v3/properties/${objectTypeSegment}`);
  if (!isRecord(response) || !Array.isArray(response.results)) {
    throw new CliError(
      "FORM_PROPERTY_PREFLIGHT_INVALID_RESPONSE",
      `Could not read target properties for ${objectType}.`,
      undefined,
      { objectType, response },
    );
  }

  return new Set(response.results
    .filter(isRecord)
    .map((property) => stringValue(property.name))
    .filter((name): name is string => Boolean(name)));
}

function getCachedPropertyNames(
  cache: Map<string, Promise<Set<string>>>,
  loadPropertyNames: PropertyNameLoader,
  objectType: string,
): Promise<Set<string>> {
  const existing = cache.get(objectType);
  if (existing) return existing;
  const pending = loadPropertyNames(objectType);
  cache.set(objectType, pending);
  return pending;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return value ? value : undefined;
}
