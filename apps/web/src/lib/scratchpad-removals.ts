import { t } from "@lingui/core/macro";
import type { ScratchpadItem } from "@rakazo/contracts";
import { enqueueNotificationToast, notificationToastManager } from "@rakazo/ui-web";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { UNDO_SEND_MS } from "./outbox";
import { rpc } from "./rpc";
import { errorText } from "./user-error";

type Snapshot = { hidden: ReadonlySet<string>; restored: string | null };

/**
 * Removing an open-work row waits out the Undo window here, outside any page, so the delete still
 * goes through if the section unmounts. Closing the tab inside the window deletes nothing, as with
 * an unsent email. `hidden` holds the ids of held and finished removals; the list drops them while
 * they are stale.
 */
const held = new Map<string, { timer: ReturnType<typeof setTimeout>; toastId: string }>();
let snapshot: Snapshot = { hidden: new Set(), restored: null };
const subscribers = new Set<() => void>();
const mounted = new Set<{ current: () => void }>();

function set(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const notify of subscribers) notify();
}

const reload = () => {
  for (const entry of mounted) entry.current();
};

/** Puts a held removal back and marks the row to stand out; false when it already went through. */
export function cancelHeldRemoval(id: string): boolean {
  const entry = held.get(id);
  if (!entry) return false;
  clearTimeout(entry.timer);
  held.delete(id);
  notificationToastManager.close(entry.toastId);
  const hidden = new Set(snapshot.hidden);
  hidden.delete(id);
  set({ hidden, restored: id });
  return true;
}

/** Hides the row and holds its delete for the Undo window. The server is not told yet. */
export function holdRemove(item: Pick<ScratchpadItem, "id" | "title">) {
  if (held.has(item.id)) return;
  const toastId = `scratchpad-remove-${item.id}`;
  set({ hidden: new Set(snapshot.hidden).add(item.id) });
  const id = item.id;
  const title = item.title;
  enqueueNotificationToast({
    id: toastId,
    title: t`Removed ${title}`,
    timeout: UNDO_SEND_MS,
    action: { label: t`Undo`, onClick: () => void cancelHeldRemoval(id) },
  });
  const timer = setTimeout(() => {
    held.delete(id);
    notificationToastManager.close(toastId);
    rpc.scratchpad
      .remove({ itemId: id })
      .then(reload)
      .catch((cause: unknown) => {
        const hidden = new Set(snapshot.hidden);
        hidden.delete(id);
        set({ hidden });
        enqueueNotificationToast({
          id: `${toastId}-failed`,
          title: errorText(cause, t`Could not remove ${title}`),
        });
        reload();
      });
  }, UNDO_SEND_MS);
  held.set(id, { timer, toastId });
}

/** For tests: forgets held removals between cases. */
export function resetHeldRemovals() {
  for (const { timer } of held.values()) clearTimeout(timer);
  held.clear();
  set({ hidden: new Set(), restored: null });
}

/**
 * The ids hidden by a held removal, the row an Undo just brought back, and the refresh a finished
 * removal runs. One section is on screen at a time; each call registers its own reload.
 */
export function useHeldRemovals(refresh: () => void) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    const entry = { current: () => latest.current() };
    mounted.add(entry);
    return () => void mounted.delete(entry);
  }, []);
  const current = useSyncExternalStore(
    (notify) => {
      subscribers.add(notify);
      return () => void subscribers.delete(notify);
    },
    () => snapshot,
  );
  return {
    hiddenIds: current.hidden,
    restoredId: current.restored,
    clearRestored: () => set({ restored: null }),
  };
}
