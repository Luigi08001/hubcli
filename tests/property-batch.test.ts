import { describe, expect, it } from "vitest";
import { normalizePropertyBatch } from "../src/commands/crm/property-batch.js";

describe("property batch normalization", () => {
  it("keeps owner-reference metadata and adds externalOptions", () => {
    const result = normalizePropertyBatch([
      {
        name: "account_manager",
        label: "Account manager",
        type: "enumeration",
        fieldType: "select",
        referencedObjectType: "OWNER",
        options: [{ label: "placeholder", value: "placeholder" }],
      },
    ]);

    expect(result.inputs[0]).toMatchObject({
      name: "account_manager",
      referencedObjectType: "OWNER",
      externalOptions: true,
    });
    expect(result.externalOptionsAdded).toEqual([
      {
        code: "EXTERNAL_OPTIONS_ADDED",
        name: "account_manager",
        message: "Added externalOptions=true because referencedObjectType is present.",
      },
    ]);
  });

  it("skips HubSpot-reserved migration drift names by default", () => {
    const result = normalizePropertyBatch([
      { name: "recurring_revenue_amount", label: "Recurring revenue amount", type: "string", fieldType: "text" },
      { name: "closed_won_reason", label: "Closed won reason", type: "string", fieldType: "text" },
      { name: "usa___safe_custom", label: "Safe custom", type: "string", fieldType: "text" },
    ]);

    expect(result.skippedReserved).toEqual(["recurring_revenue_amount", "closed_won_reason"]);
    expect(result.inputs.map((input) => input.name)).toEqual(["usa___safe_custom"]);
  });
});
