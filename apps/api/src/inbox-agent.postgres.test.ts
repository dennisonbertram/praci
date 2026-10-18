import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { inboxAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inboxList } from "./inbox.js";
import { ensureInboxAgent } from "./inbox-agent.js";
import { createRouter, type RouterDeps } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("ensureInboxAgent (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `inbox-agent-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userA = id("user-a");
  const userB = id("user-b");
  const actor = (userId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const a = actor(userA);
  const b = actor(userB);

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let repos: ReturnType<typeof createRepos>;

  const inboxBots = () =>
    prisma.bot.findMany({ where: { spaceId, spawnKey: { startsWith: "inbox-agent:" } } });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    repos = createRepos(prisma);
    for (const userId of [userA, userB]) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
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
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  it("creates one bot and returns it again on later and concurrent calls", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => ensureInboxAgent(repos, a)));
    const again = await ensureInboxAgent(repos, a);

    expect(new Set([...results, again].map((bot) => bot.id)).size).toBe(1);
    const rows = await prisma.bot.findMany({ where: { spaceId, userId: userA } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Inbox agent",
      title: "",
      description: "Reads your mail, finds what needs a reply and writes replies.",
      notifyOnFinish: true,
      spawnKey: inboxAgentSpawnKey(userA),
      disabledBuiltinTools: [],
    });
    expect(await prisma.thread.count({ where: { botId: rows[0]?.id } })).toBe(1);
    // No intro run, so the new thread stays empty.
    expect(await prisma.run.count({ where: { botId: rows[0]?.id } })).toBe(0);
    expect(await prisma.message.count({ where: { thread: { botId: rows[0]?.id } } })).toBe(0);
  });

  it("gives each user in the same space their own bot", async () => {
    const mine = await ensureInboxAgent(repos, a);
    const theirs = await ensureInboxAgent(repos, b);
    expect(theirs.id).not.toBe(mine.id);
    expect(await inboxBots()).toHaveLength(2);

    const deps = { prisma } as Parameters<typeof inboxList>[0];
    expect((await inboxList(deps, a, {})).agent?.botId).toBe(mine.id);
    expect((await inboxList(deps, b, {})).agent?.botId).toBe(theirs.id);
  });

  it("creates a fresh bot after the old one is archived", async () => {
    const old = await ensureInboxAgent(repos, a);
    await prisma.bot.update({ where: { id: old.id }, data: { archivedAt: new Date() } });
    const deps = { prisma } as Parameters<typeof inboxList>[0];
    expect((await inboxList(deps, a, {})).agent).toBeNull();

    const fresh = await ensureInboxAgent(repos, a);

    expect(fresh.id).not.toBe(old.id);
    expect((await inboxList(deps, a, {})).agent?.botId).toBe(fresh.id);
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: old.id } })).spawnKey).toBeNull();
  });

  it("starts a re-created bot on an empty thread and lists only one active Inbox agent", async () => {
    const before = await ensureInboxAgent(repos, b);
    const oldThread = await prisma.thread.findFirstOrThrow({ where: { botId: before.id } });
    await prisma.bot.update({ where: { id: before.id }, data: { archivedAt: new Date() } });

    const fresh = await ensureInboxAgent(repos, b);

    const freshThread = await prisma.thread.findFirstOrThrow({ where: { botId: fresh.id } });
    expect(freshThread.id).not.toBe(oldThread.id);
    const active = (await repos.listBots(b)).filter((bot) => bot.name === "Inbox agent");
    expect(active.map((bot) => bot.id)).toEqual([fresh.id]);
  });

  describe("inbox.agent and bots.create", () => {
    const client = (who: Actor) =>
      createRouterClient(createRouter({ prisma } as unknown as RouterDeps), {
        context: { actor: who } as never,
      });

    it("returns the session user's bot without any input", async () => {
      const first = await client(b).inbox.agent();
      const second = await client(b).inbox.agent();
      expect(second.id).toBe(first.id);
      expect(first).toMatchObject({ name: "Inbox agent", spawnKey: inboxAgentSpawnKey(userB) });
      expect((await prisma.bot.findUniqueOrThrow({ where: { id: first.id } })).userId).toBe(userB);
    });

    it("refuses a client-supplied Inbox agent spawn key", async () => {
      const input = {
        name: "Squatter",
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: true,
        computerMode: "team" as const,
      };
      for (const spawnKey of [inboxAgentSpawnKey(userB), inboxAgentSpawnKey("someone-else")]) {
        await expect(client(a).bots.create({ ...input, spawnKey })).rejects.toMatchObject({
          code: "BAD_REQUEST",
        });
      }
      const ok = await client(a).bots.create({ ...input, spawnKey: "custom-key" });
      expect(ok.name).toBe("Squatter");
    });
  });
});
