import { Command } from "commander";
import type { CliContext } from "../../core/output.js";
import { registerResource } from "../domains/shared.js";

export function registerCms(program: Command, getCtx: () => CliContext): void {
  const cms = program.command("cms").description("HubSpot CMS APIs");

  registerResource(cms, getCtx, {
    name: "pages",
    description: "Website pages",
    listPath: "/cms/v3/pages/site-pages",
    itemPath: (id) => `/cms/v3/pages/site-pages/${id}`,
    createPath: "/cms/v3/pages/site-pages",
    updatePath: (id) => `/cms/v3/pages/site-pages/${id}`,
    deletePath: (id) => `/cms/v3/pages/site-pages/${id}`,
  });

  registerResource(cms, getCtx, {
    name: "blogs",
    description: "Blog posts",
    listPath: "/cms/v3/blogs/posts",
    itemPath: (id) => `/cms/v3/blogs/posts/${id}`,
    createPath: "/cms/v3/blogs/posts",
    updatePath: (id) => `/cms/v3/blogs/posts/${id}`,
    deletePath: (id) => `/cms/v3/blogs/posts/${id}`,
  });
}
