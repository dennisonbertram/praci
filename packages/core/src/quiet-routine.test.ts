import { Cron } from "croner";
import { describe, expect, it } from "vitest";
import {
  checkInCadenceFromRoutine,
  checkInCrons,
  checkInInstruction,
  quietRoutineGuidance,
} from "./quiet-routine.js";

describe("check-in cadence", () => {
  it("has no crons when off", () => {
    expect(checkInCrons("off", "UTC")).toEqual([]);
  });
  it("runs daily at 09:00 in the time zone", () => {
    const [cron] = checkInCrons("daily", "America/New_York");
    const next = new Cron(cron!, { timezone: "America/New_York" }).nextRun(
      new Date("2026-01-05T12:00:00Z"),
    );
    expect(next?.toISOString()).toBe("2026-01-05T14:00:00.000Z"); // 09:00 EST
  });
  it("runs every four hours", () => {
    const [cron] = checkInCrons("every_4h", "UTC");
    const next = new Cron(cron!, { timezone: "UTC" }).nextRun(new Date("2026-01-05T01:00:00Z"));
    expect(next?.toISOString()).toBe("2026-01-05T04:00:00.000Z");
  });
  it("rejects a bad time zone", () => {
    expect(() => checkInCrons("daily", "Mars/Base")).toThrow();
  });
  it("reads the cadence back from the managed routine", () => {
    for (const c of ["daily", "every_4h"] as const) {
      expect(checkInCadenceFromRoutine({ active: true, crons: checkInCrons(c, "UTC") })).toBe(c);
    }
    expect(checkInCadenceFromRoutine({ active: false, crons: checkInCrons("daily", "UTC") })).toBe(
      "off",
    );
    expect(checkInCadenceFromRoutine({ active: true, crons: ["5 4 * * *"] })).toBe("off");
    expect(checkInCadenceFromRoutine(null)).toBe("off");
  });
});

describe("prompts", () => {
  it("never tells the model to type the magic word", () => {
    expect(quietRoutineGuidance()).not.toContain("NO_RESPONSE");
    expect(quietRoutineGuidance()).toMatch(/stay silent/);
  });
  it("asks for at most one message", () => {
    expect(checkInInstruction()).toMatch(/at most one message/);
    expect(checkInInstruction()).toMatch(/silently/);
    expect(checkInInstruction()).toMatch(/never take actions or request approvals/i);
  });
});
