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

describePostgres("equity options (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `opt-${name}-${suffix}`;
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
  const otherActor: Actor = { ...actor, userId: otherUserId, email: `${otherUserId}@example.test` };
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  let stakeholderId = "";
  let planId = "";

  type Granted = { id: string; label: string; outstandingQuantity: string };
  type Templates = {
    create(i: Record<string, unknown>): Promise<{ id: string; name: string }>;
  };
  type Grants = {
    create(i: Record<string, unknown>): Promise<Granted>;
    get(i: { id: string }): Promise<Granted>;
    list(i: Record<string, unknown>): Promise<{ total: number }>;
  };
  type Exercises = {
    create(i: Record<string, unknown>): Promise<{ id: string; status: string }>;
    update(i: Record<string, unknown>): Promise<{ status: string }>;
  };
  const api = (who: Actor = actor) => {
    const equity = createRouterClient(
      createRouter({ prisma: app.prisma, env: {} } as unknown as RouterDeps),
      { context: { actor: who } as never },
    ).equity as unknown as {
      vestingTemplates: Templates;
      optionGrants: Grants;
      exercises: Exercises;
    };
    return equity;
  };
  const as = <T>(fn: () => Promise<T>) =>
    runAsTenant({ spaceId: actor.spaceId, userId: actor.userId }, fn);

  beforeAll(() =>
    runAsSystem("options api fixture", async () => {
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
      const scope = { spaceId, userId };
      await admin.prisma.equityLedger.create({ data: scope });
      stakeholderId = (
        await admin.prisma.equityStakeholder.create({
          data: { ...scope, type: "individual", name: "Ada Example" },
        })
      ).id;
      const shareClass = await admin.prisma.equityShareClass.create({
        data: { ...scope, name: "Common", prefix: "C", classType: "common" },
      });
      await admin.prisma.equityShareClassVersion.create({
        data: {
          ...scope,
          shareClassId: shareClass.id,
          documentDate: new Date("2024-01-01T00:00:00.000Z"),
          authorizedShares: 10_000n,
        },
      });
      planId = (
        await admin.prisma.equityPlan.create({
          data: {
            ...scope,
            name: "2024 Plan",
            shareClassId: shareClass.id,
            reservedShares: 10_000n,
          },
        })
      ).id;
    }),
  );

  afterAll(() =>
    runAsSystem("options api cleanup", async () => {
      await admin.prisma.equityLedger.deleteMany({ where: { spaceId } });
      await admin.prisma.organization.deleteMany({ where: { id: orgId } });
      await admin.prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
      await admin.prisma.$disconnect();
      await admin.pool.end();
      await app.prisma.$disconnect();
      await app.pool.end();
    }),
  );

  const grantInput = (extra: Record<string, unknown> = {}) => ({
    stakeholderId,
    planId,
    optionType: "iso",
    quantity: "100",
    exercisePrice: "1",
    grantDate: "2024-01-01",
    ...extra,
  });

  it("creates templates and grants, refusing duplicates, bad references and foreign ids", async () => {
    const template = await as(() =>
      api().vestingTemplates.create({ name: "Four year", totalMonths: 48, cliffMonths: 12 }),
    );
    expect(template.name).toBe("Four year");
    await expect(
      as(() => api().vestingTemplates.create({ name: "Four year", totalMonths: 48 })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      as(() =>
        api().vestingTemplates.create({
          name: "Half",
          totalMonths: 12,
          tranches: [{ monthOffset: 6, percent: "90" }],
        }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const grant = await as(() =>
      api().optionGrants.create(
        grantInput({
          vesting: { templateId: template.id, startDate: "2024-01-01", totalMonths: 48 },
        }),
      ),
    );
    expect(grant.label).toBe("ES-1");
    expect(grant.outstandingQuantity).toBe("100");
    const page = await as(() => api().optionGrants.list({ sort: { field: "label", dir: "asc" } }));
    expect(page.total).toBe(1);

    await expect(
      as(() => api().optionGrants.create(grantInput({ quantity: "999999" }))),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      as(() => api().optionGrants.create(grantInput({ stakeholderId: id("missing") }))),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(as(() => api().optionGrants.get({ id: grant.id }))).resolves.toMatchObject({
      id: grant.id,
    });
    await expect(
      as(() => api({ ...otherActor, spaceId: actor.spaceId }).optionGrants.get({ id: grant.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      as(() => api().optionGrants.create(grantInput({ label: "ES-1" }))),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("records and completes an exercise", async () => {
    const grant = await as(() => api().optionGrants.create(grantInput({ quantity: "10" })));
    const exercise = await as(() =>
      api().exercises.create({
        optionGrantId: grant.id,
        quantity: "10",
        exerciseDate: "2024-06-01",
        paymentCents: "1000",
        requestKey: randomUUID(),
      }),
    );
    expect(exercise.status).toBe("pending");
    const done = await as(() => api().exercises.update({ id: exercise.id, status: "completed" }));
    expect(done.status).toBe("completed");
    await expect(
      as(() => api().exercises.update({ id: exercise.id, status: "canceled" })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
