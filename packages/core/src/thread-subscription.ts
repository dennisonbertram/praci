import type { ProductEvent } from "@rakazo/contracts";
import { abortableDelay } from "./async.js";

type ThreadHead = { threadId: string; cursor: number };

/** No frame at all for this long means the stream is half-open; the server beats far faster. */
export const IDLE_TIMEOUT_MS = 45_000;

/** Recover a durable event stream while its caller owns snapshot commits and UI effects. */
export async function runThreadSubscription(options: {
  signal: AbortSignal;
  loadInitial: () => Promise<ThreadHead | null>;
  loadHead: () => Promise<ThreadHead | null>;
  refresh: () => Promise<unknown>;
  currentSnapshot: () => ThreadHead | null;
  subscribe: (cursor: number) => Promise<AsyncIterable<ProductEvent>>;
  beforeEvent?: (event: ProductEvent) => void;
  applyEvent: (event: ProductEvent) => void;
  onEvent: (event: ProductEvent, initial: ThreadHead) => void;
}): Promise<void> {
  const { signal } = options;
  const wait = async (ms: number) => {
    await abortableDelay(ms, signal);
    return !signal.aborted;
  };
  let initial = await options.loadInitial().catch(() => null);
  if (signal.aborted) return;
  // Only the server's own snapshot counts as loaded; a cached one may be stale.
  const fromServer = initial !== null;
  let headRetryMs = 250;
  while (!initial && !signal.aborted) {
    initial = await options.loadHead().catch(() => null);
    if (initial) break;
    if (!(await wait(headRetryMs))) return;
    headRetryMs = Math.min(headRetryMs * 2, 5_000);
  }
  if (!initial || signal.aborted) return;
  const head = initial;
  const cached = options.currentSnapshot();
  const cachedMatches = cached?.threadId === head.threadId;
  // Without a server snapshot, replay from the cached cursor so no event is skipped.
  let cursor = fromServer || !cachedMatches ? head.cursor : Math.min(head.cursor, cached.cursor);
  let snapshotReady = fromServer && cachedMatches;
  const pendingSnapshotEvents: ProductEvent[] = [];
  if (!snapshotReady) {
    void (async () => {
      let snapshotRetryMs = 250;
      while (!snapshotReady && !signal.aborted) {
        if (!(await wait(snapshotRetryMs))) return;
        const refreshed = await options.refresh().then(
          () => true,
          () => false,
        );
        if (signal.aborted) return;
        const committed = options.currentSnapshot();
        if (refreshed && committed?.threadId === head.threadId) {
          snapshotReady = true;
          for (const event of pendingSnapshotEvents.splice(0)) {
            if (event.seq > committed.cursor) options.applyEvent(event);
          }
          return;
        }
        snapshotRetryMs = Math.min(snapshotRetryMs * 2, 5_000);
      }
    })();
  }
  let retryMs = 250;
  while (!signal.aborted) {
    try {
      const events = await options.subscribe(cursor);
      const iterator = events[Symbol.asyncIterator]();
      try {
        let pending: Promise<IteratorResult<ProductEvent>> | undefined;
        while (!signal.aborted) {
          pending ??= iterator.next();
          let timer: ReturnType<typeof setTimeout> | undefined;
          const next = await Promise.race([
            pending,
            new Promise<"idle">((resolve) => {
              timer = setTimeout(() => resolve("idle"), IDLE_TIMEOUT_MS);
            }),
          ]).finally(() => clearTimeout(timer));
          // Abandon the iterator, not the caller's signal, so the loop below re-subscribes.
          if (next === "idle" || next.done) break;
          pending = undefined;
          const event = next.value;
          retryMs = 250;
          // Heartbeats only prove the socket is alive; they carry no state and no cursor.
          if (event.type === "heartbeat") continue;
          cursor = Math.max(cursor, event.seq);
          options.beforeEvent?.(event);
          if (snapshotReady && options.currentSnapshot()?.threadId === event.threadId) {
            options.applyEvent(event);
          } else if (!snapshotReady) {
            pendingSnapshotEvents.push(event);
          }
          options.onEvent(event, head);
        }
      } finally {
        // Not awaited: a half-open iterator can take as long to close as it took to go quiet.
        void iterator.return?.(undefined).catch(() => {});
      }
    } catch {
      // Reconnect from the last durable event after a transient transport failure.
    }
    if (signal.aborted) return;
    await options.refresh().catch(() => null);
    if (!(await wait(retryMs))) return;
    retryMs = Math.min(retryMs * 2, 5_000);
  }
}
