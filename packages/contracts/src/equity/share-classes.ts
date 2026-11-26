import * as z from "zod";
import { Id } from "../ids.js";
import {
  EquityDate,
  EquityDecimal,
  EquityRecordBaseSchema,
  EquityShares,
  EquityText,
  equityListInput,
  equityPage,
} from "./common.js";

export const EQUITY_CLASS_TYPES = ["common", "preferred"] as const;
export const EquityClassTypeSchema = z.enum(EQUITY_CLASS_TYPES);
export type EquityClassType = z.infer<typeof EquityClassTypeSchema>;

export const EQUITY_DIVIDEND_ACCRUALS = [
  "daily",
  "monthly",
  "quarterly",
  "semi_annually",
  "annually",
] as const;
export const EquityDividendAccrualSchema = z.enum(EQUITY_DIVIDEND_ACCRUALS);
export const EQUITY_DAY_COUNT_CONVENTIONS = ["actual_365", "actual_360", "30_360"] as const;
export const EquityDayCountConventionSchema = z.enum(EQUITY_DAY_COUNT_CONVENTIONS);

/** A share class's terms as of one incorporation document date. */
const VersionFields = {
  documentDate: EquityDate,
  authorizedShares: EquityShares,
  votesPerShare: EquityDecimal.optional(),
  certificated: z.boolean().optional(),
  parValue: EquityDecimal.nullable().optional(),
  /** 1 is paid first. */
  seniority: z.number().int().min(1).max(100).optional(),
  pariPassu: z.boolean().optional(),
  originalIssuePrice: EquityDecimal.nullable().optional(),
  conversionPrice: EquityDecimal.nullable().optional(),
  conversionRatio: EquityDecimal.optional(),
  /** Liquidation preference multiple. */
  multiplier: EquityDecimal.optional(),
  participating: z.boolean().optional(),
  /** Multiple of the original issue price; null is uncapped. */
  participationCap: EquityDecimal.nullable().optional(),
  dividend: z.boolean().optional(),
  /** Percent per year. */
  dividendYield: EquityDecimal.nullable().optional(),
  cumulative: z.boolean().optional(),
  dividendAccrual: EquityDividendAccrualSchema.nullable().optional(),
  compoundingInterest: z.boolean().optional(),
  dayCountConvention: EquityDayCountConventionSchema.nullable().optional(),
} as const;

export const EquityShareClassVersionSchema = z.object(VersionFields).required().extend({ id: Id });
export type EquityShareClassVersion = z.infer<typeof EquityShareClassVersionSchema>;
export const EquityShareClassVersionInputSchema = z.object(VersionFields);
export type EquityShareClassVersionInput = z.input<typeof EquityShareClassVersionInputSchema>;

/** A share class with its current terms (the latest version) flattened in, and every version. */
export const EquityShareClassSchema = EquityRecordBaseSchema.extend({
  name: EquityText,
  /** Used in security labels, e.g. CS, PS. */
  prefix: z.string().trim().min(1).max(10),
  classType: EquityClassTypeSchema,
  current: EquityShareClassVersionSchema,
  versions: z.array(EquityShareClassVersionSchema),
});
export type EquityShareClass = z.infer<typeof EquityShareClassSchema>;

export const EquityShareClassCreateInputSchema = z.object({
  name: EquityText,
  prefix: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "capital letters and digits"),
  classType: EquityClassTypeSchema,
  /** The first version of the terms. */
  terms: EquityShareClassVersionInputSchema,
});
export type EquityShareClassCreateInput = z.input<typeof EquityShareClassCreateInputSchema>;

/**
 * Renames the class, or writes the terms of one document date: an existing date's version is
 * changed, a new date adds a version.
 */
export const EquityShareClassUpdateInputSchema = z.object({
  id: Id,
  name: EquityText.optional(),
  prefix: EquityShareClassCreateInputSchema.shape.prefix.optional(),
  terms: EquityShareClassVersionInputSchema.partial()
    .extend({ documentDate: EquityDate })
    .optional(),
});
export type EquityShareClassUpdateInput = z.input<typeof EquityShareClassUpdateInputSchema>;

export const EQUITY_SHARE_CLASS_SORT_FIELDS = [
  "name",
  "seniority",
  "classType",
  "createdAt",
] as const;
export const EquityShareClassListInputSchema = equityListInput(EQUITY_SHARE_CLASS_SORT_FIELDS, {
  classType: EquityClassTypeSchema.optional(),
  /** Terms as of this incorporation document date (default: the latest). */
  asOfDocumentDate: EquityDate.optional(),
});
export type EquityShareClassListInput = z.input<typeof EquityShareClassListInputSchema>;
export const EquityShareClassPageSchema = equityPage(EquityShareClassSchema);

export const EQUITY_PLAN_STATUSES = ["active", "inactive"] as const;
export const EquityPlanStatusSchema = z.enum(EQUITY_PLAN_STATUSES);

const PlanFields = {
  name: EquityText,
  status: EquityPlanStatusSchema.optional(),
  shareClassId: Id,
  reservedShares: EquityShares,
  boardApprovedOn: EquityDate.nullable().optional(),
} as const;

export const EquityPlanSchema = EquityRecordBaseSchema.extend({
  ...z.object(PlanFields).required().shape,
  /** Derived: granted and still outstanding, issued as shares, and left to grant. */
  outstandingShares: EquityShares,
  issuedShares: EquityShares,
  availableShares: EquityShares,
});
export type EquityPlan = z.infer<typeof EquityPlanSchema>;
export const EquityPlanCreateInputSchema = z.object(PlanFields);
export type EquityPlanCreateInput = z.input<typeof EquityPlanCreateInputSchema>;
export const EquityPlanUpdateInputSchema = z.object(PlanFields).partial().extend({ id: Id });
export type EquityPlanUpdateInput = z.input<typeof EquityPlanUpdateInputSchema>;
export const EQUITY_PLAN_SORT_FIELDS = ["name", "status", "reservedShares", "createdAt"] as const;
export const EquityPlanListInputSchema = equityListInput(EQUITY_PLAN_SORT_FIELDS, {
  status: EquityPlanStatusSchema.optional(),
});
export const EquityPlanPageSchema = equityPage(EquityPlanSchema);
