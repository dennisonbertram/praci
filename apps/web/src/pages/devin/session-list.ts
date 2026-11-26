import type { DevinSessionView } from "@rakazo/contracts";
import { prLabel } from "../../lib/devin-format";
import type { SortDir } from "../../lib/list-params";
import { sortBy } from "../../lib/list-params";

export const SESSION_SORTS = ["title", "status", "updated"] as const;
export type SessionSort = (typeof SESSION_SORTS)[number];
export const DEFAULT_SESSION_SORT = { field: "updated", dir: "desc" } as const;

export type SessionFilters = { q?: string; status?: string; source?: string };

/** Sessions whose title, question or pull request contains the search text and that match every set filter. */
export function filterSessions(
  sessions: DevinSessionView[],
  { q, status, source }: SessionFilters,
): DevinSessionView[] {
  const needle = q?.trim().toLowerCase();
  return sessions.filter(
    (s) =>
      (!needle ||
        [s.title, s.question ?? "", ...s.prs.map((pr) => prLabel(pr).ref)].some((text) =>
          text.toLowerCase().includes(needle),
        )) &&
      (!status || s.kind === status) &&
      (!source || s.origin === source),
  );
}

export function sortSessions(
  sessions: DevinSessionView[],
  sort: { field: SessionSort; dir: SortDir },
  statusName: (s: DevinSessionView) => string,
): DevinSessionView[] {
  return sortBy(
    sessions,
    (s) =>
      sort.field === "title"
        ? s.title || null
        : sort.field === "status"
          ? statusName(s)
          : s.updatedAt,
    sort.dir,
  );
}
