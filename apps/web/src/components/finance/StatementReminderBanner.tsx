import { useLingui } from "@lingui/react/macro";
import type { StatementReminder } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import { shortDay } from "../../lib/finance-format";

/** One line at the top of Finance when an uploaded-statement account is due for its next statement. */
export function StatementReminderBanner({
  reminders,
  onUpload,
}: {
  reminders: StatementReminder[];
  onUpload: () => void;
}) {
  const { t } = useLingui();
  const first = reminders[0];
  if (!first) return null;
  // A month that ends on its last day is `the October statement`; a cycle that ends mid-month is
  // `the statement through Oct 7`, so October is never asked for before it is over.
  const due = new Date(`${first.dueFor}T00:00:00Z`);
  const monthEnd = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0));
  const month = due.toLocaleDateString(undefined, { month: "long", timeZone: "UTC" });
  const statement =
    due.getTime() === monthEnd.getTime()
      ? t`the ${month} statement`
      : t`the statement through ${shortDay(first.dueFor)}`;
  const more = reminders.length - 1;
  return (
    <div
      role="status"
      className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
    >
      <span>
        {t`Upload ${statement} for ${first.accountName}`}
        {more > 0 ? <span className="ms-1 text-muted-foreground">{t`+${more} more`}</span> : null}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onUpload}>
        {t`Upload`}
      </Button>
    </div>
  );
}
