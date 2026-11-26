import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, runAsSystem, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "../../../packages/adapters/src/computer-lifecycle.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

vi.mock("../../../packages/adapters/src/computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  provisionComputer: async () => ({ id: "synthetic-computer", kind: "desktop" }),
}));

// DATABASE_URL is the runtime login (row-level security applies); DATABASE_MIGRATION_URL is the owner.
const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

describePostgres("Bot.proactivity owner setting (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `pa-${name}-${suffix}`;
  const org = id("org");
  const space = id("space");
  const otherSpace = id("space2");
  const owner = id("owner");
  const other = id("other");
  const actor = (userId: string, spaceId = space): Actor => ({
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  });
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  let botId = "";

  // Every call runs as its caller's tenant, so the database applies row-level security too.
  const as = <T>(who: Actor, fn: (client: ReturnType<typeof clientFor>) => Promise<T>) =>
    runAsTenant({ spaceId: who.spaceId, userId: who.userId }, () => fn(clientFor(who)));
  const clientFor = (who: Actor) =>
    createRouterClient(
      createRouter({
        prisma: app.prisma,
        events: { notify: async () => undefined },
        env: { mailWritesDisabled: true },
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );
  const stored = (target: string) =>
    runAsSystem("proactivity test read", () =>
      admin.prisma.bot.findUniqueOrThrow({ where: { id: target }, select: { proactivity: true } }),
    );

  beforeAll(() =>
    runAsSystem("test fixture", async () => {
      admin = createDb(ownerUrl!);
      app = createDb(runtimeUrl!);
      for (const userId of [owner, other]) {
        await admin.prisma.user.create({
          data: { id: userId, name: userId, email: `${userId}@example.test`, emailVerified: true },
        });
      }
      await admin.prisma.organization.create({
        data: { id: org, name: org, slug: org, createdAt: new Date() },
      });
      for (const sid of [space, otherSpace]) {
        await admin.prisma.space.create({ data: { id: sid, organizationId: org, name: "S" } });
      }
      for (const [userId, sid] of [
        [owner, space],
        [other, otherSpace],
      ] as const) {
        await admin.prisma.member.create({
          data: {
            id: id(`m-${userId}`),
            organizationId: org,
            userId,
            role: "member",
            createdAt: new Date(),
          },
        });
        await admin.prisma.spaceMember.create({
          data: {
            id: id(`sm-${userId}`),
            spaceId: sid,
            organizationId: org,
            userId,
            role: "member",
            createdAt: new Date(),
          },
        });
      }
      const bot = await admin.prisma.bot.create({
        data: { spaceId: space, userId: owner, name: "Support", color: "blue" },
      });
      botId = bot.id;
      await admin.prisma.thread.create({ data: { spaceId: space, userId: owner, botId } });
    }),
  );
  beforeEach(() =>
    runAsSystem("proactivity test reset", () =>
      admin.prisma.bot.update({ where: { id: botId }, data: { proactivity: "medium" } }),
    ),
  );
  afterAll(() =>
    runAsSystem("test cleanup", async () => {
      await admin.prisma.organization.deleteMany({ where: { id: org } });
      for (const userId of [owner, other]) {
        await admin.prisma.user.deleteMany({ where: { id: userId } });
      }
      await admin.prisma.$disconnect();
      await admin.pool.end();
      await app.prisma.$disconnect();
      await app.pool.end();
    }),
  );

  it("is medium by default; the owner can set it, and an unrelated update leaves it", async () => {
    expect(await stored(botId)).toEqual({ proactivity: "medium" });
    const high = await as(actor(owner), (c) => c.bots.update({ botId, proactivity: "high" }));
    expect(high.proactivity).toBe("high");
    expect(await stored(botId)).toEqual({ proactivity: "high" });
    const renamed = await as(actor(owner), (c) => c.bots.update({ botId, name: "Support 2" }));
    expect(renamed.proactivity).toBe("high");
    const low = await as(actor(owner), (c) => c.bots.update({ botId, proactivity: "low" }));
    expect(low.proactivity).toBe("low");
  });

  it("rejects an unknown level", async () => {
    await expect(
      as(actor(owner), (c) => c.bots.update({ botId, proactivity: "extreme" as never })),
    ).rejects.toBeDefined();
    expect(await stored(botId)).toEqual({ proactivity: "medium" });
  });

  it("refuses another user and another space, and leaves the level unchanged", async () => {
    await expect(
      as(actor(other, otherSpace), (c) => c.bots.update({ botId, proactivity: "high" })),
    ).rejects.toBeDefined();
    await expect(
      as(actor(other, space), (c) => c.bots.update({ botId, proactivity: "high" })),
    ).rejects.toBeDefined();
    expect(await stored(botId)).toEqual({ proactivity: "medium" });
  });

  it("cannot be written across tenants even by a direct update", async () => {
    const changed = await runAsTenant({ spaceId: otherSpace, userId: other }, () =>
      app.prisma.bot.updateMany({ where: { id: botId }, data: { proactivity: "high" } }),
    );
    expect(changed.count).toBe(0);
    expect(await stored(botId)).toEqual({ proactivity: "medium" });
  });

  it("duplicate copies the level", async () => {
    await as(actor(owner), (c) => c.bots.update({ botId, proactivity: "low" }));
    const copy = await as(actor(owner), (c) => c.bots.duplicate({ botId }));
    expect(copy.proactivity).toBe("low");
    expect(await stored(copy.id)).toEqual({ proactivity: "low" });
  });
});
