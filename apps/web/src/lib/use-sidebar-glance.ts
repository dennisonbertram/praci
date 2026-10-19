import { useCallback, useEffect, useState } from "react";
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

type Glance = Awaited<ReturnType<typeof rpc.notifications.glance>>;
const EMPTY: Glance = {
  financeRunwayMonths: null,
  legalDueSoon: 0,
  dataRoomWaiting: 0,
  urgentBotIds: [],
};

/**
 * Unseen notification counts and glance values for the sidebar. Refreshes on mount, on every page
 * change and on `rakazo:notifications-changed`. Opening a page marks its surface seen.
 */
export function useSidebarGlance(pathname: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [glance, setGlance] = useState<Glance>(EMPTY);

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

  // The page on screen is being looked at, so its notifications count as seen, including new ones.
  const surface = surfaceOfPath(pathname);
  const unseenHere = surface ? (counts[surface] ?? 0) : 0;
  useEffect(() => {
    if (!surface || unseenHere === 0) return;
    void rpc.notifications
      .markSeen({ surface })
      .then(refresh)
      .catch(() => undefined);
  }, [surface, unseenHere, refresh]);

  return { counts, glance };
}
