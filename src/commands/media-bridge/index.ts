import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { appendOptional, encodePathSegment, maybeWrite, parseJsonPayload, parseNumberFlag } from "../crm/shared.js";

export function registerMediaBridge(program: Command, getCtx: () => CliContext): void {
  const mb = program.command("media-bridge").description("HubSpot Media Bridge API (video/media partner integration)");

  // Properties under an app
  const props = mb.command("properties").description("Media object properties for an app");
  props.command("list").argument("<appId>").option("--limit <n>", "Max records", "50").option("--after <cursor>", "Paging cursor").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const params = new URLSearchParams();
    params.set("limit", String(parseNumberFlag(o.limit, "--limit")));
    appendOptional(params, "after", o.after);
    const res = await client.request(`/media-bridge/v1/${appSeg}/properties?${params.toString()}`);
    printResult(ctx, res);
  });
  props.command("get").argument("<appId>").argument("<propertyName>").action(async (appId, propertyName) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const nameSeg = encodePathSegment(propertyName, "propertyName");
    const res = await client.request(`/media-bridge/v1/${appSeg}/properties/${nameSeg}`);
    printResult(ctx, res);
  });
  props.command("create").argument("<appId>").requiredOption("--data <payload>", "Property payload JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "POST", `/media-bridge/v1/${appSeg}/properties`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  props.command("update").argument("<appId>").argument("<propertyName>").requiredOption("--data <payload>", "Patch JSON").action(async (appId, propertyName, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const nameSeg = encodePathSegment(propertyName, "propertyName");
    const res = await maybeWrite(ctx, client, "PATCH", `/media-bridge/v1/${appSeg}/properties/${nameSeg}`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  props.command("delete").argument("<appId>").argument("<propertyName>").action(async (appId, propertyName) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const nameSeg = encodePathSegment(propertyName, "propertyName");
    const res = await maybeWrite(ctx, client, "DELETE", `/media-bridge/v1/${appSeg}/properties/${nameSeg}`);
    printResult(ctx, res);
  });

  // Property batch ops
  const propsBatch = props.command("batch").description("Batch property ops");
  for (const op of ["read", "create", "archive"] as const) {
    propsBatch.command(op).argument("<appId>").argument("<objectType>").requiredOption("--data <payload>", `Batch ${op} payload JSON`).action(async (appId, objectType, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const objSeg = encodePathSegment(objectType, "objectType");
      const method = op === "read" ? "POST" : "POST";
      const action = op === "read" ? client.request(`/media-bridge/v1/${appSeg}/properties/${objSeg}/batch-${op}`, { method, body: parseJsonPayload(o.data) }) : maybeWrite(ctx, client, "POST", `/media-bridge/v1/${appSeg}/properties/${objSeg}/batch-${op}`, parseJsonPayload(o.data));
      const res = await action;
      printResult(ctx, res);
    });
  }

  // Property groups per app/objectType
  const groups = mb.command("property-groups").description("Media property groups (schema grouping)");
  groups.command("list").argument("<appId>").argument("<objectType>").action(async (appId, objectType) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const objSeg = encodePathSegment(objectType, "objectType");
    const res = await client.request(`/media-bridge/v1/${appSeg}/properties/${objSeg}/groups`);
    printResult(ctx, res);
  });
  for (const action of ["create", "update", "delete"] as const) {
    groups.command(action).argument("<appId>").argument("<objectType>").option("--group-name <name>", "Group name (for update/delete)").option("--data <payload>", "Payload JSON (for create/update)").action(async (appId, objectType, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const objSeg = encodePathSegment(objectType, "objectType");
      const method = action === "create" ? "POST" : action === "update" ? "PATCH" : "DELETE";
      const path = action === "create"
        ? `/media-bridge/v1/${appSeg}/properties/${objSeg}/groups`
        : `/media-bridge/v1/${appSeg}/properties/${objSeg}/groups/${encodePathSegment(o.groupName || "", "groupName")}`;
      const body = o.data ? parseJsonPayload(o.data) : undefined;
      const res = await maybeWrite(ctx, client, method, path, body);
      printResult(ctx, res);
    });
  }

  // Schemas
  const schemas = mb.command("schemas").description("Media object schemas");
  schemas.command("list").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await client.request(`/media-bridge/v1/${seg}/schemas`);
    printResult(ctx, res);
  });
  schemas.command("update").argument("<appId>").requiredOption("--data <payload>", "Schema patch JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "PATCH", `/media-bridge/v1/${seg}/schemas`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  schemas.command("associations-create").argument("<appId>").argument("<objectType>").requiredOption("--data <payload>", "Association payload JSON").action(async (appId, objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const objSeg = encodePathSegment(objectType, "objectType");
    const res = await maybeWrite(ctx, client, "POST", `/media-bridge/v1/${appSeg}/schemas/${objSeg}/associations`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  schemas.command("associations-delete").argument("<appId>").argument("<objectType>").requiredOption("--association-id <id>", "Association id").action(async (appId, objectType, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const appSeg = encodePathSegment(appId, "appId");
    const objSeg = encodePathSegment(objectType, "objectType");
    const params = new URLSearchParams();
    params.set("associationId", String(o.associationId));
    const res = await maybeWrite(ctx, client, "DELETE", `/media-bridge/v1/${appSeg}/schemas/${objSeg}/associations?${params.toString()}`);
    printResult(ctx, res);
  });

  // Settings
  const settings = mb.command("settings").description("Media bridge partner settings");
  settings.command("register").argument("<appId>").requiredOption("--data <payload>", "Registration payload JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "POST", `/media-bridge/v1/${seg}/settings/register`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  settings.command("update").argument("<appId>").requiredOption("--data <payload>", "Settings payload JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "PUT", `/media-bridge/v1/${seg}/settings`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  settings.command("event-visibility-get").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await client.request(`/media-bridge/v1/${seg}/settings/event/visibility`);
    printResult(ctx, res);
  });
  settings.command("event-visibility-set").argument("<appId>").requiredOption("--data <payload>", "Visibility patch JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "PATCH", `/media-bridge/v1/${seg}/settings/event/visibility`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  settings.command("object-definitions-get").argument("<appId>").action(async (appId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await client.request(`/media-bridge/v1/${seg}/settings/object/definitions`);
    printResult(ctx, res);
  });
  settings.command("object-definitions-create").argument("<appId>").requiredOption("--data <payload>", "Object definitions payload JSON").action(async (appId, o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(appId, "appId");
    const res = await maybeWrite(ctx, client, "POST", `/media-bridge/v1/${seg}/settings/object/definitions`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  const oembed = settings.command("oembed-domains").description("OEmbed domain whitelist");
  for (const op of ["list", "get", "create", "update", "delete"] as const) {
    oembed.command(op).argument("<appId>").option("--domain <domain>", "Domain (for get/update/delete)").option("--data <payload>", "Payload JSON (for create/update)").action(async (appId, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(appId, "appId");
      if (op === "list") {
        const res = await client.request(`/media-bridge/v1/${seg}/settings/oembed/domains`);
        return printResult(ctx, res);
      }
      const domainSeg = o.domain ? encodePathSegment(o.domain, "domain") : "";
      const path = `/media-bridge/v1/${seg}/settings/oembed/domains${domainSeg ? `/${domainSeg}` : ""}`;
      if (op === "get") {
        const res = await client.request(path);
        return printResult(ctx, res);
      }
      const method = op === "create" ? "POST" : op === "update" ? "PATCH" : "DELETE";
      const body = o.data ? parseJsonPayload(o.data) : undefined;
      const res = await maybeWrite(ctx, client, method, path, body);
      printResult(ctx, res);
    });
  }

  // Events
  const events = mb.command("events").description("Media playback events");
  events.command("attention-span").requiredOption("--data <payload>", "Attention span payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/media-bridge/v1/events/attention/span`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  events.command("media-played").requiredOption("--data <payload>", "Media-played payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/media-bridge/v1/events/media/played`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
  events.command("media-played-percent").requiredOption("--data <payload>", "Percent payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/media-bridge/v1/events/media/played/percent`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });
}
