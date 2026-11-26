import type { LegalContract, LegalContractRow, LegalContractStatus } from "@rakazo/contracts";
import { groupLegalContracts } from "@rakazo/contracts";
import { daysBetween } from "../../lib/legal-format";
import type { SortDir } from "../../lib/list-params";
import { sortBy } from "../../lib/list-params";

export const CONTRACT_SORTS = ["name", "term", "value", "deadline"] as const;
export type ContractSort = (typeof CONTRACT_SORTS)[number];
/** The server lists contracts by end date, soonest first; that stays the default. */
export const DEFAULT_CONTRACT_SORT = { field: "term", dir: "asc" } as const;

export type ContractFilters = {
  q?: string;
  type?: string;
  party?: string;
  status?: string;
};

/** "Expiring soon" is an active contract that ends within this many days. */
export const EXPIRING_DAYS = 90;
export const CONTRACT_STATUSES = ["active", "expiring", "expired"] as const;

/**
 * The stored status, except that an active contract that does not renew and whose end date has
 * passed is expired. The server keeps the stored status; the agent reads that one.
 */
export function contractStatus(c: LegalContract, today: string): LegalContractStatus {
  return c.status === "active" &&
    c.autoRenews !== true &&
    c.expirationDate !== null &&
    c.expirationDate < today
    ? "expired"
    : c.status;
}

export const OPTIONAL_STATUSES = ["terminated", "draft", "unknown"] as const;

const matchesStatus = (c: LegalContract, status: string, today: string) => {
  if (status !== "expiring") return contractStatus(c, today) === status;
  const days = c.expirationDate === null ? -1 : daysBetween(today, c.expirationDate);
  return (
    contractStatus(c, today) === "active" &&
    c.autoRenews !== true &&
    days >= 0 &&
    days <= EXPIRING_DAYS
  );
};

/** Contracts whose title or party names contain the search text and that match every set filter. */
export function filterContracts(
  contracts: LegalContract[],
  { q, type, party, status }: ContractFilters,
  today: string,
): LegalContract[] {
  const needle = q?.trim().toLowerCase();
  return contracts.filter(
    (c) =>
      (!needle ||
        [c.title, ...c.counterparties].some((text) => text.toLowerCase().includes(needle))) &&
      (!type || c.contractType === type) &&
      (!party || c.counterparties.includes(party)) &&
      (!status || matchesStatus(c, status, today)),
  );
}

const sum = (values: (number | null)[]) => {
  const present = values.filter((v): v is number => v !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
};
const earliest = (dates: (string | null)[]) =>
  dates.filter((d): d is string => d !== null).sort()[0] ?? null;

function contractKey(c: LegalContract, field: ContractSort) {
  if (field === "name") return c.title;
  if (field === "term") return c.expirationDate;
  if (field === "value") return c.valueCents === null ? null : Number(c.valueCents);
  return c.nextDeadline;
}

/** A group sorts by what its members add up to: the earliest date, the total value, its name. */
function rowKey(row: LegalContractRow, field: ContractSort) {
  if (row.kind === "single") return contractKey(row.contract, field);
  if (field === "name") return row.name;
  const keys = row.contracts.map((c) => contractKey(c, field));
  return field === "value" ? sum(keys as (number | null)[]) : earliest(keys as (string | null)[]);
}

/**
 * The table rows: contracts grouped as the server's similar-contract rule says, then filtered by
 * member (a group left with no members disappears), then sorted, members inside each group too.
 * With `grouped` off every contract is its own row.
 */
export function contractRows(
  contracts: LegalContract[],
  filters: ContractFilters,
  sort: { field: ContractSort; dir: SortDir },
  grouped: boolean,
  today: string,
): LegalContractRow[] {
  const keep = new Set(filterContracts(contracts, filters, today));
  const rows = groupLegalContracts(contracts).flatMap((row): LegalContractRow[] => {
    if (row.kind === "single") return keep.has(row.contract) ? [row] : [];
    const members = row.contracts.filter((c) => keep.has(c));
    if (members.length === 0) return [];
    if (!grouped) return members.map((contract) => ({ kind: "single", contract }));
    return [
      {
        ...row,
        contracts: sortBy(members, (c) => contractKey(c, sort.field), sort.dir),
      },
    ];
  });
  return sortBy(rows, (row) => rowKey(row, sort.field), sort.dir);
}
