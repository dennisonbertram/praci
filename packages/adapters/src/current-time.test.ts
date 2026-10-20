import { describe, expect, it } from "vitest";
import { formatCurrentTimeInstruction } from "./current-time.js";

describe("formatCurrentTimeInstruction", () => {
  it("anchors the present moment in UTC with the weekday and no sub-second noise", () => {
    const line = formatCurrentTimeInstruction(new Date("2026-09-17T14:55:41.123Z"));
    expect(line).toContain("Current date and time: Thursday, 2026-09-17T14:55:41Z (UTC).");
    expect(line).not.toContain(".123");
  });

  it("tells the model not to guess the date from training data or quoted timestamps", () => {
    const line = formatCurrentTimeInstruction(new Date("2026-01-01T00:00:00Z"));
    expect(line).toContain("Never infer today's date from your training data");
    expect(line).toContain("write absolute dates");
  });

  it("adds the user's local date, time and zone when a zone is known", () => {
    const line = formatCurrentTimeInstruction(new Date("2026-01-15T01:30:00Z"), "America/New_York");
    expect(line).toContain("Current date and time: Thursday, 2026-01-15T01:30:00Z (UTC).");
    expect(line).toContain(
      "User's local time: Wednesday, January 14, 2026 at 8:30 PM in America/New_York (UTC-5).",
    );
  });

  it("ignores a missing or invalid zone", () => {
    for (const zone of [undefined, null, "Not/AZone"]) {
      expect(formatCurrentTimeInstruction(new Date("2026-01-15T01:30:00Z"), zone)).not.toContain(
        "local time",
      );
    }
  });

  it("defaults to the real clock", () => {
    const before = Date.now();
    const line = formatCurrentTimeInstruction();
    const match = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})Z/.exec(line);
    expect(match).not.toBeNull();
    const stamped = Date.parse(`${match![1]}Z`);
    expect(Math.abs(stamped - before)).toBeLessThan(5_000);
  });
});
