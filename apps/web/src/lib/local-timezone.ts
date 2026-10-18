/**
 * The browser's IANA timezone (e.g. "Australia/Sydney"), for timestamp inputs
 * that would otherwise default to UTC. Falls back to UTC when unavailable.
 */
export function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** A timezone as people say it ("Eastern Daylight Time"), falling back to the IANA name. */
export function timezoneLabel(timeZone: string, locale?: string, at = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "long" })
      .formatToParts(at)
      .find((entry) => entry.type === "timeZoneName");
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}
