import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HubSpotRecord,
  HubSpotListResponse,
  HubSpotSearchResponse,
  HubSpotOwner,
  HubSpotPipeline,
  HubSpotProperty,
  HubSpotAssociation,
  HubSpotError,
  AccountInfo,
  parseResponse,
} from "../src/core/schemas.js";

describe("HubSpot Zod schemas", () => {
  // -----------------------------------------------------------------------
  // Individual schema validation
  // -----------------------------------------------------------------------

  it("HubSpotRecord accepts valid record", () => {
    const data = { id: "1", properties: { email: "a@b.com" }, createdAt: "2024-01-01", updatedAt: "2024-01-02" };
    expect(HubSpotRecord.parse(data)).toMatchObject({ id: "1" });
  });

  it("HubSpotRecord allows extra fields (passthrough)", () => {
    const data = { id: "1", properties: {}, extraField: "surprise" };
    const result = HubSpotRecord.parse(data);
    expect((result as any).extraField).toBe("surprise");
  });

  it("HubSpotRecord rejects missing id", () => {
    expect(() => HubSpotRecord.parse({ properties: {} })).toThrow();
  });

  it("HubSpotListResponse accepts valid list", () => {
    const data = { results: [{ id: "1" }], paging: { next: { after: "10" } } };
    expect(HubSpotListResponse.parse(data)).toMatchObject({ results: [{ id: "1" }] });
  });

  it("HubSpotListResponse accepts without paging", () => {
    expect(() => HubSpotListResponse.parse({ results: [] })).not.toThrow();
  });

  it("HubSpotSearchResponse requires total", () => {
    expect(() => HubSpotSearchResponse.parse({ results: [] })).toThrow();
    expect(() => HubSpotSearchResponse.parse({ results: [], total: 5 })).not.toThrow();
  });

  it("HubSpotOwner accepts valid owner", () => {
    const data = { id: "123", email: "test@test.com", firstName: "John", userId: 42 };
    expect(HubSpotOwner.parse(data)).toMatchObject({ id: "123" });
  });

  it("HubSpotPipeline accepts valid pipeline", () => {
    const data = { id: "p1", label: "Sales", stages: [{ id: "s1", label: "New" }] };
    expect(HubSpotPipeline.parse(data)).toMatchObject({ label: "Sales" });
  });

  it("HubSpotProperty accepts valid property", () => {
    const data = { name: "email", label: "Email", type: "string", fieldType: "text", groupName: "contactinfo" };
    expect(HubSpotProperty.parse(data)).toMatchObject({ name: "email" });
  });

  it("HubSpotAssociation accepts valid association", () => {
    const data = { toObjectId: 5, associationTypes: [{ category: "HUBSPOT_DEFINED", typeId: 1 }] };
    expect(HubSpotAssociation.parse(data)).toMatchObject({ toObjectId: 5 });
  });

  it("HubSpotError accepts valid error", () => {
    const data = { status: "error", message: "Not found", correlationId: "abc-123", category: "OBJECT_NOT_FOUND" };
    expect(HubSpotError.parse(data)).toMatchObject({ status: "error" });
  });

  it("AccountInfo accepts valid info", () => {
    const data = { portalId: 12345678, uiDomain: "app-eu1.hubspot.com", timeZone: "Europe/Paris" };
    expect(AccountInfo.parse(data)).toMatchObject({ portalId: 12345678 });
  });

  // -----------------------------------------------------------------------
  // parseResponse behavior
  // -----------------------------------------------------------------------

  describe("parseResponse", () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      delete process.env.HSCLI_STRICT_SCHEMAS;
    });

    afterEach(() => {
      warnSpy.mockRestore();
      delete process.env.HSCLI_STRICT_SCHEMAS;
    });

    it("returns parsed data on valid input", () => {
      const data = { id: "1", properties: { name: "Test" } };
      const result = parseResponse(HubSpotRecord, data, "test");
      expect(result.id).toBe("1");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("warns but returns raw data on invalid input (non-strict)", () => {
      const data = { not_a_record: true };
      const result = parseResponse(HubSpotRecord, data, "contacts get");
      // Returns raw data as-is
      expect((result as any).not_a_record).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0])).toContain("contacts get");
    });

    it("throws on invalid input in strict mode", () => {
      process.env.HSCLI_STRICT_SCHEMAS = "1";
      const data = { not_a_record: true };
      expect(() => parseResponse(HubSpotRecord, data, "test")).toThrow("validation failed");
    });

    it("strict mode recognizes various truthy env values", () => {
      for (const val of ["1", "true", "yes", "TRUE", " Yes "]) {
        process.env.HSCLI_STRICT_SCHEMAS = val;
        expect(() => parseResponse(HubSpotRecord, {}, "test")).toThrow();
      }
    });

    it("allows extra fields through passthrough schemas", () => {
      const data = { id: "1", properties: {}, hubspot_internal_field: "xyz" };
      const result = parseResponse(HubSpotRecord, data);
      expect((result as any).hubspot_internal_field).toBe("xyz");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("works without context parameter", () => {
      const result = parseResponse(HubSpotRecord, { broken: true });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });
  });
});
