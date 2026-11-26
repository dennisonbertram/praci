import { createRouterClient } from "@orpc/server";
import {
  createMeetingSourceRegistry,
  OmiCloudApiEmulator,
  omiEmulatorConversations,
  reconcileMeetingSyncs,
  runMeetingSyncJob,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { OMI_CLOUD_CONNECTOR_ID } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "../../../packages/adapters/src/computer-lifecycle.js";
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

const KEY = "omi_dev_test_valid_key";

describePostgres("omiCloud.* (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `oc-${name}-${suffix}`;
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

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let emulator: OmiCloudApiEmulator;
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
  const connections = (userId: string) =>
    prisma.connection.findMany({ where: { spaceId, userId, connectorId: OMI_CLOUD_CONNECTOR_ID } });

  beforeAll(async () => {
    emulator = new OmiCloudApiEmulator({ apiKey: KEY });
    registry = createMeetingSourceRegistry({ omiCloudBaseUrl: await emulator.start() });
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
    await expect(client(c).omiCloud.connect({ apiKey: "omi_dev_wrong" })).rejects.toThrow(
      "Omi rejected this key",
    );
    expect(await connections(userC)).toHaveLength(0);
    expect(await prisma.secret.count({ where: { spaceId, userId: userC } })).toBe(0);
  });

  it("rejects an MCP key before any request", async () => {
    const before = emulator.requests.length;
    await expect(client(c).omiCloud.connect({ apiKey: "omi_mcp_abc" })).rejects.toThrow(
      "This is an MCP key",
    );
    expect(emulator.requests.length).toBe(before);
    expect(await connections(userC)).toHaveLength(0);
  });

  it("treats a 403 as a rejected key", async () => {
    const forbidden = createMeetingSourceRegistry({
      omiCloudBaseUrl: "http://omi.test",
      fetch: (async () => new Response("{}", { status: 403 })) as typeof fetch,
    });
    await expect(client(c, forbidden).omiCloud.connect({ apiKey: KEY })).rejects.toThrow(
      "Omi rejected this key",
    );
    expect(await connections(userC)).toHaveLength(0);
  });

  it("connects, keeps one connection per user, and a reconnect clears the sync error", async () => {
    await client(a).omiCloud.connect({ apiKey: ` ${KEY} ` });
    const [first] = await connections(userA);
    expect(first).toMatchObject({ status: "connected", provider: "omi_cloud" });
    expect(jobs.enqueue).toHaveBeenCalled();
    await prisma.meetingSyncState.create({
      data: {
        spaceId,
        userId: userA,
        connectionId: first?.id,
        provider: "omi_cloud",
        error: "Omi rejected this key",
      },
    });
    await prisma.connection.update({
      where: { id: first?.id },
      data: { status: "needs_reconnect" },
    });
    await client(a).omiCloud.connect({ apiKey: KEY });
    const rows = await connections(userA);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: first?.id, status: "connected" });
    expect(rows[0]?.secretId).not.toBe(first?.secretId);
    expect(await prisma.secret.count({ where: { id: first?.secretId ?? "" } })).toBe(0);
    const state = await prisma.meetingSyncState.findFirst({ where: { connectionId: first?.id } });
    expect(state?.error).toBeNull();
    expect(JSON.stringify(await client(a).omiCloud.status())).not.toContain(KEY);
  });

  it("leaves another user's connection untouched, including on disconnect", async () => {
    await client(b).omiCloud.connect({ apiKey: KEY });
    const [bRow] = await connections(userB);
    await client(a).omiCloud.disconnect();
    expect((await connections(userA))[0]).toMatchObject({ status: "disconnected", secretId: null });
    expect(await connections(userB)).toEqual([bRow]);
    expect(await client(c).omiCloud.status()).toBeNull();
    expect((await client(b).omiCloud.status())?.status).toBe("connected");
  });

  it("reconcile queues the Omi sync for a connected key", async () => {
    jobs.enqueue.mockClear();
    await reconcileMeetingSyncs({ prisma, jobs } as never);
    const queued = JSON.stringify(jobs.enqueue.mock.calls);
    expect(queued).toContain("omi_cloud");
    const [bRow] = await connections(userB);
    expect(queued).toContain(bRow?.id);
  });

  it("uses the pendant's Omi agent when the user has one", async () => {
    await client(c).omi.connect({ model: "m", firmware: "f", hardware: "h", deviceId: "d" });
    const pendant = await prisma.connection.findFirstOrThrow({
      where: { spaceId, userId: userC, connectorId: "omi" },
    });
    expect(pendant.agentBotId).toBeTruthy();
    await client(c).omiCloud.connect({ apiKey: KEY });
    const status = await client(c).omiCloud.status();
    expect(status?.agentBotId).toBe(pendant.agentBotId);
    const access = await prisma.botConnectionAccess.count({
      where: { connectionId: status?.connectionId, botId: pendant.agentBotId ?? "" },
    });
    expect(access).toBe(1);
  });

  it("a reconnect keeps the connection's agent and grants nothing to the pendant's agent", async () => {
    // A has a cloud connection with its own agent; a pendant with another agent comes later.
    const own = await prisma.connection.findFirstOrThrow({
      where: { spaceId, userId: userA, connectorId: OMI_CLOUD_CONNECTOR_ID },
    });
    expect(own.agentBotId).toBeTruthy();
    await client(a).omi.connect({ model: "m", firmware: "f", hardware: "h", deviceId: "d" });
    const pendant = await prisma.connection.findFirstOrThrow({
      where: { spaceId, userId: userA, connectorId: "omi" },
    });
    expect(pendant.agentBotId).not.toBe(own.agentBotId);
    await client(a).omiCloud.connect({ apiKey: KEY });
    expect((await client(a).omiCloud.status())?.agentBotId).toBe(own.agentBotId);
    expect(
      await prisma.botConnectionAccess.count({
        where: { connectionId: own.id, botId: pendant.agentBotId ?? "" },
      }),
    ).toBe(0);
  });

  it("makes at most two transcript calls a job, continues in the next, and never re-reads unchanged ones", async () => {
    const many = new OmiCloudApiEmulator({
      apiKey: KEY,
      conversations: omiEmulatorConversations().flatMap((conversation, i) =>
        [0, 1, 2].map((n) => ({
          ...conversation,
          id: `${conversation.id}-${n}`,
          startedAt: new Date(
            Date.parse(conversation.startedAt) - (i * 3 + n) * 11 * 3_600_000,
          ).toISOString(),
          finishedAt: new Date(
            Date.parse(conversation.finishedAt) - (i * 3 + n) * 11 * 3_600_000,
          ).toISOString(),
          overview: `Overview ${i}-${n}`,
        })),
      ),
    });
    for (const c of many.conversationIds()) if (c.endsWith("-1")) many.listWithoutTranscript.add(c);
    const manyRegistry = createMeetingSourceRegistry({ omiCloudBaseUrl: await many.start() });
    try {
      const [bRow] = await connections(userB);
      const run = async () => {
        await prisma.meetingSyncState.updateMany({
          where: { connectionId: bRow?.id },
          data: { lastSyncedAt: new Date(Date.now() - 10 * 60_000) },
        });
        await runMeetingSyncJob(
          { prisma, jobs, secrets: secrets as never, registry: manyRegistry },
          { spaceId, userId: userB, provider: "omi_cloud", connectionId: bRow?.id } as never,
        );
      };
      const transcriptCalls = () =>
        many.requests.filter(
          (r) =>
            r.query.includes("include_transcript=true") || /conversations\/[^/]+$/.test(r.path),
        ).length;
      const stored = () =>
        prisma.meeting.count({ where: { spaceId, userId: userB, provider: "omi_cloud" } });
      // Fallback detail calls count in the same budget: no job makes more than two.
      let before = transcriptCalls();
      await run();
      expect(transcriptCalls() - before).toBeLessThanOrEqual(2);
      const first = await stored();
      expect(first).toBeGreaterThan(0);
      for (let i = 0; i < 12; i++) {
        before = transcriptCalls();
        await run();
        expect(transcriptCalls() - before).toBeLessThanOrEqual(2);
      }
      expect(await stored()).toBeGreaterThan(first);
      const total = transcriptCalls();
      await run();
      expect(transcriptCalls()).toBe(total);
    } finally {
      await many.stop();
    }
  });
});
