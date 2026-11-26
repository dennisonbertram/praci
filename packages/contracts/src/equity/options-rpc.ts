import { oc } from "@orpc/contract";
import * as z from "zod";
import { EquityOptionGrantSchema } from "./options.js";
import {
  EquityOptionCancelInputSchema,
  EquityOptionCancelPendingExercisesInputSchema,
  EquityOptionReverseCancellationInputSchema,
} from "./options-cancel.js";
import {
  EquityIssueDraftSetInputSchema,
  EquityIssueDraftSetResultSchema,
} from "./options-drafts.js";
import {
  EquityCompleteExerciseInputSchema,
  EquityExerciseOptionsInputSchema,
  EquityExerciseResultSchema,
} from "./options-exercise.js";
import {
  EquityPlanPoolIncreaseInputSchema,
  EquityPlanPoolInputSchema,
  EquityPlanPoolSchema,
  EquityPlanPourOverInputSchema,
  EquityPlanPourOverSchema,
} from "./options-plans.js";
import {
  EquityExpireInputSchema,
  EquityExpireResultSchema,
  EquityPostTerminationPeriodInputSchema,
  EquityReverseTerminationInputSchema,
  EquityTerminationInputSchema,
  EquityTerminationResultSchema,
} from "./options-termination.js";
import {
  EquityWarrantCancelInputSchema,
  EquityWarrantCreateInputSchema,
  EquityWarrantListInputSchema,
  EquityWarrantPageSchema,
  EquityWarrantSchema,
} from "./options-warrants.js";

/** The options area's procedures, spread into `equityContract` under its marker. */
export const optionsAreaContract = {
  /** Option grant row menu transactions. */
  optionActions: {
    cancel: oc.input(EquityOptionCancelInputSchema).output(EquityOptionGrantSchema),
    reverseCancellation: oc
      .input(EquityOptionReverseCancellationInputSchema)
      .output(EquityOptionGrantSchema),
    cancelPendingExercises: oc
      .input(EquityOptionCancelPendingExercisesInputSchema)
      .output(EquityOptionGrantSchema),
    exercise: oc.input(EquityExerciseOptionsInputSchema).output(EquityExerciseResultSchema),
    terminate: oc.input(EquityTerminationInputSchema).output(EquityTerminationResultSchema),
    /** What terminate would do, without writing; for the review step. */
    previewTermination: oc
      .input(EquityTerminationInputSchema)
      .output(EquityTerminationResultSchema),
    reverseTermination: oc
      .input(EquityReverseTerminationInputSchema)
      .output(EquityTerminationResultSchema),
    setPostTerminationPeriod: oc
      .input(EquityPostTerminationPeriodInputSchema)
      .output(EquityOptionGrantSchema),
    expire: oc.input(EquityExpireInputSchema).output(EquityExpireResultSchema),
    completeExercise: oc
      .input(EquityCompleteExerciseInputSchema)
      .output(EquityExerciseResultSchema),
    issueDraftSet: oc.input(EquityIssueDraftSetInputSchema).output(EquityIssueDraftSetResultSchema),
  },
  /** Plan pools: reserved, granted, exercised, returned and available shares. */
  planPools: {
    list: oc.output(z.array(EquityPlanPoolSchema)),
    get: oc.input(EquityPlanPoolInputSchema).output(EquityPlanPoolSchema),
    increase: oc.input(EquityPlanPoolIncreaseInputSchema).output(EquityPlanPoolSchema),
    pourOver: oc.input(EquityPlanPourOverInputSchema).output(EquityPlanPourOverSchema),
  },
  /** Warrants: a simple ledger with issue and cancel. */
  warrants: {
    list: oc.input(EquityWarrantListInputSchema).output(EquityWarrantPageSchema),
    create: oc.input(EquityWarrantCreateInputSchema).output(EquityWarrantSchema),
    cancel: oc.input(EquityWarrantCancelInputSchema).output(EquityWarrantSchema),
  },
};
