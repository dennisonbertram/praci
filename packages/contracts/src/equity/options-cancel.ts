import * as z from "zod";
import { Id } from "../ids.js";
import { EquityDate, EquityLongText, EquityShares } from "./common.js";
import { EquityCancellationReasonSchema } from "./securities.js";

/** Cancels the whole remaining grant, or `quantity` of it ("Partially cancel option grant"). */
export const EquityOptionCancelInputSchema = z.object({
  id: Id,
  quantity: EquityShares.optional(),
  canceledOn: EquityDate,
  reason: EquityCancellationReasonSchema.optional(),
  note: EquityLongText.optional(),
});
export type EquityOptionCancelInput = z.input<typeof EquityOptionCancelInputSchema>;
export const EquityOptionReverseCancellationInputSchema = z.object({
  id: Id,
  note: EquityLongText.optional(),
});
export const EquityOptionCancelPendingExercisesInputSchema = z.object({ id: Id });
