import * as Notifications from "expo-notifications";
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { currentApiBase, rpc, selectedSpaceId, subscribeApiBase } from "./api";
import { currentSessionGeneration, subscribeSessionGeneration } from "./session";

type Counts = Readonly<Record<string, number>>;

// Counts belong to one server, session and space; anything read for another scope is ignored.
const scopeKey = () => `${currentApiBase()}|${currentSessionGeneration()}|${selectedSpaceId()}`;

let state: { scope: string; counts: Counts } = { scope: "", counts: {} };
let requestSeq = 0;
// Refreshes that started before the latest markSeen may carry the old counts.
let minSeq = 0;
const listeners = new Set<() => void>();

function setCounts(scope: string, counts: Counts) {
  state = { scope, counts };
  for (const listener of listeners) listener();
}

export async function refreshUnseenCounts(): Promise<void> {
  const scope = scopeKey();
  const seq = ++requestSeq;
  try {
    const result = await rpc<{ counts: Counts }>("notifications/unseenCounts");
    if (scope === scopeKey() && seq >= minSeq) setCounts(scope, result.counts);
  } catch {
    // Keep the last counts; the next foreground or push retries.
  }
}

/** Clears the surface's dot at once, tells the server, then reads the counts again. */
export async function markSurfaceSeen(surface: string): Promise<void> {
  const scope = scopeKey();
  minSeq = ++requestSeq;
  if (state.scope === scope && state.counts[surface]) {
    setCounts(scope, { ...state.counts, [surface]: 0 });
  }
  try {
    await rpc("notifications/markSeen", { surface });
  } catch {
    // The refresh below restores the true count.
  }
  await refreshUnseenCounts();
}

export function useUnseenCount(surface: string): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => (state.scope === scopeKey() ? (state.counts[surface] ?? 0) : 0),
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
    const unsubscribeSession = subscribeSessionGeneration(() => void refreshUnseenCounts());
    const unsubscribeApi = subscribeApiBase(() => void refreshUnseenCounts());
    return () => {
      unsubscribeSession();
      unsubscribeApi();
      app.remove();
      push.remove();
    };
  }, [enabled]);
}
