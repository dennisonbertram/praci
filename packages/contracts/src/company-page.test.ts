import { describe, expect, it } from "vitest";
import { companyFactIsVisible } from "./company-page.js";

describe("company page confidence", () => {
  it("hides low confidence and rejected facts, allowing independent corroboration", () => {
    const fact = {
      status: "suggested",
      confidence: 0.7,
      evidence: [{ sourceKind: "gmail", sourceItemId: "one" }],
    };
    expect(companyFactIsVisible(fact)).toBe(false);
    expect(companyFactIsVisible({ ...fact, confidence: 0.8 })).toBe(true);
    expect(companyFactIsVisible({ ...fact, status: "confirmed" })).toBe(true);
    expect(
      companyFactIsVisible({
        ...fact,
        evidence: [...fact.evidence, { sourceKind: "gmail", sourceItemId: "two" }],
      }),
    ).toBe(false);
    expect(
      companyFactIsVisible({
        ...fact,
        evidence: [...fact.evidence, { sourceKind: "data_room", sourceItemId: "two" }],
      }),
    ).toBe(true);
    expect(companyFactIsVisible({ ...fact, status: "rejected", confidence: 1 })).toBe(false);
  });
});
