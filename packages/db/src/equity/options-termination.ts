import type { EquityOptionGrant, EquityTerminationResult } from "@rakazo/contracts";
import {
  EquityExpireInputSchema,
  EquityPostTerminationPeriodInputSchema,
  EquityReverseTerminationInputSchema,
  EquityTerminationInputSchema,
} from "@rakazo/contracts";
import { addMonthsClamped, vestedShares, vestingRuleOf } from "@rakazo/core/equity";
import type * as z from "zod";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  EquityConflictError,
  fromBig,
  fromDateOrNull,
  inTransaction,
  lockEquityLedger,
  lockEquityOptionGrants,
  notFound,
  recordTransaction,
  scopeOf,
  toBig,
  toDate,
  today,
} from "./ledger.js";
import { getEquityOptionGrant } from "./options.js";

const TERMINATION = "termination";
const DEFAULT_WINDOW_MONTHS = 3;

const deadlineOf = (terminatedOn: string, months: number | null, expiration: string | null) => {
  const window = addMonthsClamped(terminatedOn, months ?? DEFAULT_WINDOW_MONTHS);
  return expiration && expiration < window ? expiration : window;
};

type TerminationStep = {
  grant: EquityOptionGrant;
  forfeited: bigint;
  outstanding: bigint;
  deadline: string;
};

/** What terminating the holder on that date would do to each outstanding grant; writes nothing. */
async function planTermination(
  tx: EquityDb,
  scope: EquityScope,
  input: z.infer<typeof EquityTerminationInputSchema>,
): Promise<TerminationStep[]> {
  const holder = await tx.equityStakeholder.findFirst({
    where: { id: input.stakeholderId, ...scope },
    select: { id: true, terminatedAt: true },
  });
  if (!holder) throw notFound("Stakeholder");
  if (holder.terminatedAt) throw new EquityConflictError("This stakeholder is already terminated");
  return planGrantSteps(tx, scope, holder.id, input.terminatedOn);
}

async function planGrantSteps(
  tx: EquityDb,
  scope: EquityScope,
  stakeholderId: string,
  terminatedOn: string,
): Promise<TerminationStep[]> {
  const rows = await tx.equityOptionGrant.findMany({
    where: { stakeholderId, status: "outstanding", ...scope },
    select: { id: true },
    orderBy: { label: "asc" },
  });
  const steps: TerminationStep[] = [];
  for (const { id } of rows) {
    const grant = await getEquityOptionGrant(tx, scope, id);
    const total = toBig(grant.quantity);
    const vested = grant.vestingSchedule
      ? vestedShares(vestingRuleOf(grant.vestingSchedule), total, terminatedOn)
      : total;
    const outstanding = toBig(grant.outstandingQuantity);
    const unvested = total - vested;
    const forfeited = unvested > outstanding ? outstanding : unvested > 0n ? unvested : 0n;
    const deadline = deadlineOf(
      terminatedOn,
      grant.postTerminationExerciseMonths,
      grant.expirationDate,
    );
    steps.push({ grant, forfeited, outstanding, deadline });
  }
  return steps;
}

/** Ledger lock, then every grant of the holder in sorted id order, like the other grant paths. */
async function lockHolderGrants(tx: EquityDb, scope: EquityScope, stakeholderId: string) {
  await lockEquityLedger(tx, scope);
  const rows = await tx.equityOptionGrant.findMany({
    where: { stakeholderId, ...scope },
    select: { id: true },
  });
  await lockEquityOptionGrants(
    tx,
    scope,
    rows.map((row) => row.id),
  );
}

const resultOf = (
  input: z.infer<typeof EquityTerminationInputSchema>,
  steps: TerminationStep[],
): EquityTerminationResult => ({
  stakeholderId: input.stakeholderId,
  terminatedOn: input.terminatedOn,
  grants: steps.map(({ grant, forfeited, deadline }) => ({
    optionGrantId: grant.id,
    label: grant.label,
    forfeitedQuantity: fromBig(forfeited),
    exerciseDeadline: deadline,
  })),
});

/** The forfeits and deadlines a termination would produce, for the review step. */
export async function previewEquityTermination(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityTerminationInputSchema>,
): Promise<EquityTerminationResult> {
  const input = EquityTerminationInputSchema.parse(raw);
  return resultOf(input, await planTermination(prisma, scopeOf(actor), input));
}

/** Stops vesting, forfeits unvested options to the pool, and sets each exercise deadline. */
export async function terminateEquityStakeholder(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityTerminationInputSchema>,
): Promise<EquityTerminationResult> {
  const input = EquityTerminationInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await lockHolderGrants(tx, scope, input.stakeholderId);
    const steps = await planTermination(tx, scope, input);
    await tx.equityStakeholder.update({
      where: { id: input.stakeholderId },
      data: { terminatedAt: toDate(input.terminatedOn) },
    });
    await applyTermination(tx, scope, input.terminatedOn, steps);
    return resultOf(input, steps);
  });
}

async function applyTermination(
  tx: EquityDb,
  scope: EquityScope,
  terminatedOn: string,
  steps: TerminationStep[],
) {
  for (const { grant, forfeited, outstanding, deadline } of steps) {
    await tx.equityOptionGrant.update({
      where: { id: grant.id },
      data: {
        canceledQuantity: toBig(grant.canceledQuantity) + forfeited,
        expirationDate: toDate(deadline),
        ...(forfeited === outstanding ? { status: "forfeited" } : {}),
      },
    });
    if (grant.vestingSchedule)
      await tx.equityVestingSchedule.update({
        where: { id: grant.vestingSchedule.id },
        data: { stoppedOn: toDate(terminatedOn) },
      });
    await recordTransaction(tx, scope, {
      kind: "cancel",
      effectiveDate: terminatedOn,
      optionGrantId: grant.id,
      planId: grant.planId,
      quantity: forfeited,
      before: { status: grant.status, expirationDate: grant.expirationDate },
      after: { forfeited: fromBig(forfeited), expirationDate: deadline },
      note: TERMINATION,
    });
  }
}

/**
 * Terminates the holder's outstanding grants inside a stakeholder termination that already set
 * `terminatedAt`: the same forfeits, deadlines and stopped vesting as the options-tab flow.
 */
export async function terminateEquityOptionGrantsOf(
  tx: EquityDb,
  scope: EquityScope,
  stakeholderId: string,
  terminatedOn: string,
): Promise<void> {
  await lockHolderGrants(tx, scope, stakeholderId);
  const steps = await planGrantSteps(tx, scope, stakeholderId, terminatedOn);
  await applyTermination(tx, scope, terminatedOn, steps);
}

/** "Reverse termination": restores what the termination forfeited and restarts vesting. */
export async function reverseEquityTermination(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityReverseTerminationInputSchema>,
): Promise<EquityTerminationResult> {
  const input = EquityReverseTerminationInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await lockHolderGrants(tx, scope, input.stakeholderId);
    const holder = await tx.equityStakeholder.findFirst({
      where: { id: input.stakeholderId, ...scope },
      select: { id: true, terminatedAt: true },
    });
    if (!holder) throw notFound("Stakeholder");
    if (!holder.terminatedAt) throw new EquityConflictError("This stakeholder is not terminated");
    // A grant has an open forfeit when its latest termination row is a cancel: a reversal
    // closes it, so terminate and reverse repeated (on one date or several) restores each
    // forfeit once, and a grant whose termination was already reversed is left alone.
    const rows = await tx.equityTransaction.findMany({
      where: {
        ...scope,
        kind: { in: ["cancel", "reverse_cancellation"] },
        note: TERMINATION,
        optionGrant: { stakeholderId: holder.id },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { kind: true, optionGrantId: true, quantity: true, before: true },
    });
    const open = new Map<string, { quantity: bigint; before: unknown }>();
    for (const row of rows) {
      if (!row.optionGrantId) continue;
      if (row.kind === "cancel")
        open.set(row.optionGrantId, { quantity: row.quantity ?? 0n, before: row.before });
      else open.delete(row.optionGrantId);
    }
    const grants: EquityTerminationResult["grants"] = [];
    for (const [grantId, entry] of open) {
      const grant = await getEquityOptionGrant(tx, scope, grantId);
      const quantity = entry.quantity;
      const before = (entry.before ?? {}) as { expirationDate?: string | null };
      await tx.equityOptionGrant.update({
        where: { id: grant.id },
        data: {
          canceledQuantity: toBig(grant.canceledQuantity) - quantity,
          expirationDate: before.expirationDate ? toDate(before.expirationDate) : null,
          ...(grant.status === "forfeited" ? { status: "outstanding" } : {}),
        },
      });
      if (grant.vestingSchedule)
        await tx.equityVestingSchedule.update({
          where: { id: grant.vestingSchedule.id },
          data: { stoppedOn: null },
        });
      await recordTransaction(tx, scope, {
        kind: "reverse_cancellation",
        effectiveDate: today(),
        optionGrantId: grant.id,
        planId: grant.planId,
        quantity,
        note: TERMINATION,
      });
      grants.push({
        optionGrantId: grant.id,
        label: grant.label,
        forfeitedQuantity: "0",
        exerciseDeadline: before.expirationDate ?? null,
      });
    }
    await tx.equityStakeholder.update({ where: { id: holder.id }, data: { terminatedAt: null } });
    return { stakeholderId: holder.id, terminatedOn: null, grants };
  });
}

/** "Modify post-termination period"; a terminated holder's deadline moves with it. */
export async function setEquityPostTerminationPeriod(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPostTerminationPeriodInputSchema>,
): Promise<EquityOptionGrant> {
  const input = EquityPostTerminationPeriodInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    const grant = await tx.equityOptionGrant.findFirst({
      where: { id: input.optionGrantId, ...scope },
      include: { stakeholder: { select: { terminatedAt: true } } },
    });
    if (!grant) throw notFound("Option grant");
    const terminatedOn = fromDateOrNull(grant.stakeholder.terminatedAt);
    const expirationDate = terminatedOn
      ? addMonthsClamped(terminatedOn, input.postTerminationExerciseMonths)
      : fromDateOrNull(grant.expirationDate);
    await tx.equityOptionGrant.update({
      where: { id: grant.id },
      data: {
        postTerminationExerciseMonths: input.postTerminationExerciseMonths,
        expirationDate: expirationDate ? toDate(expirationDate) : null,
      },
    });
    await recordTransaction(tx, scope, {
      kind: "modify",
      effectiveDate: today(),
      optionGrantId: grant.id,
      planId: grant.planId,
      before: {
        postTerminationExerciseMonths: grant.postTerminationExerciseMonths,
        expirationDate: fromDateOrNull(grant.expirationDate),
      },
      after: { postTerminationExerciseMonths: input.postTerminationExerciseMonths, expirationDate },
    });
  });
  return getEquityOptionGrant(prisma, scope, input.optionGrantId);
}

/** Outstanding grants past their expiration become expired; what was left returns to the pool. */
export async function expireEquityOptionGrants(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityExpireInputSchema>,
): Promise<{ expired: number }> {
  const input = EquityExpireInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    const due = { ...scope, status: "outstanding", expirationDate: { lt: toDate(input.asOf) } };
    const ids = await tx.equityOptionGrant.findMany({ where: due, select: { id: true } });
    await lockEquityOptionGrants(
      tx,
      scope,
      ids.map((row) => row.id),
    );
    // Read again under the locks: a concurrent expiry or exercise may have changed a grant.
    const rows = await tx.equityOptionGrant.findMany({ where: due });
    for (const row of rows) {
      const remaining = row.quantity - row.exercisedQuantity - row.canceledQuantity;
      await tx.equityOptionGrant.update({
        where: { id: row.id },
        data: { status: "expired", canceledQuantity: row.canceledQuantity + remaining },
      });
      await recordTransaction(tx, scope, {
        kind: "cancel",
        effectiveDate: input.asOf,
        optionGrantId: row.id,
        planId: row.planId,
        quantity: remaining,
        note: "expired",
      });
    }
    return { expired: rows.length };
  });
}
