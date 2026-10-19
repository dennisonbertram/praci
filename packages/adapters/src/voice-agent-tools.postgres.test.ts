import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { voiceAgentToolFromTool } from "./voice-agent-tools.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("voice agent workspace reads (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `voice-tools-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const otherSpaceId = id("other-space");
  const userId = id("user");
  const otherUserId = id("other-user");
  const actor = (user: string, space: string): Actor => ({
    userId: user,
    spaceId: space,
    email: `${user}@rakazo.test`,
    isDeploymentOwner: false,
  });

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const botIds: string[] = [];
  const messageIds: string[] = [];

  const createBot = async (who: Actor, name: string) => {
    const bot = await createRepos(prisma).createBot(who, {
      name,
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: true,
      computerMode: "team",
    });
    botIds.push(bot.id);
    return bot;
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const user of [userId, otherUserId]) {
      await prisma.user.create({
        data: { id: user, name: user, email: `${user}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    await prisma.space.create({
      data: { id: otherSpaceId, organizationId: orgId, name: "Other", isDefault: false },
    });
    for (const user of [userId, otherUserId]) {
      await prisma.member.create({
        data: {
          id: id(`member-${user}`),
          organizationId: orgId,
          userId: user,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    const memberships: Array<[string, string]> = [
      [spaceId, userId],
      [spaceId, otherUserId],
      [otherSpaceId, userId],
    ];
    for (const [space, user] of memberships) {
      await prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId: space, userId: user } },
        create: {
          id: id(`space-member-${space}-${user}`),
          organizationId: orgId,
          spaceId: space,
          userId: user,
          role: "member",
          createdAt: new Date(),
        },
        update: {},
      });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.message.deleteMany({ where: { id: { in: messageIds } } });
    await prisma.bot.deleteMany({ where: { id: { in: botIds } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("scopes discovery and history to active same-owner private agents with bounded pages", async () => {
    const selected = await createBot(actor(userId, spaceId), "Selected");
    const second = await createBot(actor(userId, spaceId), "Second");
    const otherUser = await createBot(actor(otherUserId, spaceId), "Other user");
    await createBot(actor(userId, otherSpaceId), "Other space");
    const archived = await createBot(actor(userId, spaceId), "Archived");
    await prisma.bot.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    const selectedThread = await prisma.thread.findFirstOrThrow({
      where: { botId: selected.id },
      select: { id: true },
    });
    const foreignThread = await prisma.thread.findFirstOrThrow({
      where: { botId: second.id },
      select: { id: true },
    });
    const selectedMessage = await prisma.message.create({
      data: {
        threadId: selectedThread.id,
        seq: 1,
        role: "user",
        blocks: [{ kind: "text", text: "selected-proof-phrase" }],
      },
    });
    messageIds.push(selectedMessage.id);
    const foreignMessage = await prisma.message.create({
      data: {
        threadId: foreignThread.id,
        seq: 1,
        role: "user",
        blocks: [{ kind: "text", text: "foreign-proof-phrase" }],
      },
    });
    messageIds.push(foreignMessage.id);
    const scope = { spaceId, userId };

    const firstPage = await voiceAgentToolFromTool(prisma, scope, "workspace_agents", {
      limit: 1,
    });
    expect(firstPage).toMatchObject({
      agents: [{ id: expect.any(String) }],
      nextAfterId: expect.any(String),
    });
    const firstId = (firstPage as { agents: { id: string }[] }).agents[0]?.id;
    const nextPage = await voiceAgentToolFromTool(prisma, scope, "workspace_agents", {
      afterId: (firstPage as { nextAfterId: string }).nextAfterId,
      limit: 1,
    });
    const pageIds = [
      firstId,
      ...(nextPage as { agents: { id: string }[] }).agents.map((row) => row.id),
    ];
    expect(pageIds).toHaveLength(2);
    expect(pageIds).toEqual(expect.arrayContaining([selected.id, second.id]));
    expect(pageIds).not.toContain(otherUser.id);
    expect(pageIds).not.toContain(archived.id);

    await expect(
      voiceAgentToolFromTool(prisma, scope, "agent_context", { botId: otherUser.id }),
    ).resolves.toEqual({ error: "Agent not found." });
    await expect(
      voiceAgentToolFromTool(prisma, scope, "agent_context", { botId: archived.id }),
    ).resolves.toEqual({ error: "Agent not found." });

    const sameOwnerHistory = (await voiceAgentToolFromTool(prisma, scope, "search_agent_history", {
      botId: selected.id,
      query: "selected-proof-phrase",
    })) as { messages: { messageId: string }[] };
    expect(sameOwnerHistory.messages.map((message) => message.messageId)).toContain(
      selectedMessage.id,
    );
    await expect(
      voiceAgentToolFromTool(prisma, scope, "read_agent_history", {
        botId: selected.id,
        messageId: selectedMessage.id,
      }),
    ).resolves.toMatchObject({
      messages: [expect.objectContaining({ messageId: selectedMessage.id })],
    });
    const foreignHistory = (await voiceAgentToolFromTool(prisma, scope, "search_agent_history", {
      botId: selected.id,
      query: "foreign-proof-phrase",
    })) as { messages: { messageId: string }[] };
    expect(foreignHistory.messages).toEqual([]);
    await expect(
      voiceAgentToolFromTool(prisma, scope, "read_agent_history", {
        botId: selected.id,
        messageId: foreignMessage.id,
      }),
    ).resolves.toMatchObject({ messages: [] });
  });
});
