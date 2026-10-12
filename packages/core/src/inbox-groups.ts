// Stub: replaced by the implementation in the next commit.
export type InboxGroupRow = { receivedAt: string; needsReply: boolean | null };

export function groupInbox<T extends InboxGroupRow>(
  _rows: T[],
  _now: Date,
): { needsReply: T[]; today: T[]; earlier: T[] } {
  return { needsReply: [], today: [], earlier: [] };
}
