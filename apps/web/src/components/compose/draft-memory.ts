import type { ComposeRestore, ComposeSeed } from "../ComposeEmail";

/**
 * The last closed composer of each reply, reply all or forward, kept for this browser session so
 * that opening the same one again continues the same Gmail draft instead of starting a second.
 * A new message has no key. Not kept across reloads.
 */
const closed = new Map<string, ComposeRestore>();

const keyOf = (seed: ComposeSeed) =>
  seed.kind === "new" ? null : `${seed.kind}:${seed.messageId}`;

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
