import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerResource } from "../domains/shared.js";
import { registerAds } from "./ads.js";
import { registerSocial } from "./social.js";
import { registerSeo } from "./seo.js";
import { registerLandingPages } from "./landing-pages.js";
import { registerTransactional } from "./transactional.js";
import { registerSubscriptions } from "./subscriptions.js";
import { registerMarketingEvents } from "./events.js";

export function registerMarketing(program: Command, getCtx: () => CliContext): void {
  const marketing = program.command("marketing").description("HubSpot Marketing APIs");

  registerResource(marketing, getCtx, {
    name: "emails",
    description: "Marketing emails",
    listPath: "/marketing/v3/emails",
    itemPath: (id) => `/marketing/v3/emails/${id}`,
    createPath: "/marketing/v3/emails",
    updatePath: (id) => `/marketing/v3/emails/${id}`,
  });

  registerResource(marketing, getCtx, {
    name: "campaigns",
    description: "Marketing campaigns",
    listPath: "/marketing/v3/campaigns",
    itemPath: (id) => `/marketing/v3/campaigns/${id}`,
    createPath: "/marketing/v3/campaigns",
    updatePath: (id) => `/marketing/v3/campaigns/${id}`,
  });

  registerAds(marketing, getCtx);
  registerSocial(marketing, getCtx);
  registerSeo(marketing, getCtx);
  registerLandingPages(marketing, getCtx);
  registerTransactional(marketing, getCtx);
  registerSubscriptions(marketing, getCtx);
  registerMarketingEvents(marketing, getCtx);
}
