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
 * zone changed since it last reported on this browser (travel). A zone chosen in settings stays until then.
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
  if (me.timezone === zone) return null;
  if (me.timezone === null) return zone;
  // A zone is stored (maybe picked in settings): only this browser's own move may replace it.
  // An empty or other-user record means this browser never reported, so leave it alone.
  const [lastUser, lastZone] = [
    last?.slice(0, me.userId.length + 1),
    last?.slice(me.userId.length + 1),
  ];
  return lastUser === `${me.userId}:` && lastZone !== zone ? zone : null;
}

export function markTimezoneReported(userId: string, zone = localTimezone()): void {
  try {
    localStorage.setItem(REPORTED_KEY, `${userId}:${zone}`);
  } catch {
    // Reporting again next time is harmless.
  }
}
