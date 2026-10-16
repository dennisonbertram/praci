import type { StatementReminder } from "@rakazo/contracts";

const DAY_MS = 86_400_000;
/** A statement is only chased this many days after its month ends, so a normal delay does not nag. */
export const STATEMENT_GRACE_DAYS = 5;

const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);

/** The first month-end strictly after `day`: 2026-10-30 -> 2026-10-31, 2026-10-31 -> 2026-11-30. */
export function nextMonthEnd(day: string): string {
  const d = new Date(dayMs(day));
  const thisEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const end =
    thisEnd.getTime() > d.getTime()
      ? thisEnd
      : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0));
  return end.toISOString().slice(0, 10);
}

/**
 * When the statement after one that ends on `day` is due: one month later. A statement that ends on
 * a month-end is followed by the next month-end; one that ends mid-month (a cycle from the 21st to
 * the 20th, or a CSV whose last line is the 20th) covers that month, so the next is due on the same
 * day of the following month, clamped to its last day.
 */
export function nextStatementDue(day: string): string {
  const d = new Date(dayMs(day));
  const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  if (monthEnd.getTime() === d.getTime()) return nextMonthEnd(day);
  const nextEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0));
  const date = Math.min(d.getUTCDate(), nextEnd.getUTCDate());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, date))
    .toISOString()
    .slice(0, 10);
}

/** One reminder per account whose next statement's due day plus the grace period is already past. */
export function statementReminders(
  accounts: { accountId: string; accountName: string; coveredThrough: string | null }[],
  today: string,
): StatementReminder[] {
  return accounts.flatMap(({ accountId, accountName, coveredThrough }) => {
    if (!coveredThrough) return [];
    const dueFor = nextStatementDue(coveredThrough);
    return dayMs(today) > dayMs(dueFor) + STATEMENT_GRACE_DAYS * DAY_MS
      ? [{ accountId, accountName, coveredThrough, dueFor }]
      : [];
  });
}
