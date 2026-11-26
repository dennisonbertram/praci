import * as z from "zod";
import { Id } from "../ids.js";
import {
  EquityDate,
  EquityDecimal,
  EquityLongText,
  EquityRecordBaseSchema,
  EquityRequestKey,
  EquityShares,
  equityListInput,
  equityPage,
} from "./common.js";

/** Warrants were not observed in the reference: a simple ledger with issue and cancel. */
export const EQUITY_WARRANT_STATUSES = ["outstanding", "canceled"] as const;
export const EquityWarrantStatusSchema = z.enum(EQUITY_WARRANT_STATUSES);

export const EquityWarrantSchema = EquityRecordBaseSchema.extend({
  label: z.string(),
  stakeholderId: Id,
  stakeholderName: z.string(),
  shareClassId: Id,
  shareClassName: z.string(),
  quantity: EquityShares,
  exercisePrice: EquityDecimal,
  issueDate: EquityDate,
  expirationDate: EquityDate.nullable(),
  status: EquityWarrantStatusSchema,
  canceledOn: EquityDate.nullable(),
  adminNotes: z.string().nullable(),
});
export type EquityWarrant = z.infer<typeof EquityWarrantSchema>;
export const EquityWarrantCreateInputSchema = z.object({
  stakeholderId: Id,
  shareClassId: Id,
  quantity: EquityShares.refine((value) => BigInt(value) > 0n, "more than zero shares"),
  exercisePrice: EquityDecimal,
  issueDate: EquityDate,
  expirationDate: EquityDate.nullable().optional(),
  adminNotes: EquityLongText.nullable().optional(),
  requestKey: EquityRequestKey,
});
export type EquityWarrantCreateInput = z.input<typeof EquityWarrantCreateInputSchema>;
export const EquityWarrantCancelInputSchema = z.object({
  id: Id,
  canceledOn: EquityDate,
  note: EquityLongText.optional(),
});
export const EquityWarrantListInputSchema = equityListInput(["label", "quantity", "issueDate"], {
  status: z.array(EquityWarrantStatusSchema).optional(),
});
export type EquityWarrantListInput = z.input<typeof EquityWarrantListInputSchema>;
export const EquityWarrantPageSchema = equityPage(EquityWarrantSchema);
