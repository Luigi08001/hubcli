import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";

export function registerFeatureFlags(program: Command, getCtx: () => CliContext): void {
  const ff = program.command("feature-flags").description("HubSpot Feature Flags API (app dev framework)");

  ff.command("list")
    .description("List feature flags registered for an app")
    .argument("<appId>")
    .action(async (appId) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(appId, "appId");
      const res = await client.request(`/feature/flags/v3/${seg}/flags`);
      printResult(ctx, res);
    });

  ff.command("get")
    .description("Get a specific feature flag by name")
    .argument("<appId>")
    .argument("<flagName>")
    .action(async (appId, flagName) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const nameSeg = encodePathSegment(flagName, "flagName");
      const res = await client.request(`/feature/flags/v3/${appSeg}/flags/${nameSeg}`);
      printResult(ctx, res);
    });

  ff.command("create")
    .description("Create or register a new feature flag")
    .argument("<appId>")
    .requiredOption("--data <payload>", "Flag definition payload JSON")
    .action(async (appId, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const seg = encodePathSegment(appId, "appId");
      const res = await maybeWrite(ctx, client, "POST", `/feature/flags/v3/${seg}/flags`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  ff.command("update")
    .description("Update a feature flag by name")
    .argument("<appId>")
    .argument("<flagName>")
    .requiredOption("--data <payload>", "Flag update payload JSON")
    .action(async (appId, flagName, o) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const nameSeg = encodePathSegment(flagName, "flagName");
      const res = await maybeWrite(ctx, client, "PUT", `/feature/flags/v3/${appSeg}/flags/${nameSeg}`, parseJsonPayload(o.data));
      printResult(ctx, res);
    });

  ff.command("delete")
    .description("Delete a feature flag")
    .argument("<appId>")
    .argument("<flagName>")
    .action(async (appId, flagName) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const appSeg = encodePathSegment(appId, "appId");
      const nameSeg = encodePathSegment(flagName, "flagName");
      const res = await maybeWrite(ctx, client, "DELETE", `/feature/flags/v3/${appSeg}/flags/${nameSeg}`);
      printResult(ctx, res);
    });
}
