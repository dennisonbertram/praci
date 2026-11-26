import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ComposeRestore } from "../components/ComposeEmail";
import {
  closeRestored,
  createAgentSendWatch,
  getOutbox,
  holdCommit,
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

const leaveListeners = () =>
  (vi.mocked(window.addEventListener).mock.calls as unknown[][]).filter(
    ([type]) => type === "beforeunload",
  );

it("asks the browser to confirm leaving while a send is held", async () => {
  vi.spyOn(window, "addEventListener");
  vi.spyOn(window, "removeEventListener");
  holdSend(() => Promise.resolve(null), restore);
  const [[, handler]] = leaveListeners() as [
    [string, (event: { preventDefault: () => void }) => void],
  ];
  expect(handler).toBeTypeOf("function");
  const event = { preventDefault: vi.fn() };
  handler(event);
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", handler);
});

it("stops asking once the send is undone", () => {
  vi.spyOn(window, "addEventListener");
  vi.spyOn(window, "removeEventListener");
  holdSend(() => Promise.resolve(null), restore);
  const [, handler] = leaveListeners()[0] as [string, () => void];
  undoSend();
  expect(window.removeEventListener).toHaveBeenCalledWith("beforeunload", handler);
});

it("never asks to confirm leaving for a discard or a chat card's commit", () => {
  vi.spyOn(window, "addEventListener");
  holdDiscard(() => Promise.resolve(undefined), restore);
  holdCommit(
    () => Promise.resolve(undefined),
    () => undefined,
  );
  expect(leaveListeners()).toEqual([]);
});

it("does not ask to confirm leaving in the desktop app, whose window it would block", () => {
  vi.spyOn(window, "addEventListener");
  const desktop = window as unknown as { rakazoDesktop?: unknown };
  desktop.rakazoDesktop = {};
  try {
    holdSend(() => Promise.resolve(null), restore);
    expect(leaveListeners()).toEqual([]);
  } finally {
    delete desktop.rakazoDesktop;
  }
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

it("holds a generic commit, runs it after the window and reports it went out", async () => {
  const commit = vi.fn().mockResolvedValue(undefined);
  const onEnd = vi.fn();
  holdCommit(commit, onEnd);
  expect(getOutbox().view).toEqual({ kind: "sending", undoable: true });
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS - 1);
  expect(commit).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(commit).toHaveBeenCalledTimes(1);
  expect(onEnd).toHaveBeenCalledWith(null);
  expect(getOutbox().view).toEqual({ kind: "sent" });
});

it("undo prevents a held commit and opens no composer", async () => {
  const commit = vi.fn().mockResolvedValue(undefined);
  const onEnd = vi.fn();
  holdCommit(commit, onEnd);
  undoSend();
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  expect(commit).not.toHaveBeenCalled();
  expect(onEnd).toHaveBeenCalledWith(undefined);
  expect(getOutbox()).toEqual({ view: null, restoring: null });
});

it("a failed commit clears the toast, opens no composer and reports the reason", async () => {
  const onEnd = vi.fn();
  holdCommit(() => Promise.reject(new Error("Mail is off")), onEnd);
  await vi.advanceTimersByTimeAsync(UNDO_SEND_MS);
  expect(onEnd).toHaveBeenCalledWith("Mail is off");
  expect(getOutbox()).toEqual({ view: null, restoring: null });
});
