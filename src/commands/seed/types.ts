import type { HubSpotClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import type { PortalContext } from "../../core/urls.js";

export interface SeedResult {
  created: Array<{ type: string; name: string; id: string; url?: string }>;
  associations: Array<{ from: string; to: string; status: string }>;
  skipped: Array<{ type: string; name: string; reason: string }>;
  tips: string[];
}

export interface SeedContext {
  cliCtx: CliContext;
  client: HubSpotClient;
  portal: PortalContext | null;
  runSuffix: string;
  ownerId?: string;
  dealPipeline?: string;
  dealStage?: string;
  ticketPipeline?: string;
  ticketStage?: string;
  customSchemas: Array<{ name: string; objectTypeId: string; primaryDisplayProperty: string }>;
  contactIds: (string | null)[];
  companyIds: (string | null)[];
  dealIds: (string | null)[];
  ticketIds: (string | null)[];
  productIds: (string | null)[];
  recordUrl: (objectTypeId: string, recordId: string) => string | undefined;
}
