import type { EquityCapTableByStakeholder, EquityStakeholderHolding } from "@rakazo/contracts";
import { EquityCapTableByStakeholderInputSchema } from "@rakazo/contracts";
import {
  computeCapTable,
  isOutstandingCertificate,
  outstandingOptionQuantity,
  percentOf,
} from "@rakazo/core/equity";
import type { EquityDb, EquityScope } from "./ledger.js";
import { fromBig, scopeOf, toBig, today } from "./ledger.js";
import { loadLedger } from "./overview.js";

/**
 * The cap table by stakeholder as of a date: one row per stakeholder holding anything, their
 * shares per class, options and convertibles, and the securities behind the row.
 */
export async function equityCapTableByStakeholder(
  prisma: EquityDb,
  actor: EquityScope,
  rawInput: unknown = {},
): Promise<EquityCapTableByStakeholder> {
  const input = EquityCapTableByStakeholderInputSchema.parse(rawInput);
  const scope = scopeOf(actor);
  const asOf = input.asOf ?? today();
  const [{ input: ledger, stakeholders }, certificateLabels, grantLabels] = await Promise.all([
    loadLedger(prisma, scope, asOf),
    prisma.equityCertificate.findMany({ where: scope, select: { id: true, label: true } }),
    prisma.equityOptionGrant.findMany({ where: scope, select: { id: true, label: true } }),
  ]);
  const table = computeCapTable(ledger);
  const fullyDiluted = table.totals.fullyDilutedShares;
  const outstanding = table.totals.outstandingShares;
  const labels = new Map(
    [...certificateLabels, ...grantLabels].map((row) => [row.id, row.label] as const),
  );
  const classNames = new Map(ledger.classes.map((row) => [row.id, row.name]));
  const planNames = new Map(ledger.plans.map((row) => [row.id, row.name]));

  const holdings = new Map<string, EquityStakeholderHolding[]>();
  const add = (stakeholderId: string, holding: EquityStakeholderHolding) =>
    holdings.set(stakeholderId, [...(holdings.get(stakeholderId) ?? []), holding]);
  for (const row of ledger.certificates) {
    if (!isOutstandingCertificate(row.status) || row.issueDate > asOf) continue;
    add(row.stakeholderId, {
      kind: "certificate",
      id: row.id,
      label: labels.get(row.id) ?? null,
      classOrPlanName: classNames.get(row.shareClassId) ?? "",
      quantity: fromBig(row.quantity),
      principalCents: "0",
      issueDate: row.issueDate,
    });
  }
  for (const row of ledger.optionGrants) {
    const quantity = outstandingOptionQuantity(row);
    if (row.status !== "outstanding" || row.grantDate > asOf || quantity === 0n) continue;
    add(row.stakeholderId, {
      kind: "option_grant",
      id: row.id,
      label: labels.get(row.id) ?? null,
      classOrPlanName: planNames.get(row.planId) ?? "",
      quantity: fromBig(quantity),
      principalCents: "0",
      issueDate: row.grantDate,
    });
  }
  const principal = new Map<string, bigint>();
  for (const row of ledger.convertibles) {
    if (row.status !== "outstanding") continue;
    principal.set(row.stakeholderId, (principal.get(row.stakeholderId) ?? 0n) + row.principalCents);
    add(row.stakeholderId, {
      kind: "convertible",
      id: row.id,
      label: null,
      classOrPlanName: row.blockName ?? "Convertible",
      quantity: "0",
      principalCents: fromBig(row.principalCents),
      issueDate: row.issueDate,
    });
  }

  const people = new Map(stakeholders.map((row) => [row.id, row]));
  const computed = new Map(table.stakeholders.map((row) => [row.stakeholderId, row]));
  const ids = new Set([...computed.keys(), ...principal.keys()]);
  const totals = {
    sharesByClass: {} as Record<string, string>,
    options: 0n,
    outstandingShares: 0n,
    fullyDilutedShares: 0n,
    convertiblePrincipalCents: 0n,
    cashPaidCents: 0n,
  };
  const rows = [...ids]
    .map((stakeholderId) => {
      const row = computed.get(stakeholderId);
      const person = people.get(stakeholderId);
      const outstandingShares = row?.outstandingShares ?? 0n;
      const fullyDilutedShares = row?.fullyDilutedShares ?? 0n;
      const options = fullyDilutedShares - outstandingShares;
      const convertiblePrincipalCents = principal.get(stakeholderId) ?? 0n;
      const cashPaidCents = row?.cashRaisedCents ?? 0n;
      const sharesByClass: Record<string, string> = {};
      for (const entry of row?.byClass ?? []) {
        if (entry.outstandingShares === 0n) continue;
        sharesByClass[entry.shareClassId] = fromBig(entry.outstandingShares);
        totals.sharesByClass[entry.shareClassId] = fromBig(
          toBig(totals.sharesByClass[entry.shareClassId] ?? "0") + entry.outstandingShares,
        );
      }
      totals.options += options;
      totals.outstandingShares += outstandingShares;
      totals.fullyDilutedShares += fullyDilutedShares;
      totals.convertiblePrincipalCents += convertiblePrincipalCents;
      totals.cashPaidCents += cashPaidCents;
      return {
        stakeholderId,
        name: person?.name ?? "Unknown",
        type: person?.type ?? "individual",
        sharesByClass,
        options: fromBig(options),
        outstandingShares: fromBig(outstandingShares),
        outstandingPercent: percentOf(outstandingShares, outstanding),
        fullyDilutedShares: fromBig(fullyDilutedShares),
        fullyDilutedPercent: percentOf(fullyDilutedShares, fullyDiluted),
        convertiblePrincipalCents: fromBig(convertiblePrincipalCents),
        cashPaidCents: fromBig(cashPaidCents),
        securities: holdings.get(stakeholderId) ?? [],
      };
    })
    .sort(
      (a, b) =>
        (toBig(b.fullyDilutedShares) > toBig(a.fullyDilutedShares)
          ? 1
          : toBig(b.fullyDilutedShares) < toBig(a.fullyDilutedShares)
            ? -1
            : 0) || a.name.localeCompare(b.name),
    );
  return {
    asOf,
    classes: ledger.classes.map((row) => ({ id: row.id, name: row.name })),
    rows,
    totals: {
      sharesByClass: totals.sharesByClass,
      options: fromBig(totals.options),
      outstandingShares: fromBig(totals.outstandingShares),
      outstandingPercent: percentOf(totals.outstandingShares, outstanding),
      fullyDilutedShares: fromBig(totals.fullyDilutedShares),
      fullyDilutedPercent: percentOf(totals.fullyDilutedShares, fullyDiluted),
      convertiblePrincipalCents: fromBig(totals.convertiblePrincipalCents),
      cashPaidCents: fromBig(totals.cashPaidCents),
    },
    unallocatedPoolShares: fromBig(table.totals.availablePlanShares),
  };
}
