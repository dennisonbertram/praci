import type { EquityRelationship } from "@rakazo/contracts";

/** "has" matches stakeholders holding at least one certificate, convertible or option grant. */
export type StakeholderHoldingFilter = "has" | "none";

/** active: still vesting; ending: vesting ends within 12 months; ended: all vested; none: no schedule. */
export type StakeholderVestingFilter = "active" | "ending" | "ended" | "none";

/** complete: every address field; incomplete: some; none: no address. */
export type StakeholderAddressFilter = "complete" | "incomplete" | "none";

/** Every filter group the stakeholder list can apply. Absent or empty means no filter. */
export type StakeholderFilterValue = {
  relationship?: (EquityRelationship | "none")[];
  costCenter?: string[];
  holdings?: StakeholderHoldingFilter[];
  vesting?: StakeholderVestingFilter[];
  addressCompleteness?: StakeholderAddressFilter[];
  country?: string[];
  createdFrom?: string;
  createdTo?: string;
};

type ListField =
  | "relationship"
  | "costCenter"
  | "holdings"
  | "vesting"
  | "addressCompleteness"
  | "country";

const LIST_KEYS: Record<ListField, string> = {
  relationship: "rel",
  costCenter: "cc",
  holdings: "hold",
  vesting: "vest",
  addressCompleteness: "addr",
  country: "country",
};

const DATE_KEYS = { createdFrom: "from", createdTo: "to" } as const;

const LIST_FIELDS = Object.keys(LIST_KEYS) as ListField[];

/** A comma-separated list; a missing or empty value reads as no filter. */
function readList(params: URLSearchParams, key: string): string[] | undefined {
  const raw = params.get(key);
  if (raw == null) return undefined;
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function writeList(params: Record<string, string | undefined>, key: string, items?: string[]) {
  params[key] = items && items.length > 0 ? items.join(",") : undefined;
}

/** Reads the stakeholder filters out of a URL's search params, ignoring keys it does not know. */
export function readFilters(params: URLSearchParams): StakeholderFilterValue {
  const value: StakeholderFilterValue = {};
  for (const field of LIST_FIELDS) {
    const items = readList(params, LIST_KEYS[field]);
    if (!items) continue;
    // The URL is written by writeFilters, so the values already carry the field's union type.
    (value as Record<string, string[] | undefined>)[field] = items;
  }
  const createdFrom = params.get(DATE_KEYS.createdFrom)?.trim();
  if (createdFrom) value.createdFrom = createdFrom;
  const createdTo = params.get(DATE_KEYS.createdTo)?.trim();
  if (createdTo) value.createdTo = createdTo;
  return value;
}

/**
 * Turns the filters into URL params, one key per group (`rel`, `cc`, `hold`, `addr`, `country`,
 * `from`, `to`). Every key is present and `undefined` when that group is not filtering, which
 * removes it from the URL.
 */
export function writeFilters(value: StakeholderFilterValue): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};
  for (const field of LIST_FIELDS) writeList(params, LIST_KEYS[field], value[field]);
  params[DATE_KEYS.createdFrom] = value.createdFrom?.trim() || undefined;
  params[DATE_KEYS.createdTo] = value.createdTo?.trim() || undefined;
  return params;
}

/** How many filter groups are narrowing the list (0 to 6), for the button's badge. */
export function activeFilterCount(value: StakeholderFilterValue): number {
  return Object.values(writeFilters(value)).filter((raw) => raw !== undefined).length;
}
