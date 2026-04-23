/**
 * Raw HubSpot API passthrough — `hscli api request` for endpoints without a dedicated subcommand.
 */
import { Command } from "commander";
import { createClient } from "../../core/http.js";
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
    .action(async (opts) => {
      const ctx = getCtx();
      const client = createClient(ctx.profile);
      const method = parseMethod(opts.method);
      const path = String(opts.path).trim();
      const body = opts.data !== undefined ? parseJsonPayload(opts.data) : undefined;

      if (method === "GET" && body !== undefined) {
        throw new CliError("INVALID_GET_BODY", "GET requests do not accept --data");
      }

      const res = WRITE_METHODS.has(method)
        ? await maybeWrite(ctx, client, method as "POST" | "PATCH" | "PUT" | "DELETE", path, body)
        : await client.request(path, body !== undefined ? { method, body } : { method });

      printResult(ctx, res);
    });
}
