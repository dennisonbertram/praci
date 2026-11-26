import { randomUUID } from "node:crypto";
import { EquityPlanPoolSchema, EquityPlanPourOverSchema } from "@rakazo/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityInputError } from "./ledger.js";
import { createEquityOptionGrant, updateEquityOptionGrant } from "./options.js";
import { exerciseEquityOptions } from "./options-exercise.js";
import {
  getEquityPlanPool,
  increaseEquityPlanPool,
  listEquityPlanPools,
  pourOverEquityPlan,
} from "./options-plans.js";
import { planAccountingById } from "./plan-accounting.js";
import { createEquityCertificate, updateEquityCertificate } from "./securities.js";
import { convertEquityCertificate, transferEquityCertificate } from "./securities-transactions.js";
import { getEquityPlan, updateEquityPlan } from "./share-classes.js";
import type { EquityFixture } from "./test-fixture.js";
import {
  barrierAtEquityLedgerLock,
  describeEquityPostgres,
  equityFixture,
  pauseAfterPlanRead,
} from "./test-fixture.js";

describeEquityPostgres("equity plan pools (PostgreSQL)", () => {
  let f: EquityFixture;
  let planId: string;
  let otherPlanId: string;
  let shareClassId: string;
  let stakeholderId: string;

  beforeEach(async () => {
    f = await equityFixture("options-plans");
    const { owner, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    await owner.equityLedger.create({ data: scope });
    const stakeholder = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Ada Example" },
    });
    stakeholderId = stakeholder.id;
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common", classType: "common", prefix: "C" },
    });
    shareClassId = shareClass.id;
    const plan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "2024 Stock Plan",
        shareClassId,
        reservedShares: 1_000_000n,
      },
    });
    planId = plan.id;
    const otherPlan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "2025 Stock Plan",
        shareClassId,
        reservedShares: 200_000n,
      },
    });
    otherPlanId = otherPlan.id;

    const grants = [
      { label: "ES-1", status: "outstanding", quantity: 100_000n, exercised: 20_000n },
      { label: "ES-2", status: "outstanding", quantity: 50_000n, canceled: 5_000n },
      { label: "ES-3", status: "canceled", quantity: 30_000n, canceled: 30_000n },
      { label: "ES-4", status: "exercised", quantity: 10_000n, exercised: 10_000n },
    ];
    for (const grant of grants) {
      await owner.equityOptionGrant.create({
        data: {
          ...scope,
          label: grant.label,
          stakeholderId: stakeholder.id,
          planId,
          shareClassId,
          status: grant.status,
          optionType: "iso",
          quantity: grant.quantity,
          exercisedQuantity: grant.exercised ?? 0n,
          canceledQuantity: grant.canceled ?? 0n,
          exercisePrice: "0.1",
          grantDate: new Date("2024-01-01T00:00:00.000Z"),
        },
      });
    }
    // An exercise certificate (no planId: it counts through the grant's exercised quantity), and
    // an RSA certificate issued under the plan outside any exercise.
    const exerciseCertificate = await owner.equityCertificate.create({
      data: {
        ...scope,
        label: "C-1",
        stakeholderId: stakeholder.id,
        shareClassId,
        planId,
        quantity: 20_000n,
        issueDate: new Date("2024-06-01T00:00:00.000Z"),
      },
    });
    await owner.equityCertificate.create({
      data: {
        ...scope,
        label: "C-2",
        stakeholderId: stakeholder.id,
        shareClassId,
        planId,
        quantity: 10_000n,
        issueDate: new Date("2024-02-01T00:00:00.000Z"),
      },
    });
    const grant = await owner.equityOptionGrant.findFirstOrThrow({
      where: { spaceId: scope.spaceId, userId: scope.userId, label: "ES-1" },
    });
    await owner.equityExercise.create({
      data: {
        ...scope,
        optionGrantId: grant.id,
        quantity: 20_000n,
        exerciseDate: new Date("2024-06-01T00:00:00.000Z"),
        status: "completed",
        certificateId: exerciseCertificate.id,
      },
    });
  });
  afterEach(async () => {
    await f?.close();
  });

  it("derives the pool from grants, exercises, cancellations and issued certificates", async () => {
    const { prisma, mine } = f;
    const pool = await f.as(mine, () => getEquityPlanPool(prisma, mine, { planId }));
    expect(() => EquityPlanPoolSchema.parse(pool)).not.toThrow();
    expect(pool.planId).toBe(planId);
    expect(pool.name).toBe("2024 Stock Plan");
    expect(pool.reservedShares).toBe("1000000");
    expect(pool.grantedShares).toBe("190000");
    expect(pool.exercisedShares).toBe("30000");
    expect(pool.returnedShares).toBe("35000");
    expect(pool.outstandingShares).toBe("125000");
    expect(pool.issuedShares).toBe("10000");
    expect(pool.availableShares).toBe("835000");
    expect(pool.increases).toEqual([]);

    // The plan store derives the same availability from the same rows.
    const plan = await f.as(mine, () => getEquityPlan(prisma, mine, planId));
    expect(plan.availableShares).toBe(pool.availableShares);
    expect(plan.outstandingShares).toBe(pool.outstandingShares);

    const pools = await f.as(mine, () => listEquityPlanPools(prisma, mine));
    expect(pools.map((row) => row.name)).toEqual(["2024 Stock Plan", "2025 Stock Plan"]);
    for (const row of pools) expect(() => EquityPlanPoolSchema.parse(row)).not.toThrow();
    const other = pools.find((row) => row.planId === otherPlanId)!;
    expect(other.availableShares).toBe("200000");
    expect(other.grantedShares).toBe("0");
  });

  it("counts a plan-linked exercise only through its grant commitment", async () => {
    const { prisma, mine } = f;
    const [pool, plan] = await Promise.all([
      f.as(mine, () => getEquityPlanPool(prisma, mine, { planId })),
      f.as(mine, () => getEquityPlan(prisma, mine, planId)),
    ]);
    expect(plan.issuedShares).toBe(
      (BigInt(pool.exercisedShares) + BigInt(pool.issuedShares)).toString(),
    );
    expect(plan.availableShares).toBe(pool.availableShares);
  });

  it("reserves direct plan-linked certificates against option grants", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const createPool = async (name: string, prefix: string) => {
      const shareClass = await owner.equityShareClass.create({
        data: { ...scope, name, classType: "common", prefix },
      });
      await owner.equityShareClassVersion.create({
        data: {
          ...scope,
          shareClassId: shareClass.id,
          documentDate: new Date("2024-01-01T00:00:00.000Z"),
          authorizedShares: 1_000n,
        },
      });
      const plan = await owner.equityPlan.create({
        data: { ...scope, name, shareClassId: shareClass.id, reservedShares: 100n },
      });
      return { shareClassId: shareClass.id, planId: plan.id };
    };

    const directPool = await createPool("Direct allocation", "DA");
    await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: directPool.shareClassId,
        planId: directPool.planId,
        quantity: "100",
        issueDate: "2024-02-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        createEquityOptionGrant(prisma, mine, {
          stakeholderId,
          planId: directPool.planId,
          optionType: "iso",
          quantity: "1",
          exercisePrice: "0.1",
          grantDate: "2024-02-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("reserves option grants against direct plan-linked certificates", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Grant allocation", classType: "common", prefix: "GA" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: shareClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const plan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Grant allocation",
        shareClassId: shareClass.id,
        reservedShares: 100n,
      },
    });
    await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId: plan.id,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-02-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId,
          shareClassId: shareClass.id,
          planId: plan.id,
          quantity: "1",
          issueDate: "2024-02-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("validates direct plan-linked certificate edits against the remaining reserve", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const certificateClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Certificate edit class", classType: "common", prefix: "CEC" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: certificateClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const plan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Certificate edit reserve",
        shareClassId: certificateClass.id,
        reservedShares: 100n,
      },
    });
    const certificate = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: certificateClass.id,
        planId: plan.id,
        quantity: "80",
        issueDate: "2024-02-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        updateEquityCertificate(prisma, mine, { id: certificate.id, quantity: "101" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("validates unchanged-quantity direct certificate moves against the destination reserve", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const moveClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Certificate move class", classType: "common", prefix: "CMC" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: moveClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const source = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Certificate move source",
        shareClassId: moveClass.id,
        reservedShares: 100n,
      },
    });
    const destination = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Certificate move destination",
        shareClassId: moveClass.id,
        reservedShares: 49n,
      },
    });
    const certificate = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: moveClass.id,
        planId: source.id,
        quantity: "50",
        issueDate: "2024-02-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        updateEquityCertificate(prisma, mine, {
          id: certificate.id,
          planId: destination.id,
          quantity: "50",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("does not count multi-generation transfer descendants of an exercise certificate twice", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const lineageClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Exercise lineage", classType: "common", prefix: "EL" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: lineageClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const lineagePlan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Exercise lineage",
        shareClassId: lineageClass.id,
        reservedShares: 1_000n,
      },
    });
    const destinationPlan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Exercise lineage destination",
        shareClassId: lineageClass.id,
        reservedShares: 1_000n,
      },
    });
    const recipient = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Recipient" },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId: lineagePlan.id,
        optionType: "iso",
        quantity: "1000",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    const exercise = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "1000",
        exerciseDate: "2024-02-01",
        requestKey: randomUUID(),
      }),
    );
    const before = await f.as(mine, () =>
      getEquityPlanPool(prisma, mine, { planId: lineagePlan.id }),
    );
    const firstTransfer = await f.as(mine, () =>
      transferEquityCertificate(prisma, mine, {
        certificateId: exercise.certificate.id,
        toStakeholderId: recipient.id,
        quantity: "1000",
        effectiveDate: "2024-03-01",
        reason: "gift",
      }),
    );
    const child = firstTransfer.resulting[0]!;
    const secondTransfer = await f.as(mine, () =>
      transferEquityCertificate(prisma, mine, {
        certificateId: child.id,
        toStakeholderId: stakeholderId,
        quantity: "400",
        effectiveDate: "2024-04-01",
        reason: "gift",
      }),
    );
    const grandchild = secondTransfer.resulting[0]!;
    await expect(
      f.as(mine, () =>
        updateEquityCertificate(prisma, mine, {
          id: grandchild.id,
          planId: destinationPlan.id,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        updateEquityCertificate(prisma, mine, { id: grandchild.id, quantity: "401" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const after = await f.as(mine, () =>
      getEquityPlanPool(prisma, mine, { planId: lineagePlan.id }),
    );
    expect(after.exercisedShares).toBe(before.exercisedShares);
    expect(after.issuedShares).toBe(before.issuedShares);
    expect(after.availableShares).toBe(before.availableShares);
  });

  it("keeps a full-reserve plan exercise net-neutral", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Full reserve", classType: "common", prefix: "FR" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: shareClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 100n,
      },
    });
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "Full reserve", shareClassId: shareClass.id, reservedShares: 100n },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId: plan.id,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    const exercise = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "100",
        exerciseDate: "2024-02-01",
        requestKey: randomUUID(),
      }),
    );
    const exerciseAudit = await owner.equityTransaction.findFirstOrThrow({
      where: { ...scope, optionGrantId: grant.id, kind: "exercise" },
    });
    const pool = await f.as(mine, () => getEquityPlanPool(prisma, mine, { planId: plan.id }));
    expect(exerciseAudit.planId).toBe(plan.id);
    expect(exercise.certificate.planId).toBe(plan.id);
    expect(pool.outstandingShares).toBe("0");
    expect(pool.exercisedShares).toBe("100");
    expect(pool.issuedShares).toBe("0");
    expect(pool.availableShares).toBe("0");
  });

  it("counts a legacy null-plan exercise certificate through its grant", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const legacyClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Legacy exercise", classType: "common", prefix: "LE" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: legacyClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 100n,
      },
    });
    const plan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Legacy exercise",
        shareClassId: legacyClass.id,
        reservedShares: 100n,
      },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId: plan.id,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    const exercise = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "100",
        exerciseDate: "2024-02-01",
        requestKey: randomUUID(),
      }),
    );
    await owner.equityCertificate.update({
      where: { id: exercise.certificate.id },
      data: { planId: null },
    });
    const pool = await f.as(mine, () => getEquityPlanPool(prisma, mine, { planId: plan.id }));
    expect(pool.exercisedShares).toBe("100");
    expect(pool.issuedShares).toBe("0");
    expect(pool.availableShares).toBe("0");
  });

  it("does not reclassify a plan with any historical grant or certificate references", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const otherClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Preferred", classType: "preferred", prefix: "P" },
    });
    await expect(
      f.as(mine, () => updateEquityPlan(prisma, mine, { id: planId, shareClassId: otherClass.id })),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("keeps a plan's class immutable after grant and certificate moves", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const sourceClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Moved reference class", classType: "common", prefix: "MRC" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: sourceClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 10_000n,
      },
    });
    const source = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Moved reference source",
        shareClassId: sourceClass.id,
        reservedShares: 1_000n,
      },
    });
    const destination = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Moved reference destination",
        shareClassId: sourceClass.id,
        reservedShares: 1_000n,
      },
    });
    const targetClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Moved reference target", classType: "preferred", prefix: "MRT" },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId: source.id,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    const certificate = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: sourceClass.id,
        planId: source.id,
        quantity: "100",
        issueDate: "2024-02-01",
      }),
    );
    await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, { id: grant.id, planId: destination.id }),
    );
    await f.as(mine, () =>
      updateEquityCertificate(prisma, mine, { id: certificate.id, planId: destination.id }),
    );
    expect(await owner.equityOptionGrant.count({ where: { ...scope, planId: source.id } })).toBe(0);
    expect(await owner.equityCertificate.count({ where: { ...scope, planId: source.id } })).toBe(0);
    await expect(
      f.as(mine, () =>
        updateEquityPlan(prisma, mine, { id: source.id, shareClassId: targetClass.id }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("honors top-level plan references in narrow legal audits but ignores plan metadata", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const referenceClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Legacy audit reference class", classType: "common", prefix: "LAR" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: referenceClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 10_000n,
      },
    });
    const grantPlan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Legacy grant audit plan",
        shareClassId: referenceClass.id,
        reservedShares: 1_000n,
      },
    });
    const certificatePlan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Legacy certificate audit plan",
        shareClassId: referenceClass.id,
        reservedShares: 1_000n,
      },
    });
    const metadataPlan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Metadata audit plan",
        shareClassId: referenceClass.id,
        reservedShares: 1_000n,
      },
    });
    const destination = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Legacy audit destination",
        shareClassId: referenceClass.id,
        reservedShares: 1_000n,
      },
    });
    const targetClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Legacy audit target", classType: "preferred", prefix: "LAT" },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId: destination.id,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    const certificate = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: referenceClass.id,
        planId: destination.id,
        quantity: "100",
        issueDate: "2024-02-01",
      }),
    );
    const effectiveDate = new Date("2024-03-01T00:00:00.000Z");
    const recordNarrowAudit = (
      planId: string,
      reference: { optionGrantId: string } | { certificateId: string },
    ) =>
      owner.equityTransaction.create({
        data: {
          ...scope,
          ...reference,
          planId,
          kind: "modify",
          effectiveDate,
          before: { quantity: "100" },
          after: { quantity: "100" },
        },
      });
    await recordNarrowAudit(grantPlan.id, { optionGrantId: grant.id });
    await recordNarrowAudit(certificatePlan.id, { certificateId: certificate.id });
    await owner.equityTransaction.create({
      data: {
        ...scope,
        planId: metadataPlan.id,
        kind: "modify",
        effectiveDate,
        before: { planId: metadataPlan.id, name: "Before" },
        after: { planId: metadataPlan.id, name: "After" },
      },
    });
    await owner.equityTransaction.create({
      data: {
        ...scope,
        planId: metadataPlan.id,
        kind: "pool_change",
        effectiveDate,
        before: { planId: metadataPlan.id, reservedShares: "1000" },
        after: { planId: metadataPlan.id, reservedShares: "1000" },
      },
    });

    for (const id of [grantPlan.id, certificatePlan.id]) {
      await expect(
        f.as(mine, () => updateEquityPlan(prisma, mine, { id, shareClassId: targetClass.id })),
      ).rejects.toBeInstanceOf(EquityInputError);
    }
    await expect(
      f.as(mine, () =>
        updateEquityPlan(prisma, mine, { id: metadataPlan.id, shareClassId: targetClass.id }),
      ),
    ).resolves.toMatchObject({ shareClassId: targetClass.id });
  });

  it("does not reclassify a plan referenced by a retired certificate", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const sourceClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Retired source class", classType: "common", prefix: "RSC" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: sourceClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const targetClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Retired reference class", classType: "preferred", prefix: "RR" },
    });
    const plan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Retired reference plan",
        shareClassId: sourceClass.id,
        reservedShares: 100n,
      },
    });
    const certificate = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: sourceClass.id,
        planId: plan.id,
        quantity: "1",
        issueDate: "2024-02-01",
      }),
    );
    await owner.equityCertificate.update({
      where: { id: certificate.id },
      data: { status: "transferred" },
    });
    await expect(
      f.as(mine, () =>
        updateEquityPlan(prisma, mine, { id: plan.id, shareClassId: targetClass.id }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("keeps exercise-origin certificate plans and quantities immutable", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const lineageClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Immutable exercise class", classType: "common", prefix: "IE" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: lineageClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const plan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Immutable exercise plan",
        shareClassId: lineageClass.id,
        reservedShares: 1_000n,
      },
    });
    const destination = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Exercise destination",
        shareClassId: lineageClass.id,
        reservedShares: 1_000n,
      },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId: plan.id,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    const exercise = await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "100",
        exerciseDate: "2024-02-01",
        requestKey: randomUUID(),
      }),
    );
    await expect(
      f.as(mine, () =>
        updateEquityCertificate(prisma, mine, {
          id: exercise.certificate.id,
          planId: destination.id,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        updateEquityCertificate(prisma, mine, {
          id: exercise.certificate.id,
          quantity: "101",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("does not let plan-linked certificates convert into an unsupported share class", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const sourceClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Conversion source", classType: "common", prefix: "CVS" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: sourceClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const sourcePlan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Conversion source plan",
        shareClassId: sourceClass.id,
        reservedShares: 100n,
      },
    });
    const targetClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Unsupported conversion", classType: "preferred", prefix: "UC" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: targetClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const certificate = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: sourceClass.id,
        planId: sourcePlan.id,
        quantity: "1",
        issueDate: "2024-02-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        convertEquityCertificate(prisma, mine, {
          certificateId: certificate.id,
          toShareClassId: targetClass.id,
          ratio: "1",
          effectiveDate: "2024-03-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("does not accept client-supplied certificate parent provenance", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const sourceClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Raw provenance class", classType: "common", prefix: "RPC" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: sourceClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const parent = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: sourceClass.id,
        quantity: "1",
        issueDate: "2024-02-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        createEquityCertificate(prisma, mine, {
          stakeholderId,
          shareClassId: sourceClass.id,
          quantity: "1",
          issueDate: "2024-02-02",
          parentId: parent.id,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("fails closed when plan certificate ancestry contains a cycle", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const cycleClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Cycle class", classType: "common", prefix: "CY" },
    });
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: cycleClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000n,
      },
    });
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "Cycle guard", shareClassId: cycleClass.id, reservedShares: 100n },
    });
    const first = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: cycleClass.id,
        planId: plan.id,
        quantity: "1",
        issueDate: "2024-02-01",
      }),
    );
    const second = await f.as(mine, () =>
      createEquityCertificate(prisma, mine, {
        stakeholderId,
        shareClassId: cycleClass.id,
        planId: plan.id,
        quantity: "1",
        issueDate: "2024-02-01",
      }),
    );
    await owner.equityCertificate.update({
      where: { id: first.id },
      data: { parentId: second.id },
    });
    await owner.equityCertificate.update({
      where: { id: second.id },
      data: { parentId: first.id },
    });
    await expect(
      f.as(mine, () => getEquityPlanPool(prisma, mine, { planId: plan.id })),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("increases the pool and records the change", async () => {
    const { prisma, mine, owner } = f;
    const pool = await f.as(mine, () =>
      increaseEquityPlanPool(prisma, mine, {
        planId: otherPlanId,
        shares: "50000",
        effectiveDate: "2025-03-01",
        boardApprovedOn: "2025-02-20",
        note: "Board top-up",
      }),
    );
    expect(pool.reservedShares).toBe("250000");
    expect(pool.availableShares).toBe("250000");
    expect(pool.increases).toEqual([{ date: "2025-03-01", shares: "50000", note: "Board top-up" }]);
    const rows = await owner.equityTransaction.findMany({
      where: { spaceId: mine.spaceId, userId: mine.userId, planId: otherPlanId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "pool_change",
      quantity: 50_000n,
      note: "Board top-up",
      before: { reservedShares: "200000" },
      after: { reservedShares: "250000" },
    });
    const plan = await f.as(mine, () => getEquityPlan(prisma, mine, otherPlanId));
    expect(plan.availableShares).toBe(pool.availableShares);
    expect(plan.boardApprovedOn).toBe("2025-02-20");

    await expect(
      f.as(mine, () =>
        increaseEquityPlanPool(prisma, mine, {
          planId: otherPlanId,
          shares: "0",
          effectiveDate: "2025-03-02",
        }),
      ),
    ).rejects.toThrow();
    await expect(
      f.as(mine, () =>
        // @ts-expect-error the effective date is required
        increaseEquityPlanPool(prisma, mine, { planId: otherPlanId, shares: "1" }),
      ),
    ).rejects.toThrow();
  });

  it("pours shares over and refuses to overdraw the giving pool", async () => {
    const { prisma, mine, owner } = f;
    await f.as(mine, () =>
      increaseEquityPlanPool(prisma, mine, {
        planId: otherPlanId,
        shares: "50000",
        effectiveDate: "2025-03-01",
        boardApprovedOn: "2025-02-20",
        note: "Board top-up",
      }),
    );
    const result = await f.as(mine, () =>
      pourOverEquityPlan(prisma, mine, {
        fromPlanId: planId,
        toPlanId: otherPlanId,
        shares: "100000",
        effectiveDate: "2025-04-01",
      }),
    );
    expect(() => EquityPlanPourOverSchema.parse(result)).not.toThrow();
    expect(result.from.reservedShares).toBe("900000");
    expect(result.from.availableShares).toBe("735000");
    expect(result.to.reservedShares).toBe("350000");
    expect(result.to.availableShares).toBe("350000");
    expect(result.to.increases).toEqual([
      { date: "2025-03-01", shares: "50000", note: "Board top-up" },
      { date: "2025-04-01", shares: "100000", note: "Pour over from 2024 Stock Plan" },
    ]);
    expect(result.from.increases).toEqual([]);

    const rows = await owner.equityTransaction.findMany({
      where: { spaceId: mine.spaceId, userId: mine.userId, planId: { in: [planId, otherPlanId] } },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(3);
    const pourRows = rows.filter((row) => (row.note ?? "").startsWith("Pour over"));
    expect(pourRows).toHaveLength(2);
    expect(pourRows.every((row) => row.kind === "pool_change" && row.quantity === 100_000n)).toBe(
      true,
    );

    // Both stores agree after the move.
    const [fromPlan, toPlan] = await f.as(mine, () =>
      Promise.all([getEquityPlan(prisma, mine, planId), getEquityPlan(prisma, mine, otherPlanId)]),
    );
    expect(fromPlan.availableShares).toBe(result.from.availableShares);
    expect(toPlan.availableShares).toBe(result.to.availableShares);

    const before = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId },
    });
    await expect(
      f.as(mine, () =>
        pourOverEquityPlan(prisma, mine, {
          fromPlanId: planId,
          toPlanId: otherPlanId,
          shares: "800000",
          effectiveDate: "2025-04-02",
        }),
      ),
    ).rejects.toThrow(EquityInputError);
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId },
      }),
    ).toBe(before);
    await expect(
      f.as(mine, () =>
        pourOverEquityPlan(prisma, mine, {
          fromPlanId: planId,
          toPlanId: planId,
          shares: "1",
          effectiveDate: "2025-04-02",
        }),
      ),
    ).rejects.toThrow();
  });

  it("serializes competing pour-overs from the same reserve", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const makePlan = (name: string, reservedShares: bigint) =>
      owner.equityPlan.create({ data: { ...scope, name, shareClassId, reservedShares } });
    const source = await makePlan("Competing source", 100n);
    const first = await makePlan("Competing destination one", 0n);
    const second = await makePlan("Competing destination two", 0n);
    const synchronized = barrierAtEquityLedgerLock(prisma);
    const outcomes = await Promise.allSettled([
      f.as(mine, () =>
        pourOverEquityPlan(synchronized, mine, {
          fromPlanId: source.id,
          toPlanId: first.id,
          shares: "80",
          effectiveDate: "2025-06-01",
        }),
      ),
      f.as(mine, () =>
        pourOverEquityPlan(synchronized, mine, {
          fromPlanId: source.id,
          toPlanId: second.id,
          shares: "80",
          effectiveDate: "2025-06-01",
        }),
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(EquityInputError);
    const rows = await owner.equityPlan.findMany({
      where: { id: { in: [source.id, first.id, second.id] } },
      select: { id: true, reservedShares: true },
    });
    expect(rows.find((row) => row.id === source.id)?.reservedShares).toBe(20n);
    expect(
      rows.filter((row) => row.id !== source.id).reduce((sum, row) => sum + row.reservedShares, 0n),
    ).toBe(80n);
    expect(
      await owner.equityTransaction.count({
        where: { ...scope, planId: { in: [source.id, first.id, second.id] }, kind: "pool_change" },
      }),
    ).toBe(2);
  });

  it("keeps opposite-direction pour-over balances consistent with their audits", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const first = await owner.equityPlan.create({
      data: { ...scope, name: "Opposite source one", shareClassId, reservedShares: 100n },
    });
    const second = await owner.equityPlan.create({
      data: { ...scope, name: "Opposite source two", shareClassId, reservedShares: 100n },
    });
    const synchronized = barrierAtEquityLedgerLock(prisma);
    const outcomes = await Promise.allSettled([
      f.as(mine, () =>
        pourOverEquityPlan(synchronized, mine, {
          fromPlanId: first.id,
          toPlanId: second.id,
          shares: "80",
          effectiveDate: "2025-06-02",
        }),
      ),
      f.as(mine, () =>
        pourOverEquityPlan(synchronized, mine, {
          fromPlanId: second.id,
          toPlanId: first.id,
          shares: "80",
          effectiveDate: "2025-06-02",
        }),
      ),
    ]);
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    const audits = await owner.equityTransaction.findMany({
      where: { ...scope, planId: { in: [first.id, second.id] }, kind: "pool_change" },
      select: { planId: true, before: true, after: true },
    });
    const expected = new Map([
      [first.id, 100n],
      [second.id, 100n],
    ]);
    for (const audit of audits) {
      const before = (audit.before as { reservedShares: string }).reservedShares;
      const after = (audit.after as { reservedShares: string }).reservedShares;
      expected.set(audit.planId!, expected.get(audit.planId!)! + BigInt(after) - BigInt(before));
    }
    const rows = await owner.equityPlan.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { id: true, reservedShares: true },
    });
    expect(audits).toHaveLength(4);
    expect(rows.every((row) => expected.get(row.id) === row.reservedShares)).toBe(true);
    expect(rows.every((row) => row.reservedShares === 100n)).toBe(true);
    expect(rows.reduce((sum, row) => sum + row.reservedShares, 0n)).toBe(200n);
  });

  it("serializes simultaneous pool increases without losing audited shares", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "Concurrent top-ups", shareClassId, reservedShares: 100n },
    });
    const synchronized = barrierAtEquityLedgerLock(prisma);
    await Promise.all([
      f.as(mine, () =>
        increaseEquityPlanPool(synchronized, mine, {
          planId: plan.id,
          shares: "60",
          effectiveDate: "2025-06-03",
        }),
      ),
      f.as(mine, () =>
        increaseEquityPlanPool(synchronized, mine, {
          planId: plan.id,
          shares: "60",
          effectiveDate: "2025-06-03",
        }),
      ),
    ]);
    const saved = await owner.equityPlan.findUniqueOrThrow({
      where: { id: plan.id },
      select: { reservedShares: true },
    });
    expect(saved.reservedShares).toBe(220n);
    const audits = await owner.equityTransaction.findMany({
      where: { ...scope, planId: plan.id, kind: "pool_change" },
      select: { before: true, after: true },
    });
    expect(audits).toHaveLength(2);
    expect(
      audits.reduce((sum, audit) => {
        const before = (audit.before as { reservedShares: string }).reservedShares;
        const after = (audit.after as { reservedShares: string }).reservedShares;
        return sum + BigInt(after) - BigInt(before);
      }, 0n),
    ).toBe(120n);
  });

  it("serializes reserved-pool edits against grant allocations", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "Pool versus grant", shareClassId, reservedShares: 200n },
    });
    const synchronized = barrierAtEquityLedgerLock(prisma);
    const outcomes = await Promise.allSettled([
      f.as(mine, () =>
        updateEquityPlan(synchronized, mine, { id: plan.id, reservedShares: "100" }),
      ),
      f.as(mine, () =>
        createEquityOptionGrant(synchronized, mine, {
          stakeholderId,
          planId: plan.id,
          optionType: "iso",
          quantity: "150",
          exercisePrice: "0.1",
          grantDate: "2024-02-01",
        }),
      ),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(EquityInputError);
    const saved = await owner.equityPlan.findUniqueOrThrow({
      where: { id: plan.id },
      select: { reservedShares: true },
    });
    const grants = await owner.equityOptionGrant.findMany({
      where: { ...scope, planId: plan.id },
      select: { quantity: true, exercisedQuantity: true, canceledQuantity: true, status: true },
    });
    const committed = grants.reduce(
      (sum, grant) =>
        sum +
        grant.exercisedQuantity +
        (grant.status === "outstanding"
          ? grant.quantity - grant.exercisedQuantity - grant.canceledQuantity
          : 0n),
      0n,
    );
    expect(saved.reservedShares).toBeGreaterThanOrEqual(committed);
    const audits = await owner.equityTransaction.findMany({
      where: { ...scope, planId: plan.id, kind: { in: ["pool_change", "issue"] } },
    });
    expect(audits).toHaveLength(
      outcomes.filter((outcome) => outcome.status === "fulfilled").length,
    );
  });

  it("reads plan pools from one repeatable-read snapshot", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "Snapshot plan", shareClassId, reservedShares: 100n },
    });
    const paused = pauseAfterPlanRead(prisma);
    const snapshot = f.as(mine, () => listEquityPlanPools(paused.prisma, mine));
    try {
      await paused.readComplete;
      await f.as(mine, () =>
        createEquityOptionGrant(prisma, mine, {
          stakeholderId,
          planId: plan.id,
          optionType: "iso",
          quantity: "100",
          exercisePrice: "0.1",
          grantDate: "2024-02-01",
        }),
      );
    } finally {
      paused.resume();
    }
    const pools = await snapshot;
    const pool = pools.find((candidate) => candidate.planId === plan.id)!;
    expect(pool.outstandingShares).toBe("0");
    expect(pool.availableShares).toBe("100");
  });

  it("keeps another user, another space and unknown ids out", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace])
      await expect(f.as(scope, () => getEquityPlanPool(prisma, scope, { planId }))).rejects.toThrow(
        IsolationError,
      );
    expect(await f.as(otherSpace, () => listEquityPlanPools(prisma, otherSpace))).toEqual([]);
    await expect(
      f.as(mine, () => getEquityPlanPool(prisma, mine, { planId: "nope" })),
    ).rejects.toThrow(IsolationError);
    await expect(
      f.as(sameSpace, () =>
        increaseEquityPlanPool(prisma, sameSpace, {
          planId,
          shares: "10",
          effectiveDate: "2025-05-01",
        }),
      ),
    ).rejects.toThrow(IsolationError);
    await expect(
      f.as(otherSpace, () =>
        pourOverEquityPlan(prisma, otherSpace, {
          fromPlanId: planId,
          toPlanId: otherPlanId,
          shares: "10",
          effectiveDate: "2025-05-01",
        }),
      ),
    ).rejects.toThrow(IsolationError);
  });

  it("does not return zero accounting for an unknown requested plan", async () => {
    const { prisma, mine } = f;
    await expect(
      f.as(mine, () => planAccountingById(prisma, mine, ["unknown-plan"])),
    ).rejects.toBeInstanceOf(IsolationError);
  });
});
