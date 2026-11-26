import type { CapTableSnapshot, EquityOverview } from "@rakazo/contracts";
import type { CapTableInput } from "@rakazo/core/equity";
import {
  accruedInterestCents,
  asConverted,
  computeCapTable,
  isOutstandingCertificate,
  outstandingOptionQuantity,
  parseFixed,
  percentOf,
} from "@rakazo/core/equity";
import { getCapTableSnapshot } from "../cap-table.js";
import type { PrismaClient } from "../client.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import { findLedger, fromBig, fromDate, fromDateOrNull, scopeOf, today } from "./ledger.js";
import { reservedIn } from "./options-plans.js";
import { loadCertificateHistory, loadEquityRaised, withHistory } from "./views-raised.js";

/**
 * The ledger read as the cap table: the overview tab, and the snapshot `investors.capTable`
 * returns once the ledger has data (same shape as the Carta or sheet snapshot, so the Investors
 * page, the Carta agent and the iOS app keep working unchanged).
 */

type DayCount = "actual_365" | "actual_360" | "30_360";

/** Every row the cap table math needs, scoped to the caller's ledger. */
export async function loadLedger(prisma: EquityDb, actor: EquityScope, asOf: string) {
  const scope = scopeOf(actor);
  const [
    classes,
    certificates,
    plans,
    grants,
    convertibles,
    stakeholders,
    history,
    exercises,
    cancellations,
    poolChanges,
  ] = await Promise.all([
    prisma.equityShareClass.findMany({
      where: scope,
      include: { versions: { orderBy: { documentDate: "desc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.equityCertificate.findMany({ where: scope }),
    prisma.equityPlan.findMany({ where: scope, orderBy: { createdAt: "asc" } }),
    prisma.equityOptionGrant.findMany({ where: scope }),
    prisma.equityConvertible.findMany({ where: scope, include: { block: true } }),
    prisma.equityStakeholder.findMany({
      where: scope,
      select: { id: true, name: true, type: true, contactEmail: true, portfolioEmail: true },
    }),
    loadCertificateHistory(prisma, scope),
    prisma.equityExercise.findMany({
      where: { ...scope, status: "completed" },
      select: { optionGrantId: true, quantity: true, exerciseDate: true },
    }),
    prisma.equityTransaction.findMany({
      where: {
        ...scope,
        kind: { in: ["cancel", "reverse_cancellation"] },
        optionGrantId: { not: null },
      },
      select: { optionGrantId: true, kind: true, quantity: true, effectiveDate: true },
    }),
    prisma.equityTransaction.findMany({
      where: { ...scope, kind: "pool_change", planId: { not: null } },
      select: { planId: true, effectiveDate: true, before: true, after: true },
    }),
  ]);
  // Dated pool changes by plan (a decrease is negative), so the table can undo the later ones.
  const poolChangesByPlan = new Map<string, { date: string; shares: bigint }[]>();
  for (const row of poolChanges) {
    const before = reservedIn(row.before);
    const after = reservedIn(row.after);
    if (!row.planId || before === null || after === null) continue;
    poolChangesByPlan.set(row.planId, [
      ...(poolChangesByPlan.get(row.planId) ?? []),
      { date: fromDate(row.effectiveDate), shares: after - before },
    ]);
  }
  // Dated option events by grant, so the table can undo the ones after the as-of date.
  const eventsByGrant = <T extends { optionGrantId: string | null }>(
    rows: readonly T[],
    event: (row: T) => { date: string; quantity: bigint },
  ) => {
    const byGrant = new Map<string, { date: string; quantity: bigint }[]>();
    for (const row of rows) {
      if (!row.optionGrantId) continue;
      byGrant.set(row.optionGrantId, [...(byGrant.get(row.optionGrantId) ?? []), event(row)]);
    }
    return byGrant;
  };
  const exercisesByGrant = eventsByGrant(exercises, (row) => ({
    date: fromDate(row.exerciseDate),
    quantity: row.quantity,
  }));
  const cancellationsByGrant = eventsByGrant(cancellations, (row) => ({
    date: fromDate(row.effectiveDate),
    quantity: row.kind === "cancel" ? (row.quantity ?? 0n) : -(row.quantity ?? 0n),
  }));
  const ordered = classes
    .map((shareClass) => {
      const current =
        shareClass.versions.find((version) => fromDate(version.documentDate) <= asOf) ??
        shareClass.versions.at(-1);
      return { shareClass, current };
    })
    // Most senior first, so the table reads like a liquidation stack; common last.
    .sort(
      (a, b) =>
        (a.shareClass.classType === "common" ? 1 : 0) -
          (b.shareClass.classType === "common" ? 1 : 0) ||
        (a.current?.seniority ?? 1) - (b.current?.seniority ?? 1),
    );
  const input: CapTableInput = {
    asOf,
    classes: ordered.map(({ shareClass, current }) => ({
      id: shareClass.id,
      name: shareClass.name,
      classType: shareClass.classType as "common" | "preferred",
      authorizedShares: current?.authorizedShares ?? 0n,
      conversionRatio: current ? parseFixed(current.conversionRatio.toFixed(10)) : undefined,
      seniority: current?.seniority,
      pariPassu: current?.pariPassu,
    })),
    certificates: certificates.map((row) => ({
      id: row.id,
      stakeholderId: row.stakeholderId,
      shareClassId: row.shareClassId,
      quantity: row.quantity,
      status: row.status,
      ...withHistory(row, history),
      cashPaidCents: row.cashPaidCents,
      debtCanceledCents: row.debtCanceledCents,
      ipTransferredCents: row.ipTransferredCents,
      otherConsiderationCents: row.otherConsiderationCents,
    })),
    plans: plans.map((row) => ({
      id: row.id,
      name: row.name,
      shareClassId: row.shareClassId,
      reservedShares: row.reservedShares,
      reservedChanges: poolChangesByPlan.get(row.id),
    })),
    optionGrants: grants.map((row) => ({
      id: row.id,
      stakeholderId: row.stakeholderId,
      planId: row.planId,
      quantity: row.quantity,
      exercisedQuantity: row.exercisedQuantity,
      canceledQuantity: row.canceledQuantity,
      status: row.status,
      grantDate: fromDate(row.grantDate),
      exercises: exercisesByGrant.get(row.id),
      cancellations: cancellationsByGrant.get(row.id),
    })),
    convertibles: convertibles
      .filter((row) => fromDate(row.issueDate) <= asOf)
      .map((row) => ({
        id: row.id,
        stakeholderId: row.stakeholderId,
        blockId: row.blockId,
        blockName: row.block?.name ?? null,
        principalCents: row.principalCents,
        status: row.status,
        issueDate: fromDate(row.issueDate),
        closedOn: fromDateOrNull(row.closedOn),
        interestCents:
          row.interestRate && row.interestStartDate
            ? accruedInterestCents({
                principalCents: row.principalCents,
                ratePercent: parseFixed(row.interestRate.toFixed(10)),
                startDate: fromDate(row.interestStartDate),
                asOf,
                interestType: row.interestType === "compound" ? "compound" : "simple",
                dayCount: (row.dayCountConvention ?? "actual_365") as DayCount,
              })
            : 0n,
      })),
  };
  return { input, stakeholders, convertibles, counts: { grants: grants.length } };
}

export async function equityOverview(
  prisma: EquityDb,
  actor: EquityScope,
  options: { asOf?: string } = {},
): Promise<EquityOverview> {
  const scope = scopeOf(actor);
  const asOf = options.asOf ?? today();
  const [ledger, loaded, fundingRounds] = await Promise.all([
    findLedger(prisma, scope),
    loadLedger(prisma, scope, asOf),
    prisma.equityFundingRound.count({ where: scope }),
  ]);
  const { input, stakeholders } = loaded;
  const hasLedger = stakeholders.length > 0 || input.classes.length > 0;
  const canImport =
    !hasLedger && !ledger?.importedAt && (await getCapTableSnapshot(prisma, scope)) !== null;
  const table = computeCapTable(input);
  return {
    hasLedger,
    canImport,
    importedAt: ledger?.importedAt?.toISOString() ?? null,
    asOf,
    totals: {
      outstandingShares: fromBig(table.totals.outstandingShares),
      fullyDilutedShares: fromBig(table.totals.fullyDilutedShares),
      commonShares: fromBig(table.totals.commonShares),
      preferredShares: fromBig(table.totals.preferredShares),
      availablePlanShares: fromBig(table.totals.availablePlanShares),
      amountRaisedCents: fromBig(table.totals.amountRaisedCents),
    },
    classes: table.classes.map((row) => ({
      ...row,
      authorizedShares: fromBig(row.authorizedShares),
      outstandingShares: fromBig(row.outstandingShares),
      fullyDilutedShares: fromBig(row.fullyDilutedShares),
      amountRaisedCents: fromBig(row.amountRaisedCents),
    })),
    plans: table.plans.map((row) => ({
      ...row,
      outstandingShares: fromBig(row.outstandingShares),
      availableShares: fromBig(row.availableShares),
    })),
    convertibles: table.convertibles.map((row) => ({
      blockId: row.blockId,
      name: row.name,
      principalCents: fromBig(row.principalCents),
      interestCents: fromBig(row.interestCents),
      outstandingDebtCents: fromBig(row.outstandingDebtCents),
      amountRaisedCents: fromBig(row.amountRaisedCents),
    })),
    counts: {
      stakeholders: stakeholders.length,
      shareClasses: input.classes.length,
      plans: input.plans.length,
      certificates: input.certificates.length,
      convertibles: loaded.convertibles.length,
      optionGrants: loaded.counts.grants,
      fundingRounds,
    },
  };
}

const MAX_CLASSES = 50;
const usd = (cents: bigint) => Number(cents) / 100;
const percentNumber = (part: bigint, whole: bigint) => Number(percentOf(part, whole, 4));

/** Whether the ledger is the record: the same rule as the overview's `hasLedger`. */
export async function equityLedgerHasData(
  prisma: Pick<PrismaClient, "equityStakeholder" | "equityShareClass">,
  actor: EquityScope,
): Promise<boolean> {
  const scope = scopeOf(actor);
  const [stakeholder, shareClass] = await Promise.all([
    prisma.equityStakeholder.findFirst({ where: scope, select: { id: true } }),
    prisma.equityShareClass.findFirst({ where: scope, select: { id: true } }),
  ]);
  return Boolean(stakeholder || shareClass);
}

/**
 * The snapshot derived from the ledger, or null while the ledger is empty (the stored Carta,
 * sheet or typed-in snapshot is then still the cap table). Holders are one row per stakeholder and
 * class held, one per stakeholder's outstanding options, and one per outstanding convertible;
 * percents are of fully diluted shares.
 */
export async function equityLedgerSnapshot(
  prisma: EquityDb,
  actor: EquityScope,
): Promise<CapTableSnapshot | null> {
  const scope = scopeOf(actor);
  const asOf = today();
  const { input, stakeholders, convertibles } = await loadLedger(prisma, scope, asOf);
  if (stakeholders.length === 0 && input.classes.length === 0) return null;
  const [stored, space, latest, ledger, warrants] = await Promise.all([
    getCapTableSnapshot(prisma, scope),
    prisma.space.findFirst({ where: { id: scope.spaceId }, select: { name: true } }),
    prisma.equityTransaction.findFirst({
      where: scope,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    findLedger(prisma, scope),
    prisma.equityWarrant.findMany({
      where: { ...scope, status: "outstanding" },
      select: { stakeholderId: true, quantity: true, issueDate: true },
    }),
  ]);
  const table = computeCapTable(input);
  // The ledger table leaves warrants out of its fully diluted total; the snapshot counts them, so
  // every percent below is measured against a base that includes them and sums to at most 100.
  const warrantTotal = warrants.reduce(
    (sum, warrant) => (fromDate(warrant.issueDate) > asOf ? sum : sum + warrant.quantity),
    0n,
  );
  const fullyDiluted = table.totals.fullyDilutedShares + warrantTotal;
  const people = new Map(stakeholders.map((row) => [row.id, row]));
  const classNames = new Map(input.classes.map((row) => [row.id, row.name]));
  const holderOf = (stakeholderId: string) => {
    const person = people.get(stakeholderId);
    return {
      name: person?.name ?? "Unknown",
      email: person?.contactEmail ?? person?.portfolioEmail ?? null,
      organization: person?.type === "organization" ? person.name : null,
    };
  };

  const holdings = new Map<
    string,
    { stakeholderId: string; classId: string; shares: bigint; cents: bigint }
  >();
  for (const certificate of input.certificates) {
    if (!isOutstandingCertificate(certificate.status) || certificate.issueDate > asOf) continue;
    const key = `${certificate.stakeholderId}|${certificate.shareClassId}`;
    const holding = holdings.get(key) ?? {
      stakeholderId: certificate.stakeholderId,
      classId: certificate.shareClassId,
      shares: 0n,
      cents: 0n,
    };
    holding.shares += certificate.quantity;
    holding.cents += certificate.cashPaidCents;
    holdings.set(key, holding);
  }
  // Percents are of fully diluted shares, which count each class as converted.
  const ratioOfClass = new Map(input.classes.map((row) => [row.id, row.conversionRatio]));
  const classOfPlan = new Map(input.plans.map((row) => [row.id, row.shareClassId]));
  const options = new Map<string, bigint>();
  const optionsConverted = new Map<string, bigint>();
  for (const grant of input.optionGrants) {
    if (grant.status !== "outstanding" || grant.grantDate > asOf) continue;
    const quantity = outstandingOptionQuantity(grant);
    options.set(grant.stakeholderId, (options.get(grant.stakeholderId) ?? 0n) + quantity);
    optionsConverted.set(
      grant.stakeholderId,
      (optionsConverted.get(grant.stakeholderId) ?? 0n) +
        asConverted(quantity, ratioOfClass.get(classOfPlan.get(grant.planId) ?? "")),
    );
  }
  const warrantShares = new Map<string, bigint>();
  for (const warrant of warrants) {
    if (fromDate(warrant.issueDate) > asOf) continue;
    warrantShares.set(
      warrant.stakeholderId,
      (warrantShares.get(warrant.stakeholderId) ?? 0n) + warrant.quantity,
    );
  }
  const holders: CapTableSnapshot["holders"] = [
    ...[...holdings.values()].map((holding) => ({
      ...holderOf(holding.stakeholderId),
      security: classNames.get(holding.classId) ?? "Shares",
      shares: Number(holding.shares),
      amountUsd: holding.cents > 0n ? usd(holding.cents) : null,
      percent: percentNumber(
        asConverted(holding.shares, ratioOfClass.get(holding.classId)),
        fullyDiluted,
      ),
    })),
    ...[...options.entries()]
      .filter(([, shares]) => shares > 0n)
      .map(([stakeholderId, shares]) => ({
        ...holderOf(stakeholderId),
        security: "Option",
        shares: Number(shares),
        amountUsd: null,
        percent: percentNumber(optionsConverted.get(stakeholderId) ?? 0n, fullyDiluted),
      })),
    ...[...warrantShares.entries()]
      .filter(([, shares]) => shares > 0n)
      .map(([stakeholderId, shares]) => ({
        ...holderOf(stakeholderId),
        security: "Warrant",
        shares: Number(shares),
        amountUsd: null,
        percent: percentNumber(shares, fullyDiluted),
      })),
    ...convertibles
      .filter((row) => row.status === "outstanding")
      .map((row) => ({
        ...holderOf(row.stakeholderId),
        security: row.kind === "note" ? "Convertible note" : "SAFE",
        shares: null,
        amountUsd: usd(row.principalCents),
        percent: null,
      })),
  ].sort((a, b) => (b.shares ?? 0) - (a.shares ?? 0) || (b.amountUsd ?? 0) - (a.amountUsd ?? 0));
  const raised = (await loadEquityRaised(prisma, scope, { asOf })).totalCents;
  const updatedAt = [ledger?.updatedAt, latest?.createdAt]
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    companyName: stored?.companyName ?? space?.name ?? "Company",
    asOf,
    fullyDilutedShares: Number(fullyDiluted),
    source: "native",
    sourceRef: null,
    amountRaisedUsd: usd(raised),
    optionPoolAvailable: Number(table.totals.availablePlanShares),
    latest409a: stored?.latest409a ?? null,
    shareClasses: table.classes.slice(0, MAX_CLASSES).map((row) => ({
      name: row.name,
      shares: Number(row.fullyDilutedShares),
      percent: percentNumber(row.fullyDilutedShares, fullyDiluted),
    })),
    holders,
    updatedAt: (updatedAt ?? new Date()).toISOString(),
    canUndo: false,
  };
}
