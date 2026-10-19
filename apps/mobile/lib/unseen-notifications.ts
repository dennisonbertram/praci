import * as Notifications from "expo-notifications";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { rpc } from "./api";

type Counts = Readonly<Record<string, number>>;

let counts: Counts = {};
const listeners = new Set<() => void>();

function setCounts(next: Counts) {
  counts = next;
  for (const listener of listeners) listener();
}

export async function refreshUnseenCounts(): Promise<void> {
  try {
    const result = await rpc<{ counts: Counts }>("notifications/unseenCounts");
    setCounts(result.counts);
  } catch {
    // Keep the last counts; the next foreground or push retries.
  }
}

/** Clears the surface's dot at once, then tells the server. */
export async function markSurfaceSeen(surface: string): Promise<void> {
  if (counts[surface]) setCounts({ ...counts, [surface]: 0 });
  try {
    await rpc("notifications/markSeen", { surface });
  } catch {
    await refreshUnseenCounts();
  }
}

export function useUnseenCount(surface: string): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => counts[surface] ?? 0,
    () => 0,
  );
}

/** Refreshes the counts when the app comes to the foreground and when a push arrives. */
export function useUnseenCountsRefresh(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    void refreshUnseenCounts();
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshUnseenCounts();
    });
    const push = Notifications.addNotificationReceivedListener(() => void refreshUnseenCounts());
    return () => {
      app.remove();
      push.remove();
    };
  }, [enabled]);
}
