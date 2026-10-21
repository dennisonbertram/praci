import type { SourceMeeting } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  deleteMeeting,
  getMeeting,
  getMeetingSyncState,
  listMeetings,
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
});
