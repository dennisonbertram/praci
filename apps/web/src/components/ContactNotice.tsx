import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact } from "@rakazo/contracts";
import { Button } from "@rakazo/ui-web";
import type { RefObject } from "react";
import { useEffect, useState } from "react";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

/** How long a notice without Undo, and the highlight of a just-saved row, stay on screen. */
export const NOTICE_MS = 8000;

export type Notice = {
  text: string;
  undo?: () => void;
  /** A failed restore offers Try again instead of Undo. */
  failed?: boolean;
};

/**
 * The notice, the Undo for a deleted contact and the just-saved row that Contacts and Cap table
 * share. `container` holds the rows (each with `data-contact-id`); `contacts` is the loaded list.
 */
export function useContactNotices(
  reload: () => void,
  container: RefObject<HTMLElement | null>,
  contacts: Contact[] | null,
) {
  const [notice, setNotice] = useState<Notice | null>(null);
  // A notice with Undo stays until it is used or dismissed: there is no delete confirmation, so a
  // founder who looks away must not lose the only way to get the contact back.
  useEffect(() => {
    if (!notice || notice.undo) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // The contact just saved: its row scrolls into view and stands out, since a new one lands last.
  const [savedId, setSavedId] = useState<string | null>(null);
  useEffect(() => {
    if (!savedId) return;
    container.current
      ?.querySelector(`[data-contact-id="${CSS.escape(savedId)}"]`)
      ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const timer = setTimeout(() => setSavedId(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [savedId, contacts, container]);

  const deleted = (gone: Contact) => {
    reload();
    const { name, email, organization, kind, notes } = gone;
    let restoring = false;
    const restore = () => {
      if (restoring) return;
      restoring = true;
      rpc.contacts
        .save({ name, email, organization, kind, notes })
        .then(() => {
          setNotice({ text: t`Restored ${name}` });
          reload();
        })
        .catch((cause) => {
          const reason = errorText(cause).replace(/\.$/, "");
          setNotice({
            text: t`Could not restore ${name}: ${reason}. If you dismiss this, ${name} stays deleted.`,
            undo: restore,
            failed: true,
          });
        })
        .finally(() => {
          restoring = false;
        });
    };
    setNotice({ text: t`Deleted ${name}`, undo: restore });
  };

  return { notice, setNotice, savedId, setSavedId, deleted };
}

/**
 * Pinned to the bottom of the page column and after the table in the page flow: showing or hiding
 * it never moves the rows, and scrolled to the end it sits below the last row.
 */
export function ContactNotice({
  notice,
  onDismiss,
}: {
  notice: Notice | null;
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
