import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, runAsSystem, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

describePostgres("permission levels (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `perm-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const ownerId = id("owner");
  const otherId = id("other");
  const actorOf = (userId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  });
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  const botId = id("bot");

  type Settings = { level: string | null; effectiveDefault: string };
  const api = (who: Actor) =>
    createRouterClient(createRouter({ prisma: app.prisma, env: {} } as unknown as RouterDeps), {
      context: { actor: who } as never,
    }) as unknown as {
      permissions: {
        get(): Promise<Settings>;
        set(i: { level: string | null }): Promise<Settings>;
      };
      bots: {
        update(i: { botId: string; permissionLevel: string | null }): Promise<unknown>;
        get(i: { botId: string }): Promise<{ permissionLevel?: string | null }>;
      };
    };
  const as = <T>(who: Actor, fn: () => Promise<T>) =>
    runAsTenant({ spaceId: who.spaceId, userId: who.userId }, fn);

  beforeAll(() =>
    runAsSystem("permission fixture", async () => {
      admin = createDb(ownerUrl as string);
      app = createDb(runtimeUrl as string);
      for (const user of [ownerId, otherId])
        await admin.prisma.user.create({
          data: { id: user, name: user, email: `${user}@example.test`, emailVerified: false },
        });
      await admin.prisma.organization.create({
        data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
      });
      await admin.prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: "S" } });
      for (const user of [ownerId, otherId])
        await admin.prisma.member.create({
          data: {
            id: id(`m-${user}`),
            organizationId: orgId,
            userId: user,
            role: "member",
            createdAt: new Date(),
          },
        });
      await admin.prisma.bot.create({
        data: { id: botId, name: "Ada", color: "#000", spaceId, userId: ownerId },
      });
      await admin.prisma.thread.create({ data: { spaceId, userId: ownerId, botId } });
    }),
  );

  afterAll(() =>
    runAsSystem("permission cleanup", async () => {
      await admin.prisma.bot.deleteMany({ where: { spaceId } });
      await admin.prisma.organization.deleteMany({ where: { id: orgId } });
      await admin.prisma.user.deleteMany({ where: { id: { in: [ownerId, otherId] } } });
      await admin.prisma.$disconnect();
      await admin.pool.end();
      await app.prisma.$disconnect();
      await app.pool.end();
    }),
  );

  it("keeps each user's level separate and clears it with null", async () => {
    const owner = actorOf(ownerId);
    const other = actorOf(otherId);
    expect((await as(owner, () => api(owner).permissions.get())).level).toBeNull();
    await as(owner, () => api(owner).permissions.set({ level: "ask_everything" }));
    expect((await as(owner, () => api(owner).permissions.get())).level).toBe("ask_everything");
    expect((await as(other, () => api(other).permissions.get())).level).toBeNull();
    await as(other, () => api(other).permissions.set({ level: "open" }));
    expect((await as(owner, () => api(owner).permissions.get())).level).toBe("ask_everything");
    await as(owner, () => api(owner).permissions.set({ level: null }));
    expect((await as(owner, () => api(owner).permissions.get())).level).toBeNull();
  });

  it("lets only the agent's owner set its override", async () => {
    const owner = actorOf(ownerId);
    const other = actorOf(otherId);
    await expect(
      as(other, () => api(other).bots.update({ botId, permissionLevel: "open" })),
    ).rejects.toThrow();
    expect(
      await admin.prisma.bot.findUnique({
        where: { id: botId },
        select: { permissionLevel: true },
      }),
    ).toEqual({ permissionLevel: null });
    await as(owner, () => api(owner).bots.update({ botId, permissionLevel: "ask_changes" }));
    expect((await as(owner, () => api(owner).bots.get({ botId }))).permissionLevel).toBe(
      "ask_changes",
    );
    await as(owner, () => api(owner).bots.update({ botId, permissionLevel: null }));
    expect((await as(owner, () => api(owner).bots.get({ botId }))).permissionLevel).toBeNull();
  });
});
