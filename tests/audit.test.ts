import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function setupHome(): { home: string; hscliHome: string } {
  const home = mkdtempSync(join(tmpdir(), "hscli-audit-"));
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

function writeJsonl(path: string, events: unknown[]): void {
  const lines = events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  writeFileSync(path, lines, "utf8");
}

function parseOutput(output: string): Record<string, unknown> {
  const parsed = JSON.parse(output) as { data?: Record<string, unknown> };
  return (parsed.data ?? parsed) as Record<string, unknown>;
}

function nowMinusHours(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

describe("audit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_PROFILE;
  });

  // ────────────────────────────────────────────
  // audit timeline
  // ────────────────────────────────────────────

  it("audit timeline scans a directory of trace-*.jsonl", async () => {
    const { hscliHome } = setupHome();
    writeJsonl(join(hscliHome, "trace-1.jsonl"), [
      { ts: "2026-04-20T10:00:00Z", method: "GET", path: "/a", status: 200 },
    ]);
    writeJsonl(join(hscliHome, "trace-2.jsonl"), [
      { ts: "2026-04-20T11:00:00Z", method: "POST", path: "/b", status: 201 },
    ]);
    // non-matching filename ignored
    writeJsonl(join(hscliHome, "other.jsonl"), [
      { ts: "2026-04-20T12:00:00Z", method: "DELETE", path: "/c", status: 204 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "timeline"]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      totalLoaded: number;
      afterFilters: number;
    };
    expect(data.totalLoaded).toBe(2);
    expect(data.afterFilters).toBe(2);
  });

  it("audit timeline --writes-only filters reads", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-w.jsonl");
    writeJsonl(f, [
      { ts: "2026-04-20T10:00:00Z", method: "GET", path: "/r", status: 200 },
      { ts: "2026-04-20T10:01:00Z", method: "POST", path: "/w", status: 201 },
      { ts: "2026-04-20T10:02:00Z", method: "DELETE", path: "/d", status: 204 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "timeline", f, "--writes-only"]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      afterFilters: number;
    };
    expect(data.afterFilters).toBe(2);
  });

  it("audit timeline --since respects the time window", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-s.jsonl");
    writeJsonl(f, [
      { ts: nowMinusHours(48), method: "GET", path: "/old", status: 200 },
      { ts: nowMinusHours(12), method: "GET", path: "/recent", status: 200 },
      { ts: nowMinusHours(1), method: "POST", path: "/new", status: 201 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "timeline", f, "--since", "24h"]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      afterFilters: number;
    };
    expect(data.afterFilters).toBe(2);
  });

  it("audit timeline errors when target doesn't exist", async () => {
    setupHome();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "timeline", "/tmp/does-not-exist-" + Date.now()]);

    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("AUDIT_NO_TRACES"))).toBe(true);
  });

  // ────────────────────────────────────────────
  // audit who
  // ────────────────────────────────────────────

  it("audit who buckets by method/status/pathRoot for a profile", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-who.jsonl");
    writeJsonl(f, [
      { profile: "alice", method: "GET", path: "/crm/v3/objects/contacts", status: 200 },
      { profile: "alice", method: "POST", path: "/crm/v3/objects/deals", status: 201 },
      { profile: "bob", method: "DELETE", path: "/crm/v3/objects/contacts/1", status: 204 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "who", "alice", "--file", f]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      totalEvents: number;
      reads: number;
      writes: number;
      byMethod: Record<string, number>;
      byPathRoot: Record<string, number>;
    };
    expect(data.totalEvents).toBe(2);
    expect(data.reads).toBe(1);
    expect(data.writes).toBe(1);
    expect(data.byMethod.GET).toBe(1);
    expect(data.byMethod.POST).toBe(1);
    expect(data.byPathRoot.crm).toBe(2);
  });

  it("audit who returns zero when profile never acted", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-empty.jsonl");
    writeJsonl(f, [{ profile: "alice", method: "GET", path: "/x", status: 200 }]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "who", "nobody", "--file", f]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as { totalEvents: number };
    expect(data.totalEvents).toBe(0);
  });

  // ────────────────────────────────────────────
  // audit what
  // ────────────────────────────────────────────

  it("audit what substring-matches a path pattern across profiles", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-what.jsonl");
    writeJsonl(f, [
      { profile: "alice", toolName: "crm-list", method: "GET", path: "/crm/v3/objects/contacts" },
      { profile: "bob", toolName: "crm-write", method: "POST", path: "/crm/v3/objects/contacts" },
      { profile: "bob", method: "POST", path: "/crm/v3/objects/deals" },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "what", "/contacts", "--file", f]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      totalHits: number;
      byProfile: Record<string, number>;
      byTool: Record<string, number>;
      writes: number;
    };
    expect(data.totalHits).toBe(2);
    expect(data.byProfile.alice).toBe(1);
    expect(data.byProfile.bob).toBe(1);
    expect(data.byTool["crm-list"]).toBe(1);
    expect(data.writes).toBe(1);
  });

  // ────────────────────────────────────────────
  // audit writes
  // ────────────────────────────────────────────

  it("audit writes filters to POST/PUT/PATCH/DELETE and counts failures", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-w.jsonl");
    writeJsonl(f, [
      { ts: "2026-04-20T10:00:00Z", method: "GET", status: 200 },
      { ts: "2026-04-20T10:01:00Z", method: "POST", status: 201 },
      { ts: "2026-04-20T10:02:00Z", method: "PATCH", status: 200 },
      { ts: "2026-04-20T10:03:00Z", method: "DELETE", status: 500, error: "boom" },
      { ts: "2026-04-20T10:04:00Z", method: "PUT", status: 400 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "writes", "--file", f]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      totalWrites: number;
      successfulWrites: number;
      failedWrites: number;
    };
    expect(data.totalWrites).toBe(4);
    expect(data.failedWrites).toBe(2);
    expect(data.successfulWrites).toBe(2);
  });

  it("audit writes --limit caps output", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-wl.jsonl");
    writeJsonl(f, Array.from({ length: 10 }, (_, i) => ({
      ts: `2026-04-20T10:0${i}:00Z`,
      method: "POST",
      path: `/x/${i}`,
      status: 201,
    })));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "writes", "--file", f, "--limit", "3"]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      totalWrites: number;
      writes: unknown[];
    };
    expect(data.totalWrites).toBe(10);
    expect(data.writes.length).toBe(3);
  });

  // ────────────────────────────────────────────
  // audit by-tool
  // ────────────────────────────────────────────

  it("audit by-tool breakdown with error rate + avg latency", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-bt.jsonl");
    writeJsonl(f, [
      { toolName: "crm-list", method: "GET", status: 200, durationMs: 100 },
      { toolName: "crm-list", method: "GET", status: 200, durationMs: 200 },
      { toolName: "crm-list", method: "GET", status: 500, durationMs: 300, error: "boom" },
      { toolName: "crm-write", method: "POST", status: 201, durationMs: 50 },
      { method: "GET", status: 200 }, // no toolName — should be skipped
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "by-tool", "--file", f]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      uniqueTools: number;
      totalMcpCalls: number;
      breakdown: Array<{
        tool: string;
        calls: number;
        writes: number;
        errors: number;
        errorRate: string;
        avgMs: number;
        maxMs: number;
      }>;
    };
    expect(data.uniqueTools).toBe(2);
    expect(data.totalMcpCalls).toBe(4);
    const crmList = data.breakdown.find((b) => b.tool === "crm-list")!;
    expect(crmList.calls).toBe(3);
    expect(crmList.errors).toBe(1);
    expect(crmList.writes).toBe(0);
    expect(crmList.maxMs).toBe(300);
    expect(crmList.avgMs).toBe(200);
    const crmWrite = data.breakdown.find((b) => b.tool === "crm-write")!;
    expect(crmWrite.writes).toBe(1);
  });

  it("audit by-tool sorted by call count desc", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-sort.jsonl");
    writeJsonl(f, [
      { toolName: "a", method: "GET", status: 200, durationMs: 0 },
      { toolName: "b", method: "GET", status: 200, durationMs: 0 },
      { toolName: "b", method: "GET", status: 200, durationMs: 0 },
      { toolName: "b", method: "GET", status: 200, durationMs: 0 },
      { toolName: "c", method: "GET", status: 200, durationMs: 0 },
      { toolName: "c", method: "GET", status: 200, durationMs: 0 },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "by-tool", "--file", f]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as {
      breakdown: Array<{ tool: string; calls: number }>;
    };
    expect(data.breakdown.map((b) => b.tool)).toEqual(["b", "c", "a"]);
  });

  // ────────────────────────────────────────────
  // Robustness
  // ────────────────────────────────────────────

  it("audit handles malformed JSONL lines gracefully", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-bad.jsonl");
    writeFileSync(f, [
      JSON.stringify({ method: "GET", status: 200, profile: "alice" }),
      "{partial",
      "",
      JSON.stringify({ method: "POST", status: 201, profile: "alice" }),
    ].join("\n"), "utf8");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "who", "alice", "--file", f]);

    const data = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as { totalEvents: number };
    expect(data.totalEvents).toBe(2);
  });

  it("audit since parses 30m/24h/7d units", async () => {
    const { hscliHome } = setupHome();
    const f = join(hscliHome, "trace-units.jsonl");
    writeJsonl(f, [
      { ts: nowMinusHours(24 * 10), method: "GET", profile: "x", status: 200 },  // 10 days ago
      { ts: nowMinusHours(24 * 2), method: "GET", profile: "x", status: 200 },   // 2 days ago
      { ts: nowMinusHours(0.25), method: "GET", profile: "x", status: 200 },     // 15 min ago
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { run } = await import("../src/cli.js");
    await run(["node", "hscli", "--json", "audit", "who", "x", "--file", f, "--since", "30m"]);
    const recent = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as { totalEvents: number };
    expect(recent.totalEvents).toBe(1);

    logSpy.mockClear();
    vi.resetModules();
    const mod2 = await import("../src/cli.js");
    await mod2.run(["node", "hscli", "--json", "audit", "who", "x", "--file", f, "--since", "7d"]);
    const week = parseOutput(String(logSpy.mock.calls.at(-1)![0])) as { totalEvents: number };
    expect(week.totalEvents).toBe(2);
  });
});
