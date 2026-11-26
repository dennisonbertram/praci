import type { EquityExerciseResult } from "@rakazo/contracts";
import {
  EquityCompleteExerciseInputSchema,
  EquityExerciseOptionsInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { EquityDb, EquityScope } from "./ledger.js";
import { EquityConflictError, inTransaction, scopeOf } from "./ledger.js";
import { createEquityExercise, updateEquityExercise } from "./options.js";
import { getEquityCertificate } from "./securities.js";

const resultFor = async (
  prisma: EquityDb,
  scope: EquityScope,
  exercise: Awaited<ReturnType<typeof updateEquityExercise>>,
): Promise<EquityExerciseResult> => {
  if (!exercise.certificateId)
    throw new EquityConflictError("The completed exercise has no linked certificate");
  return {
    exercise,
    certificate: await getEquityCertificate(prisma, scope, exercise.certificateId),
  };
};

export async function exerciseEquityOptions(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityExerciseOptionsInputSchema>,
): Promise<EquityExerciseResult> {
  const input = EquityExerciseOptionsInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    const pending = await createEquityExercise(tx, scope, input);
    if (pending.status === "completed") return resultFor(tx, scope, pending);
    if (pending.status !== "pending")
      throw new EquityConflictError("The exercise request is already closed");
    const completed = await updateEquityExercise(tx, scope, {
      id: pending.id,
      status: "completed",
    });
    return resultFor(tx, scope, completed);
  });
}

export async function completeEquityExercise(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityCompleteExerciseInputSchema>,
): Promise<EquityExerciseResult> {
  const input = EquityCompleteExerciseInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const exercise = await updateEquityExercise(prisma, scope, {
    id: input.exerciseId,
    status: "completed",
  });
  return resultFor(prisma, scope, exercise);
}
