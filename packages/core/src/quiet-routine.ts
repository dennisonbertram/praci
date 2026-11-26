export type CheckInCadence = "off" | "daily" | "every_4h";

/** Routine.managedKind for the one managed check-in routine per bot. */
export const CHECK_IN_MANAGED_KIND = "check_in";

/**
 * Server-side instruction for quiet routines ("Only message me if something needs me").
 * It triggers the executor's existing silent-reply rule (ROUTINE_SILENT_REPLY_GUIDANCE), which
 * says how to end silently, so users never type the magic word.
 */
export function quietRoutineGuidance(): string {
  return "This routine's prompt says to stay silent when there is nothing to report. Only message the user if something needs them: a decision, an answer, a problem, or a change they would want to know about. If nothing does, stay silent as the silent-reply rule describes.";
}

/** Built-in prompt of the managed check-in routine. */
export function checkInInstruction(): string {
  return [
    "Check in for the user.",
    "Only read and report. Never take actions or request approvals in a check-in; if something needs doing, say so in the message.",
    "Review your open items (note what each one is waiting on and when it is due) and anything that happened since the last check-in.",
    "If nothing needs the user, finish silently.",
    "Otherwise lead with the one thing that needs the user, then add a short list of anything else. Send at most one message.",
  ].join(" ");
}

const CHECK_IN_CRONS: Record<Exclude<CheckInCadence, "off">, string[]> = {
  daily: ["0 9 * * *"],
  every_4h: ["0 */4 * * *"],
};

/** Crons for a cadence; daily is 09:00 in the given IANA time zone (the routine stores the zone). Off has none. */
export function checkInCrons(cadence: CheckInCadence, timezone: string): string[] {
  if (cadence === "off") return [];
  new Intl.DateTimeFormat("en", { timeZone: timezone }); // throws RangeError on a bad time zone
  return [...CHECK_IN_CRONS[cadence]];
}

/** The bot's check-in setting, read from its managed routine (none, or inactive, is off). */
export function checkInCadenceFromRoutine(
  routine: { active: boolean; crons: readonly string[] } | null | undefined,
): CheckInCadence {
  if (!routine?.active) return "off";
  const cron = routine.crons[0];
  if (cron === CHECK_IN_CRONS.every_4h[0]) return "every_4h";
  if (cron === CHECK_IN_CRONS.daily[0]) return "daily";
  return "off";
}
