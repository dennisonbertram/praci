import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, createEquityStakeholder, runAsSystem, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "../router.js";
import { createRouter } from "../router.js";

const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

describePostgres("equity access view procedure (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `eqv-org-${suffix}`;
  const spaceId = `eqv-space-${suffix}`;
  const userId = `eqv-user-${suffix}`;
  const otherUserId = `eqv-other-${suffix}`;
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  };
  const otherActor: Actor = { ...actor, userId: otherUserId, email: `${otherUserId}@example.test` };
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  const api = (who: Actor = actor) =>
    createRouterClient(createRouter({ prisma: app.prisma, env: {} } as unknown as RouterDeps), {
      context: { actor: who } as never,
    }).equity as unknown as {
      accessView: {
        get(input: Record<string, unknown>): Promise<Record<string, unknown>>;
      };
      accessHolders: {
        list(
          input: Record<string, unknown>,
        ): Promise<{ total: number; items: Array<{ name: string }> }>;
        setLevels(input: Record<string, unknown>): Promise<Array<{ overrideLevel: string | null }>>;
        resolveRequest(input: Record<string, unknown>): Promise<unknown>;
      };
    };
  const as = <T>(who: Actor, fn: () => Promise<T>) =>
    runAsTenant({ spaceId: who.spaceId, userId: who.userId }, fn);

  beforeAll(() =>
    runAsSystem("access api fixture", async () => {
      admin = createDb(ownerUrl as string);
      app = createDb(runtimeUrl as string);
      for (const id of [userId, otherUserId])
        await admin.prisma.user.create({
          data: { id, name: id, email: `${id}@example.test`, emailVerified: false },
        });
      await admin.prisma.organization.create({
        data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
      });
      await admin.prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: "S" } });
      for (const id of [userId, otherUserId])
        await admin.prisma.member.create({
          data: {
            id: `eqv-m-${id}`,
            organizationId: orgId,
            userId: id,
            role: "member",
            createdAt: new Date(),
          },
        });
    }),
  );
  afterAll(async () => {
    await runAsSystem("access api cleanup", async () => {
      await admin.prisma.organization.deleteMany({ where: { id: orgId } });
      await admin.prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    });
    await app.prisma.$disconnect();
    await app.pool.end();
    await admin.prisma.$disconnect();
    await admin.pool.end();
  });

  it("previews a holder at a level, and hides other users' holders", async () => {
    const scope = { spaceId, userId };
    const holder = await as(actor, () =>
      createEquityStakeholder(app.prisma, scope, { type: "individual", name: "Avery Sample" }),
    );
    const view = await as(actor, () =>
      api().accessView.get({ stakeholderId: holder.id, level: "basic" }),
    );
    expect(Object.keys(view).sort()).toEqual(
      ["fairMarketValue", "fundraising", "level", "personal", "shareClasses", "summary"].sort(),
    );
    // No outstanding holdings: the holder's own level is none.
    await expect(
      as(actor, () => api().accessView.get({ stakeholderId: holder.id })),
    ).resolves.toEqual({ level: "none" });
    await expect(
      as(otherActor, () => api(otherActor).accessView.get({ stakeholderId: holder.id })),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      as(actor, () => api().accessView.get({ stakeholderId: holder.id, level: "everything" })),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lists holders and bulk sets levels only in the caller's ledger", async () => {
    const scope = { spaceId, userId };
    const holder = await as(actor, () =>
      createEquityStakeholder(app.prisma, scope, { type: "individual", name: "Blake Example" }),
    );
    const page = await as(actor, () => api().accessHolders.list({ search: "Blake" }));
    expect(page.items.map((row) => row.name)).toEqual(["Blake Example"]);
    const rows = await as(actor, () =>
      api().accessHolders.setLevels({ stakeholderIds: [holder.id], level: "basic" }),
    );
    expect(rows[0]?.overrideLevel).toBe("basic");
    await expect(
      as(otherActor, () => api(otherActor).accessHolders.list({ search: "Blake" })),
    ).resolves.toMatchObject({ total: 0 });
    await expect(
      as(otherActor, () =>
        api(otherActor).accessHolders.setLevels({
          stakeholderIds: [holder.id],
          level: "full_detail",
        }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      as(otherActor, () =>
        api(otherActor).accessHolders.resolveRequest({
          stakeholderId: holder.id,
          requestedLevel: "full_detail",
          approve: true,
        }),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
