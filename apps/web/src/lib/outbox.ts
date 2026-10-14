import type { ComposeRestore } from "../components/ComposeEmail";

/** Fired on `window` after a message is sent, so the Inbox can refresh. */
export const MAIL_SENT_EVENT = "rakazo:mail-sent";

/** How long Undo stays available after Send or Discard. Closing the tab inside this window sends nothing. */
export const UNDO_SEND_MS = 5_000;
const SENT_MS = 3_000;

export interface OutboxSnapshot {
  /** `sending` and `discarded` show Undo until the hold ends. */
  view: { kind: "sending"; undoable: boolean } | { kind: "discarded" } | { kind: "sent" } | null;
  /** A composer to reopen: after Undo, or after a send that did not go through. */
  restoring: ComposeRestore | null;
}

/** Sends the message; resolves to null when it went out, or to the reason it did not. */
type Run = () => Promise<string | null>;

let snapshot: OutboxSnapshot = { view: null, restoring: null };
let held:
  | { run: Run; restore: ComposeRestore; discard: boolean; timer: ReturnType<typeof setTimeout> }
  | undefined;
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
  const { run, restore, discard } = held;
  held = undefined;
  if (discard) {
    set({ view: null });
    void run().catch(() => undefined);
    return;
  }
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

function hold(run: Run, restore: ComposeRestore, discard: boolean) {
  if (held) {
    clearTimeout(held.timer);
    void fire();
  }
  clearTimeout(sentTimer);
  held = { run, restore, discard, timer: setTimeout(() => void fire(), UNDO_SEND_MS) };
  set({ view: discard ? { kind: "discarded" } : { kind: "sending", undoable: true } });
}

/** Holds a send for `UNDO_SEND_MS`, then runs it. A send already held goes out first. */
export const holdSend = (run: Run, restore: ComposeRestore) => hold(run, restore, false);

/**
 * Holds a discard for `UNDO_SEND_MS`, then runs `run` (which removes the server draft). Undo
 * reopens the composer as it was.
 */
export const holdDiscard = (run: () => Promise<unknown>, restore: ComposeRestore) =>
  hold(() => run().then(() => null), restore, true);

/** Cancels the held send or discard and reopens its composer with everything in it. */
export function undoSend() {
  if (!held) return;
  clearTimeout(held.timer);
  const { restore } = held;
  held = undefined;
  set({ view: null, restoring: restore });
}

export const closeRestored = () => set({ restoring: null });
