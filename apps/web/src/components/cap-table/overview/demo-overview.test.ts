import { demoLedger, isOutstandingCertificate } from "@rakazo/core/equity";
import { expect, it } from "vitest";
import { demoOverview } from "./demo-overview";

it("keeps completed option exercises in issued shares and grant accounting", () => {
  const asOf = "2026-10-15";
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

  const overview = demoOverview(asOf);
  const existingIssued = ledger.certificates
    .filter(
      (certificate) =>
        certificate.issueDate <= asOf &&
        isOutstandingCertificate(certificate.status ?? "outstanding"),
    )
    .reduce((total, certificate) => total + BigInt(certificate.quantity), 0n);
  const exerciseIssued = completedExercises.reduce(
    (total, exercise) => total + BigInt(exercise.quantity),
    0n,
  );
  expect(BigInt(overview.totals.outstandingShares)).toBe(existingIssued + exerciseIssued);
  for (const shareClass of ledger.shareClasses) {
    const classIssued = ledger.certificates
      .filter(
        (certificate) =>
          certificate.shareClassKey === shareClass.key &&
          certificate.issueDate <= asOf &&
          isOutstandingCertificate(certificate.status ?? "outstanding"),
      )
      .reduce((total, certificate) => total + BigInt(certificate.quantity), 0n);
    const classExercises = completedExercises.reduce((total, exercise) => {
      const grant = grantsByKey.get(exercise.optionGrantKey)!;
      const plan = plansByKey.get(grant.planKey)!;
      return plan.shareClassKey === shareClass.key ? total + BigInt(exercise.quantity) : total;
    }, 0n);
    const overviewClass = overview.classes.find((row) => row.shareClassId === shareClass.key)!;
    expect(BigInt(overviewClass.outstandingShares)).toBe(classIssued + classExercises);
  }
  expect(ledger.exercises.some((exercise) => exercise.status === "pending")).toBe(true);
  expect(
    ledger.optionGrants.some(
      (grant) =>
        (grant.status ?? "outstanding") === "outstanding" && !exercisedByGrant.has(grant.key),
    ),
  ).toBe(true);

  for (const plan of ledger.plans) {
    let outstanding = 0n;
    let exercised = 0n;
    for (const grant of ledger.optionGrants.filter((row) => row.planKey === plan.key)) {
      const grantExercises = exercisedByGrant.get(grant.key) ?? 0n;
      exercised += grantExercises;
      if ((grant.status ?? "outstanding") === "outstanding" && grant.grantDate <= asOf) {
        const remaining = BigInt(grant.quantity) - grantExercises;
        outstanding += remaining > 0n ? remaining : 0n;
      }
    }
    const expectedAvailable = BigInt(plan.reservedShares) - outstanding - exercised;
    const overviewPlan = overview.plans.find((row) => row.planId === plan.key)!;
    expect(BigInt(overviewPlan.outstandingShares)).toBe(outstanding);
    expect(BigInt(overviewPlan.availableShares)).toBe(
      expectedAvailable > 0n ? expectedAvailable : 0n,
    );
  }
});
