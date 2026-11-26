import { useEffect, useRef } from "react";

export const REFETCH_INTERVAL_MS = 60_000;
/** Returning to the tab fires `focus` and `visibilitychange` together; they count as one return. */
export const RETURN_DEDUPE_MS = 500;

/** Calls `onReturn` while `enabled`, once each time the window regains focus or becomes visible. */
export function useOnReturn(enabled: boolean, onReturn: () => void) {
  const latest = useRef(onReturn);
  latest.current = onReturn;
  useEffect(() => {
    if (!enabled) return;
    let lastReturn = Number.NEGATIVE_INFINITY;
    const handle = () => {
      const now = Date.now();
      if (now - lastReturn < RETURN_DEDUPE_MS || document.visibilityState !== "visible") return;
      lastReturn = now;
      latest.current();
    };
    window.addEventListener("focus", handle);
    document.addEventListener("visibilitychange", handle);
    return () => {
      window.removeEventListener("focus", handle);
      document.removeEventListener("visibilitychange", handle);
    };
  }, [enabled]);
}

/**
 * Calls `refetch` while `enabled`: when the window regains focus or becomes visible (once per return), when a
 * notification arrives, and every 60 seconds. Keeps a list of server-updated state fresh
 * without a reload.
 */
export function useRefetchWhileOpen(enabled: boolean, refetch: () => void) {
  const latest = useRef(refetch);
  latest.current = refetch;
  useOnReturn(enabled, refetch);
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const timer = setInterval(run, REFETCH_INTERVAL_MS);
    window.addEventListener("rakazo:notifications-changed", run);
    return () => {
      clearInterval(timer);
      window.removeEventListener("rakazo:notifications-changed", run);
    };
  }, [enabled]);
}
