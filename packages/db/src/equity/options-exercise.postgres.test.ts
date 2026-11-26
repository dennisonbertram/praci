import { randomUUID } from "node:crypto";
import { EquityExerciseResultSchema } from "@rakazo/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError } from "./ledger.js";
import {
  createEquityExercise,
  createEquityOptionGrant,
  getEquityOptionGrant,
  updateEquityExercise,
  updateEquityOptionGrant,
} from "./options.js";
import { completeEquityExercise, exerciseEquityOptions } from "./options-exercise.js";
import { getEquityPlanPool } from "./options-plans.js";
import type { EquityFixture } from "./test-fixture.js";
import {
  barrierAtEquityLedgerLock,
  describeEquityPostgres,
  equityFixture,
} from "./test-fixture.js";

describeEquityPostgres("option exercises that issue certificates (PostgreSQL)", () => {
  let f: EquityFixture;
  let stakeholderId: string;
  let planId: string;
  let vestingGrantId: string;
  let earlyGrantId: string;

  beforeEach(async () => {
    f = await equityFixture("options-exercise");
    const { owner, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    await owner.equityLedger.create({ data: scope });
    const stakeholder = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Ada Example" },
    });
    stakeholderId = stakeholder.id;
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common", classType: "common", prefix: "CS" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: shareClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000_000n,
      },
    });
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "2024 Plan", shareClassId: shareClass.id, reservedShares: 100_000n },
    });
    planId = plan.id;
    const schedule = await owner.equityVestingSchedule.create({
      data: {
        ...scope,
        startDate: new Date("2024-01-01T00:00:00.000Z"),
        totalMonths: 48,
        cliffMonths: 12,
        frequencyMonths: 1,
      },
    });
    const base = {
      ...scope,
      stakeholderId: stakeholder.id,
      planId,
      shareClassId: shareClass.id,
      optionType: "iso",
      quantity: 48_000n,
      exercisePrice: "0.1",
      grantDate: new Date("2024-01-01T00:00:00.000Z"),
    };
    vestingGrantId = (
      await owner.equityOptionGrant.create({
        data: { ...base, label: "ES-1", vestingScheduleId: schedule.id },
      })
    ).id;
    earlyGrantId = (
      await owner.equityOptionGrant.create({
        data: { ...base, label: "ES-2", quantity: 10_000n, earlyExercise: true },
      })
    ).id;
  });

  afterEach(async () => {
    await f?.close();
  });

  const newExerciseGrant = (quantity = "1000") =>
    f.as(f.mine, () =>
      createEquityOptionGrant(f.prisma, f.mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity,
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
        earlyExercise: true,
      }),
    );

  it("exercises vested options and issues the certificate", async () => {
    const { prisma, mine, owner } = f;
    const requestKey = randomUUID();
    await expect(
      f.as(mine, () =>
        exerciseEquityOptions(prisma, mine, {
          optionGrantId: vestingGrantId,
          quantity: "12001",
          exerciseDate: "2025-01-01",
          requestKey: randomUUID(),
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const result = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: vestingGrantId,
        quantity: "12000",
        exerciseDate: "2025-01-01",
        requestKey,
      }),
    );
    EquityExerciseResultSchema.parse(result);
    expect(result.exercise.status).toBe("completed");
    expect(result.exercise.paymentCents).toBe("120000");
    expect(result.exercise.certificateId).toBe(result.certificate.id);
    expect(result.certificate.label).toBe("CS-1");
    expect(result.certificate.quantity).toBe("12000");
    expect(result.certificate.planId).toBe(planId);
    expect(result.certificate.pricePaidPerShare).toBe(result.certificate.pricePerShare);
    await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, { id: vestingGrantId, exercisePrice: "0.2" }),
    );
    const transactionsBeforeRetry = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    const retry = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: vestingGrantId,
        quantity: "12000",
        exerciseDate: "2025-01-01",
        requestKey,
      }),
    );
    expect(retry.exercise.id).toBe(result.exercise.id);
    expect(retry.certificate.id).toBe(result.certificate.id);
    expect(retry.exercise.paymentCents).toBe("120000");
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(transactionsBeforeRetry);
    await expect(
      f.as(mine, () =>
        exerciseEquityOptions(prisma, mine, {
          optionGrantId: vestingGrantId,
          quantity: "12000",
          exerciseDate: "2025-01-01",
          paymentCents: "120001",
          requestKey,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    for (const changed of [
      { quantity: "12001", exerciseDate: "2025-01-01" },
      { quantity: "12000", exerciseDate: "2025-01-02" },
    ])
      await expect(
        f.as(mine, () =>
          exerciseEquityOptions(prisma, mine, {
            optionGrantId: vestingGrantId,
            ...changed,
            requestKey,
          }),
        ),
      ).rejects.toBeInstanceOf(EquityConflictError);
    await expect(
      f.as(mine, () =>
        exerciseEquityOptions(prisma, mine, {
          optionGrantId: earlyGrantId,
          quantity: "12000",
          exerciseDate: "2025-01-01",
          requestKey,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    const kinds = await owner.equityTransaction.findMany({
      where: { spaceId: mine.spaceId, userId: mine.userId },
      select: { kind: true },
    });
    expect(kinds.map((row) => row.kind).sort()).toEqual(["exercise", "issue", "modify"]);
    const pool = await f.as(mine, () => getEquityPlanPool(prisma, mine, { planId }));
    expect(pool.exercisedShares).toBe("12000");
    expect(pool.issuedShares).toBe("0");
    expect(pool.availableShares).toBe("42000");
  });

  it("reserves pending shares against vested capacity and excludes the edited reservation once", async () => {
    const { prisma, mine } = f;
    const pending = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: vestingGrantId,
        quantity: "20000",
        exerciseDate: "2026-01-01",
        requestKey: randomUUID(),
      }),
    );
    await expect(
      f.as(mine, () =>
        createEquityExercise(prisma, mine, {
          optionGrantId: vestingGrantId,
          quantity: "5000",
          exerciseDate: "2026-01-01",
          requestKey: randomUUID(),
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const edited = await f.as(mine, () =>
      updateEquityExercise(prisma, mine, {
        id: pending.id,
        exerciseDate: "2026-01-01",
        paymentCents: pending.paymentCents,
      }),
    );
    expect(edited.id).toBe(pending.id);
    await f.as(mine, () =>
      updateEquityExercise(prisma, mine, { id: pending.id, status: "canceled" }),
    );
  });

  it("allows early exercise and completes a pending exercise once", async () => {
    const { prisma, mine } = f;
    const grant = await f.as(mine, () => getEquityOptionGrant(prisma, mine, earlyGrantId));
    expect(grant.vestedQuantity).toBe(grant.quantity);
    const early = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: earlyGrantId,
        quantity: "1000",
        exerciseDate: "2024-02-01",
        requestKey: randomUUID(),
      }),
    );
    expect(early.certificate.label).toMatch(/^CS-/);
    const pending = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: earlyGrantId,
        quantity: "1000",
        exerciseDate: "2024-03-01",
        requestKey: randomUUID(),
      }),
    );
    const done = await f.as(mine, () =>
      completeEquityExercise(prisma, mine, { exerciseId: pending.id }),
    );
    expect(done.exercise.status).toBe("completed");
    await expect(
      f.as(mine, () =>
        updateEquityExercise(prisma, mine, {
          id: pending.id,
          status: "pending",
          exerciseDate: "2023-12-31",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    const retry = await f.as(mine, () =>
      completeEquityExercise(prisma, mine, { exerciseId: pending.id }),
    );
    expect(retry.exercise.certificateId).toBe(done.exercise.certificateId);
    expect(retry.certificate.id).toBe(done.certificate.id);
  });

  it("routes generic completion through certificate issuance", async () => {
    const { prisma, mine, owner } = f;
    const grantBefore = await f.as(mine, () => getEquityOptionGrant(prisma, mine, earlyGrantId));
    const requestKey = randomUUID();
    const pending = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: earlyGrantId,
        quantity: "1000",
        exerciseDate: "2024-03-02",
        paymentCents: "12345",
        requestKey,
      }),
    );
    const exercisesBeforeRetry = await owner.equityExercise.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    const retry = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: earlyGrantId,
        quantity: "1000",
        exerciseDate: "2024-03-02",
        paymentCents: "12345",
        requestKey,
      }),
    );
    expect(retry.id).toBe(pending.id);
    expect(
      await owner.equityExercise.count({ where: { spaceId: mine.spaceId, userId: mine.userId } }),
    ).toBe(exercisesBeforeRetry);
    const completed = await f.as(mine, () =>
      updateEquityExercise(prisma, mine, { id: pending.id, status: "completed" }),
    );
    expect(completed.status).toBe("completed");
    expect(completed.certificateId).not.toBeNull();
    const certificate = await owner.equityCertificate.findFirst({
      where: { id: completed.certificateId!, spaceId: mine.spaceId, userId: mine.userId },
    });
    expect(certificate?.quantity).toBe(1000n);
    expect(certificate?.cashPaidCents).toBe(12345n);
    const audit = await owner.equityTransaction.findFirst({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        kind: "exercise",
        optionGrantId: earlyGrantId,
        effectiveDate: new Date("2024-03-02T00:00:00.000Z"),
      },
      orderBy: { createdAt: "desc" },
    });
    const grantAfter = await f.as(mine, () => getEquityOptionGrant(prisma, mine, earlyGrantId));
    const before = audit?.before as Record<string, unknown>;
    const after = audit?.after as Record<string, unknown>;
    expect(before).toMatchObject({
      id: grantBefore.id,
      label: grantBefore.label,
      status: grantBefore.status,
      quantity: grantBefore.quantity,
      exercisedQuantity: grantBefore.exercisedQuantity,
      canceledQuantity: grantBefore.canceledQuantity,
      exercise: {
        id: pending.id,
        status: "pending",
        paymentCents: "12345",
        requestKey,
      },
    });
    expect(after).toMatchObject({
      id: grantAfter.id,
      label: grantAfter.label,
      status: grantAfter.status,
      quantity: grantAfter.quantity,
      exercisedQuantity: grantAfter.exercisedQuantity,
      canceledQuantity: grantAfter.canceledQuantity,
      exercise: {
        id: pending.id,
        status: "completed",
        paymentCents: "12345",
        certificateId: completed.certificateId,
      },
      certificate: {
        id: completed.certificateId,
        quantity: "1000",
        cashPaidCents: "12345",
      },
    });
  });

  it("serializes checked and generic completion into one certificate and audit", async () => {
    const { prisma, mine, owner } = f;
    const pending = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: earlyGrantId,
        quantity: "500",
        exerciseDate: "2024-04-01",
        requestKey: randomUUID(),
      }),
    );
    const certificatesBefore = await owner.equityCertificate.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    const exerciseAuditsBefore = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId, kind: "exercise" },
    });
    const interleaved = barrierAtEquityLedgerLock(prisma);
    const results = await Promise.allSettled([
      f.as(mine, () => completeEquityExercise(interleaved, mine, { exerciseId: pending.id })),
      f.as(mine, () =>
        updateEquityExercise(interleaved, mine, { id: pending.id, status: "completed" }),
      ),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const certificateIds = results.map((result) => {
      if (result.status !== "fulfilled") return null;
      return "certificate" in result.value
        ? result.value.certificate.id
        : result.value.certificateId;
    });
    expect(certificateIds[0]).toBeTruthy();
    expect(certificateIds[0]).toBe(certificateIds[1]);
    expect(
      await owner.equityCertificate.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(certificatesBefore + 1);
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId, kind: "exercise" },
      }),
    ).toBe(exerciseAuditsBefore + 1);
  });

  it("serializes competing pending reservations at the grant boundary", async () => {
    const { prisma, mine, owner } = f;
    const interleaved = barrierAtEquityLedgerLock(prisma);
    const attempts = await Promise.allSettled(
      [randomUUID(), randomUUID()].map((requestKey) =>
        f.as(mine, () =>
          createEquityExercise(interleaved, mine, {
            optionGrantId: earlyGrantId,
            quantity: "6000",
            exerciseDate: "2024-05-01",
            requestKey,
          }),
        ),
      ),
    );
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
    const reserved = await owner.equityExercise.aggregate({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: earlyGrantId,
        status: "pending",
      },
      _sum: { quantity: true },
    });
    expect(reserved._sum.quantity).toBe(6000n);
  });

  it("does not reduce a grant below its pending exercise reservations", async () => {
    const { owner, prisma, mine } = f;
    const grant = await newExerciseGrant("1000");
    await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "700",
        exerciseDate: "2024-03-01",
        requestKey: randomUUID(),
      }),
    );
    await expect(
      f.as(mine, () => updateEquityOptionGrant(prisma, mine, { id: grant.id, quantity: "600" })),
    ).rejects.toBeInstanceOf(EquityInputError);
    const plan = await owner.equityPlan.findFirstOrThrow({
      where: { id: planId },
      select: { shareClassId: true },
    });
    const destination = await owner.equityPlan.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        name: "Pending move destination",
        shareClassId: plan.shareClassId,
        reservedShares: 1_000n,
      },
    });
    await expect(
      f.as(mine, () =>
        updateEquityOptionGrant(prisma, mine, { id: grant.id, planId: destination.id }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("serializes completion of distinct pending exercises without losing counter updates", async () => {
    const { prisma, mine, owner } = f;
    const grant = await newExerciseGrant("1000");
    const first = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "400",
        exerciseDate: "2024-03-01",
        requestKey: randomUUID(),
      }),
    );
    const second = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "500",
        exerciseDate: "2024-03-01",
        requestKey: randomUUID(),
      }),
    );
    const synchronized = barrierAtEquityLedgerLock(prisma);
    const completed = await Promise.all([
      f.as(mine, () => completeEquityExercise(synchronized, mine, { exerciseId: first.id })),
      f.as(mine, () => completeEquityExercise(synchronized, mine, { exerciseId: second.id })),
    ]);
    expect(completed.map(({ exercise }) => exercise.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    const persisted = await owner.equityExercise.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { id: true, status: true, certificateId: true },
    });
    expect(persisted).toHaveLength(2);
    expect(persisted.every((exercise) => exercise.status === "completed")).toBe(true);
    expect(persisted.every((exercise) => exercise.certificateId !== null)).toBe(true);
    const certificateIds = persisted.map((exercise) => exercise.certificateId!);
    expect(new Set(certificateIds).size).toBe(2);
    expect(completed.map(({ certificate }) => certificate.id).sort()).toEqual(
      certificateIds.sort(),
    );
    const savedGrant = await owner.equityOptionGrant.findUniqueOrThrow({
      where: { id: grant.id },
    });
    expect(savedGrant.exercisedQuantity).toBe(900n);
    expect(savedGrant.canceledQuantity).toBe(0n);
    expect(
      await owner.equityCertificate.count({
        where: {
          spaceId: mine.spaceId,
          userId: mine.userId,
          exercises: { some: { optionGrantId: grant.id } },
        },
      }),
    ).toBe(2);
  });

  it("fails closed for a legacy completed exercise without a certificate", async () => {
    const { prisma, mine, owner } = f;
    const legacy = await owner.equityExercise.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: earlyGrantId,
        quantity: 1n,
        exerciseDate: new Date("2024-04-01T00:00:00.000Z"),
        status: "completed",
      },
    });
    await expect(
      f.as(mine, () => completeEquityExercise(prisma, mine, { exerciseId: legacy.id })),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("checks grant, original-expiry, and termination deadlines independently of expiry status", async () => {
    const { prisma, mine, owner } = f;
    const templateGrant = await f.as(mine, () => getEquityOptionGrant(prisma, mine, earlyGrantId));
    const stakeholderId = templateGrant.stakeholderId;
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
        expirationDate: "2024-12-31",
        postTerminationExerciseMonths: 2,
        earlyExercise: true,
      }),
    );
    await owner.equityStakeholder.update({
      where: { id: stakeholderId },
      data: { terminatedAt: new Date("2024-04-01T00:00:00.000Z") },
    });
    expect((await f.as(mine, () => getEquityOptionGrant(prisma, mine, grant.id))).status).toBe(
      "outstanding",
    );
    for (const exerciseDate of ["2023-12-31", "2024-06-02"])
      await expect(
        f.as(mine, () =>
          createEquityExercise(prisma, mine, {
            optionGrantId: grant.id,
            quantity: "1",
            exerciseDate,
            requestKey: randomUUID(),
          }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
    const atDeadline = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "1",
        exerciseDate: "2024-06-01",
        requestKey: randomUUID(),
      }),
    );
    await f.as(mine, () =>
      updateEquityExercise(prisma, mine, { id: atDeadline.id, status: "canceled" }),
    );
    const earlierExpiry = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
        expirationDate: "2024-05-31",
        postTerminationExerciseMonths: 6,
        earlyExercise: true,
      }),
    );
    await expect(
      f.as(mine, () =>
        createEquityExercise(prisma, mine, {
          optionGrantId: earlierExpiry.id,
          quantity: "1",
          exerciseDate: "2024-06-01",
          requestKey: randomUUID(),
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("rolls back exercise issuance, counters, and audits when class authorization is unavailable", async () => {
    const { prisma, mine, owner } = f;
    const grant = await f.as(mine, () => getEquityOptionGrant(prisma, mine, earlyGrantId));
    const pending = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: earlyGrantId,
        quantity: "100",
        exerciseDate: "2024-04-02",
        requestKey: randomUUID(),
      }),
    );
    const version = await owner.equityShareClassVersion.findFirstOrThrow({
      where: { spaceId: mine.spaceId, userId: mine.userId, shareClassId: grant.shareClassId },
      orderBy: { documentDate: "desc" },
    });
    const beforeGrant = await owner.equityOptionGrant.findUniqueOrThrow({
      where: { id: earlyGrantId },
      select: { exercisedQuantity: true },
    });
    const beforeCertificates = await owner.equityCertificate.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    const beforeTransactions = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    await owner.equityShareClassVersion.update({
      where: { id: version.id },
      data: { authorizedShares: 0n },
    });
    try {
      await expect(
        f.as(mine, () => completeEquityExercise(prisma, mine, { exerciseId: pending.id })),
      ).rejects.toBeInstanceOf(EquityInputError);
    } finally {
      await owner.equityShareClassVersion.update({
        where: { id: version.id },
        data: { authorizedShares: version.authorizedShares },
      });
    }
    const afterExercise = await owner.equityExercise.findUniqueOrThrow({
      where: { id: pending.id },
      select: { status: true, certificateId: true },
    });
    const afterGrant = await owner.equityOptionGrant.findUniqueOrThrow({
      where: { id: earlyGrantId },
      select: { exercisedQuantity: true },
    });
    expect(afterExercise).toEqual({ status: "pending", certificateId: null });
    expect(afterGrant.exercisedQuantity).toBe(beforeGrant.exercisedQuantity);
    expect(
      await owner.equityCertificate.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(beforeCertificates);
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(beforeTransactions);
    await f.as(mine, () =>
      updateEquityExercise(prisma, mine, { id: pending.id, status: "canceled" }),
    );
  });

  it("keeps another user and another space out", async () => {
    const { prisma, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace]) {
      await expect(
        f.as(scope, () =>
          exerciseEquityOptions(prisma, scope, {
            optionGrantId: vestingGrantId,
            quantity: "1",
            exerciseDate: "2025-06-01",
            requestKey: randomUUID(),
          }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
    }
  });

  it("cancels a pending exercise after eligibility changes and audits full snapshots", async () => {
    const { prisma, mine, owner } = f;
    const grant = await newExerciseGrant("100");
    const pending = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "10",
        exerciseDate: "2024-02-01",
        requestKey: randomUUID(),
      }),
    );
    await f.as(mine, () =>
      updateEquityExercise(prisma, mine, {
        id: pending.id,
        exerciseDate: "2024-03-01",
        paymentCents: "17",
      }),
    );
    const termsAudit = await owner.equityTransaction.findFirstOrThrow({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grant.id,
        reason: "pending exercise terms updated",
      },
    });
    const termsBefore = termsAudit.before as Record<string, unknown>;
    const termsAfter = termsAudit.after as Record<string, unknown>;
    expect(termsAudit.kind).toBe("modify");
    expect(termsBefore.status).toBe("outstanding");
    expect(termsBefore.exercisedQuantity).toBe("0");
    expect((termsBefore.exercise as Record<string, unknown>).status).toBe("pending");
    expect((termsAfter.exercise as Record<string, unknown>).exerciseDate).toBe("2024-03-01");
    expect((termsAfter.exercise as Record<string, unknown>).paymentCents).toBe("17");
    expect(termsAfter.certificate).toBeNull();

    await owner.equityStakeholder.update({
      where: { id: stakeholderId },
      data: { terminatedAt: new Date("2023-01-01T00:00:00.000Z") },
    });
    await expect(
      f.as(mine, () =>
        updateEquityExercise(prisma, mine, {
          id: pending.id,
          status: "canceled",
          exerciseDate: "2024-04-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    const beforeGrant = await owner.equityOptionGrant.findUniqueOrThrow({
      where: { id: grant.id },
      select: { exercisedQuantity: true, canceledQuantity: true },
    });
    const beforeCertificates = await owner.equityCertificate.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    const beforeCancelAudits = await owner.equityTransaction.count({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grant.id,
        reason: "pending exercise canceled",
      },
    });
    const canceled = await f.as(mine, () =>
      updateEquityExercise(prisma, mine, { id: pending.id, status: "canceled" }),
    );
    const transactionCount = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
    });
    const replay = await f.as(mine, () =>
      updateEquityExercise(prisma, mine, { id: pending.id, status: "canceled" }),
    );
    expect(canceled.status).toBe("canceled");
    expect(replay).toEqual(canceled);
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
      }),
    ).toBe(transactionCount);
    expect(
      await owner.equityTransaction.count({
        where: {
          spaceId: mine.spaceId,
          userId: mine.userId,
          optionGrantId: grant.id,
          reason: "pending exercise canceled",
        },
      }),
    ).toBe(beforeCancelAudits + 1);
    expect(
      await owner.equityOptionGrant.findUniqueOrThrow({
        where: { id: grant.id },
        select: { exercisedQuantity: true, canceledQuantity: true },
      }),
    ).toEqual(beforeGrant);
    expect(
      await owner.equityCertificate.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(beforeCertificates);
    const cancelAudit = await owner.equityTransaction.findFirstOrThrow({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grant.id,
        reason: "pending exercise canceled",
      },
    });
    expect((cancelAudit.before as Record<string, unknown>).status).toBe("outstanding");
    expect((cancelAudit.after as Record<string, unknown>).exercisedQuantity).toBe("0");
    expect(
      ((cancelAudit.after as Record<string, unknown>).exercise as Record<string, unknown>).status,
    ).toBe("canceled");
    expect((cancelAudit.after as Record<string, unknown>).certificate).toBeNull();
    await owner.equityStakeholder.update({
      where: { id: stakeholderId },
      data: { terminatedAt: null },
    });
  });

  it("replays one concurrent direct exercise key and preserves full immutable audit snapshots", async () => {
    const { prisma, mine, owner } = f;
    const grant = await newExerciseGrant("100");
    const requestKey = randomUUID();
    const synchronized = barrierAtEquityLedgerLock(prisma);
    const certificatesBefore = await owner.equityCertificate.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    const input = {
      optionGrantId: grant.id,
      quantity: "10",
      exerciseDate: "2024-03-01",
      requestKey,
    };
    const [first, second] = await Promise.all([
      f.as(mine, () => exerciseEquityOptions(synchronized, mine, input)),
      f.as(mine, () => exerciseEquityOptions(synchronized, mine, input)),
    ]);
    expect(first.exercise.id).toBe(second.exercise.id);
    expect(first.certificate.id).toBe(second.certificate.id);
    expect(
      await owner.equityExercise.count({
        where: { spaceId: mine.spaceId, userId: mine.userId, requestKey },
      }),
    ).toBe(1);
    expect(
      await owner.equityCertificate.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(certificatesBefore + 1);
    expect(
      await owner.equityTransaction.count({
        where: {
          spaceId: mine.spaceId,
          userId: mine.userId,
          optionGrantId: grant.id,
          kind: "exercise",
        },
      }),
    ).toBe(1);
    const audit = await owner.equityTransaction.findFirstOrThrow({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grant.id,
        kind: "exercise",
      },
    });
    const before = audit.before as Record<string, unknown>;
    const after = audit.after as Record<string, unknown>;
    expect(before.status).toBe("outstanding");
    expect(before.label).toBe(grant.label);
    expect(before.quantity).toBe("100");
    expect(before.exercisedQuantity).toBe("0");
    expect(before.canceledQuantity).toBe("0");
    expect((before.exercise as Record<string, unknown>).status).toBe("pending");
    expect((before.exercise as Record<string, unknown>).requestKey).toBe(requestKey);
    expect(after.status).toBe("outstanding");
    expect(after.quantity).toBe("100");
    expect(after.exercisedQuantity).toBe("10");
    expect(after.canceledQuantity).toBe("0");
    expect((after.exercise as Record<string, unknown>).status).toBe("completed");
    expect((after.exercise as Record<string, unknown>).certificateId).toBe(first.certificate.id);
    expect((after.certificate as Record<string, unknown>).id).toBe(first.certificate.id);
  });

  it("blocks pending repricing but allows equivalent prices and completed-key replay", async () => {
    const { prisma, mine, owner } = f;
    const grant = await newExerciseGrant("100");
    const pending = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "10",
        exerciseDate: "2024-03-01",
        requestKey: randomUUID(),
      }),
    );
    const before = await owner.equityOptionGrant.findUniqueOrThrow({
      where: { id: grant.id },
      select: { exercisedQuantity: true, canceledQuantity: true },
    });
    const auditsBefore = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
    });
    await expect(
      f.as(mine, () =>
        updateEquityOptionGrant(prisma, mine, { id: grant.id, exercisePrice: "0.2" }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    expect(
      await owner.equityOptionGrant.findUniqueOrThrow({
        where: { id: grant.id },
        select: { exercisedQuantity: true, canceledQuantity: true },
      }),
    ).toEqual(before);
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
      }),
    ).toBe(auditsBefore);
    await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, { id: grant.id, exercisePrice: "0.1000000000" }),
    );
    expect(pending.paymentCents).toBe("100");
    await f.as(mine, () =>
      updateEquityExercise(prisma, mine, { id: pending.id, status: "canceled" }),
    );
    const requestKey = randomUUID();
    const completed = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "10",
        exerciseDate: "2024-04-01",
        requestKey,
      }),
    );
    const audit = await owner.equityTransaction.findFirstOrThrow({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grant.id,
        kind: "exercise",
      },
    });
    const snapshots = { before: audit.before, after: audit.after };
    await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, { id: grant.id, exercisePrice: "0.2" }),
    );
    const transactionsBeforeReplay = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
    });
    const replay = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "10",
        exerciseDate: "2024-04-01",
        requestKey,
      }),
    );
    expect(replay.certificate.id).toBe(completed.certificate.id);
    expect(replay.exercise.paymentCents).toBe(completed.exercise.paymentCents);
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
      }),
    ).toBe(transactionsBeforeReplay);
    const auditAfterReplay = await owner.equityTransaction.findFirstOrThrow({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grant.id,
        kind: "exercise",
      },
    });
    expect({ before: auditAfterReplay.before, after: auditAfterReplay.after }).toEqual(snapshots);
  });

  it("rejects default exercise payments outside BIGINT without writing", async () => {
    const { prisma, mine, owner } = f;
    const grant = await newExerciseGrant("1000");
    await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, {
        id: grant.id,
        exercisePrice: "99999999999999.9999999999",
      }),
    );
    const where = {
      spaceId: mine.spaceId,
      userId: mine.userId,
      optionGrantId: grant.id,
    };
    const beforeExercises = await owner.equityExercise.count({ where });
    const beforeTransactions = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
    });
    await expect(
      f.as(mine, () =>
        createEquityExercise(prisma, mine, {
          optionGrantId: grant.id,
          quantity: "1000",
          exerciseDate: "2024-03-01",
          requestKey: randomUUID(),
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    expect(await owner.equityExercise.count({ where })).toBe(beforeExercises);
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
      }),
    ).toBe(beforeTransactions);
  });

  it("treats equivalent payment cents as an unchanged completed replay", async () => {
    const { prisma, mine, owner } = f;
    const grant = await newExerciseGrant("1000");
    const completed = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "10",
        exerciseDate: "2024-03-01",
        paymentCents: "100",
        requestKey: randomUUID(),
      }),
    );
    const where = {
      spaceId: mine.spaceId,
      userId: mine.userId,
      optionGrantId: grant.id,
    };
    const transactionsBeforeReplay = await owner.equityTransaction.count({ where });
    const certificatesBeforeReplay = await owner.equityCertificate.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    const replay = await f.as(mine, () =>
      updateEquityExercise(prisma, mine, {
        id: completed.exercise.id,
        status: "completed",
        paymentCents: "00100",
      }),
    );
    expect(replay.paymentCents).toBe("100");
    expect(replay.certificateId).toBe(completed.certificate.id);
    expect(await owner.equityTransaction.count({ where })).toBe(transactionsBeforeReplay);
    expect(
      await owner.equityCertificate.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(certificatesBeforeReplay);
  });

  it("keeps completion eligibility closed for a legacy zero-quantity exercise", async () => {
    const { prisma, mine, owner } = f;
    const grant = await newExerciseGrant("100");
    const legacy = await owner.equityExercise.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grant.id,
        quantity: 0n,
        exerciseDate: new Date("2024-03-01T00:00:00.000Z"),
      },
    });
    const grantBefore = await owner.equityOptionGrant.findUniqueOrThrow({
      where: { id: grant.id },
      select: { status: true, exercisedQuantity: true, canceledQuantity: true },
    });
    const transactionsBefore = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
    });
    const certificatesBefore = await owner.equityCertificate.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    await expect(
      f.as(mine, () => completeEquityExercise(prisma, mine, { exerciseId: legacy.id })),
    ).rejects.toBeInstanceOf(EquityInputError);
    expect(
      await owner.equityOptionGrant.findUniqueOrThrow({
        where: { id: grant.id },
        select: { status: true, exercisedQuantity: true, canceledQuantity: true },
      }),
    ).toEqual(grantBefore);
    expect(
      await owner.equityExercise.findUniqueOrThrow({
        where: { id: legacy.id },
        select: { status: true, certificateId: true },
      }),
    ).toEqual({ status: "pending", certificateId: null });
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grant.id },
      }),
    ).toBe(transactionsBefore);
    expect(
      await owner.equityCertificate.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(certificatesBefore);
  });
});
