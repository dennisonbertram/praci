import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { protectedSenders, threadHasProtectedSender } from "./mail-protected-senders.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

describePostgres("protected senders (PostgreSQL)", () => {
  let db: ReturnType<typeof createDb>;
  let prisma: PrismaClient;
  const ids: string[] = [];

  beforeAll(() => {
    db = createDb(process.env.DATABASE_URL!);
    prisma = db.prisma;
  });
  afterAll(async () => {
    if (!db) return;
    await prisma.space.deleteMany({ where: { id: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    await db.pool.end();
  });

  async function tenant() {
    const id = randomUUID();
    ids.push(id);
    await prisma.user.create({
      data: { id, name: "T", email: `${id}@example.test`, emailVerified: true },
    });
    await prisma.organization.create({
      data: { id, name: "T", slug: id, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id, organizationId: id, name: "T", isDefault: true } });
    const connection = await prisma.connection.create({
      data: {
        spaceId: id,
        userId: id,
        provider: "gmail",
        displayName: "Mailbox",
        status: "connected",
        providerRef: id,
        metadata: {},
      },
    });
    return { scope: { spaceId: id, userId: id }, connectionId: connection.id };
  }

  const mark = (t: { scope: { spaceId: string; userId: string } }, address: string) =>
    prisma.inboxSenderFeedback.create({
      data: { ...t.scope, senderAddress: address, mark: "important" },
    });
  const contact = (t: { scope: { spaceId: string; userId: string } }, email: string) =>
    prisma.contact.create({ data: { ...t.scope, name: "C", email, kind: "other" } });
  let n = 0;
  const msg = (
    t: { scope: { spaceId: string; userId: string }; connectionId: string },
    from: string,
    extra: { threadId?: string; fromSelf?: boolean; minutesAgo?: number; pid?: string } = {},
  ) =>
    prisma.cachedMailMessage.create({
      data: {
        ...t.scope,
        connectionId: t.connectionId,
        providerMessageId: extra.pid ?? `pm-${randomUUID()}-${++n}`,
        threadId: extra.threadId ?? "thread-1",
        fromAddress: from,
        toAddresses: ["me@example.test"],
        ccAddresses: [],
        subject: "S",
        snippet: "s",
        receivedAt: new Date(Date.now() - (extra.minutesAgo ?? 0) * 60_000),
        unread: false,
        inInbox: true,
        fromSelf: extra.fromSelf ?? false,
        seenAt: new Date(),
      },
    });

  it("protects important marks and Contacts, matching case-insensitively", async () => {
    const t = await tenant();
    await mark(t, "vip@example.test");
    await contact(t, "Investor@Example.test");
    const set = await protectedSenders(prisma, t.scope, [
      "VIP@example.test",
      "investor@example.test",
      "stranger@example.test",
    ]);
    expect([...set].sort()).toEqual(["investor@example.test", "vip@example.test"]);
  });

  it("lets an exact-address choice win over Contacts but not over an important mark", async () => {
    const t = await tenant();
    await mark(t, "vip@example.test");
    await contact(t, "vip@example.test");
    await contact(t, "friend@example.test");
    const set = await protectedSenders(
      prisma,
      t.scope,
      ["vip@example.test", "friend@example.test"],
      { exactAddresses: new Set(["vip@example.test", "friend@example.test"]) },
    );
    expect([...set]).toEqual(["vip@example.test"]);
  });

  it("does not use another user's marks or Contacts", async () => {
    const a = await tenant();
    const b = await tenant();
    await contact(a, "friend@example.test");
    await mark(a, "vip@example.test");
    expect(
      (await protectedSenders(prisma, b.scope, ["friend@example.test", "vip@example.test"])).size,
    ).toBe(0);
  });

  it("protects a thread when an earlier message is from a Contact, not only the newest", async () => {
    const t = await tenant();
    await contact(t, "friend@example.test");
    await msg(t, "friend@example.test", { minutesAgo: 60, pid: "early" });
    await msg(t, "list@example.test", { minutesAgo: 1, pid: "newest" });
    expect(await threadHasProtectedSender(prisma, t.scope, "newest")).toBe(true);
    expect(await threadHasProtectedSender(prisma, t.scope, "early")).toBe(true);
  });

  it("ignores the user's own messages and unprotected threads", async () => {
    const t = await tenant();
    await contact(t, "me@example.test");
    await msg(t, "me@example.test", { fromSelf: true, pid: "mine" });
    await msg(t, "list@example.test", { pid: "theirs" });
    expect(await threadHasProtectedSender(prisma, t.scope, "theirs")).toBe(false);
  });

  it("treats a message that is not cached as protected, since the thread is unknown", async () => {
    const t = await tenant();
    expect(await threadHasProtectedSender(prisma, t.scope, "unknown-id", t.connectionId)).toBe(
      true,
    );
  });

  it("checks only the given account's copy of a thread", async () => {
    const t = await tenant();
    const other = await prisma.connection.create({
      data: {
        ...t.scope,
        provider: "gmail",
        displayName: "Other",
        status: "connected",
        providerRef: randomUUID(),
        metadata: {},
      },
    });
    await contact(t, "friend@example.test");
    await msg(t, "friend@example.test", { pid: "a1" });
    await msg({ ...t, connectionId: other.id }, "list@example.test", { pid: "b1" });
    expect(await threadHasProtectedSender(prisma, t.scope, "a1", t.connectionId)).toBe(true);
    expect(await threadHasProtectedSender(prisma, t.scope, "b1", other.id)).toBe(false);
    expect(await threadHasProtectedSender(prisma, t.scope, "a1", other.id)).toBe(true);
  });
});
