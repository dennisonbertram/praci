import {
  NOTIFICATION_HEARTBEAT_ID,
  type NotificationDto,
  type NotificationSignal,
} from "@rakazo/contracts";

export type NotificationStreamDeps = {
  subscribe: (signal: AbortSignal) => Promise<AsyncIterable<NotificationSignal>>;
  list: (since: string) => Promise<{ notifications: NotificationDto[]; nextCursor: string | null }>;
  /** Called once per new, unseen, unshown `attention` notification. */
  deliver: (n: NotificationDto) => void;
  sleep: (ms: number) => Promise<unknown>;
  now?: () => Date;
};

const MAX_BACKOFF_MS = 60_000;

/**
 * Follows `notifications.subscribe` until aborted. Heartbeats are ignored; every other frame
 * (a new notification or the server's catch-up marker) fetches what is newer than the last one
 * seen. `info` notifications only feed the sidebar dots, so they never reach `deliver`.
 * Reconnects with backoff and catches up on what it missed.
 */
export async function followNotifications(deps: NotificationStreamDeps, signal: AbortSignal) {
  // Start at connect time: notifications from before this session do not toast.
  let since = (deps.now?.() ?? new Date()).toISOString();
  const handled = new Set<string>();
  const catchUp = async () => {
    for (;;) {
      const page = await deps.list(since);
      for (const n of page.notifications) {
        if (n.createdAt > since) since = n.createdAt;
        if (handled.has(n.id)) continue;
        handled.add(n.id);
        if (n.importance === "attention" && !n.seenAt && !n.shownAt) deps.deliver(n);
      }
      // `since` only moves forward, so a full page of one timestamp cannot loop forever.
      if (!page.nextCursor || page.notifications.length === 0) return;
    }
  };
  let failures = 0;
  while (!signal.aborted) {
    try {
      const stream = await deps.subscribe(signal);
      await catchUp();
      failures = 0;
      for await (const frame of stream) {
        if (frame.id === NOTIFICATION_HEARTBEAT_ID) continue;
        await catchUp();
      }
    } catch {
      if (signal.aborted) return;
    }
    if (signal.aborted) return;
    failures += 1;
    await deps.sleep(Math.min(1000 * 2 ** Math.min(failures, 6), MAX_BACKOFF_MS));
  }
}
