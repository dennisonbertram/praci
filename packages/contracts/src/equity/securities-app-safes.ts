import * as z from "zod";
import { Id } from "../ids.js";
import { EquityCents, EquityDate, EquityDecimal } from "./common.js";
import { EquityValuationCapTypeSchema } from "./securities.js";

/**
 * A Fundraising SAFE (`Safe` in the Prisma schema) read into the cap table without being copied:
 * the row stays owned by Fundraising and the cap table only projects it.
 */
export const EquityAppSafeSchema = z.object({
  id: Id,
  investorName: z.string(),
  investorEmail: z.string().nullable(),
  principalCents: EquityCents,
  valuationCapCents: EquityCents.nullable(),
  valuationCapType: EquityValuationCapTypeSchema.nullable(),
  /** Percentage points with up to 10 decimals, e.g. "20.0000000000" for 20%. */
  discountPercent: EquityDecimal.nullable(),
  mfn: z.boolean(),
  proRata: z.boolean(),
  issueDate: EquityDate.nullable(),
});
export type EquityAppSafe = z.infer<typeof EquityAppSafeSchema>;

export const EquityAppSafeListInputSchema = z.object({
  search: z.string().trim().max(200).optional(),
});
export type EquityAppSafeListInput = z.input<typeof EquityAppSafeListInputSchema>;

/** The whole list, not a page: Fundraising SAFEs are few and the cap table reads all of them. */
export const EquityAppSafeListSchema = z.array(EquityAppSafeSchema);
export type EquityAppSafeList = z.infer<typeof EquityAppSafeListSchema>;

/** Records a Fundraising SAFE in the ledger as a convertible linked back to it. */
export const EquityAppSafeAddInputSchema = z.object({ safeId: z.string().min(1).max(100) });
