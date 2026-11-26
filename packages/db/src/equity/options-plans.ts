import type { EquityPlanPool } from "@rakazo/contracts";
import {
  EquityPlanPoolIncreaseInputSchema,
  EquityPlanPoolInputSchema,
  EquityPlanPourOverInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  assertPostgresBigInt,
  defined,
  EquityInputError,
  fromBig,
  fromDate,
  inRepeatableReadTransaction,
  inTransaction,
  lockEquityLedger,
  lockEquityPlans,
  notFound,
  recordTransaction,
  scopeOf,
  toBig,
  toDateOrNull,
} from "./ledger.js";
import { planAccountingById } from "./plan-accounting.js";

/**
 * Equity plan pools: reserved, granted, outstanding and available shares, the pool's increase
 * history, and the "Create pour over" move of shares between two plans.
 *
 * The numbers are derived from the plan's grants and the certificates it backs, and agree with the
 * plan store (`share-classes.ts`): outstanding counts the grants still outstanding, exercised is
 * every grant's exercised quantity, and issued is the outstanding certificates under the plan that
 * an exercise did not create (an exercise already counts through the grant's exercised quantity).
 */

type PlanRow = Prisma.EquityPlanGetPayload<object>;

type Totals = {
  reservedShares: bigint;
  grantedShares: bigint;
  outstandingShares: bigint;
  exercisedShares: bigint;
  returnedShares: bigint;
  directIssuedShares: bigint;
  issuedShares: bigint;
  rawAvailableShares: bigint;
  increases: EquityPlanPool["increases"];
};

const emptyTotals = (): Totals => ({
  reservedShares: 0n,
  grantedShares: 0n,
  outstandingShares: 0n,
  exercisedShares: 0n,
  returnedShares: 0n,
  directIssuedShares: 0n,
  issuedShares: 0n,
  rawAvailableShares: 0n,
  increases: [],
});

/** The reserved figure a `pool_change` row stored before/after, as a whole number of shares. */
export function reservedIn(value: Prisma.JsonValue): bigint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = (value as Record<string, unknown>).reservedShares;
  if (typeof raw === "string" && /^\d+$/.test(raw)) return toBig(raw);
  if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) return toBig(String(raw));
  return null;
}

const clampZero = (value: bigint): bigint => (value > 0n ? value : 0n);

/** The pool of each of the given plans, in a fixed number of scoped queries. */
async function totalsByPlan(
  prisma: EquityDb,
  actor: EquityScope,
  planIds: string[],
): Promise<Map<string, Totals>> {
  const scope = scopeOf(actor);
  if (!planIds.length) return new Map();
  const [accounting, transactions] = await Promise.all([
    planAccountingById(prisma, actor, planIds),
    prisma.equityTransaction.findMany({
      where: { ...scope, planId: { in: planIds }, kind: "pool_change" },
      select: {
        planId: true,
        effectiveDate: true,
        before: true,
        after: true,
        note: true,
      },
      orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  const result = new Map<string, Totals>(
    planIds.map((id) => [id, { ...(accounting.get(id) ?? emptyTotals()), increases: [] }]),
  );
  for (const transaction of transactions) {
    const totals = result.get(transaction.planId ?? "");
    if (!totals) continue;
    const before = reservedIn(transaction.before);
    const after = reservedIn(transaction.after);
    if (before === null || after === null) continue;
    const change = after - before;
    // A decrease (the giving side of a pour over) is not an increase of the pool.
    if (change <= 0n) continue;
    totals.increases.push({
      date: fromDate(transaction.effectiveDate),
      shares: fromBig(change),
      note: transaction.note,
    });
  }
  return result;
}

const toPool = (row: PlanRow, totals: Totals): EquityPlanPool => ({
  planId: row.id,
  name: row.name,
  status: row.status as EquityPlanPool["status"],
  reservedShares: fromBig(row.reservedShares),
  grantedShares: fromBig(totals.grantedShares),
  outstandingShares: fromBig(totals.outstandingShares),
  exercisedShares: fromBig(totals.exercisedShares),
  returnedShares: fromBig(totals.returnedShares),
  issuedShares: fromBig(totals.directIssuedShares),
  availableShares: fromBig(clampZero(totals.rawAvailableShares)),
  increases: totals.increases,
});

async function poolDetail(
  prisma: EquityDb,
  actor: EquityScope,
  planId: string,
): Promise<EquityPlanPool> {
  const row = await prisma.equityPlan.findFirst({ where: { id: planId, ...scopeOf(actor) } });
  if (!row) throw notFound("Plan");
  const totals = await totalsByPlan(prisma, actor, [planId]);
  return toPool(row, totals.get(planId) ?? emptyTotals());
}

export async function getEquityPlanPool(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPlanPoolInputSchema>,
): Promise<EquityPlanPool> {
  const { planId } = EquityPlanPoolInputSchema.parse(raw);
  return inRepeatableReadTransaction(prisma, (tx) => poolDetail(tx, actor, planId));
}

export async function listEquityPlanPools(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<EquityPlanPool[]> {
  return inRepeatableReadTransaction(prisma, async (tx) => {
    const rows = await tx.equityPlan.findMany({
      where: scopeOf(actor),
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    const totals = await totalsByPlan(
      tx,
      actor,
      rows.map((row) => row.id),
    );
    return rows.map((row) => toPool(row, totals.get(row.id) ?? emptyTotals()));
  });
}

const planSnapshot = (row: PlanRow) => ({
  id: row.id,
  name: row.name,
  status: row.status,
  shareClassId: row.shareClassId,
  reservedShares: fromBig(row.reservedShares),
  boardApprovedOn: row.boardApprovedOn ? fromDate(row.boardApprovedOn) : null,
});

/** Adds shares to a plan's reserve ("pool increase"), recorded as a `pool_change` transaction. */
export async function increaseEquityPlanPool(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPlanPoolIncreaseInputSchema>,
): Promise<EquityPlanPool> {
  const input = EquityPlanPoolIncreaseInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const shares = toBig(input.shares);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityPlans(tx, scope, [input.planId]);
    const existing = await tx.equityPlan.findFirst({ where: { id: input.planId, ...scope } });
    if (!existing) throw notFound("Plan");
    const reserved = assertPostgresBigInt(existing.reservedShares + shares);
    const totals = (await totalsByPlan(tx, scope, [existing.id])).get(existing.id) ?? emptyTotals();
    if (reserved < existing.reservedShares - totals.rawAvailableShares)
      throw new EquityInputError("The pool increase does not cover existing commitments");
    const updated = await tx.equityPlan.update({
      where: { id: existing.id },
      data: defined({
        reservedShares: reserved,
        boardApprovedOn: toDateOrNull(input.boardApprovedOn),
      }),
    });
    await recordTransaction(tx, scope, {
      kind: "pool_change",
      effectiveDate: input.effectiveDate,
      planId: existing.id,
      quantity: shares,
      before: planSnapshot(existing),
      after: planSnapshot(updated),
      note: input.note ?? null,
    });
  });
  return getEquityPlanPool(prisma, scope, { planId: input.planId });
}

/** "Create pour over": moves unreserved shares from one plan's pool into another's. */
export async function pourOverEquityPlan(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPlanPourOverInputSchema>,
): Promise<{ from: EquityPlanPool; to: EquityPlanPool }> {
  const input = EquityPlanPourOverInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const shares = toBig(input.shares);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityPlans(tx, scope, [input.fromPlanId, input.toPlanId]);
    await assertInLedger(tx, scope, "equityPlan", input.fromPlanId);
    await assertInLedger(tx, scope, "equityPlan", input.toPlanId);
    const rows = await tx.equityPlan.findMany({
      where: { id: { in: [input.fromPlanId, input.toPlanId] }, ...scope },
    });
    const from = rows.find((row) => row.id === input.fromPlanId);
    const to = rows.find((row) => row.id === input.toPlanId);
    if (!from || !to) throw notFound("Plan");
    const totalsById = await totalsByPlan(tx, scope, [from.id, to.id]);
    const fromTotals = totalsById.get(from.id) ?? emptyTotals();
    const available = fromTotals.rawAvailableShares;
    if (shares > available)
      throw new EquityInputError(
        `The ${from.name} pool has ${fromBig(available)} shares available`,
      );
    const fromReserved = from.reservedShares - shares;
    if (fromReserved < 0n) throw new EquityInputError("A pool reserve cannot be negative");
    const toReserved = assertPostgresBigInt(to.reservedShares + shares);
    const toTotals = totalsById.get(to.id) ?? emptyTotals();
    const toUsage = to.reservedShares - toTotals.rawAvailableShares;
    if (toReserved < toUsage)
      throw new EquityInputError("The receiving pool does not cover existing commitments");
    const updatedFrom = await tx.equityPlan.update({
      where: { id: from.id },
      data: { reservedShares: fromReserved },
    });
    const updatedTo = await tx.equityPlan.update({
      where: { id: to.id },
      data: { reservedShares: toReserved },
    });
    await recordTransaction(tx, scope, {
      kind: "pool_change",
      effectiveDate: input.effectiveDate,
      planId: from.id,
      quantity: shares,
      before: planSnapshot(from),
      after: planSnapshot(updatedFrom),
      note: `Pour over to ${to.name}`,
    });
    await recordTransaction(tx, scope, {
      kind: "pool_change",
      effectiveDate: input.effectiveDate,
      planId: to.id,
      quantity: shares,
      before: planSnapshot(to),
      after: planSnapshot(updatedTo),
      note: `Pour over from ${from.name}`,
    });
  });
  return inRepeatableReadTransaction(prisma, async (tx) => {
    const [from, to] = await Promise.all([
      poolDetail(tx, scope, input.fromPlanId),
      poolDetail(tx, scope, input.toPlanId),
    ]);
    return { from, to };
  });
}
