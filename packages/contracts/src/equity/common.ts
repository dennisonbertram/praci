import * as z from "zod";
import { Id, IsoDate } from "../ids.js";

/**
 * Wire primitives for the cap table ledger. Stored share counts and cents are BigInt and prices
 * are Decimal, so on the wire they are strings: JSON numbers would lose precision past 2^53 and a
 * float must never reach a stored value. `packages/core/src/equity` parses them.
 */

export const EQUITY_POSTGRES_BIGINT_MIN = -(1n << 63n);
export const EQUITY_POSTGRES_BIGINT_MAX = (1n << 63n) - 1n;

const isPostgresBigInt = (value: string) =>
  /^\d{1,30}$/.test(value) && BigInt(value) <= EQUITY_POSTGRES_BIGINT_MAX;

/** A whole, non-negative number of shares, e.g. "12500000". */
export const EquityShares = z.string().refine(isPostgresBigInt, "a whole number of shares");
export const EquityPositiveShares = z
  .string()
  .refine(
    (value) => isPostgresBigInt(value) && BigInt(value) > 0n,
    "a positive whole number of shares",
  );
/** Whole US cents, non-negative, e.g. "150000000" for $1,500,000.00. */
export const EquityCents = z.string().refine(isPostgresBigInt, "whole cents");
/** A non-negative decimal with up to 10 places: a price per share, a ratio or a percent. */
export const EquityDecimal = z
  .string()
  .regex(/^\d{1,14}(\.\d{1,10})?$/, "a decimal with up to 10 places");
/** A calendar date, YYYY-MM-DD. */
export const EquityDate = z.string().date();
/** Client-generated UUID that makes a create retry-safe: the same key and terms replay the first result. */
export const EquityRequestKey = z.string().uuid().optional();
export const EquityText = z.string().trim().min(1).max(200);
export const EquityLongText = z.string().trim().max(5000);
export const EquityEmail = z.string().trim().toLowerCase().email().max(320);

export const EquityRecordBaseSchema = z.object({
  id: Id,
  createdAt: IsoDate,
  updatedAt: IsoDate,
});

export const EquitySortDirSchema = z.enum(["asc", "desc"]);

/**
 * The list input every ledger table takes, matching the web's `useListParams` (sort and dir) and
 * `ListControls` (search, filters). Pages are 1-based.
 */
export function equityListInput<
  const F extends readonly [string, ...string[]],
  Filters extends z.ZodRawShape,
>(sortFields: F, filters: Filters) {
  return z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(500).default(25),
    sort: z.object({ field: z.enum(sortFields), dir: EquitySortDirSchema }).optional(),
    search: z.string().trim().max(200).optional(),
    ...filters,
  });
}

/** One page of a list and the total that matched, for the pager. */
export function equityPage<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
}

/** A get by id. A record of another space or user is not found, like a missing one. */
export const EquityGetInputSchema = z.object({ id: Id });
