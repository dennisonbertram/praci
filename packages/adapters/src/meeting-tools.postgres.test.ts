import type { SourceMeeting } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, upsertMeeting } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { meetingToolFromTool } from "./meeting-tools.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const meeting = (externalId: string, title: string): SourceMeeting => ({
  externalId,
  title,
  startedAt: "2026-01-10T15:00:00.000Z",
  endedAt: null,
  attendees: [{ name: "Ada", email: "ada@example.test" }],
  organizerEmail: null,
  sourceUrl: null,
  folders: [],
  summary: "zeppelin hosting costs",
  privateNotes: "",
  transcript: null,
  updatedAt: "2026-01-10T16:00:00.000Z",
});

describePostgres("meeting tools (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `mt-org-${suffix}`;
  const mine = { spaceId: `mt-space-a-${suffix}`, userId: `mt-user-a-${suffix}` };
  const otherUser = { spaceId: mine.spaceId, userId: `mt-user-b-${suffix}` };
  const otherSpace = { spaceId: `mt-space-b-${suffix}`, userId: mine.userId };
  const mcp = (id: string, who: typeof mine) => ({ mcpServerId: `mt-mcp-${id}-${suffix}`, who });
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const deps = (scope: typeof mine) => ({
    prisma,
    scope,
    consentAllowed: async () => true,
  });

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
      data: { id: orgId, name: "MT", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [mine.spaceId, otherSpace.spaceId].map((id) => ({
        id,
        organizationId: orgId,
        name: id,
      })),
    });
    for (const [id, who] of [
      ["mine", mine],
      ["user", otherUser],
      ["space", otherSpace],
    ] as const) {
      const { mcpServerId } = mcp(id, who);
      await prisma.mcpServer.create({
        data: {
          id: mcpServerId,
          ...who,
          slug: `s-${id}-${suffix}`,
          name: id,
          transport: "http",
          endpoint: "https://mcp.example.test",
        },
      });
      await upsertMeeting(
        prisma,
        who,
        { mcpServerId },
        "granola",
        meeting(`e-${id}`, `Mine ${id}`),
      );
    }
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, otherUser.userId] } } });
    await close();
  });

  it("never returns another user's or space's meeting, by list, search or id", async () => {
    const rows = await prisma.meeting.findMany({ where: { externalId: { startsWith: "e-" } } });
    const foreign = rows.filter((r) => r.userId !== mine.userId || r.spaceId !== mine.spaceId);
    expect(foreign).toHaveLength(2);
    for (const name of ["meetings_list", "meetings_search"]) {
      const result = (await meetingToolFromTool(name, deps(mine), {
        text: "zeppelin",
        userId: otherUser.userId,
      })) as { meetings: { meeting: string }[] };
      expect(result.meetings).toHaveLength(1);
      expect(result.meetings[0]!.meeting).toContain("Mine mine");
    }
    for (const row of foreign) {
      const got = await meetingToolFromTool("meetings_get", deps(mine), { id: row.id });
      expect(got).toEqual({ error: "no such meeting" });
    }
  });
});
