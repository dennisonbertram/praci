import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { integrationAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("per-agent access changes (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `aac-${name}-${suffix}`;
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
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  type Access = { allAgents: boolean; botIds: string[]; writeBotIds: string[] };
  const api = (who = actor(userId)) => {
    const c = createRouterClient(
      createRouter({ prisma, env: { mailWritesDisabled: false } } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );
    return c as unknown as {
      connections: {
        access(i: { connectionId: string }): Promise<Access>;
        accessAll(): Promise<Record<string, Access>>;
        setAccess(i: {
          connectionId: string;
          allAgents: boolean;
          botIds: string[];
        }): Promise<Access>;
        setAgentAccess(i: {
          connectionId: string;
          botId: string;
          on: boolean;
          canWrite?: boolean;
        }): Promise<Access>;
      };
      mcp: {
        servers: {
          setAgentAssignment(i: { serverId: string; botId: string; on: boolean }): Promise<unknown>;
        };
      };
    };
  };
  const makeBot = (name: string, extra: Record<string, unknown> = {}, who = actor(userId)) =>
    prisma.bot.create({
      data: {
        id: id(name),
        name,
        color: "#000",
        spaceId: who.spaceId,
        userId: who.userId,
        ...extra,
      } as never,
    });
  const makeConnection = (who = actor(userId)) =>
    prisma.connection.create({
      data: {
        spaceId: who.spaceId,
        userId: who.userId,
        connectorId: "composio",
        provider: "SLACK",
        providerRef: `acct-${Math.random()}`,
        displayName: "Slack",
        status: "connected",
      },
    });

  /** A connection with its own agent, created the way the server expects. */
  const makeLinked = async (name: string) => {
    const conn = await makeConnection();
    const agent = await makeBot(name, { spawnKey: integrationAgentSpawnKey(conn.id) });
    await prisma.connection.update({
      where: { id: conn.id },
      data: { agentBotId: agent.id, writesEnabled: true },
    });
    await prisma.botConnectionAccess.create({
      data: { connectionId: conn.id, botId: agent.id, spaceId, userId },
    });
    return { conn, agent };
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const user of [userId, otherUserId])
      await prisma.user.create({
        data: { id: user, name: user, email: `${user}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    for (const space of [spaceId, otherSpaceId])
      await prisma.space.create({
        data: { id: space, organizationId: orgId, name: "General", isDefault: space === spaceId },
      });
    for (const user of [userId, otherUserId])
      await prisma.member.create({
        data: {
          id: id(`member-${user}`),
          organizationId: orgId,
          userId: user,
          role: "member",
          createdAt: new Date(),
        },
      });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.mcpServer.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.connection.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.bot.deleteMany({ where: { spaceId: { in: [spaceId, otherSpaceId] } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("two concurrent revokes of different agents both stick", async () => {
    const [a, b, c] = await Promise.all([makeBot("a"), makeBot("b"), makeBot("c")]);
    const conn = await makeConnection();
    await api().connections.setAccess({
      connectionId: conn.id,
      allAgents: false,
      botIds: [a.id, b.id, c.id],
    });
    await Promise.all([
      api().connections.setAgentAccess({ connectionId: conn.id, botId: a.id, on: false }),
      api().connections.setAgentAccess({ connectionId: conn.id, botId: b.id, on: false }),
    ]);
    expect((await api().connections.access({ connectionId: conn.id })).botIds).toEqual([c.id]);
  });

  it("leaving all agents does not grant a firewalled agent, and turning one on grants it", async () => {
    const x = await makeBot("x");
    const fw = await makeBot("fw", { firewall: true });
    const conn = await makeConnection();
    await api().connections.setAccess({ connectionId: conn.id, allAgents: true, botIds: [] });
    await api().connections.setAgentAccess({ connectionId: conn.id, botId: x.id, on: false });
    const after = await api().connections.access({ connectionId: conn.id });
    expect(after.allAgents).toBe(false);
    expect(after.botIds).not.toContain(fw.id);
    expect(after.botIds).not.toContain(x.id);

    const conn2 = await makeConnection();
    await api().connections.setAccess({ connectionId: conn2.id, allAgents: true, botIds: [] });
    await api().connections.setAgentAccess({ connectionId: conn2.id, botId: fw.id, on: true });
    expect((await api().connections.access({ connectionId: conn2.id })).botIds).toContain(fw.id);
  });

  it("refuses another user's connection or agent and another space's data", async () => {
    const mine = await makeBot("mine");
    const conn = await makeConnection();
    const stranger = actor(otherUserId);
    await expect(
      api(stranger).connections.setAgentAccess({ connectionId: conn.id, botId: mine.id, on: true }),
    ).rejects.toThrow();
    const theirs = await makeBot("theirs", {}, stranger);
    await expect(
      api().connections.setAgentAccess({ connectionId: conn.id, botId: theirs.id, on: true }),
    ).rejects.toThrow();
    const otherSpace = actor(userId, otherSpaceId);
    expect(Object.keys(await api(otherSpace).connections.accessAll())).not.toContain(conn.id);
    const batched = await api().connections.accessAll();
    expect(batched[conn.id]).toBeDefined();
  });

  it("assigns one server to one agent and concurrent changes both stick", async () => {
    const [a, b] = await Promise.all([makeBot("sa"), makeBot("sb")]);
    const server = await prisma.mcpServer.create({
      data: {
        spaceId,
        userId,
        slug: `s-${suffix}`,
        name: "Docs",
        description: "",
        transport: "http",
        endpoint: "https://example.test/mcp",
      } as never,
    });
    await Promise.all([
      api().mcp.servers.setAgentAssignment({ serverId: server.id, botId: a.id, on: true }),
      api().mcp.servers.setAgentAssignment({ serverId: server.id, botId: b.id, on: true }),
    ]);
    await api().mcp.servers.setAgentAssignment({ serverId: server.id, botId: a.id, on: false });
    const rows = await prisma.botMcpServer.findMany({ where: { serverId: server.id } });
    expect(rows.map((row) => row.botId)).toEqual([b.id]);
    await expect(
      api(actor(otherUserId)).mcp.servers.setAgentAssignment({
        serverId: server.id,
        botId: a.id,
        on: true,
      }),
    ).rejects.toThrow();
  });

  it("allow changes starts off, is set per agent, survives All, and None clears it", async () => {
    const { conn, agent: owner } = await makeLinked("wo");
    const a = await makeBot("wa");
    const b = await makeBot("wb");
    await api().connections.setAccess({
      connectionId: conn.id,
      allAgents: false,
      botIds: [owner.id],
    });
    const on = await api().connections.setAgentAccess({
      connectionId: conn.id,
      botId: a.id,
      on: true,
    });
    expect(on.botIds).toContain(a.id);
    expect(on.writeBotIds).toEqual([]);
    const write = await api().connections.setAgentAccess({
      connectionId: conn.id,
      botId: a.id,
      on: true,
      canWrite: true,
    });
    expect(write.writeBotIds).toEqual([a.id]);
    // Turning on another agent leaves a's setting alone.
    await api().connections.setAgentAccess({ connectionId: conn.id, botId: b.id, on: true });
    expect((await api().connections.access({ connectionId: conn.id })).writeBotIds).toEqual([a.id]);
    // All keeps it for the agent that is already on.
    const all = await api().connections.setAccess({
      connectionId: conn.id,
      allAgents: true,
      botIds: [],
    });
    expect(all.writeBotIds).toEqual([a.id]);
    // None clears it.
    const none = await api().connections.setAccess({
      connectionId: conn.id,
      allAgents: false,
      botIds: [owner.id],
    });
    expect(none.writeBotIds).toEqual([]);
  });

  it("refuses allow changes for an external agent, a plain connection, or another user", async () => {
    const { agent: owner } = await makeLinked("xo");
    const ext = await makeBot("xe", { audience: "external" });
    const plain = await makeConnection();
    await expect(
      api().connections.setAgentAccess({
        connectionId: plain.id,
        botId: owner.id,
        on: true,
        canWrite: true,
      }),
    ).rejects.toThrow();
    const linked = (await makeLinked("xl")).conn;
    await expect(
      api().connections.setAgentAccess({
        connectionId: linked.id,
        botId: ext.id,
        on: true,
        canWrite: true,
      }),
    ).rejects.toThrow();
    await expect(
      api(actor(otherUserId)).connections.setAgentAccess({
        connectionId: linked.id,
        botId: owner.id,
        on: true,
        canWrite: true,
      }),
    ).rejects.toThrow();
  });

  it("keeps a firewalled agent's label scope when another agent's access changes", async () => {
    const { conn, agent: owner } = await makeLinked("lo");
    const fw = await makeBot("lf", { firewall: true });
    const other = await makeBot("lx");
    await api().connections.setAccess({
      connectionId: conn.id,
      allAgents: false,
      botIds: [owner.id, fw.id],
    });
    await prisma.botConnectionAccess.update({
      where: { connectionId_botId: { connectionId: conn.id, botId: fw.id } },
      data: { supportLabel: "Label_support" },
    });
    const label = async () =>
      (
        await prisma.botConnectionAccess.findUniqueOrThrow({
          where: { connectionId_botId: { connectionId: conn.id, botId: fw.id } },
        })
      ).supportLabel;
    await api().connections.setAgentAccess({ connectionId: conn.id, botId: other.id, on: true });
    expect(await label()).toBe("Label_support");
    await api().connections.setAgentAccess({ connectionId: conn.id, botId: other.id, on: false });
    expect(await label()).toBe("Label_support");
    await api().connections.setAccess({
      connectionId: conn.id,
      allAgents: false,
      botIds: [owner.id, fw.id, other.id],
    });
    expect(await label()).toBe("Label_support");
  });
});
