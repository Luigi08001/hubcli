import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { printResult } from "../../core/output.js";
import { encodePathSegment, maybeWrite, parseJsonPayload } from "../crm/shared.js";
import { registerHubdb } from "./hubdb.js";
import { registerCmsContentCommands } from "./content-ops.js";
import { registerBlogSettings } from "./blog-settings.js";
import { registerSourceCode } from "./source-code.js";

export function registerCms(program: Command, getCtx: () => CliContext): void {
  const cms = program.command("cms").description("HubSpot CMS APIs");

  // Site pages — full content lifecycle
  registerCmsContentCommands(cms, "site-pages", "CMS website pages", "/cms/v3/pages/site-pages", getCtx, {
    drafts: true, revisions: true, abTest: true, multiLanguage: true, clone: true, schedule: true, batch: true,
  });

  // Alias `pages` to site-pages for back-compat with 0.3.0 users
  registerCmsContentCommands(cms, "pages", "Alias for site-pages (back-compat)", "/cms/v3/pages/site-pages", getCtx, {
    drafts: true, revisions: true, abTest: true, multiLanguage: true, clone: true, schedule: true, batch: true,
  });

  // Landing pages — also supports landing-pages/folders sub-resource
  registerCmsContentCommands(cms, "landing-pages", "CMS landing pages", "/cms/v3/pages/landing-pages", getCtx, {
    drafts: true, revisions: true, abTest: true, multiLanguage: true, clone: true, schedule: true, batch: true,
  });

  // Landing page folders
  registerCmsContentCommands(cms, "landing-page-folders", "Landing page folders (organizational)", "/cms/v3/pages/landing-pages/folders", getCtx, {
    revisions: true, batch: true,
  });

  // Blog posts with full lifecycle
  registerCmsContentCommands(cms, "blog-posts", "CMS blog posts", "/cms/v3/blogs/posts", getCtx, {
    drafts: true, revisions: true, multiLanguage: true, clone: true, schedule: true, batch: true,
  });

  // Back-compat alias `blogs`
  registerCmsContentCommands(cms, "blogs", "Alias for blog-posts (back-compat)", "/cms/v3/blogs/posts", getCtx, {
    drafts: true, revisions: true, multiLanguage: true, clone: true, schedule: true, batch: true,
  });

  // Blog authors
  registerCmsContentCommands(cms, "blog-authors", "CMS blog post authors", "/cms/v3/blogs/authors", getCtx, {
    multiLanguage: true, batch: true,
  });

  // Blog tags
  registerCmsContentCommands(cms, "blog-tags", "CMS blog post tags", "/cms/v3/blogs/tags", getCtx, {
    multiLanguage: true, batch: true,
  });

  // URL redirects (no drafts/revisions for redirects)
  registerCmsContentCommands(cms, "redirects", "CMS URL redirects", "/cms/v3/url-redirects", getCtx, {
    batch: true,
  });

  // Blog settings (single-document style, not a list)
  registerBlogSettings(cms, getCtx);

  // Source code (theme/module file management via public API)
  registerSourceCode(cms, getCtx);

  // Domains (read-only)
  const domains = cms.command("domains").description("CMS domains connected to the portal");
  domains.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/cms/v3/domains`);
    printResult(ctx, res);
  });
  domains.command("get").argument("<domainId>").action(async (domainId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(domainId, "domainId");
    const res = await client.request(`/cms/v3/domains/${seg}`);
    printResult(ctx, res);
  });

  // CMS audit logs
  cms.command("audit-logs").description("CMS content audit log").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/cms/v3/audit-logs`);
    printResult(ctx, res);
  });

  // Site search (already covered top-level; keep lightweight proxy here)
  const search = cms.command("search").description("Site search index + query");
  search.command("query").requiredOption("--q <text>", "Search query").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const params = new URLSearchParams();
    params.set("q", String(o.q));
    const res = await client.request(`/cms/v3/site-search/search?${params.toString()}`);
    printResult(ctx, res);
  });
  search.command("indexed-data").argument("<contentId>").action(async (contentId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(contentId, "contentId");
    const res = await client.request(`/cms/v3/site-search/indexed/data/${seg}`);
    printResult(ctx, res);
  });

  // SEO audit
  cms.command("seo-audit").description("CMS SEO recommendations audit").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/cms/v3/seo/audit`);
    printResult(ctx, res);
  });

  // Topics (clusters)
  const topics = cms.command("topics").description("Blog/content topic clusters");
  topics.command("list").action(async () => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await client.request(`/cms/v3/topics`);
    printResult(ctx, res);
  });
  topics.command("get").argument("<topicId>").action(async (topicId) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const seg = encodePathSegment(topicId, "topicId");
    const res = await client.request(`/cms/v3/topics/${seg}`);
    printResult(ctx, res);
  });
  topics.command("create").requiredOption("--data <payload>", "Topic payload JSON").action(async (o) => {
    const ctx = getCtx();
    const client = createClient(ctx.profile);
    const res = await maybeWrite(ctx, client, "POST", `/cms/v3/topics`, parseJsonPayload(o.data));
    printResult(ctx, res);
  });

  registerHubdb(cms, getCtx);
}
