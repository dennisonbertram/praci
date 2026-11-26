import { Trans } from "@lingui/react/macro";
import { Button, cn } from "@rakazo/ui-web";
import { lazy, Suspense, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { closeRestored, getOutbox, subscribeOutbox, undoSend } from "../lib/outbox";

const ComposeEmail = lazy(() =>
  import("./ComposeEmail").then((module) => ({ default: module.ComposeEmail })),
);

/**
 * Mounted once for the signed-in app: the "Sending… Undo" and "Sent" notice, wherever the message
 * was written (Inbox, the preview, a chat email card), and the composer that Undo or a failed send
 * brings back.
 */
export function MailOutbox() {
  const { view, restoring } = useSyncExternalStore(subscribeOutbox, getOutbox);
  const undoable = view?.kind === "discarded" || (view?.kind === "sending" && view.undoable);
  return (
    <>
      {view
        ? // A modal preview marks everything already on the page as inert; a notice added to the
          // body afterwards stays readable and clickable above it.
          createPortal(
            <div
              role="status"
              className="pointer-events-none fixed inset-x-0 bottom-4 z-100 flex justify-center px-4"
            >
              {/* The same high-contrast toast as the Inbox's Archived notice, so it stands apart from the rows under it. */}
              <div
                // A pending approval toast rises above this notice instead of covering Undo.
                data-toast-avoid=""
                className={cn(
                  "pointer-events-auto flex min-h-9 items-center gap-2 rounded-lg bg-primary py-1 ps-3 text-sm text-primary-foreground shadow-lg",
                  undoable ? "pe-1" : "pe-3",
                )}
              >
                {view.kind === "sent" ? <Trans>Sent</Trans> : null}
                {view.kind === "sending" ? <Trans>Sending…</Trans> : null}
                {view.kind === "discarded" ? <Trans>Draft discarded</Trans> : null}
                {undoable ? (
                  <Button variant="secondary" size="sm" onClick={undoSend}>
                    <Trans>Undo</Trans>
                  </Button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
      {restoring ? (
        <Suspense fallback={null}>
          <ComposeEmail
            key={restoring.clientId}
            seed={restoring.seed}
            accounts={restoring.accounts}
            restore={restoring}
            onClose={closeRestored}
          />
        </Suspense>
      ) : null}
    </>
  );
}
