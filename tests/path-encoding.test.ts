import { describe, expect, it } from "vitest";

// Import the shared module directly. The file path-encoding helpers are
// both exported from src/commands/crm/shared.ts.
async function loadShared() {
  return import("../src/commands/crm/shared.js");
}

describe("encodePathSegment (single-segment, strict)", () => {
  it("encodes a simple segment", async () => {
    const { encodePathSegment } = await loadShared();
    expect(encodePathSegment("hello", "x")).toBe("hello");
  });

  it("rejects path separators", async () => {
    const { encodePathSegment } = await loadShared();
    expect(() => encodePathSegment("a/b", "x")).toThrow(/path separators/);
    expect(() => encodePathSegment("a\\b", "x")).toThrow(/path separators/);
  });

  it("rejects `.` and `..`", async () => {
    const { encodePathSegment } = await loadShared();
    expect(() => encodePathSegment(".", "x")).toThrow(/'.' or '..'/);
    expect(() => encodePathSegment("..", "x")).toThrow(/'.' or '..'/);
  });

  it("rejects control characters", async () => {
    const { encodePathSegment } = await loadShared();
    expect(() => encodePathSegment("a\u0001b", "x")).toThrow(/control characters/);
  });
});

describe("encodeFilePath (multi-segment, preserves /)", () => {
  it("preserves / between segments", async () => {
    const { encodeFilePath } = await loadShared();
    expect(encodeFilePath("@hubspot/button.module/fields.json", "path")).toBe(
      "%40hubspot/button.module/fields.json",
    );
  });

  it("encodes each segment individually", async () => {
    const { encodeFilePath } = await loadShared();
    // Each segment: URL-encoded. `/` kept literal.
    const got = encodeFilePath("a b/c d/e.json", "path");
    expect(got).toBe("a%20b/c%20d/e.json");
  });

  it("strips leading + trailing slashes", async () => {
    const { encodeFilePath } = await loadShared();
    expect(encodeFilePath("/@hubspot/button.module/", "path")).toBe(
      "%40hubspot/button.module",
    );
  });

  it("rejects empty segments (double //)", async () => {
    const { encodeFilePath } = await loadShared();
    expect(() => encodeFilePath("a//b", "path")).toThrow(/empty segments/);
  });

  it("rejects `.` / `..` traversal segments", async () => {
    const { encodeFilePath } = await loadShared();
    expect(() => encodeFilePath("a/../b", "path")).toThrow(/'.' or '..'/);
    expect(() => encodeFilePath("./a", "path")).toThrow(/'.' or '..'/);
  });

  it("rejects backslashes", async () => {
    const { encodeFilePath } = await loadShared();
    expect(() => encodeFilePath("a\\b", "path")).toThrow(/backslashes/);
  });

  it("rejects control characters", async () => {
    const { encodeFilePath } = await loadShared();
    expect(() => encodeFilePath("a\u0001/b", "path")).toThrow(/control characters/);
  });

  it("rejects empty input", async () => {
    const { encodeFilePath } = await loadShared();
    expect(() => encodeFilePath("", "path")).toThrow(/cannot be empty/);
    expect(() => encodeFilePath("   ", "path")).toThrow(/cannot be empty/);
  });

  it("rejects all-slash input", async () => {
    const { encodeFilePath } = await loadShared();
    expect(() => encodeFilePath("///", "path")).toThrow(/cannot be empty/);
  });
});
