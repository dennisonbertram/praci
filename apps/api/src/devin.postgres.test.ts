import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { DEVIN_MCP_ENDPOINT } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const REFUSED = "refused-key";

// Invented sessions in the documented line format; no real Devin account is involved.
const SEARCH_TEXT = [
  '- id=devin-w1 title="Fix the login loop" status=blocked status_detail=waiting_for_user updated_at=1760003600 origin=webapp',
  '- id=devin-r1 title="Bump the SDK" status=working updated_at=1760003000 origin=slack',
  '- id=devin-f1 title="Old migration" status=finished status_detail=finish updated_at=1750003000 origin=linear',
].join("\n");
const MESSAGES_TEXT =
  '- event_id=ev-1 source=devin created_at=1760003600 body="Which environment should I test against?"';

describePostgres("Devin shared connection (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `dvn-${name}-${suffix}`;
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
  const former = actor("former");
  const outsider = actor("outsider", spaceB);

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;
  const jobs = { enqueue: vi.fn(async () => undefined), cancel: async () => undefined };
  // Every Devin read of the page and of the connect-time check goes through this fake.
  const callTool = vi.fn(async (serverId: string, name: string) => {
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
    const secret = row.secretId
      ? await prisma.secret.findUniqueOrThrow({ where: { id: row.secretId } })
      : null;
    if (secret?.ciphertext.includes(REFUSED)) throw new Error("Unauthorized (HTTP 401)");
    return name === "devin_session_search" ? SEARCH_TEXT : MESSAGES_TEXT;
  });
  const listServerTools = vi.fn(async () => []);

  const router = () =>
    createRouter({
      prisma,
      env: {},
      secrets: {
        put: async (plaintext: string) => ({ id: id(`secret-${n++}`), ciphertext: plaintext }),
      },
      mcp: { listServerTools, callServerTool: async () => ({}) },
      devinCallTool: callTool,
      sandbox: {},
      home: {},
      jobs,
    } as unknown as RouterDeps);
  const client = (who: Actor) => createRouterClient(router(), { context: { actor: who } as never });
  const state = () => prisma.devinConnectionState.findUnique({ where: { spaceId: spaceA } });
  const reset = async () => {
    await prisma.mcpServer.deleteMany({ where: { spaceId: { in: [spaceA, spaceB] } } });
    await prisma.bot.deleteMany({ where: { spaceId: { in: [spaceA, spaceB] } } });
    await prisma.spaceMember.updateMany({
      where: { spaceId: spaceA, userId: owner1.userId },
      data: { role: "owner" },
    });
    callTool.mockClear();
    listServerTools.mockClear();
    jobs.enqueue.mockClear();
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const users = [owner1, owner2, member, former, outsider];
    for (const who of users) {
      await prisma.user.create({
        data: { id: who.userId, name: who.userId, email: who.email, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    for (const spaceId of [spaceA, spaceB]) {
      await prisma.space.create({
        data: {
          id: spaceId,
          organizationId: orgId,
          name: "General",
          isDefault: spaceId === spaceA,
        },
      });
    }
    // The former member keeps an organization seat but has no row in the space.
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
    const roles: Array<[Actor, string]> = [
      [owner1, "owner"],
      [owner2, "owner,admin"],
      [member, "member"],
      [outsider, "owner"],
    ];
    // Joining the organization may already have added a row in the default space.
    await prisma.spaceMember.deleteMany({ where: { spaceId: { in: [spaceA, spaceB] } } });
    for (const [who, role] of roles) {
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
      where: { id: { in: [owner1, owner2, member, former, outsider].map((who) => who.userId) } },
    });
    await close();
  });

  const privateDevinRow = (who: Actor, slug: string) =>
    prisma.mcpServer.create({
      data: {
        spaceId: who.spaceId,
        userId: who.userId,
        slug,
        name: "Devin",
        transport: "streamable_http",
        endpoint: DEVIN_MCP_ENDPOINT,
      },
    });
  const seedSession = (serverId: string, sessionId: string, kind: string, spaceId = spaceA) =>
    prisma.devinSession.create({
      data: {
        serverId,
        spaceId,
        sessionId,
        title: sessionId,
        status: kind,
        kind,
        question: kind === "needs_you" ? "Which environment?" : null,
        origin: "webapp",
        devinUpdatedAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  /** A connected space with cached rows, as `connect` and one refresh would leave it. */
  const connected = async (who = owner1, extra: object = {}) => {
    await client(who).devin.connect({ secret: "key-one" });
    const row = (await state())!;
    await seedSession(row.serverId, "devin-w1", "needs_you");
    await seedSession(row.serverId, "devin-r1", "working");
    await prisma.devinConnectionState.update({
      where: { serverId: row.serverId },
      data: { lastSucceededAt: new Date(), complete: true, ...extra },
    });
    callTool.mockClear();
    return row.serverId;
  };

  it("every member reads the space's sessions, only an owner may connect, replace or disconnect, a demoted connector cannot update or remove the active row, and a refused replacement key changes nothing", async () => {
    const serverId = await connected();
    const first = await client(member).devin.sessions();
    expect(first.connection).toMatchObject({
      status: "ok",
      manage: false,
      canConnect: false,
      isConnector: false,
    });
    expect(first.sessions.map((row) => row.id)).toEqual(["devin-w1", "devin-r1"]);
    for (const call of [
      () => client(member).devin.connect({ secret: "x" }),
      () => client(member).devin.replaceKey({ secret: "x" }),
      () => client(member).devin.disconnect(),
    ])
      await expect(call()).rejects.toMatchObject({ code: "FORBIDDEN" });

    await prisma.spaceMember.update({
      where: { spaceId_userId: { spaceId: spaceA, userId: owner1.userId } },
      data: { role: "member" },
    });
    const generic = client(owner1).mcp.servers;
    await expect(generic.remove({ id: serverId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      generic.update({
        id: serverId,
        config: {
          transport: "streamable_http",
          slug: "devin",
          name: "Devin",
          endpoint: DEVIN_MCP_ENDPOINT,
          enabled: false,
        },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await prisma.spaceMember.update({
      where: { spaceId_userId: { spaceId: spaceA, userId: owner1.userId } },
      data: { role: "owner" },
    });

    const before = await state();
    await expect(client(owner2).devin.replaceKey({ secret: REFUSED })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The key was refused.",
    });
    expect(await state()).toEqual(before);
    expect(await prisma.devinSession.count({ where: { serverId } })).toBe(2);
    expect(await prisma.mcpServer.count({ where: { spaceId: spaceA } })).toBe(1);
  });

  describe("connect", () => {
    it("checks the key, stores the row in the owner's scope, the state row and one refresh job", async () => {
      await client(owner1).devin.connect({ secret: "key-one" });
      expect(listServerTools).toHaveBeenCalledTimes(1);
      expect(callTool.mock.calls.map((call) => call[1])).toEqual(["devin_session_search"]);
      const row = await state();
      expect(row).toMatchObject({ spaceId: spaceA, lastSucceededAt: null, rejectedAt: null });
      const server = await prisma.mcpServer.findUniqueOrThrow({ where: { id: row!.serverId } });
      expect(server).toMatchObject({
        userId: owner1.userId,
        spaceId: spaceA,
        endpoint: DEVIN_MCP_ENDPOINT,
        enabled: true,
        agentExclusive: true,
        writesEnabled: false,
      });
      expect(server.agentBotId).toBeTruthy();
      expect(jobs.enqueue).toHaveBeenCalledTimes(1);
      expect(jobs.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: "devin.refresh", payload: { serverId: row!.serverId } }),
      );
    });

    it("keeps nothing when the key is refused", async () => {
      const secrets = await prisma.secret.count({ where: { spaceId: spaceA } });
      await expect(client(owner1).devin.connect({ secret: REFUSED })).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "The key was refused.",
      });
      expect(await prisma.mcpServer.count({ where: { spaceId: spaceA } })).toBe(0);
      expect(await prisma.secret.count({ where: { spaceId: spaceA } })).toBe(secrets);
      expect(await state()).toBeNull();
      expect(jobs.enqueue).not.toHaveBeenCalled();
    });

    it("is forbidden to a member and to someone no longer in the space", async () => {
      for (const who of [member, former])
        await expect(client(who).devin.connect({ secret: "k" })).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
      expect(await state()).toBeNull();
    });

    it("refuses a second owner while connected, and concurrent connects leave one connection", async () => {
      await client(owner1).devin.connect({ secret: "key-one" });
      await expect(client(owner2).devin.connect({ secret: "key-two" })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Devin is already connected in this space",
      });
      await reset();
      const results = await Promise.allSettled([
        client(owner1).devin.connect({ secret: "key-one" }),
        client(owner2).devin.connect({ secret: "key-two" }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.devinConnectionState.count({ where: { spaceId: spaceA } })).toBe(1);
      expect(await prisma.mcpServer.count({ where: { spaceId: spaceA } })).toBe(1);
    });
  });

  describe("sessions", () => {
    it("reads none for a space with no connection, and never promotes a private Devin row", async () => {
      await privateDevinRow(owner1, `devin-private-${suffix}`);
      const read = await client(owner1).devin.sessions();
      expect(read.connection).toMatchObject({ status: "none", manage: true, canConnect: true });
      expect(read.sessions).toEqual([]);
      expect(await state()).toBeNull();
      expect(callTool).not.toHaveBeenCalled();
    });

    it("tells owners and members apart, and keeps other spaces out", async () => {
      await connected();
      expect((await client(owner1).devin.sessions()).connection).toMatchObject({
        manage: true,
        canConnect: false,
        isConnector: true,
      });
      expect((await client(owner2).devin.sessions()).connection).toMatchObject({
        manage: true,
        canConnect: false,
        isConnector: false,
      });
      const away = await client(outsider).devin.sessions();
      expect(away.connection.status).toBe("none");
      expect(away.sessions).toEqual([]);
      await expect(client(former).devin.sessions()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("calls Devin zero times within a minute of the last success", async () => {
      await connected();
      await client(member).devin.sessions();
      expect(callTool).not.toHaveBeenCalled();
    });

    it("refreshes through the shared operation when the cache is older than a minute", async () => {
      const serverId = await connected(owner1, { lastSucceededAt: new Date(Date.now() - 120_000) });
      const read = await client(member).devin.sessions();
      expect(callTool.mock.calls.some((call) => call[1] === "devin_session_search")).toBe(true);
      expect(read.sessions.map((row) => row.id)).toContain("devin-f1");
      expect((await state())!.lastSucceededAt!.getTime()).toBeGreaterThan(Date.now() - 60_000);
      expect(read.connection.status).toBe("ok");
      expect(serverId).toBeTruthy();
    });

    it("returns the cache while another process holds the lease", async () => {
      await connected(owner1, {
        lastSucceededAt: new Date(Date.now() - 120_000),
        leaseToken: "other",
        leaseUntil: new Date(Date.now() + 60_000),
      });
      const read = await client(member).devin.sessions();
      expect(callTool).not.toHaveBeenCalled();
      expect(read.sessions).toHaveLength(2);
      expect(read.stale).toBe(false);
    });

    it("returns stored rows, muted, for a rejected connection without calling Devin", async () => {
      await connected(owner1, {
        lastSucceededAt: new Date(Date.now() - 120_000),
        rejectedAt: new Date(),
        lastError: "rejected",
      });
      const read = await client(member).devin.sessions();
      expect(callTool).not.toHaveBeenCalled();
      expect(read.connection.status).toBe("rejected");
      expect(read.stale).toBe(true);
      expect(read.sessions).toHaveLength(2);
    });

    it("orders needs-you, error, working, then the rest, newest first", async () => {
      const serverId = await connected();
      await seedSession(serverId, "devin-e1", "error");
      await seedSession(serverId, "devin-f9", "finished");
      const read = await client(member).devin.sessions();
      expect(read.sessions.map((row) => row.kind)).toEqual([
        "needs_you",
        "error",
        "working",
        "finished",
      ]);
    });
  });

  describe("replaceKey and disconnect", () => {
    it("swaps the connection, clears the cache and makes the acting owner the connector", async () => {
      const oldId = await connected(owner1, { rejectedAt: new Date(), lastError: "rejected" });
      const oldServer = await prisma.mcpServer.findUniqueOrThrow({ where: { id: oldId } });
      await client(owner2).devin.replaceKey({ secret: "key-two" });
      const row = (await state())!;
      expect(row.serverId).not.toBe(oldId);
      expect(row).toMatchObject({ lastSucceededAt: null, rejectedAt: null, lastError: null });
      const server = await prisma.mcpServer.findUniqueOrThrow({ where: { id: row.serverId } });
      expect(server.userId).toBe(owner2.userId);
      expect(await prisma.mcpServer.findUnique({ where: { id: oldId } })).toBeNull();
      expect(await prisma.devinSession.count({ where: { spaceId: spaceA } })).toBe(0);
      expect(
        (await prisma.bot.findUniqueOrThrow({ where: { id: oldServer.agentBotId! } })).archivedAt,
      ).not.toBeNull();
      expect(jobs.enqueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ payload: { serverId: row.serverId } }),
      );
      expect((await client(owner2).devin.sessions()).connection.isConnector).toBe(true);
    });

    it("needs a connection to replace", async () => {
      await expect(client(owner1).devin.replaceKey({ secret: "k" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await prisma.mcpServer.count({ where: { spaceId: spaceA } })).toBe(0);
    });

    it("disconnect removes everything and every member reads none", async () => {
      const serverId = await connected();
      const server = await prisma.mcpServer.findUniqueOrThrow({ where: { id: serverId } });
      await client(owner2).devin.disconnect();
      expect(await state()).toBeNull();
      expect(await prisma.mcpServer.count({ where: { spaceId: spaceA } })).toBe(0);
      expect(await prisma.devinSession.count({ where: { spaceId: spaceA } })).toBe(0);
      expect(await prisma.secret.count({ where: { id: server.secretId! } })).toBe(0);
      expect(
        (await prisma.bot.findUniqueOrThrow({ where: { id: server.agentBotId! } })).archivedAt,
      ).not.toBeNull();
      expect((await client(member).devin.sessions()).connection.status).toBe("none");
    });
  });

  describe("the generic MCP routes", () => {
    const config = (enabled = true, secret?: string) => ({
      transport: "streamable_http" as const,
      slug: "other",
      name: "Other",
      endpoint: DEVIN_MCP_ENDPOINT,
      enabled,
      ...(secret ? { secret } : {}),
    });

    it("refuses a second enabled Devin endpoint while the space is connected", async () => {
      await connected();
      const other = await prisma.mcpServer.create({
        data: {
          spaceId: spaceA,
          userId: owner2.userId,
          slug: "plain",
          name: "Plain",
          transport: "streamable_http",
          endpoint: "https://mcp.example.test/mcp",
        },
      });
      await expect(
        client(owner2).mcp.servers.update({ id: other.id, config: config() }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Devin is already connected in this space",
      });
    });

    it("lets a private Devin row exist while no space connection does", async () => {
      const row = await privateDevinRow(owner2, `devin-p-${suffix}`);
      await expect(
        client(owner2).mcp.servers.update({ id: row.id, config: config(false) }),
      ).resolves.toMatchObject({ id: row.id });
      expect(await state()).toBeNull();
    });

    it("sends a new key for the active row to Reconnect", async () => {
      const serverId = await connected();
      await expect(
        client(owner1).mcp.servers.update({ id: serverId, secret: "another-key" }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Use Reconnect on the Devin page to replace the key.",
      });
    });

    it("removes the active row the way disconnect does", async () => {
      const serverId = await connected();
      await client(owner1).mcp.servers.remove({ id: serverId });
      expect(await state()).toBeNull();
      expect(await prisma.devinSession.count({ where: { spaceId: spaceA } })).toBe(0);
      expect((await client(member).devin.sessions()).connection.status).toBe("none");
    });
  });

  it("a stale remove of a replaced server leaves the new connection alone", async () => {
    const oldId = await connected();
    await client(owner2).devin.replaceKey({ secret: "key-two" });
    const current = (await state())!.serverId;
    await expect(client(owner1).mcp.servers.remove({ id: oldId })).rejects.toBeTruthy();
    expect((await state())!.serverId).toBe(current);
    expect(await prisma.mcpServer.count({ where: { id: current } })).toBe(1);
  });

  describe("agent", () => {
    it("creates the connector's agent once, however many calls race, and is null for others", async () => {
      await client(owner1).devin.connect({ secret: "key-one" });
      const [a, b] = await Promise.all([
        client(owner1).devin.agent(),
        client(owner1).devin.agent(),
      ]);
      expect(a?.bot.id).toBeTruthy();
      expect(b?.bot.id).toBe(a?.bot.id);
      const server = (await prisma.mcpServer.findFirst({ where: { spaceId: spaceA } }))!;
      expect(server.agentBotId).toBe(a?.bot.id);
      expect(await prisma.bot.count({ where: { spaceId: spaceA, archivedAt: null } })).toBe(1);
      expect(await client(owner2).devin.agent()).toBeNull();
      expect(await client(member).devin.agent()).toBeNull();
      expect(await client(outsider).devin.agent()).toBeNull();
      await expect(client(former).devin.agent()).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("is null when nothing is connected", async () => {
      expect(await client(owner1).devin.agent()).toBeNull();
    });
  });
});
