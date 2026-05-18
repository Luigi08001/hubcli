import { describe, expect, it } from "vitest";
import { seedCms } from "../src/commands/seed/cms.js";
import type { HubSpotClient } from "../src/core/http.js";
import type { SeedContext, SeedResult } from "../src/commands/seed/types.js";

describe("seed CMS", () => {
  it("only revises and publishes pages created by the current seed run", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const client = {
      async request(path: string, init?: { method?: string; body?: unknown }) {
        calls.push({ path, method: init?.method });
        if (path === "/cms/v3/pages/site-pages" && init?.method === "POST") return { id: "new-site" };
        if (path === "/cms/v3/pages/landing-pages" && init?.method === "POST") return { id: "new-landing" };
        if (path === "/cms/v3/blogs/posts?limit=1") return { results: [] };
        if (path === "/cms/v3/blogs/authors" && init?.method === "POST") return { id: "author-1" };
        if (path === "/cms/v3/blogs/tags" && init?.method === "POST") return { id: "tag-1" };
        if (path === "/cms/v3/hubdb/tables" && init?.method === "POST") return { id: "table-1" };
        if (path === "/cms/v3/hubdb/tables/table-1/rows/draft/batch/create" && init?.method === "POST") return { id: "row-1" };
        if (path === "/cms/v3/pages/site-pages?limit=5") return { results: [{ id: "existing-site", name: "Live site page" }] };
        if (path === "/cms/v3/pages/landing-pages?limit=5") return { results: [{ id: "existing-landing", name: "Live landing page" }] };
        return { id: "ok" };
      },
    } as unknown as HubSpotClient;
    const result: SeedResult = { created: [], associations: [], skipped: [], tips: [] };
    const ctx = {
      client,
      runSuffix: "abc",
      cliCtx: { profile: "default", json: true, dryRun: false, force: true },
      portal: null,
      customSchemas: [],
      contactIds: [],
      companyIds: [],
      dealIds: [],
      ticketIds: [],
      productIds: [],
      recordUrl: () => undefined,
    } satisfies SeedContext;

    await seedCms(ctx, result);

    const paths = calls.map((call) => call.path);
    expect(paths).toContain("/cms/v3/pages/site-pages/new-site/draft");
    expect(paths).toContain("/cms/v3/pages/site-pages/new-site/draft/push-live");
    expect(paths).toContain("/cms/v3/pages/landing-pages/new-landing/draft");
    expect(paths).toContain("/cms/v3/pages/landing-pages/new-landing/draft/push-live");
    expect(paths.some((path) => path.includes("existing-site"))).toBe(false);
    expect(paths.some((path) => path.includes("existing-landing"))).toBe(false);
  });
});
