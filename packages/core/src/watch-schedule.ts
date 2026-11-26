/** Pure scheduling and budget rules for page watches. */

export const WATCH_MIN_INTERVAL_MINUTES = 15;
export const WATCHES_PER_BOT = 5;
export const WATCHES_PER_SPACE = 20;
export const SPACE_WATCH_WAKES_PER_DAY = 50;
export const WATCH_WAKES_PER_DAY = 6;
export const WATCH_PAUSE_AFTER_ERRORS = 5;
export const WATCH_NOISY_CHANGES = 8;
export const WATCH_RING_SIZE = 10;
const MAX_BACKOFF_MINUTES = 24 * 60;

/** Next probe time: the interval, doubled for each consecutive error, capped at 24 hours. */
export function nextWatchCheckAt(
  now: Date,
  intervalMinutes: number,
  consecutiveErrors: number,
): Date {
  const factor = 2 ** Math.min(Math.max(consecutiveErrors, 0), 12);
  const minutes = Math.min(
    intervalMinutes * factor,
    Math.max(MAX_BACKOFF_MINUTES, intervalMinutes),
  );
  return new Date(now.getTime() + minutes * 60_000);
}

export function shouldPauseForErrors(consecutiveErrors: number): boolean {
  return consecutiveErrors >= WATCH_PAUSE_AFTER_ERRORS;
}

/** Appends one outcome (1 changed, 0 same) and keeps the last 10. */
export function recordCheckOutcome(ring: readonly number[], changed: boolean): number[] {
  return [...ring, changed ? 1 : 0].slice(-WATCH_RING_SIZE);
}

/** True when the page changed on 8 of the last 10 checks (needs a full ring). */
export function isNoisy(ring: readonly number[]): boolean {
  return (
    ring.length >= WATCH_RING_SIZE && ring.reduce((sum, n) => sum + n, 0) >= WATCH_NOISY_CHANGES
  );
}

/** The YYYY-MM-DD calendar day of `now` in an IANA time zone. */
export function watchDay(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** One model wake costs one unit; the count resets when the routine's local day changes. */
export function wakeBudget(input: { wakesToday: number; wakesDay: string | null; today: string }): {
  allowed: boolean;
  nextWakesToday: number;
  nextWakesDay: string;
} {
  const used = input.wakesDay === input.today ? input.wakesToday : 0;
  const allowed = used < WATCH_WAKES_PER_DAY;
  return {
    allowed,
    nextWakesToday: allowed ? used + 1 : used,
    nextWakesDay: input.today,
  };
}
