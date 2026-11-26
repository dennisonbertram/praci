import { t } from "@lingui/core/macro";
import type { Contact } from "@rakazo/contracts";
import { enqueueNotificationToast, notificationToastManager } from "@rakazo/ui-web";
import type { RefObject } from "react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { UNDO_SEND_MS } from "./outbox";
import { rpc } from "./rpc";
import { errorText } from "./user-error";

/** Fired on window when an Undo restores a contact; the list page, if open, reloads and focuses it. */
export const CONTACT_RESTORED_EVENT = "contact-restored";

/** How long the just-saved row stands out. */
export const HIGHLIGHT_MS = 2000;

/** The highlight of a row that was just saved or restored; Contacts and Cap table share it. */
export const SAVED_ROW_CLASS = "bg-accent outline-2 -outline-offset-2 outline-ring";

let counter = 0;
const toast = (title: string, action?: { label: string; onClick: () => void }) =>
  enqueueNotificationToast({
    id: `contact-${++counter}`,
    title,
    ...(action ? { action, timeout: UNDO_SEND_MS } : {}),
  });

/**
 * Deletes wait out the Undo window here, outside any page, so one still goes through if the user
 * leaves the page. Closing the tab inside the window deletes nothing, as with an unsent email.
 * `hidden` holds the ids of held and finished deletes; lists drop them while they are stale.
 */
const held = new Map<string, { timer: ReturnType<typeof setTimeout>; toastId: string }>();
let hidden: ReadonlySet<string> = new Set();
const subscribers = new Set<() => void>();
const mounted = new Set<{ current: () => void }>();
const setHidden = (next: Set<string>) => {
  hidden = next;
  for (const notify of subscribers) notify();
};

/** Puts a held delete back; false when it is no longer held (it already went through). */
function cancelHeldDelete(id: string): boolean {
  const entry = held.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  held.delete(id);
  const next = new Set(hidden);
  next.delete(id);
  setHidden(next);
  return true;
}

function holdDelete(gone: Contact, toastId: string) {
  setHidden(new Set(hidden).add(gone.id));
  const timer = setTimeout(() => {
    held.delete(gone.id);
    notificationToastManager.close(toastId);
    rpc.contacts
      .delete({ id: gone.id })
      .then(() => {
        for (const reload of mounted) reload.current();
      })
      .catch((cause: unknown) => {
        // Already deleted elsewhere: the goal is met, so keep it hidden and just refresh.
        if ((cause as { code?: string } | null)?.code === "NOT_FOUND") {
          for (const reload of mounted) reload.current();
          return;
        }
        const next = new Set(hidden);
        next.delete(gone.id);
        setHidden(next);
        toast(errorText(cause, t`Could not delete ${gone.name}`));
        for (const reload of mounted) reload.current();
      });
  }, UNDO_SEND_MS);
  held.set(gone.id, { timer, toastId });
}

/** For tests: forgets held and finished deletes between cases. */
export function resetDeletedContacts() {
  for (const { timer } of held.values()) clearTimeout(timer);
  held.clear();
  setHidden(new Set());
}

/** The list without contacts that were deleted here, until the server's list says so too. */
export function useWithoutDeleted(contacts: Contact[] | null): Contact[] | null {
  const ids = useSyncExternalStore(
    (listener) => {
      subscribers.add(listener);
      return () => void subscribers.delete(listener);
    },
    () => hidden,
  );
  return contacts && ids.size > 0 ? contacts.filter((c) => !ids.has(c.id)) : contacts;
}

/**
 * The toasts, the Undo for a deleted contact and the just-saved row that Contacts and Cap table
 * share. `container` holds the rows (each with `data-contact-id`); `contacts` is the loaded list.
 */
export function useContactNotices(
  /** `restoredId` is set when an Undo brought a contact back. */
  reload: (restoredId?: string) => void,
  container: RefObject<HTMLElement | null>,
  contacts: Contact[] | null,
) {
  // A finished delete refreshes whichever list is on screen.
  const latestReload = useRef(reload);
  latestReload.current = reload;
  useEffect(() => {
    mounted.add(latestReload);
    return () => void mounted.delete(latestReload);
  }, []);

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

  /**
   * A contact was deleted. With `undoable` (the default) the server has not been told yet: the contact is
   * hidden and the delete is held for the Undo window. Otherwise it was confirmed and is already gone.
   */
  const deleted = (gone: Contact, undoable = true) => {
    if (!undoable) {
      reload();
      toast(t`Deleted ${gone.name}`);
      return;
    }
    const { name, id } = gone;
    const toastId = toast(t`Deleted ${name}`, {
      label: t`Undo`,
      onClick: () => {
        if (!cancelHeldDelete(id)) return;
        toast(t`Restored ${name}`);
        reload(id);
        setSavedId(id);
        setFocusId(id);
      },
    });
    holdDelete(gone, toastId);
  };

  return { notify: toast, savedId, setSavedId, setFocusId, deleted };
}
