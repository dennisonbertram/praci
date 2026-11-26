import { EquityTerminationResultSchema } from "@rakazo/contracts";
import { afterAll, beforeAll, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError } from "./ledger.js";
import {
  expireEquityOptionGrants,
  previewEquityTermination,
  reverseEquityTermination,
  setEquityPostTerminationPeriod,
  terminateEquityStakeholder,
} from "./options-termination.js";
import { terminateEquityStakeholders } from "./stakeholders-actions.js";
import type { EquityFixture } from "./test-fixture.js";
import { barrierAtFirstRead, describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("option holder termination (PostgreSQL)", () => {
  let f: EquityFixture;
  let stakeholderId: string;
  let grantId: string;
  let otherGrantId: string;

  beforeAll(async () => {
    f = await equityFixture("options-termination");
    const { owner, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    await owner.equityLedger.create({ data: scope });
    const holder = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Ada Example" },
    });
    stakeholderId = holder.id;
    const other = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Bo Example" },
    });
    const shareClass = await owner.equityShareClass.create({
      data: { ...scope, name: "Common", classType: "common", prefix: "CS" },
    });
    const plan = await owner.equityPlan.create({
      data: { ...scope, name: "2024 Plan", shareClassId: shareClass.id, reservedShares: 100_000n },
    });
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
      planId: plan.id,
      shareClassId: shareClass.id,
      optionType: "iso",
      quantity: 48_000n,
      exercisePrice: "0.1",
      grantDate: new Date("2024-01-01T00:00:00.000Z"),
    };
    grantId = (
      await owner.equityOptionGrant.create({
        data: { ...base, label: "ES-1", stakeholderId, vestingScheduleId: schedule.id },
      })
    ).id;
    otherGrantId = (
      await owner.equityOptionGrant.create({
        data: {
          ...base,
          label: "ES-2",
          stakeholderId: other.id,
          expirationDate: new Date("2025-01-01T00:00:00.000Z"),
        },
      })
    ).id;
  });

  afterAll(async () => {
    await f?.close();
  });

  it("forfeits the unvested part and sets the exercise deadline", async () => {
    const { prisma, mine, owner } = f;
    const preview = await f.as(mine, () =>
      previewEquityTermination(prisma, mine, { stakeholderId, terminatedOn: "2025-07-01" }),
    );
    expect(preview.grants[0]?.forfeitedQuantity).toBe("30000");
    const untouched = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id: grantId } });
    expect(untouched.canceledQuantity).toBe(0n);
    const result = await f.as(mine, () =>
      terminateEquityStakeholder(prisma, mine, { stakeholderId, terminatedOn: "2025-07-01" }),
    );
    EquityTerminationResultSchema.parse(result);
    expect(result.grants).toEqual([
      {
        optionGrantId: grantId,
        label: "ES-1",
        forfeitedQuantity: "30000",
        exerciseDeadline: "2025-10-01",
      },
    ]);
    const grant = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id: grantId } });
    expect(grant.canceledQuantity).toBe(30_000n);
    expect(grant.status).toBe("outstanding");
    await expect(
      f.as(mine, () =>
        terminateEquityStakeholder(prisma, mine, { stakeholderId, terminatedOn: "2025-08-01" }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });

  it("terminating from the Stakeholders tab also terminates the grants", async () => {
    const { prisma, mine, owner } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const grant = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id: grantId } });
    const holder = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: "Cy Example", relationship: "employee" },
    });
    const schedule = await owner.equityVestingSchedule.create({
      data: {
        ...scope,
        startDate: new Date("2024-01-01T00:00:00.000Z"),
        totalMonths: 48,
        cliffMonths: 12,
        frequencyMonths: 1,
      },
    });
    const id = (
      await owner.equityOptionGrant.create({
        data: {
          ...scope,
          planId: grant.planId,
          shareClassId: grant.shareClassId,
          optionType: "iso",
          quantity: 48_000n,
          exercisePrice: "0.1",
          grantDate: new Date("2024-01-01T00:00:00.000Z"),
          label: "ES-3",
          stakeholderId: holder.id,
          vestingScheduleId: schedule.id,
        },
      })
    ).id;
    await f.as(mine, () =>
      terminateEquityStakeholders(prisma, mine, {
        ids: [holder.id],
        terminationDate: "2025-07-01",
      }),
    );
    const after = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id } });
    expect(after.canceledQuantity).toBe(30_000n);
    expect(after.expirationDate?.toISOString().slice(0, 10)).toBe("2025-10-01");
    const stopped = await owner.equityVestingSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
    });
    expect(stopped.stoppedOn?.toISOString().slice(0, 10)).toBe("2025-07-01");
    await f.as(mine, () => reverseEquityTermination(prisma, mine, { stakeholderId: holder.id }));
    const restored = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id } });
    expect(restored.canceledQuantity).toBe(0n);
  });

  it("moves the deadline with the post-termination period, then reverses", async () => {
    const { prisma, mine, owner } = f;
    const grant = await f.as(mine, () =>
      setEquityPostTerminationPeriod(prisma, mine, {
        optionGrantId: grantId,
        postTerminationExerciseMonths: 12,
      }),
    );
    expect(grant.expirationDate).toBe("2026-07-01");
    await f.as(mine, () => reverseEquityTermination(prisma, mine, { stakeholderId }));
    const after = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id: grantId } });
    expect(after.canceledQuantity).toBe(0n);
    const holder = await owner.equityStakeholder.findUniqueOrThrow({
      where: { id: stakeholderId },
    });
    expect(holder.terminatedAt).toBeNull();
  });

  it("expires grants past their expiration", async () => {
    const { prisma, mine, owner } = f;
    const { expired } = await f.as(mine, () =>
      expireEquityOptionGrants(prisma, mine, { asOf: "2025-06-01" }),
    );
    expect(expired).toBe(1);
    const grant = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id: otherGrantId } });
    expect(grant.status).toBe("expired");
    expect(grant.canceledQuantity).toBe(48_000n);
  });

  const freshGrant = async (label: string, expires: string | null, vesting: boolean) => {
    const { owner, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const holder = await owner.equityStakeholder.create({
      data: { ...scope, type: "individual", name: `${label} Holder` },
    });
    const [plan, shareClass] = await Promise.all([
      owner.equityPlan.findFirstOrThrow({ where: scope }),
      owner.equityShareClass.findFirstOrThrow({ where: scope }),
    ]);
    const schedule = vesting
      ? await owner.equityVestingSchedule.create({
          data: {
            ...scope,
            startDate: new Date("2024-01-01T00:00:00.000Z"),
            totalMonths: 48,
            cliffMonths: 12,
            frequencyMonths: 1,
          },
        })
      : null;
    const grant = await owner.equityOptionGrant.create({
      data: {
        ...scope,
        label,
        stakeholderId: holder.id,
        planId: plan.id,
        shareClassId: shareClass.id,
        optionType: "iso",
        quantity: 48_000n,
        exercisePrice: "0.1",
        grantDate: new Date("2024-01-01T00:00:00.000Z"),
        vestingScheduleId: schedule?.id,
        expirationDate: expires ? new Date(`${expires}T00:00:00.000Z`) : null,
      },
    });
    return { holderId: holder.id, grantId: grant.id };
  };

  it("expires a grant once when two expiries run at the same time", async () => {
    const { prisma, mine, owner } = f;
    const { grantId: id } = await freshGrant("ES-EXP", "2020-01-01", false);
    const racing = barrierAtFirstRead(prisma, owner, "equityOptionGrant");
    await Promise.all([
      f.as(mine, () => expireEquityOptionGrants(racing, mine, { asOf: "2030-01-01" })),
      f.as(mine, () => expireEquityOptionGrants(racing, mine, { asOf: "2030-01-01" })),
    ]);
    const rows = await owner.equityTransaction.findMany({
      where: { optionGrantId: id, kind: "cancel", note: "expired" },
    });
    expect(rows).toHaveLength(1);
    expect(
      (await owner.equityOptionGrant.findUniqueOrThrow({ where: { id } })).canceledQuantity,
    ).toBe(48_000n);
  });

  it("terminates a holder once when two terminations run at the same time", async () => {
    const { prisma, mine, owner } = f;
    const { holderId, grantId: id } = await freshGrant("ES-RACE", null, true);
    const racing = barrierAtFirstRead(prisma, owner, "equityStakeholder");
    const results = await Promise.allSettled([
      f.as(mine, () =>
        terminateEquityStakeholder(racing, mine, {
          stakeholderId: holderId,
          terminatedOn: "2025-02-01",
        }),
      ),
      f.as(mine, () =>
        terminateEquityStakeholder(racing, mine, {
          stakeholderId: holderId,
          terminatedOn: "2025-02-01",
        }),
      ),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rows = await owner.equityTransaction.findMany({
      where: { optionGrantId: id, kind: "cancel", note: "termination" },
    });
    expect(rows).toHaveLength(1);
  });

  it("restores exactly the forfeited quantity after terminate, reverse, terminate, reverse", async () => {
    const { prisma, mine, owner } = f;
    const { holderId, grantId: id } = await freshGrant("ES-LOOP", null, true);
    const run = (fn: () => Promise<unknown>) => f.as(mine, fn);
    const terminate = () =>
      terminateEquityStakeholder(prisma, mine, {
        stakeholderId: holderId,
        terminatedOn: "2025-02-01",
      });
    const reverse = () => reverseEquityTermination(prisma, mine, { stakeholderId: holderId });
    await run(terminate);
    const forfeited = (await owner.equityOptionGrant.findUniqueOrThrow({ where: { id } }))
      .canceledQuantity;
    expect(forfeited).toBeGreaterThan(0n);
    await run(reverse);
    await run(terminate);
    expect(
      (await owner.equityOptionGrant.findUniqueOrThrow({ where: { id } })).canceledQuantity,
    ).toBe(forfeited);
    await run(reverse);
    const grant = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id } });
    expect(grant.canceledQuantity).toBe(0n);
    expect(grant.status).toBe("outstanding");
  });

  it("restores the right quantity when the holder is terminated on a different date each time", async () => {
    const { prisma, mine, owner } = f;
    const { holderId, grantId: id } = await freshGrant("ES-DATES", null, true);
    const terminate = (terminatedOn: string) =>
      f.as(mine, () =>
        terminateEquityStakeholder(prisma, mine, { stakeholderId: holderId, terminatedOn }),
      );
    const reverse = () =>
      f.as(mine, () => reverseEquityTermination(prisma, mine, { stakeholderId: holderId }));
    const canceled = async () =>
      (await owner.equityOptionGrant.findUniqueOrThrow({ where: { id } })).canceledQuantity;
    await terminate("2025-02-01");
    const first = await canceled();
    await reverse();
    expect(await canceled()).toBe(0n);
    await terminate("2025-08-01");
    const second = await canceled();
    expect(second).toBeLessThan(first);
    await reverse();
    expect(await canceled()).toBe(0n);
    // Terminated and reversed twice: still one reversal row per forfeit, none for older ones.
    const reversals = await owner.equityTransaction.findMany({
      where: { optionGrantId: id, kind: "reverse_cancellation" },
      select: { quantity: true },
      orderBy: { createdAt: "asc" },
    });
    expect(reversals.map((row) => row.quantity)).toEqual([first, second]);
  });

  it("leaves a grant alone when its earlier termination was already reversed", async () => {
    const { prisma, mine, owner } = f;
    const { holderId, grantId: id } = await freshGrant("ES-OLD", "2030-06-30", true);
    const terminate = () =>
      f.as(mine, () =>
        terminateEquityStakeholder(prisma, mine, {
          stakeholderId: holderId,
          terminatedOn: "2025-02-01",
        }),
      );
    const reverse = () =>
      f.as(mine, () => reverseEquityTermination(prisma, mine, { stakeholderId: holderId }));
    await terminate();
    await reverse();
    // The grant later expires on its own, with a new date; the next termination skips it.
    await owner.equityOptionGrant.update({
      where: { id },
      data: {
        status: "expired",
        canceledQuantity: 48_000n,
        expirationDate: new Date("2031-01-01T00:00:00.000Z"),
      },
    });
    await terminate();
    await reverse();
    const grant = await owner.equityOptionGrant.findUniqueOrThrow({ where: { id } });
    expect(grant.status).toBe("expired");
    expect(grant.canceledQuantity).toBe(48_000n);
    expect(grant.expirationDate?.toISOString().slice(0, 10)).toBe("2031-01-01");
  });

  it("keeps another user and another space out", async () => {
    const { prisma, sameSpace, otherSpace } = f;
    for (const scope of [sameSpace, otherSpace]) {
      await expect(
        f.as(scope, () =>
          terminateEquityStakeholder(prisma, scope, { stakeholderId, terminatedOn: "2025-07-01" }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
      await expect(
        f.as(scope, () =>
          setEquityPostTerminationPeriod(prisma, scope, {
            optionGrantId: grantId,
            postTerminationExerciseMonths: 1,
          }),
        ),
      ).rejects.toBeInstanceOf(IsolationError);
    }
  });
});
