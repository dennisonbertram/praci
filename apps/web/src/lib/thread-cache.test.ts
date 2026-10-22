import type { ThreadSnapshot } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { rememberThread } from "./thread-cache";

const snap = (botId: string) => ({ botId, threadId: `t-${botId}` }) as unknown as ThreadSnapshot;

it("keeps the latest snapshot per bot and drops the least recently seen past the limit", () => {
  const cache = new Map<string, ThreadSnapshot>();
  rememberThread(cache, snap("a"), 2);
  rememberThread(cache, snap("b"), 2);
  rememberThread(cache, snap("a"), 2);
  rememberThread(cache, snap("c"), 2);
  expect([...cache.keys()]).toEqual(["a", "c"]);
});

it("ignores group threads and empty snapshots", () => {
  const cache = new Map<string, ThreadSnapshot>();
  rememberThread(cache, { groupId: "g", threadId: "t" } as unknown as ThreadSnapshot, 2);
  rememberThread(cache, null, 2);
  expect(cache.size).toBe(0);
});
