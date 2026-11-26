import { randomUUID } from "node:crypto";
import { EquityOptionGrantSchema } from "@rakazo/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError } from "./ledger.js";
import {
  cancelEquityOptionGrant,
  cancelPendingEquityExercises,
  reverseEquityOptionCancellation,
} from "./options-cancel.js";
import { getEquityPlanPool } from "./options-plans.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("option grant cancellation (PostgreSQL)", () => {
  let f: EquityFixture;
  let planId: string;
  const grantIds: string[] = [];

  beforeEach(async () => {
    grantIds.length = 0;
    f = await equityFixture("options-cancel");
    const { owner, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    await owner.equityLedger.create({ data: scope });
    const stakeholder = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Ada Example" },
    });
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common", classType: "common", prefix: "C" },
    });
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "2024 Plan", shareClassId: shareClass.id, reservedShares: 100_000n },
    });
    planId = plan.id;
    for (const label of ["ES-1", "ES-2"]) {
      const grant = await owner.equityOptionGrant.create({
        data: {
          ...scope,
          label,
          stakeholderId: stakeholder.id,
          planId,
          shareClassId: shareClass.id,
          optionType: "iso",
          quantity: 40_000n,
          exercisePrice: "0.1",
          grantDate: new Date("2024-01-01T00:00:00.000Z"),
        },
      });
      grantIds.push(grant.id);
    }
    await owner.equityExercise.create({
      data: {
        ...scope,
        optionGrantId: grantIds[1]!,
        quantity: 1_000n,
        exerciseDate: new Date("2024-06-01T00:00:00.000Z"),
      },
    });
  });

  afterEach(async () => {
    await f?.close();
  });

  it("partially cancels, returns shares to the pool, and refuses an over-cancel", async () => {
    const { prisma, mine } = f;
    const grant = await f.as(mine, () =>
      cancelEquityOptionGrant(prisma, mine, {
        id: grantIds[0]!,
        quantity: "10000",
        canceledOn: "2025-01-01",
      }),
    );
    EquityOptionGrantSchema.parse(grant);
    expect(grant.status).toBe("outstanding");
    expect(grant.canceledQuantity).toBe("10000");
    expect(grant.outstandingQuantity).toBe("30000");
    const pool = await f.as(mine, () => getEquityPlanPool(prisma, mine, { planId }));
    expect(pool.availableShares).toBe("30000");
    await expect(
      f.as(mine, () =>
        cancelEquityOptionGrant(prisma, mine, {
          id: grantIds[0]!,
          quantity: "30001",
          canceledOn: "2025-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("rejects a partial grant cancellation that overlaps pending exercise reservations", async () => {
    const { prisma, mine, owner } = f;
    const pending = await owner.equityExercise.findFirstOrThrow({
      where: { optionGrantId: grantIds[1]!, status: "pending" },
    });
    await expect(
      f.as(mine, () =>
        cancelEquityOptionGrant(prisma, mine, {
          id: grantIds[1]!,
          quantity: "39001",
          canceledOn: "2025-01-15",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    expect(
      await owner.equityExercise.findUniqueOrThrow({
        where: { id: pending.id },
        select: { status: true },
      }),
    ).toEqual({ status: "pending" });
    expect(
      await owner.equityOptionGrant.findUniqueOrThrow({
        where: { id: grantIds[1]! },
        select: { canceledQuantity: true },
      }),
    ).toEqual({ canceledQuantity: 0n });
  });

  it("audits bulk pending cancellation through the exercise cancellation path", async () => {
    const { prisma, mine, owner } = f;
    const pending = await owner.equityExercise.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grantIds[0]!,
        quantity: 1_000n,
        exerciseDate: new Date("2024-06-01T00:00:00.000Z"),
        requestKey: randomUUID(),
      },
    });
    const beforeCount = await owner.equityTransaction.count({
      where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grantIds[0]! },
    });
    await f.as(mine, () => cancelPendingEquityExercises(prisma, mine, { id: grantIds[0]! }));
    const audit = await owner.equityTransaction.findFirstOrThrow({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grantIds[0]!,
        kind: "modify",
        reason: "pending exercise canceled",
      },
    });
    expect(audit.before).toMatchObject({ exercise: { id: pending.id, status: "pending" } });
    expect(audit.after).toMatchObject({ exercise: { id: pending.id, status: "canceled" } });
    expect(
      await owner.equityTransaction.count({
        where: { spaceId: mine.spaceId, userId: mine.userId, optionGrantId: grantIds[0]! },
      }),
    ).toBe(beforeCount + 1);
  });

  it("fully cancels, cancels pending exercises, and reverses", async () => {
    const { prisma, mine, owner } = f;
    await expect(
      f.as(mine, () =>
        cancelEquityOptionGrant(prisma, mine, { id: grantIds[1]!, canceledOn: "2025-02-01" }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await f.as(mine, () => cancelPendingEquityExercises(prisma, mine, { id: grantIds[1]! }));
    const canceled = await f.as(mine, () =>
      cancelEquityOptionGrant(prisma, mine, { id: grantIds[1]!, canceledOn: "2025-02-01" }),
    );
    expect(canceled.status).toBe("canceled");
    expect(canceled.canceledQuantity).toBe("40000");
    const exercise = await owner.equityExercise.findFirst({
      where: { optionGrantId: grantIds[1]! },
    });
    expect(exercise?.status).toBe("canceled");
    const pendingAudit = await owner.equityTransaction.findFirstOrThrow({
      where: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        optionGrantId: grantIds[1]!,
        kind: "modify",
        reason: "pending exercise canceled",
      },
    });
    expect(pendingAudit.before).toMatchObject({
      exercise: { id: exercise?.id, status: "pending" },
    });
    expect(pendingAudit.after).toMatchObject({
      exercise: { id: exercise?.id, status: "canceled" },
    });
    await expect(
      f.as(mine, () =>
        cancelEquityOptionGrant(prisma, mine, { id: grantIds[1]!, canceledOn: "2025-02-01" }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    const reversed = await f.as(mine, () =>
      reverseEquityOptionCancellation(prisma, mine, { id: grantIds[1]! }),
    );
    expect(reversed.status).toBe("outstanding");
    expect(reversed.canceledQuantity).toBe("0");
    const kinds = await owner.equityTransaction.findMany({
      where: { optionGrantId: { in: grantIds } },
      orderBy: { createdAt: "asc" },
      select: { kind: true, quantity: true },
    });
    expect(kinds.map((row) => row.kind).filter((kind) => kind !== "modify")).toEqual([
      "cancel",
      "reverse_cancellation",
    ]);
    expect(kinds.find((row) => row.kind === "reverse_cancellation")?.quantity).toBe(40_000n);
  });

  it("refuses a reversal the pool cannot cover", async () => {
    const { prisma, mine, owner } = f;
    await f.as(mine, () =>
      cancelEquityOptionGrant(prisma, mine, {
        id: grantIds[0]!,
        quantity: "10000",
        canceledOn: "2025-01-01",
      }),
    );
    await owner.equityPlan.update({ where: { id: planId }, data: { reservedShares: 75_000n } });
    // Pool: 75,000 reserved, 70,000 outstanding; reversing ES-1's 10,000 would overdraw it.
    await expect(
      f.as(mine, () => reverseEquityOptionCancellation(prisma, mine, { id: grantIds[0]! })),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("keeps another user and another space out", async () => {
    const { prisma, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace]) {
      await expect(
        f.as(scope, () =>
          cancelEquityOptionGrant(prisma, scope, { id: grantIds[0]!, canceledOn: "2025-03-01" }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () => reverseEquityOptionCancellation(prisma, scope, { id: grantIds[0]! })),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () => cancelPendingEquityExercises(prisma, scope, { id: grantIds[0]! })),
      ).rejects.toBeInstanceOf(IsolationError);
    }
  });
});
