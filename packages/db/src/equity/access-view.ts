import type { EquityAccessHolding, EquityAccessLevel, EquityAccessView } from "@rakazo/contracts";
import { EQUITY_ACCESS_VIEW_KEYS, EquityAccessViewInputSchema } from "@rakazo/contracts";
import { isOutstandingCertificate } from "@rakazo/core/equity";
import type * as z from "zod";
import { effectiveEquityAccessLevel } from "./access.js";
import type { EquityDb, EquityScope } from "./ledger.js";
import {
  fromBig,
  fromBigOrNull,
  fromDate,
  fromDecimal,
  notFound,
  scopeOf,
  toBig,
} from "./ledger.js";
import { equityOverview } from "./overview.js";
import { getEquityEstimatedValue } from "./views-value.js";

/** Shares times a decimal price, in whole cents (half up), without floats. */
function centsOf(shares: bigint, price: string): string {
  const [whole, fraction = ""] = price.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const priceScaled = BigInt(whole + fraction);
  const cents = (shares * priceScaled * 100n * 2n + scale) / (2n * scale);
  return fromBig(cents);
}

/**
 * The cap table as one holder may see it. The server builds only what the level allows, so a
 * caller can never widen it by asking: every section above the level is left out, not blanked.
 */

const includes = (level: EquityAccessLevel, key: string) =>
  (EQUITY_ACCESS_VIEW_KEYS[level] as readonly string[]).includes(key);

type Holdings = Map<string, { preferred: boolean; rows: EquityAccessHolding[] }>;

/** Every outstanding holding in the caller's ledger, by stakeholder. */
async function outstandingHoldings(prisma: EquityDb, scope: EquityScope): Promise<Holdings> {
  const [certificates, grants, warrants, convertibles] = await Promise.all([
    prisma.equityCertificate.findMany({
      where: scope,
      include: { shareClass: { select: { name: true, classType: true } } },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    }),
    prisma.equityOptionGrant.findMany({
      where: scope,
      include: { shareClass: { select: { name: true } } },
      orderBy: [{ grantDate: "asc" }, { id: "asc" }],
    }),
    prisma.equityWarrant.findMany({
      where: { ...scope, status: "outstanding" },
      include: { shareClass: { select: { name: true } } },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    }),
    prisma.equityConvertible.findMany({
      where: { ...scope, status: "outstanding" },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    }),
  ]);
  const byHolder: Holdings = new Map();
  const add = (stakeholderId: string, row: EquityAccessHolding, preferred = false) => {
    const entry = byHolder.get(stakeholderId) ?? { preferred: false, rows: [] };
    entry.rows.push(row);
    entry.preferred ||= preferred;
    byHolder.set(stakeholderId, entry);
  };
  for (const row of certificates)
    if (isOutstandingCertificate(row.status) && row.quantity > 0n)
      add(
        row.stakeholderId,
        {
          kind: "certificate",
          label: row.label,
          shareClassName: row.shareClass.name,
          quantity: fromBig(row.quantity),
          principalCents: null,
          issueDate: fromDate(row.issueDate),
        },
        row.shareClass.classType === "preferred",
      );
  for (const row of grants) {
    const remaining = row.quantity - row.exercisedQuantity - row.canceledQuantity;
    if (row.status !== "outstanding" || remaining <= 0n) continue;
    add(row.stakeholderId, {
      kind: "option",
      label: row.label,
      shareClassName: row.shareClass.name,
      quantity: fromBig(remaining),
      principalCents: null,
      issueDate: fromDate(row.grantDate),
    });
  }
  for (const row of warrants)
    if (row.quantity > 0n)
      add(row.stakeholderId, {
        kind: "warrant",
        label: row.label,
        shareClassName: row.shareClass.name,
        quantity: fromBig(row.quantity),
        principalCents: null,
        issueDate: fromDate(row.issueDate),
      });
  for (const row of convertibles)
    add(row.stakeholderId, {
      kind: "convertible",
      label: row.label,
      shareClassName: null,
      quantity: null,
      principalCents: fromBigOrNull(row.principalCents),
      issueDate: fromDate(row.issueDate),
    });
  return byHolder;
}

async function buildView(
  prisma: EquityDb,
  scope: EquityScope,
  stakeholder: { id: string; name: string },
  level: EquityAccessLevel,
): Promise<EquityAccessView> {
  const view: EquityAccessView = { level };
  if (level === "none") return view;
  const holdings = await outstandingHoldings(prisma, scope);
  view.personal = {
    stakeholderId: stakeholder.id,
    name: stakeholder.name,
    holdings: holdings.get(stakeholder.id)?.rows ?? [],
  };
  // The company's estimated price per share, when it shows holders one (views area setting).
  const estimate = await getEquityEstimatedValue(prisma, scope);
  if (estimate.visibility === "holders" && estimate.pricePerShare && estimate.effectiveDate) {
    view.fairMarketValue = {
      pricePerShare: estimate.pricePerShare,
      effectiveDate: estimate.effectiveDate,
    };
    const shares = (view.personal.holdings ?? []).reduce(
      (sum, row) => (row.kind === "certificate" && row.quantity ? sum + toBig(row.quantity) : sum),
      0n,
    );
    view.estimatedValue = {
      pricePerShare: estimate.pricePerShare,
      effectiveDate: estimate.effectiveDate,
      valueCents: centsOf(shares, estimate.pricePerShare),
    };
  } else view.fairMarketValue = null;
  if (!includes(level, "summary")) return view;

  const [classes, overview, rounds] = await Promise.all([
    prisma.equityShareClass.findMany({
      where: scope,
      include: { versions: { orderBy: { documentDate: "desc" }, take: 1 } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    equityOverview(prisma, scope),
    prisma.equityFundingRound.findMany({
      where: scope,
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
    }),
  ]);
  view.shareClasses = classes.map((row) => {
    const current = row.versions[0];
    return {
      name: row.name,
      prefix: row.prefix,
      classType: row.classType === "preferred" ? "preferred" : "common",
      originalIssuePrice: current?.originalIssuePrice
        ? fromDecimal(current.originalIssuePrice)
        : null,
      conversionRatio: current ? fromDecimal(current.conversionRatio) : "1",
      liquidationMultiple: current ? fromDecimal(current.multiplier) : "1",
      participating: current?.participating ?? false,
      seniority: current?.seniority ?? 1,
    };
  });
  view.summary = {
    outstandingShares: overview.totals.outstandingShares,
    fullyDilutedShares: overview.totals.fullyDilutedShares,
    classes: overview.classes.map((row) => ({
      name: row.name,
      outstandingShares: row.outstandingShares,
      fullyDilutedShares: row.fullyDilutedShares,
      fullyDilutedPercent: row.fullyDilutedPercent,
    })),
  };
  view.fundraising = rounds.map((row) => ({
    name: row.name,
    closingDate: row.closingDate ? fromDate(row.closingDate) : null,
    originalIssuePrice: row.originalIssuePrice ? fromDecimal(row.originalIssuePrice) : null,
    preMoneyValuationCents: fromBigOrNull(row.preMoneyValuationCents),
  }));
  if (!includes(level, "holders")) return view;

  const ids = [...holdings.keys()].filter(
    (id) => level === "full_detail" || holdings.get(id)?.preferred,
  );
  const names = await prisma.equityStakeholder.findMany({
    where: { ...scope, id: { in: ids } },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  view.holders = names.map((row) => ({
    stakeholderId: row.id,
    name: row.name,
    holdings: holdings.get(row.id)?.rows ?? [],
  }));
  return view;
}

async function findStakeholder(prisma: EquityDb, scope: EquityScope, id: string) {
  const row = await prisma.equityStakeholder.findFirst({
    where: { id, ...scope, mergedIntoId: null },
    select: { id: true, name: true },
  });
  if (!row) throw notFound("Stakeholder");
  return row;
}

/** The holder's group or individual level, or none once they hold nothing outstanding. */
export async function equityHolderAccessLevel(
  prisma: EquityDb,
  actor: EquityScope,
  stakeholderId: string,
): Promise<EquityAccessLevel> {
  const scope = scopeOf(actor);
  await findStakeholder(prisma, scope, stakeholderId);
  const holdings = await outstandingHoldings(prisma, scope);
  if (!holdings.get(stakeholderId)?.rows.length) return "none";
  return effectiveEquityAccessLevel(prisma, scope, stakeholderId);
}

/** What the holder sees, at the level they have. The portal reads this. */
export async function equityHolderView(
  prisma: EquityDb,
  actor: EquityScope,
  stakeholderId: string,
): Promise<EquityAccessView> {
  const scope = scopeOf(actor);
  const stakeholder = await findStakeholder(prisma, scope, stakeholderId);
  const view = await buildView(
    prisma,
    scope,
    stakeholder,
    await equityHolderAccessLevel(prisma, scope, stakeholderId),
  );
  const grant = await prisma.equityAccessGrant.findFirst({
    where: { ...scope, stakeholderId, requestedLevel: { not: null } },
    select: { requestedLevel: true },
  });
  if (grant?.requestedLevel && view.level !== "none")
    view.requestedLevel = grant.requestedLevel as EquityAccessLevel;
  return view;
}

/** The admin preview of one holder's view, at their level or at one chosen to try. */
export async function equityAccessView(
  prisma: EquityDb,
  actor: EquityScope,
  raw: z.input<typeof EquityAccessViewInputSchema>,
): Promise<EquityAccessView> {
  const input = EquityAccessViewInputSchema.parse(raw);
  const scope = scopeOf(actor);
  const stakeholder = await findStakeholder(prisma, scope, input.stakeholderId);
  const level = input.level ?? (await equityHolderAccessLevel(prisma, scope, stakeholder.id));
  return buildView(prisma, scope, stakeholder, level);
}
