import type { EquityOverview } from "@rakazo/contracts";
import type { CapTableInput } from "@rakazo/core/equity";
import { accruedInterestCents, computeCapTable, demoLedger, parseFixed } from "@rakazo/core/equity";

/**
 * The overview of the invented demo ledger (the same data the demo stack seeds), for stories.
 * Mirrors the shaping in packages/db/src/equity/overview.ts without a database.
 */
export function demoOverview(asOf = "2026-10-15"): EquityOverview {
  const ledger = demoLedger();
  const completedExercises = ledger.exercises.filter(
    (exercise) => exercise.status === "completed" && exercise.exerciseDate <= asOf,
  );
  const exercisedByGrant = new Map<string, bigint>();
  for (const exercise of completedExercises) {
    exercisedByGrant.set(
      exercise.optionGrantKey,
      (exercisedByGrant.get(exercise.optionGrantKey) ?? 0n) + BigInt(exercise.quantity),
    );
  }
  const grantsByKey = new Map(ledger.optionGrants.map((grant) => [grant.key, grant]));
  const plansByKey = new Map(ledger.plans.map((plan) => [plan.key, plan]));
  const exerciseCertificates = completedExercises.map((exercise) => {
    const grant = grantsByKey.get(exercise.optionGrantKey)!;
    const plan = plansByKey.get(grant.planKey)!;
    return {
      id: exercise.key,
      stakeholderId: grant.stakeholderKey,
      shareClassId: plan.shareClassKey,
      quantity: BigInt(exercise.quantity),
      status: "outstanding",
      issueDate: exercise.exerciseDate,
      cashPaidCents: BigInt(exercise.paymentCents ?? "0"),
      debtCanceledCents: 0n,
      ipTransferredCents: 0n,
      otherConsiderationCents: 0n,
    };
  });
  const current = (versions: (typeof ledger.shareClasses)[number]["versions"]) =>
    [...versions].reverse().find((version) => version.documentDate <= asOf) ?? versions[0]!;
  const classes = ledger.shareClasses
    .map((row) => ({ row, terms: current(row.versions) }))
    .sort(
      (a, b) =>
        (a.row.classType === "common" ? 1 : 0) - (b.row.classType === "common" ? 1 : 0) ||
        (a.terms.seniority ?? 1) - (b.terms.seniority ?? 1),
    );
  const input: CapTableInput = {
    asOf,
    classes: classes.map(({ row, terms }) => ({
      id: row.key,
      name: row.name,
      classType: row.classType,
      authorizedShares: BigInt(terms.authorizedShares),
      seniority: terms.seniority,
      pariPassu: terms.pariPassu,
    })),
    certificates: [
      ...ledger.certificates.map((row) => ({
        id: row.key,
        stakeholderId: row.stakeholderKey,
        shareClassId: row.shareClassKey,
        quantity: BigInt(row.quantity),
        status: row.status ?? "outstanding",
        issueDate: row.issueDate,
        cashPaidCents: BigInt(row.cashPaidCents ?? "0"),
        debtCanceledCents: BigInt(row.debtCanceledCents ?? "0"),
        ipTransferredCents: BigInt(row.ipTransferredCents ?? "0"),
        otherConsiderationCents: BigInt(row.otherConsiderationCents ?? "0"),
      })),
      ...exerciseCertificates,
    ],
    plans: ledger.plans.map((row) => ({
      id: row.key,
      name: row.name,
      shareClassId: row.shareClassKey,
      reservedShares: BigInt(row.reservedShares),
    })),
    optionGrants: ledger.optionGrants.map((row) => ({
      id: row.key,
      stakeholderId: row.stakeholderKey,
      planId: row.planKey,
      quantity: BigInt(row.quantity),
      exercisedQuantity: exercisedByGrant.get(row.key) ?? 0n,
      canceledQuantity: 0n,
      status: row.status ?? "outstanding",
      grantDate: row.grantDate,
    })),
    convertibles: ledger.convertibles
      .filter((row) => row.issueDate <= asOf)
      .map((row) => ({
        id: row.key,
        stakeholderId: row.stakeholderKey,
        blockId: row.blockKey ?? null,
        blockName:
          ledger.convertibleBlocks.find((block) => block.key === row.blockKey)?.name ?? null,
        principalCents: BigInt(row.principalCents),
        status: row.status ?? "outstanding",
        issueDate: row.issueDate,
        interestCents:
          row.interestRate && row.interestStartDate
            ? accruedInterestCents({
                principalCents: BigInt(row.principalCents),
                ratePercent: parseFixed(row.interestRate),
                startDate: row.interestStartDate,
                asOf,
                interestType: row.interestType === "compound" ? "compound" : "simple",
                dayCount: row.dayCountConvention ?? "actual_365",
              })
            : 0n,
      })),
  };
  const table = computeCapTable(input);
  const convertibleRaised = table.convertibles.reduce(
    (sum, row) => sum + row.amountRaisedCents,
    0n,
  );
  return {
    hasLedger: true,
    canImport: false,
    importedAt: null,
    asOf,
    totals: {
      outstandingShares: table.totals.outstandingShares.toString(),
      fullyDilutedShares: table.totals.fullyDilutedShares.toString(),
      commonShares: table.totals.commonShares.toString(),
      preferredShares: table.totals.preferredShares.toString(),
      availablePlanShares: table.totals.availablePlanShares.toString(),
      amountRaisedCents: (table.totals.amountRaisedCents + convertibleRaised).toString(),
    },
    classes: table.classes.map((row) => ({
      ...row,
      authorizedShares: row.authorizedShares.toString(),
      outstandingShares: row.outstandingShares.toString(),
      fullyDilutedShares: row.fullyDilutedShares.toString(),
      amountRaisedCents: row.amountRaisedCents.toString(),
    })),
    plans: table.plans.map((row) => ({
      ...row,
      outstandingShares: row.outstandingShares.toString(),
      availableShares: row.availableShares.toString(),
    })),
    convertibles: table.convertibles.map((row) => ({
      blockId: row.blockId,
      name: row.name,
      principalCents: row.principalCents.toString(),
      interestCents: row.interestCents.toString(),
      outstandingDebtCents: row.outstandingDebtCents.toString(),
      amountRaisedCents: row.amountRaisedCents.toString(),
    })),
    counts: {
      stakeholders: ledger.stakeholders.length,
      shareClasses: ledger.shareClasses.length,
      plans: ledger.plans.length,
      certificates: ledger.certificates.length,
      convertibles: ledger.convertibles.length,
      optionGrants: ledger.optionGrants.length,
      fundingRounds: ledger.fundingRounds.length,
    },
  };
}
