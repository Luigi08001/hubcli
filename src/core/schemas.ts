/**
 * Zod schemas for HubSpot API response validation.
 *
 * These schemas validate response shapes to detect API drift.
 * By default, validation failures log a warning but don't break the CLI.
 * Set HUBCLI_STRICT_SCHEMAS=1 to throw on validation errors.
 */
import { z } from "zod";
import { CliError } from "./output.js";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const HubSpotRecord = z.object({
  id: z.string(),
  properties: z.record(z.string(), z.union([z.string(), z.null()])),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archived: z.boolean().optional(),
}).passthrough();

export const HubSpotPaging = z.object({
  next: z.object({ after: z.string() }).optional(),
}).passthrough().optional();

export const HubSpotListResponse = z.object({
  results: z.array(z.unknown()),
  paging: HubSpotPaging,
}).passthrough();

export const HubSpotSearchResponse = z.object({
  total: z.number(),
  results: z.array(z.unknown()),
  paging: HubSpotPaging,
}).passthrough();

export const HubSpotOwner = z.object({
  id: z.string(),
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  userId: z.number().optional(),
}).passthrough();

export const HubSpotPipelineStage = z.object({
  id: z.string(),
  label: z.string(),
}).passthrough();

export const HubSpotPipeline = z.object({
  id: z.string(),
  label: z.string(),
  stages: z.array(HubSpotPipelineStage),
}).passthrough();

export const HubSpotProperty = z.object({
  name: z.string(),
  label: z.string(),
  type: z.string(),
  fieldType: z.string(),
  groupName: z.string(),
}).passthrough();

export const HubSpotAssociationType = z.object({
  category: z.string(),
  typeId: z.number(),
  label: z.string().optional(),
}).passthrough();

export const HubSpotAssociation = z.object({
  toObjectId: z.number(),
  associationTypes: z.array(HubSpotAssociationType),
}).passthrough();

export const HubSpotError = z.object({
  status: z.string(),
  message: z.string(),
  correlationId: z.string().optional(),
  category: z.string().optional(),
}).passthrough();

export const AccountInfo = z.object({
  portalId: z.number(),
  uiDomain: z.string().optional(),
  timeZone: z.string().optional(),
  companyCurrency: z.string().optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// parseResponse helper
// ---------------------------------------------------------------------------

/**
 * Validate an API response against a Zod schema.
 *
 * - On success: returns the parsed (and passthrough'd) data.
 * - On failure (non-strict): logs a warning and returns raw data as-is.
 * - On failure (strict / HUBCLI_STRICT_SCHEMAS=1): throws CliError.
 */
export function parseResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  context?: string,
): T {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }

  const label = context ? ` (${context})` : "";
  const issues = result.error.issues.map(
    (i) => `  ${i.path.join(".")}: ${i.message}`,
  ).join("\n");

  const strict = isStrictSchemas();
  if (strict) {
    throw new CliError(
      "SCHEMA_VALIDATION_ERROR",
      `API response validation failed${label}:\n${issues}`,
    );
  }

  console.warn(`[hubcli] Schema warning${label}:\n${issues}`);
  return data as T;
}

function isStrictSchemas(): boolean {
  const v = process.env.HUBCLI_STRICT_SCHEMAS?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
