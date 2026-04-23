/**
 * Raw HubSpot API passthrough — `hscli api request` for endpoints without a dedicated subcommand.
 */
import { Command } from "commander";
import { createClient } from "../../core/http.js";
import type { MultipartPart } from "../../core/http.js";
import type { CliContext } from "../../core/output.js";
import { CliError, printResult } from "../../core/output.js";
import { maybeWrite, parseJsonPayload } from "../crm/shared.js";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);

function parseMethod(raw: string): "GET" | "POST" | "PATCH" | "PUT" | "DELETE" {
  const method = raw.trim().toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new CliError("INVALID_METHOD", "method must be one of GET, POST, PATCH, PUT, DELETE");
  }
  return method as "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
}

export function registerApi(program: Command, getCtx: () => CliContext): void {
  const api = program.command("api").description("Raw HubSpot API access with safety controls");

  api
    .command("request")
    .requiredOption("--path <path>", "HubSpot API path (must start with /)")
    .option("--method <method>", "HTTP method", "GET")
    .option("--data <payload>", "JSON payload for write/read body")
    .option(
      "--raw-body <body>",
      "Raw body string (sent verbatim, no JSON serialization). Use with --content-type.",
    )
    .option(
      "--content-type <type>",
      "Content-Type header. Defaults to application/json. Required for non-JSON bodies (e.g. text/plain for CMS source-code uploads).",
    )
    .option(
      "--file <field=path>",
      "Attach a local file as a multipart field. Repeatable. " +
        "Format: <fieldName>=<localPath>[:<contentType>]. Example: --file file=./theme.html:text/html",
      (value: string, previous: Array<[string, string, string | undefined]> = []) => {
        const [fieldName, rest] = value.split("=", 2);
        if (!fieldName || !rest) throw new CliError("INVALID_FILE", "--file must be <field>=<path>[:<contentType>]");
        const lastColon = rest.lastIndexOf(":");
        let pathPart = rest;
        let ctype: string | undefined;
        // Content-type suffix is optional; only treat last colon as
        // separator when the suffix looks like a MIME (contains `/`).
        if (lastColon > 0 && rest.slice(lastColon + 1).includes("/")) {
          pathPart = rest.slice(0, lastColon);
          ctype = rest.slice(lastColon + 1);
        }
        return [...previous, [fieldName, pathPart, ctype]] as Array<[string, string, string | undefined]>;
      },
    )
    .option(
      "--part <field=value>",
      "Attach a text field to the multipart body. Repeatable. Format: <fieldName>=<value>. " +
        "Use --part for JSON sub-objects — pass the JSON as the <value> string.",
      (value: string, previous: Array<[string, string]> = []) => {
        const [fieldName, ...rest] = value.split("=");
        if (!fieldName || rest.length === 0) throw new CliError("INVALID_PART", "--part must be <field>=<value>");
        return [...previous, [fieldName, rest.join("=")]] as Array<[string, string]>;
      },
    )
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const method = parseMethod(opts.method);
      const path = String(opts.path).trim();

      const fileFlags: Array<[string, string, string | undefined]> = opts.file ?? [];
      const partFlags: Array<[string, string]> = opts.part ?? [];
      const hasMultipart = fileFlags.length > 0 || partFlags.length > 0;

      if (opts.data !== undefined && opts.rawBody !== undefined) {
        throw new CliError("INVALID_BODY", "--data and --raw-body cannot be combined");
      }
      if (hasMultipart && (opts.data !== undefined || opts.rawBody !== undefined)) {
        throw new CliError("INVALID_BODY", "--file/--part cannot be combined with --data or --raw-body");
      }

      const body = opts.data !== undefined ? parseJsonPayload(opts.data) : undefined;
      const rawBody: string | undefined = opts.rawBody !== undefined ? String(opts.rawBody) : undefined;
      const contentType: string | undefined =
        opts.contentType !== undefined ? String(opts.contentType).trim() : undefined;
      const multipart: Record<string, MultipartPart> | undefined = hasMultipart
        ? Object.fromEntries<MultipartPart>([
            ...partFlags.map(([name, value]) => [name, value] as const),
            ...fileFlags.map(([name, filePath, ctype]) => [
              name,
              { path: filePath, contentType: ctype } as MultipartPart,
            ] as const),
          ])
        : undefined;

      if (method === "GET" && (body !== undefined || rawBody !== undefined || hasMultipart)) {
        throw new CliError("INVALID_GET_BODY", "GET requests do not accept --data, --raw-body, --file, or --part");
      }

      const requestOptions: {
        method: typeof method;
        body?: unknown;
        rawBody?: string;
        contentType?: string;
        multipart?: Record<string, MultipartPart>;
      } = { method };
      if (body !== undefined) requestOptions.body = body;
      if (rawBody !== undefined) requestOptions.rawBody = rawBody;
      if (contentType !== undefined) requestOptions.contentType = contentType;
      if (multipart !== undefined) requestOptions.multipart = multipart;

      const res = WRITE_METHODS.has(method)
        ? await maybeWrite(
            ctx,
            client,
            method as "POST" | "PATCH" | "PUT" | "DELETE",
            path,
            body,
            { rawBody, contentType, multipart },
          )
        : await client.request(path, requestOptions);

      printResult(ctx, res);
    });
}
