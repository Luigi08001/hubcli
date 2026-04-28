import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("migration id-map helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.HSCLI_HOME;
    delete process.env.HSCLI_PROFILE;
    process.exitCode = undefined;
  });

  it("applies repeated ID map rules to batch upsert payload fields without HubSpot calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hscli-id-map-"));
    const payloadFile = join(dir, "contacts-payload.json");
    const teamsMapFile = join(dir, "teams.json");
    const buMapFile = join(dir, "business-units.json");
    const outFile = join(dir, "contacts-remapped.json");
    const reportFile = join(dir, "contacts-remapped.report.json");

    writeFileSync(
      payloadFile,
      JSON.stringify({
        inputs: [
          {
            id: "one@example.com",
            idProperty: "email",
            properties: {
              email: "one@example.com",
              hs_owning_teams: "1;2;3",
              hs_all_assigned_business_unit_ids: "474782",
            },
          },
        ],
      }),
    );
    writeFileSync(
      teamsMapFile,
      JSON.stringify({
        mapping: [
          { source_id: "1", target_id: "10" },
          { source_id: "2", target_id: "20" },
        ],
      }),
    );
    writeFileSync(
      buMapFile,
      JSON.stringify({
        mapping: {
          "474782": { target_id: "3737336" },
        },
      }),
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const fetchSpy = vi.spyOn(global, "fetch" as never);
    const { run } = await import("../src/cli.js");

    await run([
      "node",
      "hscli",
      "--json",
      "crm",
      "migration",
      "id-map",
      "apply",
      "--data",
      `@${payloadFile}`,
      "--field",
      `hs_owning_teams=${teamsMapFile}`,
      "--field",
      `hs_all_assigned_business_unit_ids=${buMapFile}`,
      "--on-unmapped",
      "drop",
      "--out",
      outFile,
      "--report-out",
      reportFile,
    ]);

    expect(fetchSpy).not.toHaveBeenCalled();
    const output = JSON.parse(readFileSync(outFile, "utf8"));
    expect(output.inputs[0].properties.hs_owning_teams).toBe("10;20");
    expect(output.inputs[0].properties.hs_all_assigned_business_unit_ids).toBe("3737336");

    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    expect(report.inputRecords).toBe(1);
    expect(report.fields).toMatchObject([
      {
        field: "hs_owning_teams",
        recordsWithField: 1,
        recordsChanged: 1,
        valuesTotal: 3,
        valuesMapped: 2,
        valuesUnmapped: 1,
        uniqueUnmapped: 1,
        unmappedSamples: [{ sourceId: "3", count: 1 }],
      },
      {
        field: "hs_all_assigned_business_unit_ids",
        recordsWithField: 1,
        recordsChanged: 1,
        valuesTotal: 1,
        valuesMapped: 1,
        valuesUnmapped: 0,
        uniqueUnmapped: 0,
      },
    ]);
    expect(String(logSpy.mock.calls[0]?.[0] ?? "")).toContain('"intent": "migration-id-map-apply"');
  });
});
