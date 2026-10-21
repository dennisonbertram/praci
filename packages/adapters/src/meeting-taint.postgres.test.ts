import { readFileSync } from "node:fs";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { markMeetingTaintOnDelivery } from "./meeting-tools.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("meeting taint mark (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `mtt-org-${suffix}`;
  const scope = { spaceId: `mtt-space-${suffix}`, userId: `mtt-user-${suffix}` };
  const ids = (n: string) => `mtt-${n}-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const mark = (from: string, to: string) =>
    markMeetingTaintOnDelivery(prisma, {
      ...scope,
      senderBotId: ids(from),
      sourceThreadId: ids(`t-${from}`),
      targetThreadId: ids(`t-${to}`),
    });
  const marked = async (n: string) =>
    (await prisma.thread.findUniqueOrThrow({ where: { id: ids(`t-${n}`) } })).meetingTaintedAt !==
    null;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: scope.userId, name: "u", email: `${scope.userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: orgId, name: "MTT", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: scope.spaceId, organizationId: orgId, name: "s" } });
    await prisma.member.create({
      data: {
        id: ids("member"),
        organizationId: orgId,
        userId: scope.userId,
        role: "owner",
        createdAt: new Date(),
      },
    });
    await prisma.spaceMember.create({
      data: {
        id: ids("sm"),
        spaceId: scope.spaceId,
        organizationId: orgId,
        userId: scope.userId,
        createdAt: new Date(),
      },
    });
    for (const n of ["meeting", "a", "b", "other"]) {
      await prisma.bot.create({
        data: {
          id: ids(n),
          ...scope,
          name: n,
          color: "#000000",
          spawnKey: n === "meeting" ? `integration-agent:${ids("srv")}` : null,
        },
      });
      await prisma.thread.create({ data: { id: ids(`t-${n}`), ...scope, botId: ids(n) } });
    }
    await prisma.mcpServer.create({
      data: {
        id: ids("srv"),
        ...scope,
        slug: `g-${suffix}`,
        name: "Granola",
        transport: "http",
        endpoint: "https://mcp.granola.ai/mcp",
        agentBotId: ids("meeting"),
      },
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: scope.userId } });
    await close();
  });

  it("marks the thread a meeting agent delivers into, and no thread an ordinary agent delivers into", async () => {
    await mark("other", "b");
    expect(await marked("b")).toBe(false);
    await mark("meeting", "b");
    expect(await marked("b")).toBe(true);
  });

  it("carries the mark forward when the marked agent forwards, even after the source agent is gone", async () => {
    await prisma.mcpServer.deleteMany({ where: { id: ids("srv") } });
    await prisma.bot.update({ where: { id: ids("meeting") }, data: { archivedAt: new Date() } });
    expect(await marked("a")).toBe(false);
    await mark("b", "a");
    expect(await marked("a")).toBe(true);
  });

  it("backfills threads that already hold Granola text, including forwards, and is repeatable", async () => {
    // Fresh threads: a (a forwarded b earlier), c receives from a, d is unrelated.
    await prisma.mcpServer.create({
      data: {
        id: ids("srv2"),
        ...scope,
        slug: `g2-${suffix}`,
        name: "Granola",
        transport: "http",
        endpoint: "https://mcp.granola.ai/mcp",
        agentBotId: ids("meeting"),
      },
    });
    await prisma.thread.updateMany({
      where: { id: { in: ["a", "b", "other", "meeting"].map((n) => ids(`t-${n}`)) } },
      data: { meetingTaintedAt: null },
    });
    const receive = (thread: string, from: string, seq: number) =>
      prisma.message.create({
        data: {
          threadId: ids(`t-${thread}`),
          seq,
          role: "user",
          blocks: [
            {
              kind: "bot_message_received",
              fromBotId: ids(from),
              fromBotName: from,
              text: "x",
              hop: 1,
            },
          ],
        },
      });
    await receive("b", "meeting", 1);
    await receive("a", "b", 1);
    const sql = readFileSync(
      new URL(
        "../../db/prisma/migrations/20261218000000_thread_meeting_taint/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ).split("-- Backfill")[1]!;
    const block = sql.slice(sql.indexOf("DO $$"));
    await prisma.$executeRawUnsafe(block);
    expect(await marked("meeting")).toBe(true);
    expect(await marked("b")).toBe(true);
    expect(await marked("a")).toBe(true);
    expect(await marked("other")).toBe(false);
    const before = (await prisma.thread.findUniqueOrThrow({ where: { id: ids("t-a") } }))
      .meetingTaintedAt;
    await prisma.$executeRawUnsafe(block);
    const after = (await prisma.thread.findUniqueOrThrow({ where: { id: ids("t-a") } }))
      .meetingTaintedAt;
    expect(after).toEqual(before);
  });

  it("marks a spawned child of a marked thread when the child is created", async () => {
    const actor = { ...scope, email: "", isDeploymentOwner: false };
    const child = (name: string, parent: string) =>
      createRepos(prisma).createBot(actor, {
        name,
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: false,
        parentBotId: ids(parent),
      });
    const fromMarked = await child("child-marked", "a");
    const fromOpen = await child("child-open", "other");
    const threadOf = (botId: string) => prisma.thread.findFirstOrThrow({ where: { botId } });
    expect((await threadOf(fromMarked.id)).meetingTaintedAt).not.toBeNull();
    expect((await threadOf(fromOpen.id)).meetingTaintedAt).toBeNull();
  });
});
