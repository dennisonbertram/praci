import type {
  EquityDraftSet,
  EquityDraftSetPageSchema,
  EquityFundingRound,
  EquityFundingRoundPageSchema,
  EquityRoundOverridesSchema,
} from "@rakazo/contracts";
import {
  EquityCertificateCreateInputSchema,
  EquityConvertibleCreateInputSchema,
  EquityDraftSetCreateInputSchema,
  EquityDraftSetListInputSchema,
  EquityDraftSetSchema,
  EquityDraftSetUpdateInputSchema,
  EquityFundingRoundCreateInputSchema,
  EquityFundingRoundListInputSchema,
  EquityFundingRoundSchema,
  EquityFundingRoundUpdateInputSchema,
  EquityOptionGrantCreateInputSchema,
} from "@rakazo/contracts";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  contains,
  defined,
  EquityConflictError,
  EquityInputError,
  ensureLedger,
  fromBig,
  fromDate,
  fromDateOrNull,
  fromDecimalOrNull,
  inTransaction,
  iso,
  lockEquityDraftSets,
  lockEquityFundingRounds,
  lockEquityLedger,
  notFound,
  pageArgs,
  pageOf,
  scopeOf,
  toBig,
  toDate,
  toDateOrNull,
  toDecimalOrNull,
  withConflict,
} from "./ledger.js";
import { loadEquityRaised } from "./views-raised.js";

type EquityRoundOverrides = z.infer<typeof EquityRoundOverridesSchema>;
type EquityFundingRoundPage = z.infer<typeof EquityFundingRoundPageSchema>;
type EquityDraftSetPage = z.infer<typeof EquityDraftSetPageSchema>;

type RoundRow = Prisma.EquityFundingRoundGetPayload<object>;
type DraftSetRow = Prisma.EquityDraftSetGetPayload<object>;

// ---- funding rounds ----

type Derived = {
  cashRaisedCents: bigint;
  sharesIssued: bigint;
  securityCount: number;
  shareClassCount: number;
};

const EMPTY: Derived = {
  cashRaisedCents: 0n,
  sharesIssued: 0n,
  securityCount: 0,
  shareClassCount: 0,
};

/** Cents and shares contributed by the certificates and convertibles of these rounds. */
async function derivedFor(
  prisma: EquityDb,
  actor: EquityScope,
  roundIds: string[],
): Promise<Map<string, Derived>> {
  const result = new Map<string, Derived>(roundIds.map((id) => [id, { ...EMPTY }]));
  if (!roundIds.length) return result;
  const scope = scopeOf(actor);
  const certWhere = {
    ...scope,
    roundId: { in: roundIds },
    status: { not: "canceled" },
  } satisfies Prisma.EquityCertificateWhereInput;
  const [certs, convertibles, classes] = await Promise.all([
    prisma.equityCertificate.groupBy({
      by: ["roundId"],
      where: certWhere,
      _sum: {
        quantity: true,
        cashPaidCents: true,
        debtCanceledCents: true,
        ipTransferredCents: true,
        otherConsiderationCents: true,
      },
      _count: { _all: true },
    }),
    prisma.equityConvertible.groupBy({
      by: ["roundId"],
      where: { ...scope, roundId: { in: roundIds }, status: { not: "canceled" } },
      _sum: { principalCents: true },
      _count: { _all: true },
    }),
    prisma.equityCertificate.groupBy({ by: ["roundId", "shareClassId"], where: certWhere }),
  ]);
  // Cash raised follows the one rule the overview and cash raised view use (views-raised.ts).
  const raised = await loadEquityRaised(prisma, scope, { roundIds });
  for (const [roundId, cents] of raised.byRound) {
    const entry = result.get(roundId);
    if (entry) entry.cashRaisedCents = cents;
  }
  for (const row of certs) {
    if (!row.roundId) continue;
    const entry = result.get(row.roundId);
    if (!entry) continue;
    entry.sharesIssued += row._sum.quantity ?? 0n;
    entry.securityCount += row._count._all;
  }
  for (const row of convertibles) {
    if (!row.roundId) continue;
    const entry = result.get(row.roundId);
    if (!entry) continue;
    entry.securityCount += row._count._all;
  }
  for (const row of classes) {
    if (!row.roundId) continue;
    const entry = result.get(row.roundId);
    if (entry) entry.shareClassCount += 1;
  }
  return result;
}

const overridesOf = (row: RoundRow): EquityRoundOverrides =>
  (row.overrides ?? {}) as EquityRoundOverrides;

function toRound(row: RoundRow, derived: Derived): EquityFundingRound {
  return {
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    name: row.name,
    startDate: fromDate(row.startDate),
    endDate: fromDateOrNull(row.endDate),
    closingDate: fromDateOrNull(row.closingDate),
    originalIssuePrice: fromDecimalOrNull(row.originalIssuePrice),
    preMoneyValuationCents:
      row.preMoneyValuationCents === null ? null : fromBig(row.preMoneyValuationCents),
    overrides: overridesOf(row),
    cashRaisedCents: overridesOf(row).cashRaisedCents ?? fromBig(derived.cashRaisedCents),
    sharesIssued: overridesOf(row).sharesIssued ?? fromBig(derived.sharesIssued),
    securityCount: derived.securityCount,
    shareClassCount: derived.shareClassCount,
  };
}

function checkDates(startDate: string, endDate?: string | null, closingDate?: string | null) {
  if (endDate && endDate < startDate)
    throw new EquityInputError("The end date cannot be before the start date");
  if (closingDate && closingDate < startDate)
    throw new EquityInputError("The closing date cannot be before the start date");
}

function roundData(input: {
  name?: string;
  startDate?: string;
  endDate?: string | null;
  closingDate?: string | null;
  originalIssuePrice?: string | null;
  preMoneyValuationCents?: string | null;
  overrides?: EquityRoundOverrides;
}) {
  return defined({
    name: input.name,
    startDate: input.startDate === undefined ? undefined : toDate(input.startDate),
    endDate: toDateOrNull(input.endDate),
    closingDate: toDateOrNull(input.closingDate),
    originalIssuePrice: toDecimalOrNull(input.originalIssuePrice),
    preMoneyValuationCents:
      input.preMoneyValuationCents === undefined
        ? undefined
        : input.preMoneyValuationCents === null
          ? null
          : toBig(input.preMoneyValuationCents),
    overrides: input.overrides,
  });
}

export async function listEquityFundingRounds(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityFundingRoundListInputSchema>,
): Promise<EquityFundingRoundPage> {
  const input = EquityFundingRoundListInputSchema.parse(raw);
  const where: Prisma.EquityFundingRoundWhereInput = {
    ...scopeOf(actor),
    ...(input.search ? { name: contains(input.search) } : {}),
  };
  const sort = input.sort ?? { field: "startDate", dir: "desc" as const };
  const orderBy: Prisma.EquityFundingRoundOrderByWithRelationInput[] = [
    sort.field === "closingDate"
      ? { closingDate: { sort: sort.dir, nulls: "last" } }
      : { [sort.field]: sort.dir },
    { id: "asc" },
  ];
  const [rows, total] = await Promise.all([
    prisma.equityFundingRound.findMany({ where, orderBy, ...pageArgs(input) }),
    prisma.equityFundingRound.count({ where }),
  ]);
  const derived = await derivedFor(
    prisma,
    actor,
    rows.map((row) => row.id),
  );
  return pageOf(
    rows.map((row) => toRound(row, derived.get(row.id) ?? EMPTY)),
    total,
    input,
  );
}

export async function getEquityFundingRound(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityFundingRound> {
  const row = await prisma.equityFundingRound.findFirst({ where: { id, ...scopeOf(actor) } });
  if (!row) throw notFound("Funding round");
  const derived = await derivedFor(prisma, actor, [id]);
  return EquityFundingRoundSchema.parse(toRound(row, derived.get(id) ?? EMPTY));
}

export async function createEquityFundingRound(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityFundingRoundCreateInputSchema>,
): Promise<EquityFundingRound> {
  const input = EquityFundingRoundCreateInputSchema.parse(raw);
  checkDates(input.startDate, input.endDate, input.closingDate);
  const scope = scopeOf(actor);
  const row = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    return withConflict("A funding round with this name exists", () =>
      tx.equityFundingRound.create({
        data: {
          ...scope,
          ...roundData(input),
          name: input.name,
          startDate: toDate(input.startDate),
          overrides: input.overrides ?? {},
        },
      }),
    );
  });
  return EquityFundingRoundSchema.parse(toRound(row, EMPTY));
}

export async function updateEquityFundingRound(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityFundingRoundUpdateInputSchema>,
): Promise<EquityFundingRound> {
  const { id, ...input } = EquityFundingRoundUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const row = await inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityFundingRounds(tx, scope, [id]);
    const existing = await tx.equityFundingRound.findFirst({ where: { id, ...scope } });
    if (!existing) throw notFound("Funding round");
    checkDates(
      input.startDate ?? fromDate(existing.startDate),
      input.endDate === undefined ? fromDateOrNull(existing.endDate) : input.endDate,
      input.closingDate === undefined ? fromDateOrNull(existing.closingDate) : input.closingDate,
    );
    if (existing.pricingSnapshot !== null) {
      const startChanged =
        input.startDate !== undefined &&
        toDate(input.startDate).getTime() !== existing.startDate.getTime();
      const endChanged =
        input.endDate !== undefined &&
        (input.endDate === null
          ? existing.endDate !== null
          : existing.endDate?.getTime() !== toDate(input.endDate).getTime());
      const closingChanged =
        input.closingDate !== undefined &&
        (input.closingDate === null
          ? existing.closingDate !== null
          : existing.closingDate?.getTime() !== toDate(input.closingDate).getTime());
      const price =
        input.originalIssuePrice === undefined
          ? undefined
          : toDecimalOrNull(input.originalIssuePrice);
      const priceChanged =
        price !== undefined && price?.toString() !== existing.originalIssuePrice?.toString();
      const valuation =
        input.preMoneyValuationCents === undefined
          ? undefined
          : input.preMoneyValuationCents === null
            ? null
            : toBig(input.preMoneyValuationCents);
      const valuationChanged =
        valuation !== undefined && valuation !== existing.preMoneyValuationCents;
      if (startChanged || endChanged || closingChanged || priceChanged || valuationChanged)
        throw new EquityInputError(
          "Funding-round pricing terms are immutable after conversion pricing",
        );
    }
    return withConflict("A funding round with this name exists", () =>
      tx.equityFundingRound.update({ where: { id }, data: roundData(input) }),
    );
  });
  const derived = await derivedFor(prisma, scope, [id]);
  return EquityFundingRoundSchema.parse(toRound(row, derived.get(id) ?? EMPTY));
}

// ---- draft sets ----

const ITEM_SCHEMAS = {
  certificate: EquityCertificateCreateInputSchema,
  option_grant: EquityOptionGrantCreateInputSchema,
  convertible: EquityConvertibleCreateInputSchema,
} as const;

/** Each item must be the create input of the set's kind; the index is named in the refusal. */
function checkItems(
  kind: keyof typeof ITEM_SCHEMAS,
  items: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const schema = ITEM_SCHEMAS[kind];
  return items.map((item, index) => {
    const parsed = schema.safeParse(item);
    if (!parsed.success)
      throw new EquityInputError(`Item ${index} is not a valid ${kind.replace("_", " ")}`);
    return item;
  });
}

function toDraftSet(row: DraftSetRow): EquityDraftSet {
  return EquityDraftSetSchema.parse({
    id: row.id,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    name: row.name,
    securityKind: row.securityKind as EquityDraftSet["securityKind"],
    status: row.status as EquityDraftSet["status"],
    revision: row.revision,
    issuedIds: row.issuedIds,
    items: Array.isArray(row.items) ? (row.items as Array<Record<string, unknown>>) : [],
    issuedAt: row.issuedAt === null ? null : iso(row.issuedAt),
  });
}

export async function listEquityDraftSets(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityDraftSetListInputSchema>,
): Promise<EquityDraftSetPage> {
  const input = EquityDraftSetListInputSchema.parse(raw);
  const where: Prisma.EquityDraftSetWhereInput = {
    ...scopeOf(actor),
    ...(input.securityKind ? { securityKind: input.securityKind } : {}),
    ...(input.status?.length ? { status: { in: input.status } } : {}),
    ...(input.search ? { name: contains(input.search) } : {}),
  };
  const sort = input.sort ?? { field: "updatedAt", dir: "desc" as const };
  const orderBy: Prisma.EquityDraftSetOrderByWithRelationInput[] = [
    { [sort.field]: sort.dir },
    { id: "asc" },
  ];
  const [rows, total] = await Promise.all([
    prisma.equityDraftSet.findMany({ where, orderBy, ...pageArgs(input) }),
    prisma.equityDraftSet.count({ where }),
  ]);
  return pageOf(rows.map(toDraftSet), total, input);
}

export async function getEquityDraftSet(
  prisma: EquityDb,
  actor: EquityScope,
  id: string,
): Promise<EquityDraftSet> {
  const row = await prisma.equityDraftSet.findFirst({ where: { id, ...scopeOf(actor) } });
  if (!row) throw notFound("Draft set");
  return toDraftSet(row);
}

export async function createEquityDraftSet(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityDraftSetCreateInputSchema>,
): Promise<EquityDraftSet> {
  const input = EquityDraftSetCreateInputSchema.parse(raw);
  const items = checkItems(input.securityKind, input.items ?? []);
  const scope = scopeOf(actor);
  const row = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    return tx.equityDraftSet.create({
      data: {
        ...scope,
        name: input.name,
        securityKind: input.securityKind,
        status: "draft",
        items: items as Prisma.InputJsonValue,
      },
    });
  });
  return toDraftSet(row);
}

export async function updateEquityDraftSet(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityDraftSetUpdateInputSchema>,
): Promise<EquityDraftSet> {
  const { id, expectedRevision, ...input } = EquityDraftSetUpdateInputSchema.parse(raw);
  const scope = scopeOf(actor);
  return inTransaction(prisma, async (tx) => {
    await lockEquityLedger(tx, scope);
    await lockEquityDraftSets(tx, scope, [id]);
    const existing = await tx.equityDraftSet.findFirst({ where: { id, ...scope } });
    if (!existing) throw notFound("Draft set");
    if (existing.status !== "draft") throw new EquityConflictError("Only a draft set can change");
    if (existing.revision !== expectedRevision)
      throw new EquityConflictError("Draft set revision is stale");
    const items =
      input.items === undefined
        ? undefined
        : checkItems(existing.securityKind as keyof typeof ITEM_SCHEMAS, input.items);
    const updated = await tx.equityDraftSet.updateMany({
      where: { id, ...scope, status: "draft", revision: expectedRevision },
      data: defined({
        name: input.name,
        items: items === undefined ? undefined : (items as Prisma.InputJsonValue),
        status: input.status,
        revision: { increment: 1 },
      }),
    });
    if (updated.count !== 1) throw new EquityConflictError("Draft set revision is stale");
    const row = await tx.equityDraftSet.findFirst({ where: { id, ...scope } });
    if (!row) throw notFound("Draft set");
    return toDraftSet(row);
  });
}
