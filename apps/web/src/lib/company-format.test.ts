import { describe, expect, it } from "vitest";
import { companyDate } from "./company-format";

describe("company all-day dates", () => {
  it("preserves precision without interpreting a viewer timezone", () => {
    expect(companyDate({ date: "2024-01-01", precision: "year" })).toBe("2024");
    expect(companyDate({ date: "2024-04-01", precision: "quarter" })).toBe("2024 Q2");
    expect(companyDate({ date: "2024-04-01", precision: "month" })).toBe("2024-04");
    expect(companyDate({ date: "2024-04-01", precision: "day" })).toBe("2024-04-01");
  });
});
