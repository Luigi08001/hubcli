/**
 * MCP tools for HubSpot's drag-and-drop module library.
 *
 * Three tools:
 *   - `hubspot_module_list`       — inventory of `@hubspot/*` modules
 *                                   accessible on the caller's portal.
 *   - `hubspot_module_describe`   — fetch + return a module's
 *                                   `fields.json` schema: field names,
 *                                   types, defaults, nested children,
 *                                   choices. This is what a HubSpot
 *                                   drag-and-drop user sees when they
 *                                   select the module in the editor.
 *   - `hubspot_module_compose`    — given a module path and a field
 *                                   value map, return a widget body
 *                                   shaped for inclusion in a marketing
 *                                   email or CMS page's `widgets` dict
 *                                   under `flexAreas`/`layoutSections`.
 *                                   Rejects unknown fields + type
 *                                   mismatches *before* the widget is
 *                                   posted back to HubSpot.
 *
 * Design rationale: auto-generating 55 per-module MCP tools would bloat
 * the tool listing and force eager fetches of every schema at startup.
 * A single dynamic tool accepting the module path mirrors how a UI user
 * actually works — browse the palette, select a module, fill the fields.
 * Agents get full schema awareness on demand without paying for it up
 * front.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HubSpotClient } from "../core/http.js";
import { getToken } from "../core/auth.js";
import type { McpBaseArgs } from "./server.js";
import { resolveProfile, registerMcpTool, baseArgsSchema } from "./server.js";

/**
 * The wordlist is the same as `hscli cms source-code list-modules` uses.
 * Drawn from HubSpot's developer docs + the email/web modules split
 * changelog + live verification on a Content Hub portal (2026-04-23:
 * 55 of 68 probed names respond on this portal).
 */
const KNOWN_HUBSPOT_MODULES = [
  // Universal + web
  "rich_text", "text", "header", "section_header", "button", "cta",
  "divider", "horizontal_spacer", "form", "icon", "linked_image",
  "image_grid", "gallery", "image_slider_gallery", "logo", "logo_grid",
  "video", "menu", "simple_menu", "language_switcher", "social_sharing",
  "social_follow", "page_footer", "meetings", "payments", "product",
  "whatsapp_link",
  // Blog
  "blog_content", "blog_subscribe", "blog_comments", "post_filter",
  "post_listing", "rss_listing", "blog_posts",
  // System
  "search_input", "search_results", "password_prompt",
  "membership_social_logins",
  // Email-specific
  "email_header", "email_footer", "email_cta", "email_text",
  "email_section_header", "email_linked_image", "email_logo",
  "email_post_filter", "email_post_listing", "email_social_sharing",
  "email_subscriptions", "email_subscriptions_confirmation",
  "email_simple_subscription", "email_body", "raw_html_email",
  "email_can_spam", "image_email", "video_email", "one_line_of_text",
  "view_as_web_page", "whitespace", "spacer", "follow_me",
  "rss_email", "product_markdown",
  // Legacy quotes
  "quote_download", "quote_payment", "quote_signature", "line_items",
];

const MODULE_IDS: Record<string, number> = {
  // Hard-coded well-known module_ids that HubSpot's widget renderer
  // requires for legacy modules. These aren't exposed by fields.json;
  // discovered via inspection of existing portal emails.
  rich_text: 1155639,
  email_footer: 2869621,
};

interface ModuleField {
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  default?: unknown;
  choices?: Array<[string, string]>;
  children?: ModuleField[];
}

function cmsModulePath(modulePath: string): string {
  // `@hubspot/button` → `@hubspot/button.module/fields.json`
  const stripped = modulePath.replace(/^@hubspot\//, "");
  return `@hubspot/${stripped}.module/fields.json`;
}

async function fetchModuleSchema(
  profile: string,
  modulePath: string,
  environment = "published",
): Promise<ModuleField[]> {
  const client = new HubSpotClient(getToken(profile));
  const encoded = cmsModulePath(modulePath)
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  const res = (await client.request(
    `/cms/v3/source-code/${encodeURIComponent(environment)}/content/${encoded}`,
  )) as ModuleField[] | { message?: string };
  if (Array.isArray(res)) return res;
  // Some responses wrap the JSON in a `message` string.
  if (typeof res === "object" && res !== null && "message" in res) {
    const body = (res as { message?: string }).message;
    if (typeof body === "string") {
      try {
        return JSON.parse(body) as ModuleField[];
      } catch {
        return [];
      }
    }
  }
  return [];
}

/**
 * Walk a schema and a value map in lock-step. Checks required fields,
 * enum membership, and primitive types. Throws on the first violation
 * with a human-readable message. Returns a shallow-cloned value map
 * with defaults filled in for missing-but-not-required fields.
 */
function validateAgainstSchema(
  fields: ModuleField[],
  values: Record<string, unknown>,
  pathPrefix = "",
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const known = new Set<string>();
  for (const field of fields) {
    if (!field.name) continue;
    known.add(field.name);
    const key = field.name;
    const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    const value = values[key];
    if (value === undefined || value === null) {
      if (field.required) {
        throw new Error(`Missing required field: ${fullPath} (type: ${field.type ?? "unknown"})`);
      }
      if (field.default !== undefined) {
        out[key] = field.default;
      }
      continue;
    }
    // Type check for simple primitives.
    if (field.type === "boolean" && typeof value !== "boolean") {
      throw new Error(`Field ${fullPath} must be boolean, got ${typeof value}`);
    }
    if (field.type === "number" && typeof value !== "number") {
      throw new Error(`Field ${fullPath} must be number, got ${typeof value}`);
    }
    if ((field.type === "text" || field.type === "richtext") && typeof value !== "string") {
      throw new Error(`Field ${fullPath} must be string, got ${typeof value}`);
    }
    if (field.type === "choice" && Array.isArray(field.choices)) {
      const allowed = field.choices.map((c) => c[0]);
      if (!allowed.includes(String(value))) {
        throw new Error(
          `Field ${fullPath} must be one of [${allowed.join(", ")}], got ${String(value)}`,
        );
      }
    }
    if (field.type === "group" && field.children && typeof value === "object" && value !== null) {
      out[key] = validateAgainstSchema(
        field.children,
        value as Record<string, unknown>,
        fullPath,
      );
      continue;
    }
    out[key] = value;
  }
  for (const extra of Object.keys(values)) {
    if (!known.has(extra)) {
      throw new Error(
        `Unknown field: ${pathPrefix ? `${pathPrefix}.` : ""}${extra}. ` +
          `Call \`hubspot_module_describe\` to see the full schema.`,
      );
    }
  }
  return out;
}

/**
 * Build the widget payload HubSpot's email/CMS renderer expects.
 * Returns a widget body ready to drop into
 * `content.widgets[widgetId] = <this>` plus a `flexAreas` section
 * referencing the same `widgetId`.
 */
function buildWidget(
  widgetId: string,
  modulePath: string,
  order: number,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const shortName = modulePath.replace(/^@hubspot\//, "");
  return {
    type: "module",
    name: widgetId,
    id: widgetId,
    module_id: MODULE_IDS[shortName] ?? 0,
    order,
    label: null,
    css: {},
    child_css: {},
    smart_type: null,
    styles: { breakpointStyles: { default: {}, mobile: {} } },
    body: {
      css_class: "dnd-module",
      path: modulePath,
      schema_version: 2,
      lineNumber: 32,
      startPosition: 19,
      parent_widget_container: null,
      ...body,
    },
  };
}

export function registerHubspotModuleTools(server: McpServer): void {
  registerMcpTool(
    server,
    "hubspot_module_list",
    {
      description:
        "Enumerate @hubspot/* built-in drag-and-drop modules available on the " +
        "caller's portal. Each entry reports whether fields.json resolves (i.e. " +
        "whether the module can be used in widgets). Useful for discovery — call " +
        "hubspot_module_describe on any available entry to see its field schema.",
      inputSchema: {
        ...baseArgsSchema,
        environment: z
          .enum(["draft", "published"])
          .optional()
          .describe("CMS source-code environment (default: published)"),
        schemas: z
          .boolean()
          .optional()
          .describe("Include full field schema for each module in the output"),
      },
    },
    async (args: McpBaseArgs & { environment?: "draft" | "published"; schemas?: boolean }) => {
      const profile = resolveProfile(args.profile);
      const environment = args.environment ?? "published";
      const results: Array<{
        modulePath: string;
        available: boolean;
        fieldCount?: number;
        fields?: ModuleField[];
      }> = [];
      for (const name of KNOWN_HUBSPOT_MODULES) {
        try {
          const fields = await fetchModuleSchema(profile, `@hubspot/${name}`, environment);
          results.push({
            modulePath: `@hubspot/${name}`,
            available: true,
            fieldCount: fields.length,
            ...(args.schemas ? { fields } : {}),
          });
        } catch {
          results.push({ modulePath: `@hubspot/${name}`, available: false });
        }
      }
      const available = results.filter((r) => r.available).length;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total: results.length,
                available,
                missing: results.length - available,
                modules: results,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  registerMcpTool(
    server,
    "hubspot_module_describe",
    {
      description:
        "Return the full field schema for a HubSpot drag-and-drop module (the same " +
        "schema a user sees when clicking a module in the editor). Fields include name, " +
        "label, type (text, richtext, number, boolean, color, choice, group, image, " +
        "link, ...), required flag, default, choices, and nested children for groups. " +
        "Call this before hubspot_module_compose to know what fields to pass.",
      inputSchema: {
        ...baseArgsSchema,
        modulePath: z
          .string()
          .regex(/^@hubspot\//, "modulePath must start with @hubspot/")
          .describe("Module path, e.g. @hubspot/button or @hubspot/rich_text"),
        environment: z.enum(["draft", "published"]).optional(),
      },
    },
    async (args: McpBaseArgs & { modulePath: string; environment?: "draft" | "published" }) => {
      const profile = resolveProfile(args.profile);
      const fields = await fetchModuleSchema(
        profile,
        args.modulePath,
        args.environment ?? "published",
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { modulePath: args.modulePath, fieldCount: fields.length, fields },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  registerMcpTool(
    server,
    "hubspot_module_compose",
    {
      description:
        "Compose a widget body for a HubSpot drag-and-drop module using given field " +
        "values. Validates the values against the module's fields.json schema before " +
        "returning — rejects unknown fields and type mismatches. The returned widget " +
        "is ready to drop into an email or CMS page's content.widgets[widgetId], with " +
        "the schema + metadata HubSpot's renderer expects. Use this instead of " +
        "hand-shaping widget bodies.",
      inputSchema: {
        ...baseArgsSchema,
        modulePath: z
          .string()
          .regex(/^@hubspot\//, "modulePath must start with @hubspot/")
          .describe("Module path, e.g. @hubspot/rich_text"),
        widgetId: z
          .string()
          .min(1)
          .describe("Widget key under content.widgets[] (e.g. module-0-0-0)"),
        order: z.number().int().optional().describe("Display order (default: 1)"),
        fields: z
          .record(z.string(), z.unknown())
          .describe(
            "Field values keyed by field name. Call hubspot_module_describe " +
              "first to see the full schema.",
          ),
        environment: z.enum(["draft", "published"]).optional(),
      },
    },
    async (args: McpBaseArgs & {
      modulePath: string;
      widgetId: string;
      order?: number;
      fields: Record<string, unknown>;
      environment?: "draft" | "published";
    }) => {
      const profile = resolveProfile(args.profile);
      const schema = await fetchModuleSchema(
        profile,
        args.modulePath,
        args.environment ?? "published",
      );
      const validatedBody = validateAgainstSchema(schema, args.fields ?? {});
      const widget = buildWidget(args.widgetId, args.modulePath, args.order ?? 1, validatedBody);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                widgetId: args.widgetId,
                modulePath: args.modulePath,
                widget,
                hint:
                  "Insert `widget` under `content.widgets[widgetId]` and reference " +
                  "widgetId from a flexAreas section's columns[].widgets[] array.",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
