import { describe, expect, it } from "vitest";
import { niceScale } from "./charts";

describe("niceScale", () => {
  it("picks a round step so the top is within about four gridlines", () => {
    expect(niceScale(4_410_000)).toEqual({ step: 2_000_000, top: 6_000_000 });
    expect(niceScale(7_000_000)).toEqual({ step: 2_000_000, top: 8_000_000 });
    expect(niceScale(100_000)).toEqual({ step: 50_000, top: 100_000 });
  });

  it("stays finite for zero", () => {
    const { step, top } = niceScale(0);
    expect(step).toBeGreaterThan(0);
    expect(top).toBeGreaterThanOrEqual(step);
  });
});
