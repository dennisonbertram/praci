import type { InboxBulkResult } from "@rakazo/contracts";
import { MAX_BULK_ARCHIVE } from "@rakazo/contracts";

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
  /**
   * Stable per sender: the smallest member address with +tags removed (lowercased), or the display
   * name when no row has an address. Rows that share an address, or a display name on one base domain, are one group.
   */
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

// ponytail: no public-suffix list. The base domain is the last two labels, or three under a short
// second-level label such as co.uk. Add a real list if a registry outside that pattern shows up.
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "ac"]);

function baseDomain(domain: string): string {
  const labels = domain.split(".");
  const tld = labels[labels.length - 1] ?? "";
  const second = labels[labels.length - 2] ?? "";
  return labels
    .slice(-(labels.length >= 3 && tld.length === 2 && SECOND_LEVEL.has(second) ? 3 : 2))
    .join(".");
}

/**
 * The identities a row answers to. Rows sharing any identity are one sender: the address without a
 * +tag, and (when the row has a real display name) that name on the same base domain. That joins
 * newsletters that send from several bounce, tag or subdomain addresses under one name.
 */
function senderIdentities(row: SenderGroupRow): { address: string | null; ids: string[] } {
  const full = (row.fromAddress ?? "").trim().toLowerCase();
  const at = full.lastIndexOf("@");
  if (at < 1) return { address: null, ids: [`name:${row.from.trim().toLowerCase()}`] };
  const domain = full.slice(at + 1);
  const address = `${full.slice(0, at).split("+")[0]}@${domain}`;
  const name = row.from.trim().replace(/\s+/g, " ").toLowerCase();
  const ids = [`address:${address}`];
  if (name !== full && name !== address) ids.push(`name:${name}|${baseDomain(domain)}`);
  return { address, ids };
}

/** One group per sender, newest group first. Named for senders because `groupInbox` groups by date. */
export function groupBySender<T extends SenderGroupRow>(rows: T[]): SenderGroup<T>[] {
  const parent = rows.map((_, index) => index);
  const find = (i: number): number => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i] as number] as number;
    return i;
  };
  const owner = new Map<string, number>();
  const identities = rows.map(senderIdentities);
  identities.forEach(({ ids }, index) => {
    for (const id of ids) {
      const other = owner.get(id);
      if (other === undefined) owner.set(id, index);
      else parent[find(index)] = find(other);
    }
  });
  const byRoot = new Map<number, number[]>();
  rows.forEach((_, index) => {
    const root = find(index);
    byRoot.set(root, [...(byRoot.get(root) ?? []), index]);
  });
  return [...byRoot.values()]
    .map((indexes): SenderGroup<T> => {
      const sorted = indexes.map((i) => rows[i] as T).sort(newestFirst);
      const newest = sorted[0] as T;
      // The smallest member address keeps the key steady when a new variant address arrives.
      const key =
        indexes
          .map((i) => identities[i]?.address ?? (identities[i]?.ids[0] ?? "").slice("name:".length))
          .sort()[0] ?? "";
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

/** The rows from the last `days` days, newest first: the content of a newsletter digest. */
export function digestRows<T extends SenderGroupRow>(rows: T[], now: Date, days = 7): T[] {
  const cutoff = now.getTime() - days * 86_400_000;
  return rows.filter((row) => Date.parse(row.receivedAt) >= cutoff).sort(newestFirst);
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

/**
 * Runs a bulk archive or unarchive in slices the API accepts, one after another, and merges the results.
 * ponytail: a slice that throws ends the run and the caller sees only the error; the reloaded list shows what was done.
 */
export async function bulkInChunks(
  messageIds: string[],
  call: (messageIds: string[]) => Promise<InboxBulkResult>,
): Promise<InboxBulkResult> {
  const merged: InboxBulkResult = { done: [], failed: [] };
  for (let i = 0; i < messageIds.length; i += MAX_BULK_ARCHIVE) {
    const result = await call(messageIds.slice(i, i + MAX_BULK_ARCHIVE));
    merged.done.push(...result.done);
    merged.failed.push(...result.failed);
  }
  return merged;
}
