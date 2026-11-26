import { describe, expect, it } from "vitest";
import {
  isNoisy,
  nextWatchCheckAt,
  recordCheckOutcome,
  shouldPauseForErrors,
  wakeBudget,
  watchDay,
} from "./watch-schedule.js";

const now = new Date("2026-01-01T00:00:00Z");
const minutesLater = (d: Date) => (d.getTime() - now.getTime()) / 60_000;

describe("nextWatchCheckAt", () => {
  it("uses the interval with no errors and doubles per error", () => {
    expect(minutesLater(nextWatchCheckAt(now, 60, 0))).toBe(60);
    expect(minutesLater(nextWatchCheckAt(now, 60, 1))).toBe(120);
    expect(minutesLater(nextWatchCheckAt(now, 60, 3))).toBe(480);
  });
  it("caps at 24 hours, but never below a daily interval", () => {
    expect(minutesLater(nextWatchCheckAt(now, 60, 9))).toBe(1440);
    expect(minutesLater(nextWatchCheckAt(now, 15, 100))).toBe(1440);
    expect(minutesLater(nextWatchCheckAt(now, 1440, 4))).toBe(1440);
  });
});

describe("pause and noise", () => {
  it("pauses at 5 errors", () => {
    expect(shouldPauseForErrors(4)).toBe(false);
    expect(shouldPauseForErrors(5)).toBe(true);
  });
  it("keeps a ring of 10 and flags 8 of 10 changed", () => {
    let ring: number[] = [];
    for (let i = 0; i < 12; i++) ring = recordCheckOutcome(ring, i < 2 || i >= 4);
    expect(ring).toHaveLength(10);
    expect(isNoisy(ring)).toBe(true);
    expect(isNoisy([0, 0, 1, 1, 1, 1, 1, 1, 1, 1])).toBe(true);
    expect(isNoisy([0, 0, 0, 1, 1, 1, 1, 1, 1, 1])).toBe(false);
    expect(isNoisy([1, 1, 1, 1, 1, 1, 1, 1])).toBe(false); // not enough history
  });
});

describe("wakeBudget", () => {
  it("counts up to 6 a day then refuses", () => {
    let state = { wakesToday: 0, wakesDay: "2026-01-01" as string | null };
    for (let i = 0; i < 6; i++) {
      const r = wakeBudget({ ...state, today: "2026-01-01" });
      expect(r.allowed).toBe(true);
      state = { wakesToday: r.nextWakesToday, wakesDay: r.nextWakesDay };
    }
    const r = wakeBudget({ ...state, today: "2026-01-01" });
    expect(r).toEqual({ allowed: false, nextWakesToday: 6, nextWakesDay: "2026-01-01" });
  });
  it("resets on a new day or first use", () => {
    expect(wakeBudget({ wakesToday: 6, wakesDay: "2026-01-01", today: "2026-01-02" })).toEqual({
      allowed: true,
      nextWakesToday: 1,
      nextWakesDay: "2026-01-02",
    });
    expect(wakeBudget({ wakesToday: 0, wakesDay: null, today: "2026-01-02" }).allowed).toBe(true);
  });
  it("rolls the day over at local midnight", () => {
    const t = new Date("2026-01-01T07:30:00Z"); // 23:30 in Los Angeles, 08:30 in UTC+1
    expect(watchDay(t, "America/Los_Angeles")).toBe("2025-12-31");
    expect(watchDay(t, "Europe/Paris")).toBe("2026-01-01");
  });
});
