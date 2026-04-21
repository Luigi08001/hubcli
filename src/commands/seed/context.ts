import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { resolvePortalContext } from "../../core/urls.js";
import type { SeedContext } from "./types.js";

/**
 * Build the seed context: discover owner, default pipelines, custom object
 * schemas. Also establishes the runSuffix used across a run for idempotent
 * unique naming (SKUs, form names, list names, etc.).
 */
export async function buildSeedContext(cliCtx: CliContext): Promise<SeedContext> {
  const client = createClient(cliCtx.profile);
  const portal = resolvePortalContext(cliCtx.profile);
  const runSuffix = Date.now().toString(36).slice(-5);

  // Detect owner
  let ownerId: string | undefined;
  try {
    const owners = await client.request("/crm/v3/owners?limit=1") as { results?: Array<{ id?: string }> };
    if (owners.results?.[0]?.id) ownerId = owners.results[0].id;
  } catch { /* no owner access */ }

  // Detect default deal pipeline + stage
  let dealPipeline: string | undefined;
  let dealStage: string | undefined;
  try {
    const pipelines = await client.request("/crm/v3/pipelines/deals") as { results?: Array<{ id?: string; stages?: Array<{ id?: string }> }> };
    const defaultPipeline = pipelines.results?.[0];
    if (defaultPipeline) {
      dealPipeline = defaultPipeline.id;
      const stages = defaultPipeline.stages ?? [];
      dealStage = stages.length > 2 ? stages[Math.floor(stages.length / 2)]?.id : stages[0]?.id;
    }
  } catch { /* no pipeline access */ }

  // Detect default ticket pipeline + stage
  let ticketPipeline: string | undefined;
  let ticketStage: string | undefined;
  try {
    const pipelines = await client.request("/crm/v3/pipelines/tickets") as { results?: Array<{ id?: string; stages?: Array<{ id?: string }> }> };
    if (pipelines.results?.[0]) {
      ticketPipeline = pipelines.results[0].id;
      ticketStage = pipelines.results[0].stages?.[0]?.id;
    }
  } catch { /* no pipeline access */ }

  // Detect custom object schemas
  const customSchemas: Array<{ name: string; objectTypeId: string; primaryDisplayProperty: string }> = [];
  try {
    const schemas = await client.request("/crm/v3/schemas") as { results?: Array<{ name?: string; objectTypeId?: string; primaryDisplayProperty?: string }> };
    for (const s of schemas.results ?? []) {
      if (s.name && s.objectTypeId && s.primaryDisplayProperty) {
        customSchemas.push({ name: s.name, objectTypeId: s.objectTypeId, primaryDisplayProperty: s.primaryDisplayProperty });
      }
    }
  } catch { /* no schema access */ }

  const baseUrl = portal?.uiDomain ? `https://${portal.uiDomain}/contacts/${portal.portalId}` : undefined;
  const recordUrl = (objectTypeId: string, recordId: string): string | undefined =>
    baseUrl ? `${baseUrl}/record/${objectTypeId}/${recordId}` : undefined;

  return {
    cliCtx,
    client,
    portal,
    runSuffix,
    ownerId,
    dealPipeline,
    dealStage,
    ticketPipeline,
    ticketStage,
    customSchemas,
    contactIds: [],
    companyIds: [],
    dealIds: [],
    ticketIds: [],
    productIds: [],
    recordUrl,
  };
}
