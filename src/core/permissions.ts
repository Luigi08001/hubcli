import { getProfile } from "./auth.js";
import { CliError } from "./output.js";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Check if the given profile is configured as read-only.
 */
export function isReadOnlyProfile(profile: string): boolean {
  try {
    const data = getProfile(profile);
    return data.mode === "read-only";
  } catch {
    return false;
  }
}

/**
 * Enforce permission profile before executing an HTTP request.
 * Throws if the profile is read-only and the method is a write operation.
 */
export function enforcePermissionProfile(profile: string, method: string): void {
  if (!WRITE_METHODS.has(method)) return;
  if (!isReadOnlyProfile(profile)) return;

  throw new CliError(
    "PERMISSION_DENIED",
    `Profile '${profile}' is configured as read-only. Write operations (${method}) are not allowed. Use 'hubcli auth set-mode ${profile} read-write' to enable writes.`,
  );
}
