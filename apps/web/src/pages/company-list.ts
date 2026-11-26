import type { CompanyEdgeRecord, CompanyEntityRecord } from "@rakazo/contracts";
import { companyDateEnd } from "../lib/company-format";
import type { SortDir } from "../lib/list-params";
import { sortBy } from "../lib/list-params";

export const COMPANY_SORTS = ["name", "role", "since"] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];
export const DEFAULT_COMPANY_SORT = { field: "name", dir: "asc" } as const;

export type CompanyFilters = { q?: string; source?: string; type?: string };

/** An organisation's type, "other" when it has none recorded. */
const companyOrgType = (entity: CompanyEntityRecord): string =>
  String(entity.attrs.type ?? "other");

/** The organisation types present, for the Type filter. */
export const companyOrgTypes = (entities: CompanyEntityRecord[]): string[] =>
  [...new Set(entities.map(companyOrgType))].sort();

/** A person's or organisation's row: the entity with the role and start date shown beside it. */
export type CompanyRow = {
  entity: CompanyEntityRecord;
  role: string | null;
  since: string | null;
};

/** The kinds of source that back any of these rows, for the Source filter. */
export const companySources = (entities: CompanyEntityRecord[]): string[] =>
  [...new Set(entities.flatMap((e) => e.evidence.map((ev) => ev.sourceKind)))].sort();

/** An organisation's relationships with the company: the edges between it and the profile, in either direction. */
export function companyRelations(
  edges: CompanyEdgeRecord[],
  orgId: string,
  profileId: string | undefined,
): CompanyEdgeRecord[] {
  if (!profileId) return [];
  return edges.filter(
    (edge) =>
      (edge.fromId === orgId && edge.toId === profileId) ||
      (edge.fromId === profileId && edge.toId === orgId),
  );
}

/** When the current role began: the earliest start among roles still held today, or among all roles if none is. */
export function companySince(
  edges: Pick<CompanyEdgeRecord, "startsOn" | "endsOn">[],
  today: string,
): string | null {
  // Held today: not ended, and not a planned role that starts later.
  const current = edges.filter(
    (edge) =>
      (!edge.endsOn || companyDateEnd(edge.endsOn) >= today) &&
      (!edge.startsOn || edge.startsOn.date <= today),
  );
  const dates = (current.length > 0 ? current : edges).flatMap((edge) =>
    edge.startsOn ? [edge.startsOn.date] : [],
  );
  return dates.length > 0 ? dates.sort()[0]! : null;
}

/** Rows whose name or role contains the search text and that have evidence from the chosen source. */
export function filterCompanyRows(
  rows: CompanyRow[],
  { q, source, type }: CompanyFilters,
): CompanyRow[] {
  const needle = q?.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!needle ||
        [row.entity.displayName, row.role ?? ""].some((text) =>
          text.toLowerCase().includes(needle),
        )) &&
      (!source || row.entity.evidence.some((ev) => ev.sourceKind === source)) &&
      (!type || companyOrgType(row.entity) === type),
  );
}

export function companyRows(
  rows: CompanyRow[],
  filters: CompanyFilters,
  sort: { field: CompanySort; dir: SortDir },
): CompanyRow[] {
  return sortBy(
    filterCompanyRows(rows, filters),
    (row) => (sort.field === "name" ? row.entity.displayName : row[sort.field]),
    sort.dir,
  );
}
