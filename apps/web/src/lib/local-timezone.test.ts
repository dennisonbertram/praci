import { describe, expect, it } from "vitest";

import { localTimezone, timezoneLabel } from "./local-timezone.js";

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
