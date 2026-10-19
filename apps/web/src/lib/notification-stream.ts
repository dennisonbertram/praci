import {
  NOTIFICATION_HEARTBEAT_ID,
  type NotificationDto,
  type NotificationSignal,
} from "@rakazo/contracts";

export type NotificationStreamDeps = {
  subscribe: (signal: AbortSignal) => Promise<AsyncIterable<NotificationSignal>>;
  /** Oldest first; `cursor` is the keyset position (created time and id) after the last row seen. */
  list: (args: {
    since?: string;
    cursor?: string;
  }) => Promise<{ notifications: NotificationDto[]; nextCursor: string | null }>;
  /** Resolves "failed" when nothing could be shown; the notification is then retried. */
  deliver: (n: NotificationDto) => Promise<"toast" | "os" | "skipped" | "failed">;
  sleep: (ms: number) => Promise<unknown>;
  /** Called after every catch-up, so other views can refresh unseen counts. */
  changed?: () => void;
  now?: () => Date;
};

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;
/** A stream that lived this long, or sent a frame, counts as healthy. */
const HEALTHY_AFTER_MS = 30_000;
const MAX_DELIVERY_ATTEMPTS = 3;
/** Rows may commit after a newer one, so each catch-up starts this far back; ids dedupe the overlap. */
const OVERLAP_MS = 5000;

/** The keyset position just after a notification, in the format `notifications.list` expects. */
const cursorAfter = (n: Pick<NotificationDto, "createdAt" | "id">) => `${n.createdAt}|${n.id}`;
const cursorBefore = (iso: string) => `${new Date(Date.parse(iso) - OVERLAP_MS).toISOString()}|0`;

/**
 * Follows `notifications.subscribe` until aborted. Heartbeats are ignored; every other frame
 * (a new notification or the server's catch-up marker) fetches what is newer than the last one
 * seen. `info` notifications only feed the sidebar dots, so they never reach `deliver`. A failed
 * delivery is retried on later catch-ups, up to three times. Reconnects with a backoff that only
 * resets after the stream proved healthy.
 */
export async function followNotifications(deps: NotificationStreamDeps, signal: AbortSignal) {
  const now = () => (deps.now?.() ?? new Date()).getTime();
  // Start at connect time: notifications from before this session do not toast.
  const since = new Date(now()).toISOString();
  let cursor: string | undefined;
  let newest: string | undefined;
  const done = new Set<string>();
  const inFlight = new Set<string>();
  const failed = new Map<string, { n: NotificationDto; attempts: number }>();

  const attempt = (n: NotificationDto, attempts: number) => {
    if (inFlight.has(n.id)) return;
    inFlight.add(n.id);
    deps.deliver(n).then(
      (result) => settle(n, attempts, result),
      () => settle(n, attempts, "failed"),
    );
  };
  const settle = (n: NotificationDto, attempts: number, result: string) => {
    inFlight.delete(n.id);
    if (result === "failed" && attempts + 1 < MAX_DELIVERY_ATTEMPTS) {
      failed.set(n.id, { n, attempts: attempts + 1 });
      return;
    }
    failed.delete(n.id);
    done.add(n.id);
  };
  const catchUp = async () => {
    for (const { n, attempts } of [...failed.values()]) {
      failed.delete(n.id);
      attempt(n, attempts);
    }
    for (;;) {
      const page = await deps.list(cursor ? { cursor } : { since });
      for (const n of page.notifications) {
        if (!newest || n.createdAt > newest) newest = n.createdAt;
        if (done.has(n.id) || inFlight.has(n.id) || failed.has(n.id)) continue;
        if (n.importance === "attention" && !n.seenAt && !n.shownAt) attempt(n, 0);
        else done.add(n.id);
      }
      if (page.nextCursor) {
        cursor = page.nextCursor;
        continue;
      }
      if (newest) cursor = cursorBefore(newest);
      break;
    }
    deps.changed?.();
  };

  let failures = 0;
  while (!signal.aborted) {
    const startedAt = now();
    let healthy = false;
    let iterator: AsyncIterator<NotificationSignal> | undefined;
    try {
      iterator = (await deps.subscribe(signal))[Symbol.asyncIterator]();
      await catchUp();
      for (;;) {
        const next = await iterator.next();
        if (next.done) break;
        healthy = true;
        if (next.value.id === NOTIFICATION_HEARTBEAT_ID) continue;
        await catchUp();
      }
    } catch {
      if (signal.aborted) return;
    } finally {
      // Always release the server stream, including when the first list failed.
      await iterator?.return?.().catch(() => undefined);
    }
    if (signal.aborted) return;
    failures = healthy || now() - startedAt > HEALTHY_AFTER_MS ? 0 : failures + 1;
    await deps.sleep(Math.min(BASE_BACKOFF_MS * 2 ** Math.min(failures, 6), MAX_BACKOFF_MS));
  }
}
