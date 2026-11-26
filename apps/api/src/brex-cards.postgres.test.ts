import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import {
  BREX_AGENT_MODEL,
  BREX_CARDS_CONTROLS_DEFAULTS,
  BREX_CARDS_MCP_ENDPOINT,
  FINANCE_MCP_ENDPOINTS,
  integrationAgentSpawnKey,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

// Invented token values; no real Brex account is involved.
const TOKEN = "bxt_pg_test_token_one";
const NEW_TOKEN = "bxt_pg_test_token_two";
const BAD_TOKEN = "bxt_pg_test_token_refused";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

/** Brex as the token check sees it: any token except BAD_TOKEN is accepted. */
const defaultBrex = async (url: URL | string, init?: RequestInit) => {
  const u = new URL(String(url));
  if (new Headers(init?.headers).get("authorization") === `Bearer ${BAD_TOKEN}`)
    return json({}, 401);
  if (u.pathname === "/v2/users/me")
    return json({ id: "usr_1", first_name: "Ada", last_name: "Example" });
  if (u.pathname === "/v2/cards") return json({ items: [], next_cursor: null });
  if (u.pathname === "/v2/company") return json({ id: "cmp_pg_1", legal_name: "Example Co" });
  return json({}, 404);
};
const brexFetch = vi.fn(defaultBrex);

const CARDS_TEXT = JSON.stringify({
  cards: [
    {
      id: "card_1",
      name: "Ads",
      lastFour: "4242",
      status: "ACTIVE",
      ownerUserId: "usr_1",
      limitCents: 50_000,
      currency: "USD",
      duration: "MONTHLY",
    },
  ],
});

describePostgres("Brex cards connection (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `bxc-${name}-${suffix}`;
  const orgId = id("org");
  const spaceA = id("space-a");
  const spaceB = id("space-b");
  const actor = (name: string, spaceId = spaceA): Actor => ({
    userId: id(name),
    spaceId,
    email: `${id(name)}@example.test`,
    isDeploymentOwner: false,
  });
  const owner1 = actor("owner1");
  const owner2 = actor("owner2");
  const member = actor("member");
  const outsider = actor("outsider", spaceB);
  const spaces = [spaceA, spaceB];

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;
  const callServerTool = vi.fn(async () => ({ content: [{ type: "text", text: CARDS_TEXT }] }));
  const secrets = {
    put: vi.fn(async (plaintext: string) => ({ id: id(`secret-${n++}`), ciphertext: plaintext })),
    load: vi.fn(async (ciphertext: string) => ciphertext),
  };

  const router = (db: PrismaClient = prisma) =>
    createRouter({
      prisma: db,
      env: {},
      secrets,
      mcp: { listServerTools: async () => [], callServerTool },
      brexApi: { baseUrl: "http://brex.test", fetch: brexFetch as typeof fetch },
      sandbox: {},
      home: {},
      jobs: { enqueue: async () => undefined, cancel: async () => undefined },
    } as unknown as RouterDeps);
  const client = (who: Actor, db?: PrismaClient) =>
    createRouterClient(router(db), { context: { actor: who } as never });
  const connection = (spaceId = spaceA) =>
    prisma.brexCardsConnection.findUnique({ where: { spaceId } });
  const servers = (spaceId = spaceA) => prisma.mcpServer.findMany({ where: { spaceId } });

  const reset = async () => {
    await prisma.mcpServer.deleteMany({ where: { spaceId: { in: spaces } } });
    await prisma.secret.deleteMany({ where: { spaceId: { in: spaces } } });
    await prisma.bot.deleteMany({ where: { spaceId: { in: spaces } } });
    await prisma.spaceMember.updateMany({
      where: { spaceId: spaceA, userId: owner1.userId },
      data: { role: "owner" },
    });
    await prisma.spaceMember.updateMany({
      where: { spaceId: spaceA, userId: owner2.userId },
      data: { role: "member" },
    });
    callServerTool.mockClear();
    brexFetch.mockClear();
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const users = [owner1, owner2, member, outsider];
    for (const who of users) {
      await prisma.user.create({
        data: { id: who.userId, name: who.userId, email: who.email, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    for (const spaceId of spaces) {
      await prisma.space.create({
        data: {
          id: spaceId,
          organizationId: orgId,
          name: "General",
          isDefault: spaceId === spaceA,
        },
      });
    }
    for (const who of users) {
      await prisma.member.create({
        data: {
          id: id(`m-${who.userId}`),
          organizationId: orgId,
          userId: who.userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    // Joining the organization may already have added a row in the default space.
    await prisma.spaceMember.deleteMany({ where: { spaceId: { in: spaces } } });
    for (const [who, role] of [
      [owner1, "owner"],
      [owner2, "member"],
      [member, "member"],
      [outsider, "owner"],
    ] as Array<[Actor, string]>) {
      await prisma.spaceMember.create({
        data: {
          id: id(`sm-${who.userId}`),
          spaceId: who.spaceId,
          organizationId: orgId,
          userId: who.userId,
          role,
          createdAt: new Date(),
        },
      });
    }
  });

  afterEach(reset);
  afterAll(async () => {
    if (!prisma) return;
    await reset();
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({
      where: { id: { in: [owner1, owner2, member, outsider].map((who) => who.userId) } },
    });
    await close();
  });

  /** The owner's Brex finance agent, as the Brex MCP preset leaves it. */
  const financeAgent = async (modelId: string | null) => {
    const server = await prisma.mcpServer.create({
      data: {
        spaceId: spaceA,
        userId: owner1.userId,
        slug: "brex-finance",
        name: "Brex",
        transport: "streamable_http",
        endpoint: FINANCE_MCP_ENDPOINTS.brex,
      },
    });
    const bot = await createRepos(prisma).createBot(owner1, {
      spawnKey: integrationAgentSpawnKey(server.id),
      name: "Brex agent",
      title: "",
      description: "Your Brex account",
      instructions: "You work with the user's Brex account through its tools.",
      notifyOnFinish: true,
      color: "#111111",
      ...(modelId ? { modelProvider: "openrouter", modelId } : {}),
    });
    await prisma.mcpServer.update({
      where: { id: server.id },
      data: { agentBotId: bot.id, agentExclusive: true },
    });
    return { server, bot };
  };

  it("connects the owner: one encrypted secret, an exclusive read-only server, the company id and a pinned Brex agent, and returns no token", async () => {
    const result = await client(owner1).brexCards.connect({ token: TOKEN });

    expect(JSON.stringify(result)).not.toContain(TOKEN);
    const [server] = await servers();
    expect(server).toMatchObject({
      userId: owner1.userId,
      endpoint: BREX_CARDS_MCP_ENDPOINT,
      agentExclusive: true,
      writesEnabled: false,
      agentBotId: result.agentBotId,
    });
    expect(result.serverId).toBe(server?.id);
    const secret = await prisma.secret.findUniqueOrThrow({ where: { id: server?.secretId ?? "" } });
    expect(secret).toMatchObject({ kind: "mcp", spaceId: spaceA });
    expect(JSON.parse(secret.ciphertext)).toMatchObject({ secret: TOKEN });
    expect(await connection()).toMatchObject({
      serverId: server?.id,
      brexAccountId: "cmp_pg_1",
      createdByUserId: owner1.userId,
      ...BREX_CARDS_CONTROLS_DEFAULTS,
    });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: result.agentBotId } });
    expect(bot).toMatchObject({
      name: "Brex agent",
      modelProvider: BREX_AGENT_MODEL.provider,
      modelId: BREX_AGENT_MODEL.id,
      thinkingLevel: BREX_AGENT_MODEL.thinkingLevel,
    });
    expect(bot.instructions).toContain("virtual vendor cards and spend limits");
  });

  it("refuses a second connect in the space and a member's connect, and a refused token stores nothing", async () => {
    await expect(client(owner1).brexCards.connect({ token: BAD_TOKEN })).rejects.toMatchObject({
      message: "Brex rejected this token",
    });
    expect(await servers()).toEqual([]);
    expect(await prisma.secret.count({ where: { spaceId: spaceA } })).toBe(0);
    expect(await connection()).toBeNull();

    await expect(client(member).brexCards.connect({ token: TOKEN })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await client(owner1).brexCards.connect({ token: TOKEN });
    await expect(client(owner1).brexCards.connect({ token: NEW_TOKEN })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await servers()).toHaveLength(1);
  });

  it("attaches to the owner's existing Brex agent, keeping a model the user chose, and leaves it in place when the server is removed", async () => {
    const finance = await financeAgent("my-own-model");
    const result = await client(owner1).brexCards.connect({ token: TOKEN });

    expect(result.agentBotId).toBe(finance.bot.id);
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: finance.bot.id } });
    expect(bot.modelId).toBe("my-own-model");
    expect(bot.instructions).toContain("virtual vendor cards and spend limits");
    const cards = await prisma.mcpServer.findUniqueOrThrow({ where: { id: result.serverId } });
    expect(cards).toMatchObject({ agentBotId: finance.bot.id, writesEnabled: false });

    await client(owner1).mcp.servers.remove({ id: result.serverId });
    expect(await connection()).toBeNull();
    const after = await prisma.bot.findUniqueOrThrow({ where: { id: finance.bot.id } });
    expect(after.archivedAt).toBeNull();
    expect(await prisma.mcpServer.findUnique({ where: { id: finance.server.id } })).not.toBeNull();
  });

  it("pins the model on a reused agent whose model is empty", async () => {
    const finance = await financeAgent(null);
    await client(owner1).brexCards.connect({ token: TOKEN });
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: finance.bot.id } });
    expect(bot.modelId).toBe(BREX_AGENT_MODEL.id);
  });

  it("removes the secret, server, state row and its own agent when provisioning fails", async () => {
    const failing = new Proxy(prisma, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver) as unknown;
        if (prop === "bot")
          return new Proxy(value as object, {
            get(bots, method) {
              if (method === "updateMany") return () => Promise.reject(new Error("pin failed"));
              const original = Reflect.get(bots, method) as unknown;
              return typeof original === "function" ? original.bind(bots) : original;
            },
          });
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    await expect(client(owner1, failing).brexCards.connect({ token: TOKEN })).rejects.toThrow();

    expect(await servers()).toEqual([]);
    expect(await connection()).toBeNull();
    expect(await prisma.secret.count({ where: { spaceId: spaceA } })).toBe(0);
    const bots = await prisma.bot.findMany({ where: { spaceId: spaceA } });
    expect(bots.every((bot) => bot.archivedAt !== null)).toBe(true);
    // A retry works and leaves one connection.
    await client(owner1).brexCards.connect({ token: TOKEN });
    expect(await servers()).toHaveLength(1);
  });

  it("replaces the token: a refused token keeps everything, an accepted one swaps the secret and bumps the revision, keeping controls and the model", async () => {
    const { serverId } = await client(owner1).brexCards.connect({ token: TOKEN });
    const controls = {
      ...BREX_CARDS_CONTROLS_DEFAULTS,
      maxCardsPerDay: 2,
      allowedDurations: ["MONTHLY" as const],
    };
    await client(owner1).brexCards.setControls(controls);
    const before = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
    const botBefore = await prisma.bot.findUniqueOrThrow({
      where: { id: before.agentBotId ?? "" },
    });

    await expect(client(member).brexCards.replaceToken({ token: NEW_TOKEN })).rejects.toMatchObject(
      {
        code: "FORBIDDEN",
      },
    );
    await expect(client(owner1).brexCards.replaceToken({ token: BAD_TOKEN })).rejects.toMatchObject(
      {
        message: "Brex rejected this token",
      },
    );
    const untouched = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
    expect(untouched).toMatchObject({ secretId: before.secretId, revision: before.revision });

    await client(owner1).brexCards.replaceToken({ token: NEW_TOKEN });
    const after = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
    // A pending approval carries the revision it was asked at, so this bump makes it stale.
    expect(after.revision).toBe(before.revision + 1);
    expect(after.secretId).not.toBe(before.secretId);
    expect(await prisma.secret.findUnique({ where: { id: before.secretId ?? "" } })).toBeNull();
    const secret = await prisma.secret.findUniqueOrThrow({ where: { id: after.secretId ?? "" } });
    expect(JSON.parse(secret.ciphertext)).toMatchObject({ secret: NEW_TOKEN });
    expect(await client(owner1).brexCards.getControls()).toEqual(controls);
    const botAfter = await prisma.bot.findUniqueOrThrow({ where: { id: before.agentBotId ?? "" } });
    expect(botAfter.modelId).toBe(botBefore.modelId);
  });

  it("closes the generic routes on this server: a credential update points to Replace token, exclusive: false is refused", async () => {
    const { serverId } = await client(owner1).brexCards.connect({ token: TOKEN });
    const before = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });

    await expect(
      client(owner1).mcp.servers.update({ id: serverId, secret: BAD_TOKEN }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringContaining("Replace token"),
    });
    await expect(
      client(owner1).integrationAgents.setExclusive({ serverId, exclusive: false }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const after = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
    expect(after).toMatchObject({
      secretId: before.secretId,
      revision: before.revision,
      agentExclusive: true,
    });
  });

  it("refuses every Brex cards call to a member, and to a former space owner who still owns the server row", async () => {
    const { serverId } = await client(owner1).brexCards.connect({ token: TOKEN });
    callServerTool.mockClear();
    for (const call of [
      (c: ReturnType<typeof client>) => c.brexCards.cards(),
      (c: ReturnType<typeof client>) => c.brexCards.getControls(),
      (c: ReturnType<typeof client>) => c.brexCards.setControls(BREX_CARDS_CONTROLS_DEFAULTS),
      (c: ReturnType<typeof client>) => c.brexCards.replaceToken({ token: NEW_TOKEN }),
    ])
      await expect(call(client(member))).rejects.toMatchObject({ code: "FORBIDDEN" });

    await prisma.spaceMember.updateMany({
      where: { spaceId: spaceA, userId: owner1.userId },
      data: { role: "member" },
    });
    const former = client(owner1);
    await expect(former.brexCards.cards()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(former.brexCards.replaceToken({ token: NEW_TOKEN })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      former.mcp.servers.update({ id: serverId, secret: NEW_TOKEN }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      former.mcp.servers.setWrites({ id: serverId, enabled: true }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      former.integrationAgents.setExclusive({ serverId, exclusive: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(callServerTool).not.toHaveBeenCalled();
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } })).toMatchObject({
      writesEnabled: false,
      agentExclusive: true,
    });
  });

  it("lets the space owner switch writes on and off", async () => {
    const { serverId } = await client(owner1).brexCards.connect({ token: TOKEN });
    await client(owner1).mcp.servers.setWrites({ id: serverId, enabled: true });
    expect(
      (await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } })).writesEnabled,
    ).toBe(true);
    await client(owner1).mcp.servers.setWrites({ id: serverId, enabled: false });
    expect(
      (await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } })).writesEnabled,
    ).toBe(false);
  });

  it("lists cards through list_cards only, and validates controls", async () => {
    const { serverId } = await client(owner1).brexCards.connect({ token: TOKEN });
    const list = await client(owner1).brexCards.cards();
    expect(list).toMatchObject({ serverId, writesEnabled: false });
    expect(list.cards).toEqual([
      {
        cardId: "card_1",
        name: "Ads",
        lastFour: "4242",
        ownerUserId: "usr_1",
        status: "ACTIVE",
        limitCents: 50_000,
        currency: "USD",
        duration: "MONTHLY",
      },
    ]);
    expect(callServerTool.mock.calls.map((call) => (call as unknown[])[2])).toEqual(["list_cards"]);

    await expect(
      client(owner1).brexCards.setControls({ ...BREX_CARDS_CONTROLS_DEFAULTS, maxCardsPerDay: 0 }),
    ).rejects.toBeDefined();
    expect(await client(owner1).brexCards.getControls()).toEqual(BREX_CARDS_CONTROLS_DEFAULTS);
  });

  it("keeps spaces apart: another space's owner sees and changes nothing, and has its own connection", async () => {
    await client(owner1).brexCards.connect({ token: TOKEN });
    await expect(client(outsider).brexCards.cards()).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(client(outsider).brexCards.getControls()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      client(outsider).brexCards.setControls({
        ...BREX_CARDS_CONTROLS_DEFAULTS,
        maxCardsPerDay: 9,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      client(outsider).brexCards.replaceToken({ token: NEW_TOKEN }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await connection())?.maxCardsPerDay).toBe(BREX_CARDS_CONTROLS_DEFAULTS.maxCardsPerDay);

    const theirs = await client(outsider).brexCards.connect({ token: NEW_TOKEN });
    expect((await connection(spaceB))?.serverId).toBe(theirs.serverId);
    expect((await connection(spaceA))?.serverId).not.toBe(theirs.serverId);
    // Their server row is their own: the first space's owner cannot reach it.
    await expect(
      client(owner1).mcp.servers.update({ id: theirs.serverId, secret: "x" }),
    ).rejects.toBeDefined();
  });

  it("removing the server removes the state row, the secret and its own agent", async () => {
    const { serverId, agentBotId } = await client(owner1).brexCards.connect({ token: TOKEN });
    await client(owner1).mcp.servers.remove({ id: serverId });
    expect(await connection()).toBeNull();
    expect(await prisma.secret.count({ where: { spaceId: spaceA } })).toBe(0);
    expect(
      (await prisma.bot.findUniqueOrThrow({ where: { id: agentBotId } })).archivedAt,
    ).not.toBeNull();
  });

  it("regression: two connects at once leave exactly one connection, one server and one secret", async () => {
    const results = await Promise.allSettled([
      client(owner1).brexCards.connect({ token: TOKEN }),
      client(owner1).brexCards.connect({ token: NEW_TOKEN }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: "CONFLICT" });
    expect(await servers()).toHaveLength(1);
    expect(await prisma.secret.count({ where: { spaceId: spaceA } })).toBe(1);
    expect(await prisma.brexCardsConnection.count({ where: { spaceId: spaceA } })).toBe(1);
  });

  it("regression: the token appears only in the encrypted secret, never in a server listing, the server row or the agent", async () => {
    const { serverId, agentBotId } = await client(owner1).brexCards.connect({ token: TOKEN });
    const listed = await client(owner1).mcp.servers.list();
    expect(JSON.stringify(listed)).not.toContain(TOKEN);
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
    expect(JSON.stringify(row)).not.toContain(TOKEN);
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: agentBotId } });
    expect(JSON.stringify(bot)).not.toContain(TOKEN);
    expect(JSON.stringify(await connection())).not.toContain(TOKEN);
  });

  it("regression: a replacement token from another Brex company is refused and changes nothing", async () => {
    const { serverId } = await client(owner1).brexCards.connect({ token: TOKEN });
    const before = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
    brexFetch.mockImplementation(async (url: URL | string) =>
      new URL(String(url)).pathname === "/v2/company"
        ? json({ id: "cmp_pg_2", legal_name: "Other Co" })
        : json(
            new URL(String(url)).pathname === "/v2/cards"
              ? { items: [] }
              : { id: "u", first_name: "A", last_name: "B" },
          ),
    );
    try {
      await expect(
        client(owner1).brexCards.replaceToken({ token: NEW_TOKEN }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message:
          "This token is for a different Brex account. Disconnect Brex cards and connect again.",
      });
    } finally {
      brexFetch.mockReset();
      brexFetch.mockImplementation(defaultBrex);
    }
    expect((await connection())?.brexAccountId).toBe("cmp_pg_1");
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } })).toMatchObject({
      secretId: before.secretId,
      revision: before.revision,
    });
    expect(await prisma.secret.count({ where: { spaceId: spaceA } })).toBe(1);
  });

  /** Owner1 connects and turns writes on, then is demoted while owner2 becomes the owner. */
  const transferOwnership = async () => {
    const connected = await client(owner1).brexCards.connect({ token: TOKEN });
    await client(owner1).mcp.servers.setWrites({ id: connected.serverId, enabled: true });
    await prisma.spaceMember.updateMany({
      where: { spaceId: spaceA, userId: owner1.userId },
      data: { role: "member" },
    });
    await prisma.spaceMember.updateMany({
      where: { spaceId: spaceA, userId: owner2.userId },
      data: { role: "owner" },
    });
    return connected;
  };

  it("after an ownership transfer, the new owner turns writes off and removes the connection, and the former owner may do neither", async () => {
    const { serverId, agentBotId } = await transferOwnership();

    // The new owner is not the row owner, so token, controls and cards ask to reconnect.
    for (const call of [
      (c: ReturnType<typeof client>) => c.brexCards.cards(),
      (c: ReturnType<typeof client>) => c.brexCards.getControls(),
      (c: ReturnType<typeof client>) => c.brexCards.setControls(BREX_CARDS_CONTROLS_DEFAULTS),
      (c: ReturnType<typeof client>) => c.brexCards.replaceToken({ token: NEW_TOKEN }),
    ])
      await expect(call(client(owner2))).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message: "Brex cards were connected by someone else. Disconnect and connect again.",
      });

    await expect(
      client(owner2).mcp.servers.setWrites({ id: serverId, enabled: true }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      client(owner1).mcp.servers.setWrites({ id: serverId, enabled: false }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(client(owner1).mcp.servers.remove({ id: serverId })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } })).toMatchObject({
      writesEnabled: true,
    });

    await client(owner2).mcp.servers.setWrites({ id: serverId, enabled: false });
    expect(
      (await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } })).writesEnabled,
    ).toBe(false);

    await client(owner2).mcp.servers.remove({ id: serverId });
    expect(await servers()).toEqual([]);
    expect(await connection()).toBeNull();
    expect(await prisma.secret.count({ where: { spaceId: spaceA } })).toBe(0);
    expect(
      (await prisma.bot.findUniqueOrThrow({ where: { id: agentBotId } })).archivedAt,
    ).not.toBeNull();
  });

  it("removing the Brex finance server keeps the agent the cards server still uses", async () => {
    const finance = await financeAgent("my-own-model");
    const { serverId } = await client(owner1).brexCards.connect({ token: TOKEN });

    await client(owner1).mcp.servers.remove({ id: finance.server.id });

    expect(
      (await prisma.bot.findUniqueOrThrow({ where: { id: finance.bot.id } })).archivedAt,
    ).toBeNull();
    expect((await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } })).agentBotId).toBe(
      finance.bot.id,
    );
  });
});
