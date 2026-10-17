// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("./rpc", () => ({ rpc: { inbox: { get: (input: unknown) => get(input) } } }));

let cache: typeof import("./inbox-message-cache");
beforeEach(async () => {
  get.mockReset();
  vi.resetModules();
  cache = await import("./inbox-message-cache");
});

it("dedupes concurrent loads and serves the cached value", async () => {
  get.mockResolvedValue({ id: "a" });
  const [one, two] = await Promise.all([cache.loadInboxMessage("a"), cache.loadInboxMessage("a")]);
  expect(one).toBe(two);
  expect(cache.peekInboxMessage("a")).toEqual({ id: "a" });
  await cache.loadInboxMessage("a");
  expect(get).toHaveBeenCalledTimes(1);
});

it("refetches after a failure", async () => {
  get.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ id: "a" });
  await expect(cache.loadInboxMessage("a")).rejects.toThrow("boom");
  await expect(cache.loadInboxMessage("a")).resolves.toEqual({ id: "a" });
  expect(get).toHaveBeenCalledTimes(2);
});

it("prefetch swallows errors", async () => {
  get.mockRejectedValue(new Error("boom"));
  cache.prefetchInboxMessage("a");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(cache.peekInboxMessage("a")).toBeUndefined();
});

it("evicts the oldest entry beyond 40", async () => {
  get.mockImplementation(async ({ messageId }) => ({ id: messageId }));
  for (let i = 0; i < 41; i++) await cache.loadInboxMessage(`m${i}`);
  expect(cache.peekInboxMessage("m0")).toBeUndefined();
  expect(cache.peekInboxMessage("m40")).toBeDefined();
});

afterEach(() => vi.useRealTimers());

it("pauses prefetching for 30 seconds after a failed load, but still opens messages", async () => {
  vi.useFakeTimers();
  get.mockRejectedValueOnce(new Error("boom"));
  await expect(cache.loadInboxMessage("a")).rejects.toThrow("boom");
  get.mockResolvedValue({ id: "b" });
  cache.prefetchInboxMessage("b");
  expect(get).toHaveBeenCalledTimes(1);
  await expect(cache.loadInboxMessage("b")).resolves.toEqual({ id: "b" });
  vi.advanceTimersByTime(30_001);
  cache.prefetchInboxMessage("c");
  expect(get).toHaveBeenCalledTimes(3);
});

it("loads a conversation again after mail is sent, so the reply shows in it", async () => {
  get.mockResolvedValueOnce({ id: "a", later: [] }).mockResolvedValueOnce({ id: "a", later: [{}] });
  await cache.loadInboxMessage("a");
  window.dispatchEvent(new Event("rakazo:mail-sent"));
  expect(cache.peekInboxMessage("a")).toBeUndefined();
  await expect(cache.loadInboxMessage("a")).resolves.toEqual({ id: "a", later: [{}] });
  expect(get).toHaveBeenCalledTimes(2);
});
