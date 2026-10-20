import { i18n } from "@lingui/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRosterTime } from "./roster-time";

i18n.loadAndActivate({ locale: "en", messages: {} });

// Local time, so the test does not depend on the machine's time zone.
const at = (month: number, day: number, hour: number) =>
  new Date(2026, month, day, hour, 0).toISOString();

describe("formatRosterTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0));
  });
  afterEach(() => vi.useRealTimers());

  it("is empty without a valid date", () => {
    expect(formatRosterTime(null)).toBe("");
    expect(formatRosterTime("nope")).toBe("");
  });

  it("shows the time today", () => {
    expect(formatRosterTime(at(9, 20, 7))).toMatch(/7:00/);
  });

  it("says Yesterday for the previous calendar day", () => {
    expect(formatRosterTime(at(9, 19, 23))).toBe("Yesterday");
  });

  it("shows the weekday up to 6 calendar days ago, even at a later time of day", () => {
    // 6 calendar days ago at 23:00 is under 6 days before 09:00 now... and 5.4 days; use a
    // later time of day than now so elapsed time is just under 7 days.
    expect(formatRosterTime(at(9, 14, 10))).toBe("Wed");
  });

  it("shows a date from 7 calendar days ago, even at a later time of day", () => {
    // 7 calendar days ago at 23:00 is 6.6 days of elapsed time.
    expect(formatRosterTime(at(9, 13, 23))).toBe("Oct 13");
  });
});
