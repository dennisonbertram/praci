import { ORPCError } from "@orpc/server";

export const HEARTBEAT = Symbol("heartbeat");

/**
 * Yields the source's events, or HEARTBEAT after `heartbeatMs` of silence (the in-flight read is
 * kept, so event order is preserved). After each wait it re-checks the session at most every
 * `recheckMs` and throws UNAUTHORIZED once it is revoked. Closes the source on exit.
 */
export async function* withHeartbeat<T>(
  source: AsyncIterator<T>,
  opts: {
    signal?: AbortSignal;
    stillAuthorized?: () => Promise<boolean>;
    heartbeatMs: number;
    recheckMs: number;
  },
): AsyncGenerator<T | typeof HEARTBEAT> {
  let pending: Promise<IteratorResult<T>> | undefined;
  let authorizedAt = Date.now();
  try {
    while (!opts.signal?.aborted) {
      pending ??= source.next();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const next = await Promise.race([
        pending,
        new Promise<typeof HEARTBEAT>((resolve) => {
          timer = setTimeout(() => resolve(HEARTBEAT), opts.heartbeatMs);
        }),
      ]).finally(() => clearTimeout(timer));
      if (opts.stillAuthorized && Date.now() - authorizedAt >= opts.recheckMs) {
        if (!(await opts.stillAuthorized())) throw new ORPCError("UNAUTHORIZED");
        authorizedAt = Date.now();
      }
      if (next === HEARTBEAT) {
        yield HEARTBEAT;
        continue;
      }
      pending = undefined;
      if (next.done) return;
      yield next.value;
    }
  } finally {
    // Not awaited: closing can queue behind a read that the abort has not landed on yet.
    void source.return?.(undefined)?.catch(() => {});
  }
}
