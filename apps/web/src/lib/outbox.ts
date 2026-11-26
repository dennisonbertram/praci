import type { ComposeRestore } from "../components/ComposeEmail";

/** Fired on `window` after a message is sent, so the Inbox can refresh. */
export const MAIL_SENT_EVENT = "rakazo:mail-sent";

/**
 * How long Undo stays available after Send or Discard. Closing the tab inside this window sends
 * nothing: the message was saved as a draft first, so it stays in Gmail Drafts, and the browser
 * asks before leaving.
 */
export const UNDO_SEND_MS = 5_000;
const SENT_MS = 3_000;

export interface OutboxSnapshot {
  /** `sending` and `discarded` show Undo until the hold ends. */
  view: { kind: "sending"; undoable: boolean } | { kind: "discarded" } | { kind: "sent" } | null;
  /** A composer to reopen: after Undo, or after a send that did not go through. */
  restoring: ComposeRestore | null;
}

/** Called once a held item is over: null when it went out, the reason when it did not, undefined when undone. */
type HoldEnd = (problem: string | null | undefined) => void;

/** Sends the message; resolves to null when it went out, or to the reason it did not. */
type Run = () => Promise<string | null>;

let snapshot: OutboxSnapshot = { view: null, restoring: null };
let held:
  | {
      run: Run;
      restore?: ComposeRestore;
      discard: boolean;
      /** Asks the browser to confirm leaving while this is held. */
      leave: boolean;
      timer: ReturnType<typeof setTimeout>;
      onEnd?: HoldEnd;
    }
  | undefined;
let sentTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
/**
 * Asks the browser to confirm leaving while a held send could still be lost. Undo-friendly: the
 * text is already a draft. Not in the desktop app, whose window this would block from closing.
 */
function askBeforeLeaving(on: boolean) {
  if (typeof window === "undefined") return;
  if (!on) return void window.removeEventListener("beforeunload", onBeforeUnload);
  if (window.rakazoDesktop) return;
  window.addEventListener("beforeunload", onBeforeUnload);
}

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
  const { run, restore, discard, onEnd, leave } = held;
  held = undefined;
  if (leave) askBeforeLeaving(false);
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
    set({ view: null, ...(restore ? { restoring: { ...restore, notice: problem } } : {}) });
  }
  onEnd?.(problem);
}

function hold(
  run: Run,
  restore: ComposeRestore | undefined,
  discard: boolean,
  onEnd?: HoldEnd,
  leave = false,
) {
  if (held) {
    clearTimeout(held.timer);
    void fire();
  }
  clearTimeout(sentTimer);
  held = {
    run,
    restore,
    discard,
    onEnd,
    leave,
    timer: setTimeout(() => void fire(), UNDO_SEND_MS),
  };
  if (leave) askBeforeLeaving(true);
  set({ view: discard ? { kind: "discarded" } : { kind: "sending", undoable: true } });
}

/** Holds a send for `UNDO_SEND_MS`, then runs it. A send already held goes out first. */
export const holdSend = (run: Run, restore: ComposeRestore) =>
  hold(run, restore, false, undefined, true);

/**
 * Holds any other send (a chat card's Allow or Send) for `UNDO_SEND_MS`, then runs `commit`. Undo
 * runs nothing; `onEnd` tells the caller how it ended. A failure shows no composer.
 */
export const holdCommit = (commit: () => Promise<unknown>, onEnd: HoldEnd) =>
  hold(
    () =>
      commit().then(
        () => null,
        (cause) => (cause instanceof Error ? cause.message : ""),
      ),
    undefined,
    false,
    onEnd,
  );

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
  const { restore, onEnd, leave } = held;
  held = undefined;
  if (leave) askBeforeLeaving(false);
  set({ view: null, ...(restore ? { restoring: restore } : {}) });
  onEnd?.(undefined);
}

export const closeRestored = () => set({ restoring: null });

/**
 * Follows one agent thread's runs. An approved agent send happens in the run after the answer, so
 * when that run ends this announces `MAIL_SENT_EVENT`, and the Inbox and its conversations reload.
 */
export function createAgentSendWatch() {
  let approved = false;
  let wasRunning = false;
  return {
    sendApproved() {
      approved = true;
    },
    running(running: boolean) {
      if (wasRunning && !running && approved) {
        approved = false;
        window.dispatchEvent(new Event(MAIL_SENT_EVENT));
      }
      wasRunning = running;
    },
  };
}
