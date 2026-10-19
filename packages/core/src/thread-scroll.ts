export type ThreadScrollState = {
  detached: boolean;
  unread: boolean;
  /** Messages from the other party that arrived while the reader was scrolled up. */
  newCount: number;
};

export function reconcileThreadScrollState(
  previous: ThreadScrollState,
  next: ThreadScrollState,
): ThreadScrollState {
  return previous.detached === next.detached &&
    previous.unread === next.unread &&
    previous.newCount === next.newCount
    ? previous
    : next;
}

/** Stored messages only: live progress and subagent rows have no place in the read boundary. */
export function isStoredMessage(message: { id: string }): boolean {
  return !message.id.startsWith("progress:") && !message.id.startsWith("subagent:");
}

type ReadBoundaryMessage = { id: string; seq: number; role: string };

/** The first message from the other party after the read boundary, where the "New" divider goes. */
export function firstUnreadMessageId(
  messages: readonly ReadBoundaryMessage[],
  lastReadSeq: number | undefined,
): string | null {
  if (lastReadSeq === undefined) return null;
  return messages.find((m) => m.role !== "user" && m.seq > lastReadSeq)?.id ?? null;
}

/**
 * Live rows carry the event's seq, not the message's, so positions after the thread opened are
 * compared by list order and id, never by seq.
 */
function indexOfId(messages: readonly ReadBoundaryMessage[], id: string | null | undefined) {
  return id ? messages.findIndex((m) => m.id === id) : -1;
}

/** The newest message at or before the read boundary; only valid on a freshly loaded page. */
export function lastReadMessageId(
  messages: readonly ReadBoundaryMessage[],
  lastReadSeq: number | undefined,
): string | null {
  if (lastReadSeq === undefined) return messages.at(-1)?.id ?? null;
  return messages.findLast((m) => m.seq <= lastReadSeq)?.id ?? null;
}

/** Whichever of two message ids comes later in the list. */
export function laterMessageId(
  messages: readonly ReadBoundaryMessage[],
  a: string | null,
  b: string | null,
): string | null {
  return indexOfId(messages, b) > indexOfId(messages, a) ? b : a;
}

/** Messages from the other party after `afterId`, for the "{n} new messages" pill. In-place updates add none. */
export function newMessagesAfter<T extends ReadBoundaryMessage>(
  messages: readonly T[],
  afterId: string | null,
  counts: (message: T) => boolean = () => true,
): number {
  const index = indexOfId(messages, afterId);
  if (index < 0) return 0;
  return messages.slice(index + 1).filter((m) => m.role !== "user" && counts(m)).length;
}

/** The divider clears once the reader sends a message after `afterId` (the newest message when it opened). */
export function userRepliedAfter(
  messages: readonly ReadBoundaryMessage[],
  afterId: string | null,
): boolean {
  const index = indexOfId(messages, afterId);
  return index >= 0 && messages.slice(index + 1).some((m) => m.role === "user");
}
