import { createRouterClient } from "@orpc/server";
import type { AgentRunModel, AgentRunRequest, AgentRuntime } from "@rakazo/adapter-kit";
import { aiRecipient, runMeetingDigest } from "@rakazo/adapters";
import type { Actor, SourceMeeting } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION, HEX_CONNECTOR_ID } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isMeetingSourceAgent } from "../../../packages/adapters/src/meeting-tools.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const MIN = 60_000;
const T0 = Date.parse("2026-10-31T14:00:00.000Z");

describePostgres("meetings.importLocal (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `hx-${name}-${suffix}`;
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

  const names: Record<string, string> = {
    [userA]: "Ada Alpha",
    [userB]: "Ada Bravo",
    [userC]: "Ada Charlie",
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const jobs = {
    enqueue: vi.fn(async () => undefined),
    cancel: async () => undefined,
  };
  const secrets = {
    put: async (plaintext: string) => ({
      id: id("secret"),
      ciphertext: plaintext,
    }),
    load: async (ciphertext: string) => ciphertext,
  };
  const env = { agentRuntime: "scripted", deploymentModelConfigured: false };
  const client = (who: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        env,
        secrets,
        jobs,
        sandbox: {},
        home: {},
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );

  const hex = (
    externalId: string,
    minutesAfterStart: number,
    minutes: number,
    extra: Partial<SourceMeeting> = {},
  ): SourceMeeting => ({
    externalId,
    title: `Invented call ${externalId}`,
    startedAt: new Date(T0 + minutesAfterStart * MIN).toISOString(),
    endedAt: new Date(T0 + (minutesAfterStart + minutes) * MIN).toISOString(),
    attendees: [{ name: "Mallory", email: "mallory@evil.test" }],
    organizerEmail: "mallory@evil.test",
    sourceUrl: "https://evil.test/x",
    folders: ["Zoom"],
    summary: "Hex summary.",
    privateNotes: "should not stay",
    transcript: [
      { speaker: "You", text: "I'll send the revised quote." },
      { speaker: "Them", text: "Thanks." },
      { speaker: "Mallory", text: "Spoofed line." },
    ],
    updatedAt: new Date(T0 + (minutesAfterStart + minutes) * MIN).toISOString(),
    ...extra,
  });
  const connect = async (who: Actor) =>
    (await client(who).meetings.connectLocal({ source: "hex" })).connectionId;
  const stored = (who: Actor, provider = "hex") =>
    prisma.meeting.findMany({
      where: { userId: who.userId, spaceId: who.spaceId, provider },
      orderBy: { startedAt: "asc" },
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const users: Array<[string, boolean]> = [
      [userA, true],
      [userB, true],
      [userC, false],
    ];
    for (const [userId, verified] of users) {
      await prisma.user.create({
        data: {
          id: userId,
          name: names[userId] as string,
          email: `${userId}@Rakazo.test`,
          emailVerified: verified,
        },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    for (const sid of [spaceId, otherSpaceId]) {
      await prisma.space.create({
        data: {
          id: sid,
          organizationId: orgId,
          name: "General",
          isDefault: sid === spaceId,
        },
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
    await prisma.bot.deleteMany({ where: spaces });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { endsWith: suffix } } });
    await close();
  });

  beforeEach(() => jobs.enqueue.mockClear());

  it("connectLocal makes one private Hex connection per user and reuses it", async () => {
    const first = await connect(a);
    expect(await connect(a)).toBe(first);
    const row = await prisma.connection.findUniqueOrThrow({
      where: { id: first },
    });
    expect(row).toMatchObject({
      userId: userA,
      spaceId,
      connectorId: HEX_CONNECTOR_ID,
      provider: "hex",
      status: "connected",
      secretId: null,
      privateByDefault: true,
      allAgents: false,
    });
    expect(await client(b).meetings.localStatus()).toBeNull();
    expect(await client(a).meetings.localStatus()).toMatchObject({
      connectionId: first,
      status: "connected",
      count: 0,
    });
  });

  it("provisions the Hex agent, which counts as a meeting-source agent for taint", async () => {
    const connectionId = await connect(a);
    const row = await prisma.connection.findUniqueOrThrow({
      where: { id: connectionId },
    });
    expect(row.agentBotId).not.toBeNull();
    const bot = await prisma.bot.findUniqueOrThrow({
      where: { id: row.agentBotId as string },
    });
    expect(await isMeetingSourceAgent(bot, { prisma })).toBe(true);
  });

  it("stores the user as the only attendee and ignores what the caller says about people", async () => {
    const connectionId = await connect(a);
    const result = await client(a).meetings.importLocal({
      connectionId,
      meetings: [hex("h1", 0, 30)],
    });
    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 });
    const [row] = await stored(a);
    expect(row).toMatchObject({
      provider: "hex",
      externalId: "h1",
      connectionId,
      organizerEmail: null,
      sourceUrl: null,
      privateNotes: "",
      summary: "Hex summary.",
      folders: ["Zoom"],
    });
    expect(row?.attendees).toEqual([{ name: "Ada Alpha", email: `${userA}@rakazo.test` }]);
    expect(row?.transcript).toBe(
      "Ada Alpha: I'll send the revised quote.\nThem: Thanks.\nThem: Spoofed line.",
    );
    expect(row?.endedAt?.getTime()).toBe(T0 + 30 * MIN);
  });

  it("gives an unverified account no email, so it can never match a to-do", async () => {
    const connectionId = await connect(c);
    await client(c).meetings.importLocal({
      connectionId,
      meetings: [hex("h1", 0, 30)],
    });
    const [row] = await stored(c);
    expect(row?.attendees).toEqual([{ name: "Ada Charlie" }]);
  });

  it("is idempotent by Hex id and updates only when the source update grows", async () => {
    const connectionId = await connect(a);
    const again = await client(a).meetings.importLocal({
      connectionId,
      meetings: [hex("h1", 0, 30)],
    });
    expect(again).toEqual({ created: 0, updated: 0, skipped: 1 });
    const later = hex("h1", 0, 30, {
      summary: "Notes arrived.",
      updatedAt: new Date(T0 + 40 * MIN).toISOString(),
    });
    expect(await client(a).meetings.importLocal({ connectionId, meetings: [later] })).toEqual({
      created: 0,
      updated: 1,
      skipped: 0,
    });
    const rows = await stored(a);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.summary).toBe("Notes arrived.");
    const status = await client(a).meetings.localStatus();
    expect(status?.count).toBe(1);
    expect(status?.syncedThrough).toBe(new Date(T0).toISOString());
    expect(status?.lastSyncedAt).not.toBeNull();
  });

  it("refuses a connection that is not the caller's Hex connection", async () => {
    const mine = await connect(a);
    const theirs = await connect(b);
    const granola = await prisma.connection.create({
      data: {
        spaceId,
        userId: userA,
        connectorId: "granola-api",
        provider: "granola",
        displayName: "Granola",
        status: "connected",
      },
    });
    for (const connectionId of [theirs, granola.id, "nope"]) {
      await expect(
        client(a).meetings.importLocal({
          connectionId,
          meetings: [hex("x1", 100, 10)],
        }),
      ).rejects.toThrow(/not found/i);
    }
    await expect(
      client(actor(userA, otherSpaceId)).meetings.importLocal({
        connectionId: mine,
        meetings: [hex("x1", 100, 10)],
      }),
    ).rejects.toThrow();
    expect(await stored(b)).toHaveLength(0);
    expect(await prisma.meeting.count({ where: { externalId: "x1" } })).toBe(0);
  });

  it("rejects more than ten meetings and meetings after disconnect", async () => {
    const connectionId = await connect(b);
    const eleven = Array.from({ length: 11 }, (_, i) => hex(`m${i}`, 200 + i * 60, 10));
    await expect(
      client(b).meetings.importLocal({ connectionId, meetings: eleven }),
    ).rejects.toThrow();
    await client(b).meetings.disconnectLocal({
      connectionId,
      deleteMeetings: false,
    });
    await expect(
      client(b).meetings.importLocal({
        connectionId,
        meetings: [hex("late", 200, 10)],
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("does not bring back a meeting the user deleted", async () => {
    const connectionId = await connect(a);
    await client(a).meetings.importLocal({
      connectionId,
      meetings: [hex("del", 300, 20)],
    });
    const [row] = (await stored(a)).filter((m) => m.externalId === "del");
    await client(a).meetings.delete({ meetingId: row?.id as string });
    const result = await client(a).meetings.importLocal({
      connectionId,
      meetings: [
        hex("del", 300, 20, {
          updatedAt: new Date(T0 + 999 * MIN).toISOString(),
        }),
      ],
    });
    expect(result).toEqual({ created: 0, updated: 0, skipped: 1 });
    expect((await stored(a)).some((m) => m.externalId === "del")).toBe(false);
  });

  describe("a call recorded twice (first stored wins)", () => {
    const praci = (userId: string, externalId: string, startMin: number, minutes: number) =>
      prisma.meeting.create({
        data: {
          spaceId,
          userId,
          provider: "praci",
          externalId,
          title: "Recorded in Praci",
          startedAt: new Date(T0 + startMin * MIN),
          endedAt: new Date(T0 + (startMin + minutes) * MIN),
          attendees: [],
          folders: [],
          sourceUpdatedAt: new Date(T0),
        },
      });

    it("skips a Hex meeting that overlaps a Praci one by half of the shorter, and keeps it skipped", async () => {
      const connectionId = await connect(a);
      await praci(userA, "p1", 1000, 60);
      // 20-minute Hex call, 15 minutes inside the Praci recording: 75% of the shorter.
      const dup = hex("dup", 1045, 20);
      const result = await client(a).meetings.importLocal({
        connectionId,
        meetings: [dup],
      });
      expect(result).toEqual({ created: 0, updated: 0, skipped: 1 });
      expect((await stored(a)).some((m) => m.externalId === "dup")).toBe(false);
      expect(
        await prisma.meetingTombstone.count({
          where: { userId: userA, provider: "hex", externalId: "dup" },
        }),
      ).toBe(1);
      expect(await client(a).meetings.importLocal({ connectionId, meetings: [dup] })).toEqual({
        created: 0,
        updated: 0,
        skipped: 1,
      });
    });

    it("imports a Hex meeting that only touches the edge, and one that overlaps Granola or someone else's recording", async () => {
      const connectionId = await connect(a);
      // 5 of 30 minutes overlap the Praci recording (1000-1060): under half.
      const edge = hex("edge", 1055, 30);
      // Overlaps a Granola meeting and another user's Praci meeting completely.
      await praci(userB, "p2", 2000, 60);
      await prisma.meeting.create({
        data: {
          spaceId,
          userId: userA,
          provider: "granola",
          externalId: "g1",
          title: "Granola copy",
          startedAt: new Date(T0 + 2000 * MIN),
          endedAt: new Date(T0 + 2060 * MIN),
          attendees: [],
          folders: [],
          sourceUpdatedAt: new Date(T0),
        },
      });
      const other = hex("full", 2000, 60);
      const result = await client(a).meetings.importLocal({
        connectionId,
        meetings: [edge, other],
      });
      expect(result).toEqual({ created: 2, updated: 0, skipped: 0 });
    });

    it("does not skip a Hex meeting that is already stored when a Praci one appears later", async () => {
      const connectionId = await connect(a);
      await client(a).meetings.importLocal({
        connectionId,
        meetings: [hex("first", 3000, 30)],
      });
      await praci(userA, "p3", 3000, 30);
      const grown = hex("first", 3000, 30, {
        updatedAt: new Date(T0 + 4000 * MIN).toISOString(),
      });
      expect(
        await client(a).meetings.importLocal({
          connectionId,
          meetings: [grown],
        }),
      ).toEqual({
        created: 0,
        updated: 1,
        skipped: 0,
      });
    });
  });

  it("lets the digest make the user's to-do from a line they said, and none from the others", async () => {
    const connectionId = await connect(a);
    await client(a).meetings.importLocal({
      connectionId,
      meetings: [hex("todo", 5000, 30)],
    });
    const meeting = await prisma.meeting.findFirstOrThrow({
      where: { userId: userA, externalId: "todo" },
    });
    const model: AgentRunModel = {
      provider: "openrouter",
      id: "test-model",
      apiKey: "k",
    };
    const key = aiRecipient({
      provider: "openrouter",
      modelId: "test-model",
      use: "model",
    })?.key as string;
    await prisma.aiDataConsent.create({
      data: {
        userId: userA,
        spaceId,
        recipientKey: key,
        version: AI_DISCLOSURE_VERSION,
      },
    });
    const answer = JSON.stringify({
      decisions: [],
      followUps: [],
      commitments: [
        { owner: "Ada Alpha", text: "Send the revised quote" },
        { owner: "Mallory", text: "Wire the money" },
      ],
    });
    const runtime = {
      run: async function* (_request: AgentRunRequest) {
        yield { type: "done" as const, text: answer };
      },
    } as unknown as AgentRuntime;
    await runMeetingDigest(
      { prisma, runtime, resolveModel: async () => model },
      { spaceId, userId: userA, meetingId: meeting.id },
    );
    const todos = await prisma.inboxTodo.findMany({
      where: { userId: userA, meetingId: meeting.id },
    });
    expect(todos.map((t) => t.text)).toEqual(["Send the revised quote"]);
  });

  it("disconnectLocal keeps imported meetings, or deletes them with their to-dos on request", async () => {
    const connectionId = await connect(a);
    const before = (await stored(a)).length;
    expect(before).toBeGreaterThan(0);
    await expect(
      client(b).meetings.disconnectLocal({
        connectionId,
        deleteMeetings: true,
      }),
    ).resolves.toEqual({ ok: true });
    expect((await stored(a)).length).toBe(before);
    await client(a).meetings.disconnectLocal({
      connectionId,
      deleteMeetings: false,
    });
    expect((await stored(a)).length).toBe(before);
    expect((await client(a).meetings.localStatus())?.status).toBe("disconnected");
    await client(a).meetings.disconnectLocal({
      connectionId,
      deleteMeetings: true,
    });
    expect(await stored(a)).toHaveLength(0);
    expect(await prisma.inboxTodo.count({ where: { userId: userA } })).toBe(0);
    // Reconnecting reuses the same row.
    expect(await connect(a)).toBe(connectionId);
  });
});
