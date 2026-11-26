import { describe, expect, it } from "vitest";
import { periodLabel } from "./investor-updates.js";

describe("periodLabel", () => {
  it("names a month and its year", () => {
    expect(periodLabel("2026-10")).toBe("October 2026");
    expect(periodLabel("2026-01")).toBe("January 2026");
  });

  it("keeps a quarter as a quarter", () => {
    expect(periodLabel("2026-Q3")).toBe("Q3 2026");
  });
});
