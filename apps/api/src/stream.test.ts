import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEARTBEAT, withHeartbeat } from "./stream.js";

function neverEnding() {
  const returned = vi.fn(async () => ({ done: true as const, value: undefined }));
  const source: AsyncIterator<number> = {
    next: () => new Promise<IteratorResult<number>>(() => {}),
    return: returned,
  };
  return { source, returned };
}

describe("withHeartbeat", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits a heartbeat after a quiet heartbeatMs", async () => {
    const { source } = neverEnding();
    const it = withHeartbeat(source, { heartbeatMs: 100, recheckMs: 50 });
    const first = it.next();
    await vi.advanceTimersByTimeAsync(100);
    expect((await first).value).toBe(HEARTBEAT);
  });

  it("ends with UNAUTHORIZED when the session re-check fails", async () => {
    const { source, returned } = neverEnding();
    const stillAuthorized = vi.fn(async () => false);
    const it = withHeartbeat(source, { heartbeatMs: 100, recheckMs: 50, stillAuthorized });
    const first = it.next();
    const assertion = expect(first).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(returned).toHaveBeenCalled();
  });

  it("closes the source when the signal aborts", async () => {
    const { source, returned } = neverEnding();
    const ac = new AbortController();
    const it = withHeartbeat(source, { signal: ac.signal, heartbeatMs: 100, recheckMs: 50 });
    const first = it.next();
    ac.abort();
    await vi.advanceTimersByTimeAsync(100);
    await first;
    expect((await it.next()).done).toBe(true);
    expect(returned).toHaveBeenCalled();
  });
});
