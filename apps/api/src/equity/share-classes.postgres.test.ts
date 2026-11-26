import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "../router.js";
import { createRouter } from "../router.js";

const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

describePostgres("equity share classes and plans API (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `sc-org-${suffix}`;
  const spaceId = `sc-space-${suffix}`;
  const userId = `sc-user-${suffix}`;
  const otherId = `sc-other-${suffix}`;
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  };
  const other: Actor = { ...actor, userId: otherId, email: `${otherId}@example.test` };
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;

  type ShareClasses = {
    list(i: Record<string, unknown>): Promise<{ total: number; items: Array<{ id: string }> }>;
    get(i: { id: string }): Promise<{ id: string; current: { authorizedShares: string } }>;
    create(i: Record<string, unknown>): Promise<{ id: string; prefix: string }>;
    update(i: Record<string, unknown>): Promise<{ id: string }>;
  };
  type Plans = {
    list(i: Record<string, unknown>): Promise<{ total: number }>;
    get(i: { id: string }): Promise<{ id: string; availableShares: string }>;
    create(i: Record<string, unknown>): Promise<{ id: string; reservedShares: string }>;
    update(i: Record<string, unknown>): Promise<{ id: string }>;
  };
  const api = (who: Actor = actor): { equity: { shareClasses: ShareClasses; plans: Plans } } =>
    createRouterClient(createRouter({ prisma: app.prisma, env: {} } as unknown as RouterDeps), {
      context: { actor: who } as never,
    }) as never;
  const as = <T>(fn: () => Promise<T>) =>
    runAsTenant({ spaceId: actor.spaceId, userId: actor.userId }, fn);
  const asOther = <T>(fn: () => Promise<T>) =>
    runAsTenant({ spaceId: other.spaceId, userId: other.userId }, fn);

  beforeAll(async () => {
    admin = createDb(ownerUrl as string);
    app = createDb(runtimeUrl as string);
    for (const user of [userId, otherId])
      await admin.prisma.user.create({
        data: { id: user, name: user, email: `${user}@example.test`, emailVerified: false },
      });
    await admin.prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await admin.prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: "S" } });
  });
  afterAll(async () => {
    await admin.prisma.organization.deleteMany({ where: { id: orgId } });
    await admin.prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await admin.prisma.$disconnect();
    await admin.pool.end();
    await app.prisma.$disconnect();
    await app.pool.end();
  });

  it("creates, reads, lists and updates classes and plans", async () => {
    const common = await as(() =>
      api().equity.shareClasses.create({
        name: "Common Stock",
        prefix: "CS",
        classType: "common",
        terms: { documentDate: "2020-01-01", authorizedShares: "10000000" },
      }),
    );
    expect(common.prefix).toBe("CS");
    const loaded = await as(() => api().equity.shareClasses.get({ id: common.id }));
    expect(loaded.current.authorizedShares).toBe("10000000");
    const page = await as(() => api().equity.shareClasses.list({ search: "common" }));
    expect(page.total).toBe(1);
    const updated = await as(() =>
      api().equity.shareClasses.update({
        id: common.id,
        terms: { documentDate: "2021-01-01", seniority: 2 },
      }),
    );
    expect(updated.id).toBe(common.id);

    const plan = await as(() =>
      api().equity.plans.create({
        name: "2024 Plan",
        shareClassId: common.id,
        reservedShares: "1000",
      }),
    );
    expect(plan.reservedShares).toBe("1000");
    expect((await as(() => api().equity.plans.get({ id: plan.id }))).availableShares).toBe("1000");
    expect((await as(() => api().equity.plans.list({}))).total).toBe(1);
    await as(() => api().equity.plans.update({ id: plan.id, reservedShares: "1500" }));

    // Another user in the same space does not see or find the rows.
    expect((await asOther(() => api(other).equity.shareClasses.list({}))).total).toBe(0);
    await expect(
      asOther(() => api(other).equity.shareClasses.get({ id: common.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(asOther(() => api(other).equity.plans.get({ id: plan.id }))).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
      },
    );

    // A duplicate name is a conflict, a foreign class reference a bad request.
    await expect(
      as(() =>
        api().equity.plans.create({
          name: "2024 Plan",
          shareClassId: common.id,
          reservedShares: "1",
        }),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      as(() =>
        api().equity.plans.create({
          name: "Bad Plan",
          shareClassId: "missing",
          reservedShares: "1",
        }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      as(() =>
        api().equity.shareClasses.create({
          name: "Broken Prefix",
          prefix: "cs",
          classType: "common",
          terms: { documentDate: "2020-01-01", authorizedShares: "1" },
        }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
