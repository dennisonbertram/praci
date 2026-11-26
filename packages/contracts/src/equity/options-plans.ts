import * as z from "zod";
import { Id } from "../ids.js";
import { EquityDate, EquityLongText, EquityShares, EquityText } from "./common.js";
import { EquityPlanStatusSchema } from "./share-classes.js";

/**
 * A plan's share pool: reserved shares and what is left of them. A pool increase is a `pool_change`
 * transaction, so the history of the pool is the plan's transaction history.
 */

/** One entry of the pool's history, in effective-date order. */
export const EquityPlanPoolIncreaseSchema = z.object({
  date: EquityDate,
  shares: EquityShares,
  note: z.string().nullable(),
});
export type EquityPlanPoolIncrease = z.infer<typeof EquityPlanPoolIncreaseSchema>;

export const EquityPlanPoolSchema = z.object({
  planId: Id,
  name: EquityText,
  status: EquityPlanStatusSchema,
  /** Shares the plan reserves. */
  reservedShares: EquityShares,
  /** Sum of the grants' original quantity. */
  grantedShares: EquityShares,
  /** Granted less exercised less cancelled, for grants still outstanding. */
  outstandingShares: EquityShares,
  exercisedShares: EquityShares,
  /** Sum of the grants' cancelled quantity. */
  returnedShares: EquityShares,
  /** Shares issued under the plan outside an exercise (an RSA certificate, for example). */
  issuedShares: EquityShares,
  /** Reserved shares not yet outstanding or issued. */
  availableShares: EquityShares,
  /** Every increase of the pool: the first reservation and each later top-up. */
  increases: z.array(EquityPlanPoolIncreaseSchema),
});
export type EquityPlanPool = z.infer<typeof EquityPlanPoolSchema>;

export const EquityPlanPoolInputSchema = z.object({ planId: Id });
export type EquityPlanPoolInput = z.input<typeof EquityPlanPoolInputSchema>;

const PositiveShares = EquityShares.refine((value) => BigInt(value) > 0n, "more than zero shares");

export const EquityPlanPoolIncreaseInputSchema = z.object({
  planId: Id,
  shares: PositiveShares,
  effectiveDate: EquityDate,
  boardApprovedOn: EquityDate.optional(),
  note: EquityLongText.optional(),
});
export type EquityPlanPoolIncreaseInput = z.input<typeof EquityPlanPoolIncreaseInputSchema>;

/** "Create pour over": move shares from one plan's pool to another's. */
export const EquityPlanPourOverInputSchema = z
  .object({
    fromPlanId: Id,
    toPlanId: Id,
    shares: PositiveShares,
    effectiveDate: EquityDate,
  })
  .refine((input) => input.fromPlanId !== input.toPlanId, {
    message: "a pour over moves shares between two plans",
    path: ["toPlanId"],
  });
export type EquityPlanPourOverInput = z.input<typeof EquityPlanPourOverInputSchema>;

/** Both pools after the move. */
export const EquityPlanPourOverSchema = z.object({
  from: EquityPlanPoolSchema,
  to: EquityPlanPoolSchema,
});
export type EquityPlanPourOver = z.infer<typeof EquityPlanPourOverSchema>;
