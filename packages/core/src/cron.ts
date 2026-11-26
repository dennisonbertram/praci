import { Cron, CronDate } from "croner";

const WEEKDAYS = "1-5";
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const CRON_WEEKDAY_NAMES = WEEKDAY_NAMES;

export const ONCE_ROUTINE_CRON = "@once";

export function isOneShotRoutineCron(cron: string): boolean {
  return cron.trim() === ONCE_ROUTINE_CRON;
}

// A routine is one-shot only when it has exactly one schedule and that
// schedule is @once — a mix of @once plus recurring schedules doesn't make
// sense (the one-shot slot would never get a "next run" to compute).
export function isOneShotRoutineCrons(crons: string[]): boolean {
  return crons.length === 1 && isOneShotRoutineCron(crons[0] ?? "");
}

// True when @once is combined with any other schedule — never valid, since
// the one-shot slot has no "next run" to compute and would sit inert
// forever. Callers that persist crons must reject this rather than let
// isOneShotRoutineCrons quietly classify the array as recurring.
export function hasMixedOneShotSchedule(crons: string[]): boolean {
  return crons.length > 1 && crons.some(isOneShotRoutineCron);
}

export const CRON_FREQS = [
  "Every hour",
  "Every day",
  "Weekdays",
  "Every week",
  "Every month",
  "Interval",
  "Advanced",
] as const;

export type CronFreq = (typeof CRON_FREQS)[number];
export type CronUnit = "minutes" | "hours" | "days";

export type CronPreset = {
  freq: CronFreq;
  n: number;
  unit: CronUnit;
  time: string;
  cron: string;
  /** Day of week for "Every week": 0 = Sunday ... 6 = Saturday. */
  weekday: number;
};

export type CronPresetInput = {
  freq: CronFreq;
  n?: number;
  unit?: CronUnit;
  time?: string;
  cron?: string;
  weekday?: number;
};

export function defaultCronPreset(): CronPreset {
  return { freq: "Every day", n: 3, unit: "minutes", time: "9:00 AM", cron: "", weekday: 1 };
}

const INTERVAL_AMOUNTS = [1, 2, 3, 5, 10, 15, 30, 45];
export const CRON_INTERVAL_MAX: Record<CronUnit, number> = { minutes: 59, hours: 23, days: 31 };

// Cron steps cannot exceed the field's range, so offer only amounts that fit.
export function cronIntervalAmounts(unit: CronUnit, current?: number): number[] {
  const amounts = INTERVAL_AMOUNTS.filter((n) => n <= CRON_INTERVAL_MAX[unit]);
  if (current === undefined || current > CRON_INTERVAL_MAX[unit] || amounts.includes(current)) {
    return amounts;
  }
  return [...amounts, current].sort((a, b) => a - b);
}

export function clampIntervalAmount(n: number, unit: CronUnit): number {
  if (n <= CRON_INTERVAL_MAX[unit]) return n;
  return cronIntervalAmounts(unit).at(-1) ?? 1;
}

export function cronFromPreset(input: CronPresetInput): string {
  const advancedCron = input.cron?.trim();
  if (input.freq === "Advanced") {
    if (advancedCron && isOneShotRoutineCron(advancedCron)) return ONCE_ROUTINE_CRON;
    return advancedCron || "*/3 * * * *";
  }
  if (input.freq === "Every hour") return "0 * * * *";
  if (input.freq === "Interval") {
    const n = Number.isFinite(input.n) && (input.n ?? 0) > 0 ? (input.n as number) : 5;
    if (input.unit === "days") return `0 0 */${n} * *`;
    if (input.unit === "hours") return `0 */${n} * * *`;
    return `*/${n} * * * *`;
  }
  const { hour, minute } = parseClock(input.time ?? "9:00 AM");
  if (input.freq === "Weekdays") return `${minute} ${hour} * * ${WEEKDAYS}`;
  if (input.freq === "Every week") return `${minute} ${hour} * * ${input.weekday ?? 1}`;
  if (input.freq === "Every month") return `${minute} ${hour} 1 * *`;
  return `${minute} ${hour} * * *`;
}

export function presetFromCron(cron: string): CronPreset {
  const base = defaultCronPreset();
  const trimmed = cron.trim();
  if (isOneShotRoutineCron(trimmed)) {
    return { ...base, freq: "Advanced", cron: ONCE_ROUTINE_CRON };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length < 5) {
    return { ...base, freq: "Advanced", cron: trimmed };
  }
  const minute = parts[0] ?? "*";
  const hour = parts[1] ?? "*";
  const day = parts[2] ?? "*";
  const month = parts[3] ?? "*";
  const dow = parts[4] ?? "*";
  if (month !== "*") {
    return { ...base, freq: "Advanced", cron: trimmed };
  }

  const minuteStep = stepValue(minute);
  const hourStep = stepValue(hour);
  const dayStep = stepValue(day);

  if (minute === "0" && hour === "*" && day === "*" && dow === "*") {
    return { ...base, freq: "Every hour" };
  }
  if (minuteStep && hour === "*" && day === "*" && dow === "*") {
    return { ...base, freq: "Interval", n: minuteStep, unit: "minutes" };
  }
  if (minute === "0" && hourStep && day === "*" && dow === "*") {
    return { ...base, freq: "Interval", n: hourStep, unit: "hours" };
  }
  if (minute === "0" && hour === "0" && dayStep && dow === "*") {
    return { ...base, freq: "Interval", n: dayStep, unit: "days" };
  }
  if (!isCronClock(minute, hour)) {
    return { ...base, freq: "Advanced", cron: trimmed };
  }

  const time = formatClock(Number(hour), Number(minute));
  if (day === "*" && dow === WEEKDAYS) {
    return { ...base, freq: "Weekdays", time };
  }
  if (day === "*" && /^[0-7]$/.test(dow)) {
    return { ...base, freq: "Every week", time, weekday: Number(dow) % 7 };
  }
  if (day === "1" && dow === "*") {
    return { ...base, freq: "Every month", time };
  }
  if (day === "*" && dow === "*") {
    return { ...base, freq: "Every day", time };
  }
  return { ...base, freq: "Advanced", cron: trimmed };
}

export function describeCronPreset(preset: CronPreset): { lead: string; detail: string } {
  if (preset.freq === "Interval") {
    return { lead: "Every", detail: `${preset.n} ${preset.unit}` };
  }
  if (preset.freq === "Every hour") {
    return { lead: "Every hour", detail: "" };
  }
  if (preset.freq === "Advanced") {
    return { lead: "Cron", detail: preset.cron || "*/3 * * * *" };
  }
  if (preset.freq === "Weekdays") {
    return { lead: "Weekdays", detail: `at ${preset.time}` };
  }
  if (preset.freq === "Every week") {
    return {
      lead: `Every ${WEEKDAY_NAMES[preset.weekday] ?? "Monday"}`,
      detail: `at ${preset.time}`,
    };
  }
  if (preset.freq === "Every month") {
    return { lead: "Monthly", detail: `on the 1st at ${preset.time}` };
  }
  return { lead: "Every day", detail: `at ${preset.time}` };
}

export function formatSchedule(preset: CronPreset): string {
  const { lead, detail } = describeCronPreset(preset);
  return [lead, detail].filter(Boolean).join(" ");
}

export function formatCron(cron: string): string {
  if (isOneShotRoutineCron(cron)) return "One-time";
  // Cron aliases Sunday as 7.
  const weekly = /^(\d+)\s+(\d+)\s+\*\s+\*\s+([0-7])$/.exec(cron.trim());
  if (weekly && isCronClock(weekly[1] ?? "", weekly[2] ?? "")) {
    const time = formatClock(Number(weekly[2]), Number(weekly[1]));
    const weekday = Number(weekly[3]) % 7;
    return `Every ${WEEKDAY_NAMES[weekday]} at ${time}`;
  }
  return formatSchedule(presetFromCron(cron));
}

export function resolveRoutineNextRunAt(
  cron: string,
  from: Date,
  timezone: string,
  existing: Date | null | undefined,
): Date | null {
  if (isOneShotRoutineCron(cron)) return existing ?? null;
  return nextCronDate(cron, from, timezone);
}

export function nextCronDate(cron: string, from: Date, timezone = "UTC"): Date {
  if (isOneShotRoutineCron(cron)) {
    throw new Error("nextCronDate does not apply to one-shot routines");
  }
  if (cron.trim().split(/\s+/).length !== 5) {
    throw new RangeError("Cron expressions must contain five fields");
  }
  const schedule = new Cron(cron, {
    paused: true,
    timezone: validTimezoneOrUtc(timezone),
  });
  const next = schedule.nextRun(from);
  if (!next) throw new RangeError(`Cron expression has no future run: ${cron}`);
  return next;
}

/** The preset of an interval step that recurs from the scheduled fire, or undefined. */
export function unevenInterval(cron: string): CronPreset | undefined {
  const preset = presetFromCron(cron);
  if (
    cron.trim().split(/\s+/).length !== 5 ||
    preset.freq !== "Interval" ||
    preset.n > CRON_INTERVAL_MAX[preset.unit] ||
    (preset.unit === "minutes" && 60 % preset.n === 0) ||
    (preset.unit === "hours" && 24 % preset.n === 0) ||
    (preset.unit === "days" && preset.n === 1)
  ) {
    return undefined;
  }
  return preset;
}

// Uneven interval steps recur from the scheduled fire instead of resetting at
// cron field boundaries. Even steps keep cron's local wall-clock positions.
// Creation/editing still uses nextCronDate for the initial anchor.
export function nextRoutineRunDate(cron: string, anchor: Date, now: Date, timezone = "UTC"): Date {
  const from = new Date(Math.max(anchor.getTime(), now.getTime()));
  const preset = unevenInterval(cron);
  if (!preset) return nextCronDate(cron, from, timezone);
  if (preset.unit !== "days") {
    const gap = preset.n * (preset.unit === "hours" ? 3_600_000 : 60_000);
    const steps = Math.floor((from.getTime() - anchor.getTime()) / gap) + 1;
    return new Date(anchor.getTime() + steps * gap);
  }

  const zone = validTimezoneOrUtc(timezone);
  const localAnchor = new CronDate(anchor, zone);
  const localNow = new CronDate(from, zone);
  // CronDate stores months zero-based, like Date.
  const anchorDay = Date.UTC(localAnchor.year, localAnchor.month, localAnchor.day);
  const nowDay = Date.UTC(localNow.year, localNow.month, localNow.day);
  let steps = Math.max(1, Math.floor((nowDay - anchorDay) / (preset.n * 86_400_000)));
  let next: Date;
  do {
    const day = new Date(anchorDay + steps * preset.n * 86_400_000);
    // Normalize the calendar date before letting Croner resolve its wall-clock
    // time in the routine zone (including daylight saving transitions).
    const candidate = new CronDate(localAnchor, zone);
    candidate.year = day.getUTCFullYear();
    candidate.month = day.getUTCMonth();
    candidate.day = day.getUTCDate();
    next = new Date(candidate.getDate().getTime() + localAnchor.ms);
    steps++;
  } while (next <= from);
  return next;
}

// The shared anchor belongs to an interval only with one recurring schedule.
// Multiple schedules keep cron matches because their individual anchors are
// unknown. Skip one-shot and malformed schedules as nextCronDateAcross does.
export function nextRoutineRunDateAcross(
  crons: string[],
  anchor: Date,
  now: Date,
  timezone = "UTC",
): Date | null {
  const from = new Date(Math.max(anchor.getTime(), now.getTime()));
  const recurring: string[] = [];
  let earliest: Date | null = null;
  for (const cron of crons) {
    if (isOneShotRoutineCron(cron)) continue;
    let next: Date;
    try {
      next = nextCronDate(cron, from, timezone);
    } catch {
      continue;
    }
    recurring.push(cron);
    if (!earliest || next < earliest) earliest = next;
  }
  const onlyCron = recurring.length === 1 ? recurring[0] : undefined;
  if (onlyCron) return nextRoutineRunDate(onlyCron, anchor, now, timezone);
  return earliest;
}

// Nearest next calendar match, ignoring one-shot and malformed schedules.
// Routine wakeups use nextRoutineRunDateAcross to preserve single-interval phase.
// Anything persisting crons must reject malformed input instead — see
// nextCronDateAcrossStrict.
export function nextCronDateAcross(crons: string[], from: Date, timezone = "UTC"): Date | null {
  let earliest: Date | null = null;
  for (const cron of crons) {
    if (isOneShotRoutineCron(cron)) continue;
    let next: Date;
    try {
      next = nextCronDate(cron, from, timezone);
    } catch {
      continue;
    }
    if (!earliest || next < earliest) earliest = next;
  }
  return earliest;
}

// Same as nextCronDateAcross, but throws on the first malformed recurring
// cron instead of silently skipping it. Use this before persisting a
// routine's crons — a partially-invalid array should be rejected outright,
// not saved with the bad entry quietly never firing.
export function nextCronDateAcrossStrict(
  crons: string[],
  from: Date,
  timezone = "UTC",
): Date | null {
  let earliest: Date | null = null;
  for (const cron of crons) {
    if (isOneShotRoutineCron(cron)) continue;
    const next = nextCronDate(cron, from, timezone);
    if (!earliest || next < earliest) earliest = next;
  }
  return earliest;
}

/** True for an IANA zone name the runtime knows, e.g. "America/New_York". */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?$/;

/**
 * An ISO date or datetime as an instant. One with an offset (or Z) is taken as written; a date
 * or wall-clock time without one is read in `timezone`, so "2026-11-02T10:00" is 10:00 there.
 * A time skipped by a daylight-saving change moves forward by the gap. Null when invalid.
 */
export function zonedDateTime(value: string, timezone = "UTC"): Date | null {
  const text = value.trim();
  let wall = WALL_CLOCK.exec(text);
  const offset = wall ? undefined : OFFSET_SUFFIX.exec(text)?.[0];
  if (offset) wall = WALL_CLOCK.exec(text.slice(0, -offset.length));
  // Date.parse rolls an impossible date over (February 30 becomes March 2), so check the parts.
  if (!wall || (offset && !wall[4])) return null;
  const [year, month, day, hour, minute, second] = wall
    .slice(1, 7)
    .map((part) => (part === undefined ? 0 : Number(part)));
  const ms = wall[7] ? Math.floor(Number(`0.${wall[7]}`) * 1000) : 0;
  const check = new Date(
    Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0, second ?? 0),
  );
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== (month ?? 1) - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute ||
    check.getUTCSeconds() !== second
  ) {
    return null;
  }
  if (offset) {
    const instant = new Date(text);
    return Number.isFinite(instant.getTime()) ? instant : null;
  }
  const local = new CronDate(new Date(), validTimezoneOrUtc(timezone));
  local.year = check.getUTCFullYear();
  local.month = check.getUTCMonth();
  local.day = check.getUTCDate();
  local.hour = check.getUTCHours();
  local.minute = check.getUTCMinutes();
  local.second = check.getUTCSeconds();
  local.ms = 0;
  // Keep any fraction so a time just after an occurrence does not include it.
  return new Date(local.getDate().getTime() + ms);
}

/** The local date and time of `instant` in `timezone`, as zonedDateTime reads it back. */
export function wallClock(instant: Date, timezone = "UTC"): string {
  const local = new CronDate(instant, validTimezoneOrUtc(timezone));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${local.year}-${pad(local.month + 1)}-${pad(local.day)}T${pad(local.hour)}:${pad(local.minute)}:${pad(local.second)}`;
}

function validTimezoneOrUtc(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "UTC";
  }
}

function parseClock(time: string): { hour: number; minute: number } {
  const [rawH, rest] = time.split(":");
  const minute = Number((rest ?? "00").slice(0, 2));
  let hour = Number(rawH);
  if (/pm/i.test(time) && hour < 12) hour += 12;
  if (/am/i.test(time) && hour === 12) hour = 0;
  return { hour, minute };
}

function formatClock(hour: number, minute: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${period}`;
}

function stepValue(expr: string): number | null {
  const match = /^\*\/(\d+)$/.exec(expr);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isInt(expr: string): boolean {
  return /^\d+$/.test(expr);
}

function isCronClock(minute: string, hour: string): boolean {
  return isInt(minute) && Number(minute) <= 59 && isInt(hour) && Number(hour) <= 23;
}
