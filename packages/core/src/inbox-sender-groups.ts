/** The row fields grouping needs; the web and mobile list rows both have them. */
export interface SenderGroupRow {
  id: string;
  connectionId: string;
  from: string;
  fromAddress?: string;
  subject: string;
  snippet: string;
  reason: string | null;
  receivedAt: string;
  unread: boolean;
  inInbox: boolean;
  pile?: string | null;
}

export interface SenderGroup<T extends SenderGroupRow> {
  /** The lowercased sender address, or the display name when the row has no address. */
  key: string;
  /** The newest row's display name. */
  sender: string;
  /** Empty when the rows carry no address. */
  address: string;
  /** Rows in the group; the list has one row per thread. */
  count: number;
  unreadCount: number;
  newest: T;
  /** Newest first. */
  rows: T[];
}

const newestFirst = (a: SenderGroupRow, b: SenderGroupRow) =>
  Date.parse(b.receivedAt) - Date.parse(a.receivedAt) || b.id.localeCompare(a.id);

/** One group per sender, newest group first. Named for senders because `groupInbox` groups by date. */
export function groupBySender<T extends SenderGroupRow>(rows: T[]): SenderGroup<T>[] {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const key = (row.fromAddress ?? row.from).trim().toLowerCase();
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  return [...byKey]
    .map(([key, members]): SenderGroup<T> => {
      const sorted = [...members].sort(newestFirst);
      const newest = sorted[0] as T;
      return {
        key,
        sender: newest.from,
        address: newest.fromAddress ?? "",
        count: sorted.length,
        unreadCount: sorted.filter((r) => r.unread).length,
        newest,
        rows: sorted,
      };
    })
    .sort((a, b) => newestFirst(a.newest, b.newest));
}

/** The line a row shows under its subject: the model's summary, else the snippet. */
export const rowSummary = (row: Pick<SenderGroupRow, "reason" | "snippet">) =>
  row.reason?.trim() || row.snippet;

/** Ids a bulk archive may send: inbox rows only, and spam-pile rows only when `allowSpam`. */
export function archivableIds(rows: SenderGroupRow[], allowSpam: boolean): string[] {
  return rows
    .filter((row) => row.inInbox && (allowSpam || row.pile !== "spam"))
    .map((row) => row.id);
}
