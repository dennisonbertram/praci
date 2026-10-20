// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  localTimezone,
  markTimezoneReported,
  timezoneLabel,
  timezoneToReport,
} from "./local-timezone.js";

describe("localTimezone", () => {
  it("returns a non-empty IANA timezone string", () => {
    const zone = localTimezone();
    expect(zone).not.toBe("");
    expect(zone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  });
});

it("names a timezone in words and keeps an unknown one as given", () => {
  const winter = new Date("2026-01-15T12:00:00Z");
  expect(timezoneLabel("America/New_York", "en-US", winter)).toBe("Eastern Standard Time");
  expect(timezoneLabel("Not/AZone", "en-US", winter)).toBe("Not/AZone");
});

describe("timezoneToReport", () => {
  const me = { userId: "u1", timezone: null as string | null };
  beforeEach(() => localStorage.clear());

  it("reports when the server has no zone", () => {
    expect(timezoneToReport(me, "Europe/Paris")).toBe("Europe/Paris");
  });

  it("does not report a zone the server already has", () => {
    expect(timezoneToReport({ ...me, timezone: "Europe/Paris" }, "Europe/Paris")).toBeNull();
  });

  it("reports a changed browser zone once, then leaves a chosen zone alone", () => {
    const stored = { ...me, timezone: "America/New_York" };
    expect(timezoneToReport(stored, "Europe/Paris")).toBe("Europe/Paris");
    markTimezoneReported("u1", "Europe/Paris");
    // The user picked another zone in settings; the browser has not moved.
    expect(timezoneToReport({ ...stored, timezone: "Asia/Tokyo" }, "Europe/Paris")).toBeNull();
  });
});
