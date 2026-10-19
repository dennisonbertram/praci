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

/** Messages from the other party newer than `seq`, for the "{n} new messages" pill. */
export function newMessagesSince(messages: readonly ReadBoundaryMessage[], seq: number): number {
  return messages.reduce((n, m) => (m.role !== "user" && m.seq > seq ? n + 1 : n), 0);
}

/** The divider clears once the reader sends a message after the first unread one. */
export function userRepliedAfter(messages: readonly ReadBoundaryMessage[], seq: number): boolean {
  return messages.some((m) => m.role === "user" && m.seq > seq);
}
