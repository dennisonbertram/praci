import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { rpc } from "./rpc";

/** Dispatched on `window` when a notification arrives or is seen (see the app-root subscription). */
export const NOTIFICATIONS_CHANGED_EVENT = "rakazo:notifications-changed";

/** Sidebar page key for an app path, matching the `surface` of its notifications. */
export function surfaceOfPath(pathname: string): string | null {
  const key = /^\/app\/(inbox|finance|legal|cap-table|data-room|artifacts)(\/|$)/.exec(
    pathname,
  )?.[1];
  return key ?? null;
}

const subscribeAttention = (notify: () => void) => {
  window.addEventListener("focus", notify);
  window.addEventListener("blur", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    window.removeEventListener("focus", notify);
    window.removeEventListener("blur", notify);
    document.removeEventListener("visibilitychange", notify);
  };
};
const isAttended = () => document.visibilityState === "visible" && document.hasFocus();

/** True while the tab is visible and focused: the only time anything may be marked seen or read. */
export function useAttended() {
  return useSyncExternalStore(subscribeAttention, isAttended, () => false);
}

type Glance = Awaited<ReturnType<typeof rpc.notifications.glance>>;
const EMPTY: Glance = {
  financeRunwayMonths: null,
  legalDueSoon: 0,
  dataRoomWaiting: 0,
  botKinds: {},
};

/**
 * Unseen notification counts and glance values for the sidebar. Refreshes on mount, on every page
 * change and on `rakazo:notifications-changed`. A page or agent thread is marked seen only while the
 * tab is visible and focused, so a background tab never suppresses a push; it is marked when the
 * user comes back.
 */
export function useSidebarGlance(
  pathname: string,
  thread?: { botId: string | null; threadId: string } | null,
) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [glance, setGlance] = useState<Glance>(EMPTY);
  const attended = useAttended();

  const refresh = useCallback(() => {
    void Promise.all([rpc.notifications.unseenCounts(), rpc.notifications.glance()])
      .then(([unseen, values]) => {
        setCounts(unseen.counts);
        setGlance(values);
      })
      .catch(() => undefined);
  }, []);

  useEffect(refresh, [refresh, pathname]);
  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
  }, [refresh]);

  const surface = surfaceOfPath(pathname);
  const unseenHere = surface ? (counts[surface] ?? 0) : 0;
  useEffect(() => {
    if (!attended || !surface || unseenHere === 0) return;
    void rpc.notifications
      .markSeen({ surface })
      .then(refresh)
      .catch(() => undefined);
  }, [attended, surface, unseenHere, refresh]);

  // Viewing an agent's thread clears every unseen notification from that agent. They are raised on
  // the thread or on a page surface (legal, finance, carta) with or without a thread id, so the
  // scope is the agent, not the thread.
  const threadBotId = thread?.botId;
  const statusHere = threadBotId ? glance.botKinds[threadBotId] : undefined;
  useEffect(() => {
    if (!attended || !threadBotId || !statusHere) return;
    void rpc.notifications
      .markSeen({ botId: threadBotId })
      .then(refresh)
      .catch(() => undefined);
  }, [attended, threadBotId, statusHere, refresh]);

  return { counts, glance };
}
