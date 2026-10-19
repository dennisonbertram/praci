import { createRouterClient } from "@orpc/server";
import { archiveBot, destroyBot } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { inboxAgentSpawnKey, integrationAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRouter, type RouterDeps } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("connected app agents (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `caa-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const otherSpaceId = id("space2");
  const userId = id("user");
  const otherUserId = id("other-user");
  const actor = (user: string, space = spaceId): Actor => ({
    userId: user,
    spaceId: space,
    email: `${user}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const owner = actor(userId);
  const otherOwner = actor(otherUserId);

  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const client = (who: Actor) =>
    createRouterClient(createRouter({ prisma } as unknown as RouterDeps), {
      context: { actor: who } as never,
    });
  const connections = (who = owner) =>
    client(who).connections as unknown as {
      createAgent(input: { connectionId: string }): Promise<{ botId: string }>;
      setWrites(input: { connectionId: string; enabled: boolean }): Promise<{
        writesEnabled: boolean;
      }>;
      setExclusive(input: { connectionId: string; exclusive: boolean }): Promise<unknown>;
    };
  const createConnection = (who = owner, status = "connected") =>
    prisma.connection.create({
      data: {
        spaceId: who.spaceId,
        userId: who.userId,
        connectorId: "composio",
        provider: "GMAIL",
        providerRef: `account-${id(who.userId)}`,
        displayName: `Gmail ${id(who.userId)}`,
        status,
      },
    });
  const lifecycleDeps = () => ({
    prisma,
    sandbox: {} as never,
    home: {} as never,
    jobs: { cancel: async () => undefined } as never,
    dataDir: undefined,
  });
  const lifecycleContext = (who = owner) => ({ userId: who.userId, spaceId: who.spaceId }) as never;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const user of [userId, otherUserId]) {
      await prisma.user.create({
        data: {
          id: user,
          name: user,
          email: `${user}@rakazo.test`,
          emailVerified: false,
        },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    for (const space of [spaceId, otherSpaceId]) {
      await prisma.space.create({
        data: { id: space, organizationId: orgId, name: "General", isDefault: space === spaceId },
      });
    }
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
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.connection.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.bot.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("creates one owned agent, is idempotent, and preserves the writes switch", async () => {
    const connection = await createConnection();
    const agent = connections();
    const first = await agent.createAgent({ connectionId: connection.id });
    await agent.setWrites({ connectionId: connection.id, enabled: true });
    const again = await agent.createAgent({ connectionId: connection.id });

    expect(again.botId).toBe(first.botId);
    expect(
      await prisma.connection.findUniqueOrThrow({ where: { id: connection.id } }),
    ).toMatchObject({ agentBotId: first.botId, writesEnabled: true });
    expect(await prisma.bot.findUniqueOrThrow({ where: { id: first.botId } })).toMatchObject({
      userId,
      spaceId,
      spawnKey: integrationAgentSpawnKey(connection.id),
    });
  });

  it("concurrent creation returns one durable agent", async () => {
    const connection = await createConnection();
    const results = await Promise.all(
      Array.from({ length: 6 }, () => connections().createAgent({ connectionId: connection.id })),
    );
    expect(new Set(results.map((result) => result.botId)).size).toBe(1);
    expect(
      await prisma.bot.count({
        where: { spaceId, userId, spawnKey: integrationAgentSpawnKey(connection.id) },
      }),
    ).toBe(1);
    expect(
      await prisma.connection.findUniqueOrThrow({ where: { id: connection.id } }),
    ).toMatchObject({ agentBotId: results[0]?.botId });
  });

  it("limits exclusive access to this connection without changing its sibling", async () => {
    const exclusive = await createConnection();
    const sibling = await createConnection();
    const agent = await connections().createAgent({ connectionId: exclusive.id });
    await connections().setExclusive({ connectionId: exclusive.id, exclusive: true });

    expect(
      await prisma.connection.findUniqueOrThrow({ where: { id: exclusive.id } }),
    ).toMatchObject({ allAgents: false, agentBotId: agent.botId });
    expect(
      await prisma.botConnectionAccess.findMany({
        where: { connectionId: exclusive.id },
        select: { botId: true },
      }),
    ).toEqual([{ botId: agent.botId }]);
    expect(await prisma.connection.findUniqueOrThrow({ where: { id: sibling.id } })).toMatchObject({
      allAgents: true,
      agentBotId: null,
    });

    await connections().setExclusive({ connectionId: exclusive.id, exclusive: false });
    expect(
      await prisma.connection.findUniqueOrThrow({ where: { id: exclusive.id } }),
    ).toMatchObject({ allAgents: true, agentBotId: agent.botId });
  });

  it("requires connected state and owner scope for create and toggles", async () => {
    const pending = await createConnection(owner, "pending");
    await expect(connections().createAgent({ connectionId: pending.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      connections(otherOwner).createAgent({ connectionId: pending.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      connections(otherOwner).setWrites({ connectionId: pending.id, enabled: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.connection.findUniqueOrThrow({ where: { id: pending.id } })).toMatchObject({
      agentBotId: null,
      writesEnabled: false,
    });
  });

  const googleConnection = (provider: string, who = owner) =>
    prisma.connection.create({
      data: {
        spaceId: who.spaceId,
        userId: who.userId,
        connectorId: "google",
        provider,
        providerRef: `ref-${provider}-${Math.random().toString(36).slice(2)}`,
        displayName: provider,
        status: "connected",
        allAgents: false,
      },
    });

  it("links every Gmail account to the one Inbox agent, with changes on, idempotently", async () => {
    const first = await googleConnection("gmail");
    const second = await googleConnection("gmail");
    const a = await connections().createAgent({ connectionId: first.id });
    const again = await connections().createAgent({ connectionId: first.id });
    const b = await connections().createAgent({ connectionId: second.id });
    expect(new Set([a.botId, again.botId, b.botId]).size).toBe(1);
    expect(await prisma.bot.findUniqueOrThrow({ where: { id: a.botId } })).toMatchObject({
      spawnKey: inboxAgentSpawnKey(userId),
    });
    expect(await prisma.connection.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      agentBotId: a.botId,
      writesEnabled: true,
    });
    expect(
      await prisma.botConnectionAccess.count({ where: { connectionId: first.id, botId: a.botId } }),
    ).toBe(1);
    expect(
      await prisma.bot.count({ where: { spawnKey: integrationAgentSpawnKey(first.id) } }),
    ).toBe(0);
    // The user's own switch survives a repeated Create agent and exclusive stays allowed.
    await connections().setWrites({ connectionId: first.id, enabled: false });
    await connections().createAgent({ connectionId: first.id });
    await connections().setExclusive({ connectionId: first.id, exclusive: true });
    await client(owner).connections.setAccess({
      connectionId: first.id,
      allAgents: true,
      botIds: [],
    });
    expect(await prisma.connection.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      writesEnabled: false,
    });
  });

  it.each(["googlecalendar", "googledrive"])(
    "creates a %s agent with changes off",
    async (provider) => {
      const google = await googleConnection(provider);
      const { botId } = await connections().createAgent({ connectionId: google.id });
      expect(await prisma.bot.findUniqueOrThrow({ where: { id: botId } })).toMatchObject({
        spawnKey: integrationAgentSpawnKey(google.id),
        name: `${provider} agent`,
      });
      expect(await prisma.connection.findUniqueOrThrow({ where: { id: google.id } })).toMatchObject(
        {
          agentBotId: botId,
          writesEnabled: false,
        },
      );
    },
  );

  it.each(["archive", "delete"] as const)("releases the app connection on bot %s", async (mode) => {
    const connection = await createConnection();
    const { botId } = await connections().createAgent({ connectionId: connection.id });
    await connections().setWrites({ connectionId: connection.id, enabled: true });
    await connections().setExclusive({ connectionId: connection.id, exclusive: true });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: botId } });
    if (mode === "archive") {
      await archiveBot(lifecycleDeps(), bot, lifecycleContext());
    } else {
      await destroyBot(lifecycleDeps(), bot, lifecycleContext(), { deleteMemories: true });
    }

    expect(
      await prisma.connection.findUniqueOrThrow({ where: { id: connection.id } }),
    ).toMatchObject({ agentBotId: null, writesEnabled: false, allAgents: true });
  });

  it("does not create or link an agent for another owner or space", async () => {
    const otherConnection = await createConnection(otherOwner);
    await expect(
      connections().createAgent({ connectionId: otherConnection.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const otherSpaceConnection = await createConnection(actor(userId, otherSpaceId));
    await expect(
      connections().createAgent({ connectionId: otherSpaceConnection.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await prisma.bot.count({
        where: { userId: otherUserId, spawnKey: integrationAgentSpawnKey(otherConnection.id) },
      }),
    ).toBe(0);
  });
});
