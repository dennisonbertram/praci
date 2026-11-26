import * as z from "zod";
import { Id, IsoDate } from "../ids.js";
import {
  EquityCents,
  EquityDate,
  EquityDecimal,
  EquityRecordBaseSchema,
  EquityShares,
  EquityText,
  equityListInput,
  equityPage,
} from "./common.js";

/** Values typed over the computed ones. */
export const EquityRoundOverridesSchema = z.object({
  cashRaisedCents: EquityCents.optional(),
  sharesIssued: EquityShares.optional(),
  fullyDilutedShares: EquityShares.optional(),
  postMoneyValuationCents: EquityCents.optional(),
});

const RoundFields = {
  name: EquityText,
  startDate: EquityDate,
  endDate: EquityDate.nullable().optional(),
  closingDate: EquityDate.nullable().optional(),
  originalIssuePrice: EquityDecimal.nullable().optional(),
  preMoneyValuationCents: EquityCents.nullable().optional(),
  overrides: EquityRoundOverridesSchema.optional(),
} as const;

export const EquityFundingRoundSchema = EquityRecordBaseSchema.extend({
  ...z.object(RoundFields).required().shape,
  /** Derived from member securities (or the overrides). */
  cashRaisedCents: EquityCents,
  sharesIssued: EquityShares,
  securityCount: z.number().int().nonnegative(),
  shareClassCount: z.number().int().nonnegative(),
});
export type EquityFundingRound = z.infer<typeof EquityFundingRoundSchema>;
export const EquityFundingRoundCreateInputSchema = z.object(RoundFields);
export type EquityFundingRoundCreateInput = z.input<typeof EquityFundingRoundCreateInputSchema>;
export const EquityFundingRoundUpdateInputSchema = z
  .object(RoundFields)
  .partial()
  .extend({ id: Id });
export const EquityFundingRoundListInputSchema = equityListInput(
  ["startDate", "name", "closingDate"],
  {},
);
export const EquityFundingRoundPageSchema = equityPage(EquityFundingRoundSchema);

export const EQUITY_DRAFT_SECURITY_KINDS = ["certificate", "option_grant", "convertible"] as const;
export const EquityDraftSecurityKindSchema = z.enum(EQUITY_DRAFT_SECURITY_KINDS);
export const EQUITY_DRAFT_SET_STATUSES = ["draft", "issued", "discarded"] as const;
export const EquityDraftSetStatusSchema = z.enum(EQUITY_DRAFT_SET_STATUSES);

export const EquityDraftSetSchema = EquityRecordBaseSchema.extend({
  name: EquityText,
  securityKind: EquityDraftSecurityKindSchema,
  status: EquityDraftSetStatusSchema,
  revision: z.number().int().positive().max(2_147_483_647),
  issuedIds: z.array(Id),
  /** Each item is the create input of its kind; validated when the set is issued. */
  items: z.array(z.record(z.string(), z.unknown())),
  issuedAt: IsoDate.nullable(),
});
export type EquityDraftSet = z.infer<typeof EquityDraftSetSchema>;
export const EquityDraftSetCreateInputSchema = z.object({
  name: EquityText,
  securityKind: EquityDraftSecurityKindSchema,
  items: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
});
/** Renames or replaces the items of a set that is still a draft. */
export const EquityDraftSetUpdateInputSchema = z.object({
  id: Id,
  expectedRevision: z.number().int().positive().max(2_147_483_647),
  name: EquityText.optional(),
  items: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
  status: z.literal("discarded").optional(),
});
export const EquityDraftSetListInputSchema = equityListInput(["updatedAt", "name"], {
  securityKind: EquityDraftSecurityKindSchema.optional(),
  status: z.array(EquityDraftSetStatusSchema).optional(),
});
export const EquityDraftSetPageSchema = equityPage(EquityDraftSetSchema);
