import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, runAsSystem, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "../router.js";
import { createRouter } from "../router.js";

const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

type PlanPool = {
  planId: string;
  reservedShares: string;
  exercisedShares: string;
  availableShares: string;
  increases: { shares: string }[];
};
type Grant = {
  id: string;
  label: string;
  canceledQuantity: string;
  outstandingQuantity: string;
  earlyExercise: boolean;
};
type ActionArea = {
  optionActions: {
    exercise(i: Record<string, unknown>): Promise<{
      exercise: { id: string; status: string };
      certificate: { id: string; quantity: string };
    }>;
    cancel(i: Record<string, unknown>): Promise<Grant>;
    reverseCancellation(i: { id: string }): Promise<Grant>;
    terminate(i: Record<string, unknown>): Promise<{
      stakeholderId: string;
      terminatedOn: string | null;
      grants: { optionGrantId: string; label: string; forfeitedQuantity: string }[];
    }>;
  };
  planPools: {
    list(): Promise<PlanPool[]>;
    increase(i: Record<string, unknown>): Promise<PlanPool>;
    pourOver(i: Record<string, unknown>): Promise<{ from: PlanPool; to: PlanPool }>;
  };
};

describePostgres("equity option area (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `oarea-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userId = id("user");
  const otherUserId = id("other");
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  };
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  let stakeholderId = "";
  let shareClassId = "";
  let planId = "";
  let otherPlanId = "";
  let grantId = "";
  let otherGrantId = "";

  const api = (who: Actor = actor) =>
    createRouterClient(createRouter({ prisma: app.prisma, env: {} } as unknown as RouterDeps), {
      context: { actor: who } as never,
    }).equity as unknown as ActionArea;
  const as = <T>(fn: () => Promise<T>) =>
    runAsTenant({ spaceId: actor.spaceId, userId: actor.userId }, fn);

  beforeAll(() =>
    runAsSystem("options area api fixture", async () => {
      admin = createDb(ownerUrl as string);
      app = createDb(runtimeUrl as string);
      for (const user of [userId, otherUserId])
        await admin.prisma.user.create({
          data: { id: user, name: user, email: `${user}@example.test`, emailVerified: false },
        });
      await admin.prisma.organization.create({
        data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
      });
      await admin.prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: "S" } });
      await admin.prisma.equityLedger.create({ data: { spaceId, userId } });

      const shareClass = await as(() =>
        api().shareClasses.create({
          name: "Common",
          prefix: "CS",
          classType: "common",
          terms: { documentDate: "2024-01-01", authorizedShares: "2000000" },
        }),
      );
      shareClassId = (shareClass as { id: string }).id;
      const stakeholder = await as(() =>
        api().stakeholders.create({ type: "individual", name: "Ada Example" }),
      );
      stakeholderId = (stakeholder as { id: string }).id;
      const plan = await as(() =>
        api().plans.create({
          name: "2024 Plan",
          shareClassId,
          reservedShares: "1000000",
          boardApprovedOn: "2024-01-01",
        }),
      );
      planId = (plan as { id: string }).id;
      const otherPlan = await as(() =>
        api().plans.create({
          name: "2025 Plan",
          shareClassId,
          reservedShares: "1000",
          boardApprovedOn: "2024-01-01",
        }),
      );
      otherPlanId = (otherPlan as { id: string }).id;

      const grant = await as(() =>
        api().optionGrants.create({
          stakeholderId,
          planId,
          optionType: "iso",
          quantity: "10000",
          exercisePrice: "1",
          grantDate: "2024-01-01",
          earlyExercise: true,
        }),
      );
      grantId = (grant as { id: string }).id;

      // A grant in another user's ledger, used to prove isolation.
      const otherScope = { spaceId, userId: otherUserId };
      await admin.prisma.equityLedger.create({ data: otherScope });
      const otherStakeholder = await admin.prisma.equityStakeholder.create({
        data: { ...otherScope, type: "individual", name: "Grace Example" },
      });
      const otherClass = await admin.prisma.equityShareClass.create({
        data: { ...otherScope, name: "Other Common", prefix: "OC", classType: "common" },
      });
      const foreignPlan = await admin.prisma.equityPlan.create({
        data: {
          ...otherScope,
          name: "Other Plan",
          shareClassId: otherClass.id,
          reservedShares: 1000n,
        },
      });
      otherGrantId = (
        await admin.prisma.equityOptionGrant.create({
          data: {
            ...otherScope,
            stakeholderId: otherStakeholder.id,
            planId: foreignPlan.id,
            shareClassId: otherClass.id,
            label: "ES-99",
            optionType: "iso",
            quantity: 100n,
            exercisePrice: "1",
            grantDate: new Date("2024-01-01T00:00:00.000Z"),
            earlyExercise: true,
          },
        })
      ).id;
    }),
  );

  afterAll(() =>
    runAsSystem("options area api cleanup", async () => {
      await admin.prisma.equityLedger.deleteMany({ where: { spaceId } });
      await admin.prisma.organization.deleteMany({ where: { id: orgId } });
      await admin.prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
      await admin.prisma.$disconnect();
      await admin.pool.end();
      await app.prisma.$disconnect();
      await app.pool.end();
    }),
  );

  it("exercises early options, cancels and reverses, grows and pours over the pool", async () => {
    const exercised = await as(() =>
      api().optionActions.exercise({
        optionGrantId: grantId,
        quantity: "4000",
        exerciseDate: "2024-06-01",
        requestKey: randomUUID(),
      }),
    );
    expect(exercised.exercise.status).toBe("completed");
    expect(exercised.certificate.quantity).toBe("4000");

    const pools = await as(() => api().planPools.list());
    const pool = pools.find((row) => row.planId === planId);
    expect(pool?.exercisedShares).toBe("4000");
    expect(pool?.reservedShares).toBe("1000000");

    const canceled = await as(() =>
      api().optionActions.cancel({
        id: grantId,
        quantity: "2000",
        canceledOn: "2024-07-01",
      }),
    );
    expect(canceled.canceledQuantity).toBe("2000");
    const restored = await as(() => api().optionActions.reverseCancellation({ id: grantId }));
    expect(restored.canceledQuantity).toBe("0");
    expect(restored.outstandingQuantity).toBe("6000");

    const grown = await as(() =>
      api().planPools.increase({
        planId,
        shares: "5000",
        effectiveDate: "2024-08-01",
        note: "Board top-up",
      }),
    );
    expect(grown.reservedShares).toBe("1005000");
    expect(grown.increases.map((row) => row.shares)).toContain("5000");

    await expect(
      as(() =>
        api().planPools.pourOver({
          fromPlanId: planId,
          toPlanId: otherPlanId,
          shares: "2000000",
          effectiveDate: "2024-09-01",
        }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const terminated = await as(() =>
      api().optionActions.terminate({ stakeholderId, terminatedOn: "2024-10-01" }),
    );
    expect(terminated.stakeholderId).toBe(stakeholderId);
    expect(terminated.grants.map((row) => row.optionGrantId)).toEqual([grantId]);
  });

  it("answers NOT_FOUND for another user's grant", async () => {
    await expect(
      as(() =>
        api().optionActions.exercise({
          optionGrantId: otherGrantId,
          quantity: "10",
          exerciseDate: "2024-06-01",
          requestKey: randomUUID(),
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
