import type { ComposeRestore } from "../components/ComposeEmail";

/** Fired on `window` after a message is sent, so the Inbox can refresh. */
export const MAIL_SENT_EVENT = "rakazo:mail-sent";

/** How long Undo stays available after Send. Closing the tab inside this window sends nothing. */
export const UNDO_SEND_MS = 5_000;
const SENT_MS = 3_000;

export interface OutboxSnapshot {
  /** `sending` shows Undo until the hold ends. */
  view: { kind: "sending"; undoable: boolean } | { kind: "sent" } | null;
  /** A composer to reopen: after Undo, or after a send that did not go through. */
  restoring: ComposeRestore | null;
}

/** Sends the message; resolves to null when it went out, or to the reason it did not. */
type Run = () => Promise<string | null>;

let snapshot: OutboxSnapshot = { view: null, restoring: null };
let held: { run: Run; restore: ComposeRestore; timer: ReturnType<typeof setTimeout> } | undefined;
let sentTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(next: Partial<OutboxSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

export const subscribeOutbox = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const getOutbox = () => snapshot;

async function fire() {
  if (!held) return;
  const { run, restore } = held;
  held = undefined;
  set({ view: { kind: "sending", undoable: false } });
  let problem: string | null;
  try {
    problem = await run();
  } catch (cause) {
    problem = cause instanceof Error ? cause.message : "";
  }
  if (problem === null) {
    window.dispatchEvent(new Event(MAIL_SENT_EVENT));
    set({ view: { kind: "sent" } });
    clearTimeout(sentTimer);
    sentTimer = setTimeout(() => set({ view: null }), SENT_MS);
  } else {
    set({ view: null, restoring: { ...restore, notice: problem } });
  }
}

/** Holds a send for `UNDO_SEND_MS`, then runs it. A send already held goes out first. */
export function holdSend(run: Run, restore: ComposeRestore) {
  if (held) {
    clearTimeout(held.timer);
    void fire();
  }
  clearTimeout(sentTimer);
  held = { run, restore, timer: setTimeout(() => void fire(), UNDO_SEND_MS) };
  set({ view: { kind: "sending", undoable: true } });
}

/** Cancels the held send and reopens its composer with everything in it. */
export function undoSend() {
  if (!held) return;
  clearTimeout(held.timer);
  const { restore } = held;
  held = undefined;
  set({ view: null, restoring: restore });
}

export const closeRestored = () => set({ restoring: null });
