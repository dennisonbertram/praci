import type { ComposeRestore, ComposeSeed } from "../ComposeEmail";

/**
 * The last closed composer of each reply or forward, kept for this browser session so that opening
 * it again continues the same Gmail draft instead of starting a second. Reply and Reply all share
 * one draft per message: either button brings back what was typed, in the mode it was typed in.
 * A new message has no key. Not kept across reloads.
 */
const closed = new Map<string, ComposeRestore>();

const keyOf = (seed: ComposeSeed) =>
  seed.kind === "new" ? null : `${seed.kind === "forward" ? "forward" : "reply"}:${seed.messageId}`;

export function rememberClosed(seed: ComposeSeed, composer: ComposeRestore) {
  const key = keyOf(seed);
  if (key) closed.set(key, composer);
}

/** The composer left open last time, if any. It stays until a send or Discard forgets it. */
export function recallClosed(seed: ComposeSeed): ComposeRestore | undefined {
  const key = keyOf(seed);
  return key ? closed.get(key) : undefined;
}

export function forgetClosed(seed: ComposeSeed) {
  const key = keyOf(seed);
  if (key) closed.delete(key);
}

/**
 * Draft work (a save or a discard) for one client id, queued so it runs after everything already
 * queued for that draft, whichever composer started it. A task never waits on a later one, so a
 * send, an Undo and another send cannot wait on each other. The tail is forgotten once it settles.
 */
const chain = new Map<string, Promise<unknown>>();

export function enqueueDraftWork<T>(clientId: string, task: () => Promise<T>): Promise<T> {
  const run = (chain.get(clientId) ?? Promise.resolve()).then(task, task);
  chain.set(clientId, run);
  const clear = () => {
    if (chain.get(clientId) === run) chain.delete(clientId);
  };
  void run.then(clear, clear);
  return run;
}
