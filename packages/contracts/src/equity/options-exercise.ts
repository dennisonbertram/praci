import * as z from "zod";
import { Id } from "../ids.js";
import { EquityCents, EquityDate, EquityPositiveShares } from "./common.js";
import { EquityExerciseSchema } from "./options.js";
import { EquityCertificateSchema } from "./securities.js";

/** "Exercise options": completes at once and issues the share certificate. */
export const EquityExerciseOptionsInputSchema = z.object({
  optionGrantId: Id,
  quantity: EquityPositiveShares,
  exerciseDate: EquityDate,
  requestKey: z.string().uuid(),
  /** Defaults to quantity times the exercise price, rounded to the cent. */
  paymentCents: EquityCents.optional(),
});
export type EquityExerciseOptionsInput = z.input<typeof EquityExerciseOptionsInputSchema>;
export const EquityCompleteExerciseInputSchema = z.object({ exerciseId: Id });
export const EquityExerciseResultSchema = z.object({
  exercise: EquityExerciseSchema,
  certificate: EquityCertificateSchema,
});
export type EquityExerciseResult = z.infer<typeof EquityExerciseResultSchema>;
