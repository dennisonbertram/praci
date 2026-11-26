import type { SourceMeeting } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  deleteMeeting,
  getMeeting,
  getMeetingSyncState,
  listMeetings,
  lockMeetingOwner,
  searchMeetings,
  upsertMeeting,
  upsertMeetingSyncState,
} from "./meetings.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const meetingFixture = (over: Partial<SourceMeeting> = {}): SourceMeeting => ({
  externalId: "ext-1",
  title: "Budget review",
  startedAt: "2026-01-10T15:00:00.000Z",
  endedAt: "2026-01-10T15:30:00.000Z",
  attendees: [{ name: "Ada Example", email: "Ada@Example.test" }],
  organizerEmail: "ada@example.test",
  sourceUrl: "https://notes.example.test/ext-1",
  folders: ["Finance"],
  summary: "Agreed to trim the cloud budget.",
  privateNotes: "",
  transcript: [{ speaker: "Ada", text: "The zeppelin hosting bill is too high." }],
  updatedAt: "2026-01-10T16:00:00.000Z",
  ...over,
});

describePostgres("meetings (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `meetings-org-${suffix}`;
  const mine = { spaceId: `meetings-space-a-${suffix}`, userId: `meetings-user-a-${suffix}` };
  const otherUser = { spaceId: mine.spaceId, userId: `meetings-user-b-${suffix}` };
  const otherSpace = { spaceId: `meetings-space-b-${suffix}`, userId: mine.userId };
  const connectionId = `meetings-conn-${suffix}`;
  const mcpServerId = `meetings-mcp-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const source = { connectionId };

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [mine.userId, otherUser.userId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Meetings Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.createMany({
      data: [mine.spaceId, otherSpace.spaceId].map((id) => ({ id, organizationId, name: id })),
    });
    await prisma.connection.create({
      data: {
        id: connectionId,
        ...mine,
        connectorId: "granola-api",
        provider: "granola",
        displayName: "Notes",
        status: "connected",
      },
    });
    await prisma.mcpServer.create({
      data: {
        id: mcpServerId,
        ...mine,
        slug: `m-${suffix}`,
        name: "Flow",
        transport: "http",
        endpoint: "https://mcp.example.test",
      },
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, otherUser.userId] } } });
    await close();
  });

  it("upsert is idempotent and a stale update is ignored", async () => {
    expect(await upsertMeeting(prisma, mine, source, "granola", meetingFixture())).toBe("created");
    expect(await upsertMeeting(prisma, mine, source, "granola", meetingFixture())).toBe("stale");
    expect(
      await upsertMeeting(
        prisma,
        mine,
        source,
        "granola",
        meetingFixture({ title: "Older", updatedAt: "2026-01-09T00:00:00.000Z" }),
      ),
    ).toBe("stale");
    expect(
      await upsertMeeting(
        prisma,
        mine,
        source,
        "granola",
        meetingFixture({
          title: "Budget review v2",
          updatedAt: "2026-01-11T00:00:00.000Z",
          transcript: null,
        }),
      ),
    ).toBe("updated");
    const rows = await listMeetings(prisma, mine);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Budget review v2", transcriptIndexed: true });
    // A listing-only update keeps the stored transcript, and emails are stored lowercase.
    expect(rows[0]?.transcript).toContain("zeppelin");
    expect(rows[0]?.attendees).toEqual([{ name: "Ada Example", email: "ada@example.test" }]);
  });

  it("requires exactly one source", async () => {
    await expect(
      upsertMeeting(
        prisma,
        mine,
        { connectionId, mcpServerId } as never,
        "granola",
        meetingFixture(),
      ),
    ).rejects.toThrow(/exactly one source/);
    await expect(
      prisma.meeting.create({
        data: {
          ...mine,
          connectionId,
          mcpServerId,
          provider: "granola",
          externalId: "two-sources",
          title: "x",
          startedAt: new Date(),
          sourceUpdatedAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });

  it("finds a meeting by full text, filters, and a second provider", async () => {
    await upsertMeeting(
      prisma,
      mine,
      { mcpServerId },
      "wisprflow",
      meetingFixture({
        externalId: "flow-1",
        title: "Standup",
        summary: "",
        transcript: null,
        folders: [],
      }),
    );
    expect((await searchMeetings(prisma, mine, "zeppelin")).map((m) => m.externalId)).toEqual([
      "ext-1",
    ]);
    expect(await searchMeetings(prisma, mine, "nonexistentword")).toEqual([]);
    expect(await listMeetings(prisma, mine, { provider: "wisprflow" })).toHaveLength(1);
    expect(await listMeetings(prisma, mine, { folder: "Finance" })).toHaveLength(1);
    expect(await listMeetings(prisma, mine, { attendeeEmail: "ADA@example.test" })).toHaveLength(2);
    expect(
      await listMeetings(prisma, mine, { from: new Date("2026-02-01T00:00:00Z") }),
    ).toHaveLength(0);
  });

  it("a meeting is never visible to another user or space", async () => {
    const [row] = await searchMeetings(prisma, mine, "zeppelin");
    for (const stranger of [otherUser, otherSpace]) {
      expect(await listMeetings(prisma, stranger)).toEqual([]);
      expect(await searchMeetings(prisma, stranger, "zeppelin")).toEqual([]);
      expect(await getMeeting(prisma, stranger, row!.id)).toBeNull();
      await expect(deleteMeeting(prisma, stranger, row!.id)).rejects.toBeInstanceOf(IsolationError);
    }
    expect(await getMeeting(prisma, mine, row!.id)).not.toBeNull();
  });

  it("a row a provider marked deleted is hidden", async () => {
    await upsertMeeting(
      prisma,
      mine,
      source,
      "granola",
      meetingFixture({ externalId: "gone", title: "Gone", deleted: true, transcript: null }),
    );
    expect((await listMeetings(prisma, mine)).map((m) => m.externalId)).not.toContain("gone");
  });

  it("deleting the Connection keeps the meeting with a null connectionId", async () => {
    const disposable = `${connectionId}-d`;
    await prisma.connection.create({
      data: { id: disposable, ...mine, provider: "granola", displayName: "D", status: "connected" },
    });
    await upsertMeeting(
      prisma,
      mine,
      { connectionId: disposable },
      "granola",
      meetingFixture({ externalId: "orphan" }),
    );
    await upsertMeetingSyncState(prisma, mine, { connectionId: disposable }, "granola", {
      error: "x",
    });
    await prisma.connection.delete({ where: { id: disposable } });
    const row = await prisma.meeting.findFirstOrThrow({ where: { ...mine, externalId: "orphan" } });
    expect(row.connectionId).toBeNull();
    expect(await getMeetingSyncState(prisma, mine, { connectionId: disposable })).toBeNull();
  });

  it("sync state is one row per source and takes patches", async () => {
    await upsertMeetingSyncState(prisma, mine, source, "granola", { externalAccountId: "acct-1" });
    const updated = await upsertMeetingSyncState(prisma, mine, source, "granola", {
      error: "auth",
    });
    expect(updated).toMatchObject({ externalAccountId: "acct-1", error: "auth" });
    expect(await getMeetingSyncState(prisma, otherUser, source)).toBeNull();
    expect(await prisma.meetingSyncState.count({ where: { connectionId } })).toBe(1);
  });

  it("an InboxTodo with a null connectionId and a meetingId round-trips; delete removes it and blocks re-insert", async () => {
    const meeting = await prisma.meeting.findFirstOrThrow({
      where: { ...mine, externalId: "ext-1" },
    });
    const todo = await prisma.inboxTodo.create({
      data: { ...mine, meetingId: meeting.id, text: "Trim the hosting bill" },
    });
    expect(await prisma.inboxTodo.findUniqueOrThrow({ where: { id: todo.id } })).toMatchObject({
      connectionId: null,
      meetingId: meeting.id,
    });
    await deleteMeeting(prisma, mine, meeting.id);
    expect(await prisma.inboxTodo.findUnique({ where: { id: todo.id } })).toBeNull();
    expect(await getMeeting(prisma, mine, meeting.id)).toBeNull();
    expect(
      await upsertMeeting(
        prisma,
        mine,
        source,
        "granola",
        meetingFixture({ updatedAt: "2026-03-01T00:00:00.000Z" }),
      ),
    ).toBe("tombstoned");
    expect((await searchMeetings(prisma, mine, "zeppelin")).map((m) => m.externalId)).toEqual([
      "orphan",
    ]);
    // The tombstone is per user: another user's identical external id is unaffected.
    expect(await upsertMeeting(prisma, otherUser, source, "granola", meetingFixture())).toBe(
      "created",
    );
  });

  it("concurrent upsert and delete never leave a deleted meeting behind", async () => {
    for (let round = 0; round < 5; round++) {
      const externalId = `race-${round}`;
      await upsertMeeting(prisma, mine, source, "granola", meetingFixture({ externalId }));
      const row = await prisma.meeting.findFirstOrThrow({ where: { ...mine, externalId } });
      await Promise.all([
        deleteMeeting(prisma, mine, row.id),
        upsertMeeting(
          prisma,
          mine,
          source,
          "granola",
          meetingFixture({ externalId, updatedAt: "2026-05-01T00:00:00.000Z" }),
        ),
      ]);
      expect(await prisma.meeting.count({ where: { ...mine, externalId } })).toBe(0);
      expect(await prisma.meetingTombstone.count({ where: { ...mine, externalId } })).toBe(1);
    }
  });

  it("concurrent older and newer upserts end with the newer content", async () => {
    for (let round = 0; round < 5; round++) {
      const externalId = `order-${round}`;
      await Promise.all([
        upsertMeeting(
          prisma,
          mine,
          source,
          "granola",
          meetingFixture({ externalId, title: "new", updatedAt: "2026-06-02T00:00:00.000Z" }),
        ),
        upsertMeeting(
          prisma,
          mine,
          source,
          "granola",
          meetingFixture({ externalId, title: "old", updatedAt: "2026-06-01T00:00:00.000Z" }),
        ),
      ]);
      expect(
        (await prisma.meeting.findFirstOrThrow({ where: { ...mine, externalId } })).title,
      ).toBe("new");
    }
  });

  it("concurrent first sync-state upserts both succeed with one row", async () => {
    const fresh = { mcpServerId };
    await Promise.all([
      upsertMeetingSyncState(prisma, mine, fresh, "wisprflow", { error: "a" }),
      upsertMeetingSyncState(prisma, mine, fresh, "wisprflow", { error: "b" }),
    ]);
    expect(await prisma.meetingSyncState.count({ where: { mcpServerId } })).toBe(1);
    await expect(
      upsertMeetingSyncState(prisma, otherUser, fresh, "wisprflow"),
    ).rejects.toBeInstanceOf(IsolationError);
  });
  describe("skipIfRecordedBy", () => {
    const at = (day: string, from: string, to: string | null, over: Partial<SourceMeeting> = {}) =>
      meetingFixture({
        startedAt: `2026-03-${day}T${from}:00.000Z`,
        endedAt: to ? `2026-03-${day}T${to}:00.000Z` : null,
        ...over,
      });
    const skip = { skipIfRecordedBy: ["omi"] };
    const tombstones = (externalId: string) =>
      prisma.meetingTombstone.count({ where: { ...mine, provider: "omi_cloud", externalId } });
    const cloudRows = (externalId: string) =>
      prisma.meeting.count({ where: { ...mine, provider: "omi_cloud", externalId } });

    it("tombstones a cloud meeting that overlaps a stored pendant meeting", async () => {
      await upsertMeeting(
        prisma,
        mine,
        null,
        "omi",
        at("01", "10:00", "10:30", { externalId: "p1" }),
      );
      const r = await upsertMeeting(
        prisma,
        mine,
        source,
        "omi_cloud",
        at("01", "10:05", "10:30", { externalId: "c1" }),
        skip,
      );
      expect(r).toBe("tombstoned");
      expect(await cloudRows("c1")).toBe(0);
      expect(await tombstones("c1")).toBe(1);
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("01", "10:05", "10:30", { externalId: "c1" }),
          skip,
        ),
      ).toBe("tombstoned");
    });

    it("stores back-to-back and under-half-overlap meetings", async () => {
      await upsertMeeting(
        prisma,
        mine,
        null,
        "omi",
        at("02", "10:00", "10:30", { externalId: "p2" }),
      );
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("02", "10:30", "11:00", { externalId: "c2a" }),
          skip,
        ),
      ).toBe("created");
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("02", "10:20", "11:30", { externalId: "c2b" }),
          skip,
        ),
      ).toBe("created");
    });

    it("is not blocked by another user's or space's meeting, or a deleted one", async () => {
      await upsertMeeting(
        prisma,
        otherUser,
        null,
        "omi",
        at("03", "10:00", "10:30", { externalId: "p3u" }),
      );
      await upsertMeeting(
        prisma,
        otherSpace,
        null,
        "omi",
        at("03", "10:00", "10:30", { externalId: "p3s" }),
      );
      await upsertMeeting(
        prisma,
        mine,
        null,
        "omi",
        at("03", "10:00", "10:30", { externalId: "p3d" }),
      );
      await prisma.meeting.updateMany({
        where: { ...mine, externalId: "p3d" },
        data: { deletedAt: new Date() },
      });
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("03", "10:05", "10:30", { externalId: "c3" }),
          skip,
        ),
      ).toBe("created");
      await upsertMeeting(
        prisma,
        mine,
        null,
        "omi",
        at("04", "10:00", "10:30", { externalId: "p4" }),
      );
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("04", "10:05", null, { externalId: "c4" }),
          skip,
        ),
      ).toBe("deferred");
    });

    it("never skips an update of a stored meeting, and does nothing without the option", async () => {
      await upsertMeeting(
        prisma,
        mine,
        source,
        "omi_cloud",
        at("05", "10:00", "10:30", { externalId: "c5" }),
        skip,
      );
      await upsertMeeting(
        prisma,
        mine,
        null,
        "omi",
        at("05", "10:00", "10:30", { externalId: "p5" }),
      );
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("05", "10:00", "10:30", {
            externalId: "c5",
            title: "new",
            updatedAt: "2026-03-05T20:00:00.000Z",
          }),
          skip,
        ),
      ).toBe("updated");
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("05", "10:00", "10:30", { externalId: "c5b" }),
        ),
      ).toBe("created");
    });

    it("a writer holding the owner lock makes a concurrent cloud create wait and then skip", async () => {
      let release!: () => void;
      const held = new Promise<void>((r) => {
        release = r;
      });
      let locked!: () => void;
      const gotLock = new Promise<void>((r) => {
        locked = r;
      });
      const mover = prisma.$transaction(async (tx) => {
        await lockMeetingOwner(tx, mine);
        locked();
        await held;
        await tx.meeting.create({
          data: {
            ...mine,
            provider: "omi",
            externalId: "p7",
            title: "moved",
            startedAt: new Date("2026-03-07T10:00:00.000Z"),
            endedAt: new Date("2026-03-07T10:30:00.000Z"),
            sourceUpdatedAt: new Date(),
          },
        });
      });
      await gotLock;
      const cloud = upsertMeeting(
        prisma,
        mine,
        source,
        "omi_cloud",
        at("07", "10:00", "10:30", { externalId: "c7" }),
        skip,
      );
      await new Promise((r) => setTimeout(r, 200));
      release();
      await mover;
      expect(await cloud).toBe("tombstoned");
      expect(await cloudRows("c7")).toBe(0);
    });

    it("waits for an unfinished cloud conversation instead of storing it", async () => {
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("08", "10:00", null, { externalId: "c8" }),
          skip,
        ),
      ).toBe("deferred");
      expect(await cloudRows("c8")).toBe(0);
      expect(await tombstones("c8")).toBe(0);
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("08", "10:00", "10:30", { externalId: "c8", updatedAt: "2026-03-08T20:00:00.000Z" }),
          skip,
        ),
      ).toBe("created");
      // Finishing over a stored pendant meeting is tombstoned.
      await upsertMeeting(
        prisma,
        mine,
        null,
        "omi",
        at("09", "10:00", "10:30", { externalId: "p9" }),
      );
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("09", "10:00", null, { externalId: "c9" }),
          skip,
        ),
      ).toBe("deferred");
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("09", "10:00", "10:30", { externalId: "c9", updatedAt: "2026-03-09T20:00:00.000Z" }),
          skip,
        ),
      ).toBe("tombstoned");
      // A stored cloud meeting with no end keeps updating.
      await upsertMeeting(
        prisma,
        mine,
        source,
        "omi_cloud",
        at("10", "10:00", null, { externalId: "c10" }),
      );
      expect(
        await upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("10", "10:00", null, {
            externalId: "c10",
            title: "n",
            updatedAt: "2026-03-10T20:00:00.000Z",
          }),
          skip,
        ),
      ).toBe("updated");
    });

    it("keeps exactly one of two concurrent overlapping pendant and cloud inserts", async () => {
      const both = await Promise.all([
        upsertMeeting(prisma, mine, null, "omi", at("06", "10:00", "10:30", { externalId: "p6" }), {
          skipIfRecordedBy: ["omi_cloud"],
        }),
        upsertMeeting(
          prisma,
          mine,
          source,
          "omi_cloud",
          at("06", "10:00", "10:30", { externalId: "c6" }),
          skip,
        ),
      ]);
      expect([...both].sort()).toEqual(["created", "tombstoned"]);
    });
  });
});
