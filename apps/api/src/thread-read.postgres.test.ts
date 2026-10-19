import { readFileSync } from "node:fs";
import type { Actor } from "@rakazo/contracts";
import { createDb, createThreadMessage, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  setThreadUnreadState,
  type ThreadTarget,
  threadSnapshotForReader,
} from "./thread-target.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("thread read boundary (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `tr-org-${suffix}`;
  const spaceA = `tr-space-a-${suffix}`;
  const spaceB = `tr-space-b-${suffix}`;
  const alice: Actor = {
    spaceId: spaceA,
    userId: `tr-alice-${suffix}`,
    email: "a@example.test",
    isDeploymentOwner: false,
  };
  const bob: Actor = { ...alice, userId: `tr-bob-${suffix}`, email: "b@example.test" };
  const aliceElsewhere: Actor = { ...alice, spaceId: spaceB };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const target = (threadId: string) => ({ threadId }) as unknown as ThreadTarget;
  const read = async (threadId: string) =>
    prisma.thread.findUniqueOrThrow({
      where: { id: threadId },
      select: { lastReadSeq: true, unread: true },
    });
  /** Seqs 0..n-1 alternate bot, user, bot, ... so seq 0, 2, 4 come from the other party. */
  async function thread(owner: Actor, messages = 5) {
    const group = await prisma.chatGroup.create({
      data: {
        spaceId: owner.spaceId,
        userId: owner.userId,
        name: "Read",
        thread: { create: { spaceId: owner.spaceId, userId: owner.userId } },
      },
      include: { thread: true },
    });
    const created = group.thread!;
    for (let i = 0; i < messages; i++) {
      await createThreadMessage(prisma, {
        threadId: created.id,
        role: i % 2 === 0 ? "bot" : "user",
        blocks: [{ kind: "text", text: `m${i}` }],
      });
    }
    return created.id;
  }

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [alice, bob].map((a) => ({
        id: a.userId,
        name: a.userId,
        email: `${a.userId}@x.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Read Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB].map((id) => ({ id, organizationId, name: id })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [alice.userId, bob.userId] } } });
    await close();
  });

  it("starts before every message, is unread once a bot message arrives, and reaches the snapshot", async () => {
    const id = await thread(alice);
    expect(await read(id)).toEqual({ lastReadSeq: -1, unread: true });
    const group = {
      kind: "group",
      groupId: "g",
      threadId: id,
      groupName: "Read",
      members: [],
      memberBotIds: [],
    } as ThreadTarget;
    expect((await threadSnapshotForReader({ prisma }, alice, group)).lastReadSeq).toBe(-1);
    await setThreadUnreadState(prisma, alice, group, false, 2);
    expect((await threadSnapshotForReader({ prisma }, alice, group)).lastReadSeq).toBe(2);
    // Another user gets no boundary of their own, and so never sees Alice's.
    expect((await threadSnapshotForReader({ prisma }, bob, group)).lastReadSeq).toBeUndefined();
  });

  it("moves forward only and clears unread at the newest message", async () => {
    const id = await thread(alice);
    await setThreadUnreadState(prisma, alice, target(id), false, 2);
    expect(await read(id)).toEqual({ lastReadSeq: 2, unread: true });
    await setThreadUnreadState(prisma, alice, target(id), false, 1);
    expect(await read(id)).toEqual({ lastReadSeq: 2, unread: true });
    await setThreadUnreadState(prisma, alice, target(id), false, 99);
    expect(await read(id)).toEqual({ lastReadSeq: 4, unread: false });
    await setThreadUnreadState(prisma, alice, target(id), false, 0);
    expect(await read(id)).toEqual({ lastReadSeq: 4, unread: false });
  });

  it("reads to the end when upTo is omitted", async () => {
    const id = await thread(alice);
    await setThreadUnreadState(prisma, alice, target(id), false);
    expect(await read(id)).toEqual({ lastReadSeq: 4, unread: false });
  });

  it("leaves another user's or space's thread untouched", async () => {
    const id = await thread(alice);
    await setThreadUnreadState(prisma, bob, target(id), false);
    await setThreadUnreadState(prisma, aliceElsewhere, target(id), false, 4);
    await setThreadUnreadState(prisma, bob, target(id), true);
    expect(await read(id)).toEqual({ lastReadSeq: -1, unread: true });
    const bobs = await thread(bob);
    await setThreadUnreadState(prisma, alice, target(bobs), false);
    expect(await read(bobs)).toEqual({ lastReadSeq: -1, unread: true });
  });

  it("markUnread puts the newest other-party message back after the boundary", async () => {
    const id = await thread(alice);
    await setThreadUnreadState(prisma, alice, target(id), false);
    await setThreadUnreadState(prisma, alice, target(id), true);
    expect(await read(id)).toEqual({ lastReadSeq: 3, unread: true });
    // Already further back: markUnread keeps the earlier boundary.
    await prisma.thread.update({ where: { id }, data: { lastReadSeq: 0 } });
    await setThreadUnreadState(prisma, alice, target(id), true);
    expect(await read(id)).toEqual({ lastReadSeq: 0, unread: true });
    await setThreadUnreadState(prisma, alice, target(id), false, 4);
    expect(await read(id)).toEqual({ lastReadSeq: 4, unread: false });
  });

  it("the migration backfills read threads to their newest message and unread ones before it", async () => {
    const readId = await thread(alice);
    const unreadId = await thread(alice);
    const emptyId = await thread(alice, 0);
    await prisma.thread.update({ where: { id: readId }, data: { unread: false } });
    await prisma.thread.updateMany({
      where: { id: { in: [readId, unreadId, emptyId] } },
      data: { lastReadSeq: -1 },
    });
    const sql = readFileSync(
      new URL(
        "../../../packages/db/prisma/migrations/20261104000000_thread_last_read_seq/migration.sql",
        import.meta.url,
      ),
      "utf8",
    )
      .split("\n")
      .filter((line) => !line.startsWith("--") && !line.startsWith("ALTER"))
      .join("\n")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of sql) await prisma.$executeRawUnsafe(statement);
    expect((await read(readId)).lastReadSeq).toBe(4);
    expect((await read(unreadId)).lastReadSeq).toBe(3);
    expect((await read(emptyId)).lastReadSeq).toBe(-1);
  });
});
