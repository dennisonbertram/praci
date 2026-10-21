import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { gtmAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureGtmAgent } from "./gtm-agent.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("GTM agent (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `gtm-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const otherSpaceId = id("other-space");
  const userA = id("user-a");
  const userB = id("user-b");
  const actor = (userId: string, space = spaceId): Actor => ({
    userId,
    spaceId: space,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let repos: ReturnType<typeof createRepos>;
  const jobs = { enqueue: vi.fn(async () => undefined) };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const userId of [userA, userB]) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    for (const sid of [spaceId, otherSpaceId]) {
      await prisma.space.create({
        data: { id: sid, organizationId: orgId, name: "General", isDefault: sid === spaceId },
      });
    }
    for (const userId of [userA, userB]) {
      await prisma.member.create({
        data: {
          id: id(`member-${userId}`),
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    for (const [sid, userId] of [
      [spaceId, userA],
      [spaceId, userB],
      [otherSpaceId, userA],
    ]) {
      await prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId: sid, userId } },
        update: {},
        create: {
          id: id(`space-member-${sid}-${userId}`),
          spaceId: sid,
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    repos = createRepos(prisma);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bot.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  it("concurrent ensure calls create one active bot and one hourly routine", async () => {
    jobs.enqueue.mockClear();
    const [first, second] = await Promise.all([
      ensureGtmAgent({ prisma, repos, jobs }, actor(userA)),
      ensureGtmAgent({ prisma, repos, jobs }, actor(userA)),
    ]);

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({
      name: "GTM agent",
      description: "Plans and works your go-to-market goal, with proof for every step.",
      spawnKey: gtmAgentSpawnKey(userA),
      archivedAt: null,
      computerMode: "team",
    });
    expect(first.instructions).toContain("You are the founder's GTM agent.");
    expect(
      await prisma.bot.count({
        where: { spaceId, userId: userA, spawnKey: gtmAgentSpawnKey(userA) },
      }),
    ).toBe(1);
    expect(await prisma.routine.count({ where: { botId: first.id } })).toBe(1);
    expect(await prisma.routine.findFirstOrThrow({ where: { botId: first.id } })).toMatchObject({
      name: "Work the plan",
      crons: ["0 * * * *"],
      timezone: "UTC",
      active: true,
      notify: false,
      modelProvider: null,
      modelId: null,
    });
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
  });

  it("keeps users and spaces isolated", async () => {
    const sameSpaceOtherUser = await ensureGtmAgent({ prisma, repos, jobs }, actor(userB));
    const otherSpaceSameUser = await ensureGtmAgent(
      { prisma, repos, jobs },
      actor(userA, otherSpaceId),
    );

    expect(sameSpaceOtherUser.id).not.toBe(otherSpaceSameUser.id);
    expect(sameSpaceOtherUser.spawnKey).toBe(gtmAgentSpawnKey(userB));
    expect(otherSpaceSameUser.spawnKey).toBe(gtmAgentSpawnKey(userA));
    expect(
      await prisma.bot.count({
        where: { spawnKey: gtmAgentSpawnKey(userA), spaceId: { in: [spaceId, otherSpaceId] } },
      }),
    ).toBe(2);
    expect(
      await prisma.bot.findFirstOrThrow({
        where: { id: otherSpaceSameUser.id },
        select: { userId: true, spaceId: true },
      }),
    ).toEqual({ userId: userA, spaceId: otherSpaceId });
  });

  it("replaces an archived identity instead of restoring its old thread", async () => {
    const old = await ensureGtmAgent({ prisma, repos, jobs }, actor(userB));
    await prisma.bot.update({
      where: { id: old.id },
      data: { archivedAt: new Date() },
    });

    const replacement = await ensureGtmAgent({ prisma, repos, jobs }, actor(userB));
    expect(replacement.id).not.toBe(old.id);
    expect(replacement.spawnKey).toBe(gtmAgentSpawnKey(userB));
    expect(
      await prisma.bot.findUniqueOrThrow({
        where: { id: old.id },
        select: { archivedAt: true, spawnKey: true },
      }),
    ).toMatchObject({ archivedAt: expect.any(Date), spawnKey: null });
  });

  it("reserves the GTM spawn-key prefix for the built-in agent", async () => {
    const client = createRouterClient(createRouter({ prisma } as unknown as RouterDeps), {
      context: { actor: actor(userA) } as never,
    });

    await expect(
      client.bots.create({
        name: "Squatter",
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: true,
        computerMode: "team",
        spawnKey: gtmAgentSpawnKey("someone-else"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
