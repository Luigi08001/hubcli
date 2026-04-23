/**
 * Output layer — printResult / printError, JSON / table / CSV / YAML formatting, secret redaction.
 */
export type OutputMode = "human" | "json";
export type OutputFormat = "json" | "table" | "csv" | "yaml";

export interface CliContext {
  profile: string;
  json: boolean;
  dryRun: boolean;
  force: boolean;
  strictCapabilities?: boolean;
  format?: OutputFormat;
  policyFile?: string;
  changeTicket?: string;
  runId?: string;
  telemetryFile?: string;
}

export class CliError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

const SENSITIVE_KEYWORDS = ["token", "authorization", "api_key", "apikey", "secret", "password", "privateapp"];
const BEARER_PATTERN = /bearer\s+[a-z0-9._~+/\-=]+/gi;
const HUBSPOT_PRIVATE_APP_TOKEN_PATTERN = /\bpat-[a-z0-9-]{10,}\b/gi;
const SECRET_ASSIGNMENT_PATTERNS = [
  /((?:^|[\s?&,;])(?:token|access_token|refresh_token|api[_-]?key|apikey|secret|password|privateapp)\s*=\s*)([^\s&;,]+)/gi,
  /((?:token|access_token|refresh_token|api[_-]?key|apikey|secret|password|privateapp)\s*:\s*)([^\s,;]+)/gi,
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEYWORDS.some((k) => normalized.includes(k));
}

function redactString(value: string): string {
  let redacted = value.replace(BEARER_PATTERN, "Bearer [REDACTED]");
  for (const pattern of SECRET_ASSIGNMENT_PATTERNS) {
    redacted = redacted.replace(pattern, (_match, prefix) => `${prefix}[REDACTED]`);
  }
  redacted = redacted.replace(HUBSPOT_PRIVATE_APP_TOKEN_PATTERN, "[REDACTED]");
  return redacted;
}

export function redactSensitive<T>(input: T): T {
  if (input === null || input === undefined) return input;

  if (typeof input === "string") {
    return redactString(input) as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item)) as T;
  }

  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = redactSensitive(value);
      }
    }
    return out as T;
  }

  return input;
}

export function printResult(ctx: CliContext, data: unknown): void {
  const safeData = redactSensitive(data);
  const selectedFormat = ctx.json ? "json" : (ctx.format ?? "table");

  if (selectedFormat === "json") {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, data: safeData }, null, 2));
    return;
  }
  if (selectedFormat === "csv") {
    // eslint-disable-next-line no-console
    console.log(toCsv(safeData));
    return;
  }
  if (selectedFormat === "yaml") {
    // eslint-disable-next-line no-console
    console.log(toYaml(safeData));
    return;
  }
  // eslint-disable-next-line no-console
  console.log(toTable(safeData));
}

export function printError(ctx: CliContext, err: unknown): void {
  const e = err instanceof CliError
    ? err
    : new CliError("UNEXPECTED_ERROR", err instanceof Error ? err.message : String(err));

  const safeMessage = redactSensitive(e.message);
  const safeDetails = redactSensitive(e.details);

  const selectedFormat = ctx.json ? "json" : (ctx.format ?? "table");

  if (selectedFormat === "json") {
    console.error(JSON.stringify({ ok: false, error: { code: e.code, message: safeMessage, status: e.status, details: safeDetails } }, null, 2));
  } else {
    console.error(`[${e.code}] ${safeMessage}`);
    if (e.status) console.error(`status=${e.status}`);
    if (safeDetails) console.error(JSON.stringify(safeDetails, null, 2));
  }
}

function toTabularRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data
      .filter((item) => item && typeof item === "object" && !Array.isArray(item))
      .map((item) => item as Record<string, unknown>);
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.results)) {
      return record.results
        .filter((item) => item && typeof item === "object" && !Array.isArray(item))
        .map((item) => item as Record<string, unknown>);
    }
    return [record];
  }
  return [{ value: data }];
}

function toCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function toTable(data: unknown): string {
  if (typeof data === "string") return data;
  const rows = toTabularRows(data);
  if (rows.length === 0) return "(empty)";

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  if (headers.length === 0) return "(empty)";

  const widths = headers.map((header) => {
    const maxCell = Math.max(...rows.map((row) => toCell(row[header]).length), 0);
    return Math.max(header.length, maxCell);
  });

  const headerLine = headers.map((header, index) => header.padEnd(widths[index])).join(" | ");
  const dividerLine = widths.map((width) => "-".repeat(width)).join("-|-");
  const bodyLines = rows.map((row) => (
    headers.map((header, index) => toCell(row[header]).padEnd(widths[index])).join(" | ")
  ));
  return [headerLine, dividerLine, ...bodyLines].join("\n");
}

function toCsv(data: unknown): string {
  const rows = toTabularRows(data);
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  if (headers.length === 0) return "";

  const escape = (value: string): string => {
    if (!value.includes("\"") && !value.includes(",") && !value.includes("\n")) return value;
    return `"${value.replace(/"/g, "\"\"")}"`;
  };

  const lines = [
    headers.map((header) => escape(header)).join(","),
    ...rows.map((row) => headers.map((header) => escape(toCell(row[header]))).join(",")),
  ];
  return lines.join("\n");
}

function toYaml(data: unknown, indent = 0): string {
  const spacing = " ".repeat(indent);
  if (data === null) return "null";
  if (data === undefined) return "null";
  if (typeof data === "number" || typeof data === "boolean") return String(data);
  if (typeof data === "string") return formatYamlString(data);

  if (Array.isArray(data)) {
    if (data.length === 0) return "[]";
    return data.map((item) => {
      if (isScalar(item)) return `${spacing}- ${toYaml(item, indent + 2)}`;
      const nested = toYaml(item, indent + 2);
      return `${spacing}-\n${nested}`;
    }).join("\n");
  }

  const record = data as Record<string, unknown>;
  const entries = Object.entries(record);
  if (entries.length === 0) return "{}";

  return entries.map(([key, value]) => {
    const safeKey = /^[a-zA-Z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
    if (isScalar(value)) {
      return `${spacing}${safeKey}: ${toYaml(value, indent + 2)}`;
    }
    return `${spacing}${safeKey}:\n${toYaml(value, indent + 2)}`;
  }).join("\n");
}

function isScalar(value: unknown): boolean {
  return value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function formatYamlString(value: string): string {
  if (value === "") return "\"\"";
  if (/^[a-zA-Z0-9_./-]+$/.test(value)) return value;
  return JSON.stringify(value);
}
