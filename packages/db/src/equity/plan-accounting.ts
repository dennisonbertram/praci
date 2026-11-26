import { EQUITY_OUTSTANDING_CERTIFICATE_STATUSES } from "@rakazo/contracts";
import type { EquityDb, EquityScope } from "./ledger.js";
import { EquityInputError, notFound, scopeOf } from "./ledger.js";

export type EquityPlanAccounting = {
  reservedShares: bigint;
  grantedShares: bigint;
  outstandingShares: bigint;
  exercisedShares: bigint;
  returnedShares: bigint;
  directIssuedShares: bigint;
  issuedShares: bigint;
  rawAvailableShares: bigint;
};

const emptyAccounting = (): EquityPlanAccounting => ({
  reservedShares: 0n,
  grantedShares: 0n,
  outstandingShares: 0n,
  exercisedShares: 0n,
  returnedShares: 0n,
  directIssuedShares: 0n,
  issuedShares: 0n,
  rawAvailableShares: 0n,
});

export type EquityCertificateLineage = {
  id: string;
  parentId: string | null;
  planId: string | null;
  status: string;
  quantity: bigint;
};

export type EquityCertificateLineageIndex = {
  certificates: Map<string, EquityCertificateLineage>;
  originFor(id: string): EquityExerciseOrigin | null;
  isExerciseOrigin(id: string): boolean;
};

export type EquityExerciseOrigin = {
  exerciseId: string;
  optionGrantId: string;
  planId: string;
  quantity: bigint;
};

export type EquityExerciseLineageRecord = EquityExerciseOrigin & {
  certificateId: string;
  status: string;
  grantExercisedQuantity: bigint;
};

export function indexEquityCertificateLineage(
  certificateRows: readonly EquityCertificateLineage[],
  exerciseRows: readonly EquityExerciseLineageRecord[],
): EquityCertificateLineageIndex {
  const certificates = new Map(certificateRows.map((row) => [row.id, row]));
  if (certificates.size !== certificateRows.length)
    throw new EquityInputError("The certificate lineage contains duplicate identifiers");

  const origins = new Map<string, EquityExerciseOrigin>();
  const linkedQuantitiesByGrant = new Map<string, bigint>();
  const grantCounters = new Map<string, bigint>();
  for (const exercise of exerciseRows) {
    const certificate = certificates.get(exercise.certificateId);
    if (!certificate)
      throw new EquityInputError("The exercise certificate lineage has an unknown origin");
    if (exercise.status !== "completed")
      throw new EquityInputError("Only completed exercises may link certificate origins");
    if (certificate.quantity !== exercise.quantity)
      throw new EquityInputError("The exercise certificate quantity does not match its origin");
    if (certificate.planId !== null && certificate.planId !== exercise.planId)
      throw new EquityInputError("The exercise certificate plan does not match its grant");
    if (origins.has(exercise.certificateId))
      throw new EquityInputError("The exercise certificate lineage has duplicate origins");
    origins.set(exercise.certificateId, {
      exerciseId: exercise.exerciseId,
      optionGrantId: exercise.optionGrantId,
      planId: exercise.planId,
      quantity: exercise.quantity,
    });
    linkedQuantitiesByGrant.set(
      exercise.optionGrantId,
      (linkedQuantitiesByGrant.get(exercise.optionGrantId) ?? 0n) + exercise.quantity,
    );
    grantCounters.set(exercise.optionGrantId, exercise.grantExercisedQuantity);
  }
  for (const [grantId, quantity] of linkedQuantitiesByGrant) {
    if (quantity > (grantCounters.get(grantId) ?? 0n))
      throw new EquityInputError("Linked exercise certificates exceed the grant exercise counter");
  }

  const fullyVisited = new Set<string>();
  for (const start of certificates.keys()) {
    const path: string[] = [];
    const active = new Set<string>();
    let current: string | null = start;
    while (current !== null && !fullyVisited.has(current)) {
      if (active.has(current))
        throw new EquityInputError("The certificate lineage contains a cycle");
      const certificate = certificates.get(current);
      if (!certificate) throw new EquityInputError("The certificate lineage has an unknown origin");
      active.add(current);
      path.push(current);
      current = certificate.parentId;
    }
    for (const id of path) fullyVisited.add(id);
  }

  const originMemo = new Map<string, EquityExerciseOrigin | null>();
  for (const start of certificates.keys()) {
    const path: string[] = [];
    let current: string | null = start;
    while (current !== null && !originMemo.has(current)) {
      const origin = origins.get(current);
      if (origin) {
        originMemo.set(current, origin);
        break;
      }
      path.push(current);
      current = certificates.get(current)!.parentId;
    }
    const inheritedOrigin = current === null ? null : (originMemo.get(current) ?? null);
    for (let index = path.length - 1; index >= 0; index--)
      originMemo.set(path[index]!, inheritedOrigin);
  }

  const originFor = (id: string): EquityExerciseOrigin | null => {
    if (!certificates.has(id))
      throw new EquityInputError("The certificate lineage has an unknown origin");
    return originMemo.get(id) ?? null;
  };
  for (const certificate of certificateRows) {
    const origin = originFor(certificate.id);
    if (origin && certificate.planId !== null && certificate.planId !== origin.planId)
      throw new EquityInputError("The exercise certificate lineage changes its plan");
  }
  return {
    certificates,
    originFor,
    isExerciseOrigin: (id) => originFor(id) !== null,
  };
}

export async function loadEquityCertificateLineage(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<EquityCertificateLineageIndex> {
  const scope = scopeOf(actor);
  const [certificates, exercises] = await Promise.all([
    prisma.equityCertificate.findMany({
      where: scope,
      select: { id: true, parentId: true, planId: true, status: true, quantity: true },
    }),
    prisma.equityExercise.findMany({
      where: { ...scope, certificateId: { not: null } },
      select: {
        id: true,
        certificateId: true,
        optionGrantId: true,
        quantity: true,
        status: true,
        optionGrant: { select: { planId: true, exercisedQuantity: true } },
      },
    }),
  ]);
  return indexEquityCertificateLineage(
    certificates,
    exercises.map((exercise) => ({
      certificateId: exercise.certificateId!,
      exerciseId: exercise.id,
      optionGrantId: exercise.optionGrantId,
      planId: exercise.optionGrant.planId,
      quantity: exercise.quantity,
      status: exercise.status,
      grantExercisedQuantity: exercise.optionGrant.exercisedQuantity,
    })),
  );
}

/** Bulk, tenant-scoped plan commitments; certificate ancestry is resolved from one ledger read. */
export async function planAccountingById(
  prisma: EquityDb,
  actor: EquityScope,
  planIds: readonly string[],
): Promise<Map<string, EquityPlanAccounting>> {
  const ids = [...new Set(planIds)];
  const totals = new Map(ids.map((id) => [id, emptyAccounting()]));
  if (ids.length === 0) return totals;

  const scope = scopeOf(actor);
  const [plans, grants, lineage] = await Promise.all([
    prisma.equityPlan.findMany({
      where: { ...scope, id: { in: ids } },
      select: { id: true, reservedShares: true },
    }),
    prisma.equityOptionGrant.findMany({
      where: { ...scope, planId: { in: ids } },
      select: {
        planId: true,
        status: true,
        quantity: true,
        exercisedQuantity: true,
        canceledQuantity: true,
      },
    }),
    loadEquityCertificateLineage(prisma, actor),
  ]);

  if (plans.length !== ids.length) throw notFound("Plan");

  for (const plan of plans) {
    const value = totals.get(plan.id);
    if (value) value.reservedShares = plan.reservedShares;
  }

  for (const grant of grants) {
    const value = totals.get(grant.planId);
    if (!value) continue;
    value.grantedShares += grant.quantity;
    value.exercisedShares += grant.exercisedQuantity;
    value.returnedShares += grant.canceledQuantity;
    if (grant.status === "outstanding")
      value.outstandingShares += grant.quantity - grant.exercisedQuantity - grant.canceledQuantity;
  }

  const activeStatuses = new Set<string>(EQUITY_OUTSTANDING_CERTIFICATE_STATUSES);
  for (const certificate of lineage.certificates.values()) {
    const value = totals.get(certificate.planId ?? "");
    if (!value || !activeStatuses.has(certificate.status)) continue;
    if (!lineage.originFor(certificate.id)) value.directIssuedShares += certificate.quantity;
  }

  for (const value of totals.values()) {
    value.issuedShares = value.exercisedShares + value.directIssuedShares;
    value.rawAvailableShares =
      value.reservedShares -
      value.outstandingShares -
      value.exercisedShares -
      value.directIssuedShares;
  }
  return totals;
}
