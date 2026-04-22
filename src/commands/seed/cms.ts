import { errorReason, nowIso, safeCreate } from "./shared.js";
import type { SeedContext, SeedResult } from "./types.js";

/**
 * CMS: site pages, landing pages, blog posts/authors/tags, URL redirects,
 * HubDB tables, and edit→publish cycle for pages (generates revisions).
 */
export async function seedCms(ctx: SeedContext, result: SeedResult): Promise<void> {
  const { client, runSuffix } = ctx;

  // --- URL redirect ---
  try {
    const rec = await safeCreate(client, "/cms/v3/url-redirects", {
      routePrefix: "/hscli-seed-redirect",
      destination: "https://hscli.dev",
      redirectStyle: 301,
      precedence: 100,
      isOnlyAfterNotFound: false,
      isMatchFullUrl: false,
      isMatchQueryString: false,
      isPattern: false,
      isTrailingSlashOptional: true,
      isProtocolAgnostic: true,
      updated: Date.now(),
      created: Date.now(),
    });
    if (rec) result.created.push({ type: "url_redirect", name: "/hscli-seed-redirect", id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "url_redirect", name: "/hscli-seed-redirect", reason: errorReason(err) });
  }

  // --- Site page ---
  try {
    const pageName = `HubCLI Seed Site Page ${runSuffix}`;
    const rec = await safeCreate(client, "/cms/v3/pages/site-pages", {
      name: pageName,
      slug: `hscli-seed-${runSuffix}`,
      htmlTitle: "HubCLI Seed Page",
      metaDescription: "A sample site page created by hscli seed for testing.",
      language: "en",
    });
    if (rec) result.created.push({ type: "site_page", name: pageName, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "site_page", name: "HubCLI Seed Site Page", reason: errorReason(err) });
  }

  // --- Landing page ---
  try {
    const lpName = `HubCLI Seed Landing Page ${runSuffix}`;
    const rec = await safeCreate(client, "/cms/v3/pages/landing-pages", {
      name: lpName,
      slug: `hscli-seed-lp-${runSuffix}`,
      htmlTitle: "HubCLI Seed Landing Page",
      language: "en",
    });
    if (rec) result.created.push({ type: "landing_page", name: lpName, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "landing_page", name: "HubCLI Seed Landing Page", reason: errorReason(err) });
  }

  // --- Blog post (requires a configured blog) ---
  try {
    const blogs = await client.request("/cms/v3/blogs/posts?limit=1") as { results?: Array<{ contentGroupId?: string }> };
    const blogId = blogs.results?.[0]?.contentGroupId;
    if (blogId) {
      const postName = `HubCLI Seed Blog Post ${runSuffix}`;
      const rec = await safeCreate(client, "/cms/v3/blogs/posts", {
        name: postName,
        slug: `hscli-seed-post-${runSuffix}`,
        contentGroupId: blogId,
        language: "en",
      });
      if (rec) result.created.push({ type: "blog_post", name: postName, id: rec.id });
    } else {
      result.skipped.push({ type: "blog_post", name: "HubCLI Seed Blog Post", reason: "no blog configured on portal" });
    }
  } catch (err) {
    result.skipped.push({ type: "blog_post", name: "HubCLI Seed Blog Post", reason: errorReason(err) });
  }

  // --- Blog author ---
  try {
    const rec = await safeCreate(client, "/cms/v3/blogs/authors", {
      fullName: `HubCLI Seed Author ${runSuffix}`,
      email: `hscli-seed-${runSuffix}@example.com`,
    });
    if (rec) result.created.push({ type: "blog_author", name: `HubCLI Seed Author ${runSuffix}`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "blog_author", name: "HubCLI Seed Author", reason: errorReason(err) });
  }

  // --- Blog tag ---
  try {
    const rec = await safeCreate(client, "/cms/v3/blogs/tags", {
      name: `hscli-seed-tag-${runSuffix}`,
      slug: `hscli-seed-tag-${runSuffix}`,
      language: "en",
    });
    if (rec) result.created.push({ type: "blog_tag", name: `hscli-seed-tag-${runSuffix}`, id: rec.id });
  } catch (err) {
    result.skipped.push({ type: "blog_tag", name: "HubCLI Seed Tag", reason: errorReason(err) });
  }

  // --- HubDB table + rows + publish ---
  try {
    const tableRec = await safeCreate(client, "/cms/v3/hubdb/tables", {
      name: `hscli_seed_table_${runSuffix}`,
      label: `HubCLI Seed Table ${runSuffix}`,
      useForPages: false,
      columns: [
        { name: "key", label: "Key", type: "TEXT" },
        { name: "value", label: "Value", type: "TEXT" },
      ],
    });
    if (tableRec) {
      result.created.push({ type: "hubdb_table", name: `hscli_seed_table_${runSuffix}`, id: tableRec.id });
      try {
        const rowRec = await safeCreate(client, `/cms/v3/hubdb/tables/${tableRec.id}/rows/draft/batch/create`, {
          inputs: [{ values: { key: "sample-key", value: "sample-value" } }],
        });
        if (rowRec) result.created.push({ type: "hubdb_row", name: "sample-row", id: String(rowRec.id) });
      } catch { /* ignore row create failure */ }
      try {
        await client.request(`/cms/v3/hubdb/tables/${tableRec.id}/draft/publish`, { method: "POST", body: {} });
        result.created.push({ type: "hubdb_publish", name: "table published", id: tableRec.id });
      } catch { /* ignore publish failure */ }
    }
  } catch (err) {
    result.skipped.push({ type: "hubdb_table", name: "hscli_seed_table", reason: errorReason(err) });
  }

  // --- Revisions + push-live for site-pages/landing-pages ---
  try {
    const sitePages = await client.request("/cms/v3/pages/site-pages?limit=5") as { results?: Array<{ id?: string; name?: string }> };
    for (const sp of sitePages.results?.slice(0, 2) ?? []) {
      if (!sp.id) continue;
      try {
        await client.request(`/cms/v3/pages/site-pages/${sp.id}/draft`, {
          method: "PATCH",
          body: { metaDescription: `Revised by hscli seed at ${nowIso()}` },
        });
        result.created.push({ type: "revision:site_page", name: sp.name || sp.id, id: sp.id });
        try {
          await client.request(`/cms/v3/pages/site-pages/${sp.id}/draft/push-live`, { method: "POST", body: {} });
          result.created.push({ type: "publish:site_page", name: sp.name || sp.id, id: sp.id });
        } catch { /* ignore publish failure */ }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  try {
    const lpList = await client.request("/cms/v3/pages/landing-pages?limit=5") as { results?: Array<{ id?: string; name?: string }> };
    for (const lp of lpList.results?.slice(0, 2) ?? []) {
      if (!lp.id) continue;
      try {
        await client.request(`/cms/v3/pages/landing-pages/${lp.id}/draft`, {
          method: "PATCH",
          body: { metaDescription: `Revised by hscli seed at ${nowIso()}` },
        });
        result.created.push({ type: "revision:landing_page", name: lp.name || lp.id, id: lp.id });
        try {
          await client.request(`/cms/v3/pages/landing-pages/${lp.id}/draft/push-live`, { method: "POST", body: {} });
          result.created.push({ type: "publish:landing_page", name: lp.name || lp.id, id: lp.id });
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // --- Attempt to create a blog (requires a connected domain) ---
  try {
    const existingBlogs = await client.request("/cms/v3/blogs/posts?limit=1") as { results?: Array<{ contentGroupId?: string }> };
    if (!existingBlogs.results?.[0]?.contentGroupId) {
      try {
        await client.request("/content/api/v2/blogs", {
          method: "POST",
          body: { name: `HubCLI Seed Blog ${runSuffix}`, slug: `hscli-seed-blog-${runSuffix}` },
        });
        result.created.push({ type: "blog", name: `HubCLI Seed Blog ${runSuffix}`, id: "new" });
      } catch (err) {
        const reason = errorReason(err).includes(":403")
          ? "no connected domain (connect one in HubSpot Settings → Website → Domains first)"
          : errorReason(err);
        result.skipped.push({ type: "blog", name: "HubCLI Seed Blog", reason });
        result.tips.push("Blog creation requires a connected domain. Go to HubSpot Settings → Website → Domains & URLs → Connect a domain, then re-run hscli seed to create a blog + blog posts automatically.");
      }
    }
  } catch { /* ignore */ }
}
