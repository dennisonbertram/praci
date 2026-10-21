import { t } from "@lingui/core/macro";
import type { Contact } from "@rakazo/contracts";
import type { RefObject } from "react";
import { useEffect, useState } from "react";
import { rpc } from "./rpc";
import { errorText } from "./user-error";

/** How long a notice without Undo, and the highlight on a saved row, stay on screen. */
const NOTICE_MS = 8000;

export type ContactNoticeState = {
  text: string;
  undo?: () => void;
  /** A failed restore offers Try again instead of Undo. */
  failed?: boolean;
};

/**
 * The "Saved", "Deleted, Undo" and "Restored" notices for contact changes, shared by every page
 * that edits contacts. `reload` refreshes the page's list; `container` holds the rows
 * (`data-contact-id`), and a saved row scrolls into view and stands out.
 */
export function useContactNotice(reload: () => void, container: RefObject<HTMLElement | null>) {
  const [notice, setNotice] = useState<ContactNoticeState | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // A notice with Undo stays until it is used or dismissed: there is no delete confirmation, so a
  // founder who looks away must not lose the only way to get the contact back.
  useEffect(() => {
    if (!notice || notice.undo) return;
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!savedId) return;
    container.current
      ?.querySelector(`[data-contact-id="${CSS.escape(savedId)}"]`)
      ?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const timer = setTimeout(() => setSavedId(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [savedId, container]);

  const saved = (contact: Contact) => {
    reload();
    setSavedId(contact.id);
    setNotice({ text: t`Saved ${contact.name}` });
  };

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

  return { notice, setNotice, savedId, saved, deleted };
}
