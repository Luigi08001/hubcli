import { existsSync, readFileSync } from "node:fs";
import type { CliContext } from "./output.js";
import { CliError } from "./output.js";

interface PolicyRule {
  allowWrite?: boolean;
  allowDelete?: boolean;
  requireChangeTicket?: boolean;
}

interface PolicyConfig {
  defaults?: PolicyRule;
  profiles?: Record<string, PolicyRule>;
  blockedMethodPathPrefixes?: Record<string, string[]>;
}

function readPolicyFile(path: string): PolicyConfig {
  if (!existsSync(path)) {
    throw new CliError("POLICY_FILE_NOT_FOUND", `Policy file not found: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PolicyConfig;
  } catch {
    throw new CliError("POLICY_INVALID_JSON", `Invalid policy JSON: ${path}`);
  }
}

export function enforceWritePolicy(ctx: CliContext, method: "POST" | "PATCH" | "PUT" | "DELETE", path: string): void {
  const policyPath = ctx.policyFile?.trim() || process.env.HUBCLI_POLICY_FILE?.trim();
  if (!policyPath) return;

  const config = readPolicyFile(policyPath);
  const profileRule: PolicyRule = config.profiles?.[ctx.profile] ?? {};
  const defaults: PolicyRule = config.defaults ?? {};
  const allowWrite = profileRule.allowWrite ?? defaults.allowWrite ?? true;
  const allowDelete = profileRule.allowDelete ?? defaults.allowDelete ?? false;
  const requireChangeTicket = profileRule.requireChangeTicket ?? defaults.requireChangeTicket ?? false;

  if (!allowWrite) {
    throw new CliError("POLICY_WRITE_BLOCKED", `Policy blocks write operations for profile '${ctx.profile}'.`);
  }
  if (method === "DELETE" && !allowDelete) {
    throw new CliError("POLICY_DELETE_BLOCKED", `Policy blocks delete operations for profile '${ctx.profile}'.`);
  }
  if (requireChangeTicket && !ctx.changeTicket?.trim()) {
    throw new CliError("POLICY_CHANGE_TICKET_REQUIRED", `Profile '${ctx.profile}' requires --change-ticket for write operations.`);
  }

  const blockedPrefixes = config.blockedMethodPathPrefixes?.[method] ?? [];
  if (blockedPrefixes.some((prefix) => path.startsWith(prefix))) {
    throw new CliError("POLICY_PATH_BLOCKED", `Policy blocks ${method} on path '${path}'.`);
  }
}
