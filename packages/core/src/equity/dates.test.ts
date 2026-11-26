import { describe, expect, it } from "vitest";
import { addMonthsClamped, days360, daysBetween, daysInMonth } from "./dates.js";

describe("addMonthsClamped", () => {
  it("adds calendar months and clamps to the target month's end", () => {
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsClamped("2023-01-31", 1)).toBe("2023-02-28");
    expect(addMonthsClamped("2024-01-31", 2)).toBe("2024-03-31");
    expect(addMonthsClamped("2024-01-01", 12)).toBe("2025-01-01");
    expect(addMonthsClamped("2024-01-01", 0)).toBe("2024-01-01");
    expect(addMonthsClamped("2024-03-31", -1)).toBe("2024-02-29");
    expect(addMonthsClamped("2024-10-31", 4)).toBe("2025-02-28");
  });

  it("rejects malformed dates", () => {
    for (const date of ["2024-02-30", "2024-13-01", "2024-1-01", "20240101", ""]) {
      expect(() => addMonthsClamped(date, 1)).toThrow(RangeError);
    }
  });
});

describe("daysBetween", () => {
  it("counts actual days in UTC", () => {
    expect(daysBetween("2023-01-01", "2024-01-01")).toBe(365);
    expect(daysBetween("2024-01-01", "2025-01-01")).toBe(366);
    expect(daysBetween("2024-01-30", "2024-03-31")).toBe(61);
    expect(daysBetween("2024-01-02", "2024-01-01")).toBe(-1);
    expect(daysBetween("2024-01-01", "2024-01-01")).toBe(0);
  });
});

describe("days360", () => {
  it("counts every month as 30 days and every year as 360", () => {
    expect(days360("2024-01-01", "2025-01-01")).toBe(360);
    expect(days360("2024-01-30", "2024-03-31")).toBe(60);
    expect(days360("2024-01-31", "2024-04-30")).toBe(90);
    expect(days360("2024-01-31", "2024-02-29")).toBe(29);
  });

  it("normalizes February ends under the US 30/360 convention", () => {
    expect(days360("2023-02-28", "2023-03-31")).toBe(30);
    expect(days360("2024-02-29", "2024-03-31")).toBe(30);
    expect(days360("2023-02-28", "2024-02-29")).toBe(360);
    expect(days360("2024-02-29", "2025-02-28")).toBe(360);
    expect(days360("2023-02-28", "2023-02-28")).toBe(0);
    expect(days360("2024-02-29", "2024-02-29")).toBe(0);
    expect(days360("2024-01-31", "2024-02-29")).toBe(29);
  });
});

describe("daysInMonth", () => {
  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 12)).toBe(31);
  });
});
