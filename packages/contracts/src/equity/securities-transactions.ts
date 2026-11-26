import * as z from "zod";
import { Id } from "../ids.js";
import {
  EquityDate,
  EquityDecimal,
  EquityLongText,
  EquityRequestKey,
  EquityShares,
} from "./common.js";
import {
  EquityCancellationReasonSchema,
  EquityCertificateSchema,
  EquityRepurchaseReasonSchema,
  EquityTransactionKindSchema,
  EquityTransferReasonSchema,
} from "./securities.js";

/** A positive number of shares taken from one certificate; the rest stays with the holder. */
const PartQuantity = EquityShares.refine((value) => BigInt(value) > 0n, "more than zero shares");

const TransactionFields = {
  certificateId: Id,
  quantity: PartQuantity,
  effectiveDate: EquityDate,
  note: EquityLongText.optional(),
};

/** Moves shares to another stakeholder; a partial transfer leaves a remainder certificate. */
export const EquityTransferInputSchema = z.object({
  ...TransactionFields,
  toStakeholderId: Id,
  reason: EquityTransferReasonSchema,
  pricePerShare: EquityDecimal.optional(),
  requestKey: EquityRequestKey,
});
export type EquityTransferInput = z.input<typeof EquityTransferInputSchema>;

export const EquityRepurchaseInputSchema = z.object({
  ...TransactionFields,
  reason: EquityRepurchaseReasonSchema,
  pricePerShare: EquityDecimal.optional(),
});
export type EquityRepurchaseInput = z.input<typeof EquityRepurchaseInputSchema>;

export const EquityCancelInputSchema = z.object({
  ...TransactionFields,
  reason: EquityCancellationReasonSchema,
});
export type EquityCancelInput = z.input<typeof EquityCancelInputSchema>;

/** Converts a whole certificate into another class at `ratio` new shares per old share. */
export const EquityConvertCertificateInputSchema = z.object({
  certificateId: Id,
  toShareClassId: Id,
  ratio: EquityDecimal.refine((value) => /[1-9]/.test(value), "a ratio above zero").default("1"),
  effectiveDate: EquityDate,
  note: EquityLongText.optional(),
});
export type EquityConvertCertificateInput = z.input<typeof EquityConvertCertificateInputSchema>;

/** The transaction written and the certificates it created (new holder, remainder, new class). */
export const EquityShareTransactionResultSchema = z.object({
  transactionId: Id,
  kind: EquityTransactionKindSchema,
  resulting: z.array(EquityCertificateSchema),
});
export type EquityShareTransactionResult = z.infer<typeof EquityShareTransactionResultSchema>;

/** How many certificates match a ledger filter and how many shares they hold. */
export const EquityCertificateTotalsSchema = z.object({
  count: z.number().int(),
  shares: EquityShares,
});
export type EquityCertificateTotals = z.infer<typeof EquityCertificateTotalsSchema>;
