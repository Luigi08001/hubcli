/**
 * Per-invocation telemetry context.
 *
 * The MCP wrapper sets `toolName` at handler entry so trace/audit events can be
 * attributed to the specific MCP tool that triggered the HTTP call.
 * `changeTicket` is populated once the CLI/MCP layer has parsed it from args
 * or env, so every subsequent request in the same async chain is tagged with
 * the ops ticket for audit queries. Using AsyncLocalStorage (not process.env)
 * because concurrent MCP invocations would otherwise race on a process-global
 * env var and mis-attribute telemetry.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface TelemetryContext {
  toolName?: string;
  changeTicket?: string;
}

const store = new AsyncLocalStorage<TelemetryContext>();

export function runWithTelemetryContext<T>(ctx: TelemetryContext, fn: () => T): T {
  return store.run(ctx, fn);
}

/**
 * Extend the active telemetry context with additional fields (e.g. a
 * changeTicket parsed from args after the outer toolName scope was set).
 * Fields already present on the outer context are preserved unless
 * overridden in `extra`.
 */
export function withTelemetryContext<T>(extra: TelemetryContext, fn: () => T): T {
  const current = store.getStore() ?? {};
  return store.run({ ...current, ...extra }, fn);
}

export function getTelemetryContext(): TelemetryContext | undefined {
  return store.getStore();
}
