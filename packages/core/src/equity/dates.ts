// Calendar helpers for the cap table math. Dates are the ledger's YYYY-MM-DD strings and months
// are calendar months clamped to the target month's end (Jan 31 + 1 month = Feb 28/29), so a
// vesting or interest schedule never drifts across leap years or month lengths.

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function parse(date: string): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`invalid date: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`invalid date: ${date}`);
  }
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

/** The same day `months` calendar months later, clamped to the target month's last day. */
export function addMonthsClamped(date: string, months: number): string {
  const { year, month, day } = parse(date);
  const offset = year * 12 + (month - 1) + Math.trunc(months);
  const targetYear = Math.floor(offset / 12);
  const targetMonth = (((offset % 12) + 12) % 12) + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${pad(targetYear, 4)}-${pad(targetMonth)}-${pad(targetDay)}`;
}

/** Whole days between two dates, counted in UTC. Negative when `to` is before `from`. */
export function daysBetween(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  const start = Date.UTC(a.year, a.month - 1, a.day);
  const end = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((end - start) / MS_PER_DAY);
}

/**
 * US/NASD 30/360: day 31 becomes 30; a February month-end start becomes 30, and a February
 * month-end finish becomes 30 only when both endpoints are February month-ends.
 */
export function days360(from: string, to: string): number {
  const a = parse(from);
  const b = parse(to);
  const startIsFebruaryEnd = a.month === 2 && a.day === daysInMonth(a.year, a.month);
  const endIsFebruaryEnd = b.month === 2 && b.day === daysInMonth(b.year, b.month);
  const startDay = startIsFebruaryEnd || a.day === 31 ? 30 : a.day;
  const endDay =
    (endIsFebruaryEnd && startIsFebruaryEnd) || (b.day === 31 && startDay >= 30) ? 30 : b.day;
  return (b.year - a.year) * 360 + (b.month - a.month) * 30 + (endDay - startDay);
}
