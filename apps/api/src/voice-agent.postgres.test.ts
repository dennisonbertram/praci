import { createRouterClient } from "@orpc/server";
import { messageBot, returnBotMessageOutcome } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { voiceAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("voice.agent (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `voice-${name}-${suffix}`;
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

  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const client = (who: Actor) =>
    createRouterClient(createRouter({ prisma } as unknown as RouterDeps), {
      context: { actor: who } as never,
    });

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

  it("is idempotent, scoped to the actor, and creates no intro run", async () => {
    const [first, second] = await Promise.all([
      client(actor(userA)).voice.agent(),
      client(actor(userA)).voice.agent(),
    ]);

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({ name: "Elio", spawnKey: voiceAgentSpawnKey(userA) });
    expect(
      await prisma.bot.findFirstOrThrow({ where: { id: first.id }, select: { userId: true } }),
    ).toEqual({ userId: userA });
    expect(await prisma.run.count({ where: { botId: first.id } })).toBe(0);
    expect(await prisma.message.count({ where: { thread: { botId: first.id } } })).toBe(0);

    const other = await client(actor(userB)).voice.agent();
    expect(other.id).not.toBe(first.id);
    expect(other.spawnKey).toBe(voiceAgentSpawnKey(userB));
    expect(
      await prisma.bot.findFirstOrThrow({ where: { id: other.id }, select: { userId: true } }),
    ).toEqual({ userId: userB });
  });

  it("rejects a client-supplied voice-agent spawn key", async () => {
    for (const spawnKey of [voiceAgentSpawnKey(userA), voiceAgentSpawnKey(userB)]) {
      await expect(
        client(actor(userA)).bots.create({
          name: "Impersonator",
          title: "",
          description: "",
          instructions: "",
          notifyOnFinish: true,
          computerMode: "team",
          spawnKey,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
  });

  it("refuses to restore an archived Elio once a replacement took its identity", async () => {
    const who = client(actor(userB));
    const old = await who.voice.agent();
    await who.bots.archive({ botId: old.id });
    const replacement = await who.voice.agent();
    expect(replacement.id).not.toBe(old.id);

    await expect(who.bots.restore({ botId: old.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(
      await prisma.bot.findUniqueOrThrow({ where: { id: old.id }, select: { archivedAt: true } }),
    ).toEqual({ archivedAt: expect.any(Date) });
  });

  it("restores an archived Elio that still holds its identity", async () => {
    const who = client(actor(userA));
    const elio = await who.voice.agent();
    await who.bots.archive({ botId: elio.id });
    await who.bots.restore({ botId: elio.id });
    expect(
      await prisma.bot.findUniqueOrThrow({ where: { id: elio.id }, select: { archivedAt: true } }),
    ).toEqual({ archivedAt: null });
  });

  it("persists Elio's delegation and the specialist's explicit result in Elio's thread", async () => {
    const elio = await client(actor(userA)).voice.agent();
    const specialist = await createRepos(prisma).createBot(actor(userA), {
      name: "Analyst",
      title: "Analyst",
      description: "Analyzes requested evidence.",
      instructions: "",
      notifyOnFinish: true,
    });
    const elioThread = await prisma.thread.findUniqueOrThrow({
      where: { botId: elio.id },
      select: { id: true },
    });
    const specialistThread = await prisma.thread.findUniqueOrThrow({
      where: { botId: specialist.id },
      select: { id: true },
    });
    const task = await prisma.task.create({
      data: {
        spaceId,
        botId: elio.id,
        threadId: elioThread.id,
        userId: userA,
        prompt: "Ask the Analyst to verify the export label.",
        status: "running",
      },
    });
    const run = await prisma.run.create({
      data: {
        spaceId,
        botId: elio.id,
        threadId: elioThread.id,
        taskId: task.id,
        userId: userA,
        status: "running",
        trigger: "user",
      },
    });
    const deps = {
      prisma,
      events: { notify: async () => {} },
      jobs: { enqueue: async () => {} },
    } as unknown as Parameters<typeof messageBot>[0];

    const delegated = await messageBot(
      deps,
      run,
      { id: elio.id, name: elio.name },
      {
        bot_id: specialist.id,
        message: "Verify the export label.",
        intent: "request",
      },
    );
    expect(delegated).toMatchObject({ ok: true, botId: specialist.id });

    const received = await prisma.message.findFirstOrThrow({
      where: { threadId: specialistThread.id, role: "user" },
      orderBy: { seq: "desc" },
    });
    expect(received.blocks).toEqual([
      expect.objectContaining({
        kind: "bot_message_received",
        fromBotId: elio.id,
        text: "Verify the export label.",
        intent: "request",
      }),
    ]);
    const specialistRun = await prisma.run.findFirstOrThrow({
      where: { botId: specialist.id, sourceMessageId: received.id },
    });
    await prisma.run.update({
      where: { id: specialistRun.id },
      data: { status: "completed" },
    });
    const result = "The verified export label is ORBIT-731.";
    expect(
      await returnBotMessageOutcome(
        deps,
        { ...specialistRun, status: "completed" },
        { id: specialist.id, name: specialist.name },
        result,
      ),
    ).toBe(true);

    const visibleResult = await prisma.message.findFirstOrThrow({
      where: { threadId: elioThread.id, role: "user" },
      orderBy: { seq: "desc" },
    });
    expect(visibleResult.blocks).toEqual([
      expect.objectContaining({
        kind: "bot_message_received",
        fromBotId: specialist.id,
        text: result,
        intent: "result",
      }),
    ]);
  });
});
