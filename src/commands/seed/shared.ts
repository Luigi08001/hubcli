import type { HubSpotClient } from "../../core/http.js";
import { CliError } from "../../core/output.js";

export async function safeCreate(client: HubSpotClient, path: string, body: unknown): Promise<{ id: string } | null> {
  try {
    const res = await client.request(path, { method: "POST", body }) as { id?: string };
    if (res?.id) return { id: res.id };
    return null;
  } catch (err) {
    if (err instanceof CliError && err.status === 409) return null;
    throw err;
  }
}

export async function safeAssociate(client: HubSpotClient, fromType: string, fromId: string, toType: string, toId: string): Promise<string> {
  try {
    await client.request(
      `/crm/v4/objects/${fromType}/${fromId}/associations/default/${toType}/${toId}`,
      { method: "PUT" },
    );
    return "ok";
  } catch (err) {
    if (err instanceof CliError && err.status === 400) return "no_default_association";
    throw err;
  }
}

export function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function errorReason(err: unknown): string {
  return err instanceof CliError ? `${err.code}:${err.status}` : "error";
}
