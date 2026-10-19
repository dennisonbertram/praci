import type { RealtimeFanout } from "@rakazo/adapter-kit";

/**
 * Yields one event per message published on a realtime topic until the signal aborts. Without a
 * fanout, or when subscribing fails, the stream stays open and empty. Unsubscribes on exit.
 */
export async function* followRealtimeTopic<T>(
  realtime: RealtimeFanout | undefined,
  topic: string,
  toEvent: (payload: string) => T,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const queue: T[] = [];
  const waiters = new Set<() => void>();
  const unsubscribe = realtime
    ? await realtime
        .subscribe(topic, (payload) => {
          queue.push(toEvent(payload));
          for (const wake of [...waiters]) wake();
        })
        .catch(() => async () => {})
    : async () => {};
  try {
    while (!signal?.aborted) {
      const next = queue.shift();
      if (next !== undefined) {
        yield next;
        continue;
      }
      await new Promise<void>((resolve) => {
        const wake = () => {
          waiters.delete(wake);
          signal?.removeEventListener("abort", wake);
          resolve();
        };
        waiters.add(wake);
        signal?.addEventListener("abort", wake, { once: true });
        if (signal?.aborted) wake();
      });
    }
  } finally {
    waiters.clear();
    await unsubscribe();
  }
}
