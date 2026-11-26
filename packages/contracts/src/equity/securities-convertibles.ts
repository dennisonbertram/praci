import * as z from "zod";
import { Id } from "../ids.js";
import {
  EquityCents,
  EquityDate,
  EquityDecimal,
  EquityLongText,
  EquityShares,
  EquityText,
} from "./common.js";
import { EquityCertificateSchema, EquityConvertibleSchema } from "./securities.js";

/** Cancels an outstanding SAFE or note; the record stays, marked canceled. */
export const EquityConvertibleCancelInputSchema = z.object({
  id: Id,
  canceledOn: EquityDate,
  reason: EquityText,
  note: EquityLongText.optional(),
});
export type EquityConvertibleCancelInput = z.input<typeof EquityConvertibleCancelInputSchema>;

/** A priced round that SAFEs and notes convert into. */
export const EquityPricedRoundInputSchema = z
  .object({
    convertibleIds: z.array(Id).min(1).max(200),
    toShareClassId: Id,
    preMoneyValuationCents: EquityCents,
    newMoneyCents: EquityCents,
    /** The round's closing date: notes accrue interest to it and new certificates are issued on it. */
    asOf: EquityDate,
    /** The funding round the issued certificates belong to: an existing one, or a new one by name. */
    roundId: Id.nullable().optional(),
    newRoundName: z.string().trim().min(1).max(200).optional(),
  })
  .refine((input) => !(input.roundId && input.newRoundName), {
    message: "Choose a round or name a new one, not both",
  });
export type EquityPricedRoundInput = z.input<typeof EquityPricedRoundInputSchema>;

export const EquityPricedRoundPreviewSchema = z.object({
  preRoundFullyDilutedShares: EquityShares,
  pricePerShare: EquityDecimal,
  newMoneyShares: EquityShares,
  postRoundFullyDilutedShares: EquityShares,
  totalConvertedShares: EquityShares,
  convertibles: z.array(
    z.object({
      id: Id,
      label: z.string(),
      stakeholderName: z.string(),
      method: z.enum(["cap", "discount", "round"]),
      conversionPrice: EquityDecimal,
      amountConvertedCents: EquityCents,
      shares: EquityShares,
    }),
  ),
});
export type EquityPricedRoundPreview = z.infer<typeof EquityPricedRoundPreviewSchema>;

export const EquityPricedRoundResultSchema = z.object({
  preview: EquityPricedRoundPreviewSchema,
  certificates: z.array(EquityCertificateSchema),
});
export type EquityPricedRoundResult = z.infer<typeof EquityPricedRoundResultSchema>;

export const EquityConvertibleCancelResultSchema = EquityConvertibleSchema;

/** How many SAFEs and notes match a ledger filter and their total principal. */
export const EquityConvertibleTotalsSchema = z.object({
  count: z.number().int(),
  principalCents: EquityCents,
});
export type EquityConvertibleTotals = z.infer<typeof EquityConvertibleTotalsSchema>;

/** SAFE funding the board approved, what SAFEs in the ledger have raised, and what is left. */
export const EquitySafeFundingSchema = z.object({
  approvedCents: EquityCents.nullable(),
  raisedCents: EquityCents,
  /** Approved minus raised; null until an amount is approved. Never below zero. */
  remainingCents: EquityCents.nullable(),
});
export type EquitySafeFunding = z.infer<typeof EquitySafeFundingSchema>;
export const EquitySafeFundingSetInputSchema = z.object({ approvedCents: EquityCents });
