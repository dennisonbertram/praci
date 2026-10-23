import { describe, expect, it } from "vitest";
import type { CompanyExtraction } from "./company-extraction.js";
import { keepOwnCompany } from "./company-extraction.js";

const company = (ref: string, displayName: string) => ({
  ref,
  quote: displayName,
  entity: { kind: "company" as const, displayName, confidence: 0.9, attrs: {} },
});

describe("keepOwnCompany", () => {
  it("keeps the space's company and turns a customer labelled as company into an organisation", () => {
    const extraction: CompanyExtraction = {
      entities: [
        company("own", "Northwind Robotics (Mock)"),
        company("customer", "Halcyon Logistics (Mock)"),
      ],
      edges: [],
      events: [],
    };
    const result = keepOwnCompany(extraction, "Northwind Robotics");
    expect(result.entities.map((fact) => fact.entity.kind)).toEqual(["company", "organisation"]);
    expect(result.entities[1]?.entity.displayName).toBe("Halcyon Logistics (Mock)");
    expect(result.entities[1]?.ref).toBe("customer");
  });
});
