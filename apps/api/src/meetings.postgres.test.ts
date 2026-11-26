import { createRouterClient } from "@orpc/server";
import {
  aiRecipient,
  archiveBot,
  createMeetingSourceRegistry,
  GranolaApiEmulator,
  runMeetingSyncJob,
} from "@rakazo/adapters";
import type { Actor, SourceMeeting } from "@rakazo/contracts";
import {
  AI_DISCLOSURE_VERSION,
  GRANOLA_API_CONNECTOR_ID,
  GRANOLA_MCP_ENDPOINT,
  granolaAgentSpawnKey,
  integrationAgentSpawnKey,
  isIntegrationAgentForServer,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "../../../packages/adapters/src/computer-lifecycle.js";
import { isMeetingSourceAgent } from "../../../packages/adapters/src/meeting-tools.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

vi.mock("../../../packages/adapters/src/computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  provisionComputer: async () => ({ id: "synthetic-computer", kind: "desktop" }),
}));

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const KEY = "grn_test_valid_key_1234";
const DAY = 86_400_000;
const note = (id: string, daysAgo: number): SourceMeeting => ({
  externalId: id,
  title: `Invented meeting ${id}`,
  startedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
  endedAt: null,
  attendees: [],
  organizerEmail: null,
  sourceUrl: null,
  folders: [],
  summary: `Summary ${id}`,
  privateNotes: "",
  transcript: [{ speaker: "Ada", text: `Words in ${id}` }],
  updatedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
});

describePostgres("meetings.* (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `mt-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const otherSpaceId = id("space2");
  const userA = id("user-a");
  const userB = id("user-b");
  const userC = id("user-c");
  const actor = (userId: string, space = spaceId): Actor => ({
    userId,
    spaceId: space,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const a = actor(userA);
  const b = actor(userB);
  const c = actor(userC);
  const aOtherSpace = actor(userA, otherSpaceId);

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let emulator: GranolaApiEmulator;
  let registry: ReturnType<typeof createMeetingSourceRegistry>;
  let n = 0;
  const jobs = { enqueue: vi.fn(async () => undefined), cancel: async () => undefined };
  const secrets = {
    put: async (plaintext: string) => ({ id: id(`secret-${n++}`), ciphertext: plaintext }),
    load: async (ciphertext: string) => ciphertext,
  };
  const env = {
    agentRuntime: "pi",
    deploymentModelConfigured: true,
    defaultProvider: "openrouter",
    defaultModel: "test/model",
  };
  const router = (sources = registry) =>
    createRouter({
      prisma,
      env,
      secrets,
      jobs,
      sandbox: {},
      home: {},
      meetingSources: sources,
    } as unknown as RouterDeps);
  const client = (who: Actor, sources = registry) =>
    createRouterClient(router(sources), { context: { actor: who } as never });
  const granolaBots = (userId: string) =>
    prisma.bot.findMany({
      where: { spaceId, userId, spawnKey: granolaAgentSpawnKey(userId), archivedAt: null },
    });
  const ctx = (who: Actor) => ({ userId: who.userId, spaceId: who.spaceId }) as never;
  const archiveById = async (who: Actor, botId: string) =>
    archiveBot(
      {
        prisma,
        sandbox: {} as never,
        home: {} as never,
        jobs: { cancel: async () => undefined } as never,
        dataDir: undefined,
      },
      await prisma.bot.findUniqueOrThrow({ where: { id: botId } }),
      ctx(who),
    );
  const runSync = async (who: Actor, connectionId: string) => {
    // Let the minimum interval pass so a second pass reads the source again.
    await prisma.meetingSyncState.updateMany({
      where: { connectionId },
      data: { lastSyncedAt: new Date(Date.now() - 10 * 60_000) },
    });
    await runMeetingSyncJob({ prisma, jobs, secrets: secrets as never, registry }, {
      spaceId: who.spaceId,
      userId: who.userId,
      provider: "granola",
      connectionId,
    } as never);
  };
  const mkServer = (userId: string) =>
    prisma.mcpServer.create({
      data: {
        spaceId,
        userId,
        slug: "granola",
        name: "Granola",
        transport: "streamable_http",
        endpoint: GRANOLA_MCP_ENDPOINT,
      },
    });

  beforeAll(async () => {
    emulator = new GranolaApiEmulator({
      apiKey: KEY,
      meetings: [note("not_aaa", 1), note("not_bbb", 2)],
    });
    registry = createMeetingSourceRegistry({ granolaBaseUrl: await emulator.start() });
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await emulator.stop();
      await prisma.$disconnect();
      await db.pool.end();
    };
    for (const userId of [userA, userB, userC]) {
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
    for (const userId of [userA, userB, userC]) {
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
    const spaces = { spaceId: { in: [spaceId, otherSpaceId] } };
    await prisma.inboxTodo.deleteMany({ where: spaces });
    await prisma.meeting.deleteMany({ where: spaces });
    await prisma.meetingTombstone.deleteMany({ where: spaces });
    await prisma.connection.deleteMany({ where: spaces });
    await prisma.mcpServer.deleteMany({ where: spaces });
    await prisma.secret.deleteMany({ where: { spaceId } });
    await prisma.bot.deleteMany({ where: spaces });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { endsWith: suffix } } });
    await close();
  });

  beforeEach(() => {
    jobs.enqueue.mockClear();
  });

  it("rejects a bad key and stores nothing", async () => {
    await expect(client(c).meetings.connect({ apiKey: "grn_wrong" })).rejects.toThrow(
      "Granola rejected this key",
    );
    await expect(client(c).meetings.connect({ apiKey: "   " })).rejects.toThrow(
      "Granola rejected this key",
    );
    expect(await client(c).meetings.status()).toBeNull();
    expect(await prisma.connection.count({ where: { userId: userC } })).toBe(0);
    expect(await prisma.secret.count({ where: { userId: userC } })).toBe(0);
    expect(await prisma.bot.count({ where: { userId: userC } })).toBe(0);
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it("says it could not reach Granola when the network fails, and stores nothing", async () => {
    const down = createMeetingSourceRegistry({
      fetch: async () => {
        throw new Error("offline");
      },
    });
    await expect(client(c, down).meetings.connect({ apiKey: KEY })).rejects.toThrow(
      "Could not reach Granola",
    );
    expect(await prisma.connection.count({ where: { userId: userC } })).toBe(0);
    expect(await prisma.secret.count({ where: { userId: userC } })).toBe(0);
  });

  it("connects: trims the key, stores it, makes one agent, records consent, queues a sync", async () => {
    await client(a).meetings.connect({ apiKey: `  ${KEY}\n` });
    const rows = await prisma.connection.findMany({ where: { userId: userA } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      connectorId: GRANOLA_API_CONNECTOR_ID,
      status: "connected",
      allAgents: false,
      writesEnabled: false,
    });
    const secret = await prisma.secret.findUniqueOrThrow({
      where: { id: rows[0]?.secretId ?? "" },
    });
    expect(secret.ciphertext).toBe(KEY);
    const bots = await granolaBots(userA);
    expect(bots).toHaveLength(1);
    expect(rows[0]?.agentBotId).toBe(bots[0]?.id);
    expect(bots[0]?.instructions).toContain("Granola");
    expect(await prisma.aiDataConsent.count({ where: { userId: userA } })).toBeGreaterThan(0);
    expect(jobs.enqueue).toHaveBeenCalledTimes(1);
    expect(
      await isMeetingSourceAgent({ ...bots[0], archivedAt: null } as never, { prisma } as never),
    ).toBe(true);
  });

  it("connecting again updates the same connection and reuses the agent and drops the old key", async () => {
    const before = await prisma.connection.findFirstOrThrow({ where: { userId: userA } });
    await client(a).meetings.connect({ apiKey: KEY });
    const rows = await prisma.connection.findMany({ where: { userId: userA } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(before.id);
    expect(rows[0]?.secretId).not.toBe(before.secretId);
    expect(await prisma.secret.count({ where: { id: before.secretId ?? "" } })).toBe(0);
    expect(await granolaBots(userA)).toHaveLength(1);
    // Concurrent connects also end with one connection and one agent.
    await Promise.all([1, 2, 3].map(() => client(a).meetings.connect({ apiKey: KEY })));
    expect(await prisma.connection.count({ where: { userId: userA } })).toBe(1);
    expect(await granolaBots(userA)).toHaveLength(1);
  });

  it("a rejected key while connected leaves the connection and key as they were", async () => {
    const before = await prisma.connection.findFirstOrThrow({ where: { userId: userA } });
    await expect(client(a).meetings.connect({ apiKey: "grn_wrong" })).rejects.toThrow(
      "Granola rejected this key",
    );
    const after = await prisma.connection.findFirstOrThrow({ where: { userId: userA } });
    expect(after).toMatchObject({ id: before.id, secretId: before.secretId, status: "connected" });
  });

  it("never returns the key from any RPC", async () => {
    const outputs = [
      await client(a).meetings.status(),
      (await client(a).meetings.list({})).items,
      await client(a).meetings.refresh(),
      await client(a).connections.list(),
    ];
    expect(JSON.stringify(outputs)).not.toContain(KEY);
    expect(JSON.stringify(outputs)).not.toContain("secretId");
    // The generic app list never shows the key connection.
    expect(await client(a).connections.list()).toEqual([]);
  });

  it("status is per user and shows Syncing until the first sync finishes, then the count", async () => {
    expect(await client(b).meetings.status()).toBeNull();
    const first = await client(a).meetings.status();
    expect(first).toMatchObject({
      status: "connected",
      syncedThrough: null,
      syncedCount: 0,
      consentOff: false,
    });
    await runSync(a, first?.connectionId ?? "");
    const done = await client(a).meetings.status();
    expect(done?.syncedThrough).not.toBeNull();
    expect(done?.syncedCount).toBe(2);
    expect(done?.lastSyncedAt).toBeNull();
    // Meetings from other providers are not Granola's to count.
    await prisma.meeting.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        provider: "omi",
        externalId: "omi-status-count",
        title: "Omi meeting",
        startedAt: new Date(),
        sourceUpdatedAt: new Date(),
      },
    });
    expect((await client(a).meetings.status())?.syncedCount).toBe(2);
    await prisma.meeting.deleteMany({ where: { userId: a.userId, provider: "omi" } });
  });

  it("reports consent off when the model's recipient is not allowed", async () => {
    await prisma.aiDataConsent.deleteMany({ where: { userId: userA } });
    expect((await client(a).meetings.status())?.consentOff).toBe(true);
    jobs.enqueue.mockClear();
    await client(a).meetings.connect({ apiKey: KEY });
    expect((await client(a).meetings.status())?.consentOff).toBe(false);
    // Consent granted: the two stored meetings without a digest are queued.
    const names = jobs.enqueue.mock.calls.map((call) => (call[0] as { name: string }).name);
    expect(names.filter((name) => name === "meetings.digest")).toHaveLength(2);
  });

  it("reports needs_reconnect when a sync was rejected, and a new key restores it", async () => {
    const row = await prisma.connection.findFirstOrThrow({ where: { userId: userA } });
    await prisma.connection.update({ where: { id: row.id }, data: { status: "needs_reconnect" } });
    await prisma.meetingSyncState.updateMany({
      where: { connectionId: row.id },
      data: { error: "Key rejected" },
    });
    expect((await client(a).meetings.status())?.status).toBe("needs_reconnect");
    await client(a).meetings.connect({ apiKey: KEY });
    expect((await client(a).meetings.status())?.status).toBe("connected");
    const state = await prisma.meetingSyncState.findFirstOrThrow({
      where: { connectionId: row.id },
    });
    expect(state.error).toBeNull();
    expect(await granolaBots(userA)).toHaveLength(1);
  });

  it("lists only the actor's meetings", async () => {
    const mine = (await client(a).meetings.list({})).items;
    expect(mine.map((m) => m.title).sort()).toEqual([
      "Invented meeting not_aaa",
      "Invented meeting not_bbb",
    ]);
    expect((await client(b).meetings.list({})).items).toEqual([]);
    expect((await client(aOtherSpace).meetings.list({})).items).toEqual([]);
  });

  it("delete: another user or space cannot; to-dos go with it; sync does not bring it back", async () => {
    const [target] = await prisma.meeting.findMany({
      where: { userId: userA, externalId: "not_aaa" },
    });
    const meetingId = target?.id ?? "";
    await prisma.inboxTodo.create({
      data: { spaceId, userId: userA, meetingId, text: "Send the notes" },
    });
    await expect(client(b).meetings.delete({ meetingId })).rejects.toThrow();
    await expect(client(aOtherSpace).meetings.delete({ meetingId })).rejects.toThrow();
    expect(await prisma.meeting.count({ where: { id: meetingId } })).toBe(1);
    expect(await prisma.inboxTodo.count({ where: { meetingId } })).toBe(1);

    await client(a).meetings.delete({ meetingId });
    expect(await prisma.meeting.count({ where: { id: meetingId } })).toBe(0);
    expect(await prisma.inboxTodo.count({ where: { spaceId, userId: userA } })).toBe(0);
    expect(
      await prisma.meetingTombstone.count({ where: { userId: userA, externalId: "not_aaa" } }),
    ).toBe(1);

    const connectionId = (await prisma.connection.findFirstOrThrow({ where: { userId: userA } }))
      .id;
    await runSync(a, connectionId);
    expect(await prisma.meeting.count({ where: { userId: userA, externalId: "not_aaa" } })).toBe(0);
    expect(await prisma.meeting.count({ where: { userId: userA } })).toBe(1);
  });

  it("disconnect deletes the key, keeps meetings and to-dos, and the list still works", async () => {
    const [kept] = await prisma.meeting.findMany({ where: { userId: userA } });
    await prisma.inboxTodo.create({
      data: { spaceId, userId: userA, meetingId: kept?.id, text: "Follow up" },
    });
    const row = await prisma.connection.findFirstOrThrow({ where: { userId: userA } });
    await client(a).meetings.disconnect();
    const after = await prisma.connection.findUniqueOrThrow({ where: { id: row.id } });
    expect(after).toMatchObject({ status: "disconnected", secretId: null });
    expect(await prisma.secret.count({ where: { id: row.secretId ?? "" } })).toBe(0);
    expect(await prisma.meeting.count({ where: { userId: userA } })).toBe(1);
    expect(await prisma.inboxTodo.count({ where: { userId: userA } })).toBe(1);
    expect((await client(a).meetings.status())?.status).toBe("disconnected");
    expect((await client(a).meetings.list({})).items).toHaveLength(1);
    // No sync runs without a key, and the agent keeps answering from what is stored.
    await client(a).meetings.refresh();
    expect(jobs.enqueue).not.toHaveBeenCalled();
    expect(await granolaBots(userA)).toHaveLength(1);
    // Deleting still works after Disconnect.
    await client(a).meetings.delete({ meetingId: kept?.id ?? "" });
    expect((await client(a).meetings.list({})).items).toEqual([]);
  });

  it("key then sign-in: one Granola agent that serves both routes", async () => {
    // userA already has the key's agent; its connection was disconnected, which keeps the agent.
    const agent = (await granolaBots(userA))[0];
    const server = await mkServer(userA);
    const created = await client(a).integrationAgents.create({ serverId: server.id });
    expect(created.botId).toBe(agent?.id);
    expect(await granolaBots(userA)).toHaveLength(1);
    const linked = await prisma.mcpServer.findUniqueOrThrow({ where: { id: server.id } });
    expect(linked.agentBotId).toBe(agent?.id);
    expect(isIntegrationAgentForServer(linked, { ...agent, archivedAt: null } as never)).toBe(true);
    expect(
      await prisma.botMcpServer.count({ where: { serverId: server.id, botId: agent?.id } }),
    ).toBe(1);
    // Calling Create agent again changes nothing.
    await client(a).integrationAgents.create({ serverId: server.id });
    expect(await granolaBots(userA)).toHaveLength(1);
  });

  it("sign-in then key: one Granola agent that serves both routes", async () => {
    const server = await mkServer(userB);
    const created = await client(b).integrationAgents.create({ serverId: server.id });
    await client(b).meetings.connect({ apiKey: KEY });
    const bots = await granolaBots(userB);
    expect(bots).toHaveLength(1);
    expect(bots[0]?.id).toBe(created.botId);
    const connection = await prisma.connection.findFirstOrThrow({ where: { userId: userB } });
    expect(connection.agentBotId).toBe(created.botId);
    expect(
      await isMeetingSourceAgent({ ...bots[0], archivedAt: null } as never, { prisma } as never),
    ).toBe(true);
  });

  it("removing the sign-in server or the key keeps the agent; a removed agent is recreated once", async () => {
    const agent = (await granolaBots(userB))[0];
    const server = await prisma.mcpServer.findFirstOrThrow({ where: { userId: userB } });
    await client(b).mcp.servers.remove({ id: server.id });
    expect((await granolaBots(userB)).map((bot) => bot.id)).toEqual([agent?.id]);
    await client(b).meetings.disconnect();
    expect((await granolaBots(userB)).map((bot) => bot.id)).toEqual([agent?.id]);
    // Sync keeps working for a connected key whatever happens to the agent.
    await client(b).meetings.connect({ apiKey: KEY });
    const connection = await prisma.connection.findFirstOrThrow({ where: { userId: userB } });
    await archiveById(b, agent?.id ?? "");
    expect(await granolaBots(userB)).toHaveLength(0);
    expect((await client(b).meetings.status())?.agentBotId).toBeNull();
    await runSync(b, connection.id);
    expect(await prisma.meeting.count({ where: { userId: userB } })).toBe(2);
    // Create agent is the repair path and is idempotent.
    const [one, two] = await Promise.all([
      client(b).connections.createAgent({ connectionId: connection.id }),
      client(b).connections.createAgent({ connectionId: connection.id }),
    ]);
    expect(one.botId).toBe(two.botId);
    expect(await granolaBots(userB)).toHaveLength(1);
    expect((await client(b).meetings.status())?.agentBotId).toBe(one.botId);
  });

  it("disconnect and connect racing leave exactly the current secret", async () => {
    const racer = actor(id("user-race"));
    await prisma.user.create({
      data: { id: racer.userId, name: "r", email: racer.email, emailVerified: false },
    });
    await prisma.member.create({
      data: {
        id: id("member-race"),
        organizationId: orgId,
        userId: racer.userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    await client(racer).meetings.connect({ apiKey: KEY });
    for (let round = 0; round < 6; round++) {
      await Promise.all([
        client(racer).meetings.connect({ apiKey: KEY }),
        client(racer).meetings.disconnect(),
        client(racer).meetings.connect({ apiKey: KEY }),
        client(racer).meetings.disconnect(),
      ]);
      const row = await prisma.connection.findFirstOrThrow({ where: { userId: racer.userId } });
      const secrets = await prisma.secret.findMany({ where: { userId: racer.userId } });
      // Connected: the row's own secret and no other. Disconnected: no secret at all.
      expect(secrets.map((secret) => secret.id)).toEqual(row.secretId ? [row.secretId] : []);
      expect(row.status === "connected").toBe(Boolean(row.secretId));
    }
    // Disconnect waits for connect's lock, so it can never read a row connect is replacing.
    await client(racer).meetings.connect({ apiKey: KEY });
    let settled = false;
    let pending: Promise<unknown> = Promise.resolve();
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('granola-connect'), hashtext(${`${racer.spaceId}:${racer.userId}`}))`;
      pending = client(racer)
        .meetings.disconnect()
        .then(() => {
          settled = true;
        });
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(settled).toBe(false);
    });
    await pending;
    expect(settled).toBe(true);
    await prisma.secret.deleteMany({ where: { userId: racer.userId } });
  });

  it("a pre-S6 Granola agent is the one agent after the key is attached and the sign-in is removed and added again", async () => {
    const legacyUser = actor(id("user-legacy"));
    await prisma.user.create({
      data: { id: legacyUser.userId, name: "l", email: legacyUser.email, emailVerified: false },
    });
    await prisma.member.create({
      data: {
        id: id("member-legacy"),
        organizationId: orgId,
        userId: legacyUser.userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    const server = await mkServer(legacyUser.userId);
    const legacy = await createRepos(prisma).createBot(legacyUser, {
      spawnKey: integrationAgentSpawnKey(server.id),
      name: "Granola agent",
      title: "",
      description: "Your Granola account",
      instructions: "legacy",
      notifyOnFinish: true,
    });
    await prisma.mcpServer.update({ where: { id: server.id }, data: { agentBotId: legacy.id } });
    await prisma.botMcpServer.create({
      data: {
        spaceId,
        userId: legacyUser.userId,
        botId: legacy.id,
        serverId: server.id,
        allowAllTools: true,
        allowedTools: [],
      },
    });
    await client(legacyUser).meetings.connect({ apiKey: KEY });
    const connection = await prisma.connection.findFirstOrThrow({
      where: { userId: legacyUser.userId },
    });
    expect(connection.agentBotId).toBe(legacy.id);
    await client(legacyUser).mcp.servers.remove({ id: server.id });
    const again = await mkServer(legacyUser.userId);
    const created = await client(legacyUser).integrationAgents.create({ serverId: again.id });
    expect(created.botId).toBe(legacy.id);
    const active = await prisma.bot.findMany({
      where: {
        spaceId,
        userId: legacyUser.userId,
        archivedAt: null,
        description: "Your Granola account",
      },
    });
    expect(active.map((bot) => bot.id)).toEqual([legacy.id]);
    const linked = await prisma.mcpServer.findUniqueOrThrow({ where: { id: again.id } });
    expect(isIntegrationAgentForServer(linked, active[0] as never)).toBe(true);
  });

  it("pages stored meetings 100 at a time, newest first, and only the actor's", async () => {
    const pager = actor(id("user-pager"));
    await prisma.user.create({
      data: { id: pager.userId, name: "p", email: pager.email, emailVerified: false },
    });
    await prisma.member.create({
      data: {
        id: id("member-pager"),
        organizationId: orgId,
        userId: pager.userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    const base = Date.parse("2026-01-01T00:00:00Z");
    await prisma.meeting.createMany({
      data: Array.from({ length: 205 }, (_, i) => ({
        spaceId,
        userId: pager.userId,
        provider: "granola",
        externalId: `pg_${i}`,
        title: `Meeting ${i}`,
        // Pairs share a start time so the id tiebreak is exercised.
        startedAt: new Date(base + Math.floor(i / 2) * 60_000),
        sourceUpdatedAt: new Date(base),
      })),
    });
    const seen: string[] = [];
    let cursor: string | undefined;
    const sizes: number[] = [];
    for (;;) {
      const page = await client(pager).meetings.list(cursor ? { cursor } : {});
      sizes.push(page.items.length);
      seen.push(...page.items.map((item) => item.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(sizes).toEqual([100, 100, 5]);
    expect(new Set(seen).size).toBe(205);
    const starts = (await client(pager).meetings.list({})).items.map((item) => item.startedAt);
    expect([...starts].sort().reverse()).toEqual(starts);
    expect((await client(b).meetings.list({ cursor: "2026-01-01T00:00:00.000Z|x" })).items).toEqual(
      [],
    );
  });

  it("returns one meeting with its digest and to-dos to its owner only", async () => {
    const meeting = await prisma.meeting.create({
      data: {
        spaceId,
        userId: userA,
        provider: "hex",
        externalId: id("get"),
        title: "Invented sync",
        startedAt: new Date("2026-01-02T10:00:00Z"),
        endedAt: new Date("2026-01-02T10:30:00Z"),
        sourceUpdatedAt: new Date(),
        transcript: "Ada: hello",
        digestStatus: "done",
        digest: {
          decisions: ["Ship it"],
          followUps: ["Who books?"],
          commitments: [],
          identity: "x",
        },
      },
    });
    await prisma.inboxTodo.create({
      data: { spaceId, userId: userA, meetingId: meeting.id, text: "Send the deck" },
    });
    const got = await client(a).meetings.get({ meetingId: meeting.id });
    expect(got).toMatchObject({
      title: "Invented sync",
      provider: "hex",
      endedAt: "2026-01-02T10:30:00.000Z",
      decisions: ["Ship it"],
      followUps: ["Who books?"],
      transcript: "Ada: hello",
    });
    expect(got.todos.map((todo) => todo.text)).toEqual(["Send the deck"]);
    // Another user in the same space, and the same user in another space, find nothing.
    await expect(client(b).meetings.get({ meetingId: meeting.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(client(aOtherSpace).meetings.get({ meetingId: meeting.id })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
  });

  it("tells the page whether a digest is still to come", async () => {
    const model = { provider: "openrouter", id: "vendor/small-model" } as never;
    const ready = createRouterClient(
      createRouter({
        prisma,
        env,
        secrets,
        jobs,
        sandbox: {},
        home: {},
        meetingSources: registry,
        resolveModel: async () => model,
      } as unknown as RouterDeps),
      { context: { actor: a } as never },
    );
    const consent = await prisma.aiDataConsent.create({
      data: {
        userId: userA,
        spaceId,
        recipientKey: aiRecipient({
          provider: "openrouter",
          modelId: "vendor/small-model",
          use: "model",
        })!.key,
        version: AI_DISCLOSURE_VERSION,
      },
    });
    const store = (name: string, minutesAgo: number, digestStatus: string | null) =>
      prisma.meeting.create({
        data: {
          spaceId,
          userId: userA,
          provider: "granola",
          externalId: id(`sum-${name}`),
          title: "Invented sum",
          startedAt: new Date(),
          sourceUpdatedAt: new Date(),
          createdAt: new Date(Date.now() - minutesAgo * 60_000),
          digestStatus,
        },
      });
    const summarizing = async (meetingId: string, who = ready) =>
      (await who.meetings.get({ meetingId })).summarizing;
    try {
      expect(await summarizing((await store("new", 2, null)).id)).toBe(true);
      expect(await summarizing((await store("run", 2, "running")).id)).toBe(true);
      expect(await summarizing((await store("done", 2, "done")).id)).toBe(false);
      expect(await summarizing((await store("failed", 2, "failed")).id)).toBe(false);
      expect(await summarizing((await store("old", 20, null)).id)).toBe(false);
      // Without a model that can run, no digest is coming.
      const fresh = await store("fresh", 2, null);
      expect(await summarizing(fresh.id, client(a))).toBe(false);
    } finally {
      await prisma.aiDataConsent.delete({
        where: {
          userId_spaceId_recipientKey: {
            userId: userA,
            spaceId,
            recipientKey: consent.recipientKey,
          },
        },
      });
    }
  });

  it("still returns the meeting when the readiness check throws or hangs", async () => {
    const withResolver = (resolveModel: () => Promise<never>) =>
      createRouterClient(
        createRouter({
          prisma,
          env,
          secrets,
          jobs,
          sandbox: {},
          home: {},
          meetingSources: registry,
          resolveModel,
        } as unknown as RouterDeps),
        { context: { actor: a } as never },
      );
    const meeting = await prisma.meeting.create({
      data: {
        spaceId,
        userId: userA,
        provider: "granola",
        externalId: id("sum-slow"),
        title: "Invented slow",
        startedAt: new Date(),
        sourceUpdatedAt: new Date(),
        transcript: "Ada: hello",
      },
    });
    const throwing = await withResolver(async () => {
      throw new Error("refresh failed");
    }).meetings.get({ meetingId: meeting.id });
    expect(throwing).toMatchObject({ summarizing: false, transcript: "Ada: hello" });
    const started = Date.now();
    const hanging = await withResolver(() => new Promise<never>(() => undefined)).meetings.get({
      meetingId: meeting.id,
    });
    expect(hanging).toMatchObject({ summarizing: false, transcript: "Ada: hello" });
    expect(Date.now() - started).toBeLessThan(4000);
  });

  it("lists other people's commitments from the digest, not the user's own", async () => {
    await prisma.user.update({ where: { id: userA }, data: { emailVerified: true } });
    try {
      const meeting = await prisma.meeting.create({
        data: {
          spaceId,
          userId: userA,
          provider: "granola",
          externalId: id("actions"),
          title: "Invented actions",
          startedAt: new Date("2026-01-03T10:00:00Z"),
          sourceUpdatedAt: new Date(),
          attendees: [
            { name: "Me", email: `${userA}@rakazo.test` },
            { name: "Bea", email: "bea@rakazo.test" },
          ],
          digestStatus: "done",
          digest: {
            decisions: [],
            followUps: [],
            commitments: [
              { owner: "Me", text: "Send my deck", due: null },
              { owner: "Bea", text: "Book the room", due: "2026-01-09" },
            ],
            identity: "x",
          },
        },
      });
      const got = await client(a).meetings.get({ meetingId: meeting.id });
      expect(got.actionItems).toEqual([{ owner: "Bea", text: "Book the room", due: "2026-01-09" }]);
    } finally {
      await prisma.user.update({ where: { id: userA }, data: { emailVerified: false } });
    }
  });

  it("filters the list by title text and source, for the owner only", async () => {
    const f = actor(id("user-filter"));
    await prisma.user.create({
      data: { id: f.userId, name: "f", email: f.email, emailVerified: false },
    });
    await prisma.member.create({
      data: {
        id: id("member-filter"),
        organizationId: orgId,
        userId: f.userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    const mk = (userId: string, provider: string, externalId: string, title: string) => ({
      spaceId,
      userId,
      provider,
      externalId,
      title,
      startedAt: new Date(),
      sourceUpdatedAt: new Date(),
    });
    await prisma.meeting.createMany({
      data: [
        mk(f.userId, "hex", "f1", "Pricing Review"),
        mk(f.userId, "granola", "f2", "Weekly sync"),
        mk(f.userId, "granola", "f3", "pricing follow-up"),
        mk(f.userId, "granola", "literal-underscore", "a_c"),
        mk(f.userId, "granola", "wildcard-underscore", "abc"),
        mk(b.userId, "granola", "f4", "Pricing secret"),
      ],
    });
    const titles = async (input: { q?: string; provider?: string }) =>
      (await client(f).meetings.list(input)).items.map((item) => item.title).sort();
    try {
      expect(await titles({ q: "PRICING" })).toEqual(["Pricing Review", "pricing follow-up"]);
      expect(await titles({ provider: "granola" })).toEqual([
        "Weekly sync",
        "a_c",
        "abc",
        "pricing follow-up",
      ]);
      expect(await titles({ q: "pricing", provider: "granola" })).toEqual(["pricing follow-up"]);
      expect(await titles({ q: "a_c" })).toEqual(["a_c"]);
    } finally {
      await prisma.meeting.deleteMany({
        where: { spaceId, externalId: { in: ["literal-underscore", "wildcard-underscore"] } },
      });
    }
  });

  it("filters the list by attendee email, for the owner only", async () => {
    const f = actor(id("user-attendee"));
    await prisma.user.create({
      data: { id: f.userId, name: "f", email: f.email, emailVerified: false },
    });
    await prisma.member.create({
      data: {
        id: id("member-attendee"),
        organizationId: orgId,
        userId: f.userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    const mk = (userId: string, externalId: string, title: string, attendees: object[]) => ({
      spaceId,
      userId,
      provider: "granola",
      externalId,
      title,
      attendees,
      startedAt: new Date(),
      sourceUpdatedAt: new Date(),
    });
    await prisma.meeting.createMany({
      data: [
        mk(f.userId, "att-1", "With Ada", [{ name: "Ada", email: "ada@rakazo.test" }]),
        mk(f.userId, "att-2", "With Bea", [{ name: "Bea", email: "bea@rakazo.test" }]),
        mk(b.userId, "att-3", "Ada's other meeting", [{ name: "Ada", email: "ada@rakazo.test" }]),
      ],
    });
    const titles = async (input: { attendee?: string }) =>
      (await client(f).meetings.list(input)).items.map((item) => item.title);
    expect(await titles({ attendee: "ADA@rakazo.test" })).toEqual(["With Ada"]);
    expect(await titles({ attendee: "bea@rakazo.test" })).toEqual(["With Bea"]);
    expect(await titles({})).toHaveLength(2);
  });
});
