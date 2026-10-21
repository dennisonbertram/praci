import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { Download, Mail, X } from "lucide-react";

/** What can be done with the ticked files. It shows only while at least one row is ticked. */
export function SelectionBar({
  count,
  busy = false,
  onDownload,
  onSend,
  onClear,
}: {
  count: number;
  /** A download or a send is reading the files. */
  busy?: boolean;
  onDownload: () => void;
  /** Without it (no connected mailbox is known) there is no Send. */
  onSend?: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      role="toolbar"
      data-testid="data-room-selection"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-1.5 text-sm"
    >
      <span className="me-auto font-medium">
        <Trans>{count} selected</Trans>
      </span>
      <Button variant="outline" size="sm" disabled={busy} onClick={onDownload}>
        <Download aria-hidden="true" />
        <Trans>Download</Trans>
      </Button>
      {onSend ? (
        <Button variant="outline" size="sm" disabled={busy} onClick={onSend}>
          <Mail aria-hidden="true" />
          <Trans>Send</Trans>
        </Button>
      ) : null}
      <Button variant="ghost" size="icon-sm" aria-label={t`Clear selection`} onClick={onClear}>
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
