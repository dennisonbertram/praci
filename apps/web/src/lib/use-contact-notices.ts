import { t } from "@lingui/core/macro";
import type { Contact } from "@rakazo/contracts";
import { enqueueNotificationToast } from "@rakazo/ui-web";
import type { RefObject } from "react";
import { useEffect, useState } from "react";
import { rpc } from "./rpc";

/** How long the just-saved row stands out. */
export const HIGHLIGHT_MS = 2000;

/** The highlight of a row that was just saved or restored; Contacts and Cap table share it. */
export const SAVED_ROW_CLASS = "bg-accent outline-2 -outline-offset-2 outline-ring";

let counter = 0;
const toast = (title: string, action?: { label: string; onClick: () => void }) =>
  enqueueNotificationToast({
    id: `contact-${++counter}`,
    title,
    // A toast with an action stays until it is used: there is no delete confirmation, so a founder
    // who looks away must not lose the only way to get the contact back.
    ...(action ? { action, timeout: 0 } : {}),
  });

/**
 * The toasts, the Undo for a deleted contact and the just-saved row that Contacts and Cap table
 * share. `container` holds the rows (each with `data-contact-id`); `contacts` is the loaded list.
 */
export function useContactNotices(
  reload: () => void,
  container: RefObject<HTMLElement | null>,
  contacts: Contact[] | null,
) {
  const rowOf = (id: string) =>
    container.current?.querySelector(`[data-contact-id="${CSS.escape(id)}"]`);

  // The contact just saved: its row scrolls into view and stands out, since a new one lands last.
  const [savedId, setSavedId] = useState<string | null>(null);
  useEffect(() => {
    if (!savedId) return;
    rowOf(savedId)?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    const timer = setTimeout(() => setSavedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [savedId, contacts]);

  // After Undo the restored row's name takes focus, once the reloaded list shows the row.
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    const name = rowOf(focusId)?.querySelector<HTMLElement>("[data-row-open]");
    if (name) {
      name.focus();
      setFocusId(null);
      return;
    }
    const timer = setTimeout(() => setFocusId(null), 3000);
    return () => clearTimeout(timer);
  }, [focusId, contacts]);

  /** `undoable` is false for a contact with linked data: it was confirmed first and cannot come back. */
  const deleted = (gone: Contact, undoable = true) => {
    reload();
    if (!undoable) {
      toast(t`Deleted ${gone.name}`);
      return;
    }
    const { name, email, organization, kind, notes, stage, checkSizeCents, nextStep, roundId } =
      gone;
    let restoring = false;
    const restore = () => {
      if (restoring) return;
      restoring = true;
      rpc.contacts
        .save({
          name,
          email,
          organization,
          kind,
          notes,
          stage,
          checkSizeCents,
          nextStep,
          roundId: roundId ?? undefined,
        })
        .then((saved) => {
          toast(t`Restored ${name}`);
          reload();
          setSavedId(saved.id);
          setFocusId(saved.id);
        })
        .catch(() => {
          toast(t`Could not restore ${name}`, { label: t`Try again`, onClick: restore });
        })
        .finally(() => {
          restoring = false;
        });
    };
    toast(t`Deleted ${name}`, { label: t`Undo`, onClick: restore });
  };

  return { notify: toast, savedId, setSavedId, deleted };
}
