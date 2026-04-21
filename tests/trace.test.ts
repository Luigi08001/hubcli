import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function setupHome(): { home: string; hscliHome: string } {
  const home = mkdtempSync(join(tmpdir(), "hscli-trace-"));
  const hscliHome = join(home, ".revfleet");
  mkdirSync(hscliHome, { recursive: true });
  writeFileSync(
    join(hscliHome, "auth.json"),
    JSON.stringify({ profiles: { default: { token: "t" } } }),
  );
  process.env.HOME = home;
  process.env.HSCLI_HOME = hscliHome;
  return { home, hscliHome };
}

function sessionPath(hscliHome: string): string {
  return join(hscliHome, "trace-session.json");
}

function writeJsonl(path: string, events: unknown[]): void {
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  writeFileSync(path, lines, "utf8");
}

function parseOutput(output: string): Record<string, unknown> {
  const parsed = JSON.parse(output) as { data?: Record<string, unknown> };
  return (parsed.data ?? parsed) as Record<string, unknown>;
}

describe("trace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_PROFILE;
  });

  // ────────────────────────────────────────────
  // trace start / stop / status
  // ────────────────────────────────────────────

  it("trace start creates the session file", async () => {
    const { hscliHome } = setupHome();
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "start"]);

    expect(existsSync(sessionPath(hscliHome))).toBe(true);
    const session = JSON.parse(readFileSync(sessionPath(hscliHome), "utf8"));
    expect(session.file).toMatch(/trace-.*\.jsonl$/);
    expect(session.scope).toBe("all");
    expect(session.includeBodies).toBe(false);
  });

  it("trace start --out + --include-bodies + --scope persisted", async () => {
    const { hscliHome } = setupHome();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const outFile = join(hscliHome, "custom.jsonl");

    const { run } = await import("../src/cli.js");
    await run([
      "node", "hscli", "--json",
      "trace", "start",
      "--out", outFile,
      "--include-bodies",
      "--scope", "write",
    ]);

    const session = JSON.parse(readFileSync(sessionPath(hscliHome), "utf8"));
    expect(session.file).toBe(outFile);
    expect(session.includeBodies).toBe(true);
    expect(session.scope).toBe("write");
  });

  it("trace start refuses when a session is already active", async () => {
    const { hscliHome } = setupHome();
    writeFileSync(sessionPath(hscliHome), JSON.stringify({
      file: "/tmp/t.jsonl", startedAt: new Date().toISOString(), includeBodies: false, scope: "all",
    }));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "start"]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("TRACE_ALREADY_ACTIVE"))).toBe(true);
  });

  it("trace stop removes session file and reports stats", async () => {
    const { hscliHome } = setupHome();
    const traceFile = join(hscliHome, "t.jsonl");
    writeJsonl(traceFile, [
      { ts: "2026-04-20T10:00:00Z", method: "GET", path: "/x", status: 200 },
      { ts: "2026-04-20T10:00:01Z", method: "POST", path: "/y", status: 201 },
    ]);
    writeFileSync(sessionPath(hscliHome), JSON.stringify({
      file: traceFile, startedAt: "2026-04-20T09:59:00Z", includeBodies: false, scope: "all",
    }));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "stop"]);

    expect(existsSync(sessionPath(hscliHome))).toBe(false);
    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0]));
    expect(data.stopped).toBe(true);
    expect(data.eventCount).toBe(2);
    expect(data.file).toBe(traceFile);
  });

  it("trace stop errors when no active session", async () => {
    setupHome();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "stop"]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("TRACE_NOT_ACTIVE"))).toBe(true);
  });

  it("trace status — active vs inactive", async () => {
    const { hscliHome } = setupHome();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "status"]);
    const inactive = parseOutput(String(logSpy.mock.calls.at(-1)![0]));
    expect(inactive.active).toBe(false);

    writeFileSync(sessionPath(hscliHome), JSON.stringify({
      file: join(hscliHome, "t.jsonl"), startedAt: new Date().toISOString(), includeBodies: false, scope: "all",
    }));
    writeFileSync(join(hscliHome, "t.jsonl"), "");
    logSpy.mockClear();

    vi.resetModules();
    const mod2 = await import("../src/cli.js");
    await mod2.run(["node", "hscli", "--json", "trace", "status"]);
    const active = parseOutput(String(logSpy.mock.calls.at(-1)![0]));
    expect(active.active).toBe(true);
  });

  // ────────────────────────────────────────────
  // trace show + filter operators
  // ────────────────────────────────────────────

  it("trace show reads JSONL and computes summary", async () => {
    const { hscliHome } = setupHome();
    const traceFile = join(hscliHome, "t.jsonl");
    writeJsonl(traceFile, [
      { ts: "2026-04-20T10:00:00Z", method: "GET", path: "/a", status: 200, durationMs: 50 },
      { ts: "2026-04-20T10:00:01Z", method: "GET", path: "/b", status: 200, durationMs: 150 },
      { ts: "2026-04-20T10:00:02Z", method: "POST", path: "/c", status: 500, durationMs: 90, error: "boom" },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "show", traceFile]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      summary: { totalEvents: number; errorCount: number; methodBreakdown: Record<string, number> };
    };
    expect(data.summary.totalEvents).toBe(3);
    expect(data.summary.errorCount).toBe(1);
    expect(data.summary.methodBreakdown.GET).toBe(2);
    expect(data.summary.methodBreakdown.POST).toBe(1);
  });

  it("trace show --filter status=>=400 keeps only errors", async () => {
    const { hscliHome } = setupHome();
    const traceFile = join(hscliHome, "t.jsonl");
    writeJsonl(traceFile, [
      { method: "GET", path: "/ok", status: 200 },
      { method: "GET", path: "/not-found", status: 404 },
      { method: "POST", path: "/boom", status: 500 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "show", traceFile, "--filter", "status=>=400"]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      summary: { matchingEvents: number };
    };
    expect(data.summary.matchingEvents).toBe(2);
  });

  it("trace show --filter method=POST,status=!200", async () => {
    const { hscliHome } = setupHome();
    const traceFile = join(hscliHome, "t.jsonl");
    writeJsonl(traceFile, [
      { method: "GET", path: "/x", status: 200 },
      { method: "POST", path: "/y", status: 200 },
      { method: "POST", path: "/z", status: 500 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "show", traceFile, "--filter", "method=POST,status=!200"]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      summary: { matchingEvents: number };
    };
    expect(data.summary.matchingEvents).toBe(1);
  });

  // ────────────────────────────────────────────
  // trace stats + errors
  // ────────────────────────────────────────────

  it("trace stats computes latency percentiles and write/read counts", async () => {
    const { hscliHome } = setupHome();
    const traceFile = join(hscliHome, "t.jsonl");
    writeJsonl(traceFile, [
      { method: "GET", status: 200, durationMs: 10 },
      { method: "GET", status: 200, durationMs: 50 },
      { method: "POST", status: 201, durationMs: 200 },
      { method: "DELETE", status: 500, durationMs: 30, error: "fail" },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "stats", traceFile]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      totalEvents: number;
      writeOps: number;
      readOps: number;
      errors: number;
      latency: { maxMs: number };
    };
    expect(data.totalEvents).toBe(4);
    expect(data.writeOps).toBe(2);
    expect(data.readOps).toBe(2);
    expect(data.errors).toBe(1);
    expect(data.latency.maxMs).toBe(200);
  });

  it("trace errors extracts only error events", async () => {
    const { hscliHome } = setupHome();
    const traceFile = join(hscliHome, "t.jsonl");
    writeJsonl(traceFile, [
      { method: "GET", status: 200 },
      { method: "GET", status: 404 },
      { method: "POST", status: 500, error: "boom" },
      { method: "GET", status: 200 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "errors", traceFile]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      totalErrors: number;
    };
    expect(data.totalErrors).toBe(2);
  });

  // ────────────────────────────────────────────
  // trace diff
  // ────────────────────────────────────────────

  it("trace diff detects onlyInA / onlyInB / statusChanges", async () => {
    const { hscliHome } = setupHome();
    const a = join(hscliHome, "a.jsonl");
    const b = join(hscliHome, "b.jsonl");
    writeJsonl(a, [
      { method: "GET", path: "/x", status: 200 },
      { method: "POST", path: "/y", status: 201 },
    ]);
    writeJsonl(b, [
      { method: "GET", path: "/x", status: 500 },   // same key, different status
      { method: "DELETE", path: "/z", status: 204 }, // only in B
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "diff", a, b]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      divergent: boolean;
      onlyInA: string[];
      onlyInB: string[];
      statusChanges: Array<{ key: string }>;
    };
    expect(data.divergent).toBe(true);
    expect(data.onlyInA).toContain("POST /y");
    expect(data.onlyInB).toContain("DELETE /z");
    expect(data.statusChanges.some((s) => s.key === "GET /x")).toBe(true);
  });

  it("trace diff normalizes numeric path segments to /{id}", async () => {
    const { hscliHome } = setupHome();
    const a = join(hscliHome, "a.jsonl");
    const b = join(hscliHome, "b.jsonl");
    writeJsonl(a, [{ method: "GET", path: "/crm/v3/objects/contacts/123", status: 200 }]);
    writeJsonl(b, [{ method: "GET", path: "/crm/v3/objects/contacts/456", status: 200 }]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "diff", a, b]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      divergent: boolean;
    };
    expect(data.divergent).toBe(false);
  });

  // ────────────────────────────────────────────
  // trace replay
  // ────────────────────────────────────────────

  it("trace replay defaults to dry-run and excludes writes", async () => {
    const { hscliHome } = setupHome();
    const traceFile = join(hscliHome, "t.jsonl");
    writeJsonl(traceFile, [
      { method: "GET", path: "/crm/v3/objects/contacts" },
      { method: "GET", path: "/crm/v3/objects/deals" },
      { method: "POST", path: "/crm/v3/objects/contacts" },
      { method: "DELETE", path: "/crm/v3/objects/contacts/1" },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "replay", traceFile]);

    expect(fetchSpy).not.toHaveBeenCalled();
    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      dryRun: boolean;
      wouldReplay: number;
      skippedWrites: number;
    };
    expect(data.dryRun).toBe(true);
    expect(data.wouldReplay).toBe(2);
    expect(data.skippedWrites).toBe(2);
  });

  it("trace show errors on missing file", async () => {
    setupHome();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "show", "/tmp/does-not-exist-" + Date.now()]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("TRACE_FILE_NOT_FOUND"))).toBe(true);
  });

  it("trace show skips malformed JSONL lines", async () => {
    const { hscliHome } = setupHome();
    const traceFile = join(hscliHome, "t.jsonl");
    writeFileSync(traceFile, [
      JSON.stringify({ method: "GET", status: 200 }),
      "not-json-garbage",
      "",
      JSON.stringify({ method: "POST", status: 201 }),
    ].join("\n"), "utf8");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "trace", "show", traceFile]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      summary: { totalEvents: number };
    };
    expect(data.summary.totalEvents).toBe(2);
  });
});
