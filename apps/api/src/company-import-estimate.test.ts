import { describe, expect, it } from "vitest";
import { companyImportEstimate } from "./company-import-estimate.js";

describe("Company import estimates", () => {
  it("does not invent unknown source totals or extrapolate zero-cost replay", () => {
    expect(companyImportEstimate(null, 100_000, { itemsRead: 25, tokensUsed: 500 })).toEqual({
      itemCount: null,
      tokensLower: 0,
      tokensUpper: 100_000,
      estimateBasis: "budget_cap",
    });
    expect(
      companyImportEstimate(100, 100_000, { itemsRead: 25, tokensUsed: 0 }).estimateBasis,
    ).toBe("budget_cap");
  });
  it("shows a deliberately broad range around observed sample usage", () => {
    expect(companyImportEstimate(100, 100_000, { itemsRead: 25, tokensUsed: 500 })).toEqual({
      itemCount: 100,
      tokensLower: 1_000,
      tokensUpper: 4_000,
      estimateBasis: "sample",
    });
  });
});
