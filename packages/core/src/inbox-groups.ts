// Pure grouping for the Inbox list. The viewer's local midnight decides Today, so callers pass `now`.
import { priorityRank } from "./inbox-triage.js";

export type InboxGroupRow = {
  receivedAt: string;
  needsReply: boolean | null;
  priority?: string | null;
};

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
  groups.needsReply.sort(
    (a, b) =>
      priorityRank(a.priority ?? null) - priorityRank(b.priority ?? null) ||
      new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
  );
  return groups;
}

/** Whole days from the viewer's today to a YYYY-MM-DD due date; negative once it has passed. */
export function localDaysUntil(dueOn: string, now: Date): number {
  const [year = 0, month = 1, day = 1] = dueOn.split("-").map(Number);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(year, month - 1, day) - today) / 86_400_000);
}

/** Red when due today, past due or critical; amber within 2 days; plain otherwise. */
export function dueTone(days: number | null, priority: string | null): "crit" | "warn" | "none" {
  if (priority === "critical" || (days !== null && days <= 0)) return "crit";
  return days !== null && days <= 2 ? "warn" : "none";
}
