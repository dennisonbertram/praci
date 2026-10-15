import { useLingui } from "@lingui/react/macro";
import type { StatementReminder } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";

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
  const month = new Date(`${first.dueFor.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    timeZone: "UTC",
  });
  const more = reminders.length - 1;
  return (
    <div
      role="status"
      className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
    >
      <span>
        {t`Upload the ${month} statement for ${first.accountName}`}
        {more > 0 ? <span className="ms-1 text-muted-foreground">{t`+${more} more`}</span> : null}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onUpload}>
        {t`Upload`}
      </Button>
    </div>
  );
}
