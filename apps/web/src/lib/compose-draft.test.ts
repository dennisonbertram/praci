import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDraftSaver } from "./compose-draft";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

it("saves only the latest value once typing pauses", async () => {
  const save = vi.fn(async (_value: string) => {});
  const saver = createDraftSaver(save, 1500);
  saver.change("a");
  await vi.advanceTimersByTimeAsync(1000);
  saver.change("ab");
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(600);
  expect(save.mock.calls).toEqual([["ab"]]);
});

it("never runs two saves at once, and saves what changed meanwhile afterwards", async () => {
  const gates = [deferred(), deferred()];
  let active = 0;
  let overlap = false;
  const seen: string[] = [];
  const save = vi.fn(async (value: string) => {
    overlap ||= active > 0;
    active++;
    seen.push(value);
    await gates[seen.length - 1]?.promise;
    active--;
  });
  const saver = createDraftSaver(save, 100);
  saver.change("one");
  await vi.advanceTimersByTimeAsync(100);
  expect(seen).toEqual(["one"]);
  saver.change("two");
  await vi.advanceTimersByTimeAsync(500);
  expect(seen).toEqual(["one"]);
  gates[0]?.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(seen).toEqual(["one", "two"]);
  gates[1]?.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(overlap).toBe(false);
});

it("flush saves a pending change immediately and waits for the save to finish", async () => {
  const gate = deferred();
  const save = vi.fn(async (_value: string) => gate.promise);
  const saver = createDraftSaver(save, 5000);
  saver.change("x");
  let flushed = false;
  const flushing = saver.flush().then(() => {
    flushed = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(save).toHaveBeenCalledWith("x");
  expect(flushed).toBe(false);
  gate.resolve();
  await flushing;
  expect(flushed).toBe(true);
  // The timer for the old change is gone: nothing saves twice.
  await vi.advanceTimersByTimeAsync(10_000);
  expect(save).toHaveBeenCalledTimes(1);
});

it("flush with nothing pending does not save, and cancel drops an unsaved change", async () => {
  const save = vi.fn(async (_value: string) => {});
  const saver = createDraftSaver(save, 100);
  await saver.flush();
  saver.change("dropped");
  saver.cancel();
  await vi.advanceTimersByTimeAsync(1000);
  await saver.flush();
  expect(save).not.toHaveBeenCalled();
});

it("keeps saving after one save fails", async () => {
  const save = vi
    .fn<(value: string) => Promise<void>>()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue();
  const saver = createDraftSaver(save, 100);
  saver.change("a");
  await vi.advanceTimersByTimeAsync(100);
  saver.change("b");
  await vi.advanceTimersByTimeAsync(100);
  expect(save.mock.calls).toEqual([["a"], ["b"]]);
});
