import * as z from "zod";
import { Id, IsoDate } from "../ids.js";
import { EquityCents, EquityDate, EquityDecimal, EquityShares } from "./common.js";
import { EquityClassTypeSchema } from "./share-classes.js";

/** The overview tab: the cap table by share class from the ledger, as of a date. */
export const EquityOverviewInputSchema = z.object({ asOf: EquityDate.optional() }).default({});

export const EquityOverviewClassRowSchema = z.object({
  shareClassId: Id,
  name: z.string(),
  classType: EquityClassTypeSchema,
  authorizedShares: EquityShares,
  outstandingShares: EquityShares,
  /** Percent with 4 places, e.g. "12.3456". */
  outstandingPercent: EquityDecimal,
  fullyDilutedShares: EquityShares,
  fullyDilutedPercent: EquityDecimal,
  amountRaisedCents: EquityCents,
});
export type EquityOverviewClassRow = z.infer<typeof EquityOverviewClassRowSchema>;

export const EquityOverviewPlanRowSchema = z.object({
  planId: Id,
  name: z.string(),
  outstandingShares: EquityShares,
  availableShares: EquityShares,
  fullyDilutedPercent: EquityDecimal,
});
export type EquityOverviewPlanRow = z.infer<typeof EquityOverviewPlanRowSchema>;

export const EquityOverviewConvertibleRowSchema = z.object({
  blockId: Id.nullable(),
  name: z.string(),
  principalCents: EquityCents,
  interestCents: EquityCents,
  outstandingDebtCents: EquityCents,
  amountRaisedCents: EquityCents,
});
export type EquityOverviewConvertibleRow = z.infer<typeof EquityOverviewConvertibleRowSchema>;

export const EquityOverviewSchema = z.object({
  /** False before anything is in the ledger: the page shows the empty state. */
  hasLedger: z.boolean(),
  /** A snapshot exists to copy in, and the ledger is still empty. */
  canImport: z.boolean(),
  importedAt: IsoDate.nullable(),
  asOf: EquityDate,
  totals: z.object({
    outstandingShares: EquityShares,
    fullyDilutedShares: EquityShares,
    commonShares: EquityShares,
    preferredShares: EquityShares,
    availablePlanShares: EquityShares,
    amountRaisedCents: EquityCents,
  }),
  classes: z.array(EquityOverviewClassRowSchema),
  plans: z.array(EquityOverviewPlanRowSchema),
  convertibles: z.array(EquityOverviewConvertibleRowSchema),
  counts: z.object({
    stakeholders: z.number().int().nonnegative(),
    shareClasses: z.number().int().nonnegative(),
    plans: z.number().int().nonnegative(),
    certificates: z.number().int().nonnegative(),
    convertibles: z.number().int().nonnegative(),
    optionGrants: z.number().int().nonnegative(),
    fundingRounds: z.number().int().nonnegative(),
  }),
});
export type EquityOverview = z.infer<typeof EquityOverviewSchema>;

/** What copying the snapshot into the ledger created. */
export const EquityImportResultSchema = z.object({
  stakeholders: z.number().int().nonnegative(),
  shareClasses: z.number().int().nonnegative(),
  plans: z.number().int().nonnegative(),
  certificates: z.number().int().nonnegative(),
  convertibles: z.number().int().nonnegative(),
  optionGrants: z.number().int().nonnegative(),
});
export type EquityImportResult = z.infer<typeof EquityImportResultSchema>;
