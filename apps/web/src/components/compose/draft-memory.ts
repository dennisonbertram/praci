import type { ComposeRestore, ComposeSeed } from "../ComposeEmail";

/**
 * Closed composer recovery stays in this browser session and Space. Reply and Reply all share one
 * draft per message; new messages have their own key so closing one does not lose local text.
 */
const closed = new Map<string, ComposeRestore>();

const keyOf = (seed: ComposeSeed, spaceId: string | null) => {
  const item =
    seed.kind === "new"
      ? "new"
      : `${seed.kind === "forward" ? "forward" : "reply"}:${seed.messageId}`;
  return seed.kind === "new" ? `${spaceId ?? ""}:${item}` : item;
};

export function rememberClosed(
  seed: ComposeSeed,
  composer: ComposeRestore,
  spaceId = composer.spaceId ?? null,
) {
  if (seed.kind === "new" && composer.deliveryStatus !== "uncertain") return;
  closed.set(keyOf(seed, spaceId), composer);
}

/** The composer left open last time, if any. It stays until a send or Discard forgets it. */
export function recallClosed(
  seed: ComposeSeed,
  spaceId: string | null = null,
): ComposeRestore | undefined {
  return closed.get(keyOf(seed, spaceId));
}

export function forgetClosed(seed: ComposeSeed, spaceId: string | null = null) {
  closed.delete(keyOf(seed, spaceId));
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
