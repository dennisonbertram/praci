import type { SourceMeeting } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { upsertMeeting } from "./meetings.js";
import { mergeMeetingWithPrevious } from "./meetings-merge.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const at = (time: string) => `2026-02-03T${time}:00.000Z`;
const fixture = (over: Partial<SourceMeeting>): SourceMeeting => ({
  externalId: "x",
  title: "Standup",
  startedAt: at("09:00"),
  endedAt: at("09:30"),
  attendees: [],
  organizerEmail: null,
  sourceUrl: null,
  folders: [],
  summary: "",
  privateNotes: "",
  transcript: [{ speaker: "Ada", text: "first part" }],
  updatedAt: at("12:00"),
  ...over,
});

describePostgres("mergeMeetingWithPrevious (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `merge-org-${suffix}`;
  const mine = { spaceId: `merge-space-${suffix}`, userId: `merge-user-a-${suffix}` };
  const other = { spaceId: mine.spaceId, userId: `merge-user-b-${suffix}` };
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [mine.userId, other.userId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Merge Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: mine.spaceId, organizationId, name: "S" } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, other.userId] } } });
    await close();
  });

  const store = async (scope: typeof mine, provider: string, over: Partial<SourceMeeting>) => {
    await upsertMeeting(prisma, scope, null, provider, fixture(over));
    return (await prisma.meeting.findFirstOrThrow({
      where: { ...scope, provider, externalId: over.externalId },
    })).id;
  };

  it("joins span, transcript and notes, moves to-dos and tombstones the later meeting", async () => {
    const a = await store(mine, "praci", { externalId: "a", privateNotes: "note a" });
    const b = await store(mine, "praci", {
      externalId: "b",
      startedAt: at("09:50"),
      endedAt: at("10:20"),
      transcript: [{ speaker: "Bo", text: "second part" }],
      privateNotes: "note b",
    });
    const todo = await prisma.inboxTodo.create({
      data: { ...mine, meetingId: b, text: "Send deck" },
    });
    const result = await mergeMeetingWithPrevious(prisma, mine, b);
    expect(result.meetingId).toBe(a);
    const merged = await prisma.meeting.findUniqueOrThrow({ where: { id: a } });
    expect(merged.endedAt?.toISOString()).toBe(at("10:20"));
    expect(merged.transcript).toBe("Ada: first part\n\nBo: second part");
    expect(merged.privateNotes).toBe("note a\n\nnote b");
    expect((await prisma.inboxTodo.findUniqueOrThrow({ where: { id: todo.id } })).meetingId).toBe(a);
    expect(await prisma.meeting.findUnique({ where: { id: b } })).toBeNull();
    // A re-sync of the merged-away meeting does not recreate it.
    expect(
      await upsertMeeting(
        prisma,
        mine,
        null,
        "praci",
        fixture({ externalId: "b", updatedAt: at("23:00") }),
      ),
    ).toBe("tombstoned");
  });

  it("refuses another provider, a gap over 30 minutes, and another user's meeting", async () => {
    const a = await store(mine, "praci", {
      externalId: "c",
      startedAt: at("13:00"),
      endedAt: at("13:30"),
    });
    const otherSource = await store(mine, "granola", {
      externalId: "d",
      startedAt: at("13:40"),
      endedAt: at("13:50"),
    });
    await expect(mergeMeetingWithPrevious(prisma, mine, otherSource)).rejects.toBeInstanceOf(
      IsolationError,
    );
    const far = await store(mine, "praci", {
      externalId: "e",
      startedAt: at("14:01"),
      endedAt: at("14:20"),
    });
    await expect(mergeMeetingWithPrevious(prisma, mine, far)).rejects.toBeInstanceOf(
      IsolationError,
    );
    const near = await store(mine, "praci", {
      externalId: "f",
      startedAt: at("14:50"),
      endedAt: at("15:00"),
    });
    // "e" ended 14:20, so "f" 14:50 is exactly 30 minutes later: allowed for the owner only.
    await expect(mergeMeetingWithPrevious(prisma, other, near)).rejects.toBeInstanceOf(
      IsolationError,
    );
    expect(await prisma.meeting.findUnique({ where: { id: near } })).not.toBeNull();
    expect(a).toBeTruthy();
  });
});
