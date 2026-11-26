import type {
  EquityConvertible,
  EquityConvertibleTotals,
  EquityPricedRoundPreview,
  EquityPricedRoundResult,
  EquitySafeFunding,
} from "@rakazo/contracts";
import {
  EquityConvertibleCancelInputSchema,
  EquityConvertibleListInputSchema,
  EquityPricedRoundInputSchema,
  EquitySafeFundingSetInputSchema,
} from "@rakazo/contracts";
import type { DayCount, PricedRoundConvertible } from "@rakazo/core/equity";
import { parseFixed, pricedRoundConversion } from "@rakazo/core/equity";
import type * as z from "zod";
import type { Prisma } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  assertInLedger,
  EquityInputError,
  ensureLedger,
  findLedger,
  fromBig,
  fromBigOrNull,
  fromDate,
  inTransaction,
  lockEquityConvertibles,
  lockEquityFundingRounds,
  lockEquityLedger,
  nextLabel,
  notFound,
  recordTransaction,
  scopeOf,
  toBig,
  toDate,
  withConflict,
} from "./ledger.js";
import { equityOverview } from "./overview.js";
import {
  assertEquityCertificateCapacity,
  convertibleWhere,
  getEquityCertificate,
  getEquityConvertible,
} from "./securities.js";

/** Cancels an outstanding SAFE or note and records the cancellation. */
export async function cancelEquityConvertible(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityConvertibleCancelInputSchema>,
): Promise<EquityConvertible> {
  const input = EquityConvertibleCancelInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    await lockEquityConvertibles(tx, scope, [input.id]);
    const before = await getEquityConvertible(tx, scope, input.id);
    if (before.status !== "outstanding")
      throw new EquityInputError("Only an outstanding convertible can be canceled");
    if (input.canceledOn < before.issueDate)
      throw new EquityInputError("Cancellation cannot be before the convertible issue date");
    await tx.equityConvertible.update({
      where: { id: input.id },
      data: {
        status: "canceled",
        canceledOn: toDate(input.canceledOn),
        closedOn: toDate(input.canceledOn),
        cancellationReason: input.reason,
      },
    });
    await recordTransaction(tx, scope, {
      kind: "cancel",
      effectiveDate: input.canceledOn,
      reason: input.reason,
      convertibleId: input.id,
      valueCents: toBig(before.principalCents),
      before,
      after: await getEquityConvertible(tx, scope, input.id),
      note: input.note ?? null,
    });
  });
  return getEquityConvertible(prisma, scope, input.id);
}

type FundingRoundPricingSnapshot = {
  version: 1;
  baseFullyDilutedShares: string;
  preMoneyValuationCents: string;
  newMoneyCents: string;
  asOf: string;
  targetShareClassId: string;
  hasPostMoneyCaps: boolean;
  priorConversionShares: string;
  priorConversionCount: number;
};

type PriorConversions = { shares: bigint; count: number };

async function priorConversions(
  prisma: EquityDb,
  actor: EquityScope,
  roundId: string,
): Promise<PriorConversions> {
  const scope = scopeOf(actor);
  const [result] = await prisma.$queryRawUnsafe<Array<{ shares: string; count: number }>>(
    `SELECT COALESCE(SUM(c."quantity"), 0)::text AS "shares", COUNT(*)::integer AS "count"
     FROM "equity_convertibles" cv
     JOIN "equity_certificates" c ON c."id" = cv."convertedToId"
     WHERE cv."spaceId" = $1 AND cv."userId" = $2
       AND cv."status" = 'converted' AND c."roundId" = $3`,
    scope.spaceId,
    scope.userId,
    roundId,
  );
  return { shares: BigInt(result?.shares ?? "0"), count: result?.count ?? 0 };
}

async function plan(
  prisma: EquityDb,
  actor: EquityScope,
  input: z.output<typeof EquityPricedRoundInputSchema>,
) {
  if (new Set(input.convertibleIds).size !== input.convertibleIds.length)
    throw new EquityInputError("Select each convertible only once");
  const preMoneyValuationCents = toBig(input.preMoneyValuationCents);
  const newMoneyCents = toBig(input.newMoneyCents);
  await assertInLedger(prisma, actor, "equityShareClass", input.toShareClassId);
  await assertInLedger(prisma, actor, "equityFundingRound", input.roundId);
  const ids = input.convertibleIds;
  const rows = await prisma.equityConvertible.findMany({
    where: { id: { in: ids }, ...scopeOf(actor) },
    include: { stakeholder: { select: { name: true } } },
  });
  if (rows.length !== ids.length) throw notFound("Convertible");
  if (rows.some((row) => row.status !== "outstanding"))
    throw new EquityInputError("Only outstanding convertibles convert");
  if (rows.some((row) => fromDate(row.issueDate) > input.asOf))
    throw new EquityInputError("A convertible issued after the pricing date cannot convert");
  const overview = await equityOverview(prisma, actor, { asOf: input.asOf });
  const liveBase = toBig(overview.totals.fullyDilutedShares);
  const prior = input.roundId
    ? await priorConversions(prisma, actor, input.roundId)
    : { shares: 0n, count: 0 };
  let pricingSnapshot: FundingRoundPricingSnapshot | null = null;
  const baseFullyDilutedShares = liveBase;
  let agreedDisplayPrice: { equals: (value: string) => boolean } | null = null;
  const hasPostMoneyCaps = rows.some(
    (row) => row.valuationCapType === "post_money" && row.valuationCapCents !== null,
  );
  if (input.roundId) {
    const round = await prisma.equityFundingRound.findFirst({
      where: { id: input.roundId, ...scopeOf(actor) },
      select: { pricingSnapshot: true, preMoneyValuationCents: true, originalIssuePrice: true },
    });
    if (!round) throw notFound("Funding round");
    agreedDisplayPrice = round.originalIssuePrice;
    if (
      round.preMoneyValuationCents !== null &&
      round.preMoneyValuationCents !== preMoneyValuationCents
    )
      throw new EquityInputError("The pre-money valuation does not match the funding round");
    // Conversion shares count in the pre-money share count, so every convertible of a round must
    // convert in one batch to share one price. A snapshot means an earlier batch already did.
    if (round.pricingSnapshot !== null) {
      throw new EquityInputError(
        "This funding round has already converted its convertibles; convert them in one batch",
      );
    }
    if (prior.count !== 0 || prior.shares !== 0n)
      throw new EquityInputError(
        "This funding round already has conversions but no pricing snapshot",
      );
    pricingSnapshot = {
      version: 1,
      baseFullyDilutedShares: liveBase.toString(),
      preMoneyValuationCents: preMoneyValuationCents.toString(),
      newMoneyCents: newMoneyCents.toString(),
      asOf: input.asOf,
      targetShareClassId: input.toShareClassId,
      hasPostMoneyCaps,
      priorConversionShares: prior.shares.toString(),
      priorConversionCount: prior.count,
    };
  } else if (input.newRoundName) {
    pricingSnapshot = {
      version: 1,
      baseFullyDilutedShares: liveBase.toString(),
      preMoneyValuationCents: preMoneyValuationCents.toString(),
      newMoneyCents: newMoneyCents.toString(),
      asOf: input.asOf,
      targetShareClassId: input.toShareClassId,
      hasPostMoneyCaps,
      priorConversionShares: "0",
      priorConversionCount: 0,
    };
  }
  if (baseFullyDilutedShares <= 0n)
    throw new EquityInputError("The cap table has no shares to price the round");
  const fixed = (value: { toFixed: (places: number) => string } | null) =>
    value == null ? null : parseFixed(value.toFixed(10));
  const convertibles: PricedRoundConvertible[] = rows.map((row) => {
    if (
      row.valuationCapType !== null &&
      !["pre_money", "post_money"].includes(row.valuationCapType)
    )
      throw new EquityInputError(`${row.label} has an invalid valuation cap type`);
    if (row.principalCents <= 0n)
      throw new EquityInputError(`${row.label} must have a positive principal amount`);
    if (row.valuationCapCents !== null && row.valuationCapCents <= 0n)
      throw new EquityInputError(`${row.label} has an invalid valuation cap`);
    const discountPercent = fixed(row.discountPercent);
    if (discountPercent !== null && (discountPercent < 0n || discountPercent >= 100n * 10n ** 10n))
      throw new EquityInputError(`${row.label} has an invalid discount`);
    if (row.maturityDate && row.maturityDate < row.issueDate)
      throw new EquityInputError(`${row.label} has a maturity date before its issue date`);
    if (row.kind === "note" && Boolean(row.interestRate) !== Boolean(row.interestStartDate))
      throw new EquityInputError(`${row.label} has incomplete interest terms`);
    if (row.kind === "note" && row.interestRate && fixed(row.interestRate)! < 0n)
      throw new EquityInputError(`${row.label} has a negative interest rate`);
    if (row.interestType !== null && !["simple", "compound"].includes(row.interestType))
      throw new EquityInputError(`${row.label} has an invalid interest type`);
    if (
      row.dayCountConvention !== null &&
      !["actual_365", "actual_360", "30_360"].includes(row.dayCountConvention)
    )
      throw new EquityInputError(`${row.label} has an invalid day-count convention`);
    // A legacy capped row with no cap type is not guessed; the round waits until someone sets it.
    if (row.valuationCapCents !== null && row.valuationCapType === null)
      throw new EquityInputError(`${row.label} has a valuation cap but no cap type; set it first`);
    const shared = {
      id: row.id,
      principalCents: row.principalCents,
      valuationCapCents: row.valuationCapCents,
      capType: row.valuationCapType as "pre_money" | "post_money" | null,
      discountPercent,
    };
    return row.kind === "note" && row.interestRate && row.interestStartDate
      ? {
          ...shared,
          kind: "note" as const,
          ratePercent: fixed(row.interestRate)!,
          startDate: fromDate(row.interestStartDate),
          interestType:
            row.interestType === "compound" ? ("compound" as const) : ("simple" as const),
          dayCount: (row.dayCountConvention ?? "actual_365") as DayCount,
        }
      : { ...shared, kind: "safe" as const };
  });
  if (preMoneyValuationCents <= 0n) throw new EquityInputError("Enter a pre-money valuation");
  let result: ReturnType<typeof pricedRoundConversion>;
  try {
    result = pricedRoundConversion({
      preMoneyValuationCents,
      newMoneyCents,
      preRoundFullyDilutedShares: baseFullyDilutedShares,
      asOf: input.asOf,
      convertibles,
    });
  } catch (error) {
    if (error instanceof RangeError) throw new EquityInputError(error.message);
    throw error;
  }
  if (agreedDisplayPrice && !agreedDisplayPrice.equals(result.pricePerShare))
    throw new EquityInputError(
      "The inferred share price does not match the funding round's declared issue price",
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const preview: EquityPricedRoundPreview = {
    preRoundFullyDilutedShares: fromBig(baseFullyDilutedShares),
    pricePerShare: result.pricePerShare,
    newMoneyShares: fromBig(result.newMoneyShares),
    postRoundFullyDilutedShares: fromBig(result.postRoundFullyDilutedShares),
    totalConvertedShares: fromBig(result.totalConvertedShares),
    convertibles: result.convertibles.map((item) => ({
      id: item.id,
      label: byId.get(item.id)!.label,
      stakeholderName: byId.get(item.id)!.stakeholder.name,
      method: item.method,
      conversionPrice: item.conversionPrice,
      amountConvertedCents: fromBig(item.amountConvertedCents),
      shares: fromBig(item.shares),
    })),
  };
  return { preview, rows: byId, pricingSnapshot };
}

/** What converting these SAFEs and notes in a priced round would issue. Writes nothing. */
export async function previewEquityPricedRound(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPricedRoundInputSchema>,
): Promise<EquityPricedRoundPreview> {
  const input = EquityPricedRoundInputSchema.parse(raw);
  return (await plan(prisma, scopeOf(actor), input)).preview;
}

/**
 * Converts SAFEs and notes in a priced round: one certificate per convertible in the target class
 * at its conversion price, the convertible marked converted and linked to it, one convert
 * transaction each.
 */
export async function convertEquityPricedRound(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityPricedRoundInputSchema>,
): Promise<EquityPricedRoundResult> {
  const input = EquityPricedRoundInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const { preview, ids } = await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    await lockEquityLedger(tx, scope);
    await lockEquityConvertibles(tx, scope, input.convertibleIds);
    if (input.roundId) await lockEquityFundingRounds(tx, scope, [input.roundId]);
    const { preview, rows, pricingSnapshot } = await plan(tx, scope, input);
    const quantities = preview.convertibles.map((item) => toBig(item.shares));
    const noSharesIndex = quantities.findIndex((quantity) => quantity <= 0n);
    if (noSharesIndex >= 0)
      throw new EquityInputError(
        `${preview.convertibles[noSharesIndex]?.label ?? "Convertible"} converts to no shares`,
      );
    const totalQuantity = quantities.reduce((total, quantity) => total + quantity, 0n);
    const prefix = await assertEquityCertificateCapacity(
      tx,
      scope,
      input.toShareClassId,
      totalQuantity,
      undefined,
      input.asOf,
    );
    if (input.roundId && pricingSnapshot) {
      await tx.equityFundingRound.update({
        where: { id: input.roundId },
        data: {
          pricingSnapshot: pricingSnapshot as Prisma.InputJsonValue,
          originalIssuePrice: preview.pricePerShare,
          preMoneyValuationCents: toBig(input.preMoneyValuationCents),
        },
      });
    }
    const roundId = input.newRoundName
      ? (
          await withConflict("A funding round with this name exists", () =>
            tx.equityFundingRound.create({
              data: {
                ...scope,
                name: input.newRoundName!,
                startDate: toDate(input.asOf),
                closingDate: toDate(input.asOf),
                originalIssuePrice: preview.pricePerShare,
                preMoneyValuationCents: toBig(input.preMoneyValuationCents),
                pricingSnapshot: pricingSnapshot as Prisma.InputJsonValue,
              },
              select: { id: true },
            }),
          )
        ).id
      : (input.roundId ?? null);
    const ids: string[] = [];
    for (const item of preview.convertibles) {
      const row = rows.get(item.id)!;
      const certificate = await tx.equityCertificate.create({
        data: {
          ...scope,
          label: await nextLabel(tx, scope, "equityCertificate", prefix),
          stakeholderId: row.stakeholderId,
          shareClassId: input.toShareClassId,
          status: "outstanding",
          acceptanceStatus: "accepted",
          paperStatus: "electronic",
          quantity: toBig(item.shares),
          pricePerShare: item.conversionPrice,
          pricePaidPerShare: item.conversionPrice,
          debtCanceledCents: toBig(item.amountConvertedCents),
          issueDate: toDate(input.asOf),
          roundId,
        },
        select: { id: true },
      });
      const before = await getEquityConvertible(tx, scope, row.id);
      await tx.equityConvertible.update({
        where: { id: row.id },
        data: {
          status: "converted",
          closedOn: toDate(input.asOf),
          convertedToId: certificate.id,
        },
      });
      const after = await getEquityConvertible(tx, scope, row.id);
      const resultingCertificate = await getEquityCertificate(tx, scope, certificate.id);
      await recordTransaction(tx, scope, {
        kind: "convert",
        effectiveDate: input.asOf,
        reason: item.method,
        convertibleId: row.id,
        quantity: toBig(item.shares),
        valueCents: toBig(item.amountConvertedCents),
        before,
        after: { ...after, resultingCertificates: [resultingCertificate] },
        resulting: [certificate.id],
      });
      ids.push(certificate.id);
    }
    return { preview, ids };
  });
  const certificates = await Promise.all(ids.map((id) => getEquityCertificate(prisma, scope, id)));
  return { preview, certificates };
}

/** The count and principal of every SAFE and note a ledger filter matches (not just one page). */
export async function equityConvertibleTotals(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityConvertibleListInputSchema>,
): Promise<EquityConvertibleTotals> {
  const where = convertibleWhere(scopeOf(actor), EquityConvertibleListInputSchema.parse(raw));
  const totals = await prisma.equityConvertible.aggregate({
    where,
    _count: { _all: true },
    _sum: { principalCents: true },
  });
  return {
    count: totals._count._all,
    principalCents: fromBig(totals._sum.principalCents ?? 0n),
  };
}

/** The board-approved SAFE amount against the principal of SAFEs that are not canceled. */
export async function getEquitySafeFunding(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<EquitySafeFunding> {
  const scope = scopeOf(actor);
  const [ledger, raised] = await Promise.all([
    findLedger(prisma, scope),
    prisma.equityConvertible.aggregate({
      where: { ...scope, kind: "safe", status: { not: "canceled" } },
      _sum: { principalCents: true },
    }),
  ]);
  const approved = ledger?.safeBoardApprovedCents ?? null;
  const raisedCents = raised._sum.principalCents ?? 0n;
  return {
    approvedCents: fromBigOrNull(approved),
    raisedCents: fromBig(raisedCents),
    remainingCents:
      approved == null ? null : fromBig(approved > raisedCents ? approved - raisedCents : 0n),
  };
}

/** Records a new board-approved SAFE amount; it may not drop below what SAFEs already raised. */
export async function setEquitySafeFunding(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquitySafeFundingSetInputSchema>,
): Promise<EquitySafeFunding> {
  const input = EquitySafeFundingSetInputSchema.parse(raw);
  const scope = scopeOf(actor);
  await inTransaction(prisma, async (tx) => {
    await ensureLedger(tx, scope);
    const current = await getEquitySafeFunding(tx, scope);
    if (toBig(input.approvedCents) < toBig(current.raisedCents))
      throw new EquityInputError("The approved amount is less than SAFEs already raised");
    await tx.equityLedger.update({
      where: { spaceId_userId: scope },
      data: { safeBoardApprovedCents: toBig(input.approvedCents) },
    });
  });
  return getEquitySafeFunding(prisma, scope);
}
