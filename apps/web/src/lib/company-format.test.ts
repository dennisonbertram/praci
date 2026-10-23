import { describe, expect, it } from "vitest";
import { companyDate, companyDateEnd } from "./company-format";

describe("company all-day dates", () => {
  it("keeps imprecise dates current until the end of their full period", () => {
    expect(companyDateEnd({ date: "2026-01-01", precision: "year" })).toBe("2026-12-31");
    expect(companyDateEnd({ date: "2026-10-01", precision: "quarter" })).toBe("2026-12-31");
    expect(companyDateEnd({ date: "2024-02-01", precision: "month" })).toBe("2024-02-29");
    expect(companyDateEnd({ date: "2025-02-01", precision: "month" })).toBe("2025-02-28");
    expect(companyDateEnd({ date: "2026-10-21", precision: "day" })).toBe("2026-10-21");
  });
  it("preserves precision without interpreting a viewer timezone", () => {
    expect(companyDate({ date: "2024-01-01", precision: "year" })).toBe("2024");
    expect(companyDate({ date: "2024-04-01", precision: "quarter" })).toBe("2024 Q2");
    expect(companyDate({ date: "2024-04-01", precision: "month" })).toBe("2024-04");
    expect(companyDate({ date: "2024-04-01", precision: "day" })).toBe("2024-04-01");
  });
});
