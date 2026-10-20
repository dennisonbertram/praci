/**
 * Models have no clock. Without an explicit anchor they infer "now" from training data
 * or from timestamps that happen to appear in the conversation, and then reason about
 * deadlines, recency and scheduling from a stale date. Every turn states the real present
 * moment on the user message so that never has to be guessed; it stays out of the system
 * prompt so the cacheable prefix does not change every call.
 */
export function formatCurrentTimeInstruction(
  now: Date = new Date(),
  timezone?: string | null,
): string {
  const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(
    now,
  );
  const local = timezone ? localTimeLine(now, timezone) : undefined;
  return [
    `Current date and time: ${weekday}, ${iso} (UTC).`,
    local,
    "Treat this as the present moment for everything you say and do.",
    local
      ? "Use the local time for the user's day, for what is past, upcoming, or overdue, and for schedules, and write absolute dates rather than relative ones."
      : "Use it to judge what is past, upcoming, or overdue, convert it to the user's time zone when one is known, and write absolute dates rather than relative ones.",
    "Never infer today's date from your training data or from timestamps quoted in the conversation.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** The user's wall-clock time, or undefined when the zone name is not a valid IANA zone. */
function localTimeLine(now: Date, timeZone: string): string | undefined {
  try {
    const when = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
    const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value;
    return `User's local time: ${when} in ${timeZone}${offset ? ` (${offset.replace("GMT", "UTC")})` : ""}.`;
  } catch {
    return undefined;
  }
}
