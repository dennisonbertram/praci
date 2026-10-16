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

/** One reminder per account whose next month-end plus the grace period is already past. */
export function statementReminders(
  accounts: { accountId: string; accountName: string; coveredThrough: string | null }[],
  today: string,
): StatementReminder[] {
  return accounts.flatMap(({ accountId, accountName, coveredThrough }) => {
    if (!coveredThrough) return [];
    const dueFor = nextMonthEnd(coveredThrough);
    return dayMs(today) > dayMs(dueFor) + STATEMENT_GRACE_DAYS * DAY_MS
      ? [{ accountId, accountName, coveredThrough, dueFor }]
      : [];
  });
}
