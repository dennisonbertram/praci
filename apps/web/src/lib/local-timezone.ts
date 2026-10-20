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

const REPORTED_KEY = "rakazo.timezoneReported";

/**
 * The browser's zone when it should be sent to the server: nothing is stored yet, or this browser's
 * zone changed since it last reported (travel). A zone chosen in settings stays until then.
 */
export function timezoneToReport(
  me: { userId: string; timezone: string | null },
  zone = localTimezone(),
): string | null {
  let last: string | null = null;
  try {
    last = localStorage.getItem(REPORTED_KEY);
  } catch {
    // Without storage, report whenever the server disagrees.
  }
  if (me.timezone !== null && last === `${me.userId}:${zone}`) return null;
  return me.timezone === zone ? null : zone;
}

export function markTimezoneReported(userId: string, zone = localTimezone()): void {
  try {
    localStorage.setItem(REPORTED_KEY, `${userId}:${zone}`);
  } catch {
    // Reporting again next time is harmless.
  }
}
