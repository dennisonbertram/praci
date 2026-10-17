import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComposeRestore } from "../components/ComposeEmail";
import {
  closeRestored,
  createAgentSendWatch,
  getOutbox,
  holdDiscard,
  holdSend,
  MAIL_SENT_EVENT,
  UNDO_SEND_MS,
  undoSend,
} from "./outbox";

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

it("runs a discard only after the undo window, with no sent notice", async () => {
  const run = vi.fn().mockResolvedValue(undefined);
  holdDiscard(run, restore);
  expect(getOutbox().view).toEqual({ kind: "discarded" });
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS - 1);
  expect(run).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(1);
  expect(getOutbox()).toEqual({ view: null, restoring: null });
});

it("undo of a discard reopens the composer and never discards", async () => {
  const run = vi.fn().mockResolvedValue(undefined);
  holdDiscard(run, restore);
  await vi.advanceTimersByTimeAsync(1_000);
  undoSend();
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  expect(run).not.toHaveBeenCalled();
  expect(getOutbox()).toEqual({ view: null, restoring: restore });
});

it("announces an approved agent send once the run that sends it ends", () => {
  const sent = vi.fn();
  window.addEventListener(MAIL_SENT_EVENT, sent);
  const watch = createAgentSendWatch();
  // A run ending with no approved send announces nothing.
  watch.running(true);
  watch.running(false);
  expect(sent).not.toHaveBeenCalled();
  // Approved while the run waits; the send happens before the run ends.
  watch.running(true);
  watch.sendApproved();
  expect(sent).not.toHaveBeenCalled();
  watch.running(false);
  expect(sent).toHaveBeenCalledTimes(1);
  // Approved before the resumed run shows as running: it waits for that run to end.
  watch.sendApproved();
  watch.running(false);
  expect(sent).toHaveBeenCalledTimes(1);
  watch.running(true);
  watch.running(false);
  expect(sent).toHaveBeenCalledTimes(2);
});
