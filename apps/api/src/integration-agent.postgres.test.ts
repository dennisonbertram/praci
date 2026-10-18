import { createRouterClient } from "@orpc/server";
import { archiveBot, destroyBot } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { integrationAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRouter, type RouterDeps } from "./router.js";
import { listSpaceRuns } from "./runs.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("integration agents (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `ia-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const otherSpaceId = id("space2");
  const userA = id("user-a");
  const userB = id("user-b");
  const actor = (userId: string, space = spaceId): Actor => ({
    userId,
    spaceId: space,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const a = actor(userA);
  const b = actor(userB);

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let repos: ReturnType<typeof createRepos>;
  let server: { id: string };
  let plain: { id: string };
  let bServer: { id: string };

  const client = (who: Actor) =>
    createRouterClient(createRouter({ prisma } as unknown as RouterDeps), {
      context: { actor: who } as never,
    });
  const mkServer = (userId: string, slug: string, endpoint: string, space = spaceId) =>
    prisma.mcpServer.create({
      data: {
        spaceId: space,
        userId,
        slug,
        name: slug,
        transport: "streamable_http",
        endpoint,
      },
    });
  const reload = () => prisma.mcpServer.findUniqueOrThrow({ where: { id: server.id } });

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
    server = await mkServer(userA, "mercury", "https://mcp.mercury.com/mcp");
    plain = await mkServer(userA, "plain", "https://example.test/mcp");
    bServer = await mkServer(userB, "mercury-b", "https://mcp.mercury.com/mcp");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.mcpServer.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.bot.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  it("creates the agent once, links it and assigns the server", async () => {
    const first = await client(a).integrationAgents.create({ serverId: server.id });
    const again = await client(a).integrationAgents.create({ serverId: server.id });
    expect(again.botId).toBe(first.botId);
    expect(first.server).toMatchObject({ agentBotId: first.botId, agentExclusive: false });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: first.botId } });
    expect(bot).toMatchObject({
      name: "Mercury agent",
      spawnKey: integrationAgentSpawnKey(server.id),
      userId: userA,
      spaceId,
    });
    expect(bot.instructions).toContain("Mercury");
    expect(bot.description).toContain("message_bot");
    const rows = await prisma.botMcpServer.findMany({ where: { serverId: server.id } });
    expect(rows).toMatchObject([{ botId: first.botId, allowAllTools: true }]);
  });

  it("concurrent creates yield one bot", async () => {
    const s = await mkServer(userA, "brex", "https://api.brex.com/mcp");
    const results = await Promise.all(
      Array.from({ length: 6 }, () => client(a).integrationAgents.create({ serverId: s.id })),
    );
    expect(new Set(results.map((r) => r.botId)).size).toBe(1);
    expect(
      await prisma.bot.count({ where: { spaceId, spawnKey: integrationAgentSpawnKey(s.id) } }),
    ).toBe(1);
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { id: s.id } })).agentBotId).toBe(
      results[0]?.botId,
    );
  });

  it("falls back to the server name for an unknown service", async () => {
    const r = await client(a).integrationAgents.create({ serverId: plain.id });
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: r.botId } })).name).toBe(
      "plain agent",
    );
  });

  it("hides another user's or space's server as not found", async () => {
    const other = await mkServer(userA, "elsewhere", "https://example.test/x", otherSpaceId);
    for (const [who, serverId] of [
      [b, server.id],
      [a, bServer.id],
      [a, other.id],
    ] as const) {
      await expect(client(who).integrationAgents.create({ serverId })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        client(who).integrationAgents.setExclusive({ serverId, exclusive: true }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    expect(await prisma.bot.count({ where: { userId: userB } })).toBe(0);
    expect(
      (await prisma.mcpServer.findUniqueOrThrow({ where: { id: bServer.id } })).agentBotId,
    ).toBeNull();
  });

  it("setExclusive needs an agent", async () => {
    const s = await mkServer(userA, "noagent", "https://example.test/n");
    await expect(
      client(a).integrationAgents.setExclusive({ serverId: s.id, exclusive: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const on = await client(a).integrationAgents.setExclusive({
      serverId: server.id,
      exclusive: true,
    });
    expect(on.agentExclusive).toBe(true);
    const off = await client(a).integrationAgents.setExclusive({
      serverId: server.id,
      exclusive: false,
    });
    expect(off.agentExclusive).toBe(false);
  });

  it("setWrites works on a server with an agent and not on a plain one", async () => {
    const on = await client(a).mcp.servers.setWrites({ id: server.id, enabled: true });
    expect(on.writesEnabled).toBe(true);
    const s = await mkServer(userA, "plain2", "https://example.test/p2");
    await expect(
      client(a).mcp.servers.setWrites({ id: s.id, enabled: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("reserves the integration-agent spawn key in bots.create", async () => {
    await expect(
      client(a).bots.create({
        name: "Squatter",
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: true,
        computerMode: "team",
        spawnKey: integrationAgentSpawnKey("anything"),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("will not assign or copy an exclusive server to another bot", async () => {
    await client(a).integrationAgents.setExclusive({ serverId: server.id, exclusive: true });
    const agentId = (await reload()).agentBotId as string;
    const other = await repos.createBot(a, {
      name: "Other",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: false,
    });
    await expect(
      client(a).mcp.assignments.replace({
        botId: other.id,
        assignments: [{ serverId: server.id, allowAllTools: true, allowedTools: [] }],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // The agent itself may be re-saved with its server.
    await client(a).mcp.assignments.replace({
      botId: agentId,
      assignments: [{ serverId: server.id, allowAllTools: true, allowedTools: [] }],
    });
    // A shared (non-exclusive) server is still assignable to anyone.
    await client(a).integrationAgents.setExclusive({ serverId: server.id, exclusive: false });
    await client(a).mcp.assignments.replace({
      botId: other.id,
      assignments: [{ serverId: server.id, allowAllTools: true, allowedTools: [] }],
    });
    // Once the server turns exclusive, the other bot's saved row survives an unrelated save.
    await client(a).integrationAgents.setExclusive({ serverId: server.id, exclusive: true });
    await client(a).mcp.assignments.replace({ botId: other.id, assignments: [] });
    expect(
      await prisma.botMcpServer.count({ where: { botId: other.id, serverId: server.id } }),
    ).toBe(1);
    // Duplicating the agent does not copy the exclusive server.
    await client(a).integrationAgents.setExclusive({ serverId: server.id, exclusive: true });
    const copy = await client(a).bots.duplicate({ botId: agentId });
    expect(await prisma.botMcpServer.count({ where: { botId: copy.id } })).toBe(0);
    await client(a).integrationAgents.setExclusive({ serverId: server.id, exclusive: false });
  });

  const lifecycleDeps = () => ({
    prisma,
    sandbox: {} as never,
    home: {} as never,
    jobs: { cancel: async () => undefined } as never,
    dataDir: undefined,
  });
  const ctx = (who: Actor) => ({ userId: who.userId, spaceId: who.spaceId }) as never;

  for (const mode of ["archive", "delete"] as const) {
    it(`${mode} releases the server`, async () => {
      const s = await mkServer(userA, `rel-${mode}`, "https://api.brex.com/mcp");
      const created = await client(a).integrationAgents.create({ serverId: s.id });
      await client(a).integrationAgents.setExclusive({ serverId: s.id, exclusive: true });
      await client(a).mcp.servers.setWrites({ id: s.id, enabled: true });
      const bot = await prisma.bot.findUniqueOrThrow({ where: { id: created.botId } });
      if (mode === "archive") await archiveBot(lifecycleDeps(), bot, ctx(a));
      else await destroyBot(lifecycleDeps(), bot, ctx(a), { deleteMemories: true });
      expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({
        agentBotId: null,
        agentExclusive: false,
        writesEnabled: false,
      });
      // A new agent can then be made.
      const fresh = await client(a).integrationAgents.create({ serverId: s.id });
      expect(fresh.botId).not.toBe(created.botId);
    });
  }

  it("a run started by message_bot shows in the user's active activity while it waits for approval", async () => {
    const created = await client(a).integrationAgents.create({ serverId: plain.id });
    const bot = await prisma.bot.findUniqueOrThrow({
      where: { id: created.botId },
      include: { thread: true },
    });
    const task = await prisma.task.create({
      data: {
        spaceId,
        botId: bot.id,
        threadId: bot.thread?.id as string,
        userId: userA,
        prompt: "wake",
        status: "running",
      },
    });
    const run = await prisma.run.create({
      data: {
        spaceId,
        botId: bot.id,
        threadId: bot.thread?.id as string,
        taskId: task.id,
        userId: userA,
        status: "waiting_input",
        trigger: "bot_message",
      },
    });
    const mine = await listSpaceRuns(prisma, a, "active");
    expect(mine.find((row) => row.runId === run.id)).toMatchObject({
      status: "waiting_input",
      trigger: "bot_message",
      botId: bot.id,
    });
    expect((await listSpaceRuns(prisma, b, "active")).some((row) => row.runId === run.id)).toBe(
      false,
    );
  });
});
