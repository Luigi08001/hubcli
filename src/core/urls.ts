import { getProfile } from "./auth.js";

/** Standard CRM object type IDs used in HubSpot web UI URLs. */
const OBJECT_TYPE_IDS: Record<string, string> = {
  contacts: "0-1",
  companies: "0-2",
  deals: "0-3",
  tickets: "0-5",
  notes: "0-46",
  tasks: "0-27",
  calls: "0-48",
  emails: "0-49",
  meetings: "0-47",
};

export interface PortalContext {
  portalId: string;
  uiDomain: string;
}

/**
 * Resolve portal context (portalId + uiDomain) from stored profile.
 * Returns null if either value is missing — no API calls are made.
 */
export function resolvePortalContext(profile: string): PortalContext | null {
  try {
    const data = getProfile(profile);
    if (!data.portalId || !data.uiDomain) return null;
    return { portalId: data.portalId, uiDomain: data.uiDomain };
  } catch {
    return null;
  }
}

/**
 * Get the HubSpot object type ID for a standard object type name.
 * Returns undefined for custom objects — those already carry their own type ID.
 */
export function getObjectTypeId(objectTypeName: string): string | undefined {
  return OBJECT_TYPE_IDS[objectTypeName.toLowerCase()];
}

/**
 * Build a URL to a CRM record in the HubSpot web UI.
 *
 * Standard objects: https://app-eu1.hubspot.com/contacts/12345678/record/0-1/12345
 * Custom objects:   https://app-eu1.hubspot.com/contacts/12345678/record/2-199622513/12345
 */
export function buildRecordUrl(
  portal: PortalContext,
  objectTypeId: string,
  recordId: string,
): string {
  return `https://${portal.uiDomain}/contacts/${portal.portalId}/record/${objectTypeId}/${recordId}`;
}

/**
 * Build a URL to the object-type settings page for a custom object.
 *
 * Example: https://app-eu1.hubspot.com/object-type-settings/12345678/object/2-199622513
 */
export function buildObjectSettingsUrl(
  portal: PortalContext,
  objectTypeId: string,
): string {
  return `https://${portal.uiDomain}/object-type-settings/${portal.portalId}/object/${objectTypeId}`;
}

/**
 * Build a URL to the pipeline board in the HubSpot web UI.
 *
 * Example: https://app-eu1.hubspot.com/contacts/12345678/objects/0-3/views/all/board
 */
export function buildPipelineUrl(
  portal: PortalContext,
  objectType: string,
): string {
  const typeId = getObjectTypeId(objectType) ?? objectType;
  return `https://${portal.uiDomain}/contacts/${portal.portalId}/objects/${typeId}/views/all/board`;
}

/**
 * Enrich a single CRM record object with a `url` field.
 * If the record already has a `url`, it is left untouched.
 */
export function enrichRecordUrl(
  record: Record<string, unknown>,
  portal: PortalContext | null,
  objectTypeName: string,
): void {
  if (!portal) return;
  if (record.url) return; // API-provided URL takes precedence
  const id = record.id ?? record.hs_object_id ?? (record.properties as Record<string, unknown> | undefined)?.hs_object_id;
  if (!id) return;
  const typeId = getObjectTypeId(objectTypeName);
  if (!typeId) return; // Custom objects handled separately
  record.url = buildRecordUrl(portal, typeId, String(id));
}

/**
 * Enrich a single custom-object record with a `url` field.
 */
export function enrichCustomRecordUrl(
  record: Record<string, unknown>,
  portal: PortalContext | null,
  objectTypeId: string,
): void {
  if (!portal) return;
  if (record.url) return;
  const id = record.id ?? record.hs_object_id ?? (record.properties as Record<string, unknown> | undefined)?.hs_object_id;
  if (!id) return;
  record.url = buildRecordUrl(portal, objectTypeId, String(id));
}

/**
 * Enrich a list response (with `results` array) by adding `url` to each record.
 */
export function enrichListResponse(
  data: unknown,
  portal: PortalContext | null,
  objectTypeName: string,
): void {
  if (!portal || !data || typeof data !== "object") return;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.results)) return;
  for (const record of obj.results) {
    if (record && typeof record === "object") {
      enrichRecordUrl(record as Record<string, unknown>, portal, objectTypeName);
    }
  }
}

/**
 * Enrich a list response for custom objects.
 */
export function enrichCustomListResponse(
  data: unknown,
  portal: PortalContext | null,
  objectTypeId: string,
): void {
  if (!portal || !data || typeof data !== "object") return;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.results)) return;
  for (const record of obj.results) {
    if (record && typeof record === "object") {
      enrichCustomRecordUrl(record as Record<string, unknown>, portal, objectTypeId);
    }
  }
}
