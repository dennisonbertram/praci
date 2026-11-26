import type {
  EquityPlan,
  EquityPlanPageSchema,
  EquityShareClass,
  EquityShareClassPageSchema,
  EquityShareClassVersion,
} from "@rakazo/contracts";
import {
  EQUITY_OUTSTANDING_CERTIFICATE_STATUSES,
  EquityPlanCreateInputSchema,
  EquityPlanListInputSchema,
  EquityPlanUpdateInputSchema,
  EquityShareClassCreateInputSchema,
  EquityShareClassListInputSchema,
  EquityShareClassUpdateInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  contains,
  defined,
  EquityInputError,
  ensureLedger,
  fromBig,
  fromDate,
  fromDateOrNull,
  fromDecimal,
  fromDecimalOrNull,
  inRepeatableReadTransaction,
  inTransaction,
  iso,
  lockEquityLedger,
  lockEquityPlans,
  notFound,
  pageOf,
  recordTransaction,
  scopeOf,
  toBig,
  toDate,
  toDateOrNull,
  toDecimal,
  toDecimalOrNull,
  today,
  withConflict,
} from "./ledger.js";
import { planAccountingById } from "./plan-accounting.js";

const planLegalReferenceKinds = [
  "issue",
  "modify",
  "vesting_change",
  "exercise",
  "cancel",
  "reverse_cancellation",
  "transfer",
  "repurchase",
  "convert",
] as const;

type ClassRow = Prisma.EquityShareClassGetPayload<object>;
type VersionRow = Prisma.EquityShareClassVersionGetPayload<object>;
type PlanRow = Prisma.EquityPlanGetPayload<object>;

type EquityPlanPage = z.output<typeof EquityPlanPageSchema>;
type EquityShareClassPage = z.output<typeof EquityShareClassPageSchema>;

type VersionInput = z.infer<typeof EquityShareClassUpdateInputSchema>["terms"];

const toVersion = (row: VersionRow): EquityShareClassVersion => ({
  id: row.id,
  documentDate: fromDate(row.documentDate),
  authorizedShares: fromBig(row.authorizedShares),
  votesPerShare: fromDecimal(row.votesPerShare),
  certificated: row.certificated,
  parValue: fromDecimalOrNull(row.parValue),
  seniority: row.seniority,
  pariPassu: row.pariPassu,
  originalIssuePrice: fromDecimalOrNull(row.originalIssuePrice),
  conversionPrice: fromDecimalOrNull(row.conversionPrice),
  conversionRatio: fromDecimal(row.conversionRatio),
  multiplier: fromDecimal(row.multiplier),
  participating: row.participating,
  participationCap: fromDecimalOrNull(row.participationCap),
  dividend: row.dividend,
  dividendYield: fromDecimalOrNull(row.dividendYield),
  cumulative: row.cumulative,
  dividendAccrual: row.dividendAccrual as EquityShareClassVersion["dividendAccrual"],
  compoundingInterest: row.compoundingInterest,
  dayCountConvention: row.dayCountConvention as EquityShareClassVersion["dayCountConvention"],
});

/** A terms write, with wire types converted and omitted fields left untouched. */
const termsData = (terms: NonNullable<VersionInput>) =>
  defined({
    documentDate: terms.documentDate ? toDate(terms.documentDate) : undefined,
    authorizedShares: terms.authorizedShares ? toBig(terms.authorizedShares) : undefined,
    votesPerShare: terms.votesPerShare ? toDecimal(terms.votesPerShare) : undefined,
    certificated: terms.certificated,
    parValue: toDecimalOrNull(terms.parValue),
    seniority: terms.seniority,
    pariPassu: terms.pariPassu,
    originalIssuePrice: toDecimalOrNull(terms.originalIssuePrice),
    conversionPrice: toDecimalOrNull(terms.conversionPrice),
    conversionRatio: terms.conversionRatio ? toDecimal(terms.conversionRatio) : undefined,
    multiplier: terms.multiplier ? toDecimal(terms.multiplier) : undefined,
    participating: terms.participating,
    participationCap: toDecimalOrNull(terms.participationCap),
    dividend: terms.dividend,
    dividendYield: toDecimalOrNull(terms.dividendYield),
    cumulative: terms.cumulative,
    dividendAccrual: terms.dividendAccrual,
    compoundingInterest: terms.compoundingInterest,
    dayCountConvention: terms.dayCountConvention,
  });

/** The version in force on `asOf` (the latest when omitted), or null when none is. */
const currentVersion = (versions: VersionRow[], asOf?: string): VersionRow | null => {
  const sorted = [...versions].sort((a, b) =>
    fromDate(b.documentDate).localeCompare(fromDate(a.documentDate)),
  );
  return sorted.find((row) => (asOf ? fromDate(row.documentDate) <= asOf : true)) ?? null;
};

const toShareClass = (
  row: ClassRow & { versions: VersionRow[] },
  asOf?: string,
): EquityShareClass | null => {
  const current = currentVersion(row.versions, asOf);
  if (!current) return null;
  return {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    name: row.name,
    prefix: row.prefix,
    classType: row.classType as EquityShareClass["classType"],
    current: toVersion(current),
    versions: [...row.versions]
      .sort((a, b) => fromDate(b.documentDate).localeCompare(fromDate(a.documentDate)))
      .map(toVersion),
  };
};

const withVersions = {
  versions: { orderBy: { documentDate: "desc" } },
} satisfies Prisma.EquityShareClassInclude;

async function classDetail(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
  asOf?: string,
): Promise<EquityShareClass> {
  const row = await prisma.equityShareClass.findFirst({
    where: { id, ...scopeOf(actor) },
    include: withVersions,
  });
  if (!row) throw notFound("Share class");
  const record = toShareClass(row, asOf);
  if (!record) throw notFound("Share class terms");
  return record;
}

export async function getEquityShareClass(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityShareClass> {
  return classDetail(prisma, actor, id);
}

export async function listEquityShareClasses(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityShareClassListInputSchema>,
): Promise<EquityShareClassPage> {
  const input = EquityShareClassListInputSchema.parse(raw);
  const rows = await prisma.equityShareClass.findMany({
    where: {
      ...scopeOf(actor),
      ...(input.classType ? { classType: input.classType } : {}),
      ...(input.search ? { name: contains(input.search) } : {}),
    },
    include: withVersions,
  });
  // Seniority and the as-of cut live on versions, and the ledger has at most a few dozen
  // classes, so filtering and sorting run in memory.
  let records = rows
    .map((row) => toShareClass(row, input.asOfDocumentDate))
    .filter((row): row is EquityShareClass => row !== null);
  const sort = input.sort ?? { field: "name", dir: "asc" };
  const direction = sort.dir === "desc" ? -1 : 1;
  records = records.sort((a, b) => {
    const left =
      sort.field === "seniority"
        ? a.current.seniority
        : sort.field === "classType"
          ? a.classType
          : sort.field === "createdAt"
            ? a.createdAt
            : a.name;
    const right =
      sort.field === "seniority"
        ? b.current.seniority
        : sort.field === "classType"
          ? b.classType
          : sort.field === "createdAt"
            ? b.createdAt
            : b.name;
    const compared =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    return compared === 0 ? a.id.localeCompare(b.id) : compared * direction;
  });
  const { page, pageSize } = input;
  return pageOf(records.slice((page - 1) * pageSize, page * pageSize), records.length, input);
}

export async function createEquityShareClass(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityShareClassCreateInputSchema>,
): Promise<EquityShareClass> {
  const input = EquityShareClassCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const id = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const row = await withConflict("A share class with this name or prefix exists", () =>
      tx.equityShareClass.create({
        data: {
          ...scope,
          name: input.name,
          prefix: input.prefix,
          classType: input.classType,
          versions: {
            create: termsData(
              input.terms,
            ) as Prisma.EquityShareClassVersionCreateWithoutShareClassInput,
          },
        },
        select: { id: true },
      }),
    );
    return row.id;
  });
  return classDetail(prisma, scope, id);
}

export async function updateEquityShareClass(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityShareClassUpdateInputSchema>,
): Promise<EquityShareClass> {
  const { id, terms, ...rest } = EquityShareClassUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    const existing = await tx.equityShareClass.findFirst({
      where: { id, ...scope },
      include: withVersions,
    });
    if (!existing) throw notFound("Share class");
    await withConflict("A share class with this name or prefix exists", () =>
      tx.equityShareClass.update({
        where: { id },
        data: defined({ name: rest.name, prefix: rest.prefix }),
      }),
    );
    if (!terms) return;
    if (terms.authorizedShares) {
      const issued = await tx.equityCertificate.aggregate({
        where: {
          ...scope,
          shareClassId: id,
          status: { in: [...EQUITY_OUTSTANDING_CERTIFICATE_STATUSES] },
        },
        _sum: { quantity: true },
      });
      const outstanding = issued._sum.quantity ?? 0n;
      if (toBig(terms.authorizedShares) < outstanding)
        throw new EquityInputError("Authorized shares cannot be below the issued shares");
    }
    const sameDate = existing.versions.find(
      (version) => fromDate(version.documentDate) === terms.documentDate,
    );
    if (sameDate) {
      await tx.equityShareClassVersion.update({
        where: { id: sameDate.id },
        data: termsData(terms),
      });
      return;
    }
    const current = currentVersion(existing.versions);
    if (!current) throw new EquityInputError("The share class has no terms to copy");
    const copied: Record<string, unknown> = {
      authorizedShares: current.authorizedShares,
      votesPerShare: current.votesPerShare,
      certificated: current.certificated,
      parValue: current.parValue,
      seniority: current.seniority,
      pariPassu: current.pariPassu,
      originalIssuePrice: current.originalIssuePrice,
      conversionPrice: current.conversionPrice,
      conversionRatio: current.conversionRatio,
      multiplier: current.multiplier,
      participating: current.participating,
      participationCap: current.participationCap,
      dividend: current.dividend,
      dividendYield: current.dividendYield,
      cumulative: current.cumulative,
      dividendAccrual: current.dividendAccrual,
      compoundingInterest: current.compoundingInterest,
      dayCountConvention: current.dayCountConvention,
    };
    await tx.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: id,
        documentDate: toDate(terms.documentDate),
        ...copied,
        ...termsData(terms),
      } as Prisma.EquityShareClassVersionUncheckedCreateInput,
    });
  });
  return classDetail(prisma, scope, id);
}

// ---- equity plans ----

const toPlan = (row: PlanRow, derived: { outstanding: bigint; issued: bigint }): EquityPlan => {
  const reserved = row.reservedShares;
  const available = reserved - derived.outstanding - derived.issued;
  return {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    name: row.name,
    status: row.status as EquityPlan["status"],
    shareClassId: row.shareClassId,
    reservedShares: fromBig(reserved),
    boardApprovedOn: fromDateOrNull(row.boardApprovedOn),
    outstandingShares: fromBig(derived.outstanding),
    issuedShares: fromBig(derived.issued),
    availableShares: fromBig(available > 0n ? available : 0n),
  };
};

type Derived = { outstanding: bigint; issued: bigint };

/** The plan DTO uses exercised shares plus direct certificate issues as issued shares. */
async function derivedByPlan(
  prisma: EquityDb,
  actor: EquityScope,
  planIds: string[],
): Promise<Map<string, Derived>> {
  const accounting = await planAccountingById(prisma, actor, planIds);
  return new Map(
    [...accounting].map(([id, totals]) => [
      id,
      { outstanding: totals.outstandingShares, issued: totals.issuedShares },
    ]),
  );
}

async function planDetail(prisma: EquityDb, actor: EquityScope, id: string): Promise<EquityPlan> {
  return inRepeatableReadTransaction(prisma, async (tx) => {
    const row = await tx.equityPlan.findFirst({ where: { id, ...scopeOf(actor) } });
    if (!row) throw notFound("Plan");
    const derived = (await derivedByPlan(tx, actor, [id])).get(id)!;
    return toPlan(row, derived);
  });
}

export async function getEquityPlan(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityPlan> {
  return planDetail(prisma, actor, id);
}

export async function listEquityPlans(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPlanListInputSchema>,
): Promise<EquityPlanPage> {
  const input = EquityPlanListInputSchema.parse(raw);
  const { page, pageSize } = input;
  const sort = input.sort ?? { field: "name", dir: "asc" };
  const where: Prisma.EquityPlanWhereInput = {
    ...scopeOf(actor),
    ...(input.status ? { status: input.status } : {}),
    ...(input.search ? { name: contains(input.search) } : {}),
  };
  return inRepeatableReadTransaction(prisma, async (tx) => {
    const [rows, total] = await Promise.all([
      tx.equityPlan.findMany({
        where,
        orderBy: [{ [sort.field]: sort.dir }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tx.equityPlan.count({ where }),
    ]);
    const derived = await derivedByPlan(
      tx,
      actor,
      rows.map((row) => row.id),
    );
    return pageOf(
      rows.map((row) => toPlan(row, derived.get(row.id) ?? { outstanding: 0n, issued: 0n })),
      total,
      input,
    );
  });
}

export async function createEquityPlan(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPlanCreateInputSchema>,
): Promise<EquityPlan> {
  const input = EquityPlanCreateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const id = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    await assertInLedger(tx, scope, "equityShareClass", input.shareClassId);
    const row = await withConflict("A plan with this name exists", () =>
      tx.equityPlan.create({
        data: {
          ...scope,
          name: input.name,
          status: input.status ?? "active",
          shareClassId: input.shareClassId,
          reservedShares: toBig(input.reservedShares),
          boardApprovedOn: toDateOrNull(input.boardApprovedOn) ?? null,
        },
        select: { id: true },
      }),
    );
    await recordTransaction(tx, scope, {
      kind: "pool_change",
      effectiveDate: input.boardApprovedOn ?? today(),
      planId: row.id,
      quantity: toBig(input.reservedShares),
      before: {
        id: row.id,
        name: input.name,
        status: input.status ?? "active",
        shareClassId: input.shareClassId,
        reservedShares: "0",
        boardApprovedOn: null,
      },
      after: {
        id: row.id,
        name: input.name,
        status: input.status ?? "active",
        shareClassId: input.shareClassId,
        reservedShares: input.reservedShares,
        boardApprovedOn: input.boardApprovedOn ?? null,
      },
    });
    return row.id;
  });
  return getEquityPlan(prisma, scope, id);
}

export async function updateEquityPlan(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPlanUpdateInputSchema>,
): Promise<EquityPlan> {
  const { id, ...input } = EquityPlanUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityPlans(tx, scope, [id]);
    const existing = await tx.equityPlan.findFirst({ where: { id, ...scope } });
    if (!existing) throw notFound("Plan");
    if (input.shareClassId) await assertInLedger(tx, scope, "equityShareClass", input.shareClassId);
    if (input.shareClassId && input.shareClassId !== existing.shareClassId) {
      const [grantReferences, certificateReferences, historicalReferences] = await Promise.all([
        tx.equityOptionGrant.count({ where: { ...scope, planId: id } }),
        tx.equityCertificate.count({ where: { ...scope, planId: id } }),
        tx.equityTransaction.findFirst({
          where: {
            ...scope,
            kind: { in: [...planLegalReferenceKinds] },
            AND: [
              { OR: [{ optionGrantId: { not: null } }, { certificateId: { not: null } }] },
              {
                OR: [
                  { planId: id },
                  { before: { path: ["planId"], equals: id } },
                  { after: { path: ["planId"], equals: id } },
                ],
              },
            ],
          },
          select: { id: true },
        }),
      ]);
      if (grantReferences || certificateReferences || historicalReferences)
        throw new EquityInputError("A plan with legal grants or certificates cannot change class");
    }
    if (input.reservedShares !== undefined) {
      const derived = (await planAccountingById(tx, scope, [id])).get(id)!;
      const reserved = toBig(input.reservedShares);
      if (reserved < derived.reservedShares - derived.rawAvailableShares)
        throw new EquityInputError("Reserved shares cannot be below existing plan commitments");
    }
    await withConflict("A plan with this name exists", () =>
      tx.equityPlan.update({
        where: { id },
        data: defined({
          name: input.name,
          status: input.status,
          shareClassId: input.shareClassId,
          reservedShares:
            input.reservedShares === undefined ? undefined : toBig(input.reservedShares),
          boardApprovedOn: toDateOrNull(input.boardApprovedOn),
        }),
      }),
    );
    if (
      input.reservedShares !== undefined &&
      toBig(input.reservedShares) !== existing.reservedShares
    ) {
      const before = existing.reservedShares;
      const after = toBig(input.reservedShares);
      const difference = after > before ? after - before : before - after;
      await recordTransaction(tx, scope, {
        kind: "pool_change",
        effectiveDate: today(),
        planId: id,
        quantity: difference,
        before: {
          id: existing.id,
          name: existing.name,
          status: existing.status,
          shareClassId: existing.shareClassId,
          reservedShares: fromBig(before),
          boardApprovedOn: fromDateOrNull(existing.boardApprovedOn),
        },
        after: {
          id: existing.id,
          name: input.name ?? existing.name,
          status: input.status ?? existing.status,
          shareClassId: input.shareClassId ?? existing.shareClassId,
          reservedShares: fromBig(after),
          boardApprovedOn:
            input.boardApprovedOn === undefined
              ? fromDateOrNull(existing.boardApprovedOn)
              : input.boardApprovedOn,
        },
      });
    } else if (
      input.name !== undefined ||
      input.status !== undefined ||
      input.shareClassId !== undefined ||
      input.boardApprovedOn !== undefined
    ) {
      await recordTransaction(tx, scope, {
        kind: "modify",
        effectiveDate: today(),
        planId: id,
        before: {
          id: existing.id,
          name: existing.name,
          status: existing.status,
          shareClassId: existing.shareClassId,
          reservedShares: fromBig(existing.reservedShares),
          boardApprovedOn: fromDateOrNull(existing.boardApprovedOn),
        },
        after: {
          id: existing.id,
          name: input.name ?? existing.name,
          status: input.status ?? existing.status,
          shareClassId: input.shareClassId ?? existing.shareClassId,
          reservedShares: fromBig(existing.reservedShares),
          boardApprovedOn:
            input.boardApprovedOn === undefined
              ? fromDateOrNull(existing.boardApprovedOn)
              : input.boardApprovedOn,
        },
      });
    }
  });
  return getEquityPlan(prisma, scope, id);
}
