import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { useEffect } from "react";
import { createPortal } from "react-dom";

const SHOWN_MS = 8000;

/** A one-line notice with Undo, in the same style as the mail outbox notice; it goes away by itself. */
export function SidebarUndoNotice({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, SHOWN_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);
  return createPortal(
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex justify-center px-4"
    >
      <div className="pointer-events-auto flex min-h-9 items-center gap-2 rounded-lg bg-primary py-1 ps-3 pe-1 text-sm text-primary-foreground shadow-lg">
        <span>{message}</span>
        <Button variant="secondary" size="sm" onClick={onUndo}>
          <Trans>Undo</Trans>
        </Button>
      </div>
    </div>,
    document.body,
  );
}
