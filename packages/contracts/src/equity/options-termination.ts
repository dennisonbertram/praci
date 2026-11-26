import * as z from "zod";
import { Id } from "../ids.js";
import { EquityDate, EquityLongText, EquityShares } from "./common.js";

/** "Terminate stakeholder": vesting stops and unvested options return to the pool. */
export const EquityTerminationInputSchema = z.object({
  stakeholderId: Id,
  terminatedOn: EquityDate,
  note: EquityLongText.optional(),
});
export type EquityTerminationInput = z.input<typeof EquityTerminationInputSchema>;
export const EquityReverseTerminationInputSchema = z.object({ stakeholderId: Id });
export const EquityPostTerminationPeriodInputSchema = z.object({
  optionGrantId: Id,
  postTerminationExerciseMonths: z.number().int().min(0).max(600),
});
export const EquityTerminationResultSchema = z.object({
  stakeholderId: Id,
  terminatedOn: EquityDate.nullable(),
  grants: z.array(
    z.object({
      optionGrantId: Id,
      label: z.string(),
      forfeitedQuantity: EquityShares,
      exerciseDeadline: EquityDate.nullable(),
    }),
  ),
});
export type EquityTerminationResult = z.infer<typeof EquityTerminationResultSchema>;
export const EquityExpireInputSchema = z.object({ asOf: EquityDate });
export const EquityExpireResultSchema = z.object({ expired: z.number().int().nonnegative() });
