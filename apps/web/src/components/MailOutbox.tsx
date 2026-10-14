import { Trans } from "@lingui/react/macro";
import { Button } from "@rakazo/ui-web";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { closeRestored, getOutbox, subscribeOutbox, undoSend } from "../lib/outbox";
import { ComposeEmail } from "./ComposeEmail";

/**
 * Mounted once for the signed-in app: the "Sending… Undo" and "Sent" notice, wherever the message
 * was written (Inbox, the preview, a chat email card), and the composer that Undo or a failed send
 * brings back.
 */
export function MailOutbox() {
  const { view, restoring } = useSyncExternalStore(subscribeOutbox, getOutbox);
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
              <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card py-1 ps-3 pe-1 text-sm text-card-foreground shadow-md">
                {view.kind === "sent" ? <Trans>Sent</Trans> : <Trans>Sending…</Trans>}
                {view.kind === "sending" && view.undoable ? (
                  <Button variant="ghost" size="sm" onClick={undoSend}>
                    <Trans>Undo</Trans>
                  </Button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
      {restoring ? (
        <ComposeEmail
          key={restoring.clientId}
          seed={restoring.seed}
          accounts={restoring.accounts}
          restore={restoring}
          onClose={closeRestored}
        />
      ) : null}
    </>
  );
}
