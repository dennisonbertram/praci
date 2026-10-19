import { firstUnreadMessageId, userRepliedAfter } from "@rakazo/core";

type Message = { id: string; seq: number; role: string };

/** Where the "New" divider sits for one open thread, fixed when the thread's first live snapshot arrives. */
export type UnreadAnchor = { key: string; dividerId: string | null; openedLatestId: string | null };

/** Keeps the anchor for `key`, or builds it from the first snapshot that carries a read boundary. */
export function openUnreadAnchor(
  previous: UnreadAnchor | null,
  key: string,
  lastReadSeq: number | undefined,
  messages: readonly Message[],
): UnreadAnchor | null {
  if (previous?.key === key) return previous;
  if (lastReadSeq === undefined) return null;
  return {
    key,
    dividerId: firstUnreadMessageId(messages, lastReadSeq),
    openedLatestId: messages.at(-1)?.id ?? null,
  };
}

/** The anchored message while it is still listed and the reader has not replied since opening. */
export function unreadDividerId(
  anchor: UnreadAnchor | null,
  messages: readonly Message[],
): string | null {
  if (!anchor?.dividerId) return null;
  if (!messages.some((message) => message.id === anchor.dividerId)) return null;
  return userRepliedAfter(messages, anchor.openedLatestId) ? null : anchor.dividerId;
}
