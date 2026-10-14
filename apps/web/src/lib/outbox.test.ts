import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComposeRestore } from "../components/ComposeEmail";
import { closeRestored, getOutbox, holdSend, UNDO_SEND_MS, undoSend } from "./outbox";

const restore = { clientId: "abcdefgh" } as ComposeRestore;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
});
afterEach(() => {
  closeRestored();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("sends only after the undo window", async () => {
  const run = vi.fn().mockResolvedValue(null);
  holdSend(run, restore);
  expect(getOutbox().view).toEqual({ kind: "sending", undoable: true });
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS - 1);
  expect(run).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(1);
  expect(getOutbox().view).toEqual({ kind: "sent" });
  await vi.advanceTimersByTimeAsync(5_000);
  expect(getOutbox().view).toBeNull();
});

it("undo cancels the send and hands the composer back", async () => {
  const run = vi.fn().mockResolvedValue(null);
  holdSend(run, restore);
  await vi.advanceTimersByTimeAsync(2_000);
  undoSend();
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  expect(run).not.toHaveBeenCalled();
  expect(getOutbox()).toEqual({ view: null, restoring: restore });
});

it("reopens the composer with the reason when the send fails", async () => {
  holdSend(() => Promise.resolve("Couldn't send. Try again."), restore);
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  expect(getOutbox().view).toBeNull();
  expect(getOutbox().restoring).toMatchObject({
    clientId: "abcdefgh",
    notice: "Couldn't send. Try again.",
  });
});

it("sends a held message at once when another is sent", async () => {
  const first = vi.fn().mockResolvedValue(null);
  holdSend(first, restore);
  holdSend(vi.fn().mockResolvedValue(null), restore);
  expect(first).toHaveBeenCalledTimes(1);
});
