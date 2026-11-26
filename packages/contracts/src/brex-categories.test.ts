import { describe, expect, it } from "vitest";
import {
  BREX_EXPENSE_CATEGORIES,
  BREX_EXPENSE_CATEGORY_BUCKETS,
  brexSpendBucket,
} from "./brex-categories.js";

describe("brexSpendBucket", () => {
  it("has one bucket for every Brex expense category", () => {
    expect(Object.keys(BREX_EXPENSE_CATEGORY_BUCKETS).sort()).toEqual(
      [...BREX_EXPENSE_CATEGORIES].sort(),
    );
    for (const category of BREX_EXPENSE_CATEGORIES)
      expect(brexSpendBucket({ category })).toBe(BREX_EXPENSE_CATEGORY_BUCKETS[category]);
  });

  it("prefers the expense category, then the merchant MCC, then Other", () => {
    expect(brexSpendBucket({ category: "RESTAURANTS", mcc: "5734" })).toBe("meals");
    expect(brexSpendBucket({ category: "NOT_A_BREX_CATEGORY", mcc: "5734" })).toBe("software");
    expect(brexSpendBucket({ category: null, mcc: "5812" })).toBe("meals");
    expect(brexSpendBucket({ category: null, mcc: "5912" })).toBe("other");
    expect(brexSpendBucket({ category: "NOT_A_BREX_CATEGORY", mcc: "9999" })).toBe("other");
    expect(brexSpendBucket({})).toBe("other");
  });
});
