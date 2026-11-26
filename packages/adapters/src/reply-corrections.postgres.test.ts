import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dismissReply, undoReplyDismissal } from "./reply-corrections.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("reply corrections (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `rc-org-${suffix}`;
  const spaceId = `rc-space-${suffix}`;
  const userId = `rc-user-${suffix}`;
  const otherUserId = `rc-other-${suffix}`;
  let db: Awaited<ReturnType<typeof createDb>>;
  let prisma: PrismaClient;
  let connectionId = "";
  let n = 0;

  const scope = { spaceId, userId };
  const signalsWith = (dmarc: string) => ({
    listUnsubscribe: [],
    oneClick: false,
    listId: null,
    bulk: false,
    autoSubmitted: false,
    auth: { dkim: "pass", spf: "pass", dmarc },
    dkimCoversUnsubscribe: false,
    categories: {
      spam: false,
      promotions: false,
      social: false,
      updates: false,
      forums: false,
      important: false,
    },
  });
  const message = (from: string, extra: Record<string, unknown> = {}) => {
    n += 1;
    return prisma.cachedMailMessage.create({
      data: {
        spaceId,
        userId,
        connectionId,
        providerMessageId: `pm-${suffix}-${n}`,
        threadId: `t-${suffix}-${n}`,
        fromAddress: from,
        toAddresses: ["me@example.test"],
        ccAddresses: [],
        subject: "Hello",
        snippet: "Hello",
        receivedAt: new Date(Date.now() - n * 60_000),
        unread: true,
        inInbox: true,
        needsReply: true,
        signals: signalsWith("pass"),
        seenAt: new Date(),
        ...extra,
      },
    });
  };
  const stat = (address: string, extra: Record<string, unknown> = {}) =>
    prisma.mailSenderStat.create({
      data: { spaceId, userId, connectionId, senderAddress: address, messageCount: 1, ...extra },
    });
  const countOf = async (address: string) =>
    (
      await prisma.mailSenderStat.findFirstOrThrow({
        where: { connectionId, senderAddress: address },
      })
    ).noReplyCount;

  beforeAll(async () => {
    db = createDb(databaseUrl as string);
    prisma = db.prisma;
    await prisma.organization.create({
      data: { id: organizationId, name: "RC Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
    for (const id of [userId, otherUserId]) {
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    }
    connectionId = (
      await prisma.connection.create({
        data: {
          spaceId,
          userId,
          provider: "gmail",
          displayName: "Mailbox",
          status: "connected",
          providerRef: userId,
          metadata: {},
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await prisma.$disconnect();
    await db.pool.end();
  });

  it("counts a message once, clears its Needs reply and says nothing below three", async () => {
    await stat("a@store.test");
    const row = await message("a@store.test");

    expect(await dismissReply(prisma, scope, row.id)).toEqual({
      stopped: null,
      dismissed: true,
    });
    expect(await dismissReply(prisma, scope, row.id)).toEqual({
      stopped: null,
      dismissed: false,
    });

    expect(await countOf("a@store.test")).toBe(1);
    expect(
      await prisma.cachedMailMessage.findUniqueOrThrow({ where: { id: row.id } }),
    ).toMatchObject({
      needsReply: false,
    });
    expect(
      (await prisma.cachedMailMessage.findUniqueOrThrow({ where: { id: row.id } }))
        .replyDismissedAt,
    ).not.toBeNull();
  });

  it("reports the sender on the third correction, and Undo sets the count back to 2", async () => {
    await stat("b@store.test");
    const rows = [
      await message("b@store.test"),
      await message("b@store.test"),
      await message("b@store.test"),
    ];
    expect(await dismissReply(prisma, scope, (rows[0] as { id: string }).id)).toEqual({
      stopped: null,
      dismissed: true,
    });
    expect(await dismissReply(prisma, scope, (rows[1] as { id: string }).id)).toEqual({
      stopped: null,
      dismissed: true,
    });
    expect(await dismissReply(prisma, scope, (rows[2] as { id: string }).id)).toEqual({
      stopped: "b@store.test",
      dismissed: true,
    });
    expect(await countOf("b@store.test")).toBe(3);

    await undoReplyDismissal(prisma, scope, (rows[2] as { id: string }).id);
    expect(await countOf("b@store.test")).toBe(2);
    // The undone dismissal puts the message back in Needs reply.
    expect(
      await prisma.cachedMailMessage.findUniqueOrThrow({
        where: { id: (rows[2] as { id: string }).id },
      }),
    ).toMatchObject({ needsReply: true, replyDismissedAt: null });
    // The other two stay dismissed.
    for (const row of rows.slice(0, 2))
      expect(
        (
          await prisma.cachedMailMessage.findUniqueOrThrow({
            where: { id: (row as { id: string }).id },
          })
        ).needsReply,
      ).toBe(false);
    // A second Undo does not go lower.
    await undoReplyDismissal(prisma, scope, (rows[2] as { id: string }).id);
    expect(await countOf("b@store.test")).toBe(2);
  });

  it("Undo restores the mail and takes back only what the dismissal counted", async () => {
    await stat("u@store.test");
    const row = await message("u@store.test");
    expect(await dismissReply(prisma, scope, row.id)).toEqual({
      stopped: null,
      dismissed: true,
    });
    expect(await countOf("u@store.test")).toBe(1);

    await undoReplyDismissal(prisma, scope, row.id);
    expect(await countOf("u@store.test")).toBe(0);
    expect(await prisma.cachedMailMessage.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject(
      { needsReply: true, replyDismissedAt: null },
    );
  });

  it("Undo of an unauthenticated dismissal restores the mail but keeps the count", async () => {
    await stat("v@store.test", { noReplyCount: 2 });
    const row = await message("v@store.test", { signals: signalsWith("fail") });
    expect(await dismissReply(prisma, scope, row.id)).toEqual({
      stopped: null,
      dismissed: true,
    });
    expect(await countOf("v@store.test")).toBe(2);

    await undoReplyDismissal(prisma, scope, row.id);
    expect(await countOf("v@store.test")).toBe(2);
    expect(await prisma.cachedMailMessage.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject(
      { needsReply: true, replyDismissedAt: null },
    );
  });

  it("Undo cannot reach another user's message", async () => {
    await stat("w@store.test");
    const row = await message("w@store.test");
    await dismissReply(prisma, scope, row.id);
    expect(await countOf("w@store.test")).toBe(1);

    await undoReplyDismissal(prisma, { spaceId, userId: otherUserId }, row.id);
    expect(await countOf("w@store.test")).toBe(1);
    expect(
      (
        await prisma.cachedMailMessage.findUniqueOrThrow({ where: { id: row.id } })
      ).replyDismissedAt,
    ).not.toBeNull();
  });

  it("does not count mail that needs no reply, was answered, or is the user's own", async () => {
    await stat("c@store.test");
    const quiet = await message("c@store.test", { needsReply: false });
    const answered = await message("c@store.test", { alreadyHandled: true });
    const later = await message("c@store.test");
    await message("me@example.test", {
      fromSelf: true,
      receivedAt: new Date(Date.now() + 60_000),
      threadId: later.threadId,
    });

    for (const row of [quiet, answered, later]) await dismissReply(prisma, scope, row.id);

    expect(await countOf("c@store.test")).toBe(0);
  });

  it("clears a message whose sender did not authenticate but does not count it against the sender", async () => {
    await stat("f@store.test", { noReplyCount: 2 });
    const forged = [
      await message("f@store.test", { signals: signalsWith("fail") }),
      await message("f@store.test", { signals: null }),
      await message("f@store.test", { signals: signalsWith("none") }),
    ];

    for (const row of forged)
      expect(await dismissReply(prisma, scope, row.id)).toEqual({
        stopped: null,
        dismissed: true,
      });

    expect(await countOf("f@store.test")).toBe(2);
    for (const row of forged) {
      const saved = await prisma.cachedMailMessage.findUniqueOrThrow({ where: { id: row.id } });
      expect(saved.needsReply).toBe(false);
      expect(saved.replyDismissedAt).not.toBeNull();
    }
  });

  it("does not report a stop for a protected sender", async () => {
    await stat("d@fund.test", { noReplyCount: 2 });
    await prisma.contact.create({ data: { spaceId, userId, name: "Dee", email: "d@fund.test" } });
    const row = await message("D@Fund.test");

    expect(await dismissReply(prisma, scope, row.id)).toEqual({
      stopped: null,
      dismissed: true,
    });
    expect(await countOf("d@fund.test")).toBe(3);
  });

  it("cannot reach another user's message", async () => {
    await stat("e@store.test");
    const row = await message("e@store.test");
    expect(await dismissReply(prisma, { spaceId, userId: otherUserId }, row.id)).toEqual({
      stopped: null,
      dismissed: false,
    });
    expect(await countOf("e@store.test")).toBe(0);
    expect(
      (await prisma.cachedMailMessage.findUniqueOrThrow({ where: { id: row.id } }))
        .replyDismissedAt,
    ).toBeNull();
  });
});
