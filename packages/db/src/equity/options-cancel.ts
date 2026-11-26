import type { EquityOptionGrant } from "@rakazo/contracts";
import {
  EquityOptionCancelInputSchema,
  EquityOptionCancelPendingExercisesInputSchema,
  EquityOptionReverseCancellationInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  EquityConflictError,
  EquityInputError,
  inTransaction,
  lockEquityExercises,
  lockEquityLedger,
  lockEquityOptionGrants,
  lockEquityPlans,
  notFound,
  recordTransaction,
  scopeOf,
  toBig,
  toDate,
  today,
} from "./ledger.js";
import { getEquityOptionGrant, updateEquityExercise } from "./options.js";
import { planAccountingById } from "./plan-accounting.js";

/** "Cancel option grant" and "Partially cancel option grant": canceled shares return to the pool. */
export async function cancelEquityOptionGrant(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityOptionCancelInputSchema>,
): Promise<EquityOptionGrant> {
  const input = EquityOptionCancelInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityOptionGrants(tx, scope, [input.id]);
    const grant = await tx.equityOptionGrant.findFirst({ where: { id: input.id, ...scope } });
    if (!grant) throw notFound("Option grant");
    await lockEquityPlans(tx, scope, [grant.planId]);
    if (grant.status !== "outstanding")
      throw new EquityConflictError("Only an outstanding grant can be canceled");
    const pendingExercises = await tx.equityExercise.findMany({
      where: { optionGrantId: grant.id, status: "pending", ...scope },
      select: { id: true, quantity: true },
    });
    await lockEquityExercises(
      tx,
      scope,
      pendingExercises.map((exercise) => exercise.id),
    );
    const pendingQuantity = pendingExercises.reduce((sum, exercise) => sum + exercise.quantity, 0n);
    const remaining = grant.quantity - grant.exercisedQuantity - grant.canceledQuantity;
    const quantity = input.quantity === undefined ? remaining : toBig(input.quantity);
    if (quantity <= 0n || quantity > remaining)
      throw new EquityInputError("The quantity must be between 1 and the outstanding quantity");
    if (quantity + pendingQuantity > remaining)
      throw new EquityInputError("Cancellation overlaps pending exercise reservations");
    const full = quantity === remaining;
    const before = await getEquityOptionGrant(tx, scope, input.id);
    await tx.equityOptionGrant.update({
      where: { id: grant.id },
      data: {
        canceledQuantity: grant.canceledQuantity + quantity,
        canceledOn: toDate(input.canceledOn),
        ...(full ? { status: "canceled" } : {}),
      },
    });
    const after = await getEquityOptionGrant(tx, scope, input.id);
    await recordTransaction(tx, scope, {
      kind: "cancel",
      effectiveDate: input.canceledOn,
      reason: input.reason ?? null,
      optionGrantId: grant.id,
      planId: grant.planId,
      quantity,
      before,
      after,
      note: input.note ?? null,
    });
  });
  return getEquityOptionGrant(prisma, scope, input.id);
}

/** "Reverse cancellation": the canceled shares come back from the pool, if it still has them. */
export async function reverseEquityOptionCancellation(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityOptionReverseCancellationInputSchema>,
): Promise<EquityOptionGrant> {
  const input = EquityOptionReverseCancellationInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityOptionGrants(tx, scope, [input.id]);
    const grant = await tx.equityOptionGrant.findFirst({ where: { id: input.id, ...scope } });
    if (!grant) throw notFound("Option grant");
    await lockEquityPlans(tx, scope, [grant.planId]);
    if (grant.canceledQuantity <= 0n || !["canceled", "outstanding"].includes(grant.status))
      throw new EquityConflictError("This grant has no cancellation to reverse");
    const available =
      (await planAccountingById(tx, scope, [grant.planId])).get(grant.planId)?.rawAvailableShares ??
      -1n;
    if (available < grant.canceledQuantity)
      throw new EquityInputError("The plan does not have enough available shares");
    const before = await getEquityOptionGrant(tx, scope, input.id);
    await tx.equityOptionGrant.update({
      where: { id: grant.id },
      data: { canceledQuantity: 0n, canceledOn: null, status: "outstanding" },
    });
    const after = await getEquityOptionGrant(tx, scope, input.id);
    await recordTransaction(tx, scope, {
      kind: "reverse_cancellation",
      effectiveDate: today(),
      optionGrantId: grant.id,
      planId: grant.planId,
      quantity: grant.canceledQuantity,
      before,
      after,
      note: input.note ?? null,
    });
  });
  return getEquityOptionGrant(prisma, scope, input.id);
}

/** "Cancel pending exercises". */
export async function cancelPendingEquityExercises(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityOptionCancelPendingExercisesInputSchema>,
): Promise<EquityOptionGrant> {
  const input = EquityOptionCancelPendingExercisesInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityOptionGrants(tx, scope, [input.id]);
    const grant = await tx.equityOptionGrant.findFirst({
      where: { id: input.id, ...scope },
      select: { id: true, planId: true },
    });
    if (!grant) throw notFound("Option grant");
    await lockEquityPlans(tx, scope, [grant.planId]);
    const pending = await tx.equityExercise.findMany({
      where: { optionGrantId: grant.id, status: "pending", ...scope },
      orderBy: { id: "asc" },
      select: { id: true },
    });
    if (pending.length === 0) throw new EquityConflictError("No pending exercises");
    await lockEquityExercises(
      tx,
      scope,
      pending.map((exercise) => exercise.id),
    );
    for (const exercise of pending)
      await updateEquityExercise(tx, scope, { id: exercise.id, status: "canceled" });
  });
  return getEquityOptionGrant(prisma, scope, input.id);
}
