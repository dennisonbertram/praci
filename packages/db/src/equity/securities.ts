import type {
  EquityCertificate,
  EquityCertificatePageSchema,
  EquityConvertible,
  EquityConvertibleBlock,
  EquityConvertiblePageSchema,
  EquityTransaction,
  EquityTransactionPageSchema,
} from "@rakazo/contracts";
import {
  EQUITY_OUTSTANDING_CERTIFICATE_STATUSES,
  EquityCertificateCreateInputSchema,
  EquityCertificateListInputSchema,
  EquityCertificateUpdateInputSchema,
  EquityConvertibleBlockCreateInputSchema,
  EquityConvertibleBlockUpdateInputSchema,
  EquityConvertibleCreateInputSchema,
  EquityConvertibleListInputSchema,
  EquityConvertibleUpdateInputSchema,
  EquityTransactionListInputSchema,
} from "@rakazo/contracts";
import type { DayCount, InterestType } from "@rakazo/core/equity";
import { accruedInterestCents, parseFixed } from "@rakazo/core/equity";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import { Prisma as PrismaValue } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  contains,
  dateRange,
  defined,
  EquityInputError,
  ensureLedger,
  fromBig,
  fromBigOrNull,
  fromDate,
  fromDateOrNull,
  fromDecimalOrNull,
  inTransaction,
  iso,
  lockEquityCertificates,
  lockEquityConvertibles,
  lockEquityExercises,
  lockEquityLedger,
  lockEquityOptionGrants,
  lockEquityPlans,
  lockEquityShareClasses,
  nextLabel,
  notFound,
  pageArgs,
  pageOf,
  recordTransaction,
  scopeOf,
  toBig,
  toDate,
  toDateOrNull,
  toDecimalOrNull,
  today,
  withConflict,
} from "./ledger.js";
import { loadEquityCertificateLineage, planAccountingById } from "./plan-accounting.js";
import { keyColumns, replayedId } from "./request-key.js";

type CertificateRow = Prisma.EquityCertificateGetPayload<object> & {
  stakeholder: { name: string };
  shareClass: { name: string };
};
type ConvertibleRow = Prisma.EquityConvertibleGetPayload<object> & {
  stakeholder: { name: string };
  block: { name: string } | null;
  convertedTo: { label: string; issueDate: Date } | null;
};
type TransactionRow = Prisma.EquityTransactionGetPayload<object>;
type BlockRow = Prisma.EquityConvertibleBlockGetPayload<object>;

type EquityCertificatePage = z.infer<typeof EquityCertificatePageSchema>;
type EquityConvertiblePage = z.infer<typeof EquityConvertiblePageSchema>;
type EquityTransactionPage = z.infer<typeof EquityTransactionPageSchema>;

const CERTIFICATE_INCLUDE = {
  stakeholder: { select: { name: true } },
  shareClass: { select: { name: true } },
} as const;
const CONVERTIBLE_INCLUDE = {
  stakeholder: { select: { name: true } },
  block: { select: { name: true } },
  convertedTo: { select: { label: true, issueDate: true } },
} as const;

const nullable = (sort: string) => NULLABLE_SORTS.has(sort);
const NULLABLE_SORTS = new Set(["pricePerShare"]);
const CERTIFICATE_DEFAULT_SORT = { field: "label", dir: "asc" } as const;

const transactionValueCents = (row: {
  cashPaidCents: bigint;
  debtCanceledCents: bigint;
  ipTransferredCents: bigint;
  otherConsiderationCents: bigint;
}): bigint =>
  row.cashPaidCents + row.debtCanceledCents + row.ipTransferredCents + row.otherConsiderationCents;

// ---- interest ----

/** Interest accrued as of a date in whole cents; zero without a rate or a start date. */
export function accruedInterest(
  principalCents: bigint,
  ratePercent: string | null,
  start: string | null,
  asOf: string,
  type: InterestType | null,
  dayCount: DayCount | null,
): bigint {
  if (!ratePercent || !start) return 0n;
  return accruedInterestCents({
    principalCents,
    ratePercent: parseFixed(ratePercent),
    startDate: start,
    asOf,
    interestType: type ?? "simple",
    dayCount: dayCount ?? "actual_365",
  });
}

// ---- certificates ----

export function toCertificate(row: CertificateRow): EquityCertificate {
  return {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    label: row.label,
    stakeholderId: row.stakeholderId,
    shareClassId: row.shareClassId,
    planId: row.planId,
    status: row.status as EquityCertificate["status"],
    acceptanceStatus: row.acceptanceStatus as EquityCertificate["acceptanceStatus"],
    paperStatus: row.paperStatus as EquityCertificate["paperStatus"],
    quantity: fromBig(row.quantity),
    pricePerShare: fromDecimalOrNull(row.pricePerShare),
    pricePaidPerShare: fromDecimalOrNull(row.pricePaidPerShare),
    cashPaidCents: fromBig(row.cashPaidCents),
    debtCanceledCents: fromBig(row.debtCanceledCents),
    ipTransferredCents: fromBig(row.ipTransferredCents),
    otherConsiderationCents: fromBig(row.otherConsiderationCents),
    costBasisCents: fromBigOrNull(row.costBasisCents),
    issueDate: fromDate(row.issueDate),
    originalAcquisitionDate: fromDateOrNull(row.originalAcquisitionDate),
    issuedBy: row.issuedBy,
    boardApprovedOn: fromDateOrNull(row.boardApprovedOn),
    rule144Date: fromDateOrNull(row.rule144Date),
    federalExemption: row.federalExemption,
    stateExemption: row.stateExemption,
    stateOfResidency: row.stateOfResidency,
    legend: row.legend,
    personnel: (row.personnel ?? null) as EquityCertificate["personnel"],
    collateralized: row.collateralized,
    vestingScheduleId: row.vestingScheduleId,
    parentId: row.parentId,
    roundId: row.roundId,
    canceledOn: fromDateOrNull(row.canceledOn),
    adminNotes: row.adminNotes,
    stakeholderName: row.stakeholder.name,
    shareClassName: row.shareClass.name,
    transactionValueCents: fromBig(transactionValueCents(row)),
  };
}

export const certificateWhere = (
  actor: EquityScope,
  input: z.output<typeof EquityCertificateListInputSchema>,
): Prisma.EquityCertificateWhereInput => ({
  ...scopeOf(actor),
  ...(input.stakeholderId ? { stakeholderId: input.stakeholderId } : {}),
  ...(input.shareClassId?.length ? { shareClassId: { in: input.shareClassId } } : {}),
  ...(input.planId?.length ? { planId: { in: input.planId } } : {}),
  ...(input.status?.length ? { status: { in: input.status } } : {}),
  ...(input.acceptanceStatus?.length ? { acceptanceStatus: { in: input.acceptanceStatus } } : {}),
  ...(input.paperStatus ? { paperStatus: input.paperStatus } : {}),
  ...(input.issuedFrom || input.issuedTo
    ? { issueDate: dateRange(input.issuedFrom, input.issuedTo) }
    : {}),
  ...(input.canceledFrom || input.canceledTo
    ? { canceledOn: dateRange(input.canceledFrom, input.canceledTo) }
    : {}),
  ...(input.search
    ? {
        OR: [{ label: contains(input.search) }, { stakeholder: { name: contains(input.search) } }],
      }
    : {}),
});

function certificateOrderBy(sort: {
  field: string;
  dir: "asc" | "desc";
}): Prisma.EquityCertificateOrderByWithRelationInput[] {
  if (sort.field === "stakeholderName") return [{ stakeholder: { name: sort.dir } }, { id: "asc" }];
  return [
    nullable(sort.field)
      ? { [sort.field]: { sort: sort.dir, nulls: "last" } }
      : { [sort.field]: sort.dir },
    { id: "asc" },
  ] as Prisma.EquityCertificateOrderByWithRelationInput[];
}

async function certificateDetail(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityCertificate> {
  const row = await prisma.equityCertificate.findFirst({
    where: { id, ...scopeOf(actor) },
    include: CERTIFICATE_INCLUDE,
  });
  if (!row) throw notFound("Certificate");
  return toCertificate(row);
}

/** The class's prefix, after checking the new quantity fits its authorized shares. */
export async function assertEquityCertificateCapacity(
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  shareClassId: string,
  quantity: bigint,
  excludeId?: string,
  effectiveDate?: string,
): Promise<string> {
  await lockEquityShareClasses(tx, actor, [shareClassId]);
  const shareClass = await tx.equityShareClass.findFirst({
    where: { id: shareClassId, ...scopeOf(actor) },
    include: {
      versions: {
        where: effectiveDate ? { documentDate: { lte: toDate(effectiveDate) } } : undefined,
        orderBy: { documentDate: "desc" },
        take: 1,
      },
    },
  });
  if (!shareClass) throw new EquityInputError("Unknown share class");
  const authorized = shareClass.versions[0]?.authorizedShares ?? 0n;
  const total = await tx.equityCertificate.aggregate({
    where: {
      ...scopeOf(actor),
      shareClassId,
      status: { in: [...EQUITY_OUTSTANDING_CERTIFICATE_STATUSES] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    _sum: { quantity: true },
  });
  if ((total._sum.quantity ?? 0n) + quantity > authorized)
    throw new EquityInputError("The class does not have enough authorized shares");
  return shareClass.prefix;
}

async function assertCertificateReferences(
  prisma: EquityDb,
  actor: EquityScope,
  input: {
    stakeholderId?: string;
    shareClassId?: string;
    planId?: string | null;
    vestingScheduleId?: string | null;
    parentId?: string | null;
    roundId?: string | null;
  },
  self?: string,
) {
  await assertInLedger(prisma, actor, "equityStakeholder", input.stakeholderId);
  await assertInLedger(prisma, actor, "equityShareClass", input.shareClassId);
  await assertInLedger(prisma, actor, "equityPlan", input.planId);
  await assertInLedger(prisma, actor, "equityVestingSchedule", input.vestingScheduleId);
  await assertInLedger(prisma, actor, "equityFundingRound", input.roundId);
  if (input.planId && input.shareClassId) {
    const plan = await prisma.equityPlan.findFirst({
      where: { id: input.planId, ...scopeOf(actor) },
      select: { shareClassId: true },
    });
    if (plan && plan.shareClassId !== input.shareClassId)
      throw new EquityInputError("A certificate's share class must match its plan");
  }
  if (input.parentId && input.parentId === self)
    throw new EquityInputError("A certificate cannot be its own parent");
  await assertInLedger(prisma, actor, "equityCertificate", input.parentId);
}

const cents = (value: string | undefined) => toBig(value ?? "0");

export async function listEquityCertificates(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityCertificateListInputSchema>,
): Promise<EquityCertificatePage> {
  const input = EquityCertificateListInputSchema.parse(raw);
  const where = certificateWhere(actor, input);
  const orderBy = certificateOrderBy(input.sort ?? CERTIFICATE_DEFAULT_SORT);
  const [rows, total] = await Promise.all([
    prisma.equityCertificate.findMany({
      where,
      orderBy,
      include: CERTIFICATE_INCLUDE,
      ...pageArgs(input),
    }),
    prisma.equityCertificate.count({ where }),
  ]);
  return pageOf(rows.map(toCertificate), total, input);
}

export async function getEquityCertificate(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityCertificate> {
  return certificateDetail(prisma, actor, id);
}

/**
 * Cash paid when no consideration is given: shares times the price paid (or the price), in
 * cents, rounded half up. Without a price there is nothing to assume.
 */
export function cashFor(quantity: bigint, price: string | null): bigint {
  if (!price) return 0n;
  const [whole, fraction = ""] = price.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const priceUnits = BigInt(whole || "0") * scale + BigInt(fraction || "0");
  const hundredths = quantity * priceUnits * 100n;
  return (hundredths + scale / 2n) / scale;
}

async function assertPlanCertificateCapacity(
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  planId: string | null | undefined,
  quantity: bigint,
): Promise<void> {
  if (!planId) return;
  const totals = (await planAccountingById(tx, actor, [planId])).get(planId);
  if (!totals) throw new EquityInputError("Unknown plan");
  if (quantity > totals.rawAvailableShares)
    throw new EquityInputError("The plan does not have that many shares available");
}

async function createCertificateRow(
  tx: Prisma.TransactionClient,
  scope: EquityScope,
  input: z.output<typeof EquityCertificateCreateInputSchema>,
): Promise<string> {
  if (
    input.status &&
    !(EQUITY_OUTSTANDING_CERTIFICATE_STATUSES as readonly string[]).includes(input.status)
  )
    throw new EquityInputError("Use a certificate disposition to change its status");
  if (input.canceledOn != null)
    throw new EquityInputError("Use a certificate disposition to set its cancellation date");
  if (input.parentId != null)
    throw new EquityInputError("Certificate parent provenance is assigned by a disposition");
  await assertCertificateReferences(tx, scope, input);
  const prefix = await assertEquityCertificateCapacity(
    tx,
    scope,
    input.shareClassId,
    toBig(input.quantity),
    undefined,
    input.issueDate,
  );
  if (input.label && !input.label.startsWith(`${prefix}-`))
    throw new EquityInputError(`A certificate label starts with ${prefix}-`);
  const label = input.label ?? (await nextLabel(tx, scope, "equityCertificate", prefix));
  const row = await withConflict("A certificate with this label exists", () =>
    tx.equityCertificate.create({
      data: {
        ...scope,
        label,
        stakeholderId: input.stakeholderId,
        shareClassId: input.shareClassId,
        planId: input.planId ?? null,
        status: input.status ?? "outstanding",
        acceptanceStatus: input.acceptanceStatus ?? "accepted",
        paperStatus: input.paperStatus ?? "electronic",
        quantity: toBig(input.quantity),
        pricePerShare: toDecimalOrNull(input.pricePerShare) ?? null,
        pricePaidPerShare: toDecimalOrNull(input.pricePaidPerShare) ?? null,
        cashPaidCents:
          input.cashPaidCents == null &&
          input.debtCanceledCents == null &&
          input.ipTransferredCents == null &&
          input.otherConsiderationCents == null
            ? cashFor(toBig(input.quantity), input.pricePaidPerShare ?? input.pricePerShare ?? null)
            : cents(input.cashPaidCents),
        debtCanceledCents: cents(input.debtCanceledCents),
        ipTransferredCents: cents(input.ipTransferredCents),
        otherConsiderationCents: cents(input.otherConsiderationCents),
        costBasisCents: input.costBasisCents == null ? null : toBig(input.costBasisCents),
        issueDate: toDate(input.issueDate),
        originalAcquisitionDate: toDateOrNull(input.originalAcquisitionDate) ?? null,
        issuedBy: input.issuedBy ?? null,
        boardApprovedOn: toDateOrNull(input.boardApprovedOn) ?? null,
        rule144Date: toDateOrNull(input.rule144Date) ?? null,
        federalExemption: input.federalExemption ?? null,
        stateExemption: input.stateExemption ?? null,
        stateOfResidency: input.stateOfResidency ?? null,
        legend: input.legend ?? null,
        personnel: input.personnel ? toJsonValue(input.personnel) : PrismaValue.DbNull,
        collateralized: input.collateralized ?? false,
        vestingScheduleId: input.vestingScheduleId ?? null,
        parentId: input.parentId ?? null,
        roundId: input.roundId ?? null,
        canceledOn: toDateOrNull(input.canceledOn) ?? null,
        adminNotes: input.adminNotes ?? null,
        ...keyColumns(input),
      },
      include: CERTIFICATE_INCLUDE,
    }),
  );
  const after = toCertificate(row);
  await recordTransaction(tx, scope, {
    kind: "issue",
    effectiveDate: after.issueDate,
    certificateId: after.id,
    planId: after.planId,
    quantity: toBig(after.quantity),
    valueCents: toBig(after.transactionValueCents),
    after,
  });
  return row.id;
}

export async function createEquityCertificate(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityCertificateCreateInputSchema>,
): Promise<EquityCertificate> {
  const input = EquityCertificateCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const id = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    const replay = await replayedId(input, (requestKey) =>
      tx.equityCertificate.findFirst({
        where: { ...scope, requestKey },
        select: { id: true, requestHash: true },
      }),
    );
    if (replay) return replay;
    await lockEquityPlans(tx, scope, input.planId ? [input.planId] : []);
    await assertPlanCertificateCapacity(tx, scope, input.planId, toBig(input.quantity));
    return createCertificateRow(tx, scope, input);
  });
  return certificateDetail(prisma, scope, id);
}

/** Server-only exercise issuance; public certificate inputs cannot select this accounting path. */
export async function createEquityExerciseCertificateForPending(
  tx: Prisma.TransactionClient,
  actor: EquityScope,
  raw: z.input<typeof EquityCertificateCreateInputSchema>,
  exerciseId: string,
  optionGrantId: string,
): Promise<EquityCertificate> {
  const input = EquityCertificateCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await lockEquityLedger(tx, scope);
  await lockEquityPlans(tx, scope, input.planId ? [input.planId] : []);
  await lockEquityOptionGrants(tx, scope, [optionGrantId]);
  await lockEquityExercises(tx, scope, [exerciseId]);
  const exercise = await tx.equityExercise.findFirst({
    where: { id: exerciseId, ...scope },
    include: { optionGrant: true },
  });
  if (
    exercise?.status !== "pending" ||
    exercise.certificateId !== null ||
    exercise.optionGrantId !== optionGrantId
  )
    throw new EquityInputError("A matching pending exercise is required for issuance");
  const grant = exercise.optionGrant;
  const certificatePrice = toDecimalOrNull(input.pricePerShare);
  const paidPrice = toDecimalOrNull(input.pricePaidPerShare);
  const payment = toBig(input.cashPaidCents ?? "0");
  if (
    input.stakeholderId !== grant.stakeholderId ||
    input.shareClassId !== grant.shareClassId ||
    (input.planId ?? null) !== grant.planId ||
    toBig(input.quantity) !== exercise.quantity ||
    toDate(input.issueDate).getTime() !== exercise.exerciseDate.getTime() ||
    !certificatePrice ||
    !paidPrice ||
    certificatePrice.comparedTo(grant.exercisePrice) !== 0 ||
    paidPrice.comparedTo(grant.exercisePrice) !== 0 ||
    payment !== exercise.paymentCents ||
    toBig(input.debtCanceledCents ?? "0") !== 0n ||
    toBig(input.ipTransferredCents ?? "0") !== 0n ||
    toBig(input.otherConsiderationCents ?? "0") !== 0n ||
    grant.exercisedQuantity < exercise.quantity
  )
    throw new EquityInputError("Exercise certificate terms do not match the pending exercise");

  const certificateId = await createCertificateRow(tx, scope, input);
  await tx.equityExercise.update({
    where: { id: exerciseId },
    data: { status: "completed", certificateId },
  });
  await assertPlanCertificateCapacity(tx, scope, input.planId, 0n);
  return certificateDetail(tx, scope, certificateId);
}

export async function updateEquityCertificate(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityCertificateUpdateInputSchema>,
): Promise<EquityCertificate> {
  const { id, reason, note, ...input } = EquityCertificateUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    const hint = await tx.equityCertificate.findFirst({
      where: { id, ...scope },
      select: { planId: true },
    });
    if (!hint) throw notFound("Certificate");
    await lockEquityPlans(
      tx,
      scope,
      [hint.planId, typeof input.planId === "string" ? input.planId : null].filter(
        (planId): planId is string => planId !== null,
      ),
    );
    await lockEquityCertificates(tx, scope, [id]);
    const existing = await tx.equityCertificate.findFirst({
      where: { id, ...scope },
      include: CERTIFICATE_INCLUDE,
    });
    if (!existing) throw notFound("Certificate");
    const before = toCertificate(existing);
    const lineage = await loadEquityCertificateLineage(tx, scope);
    const isExerciseLineage = lineage.isExerciseOrigin(id);
    const existingIsOutstanding = (
      EQUITY_OUTSTANDING_CERTIFICATE_STATUSES as readonly string[]
    ).includes(existing.status);
    if (
      input.status !== undefined &&
      input.status !== existing.status &&
      (!existingIsOutstanding ||
        !(EQUITY_OUTSTANDING_CERTIFICATE_STATUSES as readonly string[]).includes(input.status))
    )
      throw new EquityInputError("Use a certificate disposition to change its status");
    if (
      input.canceledOn != null &&
      (!existing.canceledOn || toDate(input.canceledOn).getTime() !== existing.canceledOn.getTime())
    )
      throw new EquityInputError("Use a certificate disposition to set its cancellation date");
    if (input.parentId !== undefined && input.parentId !== existing.parentId)
      throw new EquityInputError("Certificate parent provenance cannot be changed");
    if (
      isExerciseLineage &&
      ((input.planId !== undefined && input.planId !== existing.planId) ||
        (input.shareClassId !== undefined && input.shareClassId !== existing.shareClassId) ||
        (input.quantity !== undefined && toBig(input.quantity) !== existing.quantity))
    )
      throw new EquityInputError("Exercise certificates cannot change plan, class or quantity");
    if (
      !existingIsOutstanding &&
      Object.keys(input).some((key) => key !== "adminNotes" && key !== "status")
    )
      throw new EquityInputError("Consumed certificate terms cannot be changed");
    const shareClassId = input.shareClassId ?? existing.shareClassId;
    const planId = input.planId === undefined ? existing.planId : input.planId;
    await assertCertificateReferences(
      tx,
      scope,
      {
        stakeholderId: input.stakeholderId ?? existing.stakeholderId,
        shareClassId,
        planId,
        vestingScheduleId: input.vestingScheduleId ?? existing.vestingScheduleId,
        parentId: input.parentId ?? existing.parentId,
        roundId: input.roundId ?? existing.roundId,
      },
      id,
    );
    const quantity = input.quantity === undefined ? existing.quantity : toBig(input.quantity);
    if (planId && !isExerciseLineage) {
      const totals = (await planAccountingById(tx, scope, [planId])).get(planId);
      if (!totals) throw new EquityInputError("Unknown plan");
      const existingCommitment =
        existingIsOutstanding && existing.planId === planId ? existing.quantity : 0n;
      const available = totals.rawAvailableShares + existingCommitment;
      const nextCommitment = existingIsOutstanding ? quantity : 0n;
      if (nextCommitment > available)
        throw new EquityInputError("The plan does not have that many shares available");
    }
    if (
      input.shareClassId !== undefined ||
      input.quantity !== undefined ||
      input.issueDate !== undefined
    )
      await assertEquityCertificateCapacity(
        tx,
        scope,
        shareClassId,
        quantity,
        id,
        input.issueDate ?? before.issueDate,
      );
    if (input.label !== undefined) {
      const shareClass = await tx.equityShareClass.findFirst({
        where: { id: shareClassId, ...scope },
        select: { prefix: true },
      });
      if (!shareClass) throw new EquityInputError("Unknown share class");
      if (!input.label.startsWith(`${shareClass.prefix}-`))
        throw new EquityInputError(`A certificate label starts with ${shareClass.prefix}-`);
    }
    const row = await withConflict("A certificate with this label exists", () =>
      tx.equityCertificate.update({
        where: { id },
        data: defined({
          stakeholderId: input.stakeholderId,
          shareClassId: input.shareClassId,
          planId: input.planId,
          status: input.status,
          label: input.label,
          acceptanceStatus: input.acceptanceStatus,
          paperStatus: input.paperStatus,
          quantity: input.quantity === undefined ? undefined : toBig(input.quantity),
          pricePerShare: toDecimalOrNull(input.pricePerShare),
          pricePaidPerShare: toDecimalOrNull(input.pricePaidPerShare),
          cashPaidCents: input.cashPaidCents === undefined ? undefined : toBig(input.cashPaidCents),
          debtCanceledCents:
            input.debtCanceledCents !== undefined ? toBig(input.debtCanceledCents) : undefined,
          ipTransferredCents:
            input.ipTransferredCents !== undefined ? toBig(input.ipTransferredCents) : undefined,
          otherConsiderationCents:
            input.otherConsiderationCents !== undefined
              ? toBig(input.otherConsiderationCents)
              : undefined,
          costBasisCents:
            input.costBasisCents === undefined
              ? undefined
              : input.costBasisCents === null
                ? null
                : toBig(input.costBasisCents),
          issueDate: input.issueDate === undefined ? undefined : toDate(input.issueDate),
          originalAcquisitionDate: toDateOrNull(input.originalAcquisitionDate),
          issuedBy: input.issuedBy,
          boardApprovedOn: toDateOrNull(input.boardApprovedOn),
          rule144Date: toDateOrNull(input.rule144Date),
          federalExemption: input.federalExemption,
          stateExemption: input.stateExemption,
          stateOfResidency: input.stateOfResidency,
          legend: input.legend,
          personnel:
            input.personnel === undefined
              ? undefined
              : input.personnel === null
                ? PrismaValue.DbNull
                : toJsonValue(input.personnel),
          collateralized: input.collateralized,
          vestingScheduleId: input.vestingScheduleId,
          parentId: input.parentId,
          roundId: input.roundId,
          canceledOn: toDateOrNull(input.canceledOn),
          adminNotes: input.adminNotes,
        }),
        include: CERTIFICATE_INCLUDE,
      }),
    );
    const after = toCertificate(row);
    const onlyVesting =
      input.vestingScheduleId !== undefined &&
      Object.keys(input).every((key) => key === "vestingScheduleId");
    await recordTransaction(tx, scope, {
      kind: onlyVesting ? "vesting_change" : "modify",
      effectiveDate: today(),
      reason,
      certificateId: id,
      planId: after.planId,
      quantity: toBig(after.quantity),
      valueCents: toBig(after.transactionValueCents),
      before,
      after,
      note: note ?? null,
    });
  });
  return certificateDetail(prisma, scope, id);
}

// ---- convertible blocks ----

const toBlock = (row: BlockRow): EquityConvertibleBlock => ({
  id: row.id,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt),
  name: row.name,
  kind: row.kind as EquityConvertibleBlock["kind"],
});

export async function listEquityConvertibleBlocks(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<EquityConvertibleBlock[]> {
  const rows = await prisma.equityConvertibleBlock.findMany({
    where: scopeOf(actor),
    orderBy: { name: "asc" },
  });
  return rows.map(toBlock);
}

export async function createEquityConvertibleBlock(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityConvertibleBlockCreateInputSchema>,
): Promise<EquityConvertibleBlock> {
  const input = EquityConvertibleBlockCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    const replay = await replayedId(input, (requestKey) =>
      tx.equityConvertibleBlock.findFirst({
        where: { ...scope, requestKey },
        select: { id: true, requestHash: true },
      }),
    );
    if (replay)
      return toBlock(
        await tx.equityConvertibleBlock.findFirstOrThrow({ where: { id: replay, ...scope } }),
      );
    const row = await withConflict("A convertible block with this name exists", () =>
      tx.equityConvertibleBlock.create({
        data: { ...scope, name: input.name, kind: input.kind, ...keyColumns(input) },
      }),
    );
    return toBlock(row);
  });
}

export async function updateEquityConvertibleBlock(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityConvertibleBlockUpdateInputSchema>,
): Promise<EquityConvertibleBlock> {
  const { id, ...input } = EquityConvertibleBlockUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const existing = await prisma.equityConvertibleBlock.findFirst({ where: { id, ...scope } });
  if (!existing) throw notFound("Convertible block");
  const row = await withConflict("A convertible block with this name exists", () =>
    prisma.equityConvertibleBlock.update({ where: { id }, data: defined(input) }),
  );
  return toBlock(row);
}

// ---- convertibles ----

/** Returns the interest cutoff from an explicit closure date, or null when terminal evidence is unknown. */
export function interestUntil(
  row: {
    status: string;
    closedOn: Date | null;
  },
  asOf: string,
): string | null {
  if (row.status === "outstanding") return asOf;
  if (!row.closedOn) return null;
  const closed = fromDate(row.closedOn);
  return closed < asOf ? closed : asOf;
}

export function toConvertible(row: ConvertibleRow, asOf = today()): EquityConvertible {
  const interestUntilDate = interestUntil(row, asOf);
  const interestBearing =
    row.kind === "note" && row.interestRate !== null && row.interestRate.greaterThan(0);
  const interest =
    interestUntilDate === null && interestBearing
      ? null
      : accruedInterest(
          row.principalCents,
          fromDecimalOrNull(row.interestRate),
          fromDateOrNull(row.interestStartDate),
          interestUntilDate ?? asOf,
          row.interestType === "compound"
            ? "compound"
            : row.interestType === "simple"
              ? "simple"
              : null,
          (row.dayCountConvention as DayCount | null) ?? null,
        );
  return {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    label: row.label,
    stakeholderId: row.stakeholderId,
    blockId: row.blockId,
    kind: row.kind as EquityConvertible["kind"],
    status: row.status as EquityConvertible["status"],
    principalCents: fromBig(row.principalCents),
    issueDate: fromDate(row.issueDate),
    issuedBy: row.issuedBy,
    boardApprovedOn: fromDateOrNull(row.boardApprovedOn),
    interestRate: fromDecimalOrNull(row.interestRate),
    interestStartDate: fromDateOrNull(row.interestStartDate),
    interestType: row.interestType as EquityConvertible["interestType"],
    dayCountConvention: row.dayCountConvention as EquityConvertible["dayCountConvention"],
    maturityDate: fromDateOrNull(row.maturityDate),
    valuationCapCents: fromBigOrNull(row.valuationCapCents),
    valuationCapType: row.valuationCapType as EquityConvertible["valuationCapType"],
    discountPercent: fromDecimalOrNull(row.discountPercent),
    conversionPriceBasis: row.conversionPriceBasis,
    liquidityPriority: row.liquidityPriority,
    convertsToShareClassId: row.convertsToShareClassId,
    cashoutMultiplier: fromDecimalOrNull(row.cashoutMultiplier),
    mfn: row.mfn,
    proRata: row.proRata,
    federalExemption: row.federalExemption,
    stateExemption: row.stateExemption,
    stateOfResidency: row.stateOfResidency,
    canceledOn: fromDateOrNull(row.canceledOn),
    closedOn: fromDateOrNull(row.closedOn),
    cancellationReason: row.cancellationReason,
    convertedToId: row.convertedToId,
    roundId: row.roundId,
    adminNotes: row.adminNotes,
    stakeholderName: row.stakeholder.name,
    blockName: row.block?.name ?? null,
    convertedToLabel: row.convertedTo?.label ?? null,
    interestAccruedCents: interest === null ? null : fromBig(interest),
    totalCents: interest === null ? null : fromBig(row.principalCents + interest),
  };
}

export const convertibleWhere = (
  actor: EquityScope,
  input: z.output<typeof EquityConvertibleListInputSchema>,
): Prisma.EquityConvertibleWhereInput => ({
  ...scopeOf(actor),
  ...(input.stakeholderId ? { stakeholderId: input.stakeholderId } : {}),
  ...(input.blockId?.length ? { blockId: { in: input.blockId } } : {}),
  ...(input.kind ? { kind: input.kind } : {}),
  ...(input.status?.length ? { status: { in: input.status } } : {}),
  ...(input.issuedFrom || input.issuedTo
    ? { issueDate: dateRange(input.issuedFrom, input.issuedTo) }
    : {}),
  ...(input.search
    ? {
        OR: [{ label: contains(input.search) }, { stakeholder: { name: contains(input.search) } }],
      }
    : {}),
});

async function convertibleDetail(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityConvertible> {
  const row = await prisma.equityConvertible.findFirst({
    where: { id, ...scopeOf(actor) },
    include: CONVERTIBLE_INCLUDE,
  });
  if (!row) throw notFound("Convertible");
  return toConvertible(row);
}

async function assertConvertibleReferences(
  prisma: EquityDb,
  actor: EquityScope,
  input: {
    stakeholderId?: string;
    blockId?: string | null;
    convertsToShareClassId?: string | null;
    convertedToId?: string | null;
    roundId?: string | null;
  },
) {
  await assertInLedger(prisma, actor, "equityStakeholder", input.stakeholderId);
  await assertInLedger(prisma, actor, "equityConvertibleBlock", input.blockId);
  await assertInLedger(prisma, actor, "equityShareClass", input.convertsToShareClassId);
  await assertInLedger(prisma, actor, "equityCertificate", input.convertedToId);
  await assertInLedger(prisma, actor, "equityFundingRound", input.roundId);
}

const convertiblePrefix = (kind: "safe" | "note") => (kind === "safe" ? "SAFE" : "CN");

export async function listEquityConvertibles(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityConvertibleListInputSchema>,
): Promise<EquityConvertiblePage> {
  const input = EquityConvertibleListInputSchema.parse(raw);
  const where = convertibleWhere(actor, input);
  const sort = input.sort ?? { field: "label", dir: "asc" };
  const orderBy: Prisma.EquityConvertibleOrderByWithRelationInput[] =
    sort.field === "stakeholderName"
      ? [{ stakeholder: { name: sort.dir } }, { id: "asc" }]
      : [{ [sort.field]: sort.dir }, { id: "asc" }];
  const asOf = today();
  const [rows, total] = await Promise.all([
    prisma.equityConvertible.findMany({
      where,
      orderBy,
      include: CONVERTIBLE_INCLUDE,
      ...pageArgs(input),
    }),
    prisma.equityConvertible.count({ where }),
  ]);
  return pageOf(
    rows.map((row) => toConvertible(row, asOf)),
    total,
    input,
  );
}

export async function getEquityConvertible(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityConvertible> {
  return convertibleDetail(prisma, actor, id);
}

export async function createEquityConvertible(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityConvertibleCreateInputSchema>,
  provenance: { sourceSafeId?: string } = {},
): Promise<EquityConvertible> {
  const input = EquityConvertibleCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const id = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    const replay = await replayedId(input, (requestKey) =>
      tx.equityConvertible.findFirst({
        where: { ...scope, requestKey },
        select: { id: true, requestHash: true },
      }),
    );
    if (replay) return replay;
    if (input.status !== undefined && input.status !== "outstanding")
      throw new EquityInputError("Use a convertible transaction to set its status");
    if (input.closedOn !== undefined)
      throw new EquityInputError("A new outstanding convertible cannot specify a closure date");
    if (input.convertedToId != null || input.canceledOn != null || input.cancellationReason != null)
      throw new EquityInputError("Convertible lifecycle provenance cannot be supplied on create");
    if (provenance.sourceSafeId) {
      const sourceSafe = await tx.safe.findFirst({
        where: { id: provenance.sourceSafeId, ...scope },
        select: { id: true },
      });
      if (!sourceSafe) throw notFound("SAFE");
    }
    await assertConvertibleReferences(tx, scope, input);
    const prefix = convertiblePrefix(input.kind);
    if (input.label && !input.label.startsWith(`${prefix}-`))
      throw new EquityInputError(`A ${input.kind} label starts with ${prefix}-`);
    const label = input.label ?? (await nextLabel(tx, scope, "equityConvertible", prefix));
    const row = await withConflict("A convertible with this label exists", () =>
      tx.equityConvertible.create({
        data: {
          ...scope,
          label,
          stakeholderId: input.stakeholderId,
          blockId: input.blockId ?? null,
          kind: input.kind,
          status: input.status ?? "outstanding",
          principalCents: toBig(input.principalCents),
          issueDate: toDate(input.issueDate),
          issuedBy: input.issuedBy ?? null,
          boardApprovedOn: toDateOrNull(input.boardApprovedOn) ?? null,
          interestRate: toDecimalOrNull(input.interestRate) ?? null,
          interestStartDate: toDateOrNull(input.interestStartDate) ?? null,
          interestType: input.interestType ?? null,
          dayCountConvention: input.dayCountConvention ?? null,
          maturityDate: toDateOrNull(input.maturityDate) ?? null,
          valuationCapCents:
            input.valuationCapCents == null ? null : toBig(input.valuationCapCents),
          valuationCapType: input.valuationCapType ?? null,
          discountPercent: toDecimalOrNull(input.discountPercent) ?? null,
          conversionPriceBasis: input.conversionPriceBasis ?? null,
          liquidityPriority: input.liquidityPriority ?? null,
          convertsToShareClassId: input.convertsToShareClassId ?? null,
          cashoutMultiplier: toDecimalOrNull(input.cashoutMultiplier) ?? null,
          mfn: input.mfn ?? false,
          proRata: input.proRata ?? false,
          federalExemption: input.federalExemption ?? null,
          stateExemption: input.stateExemption ?? null,
          stateOfResidency: input.stateOfResidency ?? null,
          canceledOn: toDateOrNull(input.canceledOn) ?? null,
          closedOn: null,
          cancellationReason: input.cancellationReason ?? null,
          convertedToId: input.convertedToId ?? null,
          roundId: input.roundId ?? null,
          sourceSafeId: provenance.sourceSafeId ?? null,
          adminNotes: input.adminNotes ?? null,
          ...keyColumns(input),
        },
        include: CONVERTIBLE_INCLUDE,
      }),
    );
    const after = toConvertible(row);
    await recordTransaction(tx, scope, {
      kind: "issue",
      effectiveDate: after.issueDate,
      convertibleId: after.id,
      valueCents: toBig(after.principalCents),
      after: provenance.sourceSafeId ? { ...after, sourceSafeId: provenance.sourceSafeId } : after,
    });
    return row.id;
  });
  return convertibleDetail(prisma, scope, id);
}

export async function updateEquityConvertible(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityConvertibleUpdateInputSchema>,
): Promise<EquityConvertible> {
  const { id, reason, note, ...input } = EquityConvertibleUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityConvertibles(tx, scope, [id]);
    const existing = await tx.equityConvertible.findFirst({
      where: { id, ...scope },
      include: CONVERTIBLE_INCLUDE,
    });
    if (!existing) throw notFound("Convertible");
    const before = toConvertible(existing);
    const isNoteRepayment =
      existing.status === "outstanding" && existing.kind === "note" && input.status === "repaid";
    const isClosureRepair =
      existing.status !== "outstanding" &&
      existing.closedOn === null &&
      input.closedOn != null &&
      reason === "clerical_error" &&
      Object.keys(input).every((key) => ["id", "closedOn", "reason", "note"].includes(key));
    if (
      isNoteRepayment &&
      Object.keys(input).some((key) => !["status", "closedOn", "label", "adminNotes"].includes(key))
    )
      throw new EquityInputError("A note repayment cannot change its legal terms");
    if (input.status !== undefined && input.status !== existing.status && !isNoteRepayment)
      throw new EquityInputError("Use a convertible transaction to change its status");
    if (isNoteRepayment && input.closedOn == null)
      throw new EquityInputError("A note repayment requires a closure date");
    if (input.closedOn !== undefined) {
      const sameDate =
        input.closedOn === null
          ? existing.closedOn === null
          : toDate(input.closedOn).getTime() === existing.closedOn?.getTime();
      if (!sameDate) {
        if (input.closedOn === null || (!isNoteRepayment && !isClosureRepair))
          throw new EquityInputError("A convertible closure date is immutable");
        if (toDate(input.closedOn).getTime() < existing.issueDate.getTime())
          throw new EquityInputError("Closure cannot be before the convertible issue date");
      }
    }
    if (input.convertedToId !== undefined && input.convertedToId !== existing.convertedToId)
      throw new EquityInputError("Convertible conversion provenance cannot be changed");
    if (
      input.canceledOn !== undefined &&
      (input.canceledOn === null
        ? existing.canceledOn !== null
        : toDate(input.canceledOn).getTime() !== existing.canceledOn?.getTime())
    )
      throw new EquityInputError("Use convertible cancellation to set its cancellation date");
    if (
      input.cancellationReason !== undefined &&
      input.cancellationReason !== existing.cancellationReason
    )
      throw new EquityInputError("Use convertible cancellation to set its cancellation reason");
    if (
      existing.status !== "outstanding" &&
      Object.keys(input).some(
        (key) =>
          ![
            "label",
            "adminNotes",
            "status",
            "convertedToId",
            "canceledOn",
            "closedOn",
            "cancellationReason",
          ].includes(key),
      )
    )
      throw new EquityInputError("Consumed convertible terms cannot be changed");
    const labelKind = input.kind ?? (existing.kind as "safe" | "note");
    const prefix = convertiblePrefix(labelKind);
    if (input.label && !input.label.startsWith(`${prefix}-`))
      throw new EquityInputError(`A ${labelKind} label starts with ${prefix}-`);
    await assertConvertibleReferences(tx, scope, input);
    if (input.valuationCapCents !== undefined || input.valuationCapType !== undefined) {
      const capCents =
        input.valuationCapCents !== undefined
          ? input.valuationCapCents
          : (existing.valuationCapCents?.toString() ?? null);
      const capType =
        input.valuationCapType !== undefined ? input.valuationCapType : existing.valuationCapType;
      if (capCents !== null && BigInt(capCents) > 0n && capType == null)
        throw new EquityInputError("A valuation cap needs a cap type");
    }
    const row = await withConflict("A convertible with this label exists", () =>
      tx.equityConvertible.update({
        where: { id },
        data: defined({
          label: input.label,
          stakeholderId: input.stakeholderId,
          blockId: input.blockId,
          kind: input.kind,
          status: input.status,
          principalCents:
            input.principalCents !== undefined ? toBig(input.principalCents) : undefined,
          issueDate: input.issueDate === undefined ? undefined : toDate(input.issueDate),
          issuedBy: input.issuedBy,
          boardApprovedOn: toDateOrNull(input.boardApprovedOn),
          interestRate: toDecimalOrNull(input.interestRate),
          interestStartDate: toDateOrNull(input.interestStartDate),
          interestType: input.interestType,
          dayCountConvention: input.dayCountConvention,
          maturityDate: toDateOrNull(input.maturityDate),
          valuationCapCents:
            input.valuationCapCents === undefined
              ? undefined
              : input.valuationCapCents === null
                ? null
                : toBig(input.valuationCapCents),
          valuationCapType: input.valuationCapType,
          discountPercent: toDecimalOrNull(input.discountPercent),
          conversionPriceBasis: input.conversionPriceBasis,
          liquidityPriority: input.liquidityPriority,
          convertsToShareClassId: input.convertsToShareClassId,
          cashoutMultiplier: toDecimalOrNull(input.cashoutMultiplier),
          mfn: input.mfn,
          proRata: input.proRata,
          federalExemption: input.federalExemption,
          stateExemption: input.stateExemption,
          stateOfResidency: input.stateOfResidency,
          canceledOn: toDateOrNull(input.canceledOn),
          closedOn: toDateOrNull(input.closedOn),
          cancellationReason: input.cancellationReason,
          convertedToId: input.convertedToId,
          roundId: input.roundId,
          adminNotes: input.adminNotes,
        }),
        include: CONVERTIBLE_INCLUDE,
      }),
    );
    const after = toConvertible(row);
    await recordTransaction(tx, scope, {
      kind: "modify",
      effectiveDate: isNoteRepayment || isClosureRepair ? input.closedOn! : today(),
      reason,
      convertibleId: id,
      valueCents: toBig(after.principalCents),
      before,
      after,
      note: note ?? null,
    });
  });
  return convertibleDetail(prisma, scope, id);
}

// ---- transactions ----

const toTransaction = (row: TransactionRow, securityLabel: string | null): EquityTransaction => ({
  id: row.id,
  kind: row.kind as EquityTransaction["kind"],
  effectiveDate: fromDate(row.effectiveDate),
  reason: row.reason,
  certificateId: row.certificateId,
  convertibleId: row.convertibleId,
  optionGrantId: row.optionGrantId,
  planId: row.planId,
  securityLabel,
  quantity: fromBigOrNull(row.quantity),
  valueCents: fromBigOrNull(row.valueCents),
  before: row.before ?? null,
  after: row.after ?? null,
  resulting: Array.isArray(row.resulting) ? (row.resulting as string[]) : [],
  note: row.note,
  actorName: row.actorName,
  createdAt: iso(row.createdAt),
});

/** One batched label lookup for a page of transactions. */
async function securityLabels(
  prisma: EquityDb,
  actor: EquityScope,
  rows: TransactionRow[],
): Promise<Map<string, string>> {
  const scope = scopeOf(actor);
  const ids = <K extends "certificateId" | "convertibleId" | "optionGrantId">(key: K) =>
    rows.map((row) => row[key]).filter((id): id is string => id !== null);
  const certificateIds = ids("certificateId");
  const convertibleIds = ids("convertibleId");
  const optionGrantIds = ids("optionGrantId");
  const labels = new Map<string, string>();
  if (!certificateIds.length && !convertibleIds.length && !optionGrantIds.length) return labels;
  const [certificates, convertibles, grants] = await Promise.all([
    certificateIds.length
      ? prisma.equityCertificate.findMany({
          where: { ...scope, id: { in: certificateIds } },
          select: { id: true, label: true },
        })
      : [],
    convertibleIds.length
      ? prisma.equityConvertible.findMany({
          where: { ...scope, id: { in: convertibleIds } },
          select: { id: true, label: true },
        })
      : [],
    optionGrantIds.length
      ? prisma.equityOptionGrant.findMany({
          where: { ...scope, id: { in: optionGrantIds } },
          select: { id: true, label: true },
        })
      : [],
  ]);
  for (const row of [...certificates, ...convertibles, ...grants]) labels.set(row.id, row.label);
  return labels;
}

const labelOf = (row: TransactionRow, labels: Map<string, string>): string | null => {
  const id = row.certificateId ?? row.convertibleId ?? row.optionGrantId;
  return id ? (labels.get(id) ?? null) : null;
};

export async function listEquityTransactions(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityTransactionListInputSchema>,
): Promise<EquityTransactionPage> {
  const input = EquityTransactionListInputSchema.parse(raw);
  const where: Prisma.EquityTransactionWhereInput = {
    ...scopeOf(actor),
    ...(input.kind?.length ? { kind: { in: input.kind } } : {}),
    ...(input.certificateId ? { certificateId: input.certificateId } : {}),
    ...(input.convertibleId ? { convertibleId: input.convertibleId } : {}),
    ...(input.optionGrantId ? { optionGrantId: input.optionGrantId } : {}),
    ...(input.planId ? { planId: input.planId } : {}),
    ...(input.from || input.to ? { effectiveDate: dateRange(input.from, input.to) } : {}),
    ...(input.search
      ? {
          OR: [
            { note: contains(input.search) },
            { actorName: contains(input.search) },
            { kind: contains(input.search) },
            // The security a change touched, by its label (CS-12, ES-3): what people search for.
            { certificate: { label: contains(input.search) } },
            { convertible: { label: contains(input.search) } },
            { optionGrant: { label: contains(input.search) } },
          ],
        }
      : {}),
  };
  const sort = input.sort ?? { field: "createdAt", dir: "desc" };
  const [rows, total] = await Promise.all([
    prisma.equityTransaction.findMany({
      where,
      orderBy: [{ [sort.field]: sort.dir }, { id: "asc" }],
      ...pageArgs(input),
    }),
    prisma.equityTransaction.count({ where }),
  ]);
  const labels = await securityLabels(prisma, actor, rows);
  return pageOf(
    rows.map((row) => toTransaction(row, labelOf(row, labels))),
    total,
    input,
  );
}

export async function getEquityTransaction(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityTransaction> {
  const row = await prisma.equityTransaction.findFirst({ where: { id, ...scopeOf(actor) } });
  if (!row) throw notFound("Transaction");
  const labels = await securityLabels(prisma, actor, [row]);
  return toTransaction(row, labelOf(row, labels));
}

/** JSON value for a nullable Json column, without a null that Prisma would reject. */
function toJsonValue(value: unknown): PrismaValue.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as PrismaValue.InputJsonValue;
}
