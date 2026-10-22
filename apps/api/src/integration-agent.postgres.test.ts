import { createRouterClient } from "@orpc/server";
import type { AgentRunRequest } from "@rakazo/adapter-kit";
import {
  archiveBot,
  createFinanceCallToolFor,
  createRunExecutor,
  destroyBot,
  FakeSandboxProvider,
  McpConnector,
  ScriptedAgentRuntime,
  syncFinanceForUser,
} from "@rakazo/adapters";
import type { Actor, MessageBlock } from "@rakazo/contracts";
import {
  CARTA_MCP_ENDPOINT,
  CARTA_READ_TOOLS,
  CARTA_WRITE_TOOLS,
  cartaAgentSpawnKey,
  gtmAgentSpawnKey,
  integrationAgentSpawnKey,
  ZERNIO_MCP_ENDPOINT,
  ZERNIO_READ_TOOLS,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos, createThreadEvents } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { isIntegrationAgentWrite } from "../../../packages/adapters/src/approval-ask.js";
import { isApprovalPausedResult } from "../../../packages/adapters/src/approval-effect.js";
import type * as ComputerLifecycleModule from "../../../packages/adapters/src/computer-lifecycle.js";
import {
  fakeMercury,
  fakeMercuryMcpFetch,
  MERCURY_CHECKING,
  mercuryRow,
} from "../../../packages/adapters/src/finance-fake-tools.js";
import { integrationAgentDenial } from "../../../packages/adapters/src/mcp-connector.js";
import type { FinanceDeps } from "./finance.js";
import { financeReceiptUrl } from "./finance.js";
import { ensureIntegrationAgent } from "./integration-agent.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";
import { listSpaceRuns } from "./runs.js";

vi.mock("../../../packages/adapters/src/computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  provisionComputer: async () => ({ id: "synthetic-computer", kind: "desktop" }),
}));

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("integration agents (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `ia-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const otherSpaceId = id("space2");
  const capabilitySpaceId = id("capability-space");
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
    createRouterClient(
      createRouter({ prisma, env: { mailWritesDisabled: true } } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );
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
    for (const sid of [spaceId, otherSpaceId, capabilitySpaceId]) {
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
    await prisma.spaceMember.create({
      data: {
        id: id("space-member-other"),
        spaceId: otherSpaceId,
        organizationId: orgId,
        userId: userA,
        role: "member",
        createdAt: new Date(),
      },
    });
    await prisma.spaceMember.create({
      data: {
        id: id("space-member-capability"),
        spaceId: capabilitySpaceId,
        organizationId: orgId,
        userId: userA,
        role: "member",
        createdAt: new Date(),
      },
    });
    server = await mkServer(userA, "mercury", "https://mcp.mercury.com/mcp");
    plain = await mkServer(userA, "plain", "https://example.test/mcp");
    bServer = await mkServer(userB, "mercury-b", "https://mcp.mercury.com/mcp");
  });

  afterAll(async () => {
    if (!prisma) return;
    const testSpaces = [spaceId, otherSpaceId, capabilitySpaceId];
    await prisma.mcpServer.deleteMany({ where: { spaceId: { in: testSpaces } } });
    await prisma.bot.deleteMany({ where: { spaceId: { in: testSpaces } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  const lifecycleDeps = () => ({
    prisma,
    sandbox: {} as never,
    home: {} as never,
    jobs: { cancel: async () => undefined } as never,
    dataDir: undefined,
  });
  const ctx = (who: Actor) => ({ userId: who.userId, spaceId: who.spaceId }) as never;
  const archiveById = async (botId: string) =>
    archiveBot(
      lifecycleDeps(),
      await prisma.bot.findUniqueOrThrow({ where: { id: botId } }),
      ctx(a),
    );
  const editorClient = () =>
    createRouterClient(
      createRouter({
        prisma,
        env: {},
        remoteConnectors: { resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }] },
        sandbox: {},
        home: {},
        jobs: { cancel: async () => undefined },
      } as unknown as RouterDeps),
      { context: { actor: a } as never },
    );

  const zernioListServerTools = vi.fn(async () => {
    throw new Error("Zernio tool probing is forbidden during provisioning");
  });
  let zernioSecretSequence = 0;
  const zernioSecrets = {
    put: async (plaintext: string) => ({
      id: `zernio-secret-${suffix}-${++zernioSecretSequence}`,
      ciphertext: plaintext,
    }),
    load: async (ciphertext: string) => {
      if (ciphertext === "unreadable") throw new Error("synthetic unreadable secret");
      return ciphertext;
    },
  };
  const zernioClient = (who: Actor = a) =>
    createRouterClient(
      createRouter({
        prisma,
        env: { webOrigin: "http://localhost", sandboxProvider: "docker" },
        remoteConnectors: {
          resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
        },
        secrets: zernioSecrets,
        mcp: { listServerTools: zernioListServerTools, callServerTool: async () => ({}) },
        jobs: { enqueue: async () => undefined, cancel: async () => undefined },
        sandbox: {},
        home: {},
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );
  const updateMcp = (
    who: Actor,
    server: { id: string; slug: string; name: string },
    endpoint: string,
    enabled: boolean,
  ) =>
    zernioClient(who).mcp.servers.update({
      id: server.id,
      config: {
        slug: server.slug,
        name: server.name,
        description: "",
        enabled,
        transport: "streamable_http",
        endpoint,
        headers: {},
      },
    } as never);

  it("creates the agent once, links it and assigns the server", async () => {
    const first = await client(a).integrationAgents.create({ serverId: server.id });
    const again = await client(a).integrationAgents.create({ serverId: server.id });
    expect(again.botId).toBe(first.botId);
    expect(first.server).toMatchObject({ agentBotId: first.botId, agentExclusive: true });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: first.botId } });
    expect(bot).toMatchObject({
      name: "Mercury agent",
      spawnKey: integrationAgentSpawnKey(server.id),
      userId: userA,
      spaceId,
    });
    expect(bot.instructions).toContain("Mercury");
    expect(bot.instructions).toContain("Mercury may also hold it for its own approval");
    expect(bot.description).toBe("Reads your Mercury balances and transactions.");
    expect(bot.description).not.toContain("message_bot");
    expect(bot.instructions).toContain('turn on "Allow changes in Mercury"');
    // Changes on: the agent calls the tool so the approval card appears, never asks in chat.
    expect(bot.instructions).toContain("never ask for confirmation in chat");
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

  it("creates Carta through its specialized agent and preserves switches across idempotent create", async () => {
    const carta = await mkServer(userA, "carta-ia", CARTA_MCP_ENDPOINT);
    const first = await client(a).integrationAgents.create({ serverId: carta.id });
    const again = await client(a).integrationAgents.create({ serverId: carta.id });
    expect(again.botId).toBe(first.botId);
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: first.botId } });
    expect(bot).toMatchObject({
      name: "Carta agent",
      spawnKey: cartaAgentSpawnKey(userA),
      userId: userA,
      spaceId,
    });
    expect(bot.instructions).toContain("ask the Investors agent");
    expect(first.server).toMatchObject({
      agentBotId: first.botId,
      agentExclusive: true,
      writesEnabled: false,
    });
    await client(a).integrationAgents.setExclusive({ serverId: carta.id, exclusive: false });
    await client(a).mcp.servers.setWrites({ id: carta.id, enabled: true });
    const preserved = await client(a).integrationAgents.create({ serverId: carta.id });
    expect(preserved.botId).toBe(first.botId);
    expect(preserved.server).toMatchObject({
      agentBotId: first.botId,
      agentExclusive: false,
      writesEnabled: true,
    });
    expect(
      await prisma.bot.count({ where: { spaceId, spawnKey: cartaAgentSpawnKey(userA) } }),
    ).toBe(1);
    expect(
      await prisma.botMcpServer.findUniqueOrThrow({
        where: { botId_serverId: { botId: first.botId, serverId: carta.id } },
      }),
    ).toMatchObject({
      allowAllTools: false,
      allowedTools: [...CARTA_READ_TOOLS, ...CARTA_WRITE_TOOLS],
    });
  });

  it("never links an agent that was archived while it was being created", async () => {
    const s = await mkServer(userA, "race-create", "https://api.brex.com/mcp");
    let archived: string | undefined;
    const racing = {
      ...repos,
      createBot: async (...args: Parameters<typeof repos.createBot>) => {
        const bot = await repos.createBot(...args);
        if (!archived) {
          archived = bot.id;
          const row = await prisma.bot.findUniqueOrThrow({ where: { id: bot.id } });
          await archiveBot(lifecycleDeps(), row, ctx(a));
        }
        return bot;
      },
    };
    const { server: linked, bot } = await ensureIntegrationAgent(
      { prisma, repos: racing, archiveBot: archiveById },
      a,
      s.id,
    );
    expect(bot.id).not.toBe(archived);
    expect(linked.agentBotId).toBe(bot.id);
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: bot.id } })).archivedAt).toBeNull();
    expect(await prisma.botMcpServer.count({ where: { botId: archived } })).toBe(0);
  });

  it("setWrites cannot re-enable writes on a server released after its check", async () => {
    const s = await mkServer(userA, "race-writes", "https://api.brex.com/mcp");
    const created = await client(a).integrationAgents.create({ serverId: s.id });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: created.botId } });
    // Archive after the server read but before its linked agent is locked.
    let fired = false;
    const racing = new Proxy(prisma, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop !== "$transaction") return value;
        return (callback: (tx: PrismaClient) => unknown) =>
          target.$transaction(((tx: PrismaClient) =>
            callback(
              new Proxy(tx, {
                get(transaction, modelName, transactionReceiver) {
                  const model = Reflect.get(transaction, modelName, transactionReceiver);
                  if (modelName !== "bot") return model;
                  return new Proxy(model, {
                    get(botModel, method, botReceiver) {
                      if (method !== "findFirst") return Reflect.get(botModel, method, botReceiver);
                      return async (args: never) => {
                        if (!fired) {
                          fired = true;
                          await archiveBot(lifecycleDeps(), bot, ctx(a));
                        }
                        return botModel.findFirst(args);
                      };
                    },
                  });
                },
              }),
            )) as never);
      },
    });
    const racer = createRouterClient(
      createRouter({ prisma: racing, env: { mailWritesDisabled: true } } as unknown as RouterDeps),
      { context: { actor: a } as never },
    );
    await expect(racer.mcp.servers.setWrites({ id: s.id, enabled: true })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(fired).toBe(true);
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({
      agentBotId: null,
      writesEnabled: false,
    });
  });

  /** A router whose first server updateMany first runs `before`, to land a change between check and update. */
  const racingClient = (before: () => Promise<unknown>, extra: object = {}) => {
    let fired = false;
    const racing = new Proxy(prisma, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop !== "mcpServer") return value;
        return new Proxy(value, {
          get(model, method, r) {
            if (method !== "updateMany") return Reflect.get(model, method, r);
            return async (args: never) => {
              if (!fired) {
                fired = true;
                await before();
              }
              return model.updateMany(args);
            };
          },
        });
      },
    });
    return createRouterClient(
      createRouter({
        prisma: racing,
        env: { mailWritesDisabled: true },
        ...extra,
      } as unknown as RouterDeps),
      { context: { actor: a } as never },
    );
  };

  it("setExclusive cannot change a server released after its check", async () => {
    const s = await mkServer(userA, "race-excl", "https://api.brex.com/mcp");
    const created = await client(a).integrationAgents.create({ serverId: s.id });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: created.botId } });
    const racer = racingClient(() => archiveBot(lifecycleDeps(), bot, ctx(a)));
    await expect(
      racer.integrationAgents.setExclusive({ serverId: s.id, exclusive: true }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({
      agentBotId: null,
      agentExclusive: false,
    });
  });

  it("setExclusive rejects a server changed to Zernio after its read", async () => {
    const s = await mkServer(userA, "race-excl-zernio", "https://api.brex.com/mcp");
    await client(a).integrationAgents.create({ serverId: s.id });
    const racer = racingClient(() =>
      prisma.mcpServer.update({ where: { id: s.id }, data: { endpoint: ZERNIO_MCP_ENDPOINT } }),
    );
    await expect(
      racer.integrationAgents.setExclusive({ serverId: s.id, exclusive: true }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({
      endpoint: ZERNIO_MCP_ENDPOINT,
      agentExclusive: true,
    });
  });

  it("create refuses a server edited to Carta while the agent was being created", async () => {
    const s = await mkServer(userA, "race-carta", "https://api.brex.com/mcp");
    const racing = {
      ...repos,
      createBot: async (...args: Parameters<typeof repos.createBot>) => {
        const bot = await repos.createBot(...args);
        await prisma.mcpServer.update({
          where: { id: s.id },
          data: { endpoint: "https://mcp.app.carta.com/mcp" },
        });
        return bot;
      },
    };
    await expect(
      ensureIntegrationAgent({ prisma, repos: racing, archiveBot: archiveById }, a, s.id),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(
      (await prisma.mcpServer.findUniqueOrThrow({ where: { id: s.id } })).agentBotId,
    ).toBeNull();
  });

  it("create archives the bot it made when linking fails, but not one that existed", async () => {
    const toCarta = (s: { id: string }) => ({
      ...repos,
      createBot: async (...args: Parameters<typeof repos.createBot>) => {
        const bot = await repos.createBot(...args);
        await prisma.mcpServer.update({
          where: { id: s.id },
          data: { endpoint: "https://mcp.app.carta.com/mcp" },
        });
        return bot;
      },
    });
    const fresh = await mkServer(userA, "fail-new", "https://api.brex.com/mcp");
    await expect(
      ensureIntegrationAgent(
        { prisma, repos: toCarta(fresh), archiveBot: archiveById },
        a,
        fresh.id,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (
        await prisma.bot.findFirstOrThrow({
          where: { spaceId, spawnKey: integrationAgentSpawnKey(fresh.id) },
        })
      ).archivedAt,
    ).not.toBeNull();

    const old = await mkServer(userA, "fail-existing", "https://api.brex.com/mcp");
    const first = await client(a).integrationAgents.create({ serverId: old.id });
    await prisma.mcpServer.update({ where: { id: old.id }, data: { agentBotId: null } });
    await expect(
      ensureIntegrationAgent({ prisma, repos: toCarta(old), archiveBot: archiveById }, a, old.id),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (await prisma.bot.findUniqueOrThrow({ where: { id: first.botId } })).archivedAt,
    ).toBeNull();
  });

  it("rejects generic linking if the endpoint changes to Zernio mid-link", async () => {
    const target = await mkServer(userA, "race-zernio", "https://api.brex.com/mcp");
    const switching = {
      ...repos,
      createBot: async (...args: Parameters<typeof repos.createBot>) => {
        const bot = await repos.createBot(...args);
        await prisma.mcpServer.update({
          where: { id: target.id },
          data: { endpoint: ZERNIO_MCP_ENDPOINT },
        });
        return bot;
      },
    };
    await expect(
      ensureIntegrationAgent({ prisma, repos: switching, archiveBot: archiveById }, a, target.id),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (await prisma.mcpServer.findUniqueOrThrow({ where: { id: target.id } })).agentBotId,
    ).toBeNull();
  });

  it("editing a server to another service archives its agent, and create then makes a fresh one", async () => {
    const s = await mkServer(userA, "edit-service", "https://mcp.mercury.com/mcp");
    const old = await client(a).integrationAgents.create({ serverId: s.id });
    await editorClient().mcp.servers.update({
      id: s.id,
      config: {
        slug: "edit-service",
        name: "edit-service",
        description: "",
        enabled: true,
        transport: "streamable_http",
        endpoint: "https://api.brex.com/mcp",
        headers: {},
      },
    } as never);
    expect(
      (await prisma.bot.findUniqueOrThrow({ where: { id: old.botId } })).archivedAt,
    ).not.toBeNull();
    const fresh = await client(a).integrationAgents.create({ serverId: s.id });
    expect(fresh.botId).not.toBe(old.botId);
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: fresh.botId } })).name).toBe(
      "Brex agent",
    );
  });

  it("replace spares a row whose server turned exclusive after the read", async () => {
    const s = await mkServer(userA, "race-replace", "https://api.brex.com/mcp");
    await client(a).integrationAgents.create({ serverId: s.id });
    // A new agent starts exclusive; this test is about sharing turned on and then off again.
    await prisma.mcpServer.update({ where: { id: s.id }, data: { agentExclusive: false } });
    const other = await repos.createBot(a, {
      name: "Other2",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: false,
    });
    await client(a).mcp.assignments.replace({
      botId: other.id,
      assignments: [{ serverId: s.id, allowAllTools: true, allowedTools: [] }],
    });
    // Exclusivity turns on after replace read the exclusive list, before it deletes.
    let fired = false;
    const hook = (tx: PrismaClient) =>
      new Proxy(tx, {
        get(target, prop, receiver) {
          const value = Reflect.get(target, prop, receiver);
          if (prop !== "botMcpServer") return value;
          return new Proxy(value, {
            get(model, method, r) {
              if (method !== "deleteMany") return Reflect.get(model, method, r);
              return async (args: never) => {
                if (!fired) {
                  fired = true;
                  await prisma.mcpServer.update({
                    where: { id: s.id },
                    data: { agentExclusive: true },
                  });
                }
                return model.deleteMany(args);
              };
            },
          });
        },
      });
    const racing = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop !== "$transaction") return Reflect.get(target, prop, receiver);
        return (fn: (tx: PrismaClient) => unknown) =>
          target.$transaction(((tx: PrismaClient) => fn(hook(tx))) as never);
      },
    });
    const racer = createRouterClient(
      createRouter({ prisma: racing, env: { mailWritesDisabled: true } } as unknown as RouterDeps),
      { context: { actor: a } as never },
    );
    await racer.mcp.assignments.replace({ botId: other.id, assignments: [] });
    expect(fired).toBe(true);
    expect(await prisma.botMcpServer.count({ where: { botId: other.id, serverId: s.id } })).toBe(1);
  });

  it("editing a server's endpoint to Carta links its specialized agent", async () => {
    const cartaServer = await mkServer(userA, "existing-carta", CARTA_MCP_ENDPOINT);
    const cartaAgent = await client(a).integrationAgents.create({ serverId: cartaServer.id });
    const s = await mkServer(userA, "edit-endpoint", "https://api.brex.com/mcp");
    await client(a).integrationAgents.create({ serverId: s.id });
    await client(a).integrationAgents.setExclusive({ serverId: s.id, exclusive: true });
    await client(a).mcp.servers.setWrites({ id: s.id, enabled: true });
    const editor = editorClient();
    await editor.mcp.servers.update({
      id: s.id,
      config: {
        slug: "edit-endpoint",
        name: "edit-endpoint",
        description: "",
        enabled: true,
        transport: "streamable_http",
        endpoint: "https://mcp.app.carta.com/mcp",
        headers: {},
      },
    } as never);
    const updated = await prisma.mcpServer.findUniqueOrThrow({ where: { id: s.id } });
    expect(updated).toMatchObject({
      agentBotId: cartaAgent.botId,
      agentExclusive: true,
      writesEnabled: false,
    });
    expect(
      await prisma.bot.findUniqueOrThrow({ where: { id: updated.agentBotId! } }),
    ).toMatchObject({ spawnKey: cartaAgentSpawnKey(a.userId), archivedAt: null });
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

  it("provisions Zernio as an exclusive read-only GTM server without probing tools", async () => {
    zernioListServerTools.mockClear();
    const created = await zernioClient().mcp.servers.create({
      transport: "streamable_http",
      slug: `zernio-${suffix}`,
      name: "Zernio",
      endpoint: ZERNIO_MCP_ENDPOINT,
      headers: {},
      secret: "synthetic-zernio-key",
      enabled: true,
    });
    expect(zernioListServerTools).not.toHaveBeenCalled();
    expect(created).toMatchObject({
      endpoint: ZERNIO_MCP_ENDPOINT,
      agentExclusive: true,
      writesEnabled: false,
    });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: created.agentBotId! } });
    expect(bot.spawnKey).toBe(gtmAgentSpawnKey(userA));
    expect(
      await prisma.botMcpServer.findUniqueOrThrow({
        where: { botId_serverId: { botId: bot.id, serverId: created.id } },
      }),
    ).toMatchObject({ allowAllTools: false, allowedTools: [...ZERNIO_READ_TOOLS] });
    const oauthServer = await zernioClient().mcp.servers.create({
      transport: "streamable_http",
      slug: `zernio-oauth-${suffix}`,
      name: "Zernio OAuth connection",
      endpoint: ZERNIO_MCP_ENDPOINT,
      headers: {},
      enabled: true,
    });
    expect(oauthServer).toMatchObject({
      enabled: true,
      agentExclusive: true,
      writesEnabled: false,
      agentBotId: bot.id,
    });
    expect(
      await prisma.mcpServer.findUniqueOrThrow({
        where: { id: oauthServer.id },
        select: { id: true },
      }),
    ).toEqual({ id: oauthServer.id });
    expect(zernioListServerTools).not.toHaveBeenCalled();
    await expect(
      zernioClient().integrationAgents.setExclusive({ serverId: created.id, exclusive: false }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      zernioClient().mcp.servers.setWrites({ id: created.id, enabled: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("relinks Zernio from a generic agent and archives only that orphan", async () => {
    const server = await mkServer(userA, `zernio-relink-${suffix}`, ZERNIO_MCP_ENDPOINT);
    const disabled = await mkServer(userA, `zernio-disabled-${suffix}`, ZERNIO_MCP_ENDPOINT);
    await prisma.mcpServer.update({
      where: { id: disabled.id },
      data: { enabled: false },
    });
    const orphan = await repos.createBot(a, {
      name: "Old Zernio agent",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: false,
      spawnKey: integrationAgentSpawnKey(server.id),
    });
    const unrelated = await repos.createBot(a, {
      name: "Unrelated",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: false,
    });
    await prisma.botMcpServer.create({
      data: {
        spaceId,
        userId: userA,
        botId: unrelated.id,
        serverId: disabled.id,
        allowAllTools: true,
        allowedTools: [],
      },
    });
    await prisma.mcpServer.update({
      where: { id: server.id },
      data: { agentBotId: orphan.id, agentExclusive: true, writesEnabled: true },
    });
    const linked = await zernioClient().integrationAgents.create({ serverId: server.id });
    expect(linked.botId).not.toBe(orphan.id);
    expect(
      await prisma.bot.findUniqueOrThrow({
        where: { id: orphan.id },
        select: { archivedAt: true },
      }),
    ).toEqual({ archivedAt: expect.any(Date) });
    expect(
      await prisma.bot.findUniqueOrThrow({
        where: { id: unrelated.id },
        select: { archivedAt: true },
      }),
    ).toEqual({ archivedAt: null });
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: server.id } })).toMatchObject({
      agentBotId: linked.botId,
      agentExclusive: true,
      writesEnabled: false,
    });
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: disabled.id } })).toMatchObject({
      agentBotId: linked.botId,
      agentExclusive: true,
      writesEnabled: false,
    });
    expect(await prisma.botMcpServer.count({ where: { serverId: disabled.id } })).toBe(0);
  });

  it("does not archive a generic agent still linked to another server", async () => {
    const isolated = actor(userA, otherSpaceId);
    const zernio = await mkServer(
      userA,
      `zernio-shared-${suffix}`,
      ZERNIO_MCP_ENDPOINT,
      otherSpaceId,
    );
    const other = await mkServer(
      userA,
      `zernio-shared-other-${suffix}`,
      "https://api.brex.com/mcp",
      otherSpaceId,
    );
    const shared = await repos.createBot(isolated, {
      name: "Shared integration agent",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: false,
      spawnKey: integrationAgentSpawnKey(zernio.id),
    });
    await prisma.mcpServer.updateMany({
      where: { id: { in: [zernio.id, other.id] } },
      data: { agentBotId: shared.id },
    });

    await client(isolated).integrationAgents.create({ serverId: zernio.id });

    expect(
      await prisma.bot.findUniqueOrThrow({
        where: { id: shared.id },
        select: { archivedAt: true },
      }),
    ).toEqual({ archivedAt: null });
    expect(
      await prisma.mcpServer.findUniqueOrThrow({
        where: { id: other.id },
        select: { agentBotId: true },
      }),
    ).toEqual({ agentBotId: shared.id });
  });

  it("removing one Zernio link keeps the GTM agent, routine, and other link active", async () => {
    const first = await zernioClient().mcp.servers.create({
      transport: "streamable_http",
      slug: `zernio-remove-one-${suffix}`,
      name: "Zernio one",
      endpoint: ZERNIO_MCP_ENDPOINT,
      headers: {},
      enabled: true,
    });
    const second = await zernioClient().mcp.servers.create({
      transport: "streamable_http",
      slug: `zernio-remove-two-${suffix}`,
      name: "Zernio two",
      endpoint: ZERNIO_MCP_ENDPOINT,
      headers: {},
      enabled: true,
    });
    const bot = await zernioClient().gtm.agent();
    const routine = await prisma.routine.findFirstOrThrow({ where: { botId: bot.id } });
    await editorClient().mcp.servers.remove({ id: first.id });

    expect(
      await prisma.bot.findUniqueOrThrow({ where: { id: bot.id }, select: { archivedAt: true } }),
    ).toEqual({ archivedAt: null });
    expect(
      await prisma.routine.findUniqueOrThrow({
        where: { id: routine.id },
        select: { active: true },
      }),
    ).toEqual({ active: true });
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
      agentBotId: bot.id,
      agentExclusive: true,
      writesEnabled: false,
    });
    const assignments = await prisma.botMcpServer.findMany({
      where: { botId: bot.id },
      select: { serverId: true },
    });
    expect(assignments).toContainEqual({ serverId: second.id });
    expect(assignments).not.toContainEqual({ serverId: first.id });
  });

  it("moving a generic server to Zernio links closed reads without creating a routine", async () => {
    const isolated = actor(userA, otherSpaceId);
    const server = await mkServer(
      userA,
      `move-into-zernio-${suffix}`,
      "https://api.brex.com/mcp",
      otherSpaceId,
    );
    const generic = await client(isolated).integrationAgents.create({ serverId: server.id });
    const linked = await updateMcp(isolated, server, ZERNIO_MCP_ENDPOINT, true);

    expect(linked).toMatchObject({
      agentBotId: expect.any(String),
      agentExclusive: true,
      writesEnabled: false,
    });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: linked.agentBotId! } });
    expect(bot.spawnKey).toBe(gtmAgentSpawnKey(userA));
    expect(
      await prisma.bot.findUniqueOrThrow({
        where: { id: generic.botId },
        select: { archivedAt: true },
      }),
    ).toEqual({ archivedAt: expect.any(Date) });
    expect(await prisma.routine.count({ where: { botId: bot.id } })).toBe(0);
    expect(
      await prisma.botMcpServer.findUniqueOrThrow({
        where: { botId_serverId: { botId: bot.id, serverId: server.id } },
      }),
    ).toMatchObject({ allowAllTools: false, allowedTools: [...ZERNIO_READ_TOOLS] });
  });

  it("moving Zernio away preserves the GTM bot and reconciles enabled assignments", async () => {
    const isolated = actor(userA, otherSpaceId);
    const first = await zernioClient(isolated).mcp.servers.create({
      transport: "streamable_http",
      slug: `zernio-move-out-one-${suffix}`,
      name: "Zernio one",
      endpoint: ZERNIO_MCP_ENDPOINT,
      headers: {},
      enabled: true,
    });
    const second = await zernioClient(isolated).mcp.servers.create({
      transport: "streamable_http",
      slug: `zernio-move-out-two-${suffix}`,
      name: "Zernio two",
      endpoint: ZERNIO_MCP_ENDPOINT,
      headers: {},
      enabled: true,
    });
    const bot = await zernioClient(isolated).gtm.agent();
    await updateMcp(isolated, first, "https://api.brex.com/mcp", true);
    expect(
      await prisma.bot.findUniqueOrThrow({ where: { id: bot.id }, select: { archivedAt: true } }),
    ).toEqual({ archivedAt: null });
    expect(
      await prisma.botMcpServer.findFirst({ where: { botId: bot.id, serverId: first.id } }),
    ).toBeNull();
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: second.id } })).toMatchObject({
      agentBotId: bot.id,
      agentExclusive: true,
      writesEnabled: false,
    });

    await updateMcp(isolated, second, ZERNIO_MCP_ENDPOINT, false);
    expect(
      await prisma.botMcpServer.findFirst({ where: { botId: bot.id, serverId: second.id } }),
    ).toBeNull();
    const enabled = await updateMcp(isolated, second, ZERNIO_MCP_ENDPOINT, true);
    expect(enabled).toMatchObject({
      agentBotId: bot.id,
      agentExclusive: true,
      writesEnabled: false,
    });
    expect(
      await prisma.botMcpServer.findUniqueOrThrow({
        where: { botId_serverId: { botId: bot.id, serverId: second.id } },
      }),
    ).toMatchObject({ allowAllTools: false, allowedTools: [...ZERNIO_READ_TOOLS] });
  });

  it("reports posting capability from actor-scoped encrypted static material", async () => {
    const isolated = actor(userA, capabilitySpaceId);
    const isolatedClient = zernioClient(isolated);
    const missing = await isolatedClient.mcp.servers.create({
      transport: "streamable_http",
      slug: `zernio-missing-${suffix}`,
      name: "Zernio missing key",
      endpoint: ZERNIO_MCP_ENDPOINT,
      headers: {},
      enabled: true,
    });
    expect(missing).toMatchObject({ agentExclusive: true, agentBotId: expect.any(String) });
    expect(await isolatedClient.gtm.postingCapability()).toBe("api_key_required");

    const secretId = `zernio-oauth-${suffix}`;
    await prisma.secret.create({
      data: {
        id: secretId,
        userId: isolated.userId,
        spaceId: isolated.spaceId,
        kind: "mcp",
        ciphertext: JSON.stringify({ oauth: { tokens: { access_token: "oauth-only" } } }),
      },
    });
    await prisma.mcpServer.update({ where: { id: missing.id }, data: { secretId } });
    expect(await isolatedClient.gtm.postingCapability()).toBe("api_key_required");

    await isolatedClient.mcp.servers.update({ id: missing.id, secret: "synthetic-api-key" });
    const updated = await prisma.mcpServer.findUniqueOrThrow({ where: { id: missing.id } });
    const stored = await prisma.secret.findUniqueOrThrow({ where: { id: updated.secretId! } });
    expect(JSON.parse(stored.ciphertext)).toMatchObject({
      oauth: { tokens: { access_token: "oauth-only" } },
      secret: "synthetic-api-key",
    });
    expect(await isolatedClient.gtm.postingCapability()).toBe("ready");

    await prisma.secret.update({ where: { id: stored.id }, data: { ciphertext: "unreadable" } });
    expect(await isolatedClient.gtm.postingCapability()).toBe("api_key_required");
    expect(await zernioClient(b).gtm.postingCapability()).toBe("not_connected");
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

  it("a same-owner message_bot write persists approval in the recipient thread and owner's active runs", async () => {
    const service = await mkServer(userA, "peer-mercury", "https://mcp.mercury.com/mcp");
    const created = await client(a).integrationAgents.create({ serverId: service.id });
    await client(a).mcp.servers.setWrites({ id: service.id, enabled: true });
    const bot = await prisma.bot.findUniqueOrThrow({
      where: { id: created.botId },
      include: { thread: true },
    });
    const peer = await repos.createBot(a, {
      name: "Requesting peer",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: false,
    });
    const peerThread = await prisma.thread.findUniqueOrThrow({ where: { botId: peer.id } });
    const task = await prisma.task.create({
      data: {
        spaceId,
        botId: peer.id,
        threadId: peerThread.id,
        userId: userA,
        prompt: "Ask the bank agent to pay the synthetic invoice",
        status: "queued",
      },
    });
    const senderRun = await prisma.run.create({
      data: {
        spaceId,
        botId: peer.id,
        threadId: peerThread.id,
        taskId: task.id,
        userId: userA,
        status: "queued",
        trigger: "user",
      },
    });
    const mercury = fakeMercury({ txns: {} });
    const connector = new McpConnector(prisma, {} as never, {
      network: {
        fetch: fakeMercuryMcpFetch(mercury),
        resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
      },
    });
    const writeTool = "mcp__peer-mercury__requestSendMoney";
    const writeArgs = { amount: 12.5, recipientId: "rcp-1", note: "Synthetic invoice" };
    const offeredTools: string[][] = [];
    const results: unknown[] = [];
    const runtime = new ScriptedAgentRuntime();
    const runtimeDescriptor = runtime.describe();
    runtime.describe = () => ({
      ...runtimeDescriptor,
      capabilities: { ...runtimeDescriptor.capabilities, scripted: false },
    });
    runtime.run = async function* (request: AgentRunRequest) {
      offeredTools.push((request.tools ?? []).map((tool) => tool.name));
      const sending = request.runId === senderRun.id;
      const result = await request.executeTool!(
        sending ? "message_bot" : writeTool,
        sending
          ? { bot_id: bot.id, message: "Pay the synthetic invoice", intent: "request" }
          : writeArgs,
        sending ? "peer-message" : "agent-write",
      );
      results.push(result);
      if (isApprovalPausedResult(result)) return;
      yield { type: "done", text: "Done" };
    };
    const executorPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === "deploymentSettings") {
          return {
            ...target.deploymentSettings,
            findUnique: async () => ({
              defaultModelProvider: "scripted",
              defaultModelId: "scripted",
            }),
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const executor = createRunExecutor({
      prisma: executorPrisma,
      runtime,
      connector,
      events: createThreadEvents(prisma),
      jobs: { enqueue: async () => undefined },
      sandbox: new FakeSandboxProvider(),
      memory: { read: async () => ({ documents: [] }) },
      memoryProviders: { resolve: async () => null },
      secrets: [],
    } as unknown as Parameters<typeof createRunExecutor>[0]);
    try {
      await executor.continueRun(senderRun.id, "synthetic-worker");
      expect(
        await prisma.run.findUniqueOrThrow({
          where: { id: senderRun.id },
          select: { status: true, error: true },
        }),
      ).toMatchObject({ status: "completed", error: null });
      expect(offeredTools[0]).toContain("message_bot");
      expect(results[0]).toMatchObject({ ok: true, botId: bot.id });
      const recipientRun = await prisma.run.findFirstOrThrow({
        where: { botId: bot.id, trigger: "bot_message" },
      });
      expect(recipientRun).toMatchObject({ status: "queued", userId: userA, spaceId });
      expect(
        await prisma.message.findUniqueOrThrow({ where: { id: recipientRun.sourceMessageId! } }),
      ).toMatchObject({
        threadId: bot.thread!.id,
        blocks: expect.arrayContaining([
          expect.objectContaining({ kind: "bot_message_received", fromBotId: peer.id }),
        ]),
      });

      await executor.continueRun(recipientRun.id, "synthetic-worker");
      expect(offeredTools[1]).toContain(writeTool);
      expect(isApprovalPausedResult(results[1])).toBe(true);
      expect(await prisma.run.findUniqueOrThrow({ where: { id: recipientRun.id } })).toMatchObject({
        status: "waiting_input",
        error: null,
      });
      const effect = await prisma.externalEffect.findFirstOrThrow({
        where: { runId: recipientRun.id, kind: writeTool },
      });
      expect(effect.status).toBe("intended");
      const messages = await prisma.message.findMany({
        where: { threadId: bot.thread!.id, runId: recipientRun.id },
      });
      const cards = messages
        .flatMap((message) => message.blocks as MessageBlock[])
        .filter((block) => block.kind === "ask");
      expect(cards).toHaveLength(1);
      expect(cards[0]).toMatchObject({
        approvalEffectId: effect.id,
        status: "pending",
        detail: expect.stringContaining("Amount: $12.50"),
      });
      expect(cards[0]!.actions!.map((action) => action.id)).toEqual(["allow", "deny"]);
      expect(mercury.sendMoneyRequests).toHaveLength(0);
      const mine = await listSpaceRuns(prisma, a, "active");
      expect(mine.find((row) => row.runId === recipientRun.id)).toMatchObject({
        status: "waiting_input",
        trigger: "bot_message",
        botId: bot.id,
      });
      expect(
        (await listSpaceRuns(prisma, b, "active")).some((row) => row.runId === recipientRun.id),
      ).toBe(false);
    } finally {
      await connector.close();
    }
  });
  it("keeps Finance sync and receipt links working while the Mercury server is exclusive", async () => {
    // Sync and receipts run as the server's owner through callServerTool, outside any bot's gate.
    const finServer = await mkServer(userA, "mercury-fin", "https://mcp.mercury.com/mcp");
    await client(a).integrationAgents.create({ serverId: finServer.id });
    await client(a).integrationAgents.setExclusive({ serverId: finServer.id, exclusive: true });
    const mercury = fakeMercury({
      txns: { [MERCURY_CHECKING]: [mercuryRow("m-ia-1")] },
      attachments: [{ id: "att-1" }],
    });
    const mcp = {
      callServerTool: async (_row: unknown, _ctx: unknown, name: string, args: object) => ({
        content: [
          { type: "text" as const, text: JSON.stringify(await mercury.callTool(name, args)) },
        ],
      }),
    };
    const callToolFor = createFinanceCallToolFor(prisma, mcp);
    const result = await syncFinanceForUser({ prisma, callToolFor }, { spaceId, userId: userA });
    expect(result.mercury).toBe("synced");
    const row = await prisma.financeTransaction.findFirstOrThrow({
      where: { spaceId, userId: userA, externalId: "m-ia-1" },
    });
    const link = await financeReceiptUrl({ prisma, callToolFor } as unknown as FinanceDeps, a, {
      transactionId: row.id,
    });
    expect(link.url).toContain("receipt.pdf");
    expect(mercury.sendMoneyRequests).toHaveLength(0);
    await prisma.financeTransaction.deleteMany({ where: { mcpServerId: finServer.id } });
    await prisma.financeSyncState.deleteMany({ where: { mcpServerId: finServer.id } });
  });

  describe("connecting Devin", () => {
    const devinClient = (listServerTools: () => Promise<unknown[]>) =>
      createRouterClient(
        createRouter({
          prisma,
          env: {},
          remoteConnectors: {
            resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
          },
          secrets: {
            put: async (plaintext: string) => ({
              id: `devin-${suffix}-${Math.random()}`,
              ciphertext: plaintext,
            }),
          },
          mcp: { listServerTools, callServerTool: async () => ({}) },
          sandbox: {},
          home: {},
          jobs: { cancel: async () => undefined },
        } as unknown as RouterDeps),
        { context: { actor: a } as never },
      );
    const input = (slug: string) => ({
      transport: "streamable_http" as const,
      slug,
      name: "Devin",
      endpoint: "https://mcp.devin.ai/mcp",
      headers: {},
      secret: "fake-devin-key",
      enabled: true,
    });

    it("creates its exclusive agent with writes off in the same request", async () => {
      const created = await devinClient(async () => []).mcp.servers.create(
        input(`devin-ok-${suffix}`),
      );
      expect(created.agentBotId).toBeTruthy();
      expect(created).toMatchObject({ agentExclusive: true, writesEnabled: false });
      const devinAgent = await prisma.bot.findUniqueOrThrow({ where: { id: created.agentBotId! } });
      expect(devinAgent.instructions).not.toContain("Allow changes");
      const again = await client(a).integrationAgents.create({ serverId: created.id });
      expect(again.botId).toBe(created.agentBotId);
    });

    it("rejects turning writes on for a Devin server, and leaves Mercury unchanged", async () => {
      const created = await devinClient(async () => []).mcp.servers.create(
        input(`devin-ro-${suffix}`),
      );
      await expect(
        client(a).mcp.servers.setWrites({ id: created.id, enabled: true }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: created.id } })).toMatchObject(
        { writesEnabled: false },
      );
      const mercury = await mkServer(userA, `ro-mercury-${suffix}`, "https://mcp.mercury.com/mcp");
      await client(a).integrationAgents.create({ serverId: mercury.id });
      await expect(
        client(a).mcp.servers.setWrites({ id: mercury.id, enabled: true }),
      ).resolves.toMatchObject({ writesEnabled: true });
    });

    describe("other new servers", () => {
      const other = (slug: string, endpoint = "https://mcp.example.test/mcp") => ({
        ...input(slug),
        name: slug,
        endpoint,
        secret: "fake-key",
      });
      const denied = async (id: string) => {
        const row = await prisma.mcpServer.findUniqueOrThrow({
          where: { id },
          include: { agentBot: true },
        });
        return integrationAgentDenial({ server: row, bot: { spawnKey: null } } as never, {
          name: "read_thing",
          annotations: { readOnlyHint: true },
        });
      };

      it("provisions an exclusive agent with writes off, once per server", async () => {
        const created = await devinClient(async () => []).mcp.servers.create(
          other(`gen-ok-${suffix}`),
        );
        expect(created.agentBotId).toBeTruthy();
        // Writes start off, generic or not: a tool's read-only hint is not trusted until the owner allows changes.
        expect(created).toMatchObject({ agentExclusive: true, writesEnabled: false });
        const row = await prisma.mcpServer.findUniqueOrThrow({
          where: { id: created.id },
          include: { agentBot: true },
        });
        expect(row.agentProvisionedAt).not.toBeNull();
        const write = { name: "do_thing" };
        expect(integrationAgentDenial({ server: row, bot: row.agentBot } as never, write)).toBe(
          "writes-off",
        );
        expect(
          isIntegrationAgentWrite(
            row.agentBot?.spawnKey,
            { connectorId: "mcp", endpoint: row.endpoint ?? undefined, toolName: "do_thing" },
            undefined,
          ),
        ).toBe(true);
        const again = await client(a).integrationAgents.create({ serverId: created.id });
        expect(again.botId).toBe(created.agentBotId);
      });

      it("keeps the server without an agent when provisioning fails", async () => {
        const broken = new Proxy(prisma, {
          get: (target, key) =>
            key === "bot"
              ? {
                  ...target.bot,
                  findFirst: async () => {
                    throw new Error("boom");
                  },
                }
              : Reflect.get(target, key),
        }) as PrismaClient;
        const slug = `gen-fail-${suffix}`;
        const created = await createRouterClient(
          createRouter({
            prisma: broken,
            env: {},
            remoteConnectors: {
              resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
            },
            secrets: {
              put: async (plaintext: string) => ({
                id: `gen-${suffix}-${Math.random()}`,
                ciphertext: plaintext,
              }),
            },
            sandbox: {},
            home: {},
            jobs: { cancel: async () => undefined },
          } as unknown as RouterDeps),
          { context: { actor: a } as never },
        ).mcp.servers.create(other(slug));
        expect(created.agentBotId).toBeNull();
        expect(created.agentExclusive).toBe(false);
        expect(await prisma.mcpServer.count({ where: { spaceId, slug } })).toBe(1);
      });

      it("leaves Carta on its single shared agent", async () => {
        const created = await devinClient(async () => []).mcp.servers.create(
          other(`gen-carta-${suffix}`, CARTA_MCP_ENDPOINT),
        );
        expect(created.agentBotId).toBeNull();
        expect(created.agentExclusive).toBe(false);
      });

      it("archives the server's agent when the server is removed", async () => {
        const created = await devinClient(async () => []).mcp.servers.create(
          other(`gen-rm-${suffix}`),
        );
        await editorClient().mcp.servers.remove({ id: created.id });
        const bot = await prisma.bot.findUniqueOrThrow({ where: { id: created.agentBotId! } });
        expect(bot.archivedAt).not.toBeNull();
      });

      it("keeps an exclusive server exclusive, and closed to every bot, once its agent is archived", async () => {
        const created = await devinClient(async () => []).mcp.servers.create(
          other(`gen-rel-${suffix}`),
        );
        expect(await denied(created.id)).toBe("belongs-to-agent");
        await archiveById(created.agentBotId!);
        const row = await prisma.mcpServer.findUniqueOrThrow({ where: { id: created.id } });
        expect(row).toMatchObject({
          agentBotId: null,
          agentExclusive: true,
          writesEnabled: false,
        });
        expect(await denied(created.id)).toBe("belongs-to-agent");
      });

      it("frees a server that was made exclusive by hand", async () => {
        const hand = await mkServer(userA, `gen-hand-${suffix}`, "https://mcp.example.test/h");
        const { botId } = await client(a).integrationAgents.create({ serverId: hand.id });
        await client(a).integrationAgents.setExclusive({ serverId: hand.id, exclusive: true });
        await archiveById(botId);
        const row = await prisma.mcpServer.findUniqueOrThrow({ where: { id: hand.id } });
        expect(row).toMatchObject({ agentBotId: null, agentExclusive: false });
      });

      it("still frees a shared server when its agent is archived", async () => {
        const shared = await mkServer(userA, `gen-shared-${suffix}`, "https://mcp.example.test/s");
        const { botId } = await client(a).integrationAgents.create({ serverId: shared.id });
        await archiveById(botId);
        const row = await prisma.mcpServer.findUniqueOrThrow({ where: { id: shared.id } });
        expect(row).toMatchObject({ agentBotId: null, agentExclusive: false });
        expect(await denied(shared.id)).toBeNull();
      });
    });

    it("stores nothing when Devin rejects the key", async () => {
      const slug = `devin-bad-${suffix}`;
      await expect(
        devinClient(async () => {
          throw new Error("401 Unauthorized");
        }).mcp.servers.create(input(slug)),
      ).rejects.toThrow(/Devin/);
      expect(await prisma.mcpServer.count({ where: { spaceId, slug } })).toBe(0);
    });
  });
});
