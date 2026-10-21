import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import type { ContactNoticeState } from "../lib/use-contact-notice";

/**
 * Pinned to the bottom of the page column and after the list in the page flow: showing or hiding
 * it never moves the rows, and scrolled to the end it sits below the last row.
 */
export function ContactNotice({
  notice,
  onDismiss,
}: {
  notice: ContactNoticeState | null;
  onDismiss: () => void;
}) {
  return (
    <div role="status" className="sticky bottom-0 pt-3 empty:hidden">
      {notice ? (
        <div className="flex flex-wrap items-center gap-x-2 rounded-lg border border-border bg-card py-1 ps-3 pe-1 text-sm text-card-foreground shadow-md">
          <span className="min-w-0 flex-1 py-1">{notice.text}</span>
          {notice.undo ? (
            <Button variant="ghost" size="sm" onClick={notice.undo}>
              {notice.failed ? <Trans>Try again</Trans> : <Trans>Undo</Trans>}
            </Button>
          ) : null}
          {notice.undo ? (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <Trans>Dismiss</Trans>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
