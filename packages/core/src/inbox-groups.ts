// Pure grouping for the Inbox list. The viewer's local midnight decides Today, so callers pass `now`.
export type InboxGroupRow = { receivedAt: string; needsReply: boolean | null };

export function groupInbox<T extends InboxGroupRow>(
  rows: T[],
  now: Date,
): { needsReply: T[]; today: T[]; earlier: T[] } {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const groups = { needsReply: [] as T[], today: [] as T[], earlier: [] as T[] };
  for (const row of rows) {
    if (row.needsReply === true) groups.needsReply.push(row);
    else if (new Date(row.receivedAt).getTime() >= midnight) groups.today.push(row);
    else groups.earlier.push(row);
  }
  return groups;
}
