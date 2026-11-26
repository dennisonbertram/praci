import { describe, expect, it } from "vitest";
import { accruedInterest, interestUntil } from "./securities.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe("interestUntil", () => {
  it("accrues to the as-of date while a note is outstanding", () => {
    expect(interestUntil({ status: "outstanding", closedOn: null }, "2026-11-11")).toBe(
      "2026-11-11",
    );
  });

  it("uses the explicit closure date rather than maturity or later certificate metadata", () => {
    const repaid = {
      status: "repaid",
      closedOn: day("2025-01-01"),
      maturityDate: day("2024-06-01"),
      updatedAt: day("2026-11-11"),
    };
    const converted = {
      status: "converted",
      closedOn: day("2025-03-01"),
      convertedTo: { issueDate: day("2026-11-10") },
    };
    expect(interestUntil(repaid, "2026-11-11")).toBe("2025-01-01");
    expect(interestUntil(converted, "2026-11-11")).toBe("2025-03-01");
  });

  it("caps interest at an earlier as-of date and returns null without closure evidence", () => {
    expect(interestUntil({ status: "canceled", closedOn: day("2025-03-01") }, "2025-02-01")).toBe(
      "2025-02-01",
    );
    expect(interestUntil({ status: "repaid", closedOn: null }, "2025-02-01")).toBeNull();
  });

  it("accrues a repaid note only through its explicit closure date", () => {
    const at = (until: string) =>
      accruedInterest(100_000n, "10", "2024-01-01", until, "simple", "actual_365");
    const repaid = interestUntil({ status: "repaid", closedOn: day("2024-12-31") }, "2026-11-11");
    expect(repaid).toBe("2024-12-31");
    expect(at(repaid!)).toBe(at("2024-12-31"));
    expect(at(repaid!)).toBeLessThan(at("2026-11-11"));
  });
});
