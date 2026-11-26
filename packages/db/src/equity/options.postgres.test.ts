import { randomUUID } from "node:crypto";
import {
  EquityExerciseSchema,
  EquityOptionGrantSchema,
  EquityVestingTemplateSchema,
} from "@rakazo/contracts";
import { afterEach, beforeEach, expect, it } from "vitest";
import { IsolationError } from "../scope.js";
import { EquityConflictError, EquityInputError } from "./ledger.js";
import {
  createEquityExercise,
  createEquityOptionGrant,
  createEquityVestingTemplate,
  getEquityExercise,
  getEquityOptionGrant,
  listEquityExercises,
  listEquityOptionGrants,
  listEquityVestingTemplates,
  updateEquityExercise,
  updateEquityOptionGrant,
  updateEquityVestingTemplate,
} from "./options.js";
import { cancelEquityOptionGrant } from "./options-cancel.js";
import { exerciseEquityOptions } from "./options-exercise.js";
import type { EquityFixture } from "./test-fixture.js";
import { describeEquityPostgres, equityFixture } from "./test-fixture.js";

describeEquityPostgres("equity options (PostgreSQL)", () => {
  let f: EquityFixture;
  let stakeholderId: string;
  let planId: string;

  beforeEach(async () => {
    f = await equityFixture("options");
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
    await owner.equityShareClassVersion.create({
      data: {
        ...scope,
        shareClassId: shareClass.id,
        documentDate: new Date("2024-01-01T00:00:00.000Z"),
        authorizedShares: 1_000_000n,
      },
    });
    const plan = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "2024 Stock Plan",
        shareClassId: shareClass.id,
        reservedShares: 1_000_000n,
      },
    });
    planId = plan.id;
  });
  afterEach(async () => {
    await f?.close();
  });

  it("manages vesting templates", async () => {
    const { prisma, mine } = f;
    const template = await f.as(mine, () =>
      createEquityVestingTemplate(prisma, mine, {
        name: "Four year",
        totalMonths: 48,
        cliffMonths: 12,
        frequencyMonths: 1,
      }),
    );
    expect(EquityVestingTemplateSchema.parse(template)).toBeTruthy();
    await expect(
      f.as(mine, () =>
        createEquityVestingTemplate(prisma, mine, {
          name: "Four year",
          totalMonths: 48,
        }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
    await expect(
      f.as(mine, () =>
        createEquityVestingTemplate(prisma, mine, {
          name: "Bad",
          totalMonths: 12,
          tranches: [
            { monthOffset: 6, percent: "50" },
            { monthOffset: 12, percent: "49.9" },
          ],
        }),
      ),
    ).rejects.toThrow(/sum to 100/);
    await expect(
      f.as(mine, () =>
        createEquityOptionGrant(prisma, mine, {
          stakeholderId,
          planId,
          optionType: "iso",
          quantity: "0",
          exercisePrice: "0.1",
          grantDate: "2024-01-01",
        }),
      ),
    ).rejects.toThrow();
    await expect(
      f.as(mine, () =>
        createEquityOptionGrant(prisma, mine, {
          stakeholderId,
          planId,
          optionType: "iso",
          quantity: "1000",
          exercisePrice: "0.1",
          grantDate: "2024-01-01",
          vesting: { startDate: "2024-01-01", totalMonths: 12, cliffMonths: 24 },
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    const updated = await f.as(mine, () =>
      updateEquityVestingTemplate(prisma, mine, { id: template.id, frequencyMonths: 3 }),
    );
    expect(updated.frequencyMonths).toBe(3);
    const page = await f.as(mine, () =>
      listEquityVestingTemplates(prisma, mine, {
        sort: { field: "createdAt", dir: "desc" },
        search: "four",
      }),
    );
    expect(page.total).toBe(1);
  });

  it("creates, updates, lists and scopes option grants", async () => {
    const { prisma, mine, sameSpace, otherSpace } = f;
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "4800",
        exercisePrice: "1.25",
        grantDate: "2024-01-01",
        vesting: { startDate: "2024-01-01", totalMonths: 48, cliffMonths: 0, frequencyMonths: 1 },
      }),
    );
    expect(EquityOptionGrantSchema.parse(grant)).toBeTruthy();
    expect(grant.label).toBe("ES-1");
    expect(grant.shareClassId).toBeTruthy();
    expect(grant.outstandingQuantity).toBe("4800");
    expect(grant.vestingSchedule?.description).toBe("1/48 monthly");

    const preferred = await f.owner.equityShareClass.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        name: "Preferred",
        classType: "preferred",
        prefix: "P",
      },
    });
    await expect(
      f.as(mine, () =>
        createEquityOptionGrant(prisma, mine, {
          stakeholderId,
          planId,
          shareClassId: preferred.id,
          optionType: "iso",
          quantity: "1",
          exercisePrice: "1",
          grantDate: "2024-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    await expect(
      f.as(mine, () =>
        createEquityOptionGrant(prisma, mine, {
          stakeholderId,
          planId,
          optionType: "iso",
          quantity: "2000000",
          exercisePrice: "1",
          grantDate: "2024-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    await expect(
      f.as(mine, () =>
        createEquityOptionGrant(prisma, mine, {
          stakeholderId: "nope",
          planId,
          optionType: "iso",
          quantity: "1",
          exercisePrice: "1",
          grantDate: "2024-01-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    const updated = await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, { id: grant.id, quantity: "5000" }),
    );
    expect(updated.quantity).toBe("5000");
    const vested = await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, {
        id: grant.id,
        reason: "amendment",
        vesting: { startDate: "2024-01-01", totalMonths: 0 },
      }),
    );
    expect(vested.vestingSchedule?.description).toBe("Immediate");

    const page = await f.as(mine, () =>
      listEquityOptionGrants(prisma, mine, {
        sort: { field: "stakeholderName", dir: "asc" },
        status: ["outstanding"],
        planId: [planId],
        search: "ada",
        pageSize: 1,
      }),
    );
    expect(page.total).toBe(1);
    const sorted = await f.as(mine, () =>
      listEquityOptionGrants(prisma, mine, { sort: { field: "quantity", dir: "desc" } }),
    );
    expect(sorted.items[0]?.quantity).toBe("5000");

    await expect(
      f.as(otherSpace, () => getEquityOptionGrant(prisma, otherSpace, grant.id)),
    ).rejects.toBeInstanceOf(IsolationError);
    await expect(
      f.as(sameSpace, () => updateEquityOptionGrant(prisma, sameSpace, { id: grant.id })),
    ).rejects.toBeInstanceOf(IsolationError);
    await expect(
      f.as(otherSpace, () => listEquityOptionGrants(prisma, otherSpace, {})),
    ).resolves.toMatchObject({ total: 0 });

    const kinds = await f.owner.equityTransaction.findMany({
      where: { ...mine, optionGrantId: grant.id },
      orderBy: { createdAt: "asc" },
    });
    expect(kinds.map((row) => row.kind).sort()).toEqual([
      "issue",
      "modify",
      "modify",
      "vesting_change",
    ]);
    const fullGrantAudit = kinds.find(
      (row) =>
        row.kind === "modify" && (row.after as { quantity?: string } | null)?.quantity === "5000",
    )!;
    expect(fullGrantAudit.before).toMatchObject({ quantity: "4800", exercisePrice: "1.25" });
    expect(fullGrantAudit.after).toMatchObject({ quantity: "5000", exercisePrice: "1.25" });
  });

  it("records exercises and closes the grant", async () => {
    const { prisma, mine, sameSpace } = f;
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "nso",
        quantity: "100",
        exercisePrice: "0.5",
        grantDate: "2024-01-01",
        vesting: { startDate: "2024-01-01", totalMonths: 0 },
      }),
    );
    const exercise = await f.as(mine, () =>
      createEquityExercise(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "100",
        exerciseDate: "2024-06-01",
        paymentCents: "5000",
        requestKey: randomUUID(),
      }),
    );
    expect(EquityExerciseSchema.parse(exercise)).toBeTruthy();
    expect(exercise.optionGrantLabel).toBe(grant.label);
    await expect(
      f.as(mine, () =>
        createEquityExercise(prisma, mine, {
          optionGrantId: grant.id,
          quantity: "1",
          exerciseDate: "2024-06-02",
          requestKey: randomUUID(),
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);

    const done = await f.as(mine, () =>
      updateEquityExercise(prisma, mine, { id: exercise.id, status: "completed" }),
    );
    expect(done.status).toBe("completed");
    await expect(
      f.as(mine, () => updateEquityOptionGrant(prisma, mine, { id: grant.id, quantity: "50" })),
    ).rejects.toBeInstanceOf(EquityInputError);
    const after = await f.as(mine, () => getEquityOptionGrant(prisma, mine, grant.id));
    expect(after.status).toBe("exercised");
    expect(after.exercisedQuantity).toBe("100");
    expect(after.outstandingQuantity).toBe("0");
    await expect(
      f.as(mine, () => updateEquityExercise(prisma, mine, { id: exercise.id, status: "canceled" })),
    ).rejects.toBeInstanceOf(EquityConflictError);

    const page = await f.as(mine, () =>
      listEquityExercises(prisma, mine, {
        optionGrantId: grant.id,
        status: ["completed"],
        sort: { field: "exerciseDate", dir: "desc" },
      }),
    );
    expect(page.total).toBe(1);
    await expect(
      f.as(sameSpace, () => getEquityExercise(prisma, sameSpace, exercise.id)),
    ).rejects.toBeInstanceOf(IsolationError);

    const rows = await f.owner.equityTransaction.findMany({
      where: { ...mine, optionGrantId: grant.id, kind: "exercise" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.valueCents).toBe(5000n);
  });

  it("uses a valid template when total vesting months are omitted", async () => {
    const { prisma, mine } = f;
    const template = await f.as(mine, () =>
      createEquityVestingTemplate(prisma, mine, {
        name: "Template-backed schedule",
        totalMonths: 48,
        cliffMonths: 12,
      }),
    );
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "1000",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
        vesting: { templateId: template.id, startDate: "2024-01-01" },
      }),
    );
    expect(grant.vestingSchedule).toMatchObject({
      templateId: template.id,
      totalMonths: 48,
      cliffMonths: 12,
    });
    const withoutSchedule = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    expect(withoutSchedule.vestedQuantity).toBe(withoutSchedule.quantity);
  });

  it("checks unchanged grant quantities against the destination plan", async () => {
    const { owner, prisma, mine } = f;
    const plan = await owner.equityPlan.findFirstOrThrow({
      where: { id: planId },
      select: { shareClassId: true },
    });
    const destination = await owner.equityPlan.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        name: "Empty destination plan",
        shareClassId: plan.shareClassId,
        reservedShares: 0n,
      },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "1000",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        updateEquityOptionGrant(prisma, mine, { id: grant.id, planId: destination.id }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
  });

  it("validates destination capacity against the post-cancellation commitment", async () => {
    const { owner, prisma, mine } = f;
    const scope = { spaceId: mine.spaceId, userId: mine.userId };
    const destinationClass = await owner.equityPlan.findFirstOrThrow({
      where: { id: planId },
      select: { shareClassId: true },
    });
    const tooSmall = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Post-cancel destination small",
        shareClassId: destinationClass.shareClassId,
        reservedShares: 60n,
      },
    });
    const justEnough = await owner.equityPlan.create({
      data: {
        ...scope,
        name: "Post-cancel destination exact",
        shareClassId: destinationClass.shareClassId,
        reservedShares: 70n,
      },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    await f.as(mine, () =>
      cancelEquityOptionGrant(prisma, mine, {
        id: grant.id,
        quantity: "30",
        canceledOn: "2025-01-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        updateEquityOptionGrant(prisma, mine, {
          id: grant.id,
          planId: tooSmall.id,
          quantity: "100",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const moved = await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, {
        id: grant.id,
        planId: justEnough.id,
        quantity: "100",
      }),
    );
    expect(moved.planId).toBe(justEnough.id);
    expect(moved.outstandingQuantity).toBe("70");
    expect(moved.canceledQuantity).toBe("30");
  });

  it("does not reduce a grant below its canceled shares", async () => {
    const { prisma, mine } = f;
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "100",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    await f.as(mine, () =>
      cancelEquityOptionGrant(prisma, mine, {
        id: grant.id,
        quantity: "30",
        canceledOn: "2025-01-01",
      }),
    );
    await expect(
      f.as(mine, () => updateEquityOptionGrant(prisma, mine, { id: grant.id, quantity: "29" })),
    ).rejects.toBeInstanceOf(EquityInputError);
    const after = await f.as(mine, () => getEquityOptionGrant(prisma, mine, grant.id));
    expect(after.quantity).toBe("100");
    expect(after.canceledQuantity).toBe("30");
  });

  it("rejects grant creation that forges terminal lifecycle state", async () => {
    const { prisma, mine } = f;
    const before = await f.owner.equityOptionGrant.count({ where: { ...mine } });
    for (const lifecycle of [
      { status: "canceled" as const },
      { status: "exercised" as const },
      { canceledOn: "2024-02-01" },
    ]) {
      await expect(
        f.as(mine, () =>
          createEquityOptionGrant(prisma, mine, {
            stakeholderId,
            planId,
            optionType: "iso",
            quantity: "100",
            exercisePrice: "0.1",
            grantDate: "2024-01-01",
            ...lifecycle,
          }),
        ),
      ).rejects.toBeInstanceOf(EquityInputError);
    }
    expect(await f.owner.equityOptionGrant.count({ where: { ...mine } })).toBe(before);
  });

  it("audits full grant snapshots with combined plan, terms and vesting changes", async () => {
    const { owner, prisma, mine } = f;
    const shareClass = await owner.equityPlan.findUniqueOrThrow({
      where: { id: planId },
      select: { shareClassId: true },
    });
    const destination = await owner.equityPlan.create({
      data: {
        ...mine,
        name: "Combined grant edit",
        shareClassId: shareClass.shareClassId,
        reservedShares: 10_000n,
      },
    });
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "1000",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, {
        id: grant.id,
        planId: destination.id,
        quantity: "1200",
        exercisePrice: "0.2",
        reason: "amendment",
        vesting: { startDate: "2024-01-01", totalMonths: 48 },
      }),
    );
    const audits = await owner.equityTransaction.findMany({
      where: { ...mine, optionGrantId: grant.id, kind: { in: ["modify", "vesting_change"] } },
    });
    const modify = audits.find((audit) => audit.kind === "modify")!;
    const vesting = audits.find((audit) => audit.kind === "vesting_change")!;
    expect(modify.before).toMatchObject({ planId, quantity: "1000", exercisePrice: "0.1" });
    expect(modify.after).toMatchObject({
      planId: destination.id,
      quantity: "1200",
      exercisePrice: "0.2",
      vestingSchedule: { totalMonths: 48 },
    });
    expect(vesting.before).toBeNull();
    expect(vesting.after).toMatchObject({ totalMonths: 48 });
    expect(audits).toHaveLength(2);
  });

  it("does not allow generic updates to forge grant cancellation state", async () => {
    const { prisma, mine } = f;
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "1000",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    await expect(
      f.as(mine, () =>
        updateEquityOptionGrant(prisma, mine, {
          id: grant.id,
          status: "canceled",
          canceledOn: "2024-02-01",
        }),
      ),
    ).rejects.toBeInstanceOf(EquityInputError);
    const unchanged = await f.as(mine, () =>
      updateEquityOptionGrant(prisma, mine, { id: grant.id, status: "outstanding" }),
    );
    expect(unchanged.status).toBe("outstanding");
  });

  it("does not move a grant after any shares have been exercised", async () => {
    const { owner, prisma, mine } = f;
    const grant = await f.as(mine, () =>
      createEquityOptionGrant(prisma, mine, {
        stakeholderId,
        planId,
        optionType: "iso",
        quantity: "1000",
        exercisePrice: "0.1",
        grantDate: "2024-01-01",
      }),
    );
    await f.as(mine, () =>
      exerciseEquityOptions(prisma, mine, {
        optionGrantId: grant.id,
        quantity: "100",
        exerciseDate: "2024-02-01",
        requestKey: randomUUID(),
      }),
    );
    const shareClass = await owner.equityPlan.findFirstOrThrow({
      where: { id: planId },
      select: { shareClassId: true },
    });
    const destination = await owner.equityPlan.create({
      data: {
        spaceId: mine.spaceId,
        userId: mine.userId,
        name: "Post-exercise destination",
        shareClassId: shareClass.shareClassId,
        reservedShares: 1_000n,
      },
    });
    await expect(
      f.as(mine, () =>
        updateEquityOptionGrant(prisma, mine, { id: grant.id, planId: destination.id }),
      ),
    ).rejects.toBeInstanceOf(EquityConflictError);
  });
});
