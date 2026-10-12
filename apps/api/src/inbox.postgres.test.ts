import { createRouterClient } from "@orpc/server";
import type {
  AdapterContext,
  ConnectorProxyRequest,
  JobPublisher,
  MailProvider,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { inboxTriageJob } from "@rakazo/adapter-kit";
import { aiRecipient, createMailProvider, GmailApiEmulator } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION, inboxAgentSpawnKey } from "@rakazo/contracts";
import { groupInbox, TRIAGE_VERSION } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  inboxAttachment,
  inboxFeedbackSet,
  inboxGet,
  inboxList,
  inboxRefresh,
  inboxTodoSetDone,
  inboxTodosList,
  inboxUnreadCount,
} from "./inbox.js";
import { createRouter, type RouterDeps } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

describePostgres("inbox procedures (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `inbox-${name}-${suffix}`;
  const orgA = id("org-a");
  const orgB = id("org-b");
  const spaceA = id("space-a");
  const spaceB = id("space-b");
  const userA = id("user-a");
  const userB = id("user-b");
  const userC = id("user-c");
  const actor = (userId: string, spaceId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const a = actor(userA, spaceA);
  const b = actor(userB, spaceA);
  const c = actor(userC, spaceB);

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let gmail: GmailApiEmulator;
  let mail: MailProvider;
  let deps: {
    prisma: PrismaClient;
    mail: MailProvider;
    jobs: JobPublisher;
    resolveModel?: (scope: { userId: string; spaceId: string; botId?: string }) => Promise<never>;
  };

  let connA: string;
  let connB: string;
  let connC: string;
  let revokedA: string;

  const connector = {
    proxy: async (request: ConnectorProxyRequest, _context: AdapterContext) =>
      gmail.handle(request.accountRef, request.url),
    revoke: async () => {},
  } as unknown as ManagedConnectorProvider;

  const connect = async (who: Actor, ref: string, status = "connected") =>
    (
      await prisma.connection.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          connectorId: "emulator",
          provider: "gmail",
          displayName: `Mailbox ${ref}`,
          status,
          providerRef: ref,
          metadata: { mailAddress: `${ref}@example.test` },
        },
      })
    ).id;

  const cache = (
    who: Actor,
    connectionId: string,
    providerMessageId: string,
    extra: Partial<{
      threadId: string;
      receivedAt: Date;
      unread: boolean;
      inInbox: boolean;
      fromSelf: boolean;
      fromName: string | null;
      needsReply: boolean | null;
      priority: string | null;
      category: string | null;
      fromAddress: string;
      reason: string | null;
      alreadyHandled: boolean;
      triagedAt: Date | null;
      triageVersion: number | null;
    }> = {},
  ) =>
    prisma.cachedMailMessage.create({
      data: {
        spaceId: who.spaceId,
        userId: who.userId,
        connectionId,
        providerMessageId,
        threadId: extra.threadId ?? providerMessageId,
        fromName: extra.fromName === undefined ? "Ann Sender" : extra.fromName,
        fromAddress: extra.fromAddress ?? "ann@example.test",
        subject: `Subject ${providerMessageId}`,
        snippet: `Snippet ${providerMessageId}`,
        receivedAt: extra.receivedAt ?? daysAgo(1),
        unread: extra.unread ?? false,
        inInbox: extra.inInbox ?? true,
        fromSelf: extra.fromSelf ?? false,
        needsReply: extra.needsReply ?? null,
        priority: extra.priority ?? null,
        category: extra.category ?? null,
        reason: extra.reason ?? null,
        alreadyHandled: extra.alreadyHandled ?? false,
        triagedAt: extra.triagedAt ?? null,
        triageVersion: extra.triageVersion ?? null,
        seenAt: new Date(),
      },
    });

  const wipe = async () => {
    await prisma.cachedMailMessage.deleteMany({
      where: { spaceId: { in: [spaceA, spaceB] } },
    });
    await prisma.inboxTodo.deleteMany({ where: { spaceId: { in: [spaceA, spaceB] } } });
    await prisma.inboxSenderFeedback.deleteMany({ where: { spaceId: { in: [spaceA, spaceB] } } });
    await prisma.mailSyncState.deleteMany({
      where: { connection: { spaceId: { in: [spaceA, spaceB] } } },
    });
    await prisma.bot.deleteMany({ where: { spaceId: { in: [spaceA, spaceB] } } });
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const userId of [userA, userB, userC]) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    }
    for (const [organizationId, spaceId] of [
      [orgA, spaceA],
      [orgB, spaceB],
    ] as const) {
      await prisma.organization.create({
        data: {
          id: organizationId,
          name: organizationId,
          slug: organizationId,
          createdAt: new Date(),
        },
      });
      await prisma.space.create({
        data: { id: spaceId, organizationId, name: "General", isDefault: true },
      });
    }
    // AI-data consent rows belong to a space member; joining the organization adds the user to
    // its default space.
    for (const [organizationId, userId] of [
      [orgA, userA],
      [orgA, userB],
      [orgB, userC],
    ] as const) {
      await prisma.member.create({
        data: {
          id: `${userId}-member`,
          organizationId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    connA = await connect(a, "box-a");
    connB = await connect(b, "box-b");
    connC = await connect(c, "box-c");
    revokedA = await connect(a, "box-revoked", "revoked");
    mail = createMailProvider({
      prisma,
      connectors: { managed: () => connector },
      sleep: async () => {},
    });
    deps = { prisma, mail, jobs: { enqueue: async () => {} } as unknown as JobPublisher };
  });

  afterAll(async () => {
    if (!prisma) return;
    await wipe();
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB, userC] } } });
    await close();
  });

  const seedMailboxes = () => {
    const message = (messageId: string, labels: string[]) => ({
      id: messageId,
      date: daysAgo(1).toISOString(),
      labels,
      from: "Ann Sender <ann@example.test>",
      to: "me@example.test",
      subject: `Subject ${messageId}`,
      snippet: `Snippet ${messageId}`,
      html: `<p>Body of ${messageId}</p>`,
      attachments: [
        { filename: `${messageId}.txt`, mimeType: "text/plain", size: 0, data: "aGVsbG8=" },
      ],
    });
    gmail = new GmailApiEmulator({
      mailboxes: {
        "box-a": { address: "box-a@example.test", messages: [message("a-1", ["INBOX", "UNREAD"])] },
        "box-b": { address: "box-b@example.test", messages: [message("b-1", ["INBOX"])] },
        "box-c": { address: "box-c@example.test", messages: [message("c-1", ["INBOX"])] },
        "box-revoked": {
          address: "box-revoked@example.test",
          messages: [message("r-1", ["INBOX"])],
        },
      },
    });
  };

  describe("list", () => {
    it("returns the caller's newest message per thread and nothing hidden", async () => {
      await wipe();
      await cache(a, connA, "old", { threadId: "t1", receivedAt: daysAgo(3) });
      await cache(a, connA, "new", { threadId: "t1", receivedAt: daysAgo(1), unread: true });
      await cache(a, connA, "other", { threadId: "t2", receivedAt: daysAgo(2), fromName: null });
      await cache(a, connA, "sent-only", { inInbox: false, fromSelf: true });
      await cache(a, connA, "search-cached", { inInbox: false });
      await cache(a, connA, "too-old", { receivedAt: daysAgo(20) });
      await cache(a, revokedA, "from-revoked");
      await cache(b, connB, "b-row"); // same space, another user
      await cache(c, connC, "c-row"); // another space

      const out = await inboxList(deps, a, {});

      expect(out.rows.map((row) => row.subject)).toEqual(["Subject new", "Subject other"]);
      expect(out.rows[0]).toMatchObject({
        connectionId: connA,
        threadId: "t1",
        from: "Ann Sender",
        snippet: "Snippet new",
        unread: true,
        needsReply: null,
      });
      expect(out.rows[1]?.from).toBe("ann@example.test");
      expect(out.accounts).toEqual([{ connectionId: connA, label: "Mailbox box-a" }]);
      expect(out.syncedAt).toBeNull();
      expect(out.failedAccounts).toEqual([]);
    });

    it("keeps the same thread id on two accounts as separate rows", async () => {
      await wipe();
      const second = await connect(a, "box-a2");
      await cache(a, connA, "x1", { threadId: "shared" });
      await cache(a, second, "x2", { threadId: "shared" });

      const out = await inboxList(deps, a, {});
      expect(out.rows).toHaveLength(2);
      expect((await inboxList(deps, a, { connectionId: second })).rows).toHaveLength(1);
      await prisma.connection.delete({ where: { id: second } });
    });

    it("reports sync time and failed accounts from the sync state", async () => {
      await wipe();
      await prisma.mailSyncState.create({
        data: { connectionId: connA, lastSyncedAt: new Date("2026-10-01T10:00:00Z") },
      });
      const second = await connect(a, "box-a3");
      await prisma.mailSyncState.create({
        data: {
          connectionId: second,
          lastSyncedAt: new Date("2026-10-02T10:00:00Z"),
          lastErrorAt: new Date(),
        },
      });

      const out = await inboxList(deps, a, {});
      expect(out.syncedAt).toBe("2026-10-02T10:00:00.000Z");
      expect(out.failedAccounts).toEqual([second]);
      await prisma.connection.delete({ where: { id: second } });
    });

    it("answers with an empty account list when no mail account is connected", async () => {
      const out = await inboxList(deps, actor(userA, spaceB), {});
      expect(out).toMatchObject({ accounts: [], rows: [], agent: null, syncedAt: null });
    });

    it.each([
      ["another user's", () => connB],
      ["another space's", () => connC],
      ["a revoked", () => revokedA],
      ["a nonexistent", () => "no-such-connection"],
    ])("rejects %s connection id with NOT_FOUND", async (_name, target) => {
      await expect(inboxList(deps, a, { connectionId: target() })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  describe("list with a filter or a search", () => {
    const mailbox = (
      address: string,
      messages: Array<{ id: string; days: number; labels: string[]; subject?: string }>,
    ) => ({
      address,
      messages: messages.map((m) => ({
        id: m.id,
        date: daysAgo(m.days).toISOString(),
        labels: m.labels,
        from: "Ann Sender <ann@example.test>",
        to: "me@example.test",
        subject: m.subject ?? `Subject ${m.id}`,
        snippet: `Snippet ${m.id}`,
        html: `<p>Body of ${m.id}</p>`,
      })),
    });
    const requestedBoxes = () => [...new Set(gmail.requests.map((r) => r.accountRef))].sort();

    it("asks Gmail for the whole mailbox, newest first, past the 14-day cache window", async () => {
      await wipe();
      gmail = new GmailApiEmulator({
        mailboxes: {
          "box-a": mailbox("box-a@example.test", [
            { id: "a-old", days: 60, labels: ["INBOX", "UNREAD"] },
            { id: "a-new", days: 1, labels: ["INBOX", "UNREAD"] },
            { id: "a-read", days: 2, labels: ["INBOX"] },
            { id: "a-star", days: 90, labels: ["STARRED"] },
          ]),
          "box-b": mailbox("box-b@example.test", [
            { id: "b-1", days: 1, labels: ["INBOX", "UNREAD"] },
          ]),
        },
      });

      const unread = await inboxList(deps, a, { filter: "unread" });
      expect(unread.rows.map((r) => r.subject)).toEqual(["Subject a-new", "Subject a-old"]);
      expect(unread.rows.every((r) => r.unread)).toBe(true);
      expect(unread.nextPageToken).toBeUndefined();
      expect(unread.failedAccounts).toEqual([]);
      expect(unread.accounts).toEqual([{ connectionId: connA, label: "Mailbox box-a" }]);
      expect(requestedBoxes()).toEqual(["box-a"]);

      const starred = await inboxList(deps, a, { filter: "starred" });
      expect(starred.rows.map((r) => r.subject)).toEqual(["Subject a-star"]);
      // A row returned for a message outside the cache window can be opened.
      const body = await inboxGet(deps, a, { messageId: (starred.rows[0] as { id: string }).id });
      expect(body.html).toBe("<p>Body of a-star</p>");
    });

    it("combines the filter with the search text and searches without a filter", async () => {
      await wipe();
      gmail = new GmailApiEmulator({
        mailboxes: {
          "box-a": mailbox("box-a@example.test", [
            { id: "a-1", days: 1, labels: ["INBOX", "UNREAD"], subject: "Budget" },
            { id: "a-2", days: 2, labels: ["INBOX"], subject: "Budget review" },
            { id: "a-3", days: 3, labels: ["INBOX", "UNREAD"], subject: "Lunch" },
          ]),
          "box-b": mailbox("box-b@example.test", []),
        },
      });
      const subjects = async (input: object) =>
        (await inboxList(deps, a, input)).rows.map((r) => r.subject);

      expect(await subjects({ query: "budget" })).toEqual(["Budget", "Budget review"]);
      expect(await subjects({ filter: "unread", query: "budget" })).toEqual(["Budget"]);
      // The search text is grouped, so an OR inside it cannot escape the filter.
      expect(await subjects({ filter: "unread", query: "budget OR lunch" })).toEqual([
        "Budget",
        "Lunch",
      ]);
    });

    it("pages with a continuation token until the mailbox is exhausted", async () => {
      await wipe();
      gmail = new GmailApiEmulator({
        mailboxes: {
          "box-a": mailbox(
            "box-a@example.test",
            Array.from({ length: 120 }, (_, i) => ({
              id: `a-${String(i).padStart(3, "0")}`,
              days: 1 + i * 0.01,
              labels: ["INBOX", "UNREAD"],
            })),
          ),
          "box-b": mailbox("box-b@example.test", []),
        },
      });
      const first = await inboxList(deps, a, { filter: "unread" });
      expect(first.rows).toHaveLength(50);
      expect(first.nextPageToken).toEqual(expect.any(String));
      const second = await inboxList(deps, a, {
        filter: "unread",
        pageToken: first.nextPageToken,
      });
      expect(second.rows).toHaveLength(50);
      const third = await inboxList(deps, a, { filter: "unread", pageToken: second.nextPageToken });
      expect(third.rows).toHaveLength(20);
      expect(third.nextPageToken).toBeUndefined();
      const all = [...first.rows, ...second.rows, ...third.rows];
      expect(new Set(all.map((r) => r.id)).size).toBe(120);
      expect(all.map((r) => r.receivedAt)).toEqual(
        [...all.map((r) => r.receivedAt)].sort().reverse(),
      );
    });

    it("merges every account for All and narrows to one account's mail on a tab", async () => {
      await wipe();
      const second = await connect(a, "box-a2");
      gmail = new GmailApiEmulator({
        mailboxes: {
          "box-a": mailbox("box-a@example.test", [
            { id: "a-1", days: 3, labels: ["INBOX", "UNREAD"] },
          ]),
          "box-a2": mailbox("box-a2@example.test", [
            { id: "x-1", days: 1, labels: ["INBOX", "UNREAD"] },
            { id: "x-2", days: 5, labels: ["INBOX", "UNREAD"] },
          ]),
          "box-b": mailbox("box-b@example.test", [
            { id: "b-1", days: 1, labels: ["INBOX", "UNREAD"] },
          ]),
          "box-c": mailbox("box-c@example.test", [
            { id: "c-1", days: 1, labels: ["INBOX", "UNREAD"] },
          ]),
        },
      });

      const all = await inboxList(deps, a, { filter: "unread" });
      expect(all.rows.map((r) => r.subject)).toEqual(["Subject x-1", "Subject a-1", "Subject x-2"]);
      expect(requestedBoxes()).toEqual(["box-a", "box-a2"]);

      gmail.requests.length = 0;
      const one = await inboxList(deps, a, { filter: "unread", connectionId: second });
      expect(one.rows.map((r) => r.subject)).toEqual(["Subject x-1", "Subject x-2"]);
      expect(requestedBoxes()).toEqual(["box-a2"]);
      await prisma.connection.delete({ where: { id: second } });
    });

    it("never queries another user's, another space's or a revoked account", async () => {
      await wipe();
      seedMailboxes();
      for (const connectionId of [connB, connC, revokedA, "no-such-connection"]) {
        await expect(inboxList(deps, a, { filter: "unread", connectionId })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
      expect(gmail.requests).toEqual([]);
      // Without a connection id only the caller's own connected account is read.
      const out = await inboxList(deps, a, { query: "Subject" });
      expect(out.rows.map((r) => r.subject)).toEqual(["Subject a-1"]);
      expect(requestedBoxes()).toEqual(["box-a"]);
    });

    it("reports an account Gmail refuses as failed and still returns the others", async () => {
      await wipe();
      const broken = await connect(a, "box-missing");
      gmail = new GmailApiEmulator({
        mailboxes: {
          "box-a": mailbox("box-a@example.test", [
            { id: "a-1", days: 1, labels: ["INBOX", "UNREAD"] },
          ]),
        },
      });
      const out = await inboxList(deps, a, { filter: "unread" });
      expect(out.rows.map((r) => r.subject)).toEqual(["Subject a-1"]);
      expect(out.failedAccounts).toEqual([broken]);
      await prisma.connection.delete({ where: { id: broken } });
    });

    it("ignores connections named in a forged page token that the caller does not own", async () => {
      await wipe();
      seedMailboxes();
      const forged = Buffer.from(JSON.stringify({ [connB]: "1", [connC]: "1" })).toString(
        "base64url",
      );
      const out = await inboxList(deps, a, { filter: "unread", pageToken: forged });
      expect(out.rows).toEqual([]);
      expect(gmail.requests).toEqual([]);
    });

    it("rejects a malformed page token and treats a blank search as no search", async () => {
      await wipe();
      seedMailboxes();
      await expect(
        inboxList(deps, a, { filter: "unread", pageToken: "not a token" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const out = await inboxList(deps, a, { query: "   " });
      expect(out.rows).toEqual([]);
      expect(gmail.requests).toEqual([]);
    });
  });

  describe("agent", () => {
    it("is the caller's own unarchived Inbox agent, never someone else's", async () => {
      await wipe();
      const bot = (who: Actor, extra: { archivedAt?: Date; spawnKey?: string } = {}) =>
        prisma.bot.create({
          data: {
            spaceId: who.spaceId,
            userId: who.userId,
            name: "Inbox agent",
            color: "blue",
            spawnKey: extra.spawnKey ?? inboxAgentSpawnKey(who.userId),
            archivedAt: extra.archivedAt,
          },
        });
      const mine = await bot(a);
      await bot(b, { spawnKey: inboxAgentSpawnKey(userB) });

      expect((await inboxList(deps, a, {})).agent).toEqual({
        botId: mine.id,
        name: "Inbox agent",
      });
      expect((await inboxList(deps, b, {})).agent).toMatchObject({ name: "Inbox agent" });
      expect((await inboxList(deps, b, {})).agent?.botId).not.toBe(mine.id);

      await prisma.bot.update({ where: { id: mine.id }, data: { archivedAt: new Date() } });
      expect((await inboxList(deps, a, {})).agent).toBeNull();
    });
  });

  describe("unreadCount", () => {
    it("counts unread threads, not messages, for the caller's connected accounts only", async () => {
      await wipe();
      await cache(a, connA, "u1", { threadId: "t1", unread: true });
      await cache(a, connA, "u2", { threadId: "t1", unread: true }); // same thread
      await cache(a, connA, "u3", { threadId: "t2", unread: true });
      await cache(a, connA, "read", { threadId: "t3", unread: false });
      await cache(a, connA, "sent", { threadId: "t4", unread: true, inInbox: false });
      await cache(a, revokedA, "revoked", { unread: true });
      await cache(b, connB, "b1", { unread: true });
      await cache(c, connC, "c1", { unread: true });

      expect(await inboxUnreadCount(deps, a)).toEqual({ count: 2 });
      expect(await inboxUnreadCount(deps, b)).toEqual({ count: 1 });
      expect(await inboxUnreadCount(deps, c)).toEqual({ count: 1 });
    });
  });

  describe("refresh", () => {
    it("syncs the caller's connected accounts and no one else's", async () => {
      await wipe();
      seedMailboxes();

      expect(await inboxRefresh(deps, a, {})).toEqual({ ok: true });

      const synced = await prisma.cachedMailMessage.findMany({
        where: { spaceId: { in: [spaceA, spaceB] } },
      });
      expect(synced.map((row) => row.providerMessageId)).toEqual(["a-1"]);
      expect(synced[0]).toMatchObject({ userId: userA, spaceId: spaceA, unread: true });
      expect(gmail.accountRefs().length).toBe(4);
      expect(gmail.requests.every((r) => r.accountRef === "box-a")).toBe(true);
      expect((await inboxList(deps, a, {})).syncedAt).not.toBeNull();
    });

    it("rejects someone else's, a revoked or an unknown connection id with NOT_FOUND", async () => {
      await wipe();
      seedMailboxes();
      for (const connectionId of [connB, connC, revokedA, "no-such-connection"]) {
        await expect(inboxRefresh(deps, a, { connectionId })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
      expect(gmail.requests).toEqual([]);
    });
  });

  describe("get", () => {
    it("loads the body of the caller's own message through the provider", async () => {
      await wipe();
      seedMailboxes();
      await inboxRefresh(deps, a, {});
      const row = await prisma.cachedMailMessage.findFirstOrThrow({
        where: { providerMessageId: "a-1" },
      });

      const message = await inboxGet(deps, a, { messageId: row.id });

      expect(message).toMatchObject({
        from: "Ann Sender <ann@example.test>",
        to: "me@example.test",
        subject: "Subject a-1",
        html: "<p>Body of a-1</p>",
      });
      expect(message.text).toContain("Body of a-1");
      expect(new Date(message.date).toString()).not.toBe("Invalid Date");
    });

    it("lists the message's attachments, and only the caller can download one", async () => {
      await wipe();
      seedMailboxes();
      await inboxRefresh(deps, a, {});
      await inboxRefresh(deps, b, {});
      const mine = await prisma.cachedMailMessage.findFirstOrThrow({
        where: { providerMessageId: "a-1", userId: userA },
      });
      const theirs = await prisma.cachedMailMessage.findFirstOrThrow({
        where: { providerMessageId: "b-1", userId: userB },
      });

      const opened = await inboxGet(deps, a, { messageId: mine.id });
      expect(opened.attachments).toEqual([
        { id: expect.any(String), filename: "a-1.txt", mimeType: "text/plain", size: 5 },
      ]);
      const [file] = opened.attachments;
      const attachmentId = (file as { id: string }).id;
      const bytes = await inboxAttachment(deps, a, { messageId: mine.id, attachmentId });
      expect(Buffer.from(bytes.bytes).toString()).toBe("hello");

      // Another user's message, with a part id that exists on it, and the same part id on mine.
      await expect(
        inboxAttachment(deps, a, { messageId: theirs.id, attachmentId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        inboxAttachment(deps, b, { messageId: mine.id, attachmentId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        inboxAttachment(deps, c, { messageId: mine.id, attachmentId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        inboxAttachment(deps, a, { messageId: mine.id, attachmentId: "99" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("answers NOT_FOUND for another user's, another space's, a revoked and an unknown id", async () => {
      await wipe();
      seedMailboxes();
      const theirs = await cache(b, connB, "b-1");
      const otherSpace = await cache(c, connC, "c-1");
      const revoked = await cache(a, revokedA, "r-1");

      for (const messageId of [theirs.id, otherSpace.id, revoked.id, "no-such-message"]) {
        await expect(inboxGet(deps, a, { messageId })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
      expect(gmail.requests).toEqual([]);
    });
  });

  describe("triage", () => {
    const model = { provider: "openrouter", id: "vendor/small-model" } as never;
    const triaged = { triagedAt: new Date(), triageVersion: TRIAGE_VERSION };
    const allow = (who: Actor) =>
      prisma.aiDataConsent.create({
        data: {
          userId: who.userId,
          spaceId: who.spaceId,
          recipientKey: aiRecipient({
            provider: "openrouter",
            modelId: "vendor/small-model",
            use: "model",
          })!.key,
          version: AI_DISCLOSURE_VERSION,
        },
      });
    const ready = { resolveModel: async () => model };
    const wipeConsent = () =>
      prisma.aiDataConsent.deleteMany({ where: { spaceId: { in: [spaceA, spaceB] } } });
    const todo = (
      who: Actor,
      connectionId: string,
      extra: Partial<{
        messageId: string;
        text: string;
        dueOn: Date;
        doneAt: Date;
        detail: string;
      }> = {},
    ) =>
      prisma.inboxTodo.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          connectionId,
          text: extra.text ?? "Reply to Ann",
          ...extra,
        },
      });

    it("hides every triage field and todos while no usable, allowed model exists", async () => {
      await wipe();
      await wipeConsent();
      await cache(a, connA, "t1", {
        needsReply: true,
        priority: "critical",
        reason: "Asked",
        ...triaged,
      });
      await todo(a, connA);

      const none = await inboxList(deps, a, {});
      expect(none).toMatchObject({ enabled: false, triagePending: false });
      expect(none.rows[0]).toMatchObject({ needsReply: null, priority: null, reason: null });
      expect(await inboxTodosList(deps, a, {})).toEqual({ enabled: false, todos: [] });

      // A resolvable model without the user's consent is still not enabled.
      expect((await inboxList({ ...deps, ...ready }, a, {})).enabled).toBe(false);
      await allow(a);
      const on = await inboxList({ ...deps, ...ready }, a, {});
      expect(on.enabled).toBe(true);
      expect(on.rows[0]).toMatchObject({ needsReply: true, priority: "critical", reason: "Asked" });
      // Consent is per user: another member of the space is not enabled by it.
      expect((await inboxList({ ...deps, ...ready }, b, {})).enabled).toBe(false);
      await wipeConsent();
    });

    it("counts an Inbox agent model override with no default model as enabled", async () => {
      await wipe();
      await wipeConsent();
      await allow(a);
      const agent = await prisma.bot.create({
        data: {
          spaceId: spaceA,
          userId: userA,
          name: "Inbox agent",
          color: "blue",
          spawnKey: inboxAgentSpawnKey(userA),
        },
      });
      const seen: Array<string | undefined> = [];
      const resolveModel = async (scope: { botId?: string }) => {
        seen.push(scope.botId);
        if (scope.botId !== agent.id) throw new Error("no model");
        return model;
      };

      expect((await inboxList({ ...deps, resolveModel }, a, {})).enabled).toBe(true);
      expect(seen).toEqual([agent.id]);
      await wipeConsent();
    });

    it("reports needsReply as needsReply and not alreadyHandled", async () => {
      await wipe();
      await wipeConsent();
      await allow(a);
      await cache(a, connA, "open", { threadId: "o", needsReply: true, ...triaged });
      await cache(a, connA, "answered", {
        threadId: "h",
        needsReply: true,
        alreadyHandled: true,
        ...triaged,
      });
      await cache(a, connA, "no", { threadId: "n", needsReply: false, ...triaged });

      const out = await inboxList({ ...deps, ...ready }, a, {});
      const byThread = Object.fromEntries(out.rows.map((r) => [r.threadId, r.needsReply]));
      expect(byThread).toEqual({ o: true, h: false, n: false });
      await wipeConsent();
    });

    it("is pending only while a connected account of the caller has mail triage would pick", async () => {
      await wipe();
      await wipeConsent();
      await allow(a);
      const pending = async () => (await inboxList({ ...deps, ...ready }, a, {})).triagePending;
      // Nothing here would be selected: triaged, sent, old, revoked, or someone else's.
      await cache(a, connA, "done", { ...triaged });
      await cache(a, connA, "sent", { fromSelf: true, inInbox: true });
      await cache(a, connA, "old", { receivedAt: daysAgo(20) });
      await cache(a, revokedA, "revoked");
      await cache(b, connB, "theirs");
      await cache(c, connC, "elsewhere");
      expect(await pending()).toBe(false);

      await cache(a, connA, "stale-version", { triagedAt: new Date(), triageVersion: 0 });
      expect(await pending()).toBe(true);
      await wipe();
      await cache(a, connA, "fresh");
      expect(await pending()).toBe(true);
      // Never pending while triage is disabled: the job would not run.
      expect((await inboxList(deps, a, {})).triagePending).toBe(false);
      await wipeConsent();
    });

    it("lists open to-dos and those finished in the last day, for connected accounts only", async () => {
      await wipe();
      await wipeConsent();
      await allow(a);
      const m1 = await cache(a, connA, "m1", { priority: "critical", ...triaged });
      const open = await todo(a, connA, {
        messageId: m1.id,
        text: "Sign it",
        detail: "DocuSign request",
        dueOn: new Date("2026-10-14T00:00:00Z"),
      });
      const recent = await todo(a, connA, {
        text: "Paid",
        doneAt: new Date(Date.now() - 3_600_000),
      });
      await todo(a, connA, { text: "Long ago", doneAt: new Date(Date.now() - 2 * DAY) });
      await todo(a, revokedA, { text: "Revoked account" });
      await todo(b, connB, { text: "Theirs" });
      await todo(c, connC, { text: "Elsewhere" });

      const out = await inboxTodosList({ ...deps, ...ready }, a, {});

      expect(out.enabled).toBe(true);
      expect(out.todos.map((t) => t.text).sort()).toEqual(["Paid", "Sign it"]);
      expect(out.todos.find((t) => t.id === open.id)).toMatchObject({
        connectionId: connA,
        messageId: m1.id,
        text: "Sign it",
        detail: "DocuSign request",
        dueOn: "2026-10-14",
        doneAt: null,
        priority: "critical",
        from: "Ann Sender",
      });
      expect(out.todos.find((t) => t.id === recent.id)?.doneAt).toEqual(expect.any(String));
      await wipeConsent();
    });

    it("filters by account and rejects someone else's, a revoked or an unknown account", async () => {
      await wipe();
      await wipeConsent();
      await allow(a);
      const second = await connect(a, "box-a4");
      await todo(a, connA, { text: "On A" });
      await todo(a, second, { text: "On second" });

      const only = await inboxTodosList({ ...deps, ...ready }, a, { connectionId: second });
      expect(only.todos.map((t) => t.text)).toEqual(["On second"]);
      for (const connectionId of [connB, connC, revokedA, "no-such-connection"]) {
        await expect(
          inboxTodosList({ ...deps, ...ready }, a, { connectionId }),
        ).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
      await prisma.connection.delete({ where: { id: second } });
      await wipeConsent();
    });

    it("setDone marks a to-do done and touched, and clearing it keeps it touched", async () => {
      await wipe();
      const mine = await todo(a, connA);

      const done = await inboxTodoSetDone(deps, a, { id: mine.id, done: true });
      expect(done.doneAt).toEqual(expect.any(String));
      const row = await prisma.inboxTodo.findUniqueOrThrow({ where: { id: mine.id } });
      expect(row.doneAt).not.toBeNull();
      expect(row.touchedAt).not.toBeNull();

      const reopened = await inboxTodoSetDone(deps, a, { id: mine.id, done: false });
      expect(reopened.doneAt).toBeNull();
      const again = await prisma.inboxTodo.findUniqueOrThrow({ where: { id: mine.id } });
      expect(again.doneAt).toBeNull();
      expect(again.touchedAt).not.toBeNull();
    });

    it("setDone cannot reach another user's, another space's or a revoked account's to-do", async () => {
      await wipe();
      const theirs = await todo(b, connB);
      const elsewhere = await todo(c, connC);
      const revoked = await todo(a, revokedA);

      for (const id of [theirs.id, elsewhere.id, revoked.id, "no-such-todo"]) {
        await expect(inboxTodoSetDone(deps, a, { id, done: true })).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
      }
      const rows = await prisma.inboxTodo.findMany({
        where: { id: { in: [theirs.id, elsewhere.id, revoked.id] } },
      });
      expect(rows.every((r) => r.doneAt === null && r.touchedAt === null)).toBe(true);
    });

    it("serves both to-do procedures through the router for the signed-in user only", async () => {
      await wipe();
      await wipeConsent();
      await allow(a);
      const mine = await todo(a, connA, { text: "Mine" });
      const theirs = await todo(b, connB, { text: "Theirs" });
      const client = createRouterClient(
        createRouter({ ...deps, ...ready } as unknown as RouterDeps),
        { context: { actor: a } as never },
      );

      const listed = await client.inbox.todos.list({});
      expect(listed.todos.map((t) => t.text)).toEqual(["Mine"]);
      expect((await client.inbox.todos.setDone({ id: mine.id, done: true })).doneAt).not.toBeNull();
      await expect(client.inbox.todos.setDone({ id: theirs.id, done: true })).rejects.toMatchObject(
        {
          code: "NOT_FOUND",
        },
      );
      await wipeConsent();
    });

    describe("views and relevance feedback", () => {
      const on = () => ({ ...deps, ...ready });
      const subjects = (out: { rows: Array<{ subject: string }> }) =>
        out.rows.map((r) => r.subject.replace("Subject ", ""));
      const setup = async () => {
        await wipe();
        await wipeConsent();
        await allow(a);
      };
      const mark = async (
        who: Actor,
        providerMessageId: string,
        value: "important" | "noise" | null,
      ) => {
        const message = await prisma.cachedMailMessage.findFirstOrThrow({
          where: { providerMessageId, userId: who.userId, spaceId: who.spaceId },
        });
        return inboxFeedbackSet(on(), who, { messageId: message.id, mark: value });
      };

      it("Important view lists critical, important and needs-reply mail from the cache only", async () => {
        await setup();
        await cache(a, connA, "crit", { priority: "critical", receivedAt: daysAgo(1), ...triaged });
        await cache(a, connA, "imp", { priority: "important", receivedAt: daysAgo(2), ...triaged });
        await cache(a, connA, "reply", {
          priority: "normal",
          needsReply: true,
          receivedAt: daysAgo(3),
          ...triaged,
        });
        await cache(a, connA, "answered", {
          priority: "normal",
          needsReply: true,
          alreadyHandled: true,
          ...triaged,
        });
        await cache(a, connA, "plain", { priority: "normal", needsReply: false, ...triaged });
        await cache(a, connA, "low", { priority: "low", needsReply: false, ...triaged });
        await cache(a, connA, "untriaged");
        await cache(a, revokedA, "revoked", { priority: "critical", ...triaged });
        await cache(b, connB, "theirs", { priority: "critical", ...triaged });
        await cache(c, connC, "elsewhere", { priority: "critical", ...triaged });

        const out = await inboxList(on(), a, { view: "important" });

        expect(subjects(out)).toEqual(["crit", "imp", "reply"]);
        expect(out.enabled).toBe(true);
        expect((await inboxList(on(), a, { view: "all" })).rows).toHaveLength(7);
      });

      it("asks the database, so mail past the 200 newest cached rows still shows in Important", async () => {
        await setup();
        await prisma.cachedMailMessage.createMany({
          data: Array.from({ length: 205 }, (_, i) => ({
            spaceId: spaceA,
            userId: userA,
            connectionId: connA,
            providerMessageId: `bulk-${i}`,
            threadId: `bulk-${i}`,
            fromAddress: "news@example.test",
            toAddresses: [],
            ccAddresses: [],
            subject: `Subject bulk-${i}`,
            snippet: "",
            receivedAt: daysAgo(1),
            unread: false,
            inInbox: true,
            seenAt: new Date(),
            priority: "normal",
            needsReply: false,
            ...triaged,
          })),
        });
        await cache(a, connA, "old-critical", {
          priority: "critical",
          receivedAt: daysAgo(10),
          ...triaged,
        });

        expect(subjects(await inboxList(on(), a, {}))).not.toContain("old-critical");
        expect(subjects(await inboxList(on(), a, { view: "important" }))).toEqual(["old-critical"]);
      });

      it("combines the Important view and a category with an account tab", async () => {
        await setup();
        const second = await connect(a, "box-a-views");
        await cache(a, connA, "a-imp", { priority: "important", category: "billing", ...triaged });
        await cache(a, second, "s-imp", { priority: "critical", category: "billing", ...triaged });
        await cache(a, second, "s-bill", { priority: "low", category: "billing", ...triaged });

        expect(
          subjects(await inboxList(on(), a, { view: "important", connectionId: second })),
        ).toEqual(["s-imp"]);
        expect(
          subjects(await inboxList(on(), a, { category: "billing", connectionId: connA })),
        ).toEqual(["a-imp"]);
        expect(
          (await inboxList(on(), a, { category: "billing" })).rows
            .map((r) => r.connectionId)
            .sort(),
        ).toEqual([connA, second, second].sort());
        await prisma.cachedMailMessage.deleteMany({ where: { connectionId: second } });
        await prisma.connection.delete({ where: { id: second } });
      });

      it("a category view lists that category's mail from the cache, and rows carry their category", async () => {
        await setup();
        await cache(a, connA, "bill", { category: "billing", receivedAt: daysAgo(1), ...triaged });
        await cache(a, connA, "paid", { category: "receipt", receivedAt: daysAgo(2), ...triaged });
        await cache(a, connA, "nl", { category: "newsletter", receivedAt: daysAgo(3), ...triaged });
        await cache(a, connA, "untriaged", { receivedAt: daysAgo(4) });
        await cache(b, connB, "their-bill", { category: "billing", ...triaged });

        const out = await inboxList(on(), a, { category: "billing" });

        expect(subjects(out)).toEqual(["bill"]);
        expect(out.rows[0]?.category).toBe("billing");
        expect(subjects(await inboxList(on(), a, { category: "receipt" }))).toEqual(["paid"]);
        expect(subjects(await inboxList(on(), a, { category: "security" }))).toEqual([]);
        expect((await inboxList(on(), a, {})).rows.map((r) => r.category)).toEqual([
          "billing",
          "receipt",
          "newsletter",
          null,
        ]);
      });

      it("ignores the view and category while triage is not enabled, and hides category and marks", async () => {
        await setup();
        await wipeConsent();
        await cache(a, connA, "bill", { category: "billing", priority: "low", ...triaged });
        await cache(a, connA, "other", { category: "fyi", priority: "low", ...triaged });
        await prisma.inboxSenderFeedback.create({
          data: {
            spaceId: spaceA,
            userId: userA,
            senderAddress: "ann@example.test",
            mark: "noise",
          },
        });

        for (const input of [{ view: "important" as const }, { category: "billing" as const }]) {
          const out = await inboxList(deps, a, input);
          expect(out.enabled).toBe(false);
          expect(subjects(out).sort()).toEqual(["bill", "other"]);
          expect(out.rows.every((r) => r.category === null && r.feedback === null)).toBe(true);
        }
      });

      it("rejects a view or category combined with a Gmail filter or search, before asking Gmail", async () => {
        await setup();
        const before = gmail?.requests.length ?? 0;
        for (const input of [
          { view: "important" as const, filter: "unread" as const },
          { view: "important" as const, query: "from:ann" },
          { category: "billing" as const, filter: "starred" as const },
          { category: "billing" as const, query: "invoice" },
        ]) {
          await expect(inboxList(on(), a, input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
        }
        expect(gmail?.requests.length ?? 0).toBe(before);
      });

      it("marking a sender important counts their mail as Important and ranks it up in Needs reply", async () => {
        await setup();
        await cache(a, connA, "vip-1", {
          fromAddress: "Vip@Example.test",
          priority: "low",
          needsReply: false,
          receivedAt: daysAgo(4),
          ...triaged,
        });
        await cache(a, connA, "vip-2", {
          fromAddress: "vip@example.test",
          priority: "normal",
          needsReply: true,
          receivedAt: daysAgo(5),
          ...triaged,
        });
        await cache(a, connA, "peer", {
          fromAddress: "peer@example.test",
          priority: "normal",
          needsReply: true,
          receivedAt: daysAgo(1),
          ...triaged,
        });
        expect(subjects(await inboxList(on(), a, { view: "important" }))).toEqual([
          "peer",
          "vip-2",
        ]);

        expect(await mark(a, "vip-1", "important")).toEqual({ mark: "important" });

        const important = await inboxList(on(), a, { view: "important" });
        // Both casings of the address match; the unmarked peer is unchanged.
        expect(subjects(important)).toEqual(["peer", "vip-1", "vip-2"]);
        const all = await inboxList(on(), a, {});
        const byId = (id: string) => all.rows.find((r) => r.subject === `Subject ${id}`);
        expect(byId("vip-1")).toMatchObject({ feedback: "important", priority: "important" });
        expect(byId("vip-2")).toMatchObject({ feedback: "important", priority: "important" });
        expect(byId("peer")).toMatchObject({ feedback: null, priority: "normal" });
        // Newer peer mail used to lead Needs reply; the important sender's mail now comes first.
        expect(groupInbox(all.rows, new Date()).needsReply.map((r) => r.subject)).toEqual([
          "Subject vip-2",
          "Subject peer",
        ]);
      });

      it("marking a sender noise drops their mail from Needs reply and Important but keeps it listed", async () => {
        await setup();
        await cache(a, connA, "spam-1", {
          fromAddress: "loud@example.test",
          priority: "critical",
          needsReply: true,
          category: "billing",
          receivedAt: daysAgo(1),
          ...triaged,
        });
        await cache(a, connA, "real", {
          fromAddress: "real@example.test",
          priority: "important",
          ...triaged,
        });
        await mark(a, "spam-1", "noise");

        const all = await inboxList(on(), a, {});
        const noisy = all.rows.find((r) => r.subject === "Subject spam-1");
        expect(noisy).toMatchObject({ feedback: "noise", needsReply: false, priority: "low" });
        expect(groupInbox(all.rows, new Date()).needsReply).toEqual([]);
        expect(subjects(await inboxList(on(), a, { view: "important" }))).toEqual(["real"]);
        // Nothing is deleted, and a category view still shows it.
        expect(subjects(await inboxList(on(), a, { category: "billing" }))).toEqual(["spam-1"]);
        expect(
          await prisma.cachedMailMessage.count({ where: { userId: userA, spaceId: spaceA } }),
        ).toBe(2);
      });

      it("undo removes the mark and restores the original results, and removing twice is harmless", async () => {
        await setup();
        await cache(a, connA, "m1", {
          priority: "critical",
          needsReply: true,
          category: "reply",
          ...triaged,
        });
        const before = await inboxList(on(), a, {});
        await mark(a, "m1", "noise");
        expect((await inboxList(on(), a, {})).rows[0]?.needsReply).toBe(false);

        expect(await mark(a, "m1", null)).toEqual({ mark: null });
        expect(await mark(a, "m1", null)).toEqual({ mark: null });

        expect(await inboxList(on(), a, {})).toEqual(before);
        expect(await prisma.inboxSenderFeedback.count({ where: { spaceId: spaceA } })).toBe(0);
      });

      it("keeps one mark per sender when it changes from important to noise", async () => {
        await setup();
        await cache(a, connA, "m1", { priority: "normal", ...triaged });
        await mark(a, "m1", "important");
        await mark(a, "m1", "noise");

        const rows = await prisma.inboxSenderFeedback.findMany({ where: { spaceId: spaceA } });
        expect(rows).toMatchObject([
          { userId: userA, senderAddress: "ann@example.test", mark: "noise" },
        ]);
      });

      it("keeps marks private to the user and space, and refuses other people's messages", async () => {
        await setup();
        await allow(b);
        await cache(a, connA, "mine", { priority: "low", needsReply: true, ...triaged });
        await cache(b, connB, "theirs", { priority: "low", needsReply: true, ...triaged });
        await cache(c, connC, "elsewhere", { priority: "low", ...triaged });
        const theirs = await prisma.cachedMailMessage.findFirstOrThrow({
          where: { providerMessageId: "theirs" },
        });
        const elsewhere = await prisma.cachedMailMessage.findFirstOrThrow({
          where: { providerMessageId: "elsewhere" },
        });

        await mark(b, "theirs", "noise");

        // Same sender address, same space: only the marking user sees the effect.
        const mine = await inboxList(on(), a, {});
        expect(mine.rows[0]).toMatchObject({ feedback: null, needsReply: true });
        expect((await inboxList(on(), b, {})).rows[0]).toMatchObject({ feedback: "noise" });
        for (const messageId of [theirs.id, elsewhere.id, "no-such-message"]) {
          await expect(
            inboxFeedbackSet(on(), a, { messageId, mark: "important" }),
          ).rejects.toMatchObject({ code: "NOT_FOUND" });
        }
        expect(
          await prisma.inboxSenderFeedback.findMany({ where: { spaceId: spaceA } }),
        ).toMatchObject([{ userId: userB, spaceId: spaceA, mark: "noise" }]);
        await prisma.aiDataConsent.deleteMany({ where: { userId: userB } });
      });

      it("asks the triage job to refresh to-dos when triage is enabled, and not otherwise", async () => {
        await setup();
        await cache(a, connA, "m1", { ...triaged });
        const enqueued: unknown[] = [];
        const jobs = {
          enqueue: async (job: unknown) => void enqueued.push(job),
        } as unknown as JobPublisher;
        const message = await prisma.cachedMailMessage.findFirstOrThrow({
          where: { providerMessageId: "m1" },
        });

        await inboxFeedbackSet({ ...on(), jobs }, a, { messageId: message.id, mark: "noise" });
        expect(enqueued).toEqual([inboxTriageJob(userA, spaceA)]);

        enqueued.length = 0;
        await wipeConsent();
        await inboxFeedbackSet({ ...deps, jobs }, a, { messageId: message.id, mark: "important" });
        expect(enqueued).toEqual([]);
      });

      it("refuses a message with no sender address", async () => {
        await setup();
        await cache(a, connA, "nameless", { fromAddress: "", ...triaged });
        await expect(mark(a, "nameless", "noise")).rejects.toMatchObject({ code: "BAD_REQUEST" });
        expect(await prisma.inboxSenderFeedback.count({ where: { spaceId: spaceA } })).toBe(0);
      });

      it("shows the mark and category on rows found by a live Gmail search", async () => {
        await setup();
        seedMailboxes();
        const found = await inboxList(on(), a, { filter: "unread" });
        expect(found.rows[0]).toMatchObject({ feedback: null, category: null });
        await mark(a, "a-1", "noise");
        expect((await inboxList(on(), a, { filter: "unread" })).rows[0]).toMatchObject({
          feedback: "noise",
        });
      });

      it("serves the feedback procedure through the router", async () => {
        await setup();
        await cache(a, connA, "m1", { ...triaged });
        const message = await prisma.cachedMailMessage.findFirstOrThrow({
          where: { providerMessageId: "m1" },
        });
        const client = createRouterClient(createRouter({ ...on() } as unknown as RouterDeps), {
          context: { actor: a } as never,
        });

        expect(await client.inbox.feedback({ messageId: message.id, mark: "important" })).toEqual({
          mark: "important",
        });
        expect((await client.inbox.list({})).rows[0]?.feedback).toBe("important");
      });
    });
  });

  describe("connections.revoke", () => {
    it("deletes the connection's cached mail and sync state and leaves other accounts alone", async () => {
      await wipe();
      const doomed = await connect(a, "box-doomed");
      await cache(a, doomed, "d1");
      await cache(a, connA, "keep");
      await prisma.mailSyncState.create({ data: { connectionId: doomed } });
      await prisma.mailSyncState.create({ data: { connectionId: connA } });
      const todo = (who: Actor, connectionId: string, doneAt: Date | null) =>
        prisma.inboxTodo.create({
          data: { spaceId: who.spaceId, userId: who.userId, connectionId, text: "Reply", doneAt },
        });
      await todo(a, doomed, null);
      await todo(a, doomed, new Date());
      await todo(a, connA, null);
      const client = createRouterClient(
        createRouter({
          prisma,
          mail,
          connectors: { managed: () => connector },
        } as unknown as RouterDeps),
        { context: { actor: a } as never },
      );

      await client.connections.revoke({ connectionId: doomed });

      expect((await prisma.connection.findUniqueOrThrow({ where: { id: doomed } })).status).toBe(
        "revoked",
      );
      expect(await prisma.cachedMailMessage.count({ where: { connectionId: doomed } })).toBe(0);
      expect(await prisma.mailSyncState.count({ where: { connectionId: doomed } })).toBe(0);
      expect(await prisma.inboxTodo.count({ where: { connectionId: doomed } })).toBe(0);
      expect(await prisma.inboxTodo.count({ where: { connectionId: connA } })).toBe(1);
      expect(await prisma.cachedMailMessage.count({ where: { connectionId: connA } })).toBe(1);
      expect(await prisma.mailSyncState.count({ where: { connectionId: connA } })).toBe(1);
      await prisma.connection.delete({ where: { id: doomed } });
    });

    it("keeps the user's sender marks, which belong to the sender and not to one account", async () => {
      await wipe();
      const doomed = await connect(a, "box-marked");
      await prisma.inboxSenderFeedback.create({
        data: { spaceId: spaceA, userId: userA, senderAddress: "ann@example.test", mark: "noise" },
      });
      const client = createRouterClient(
        createRouter({
          prisma,
          mail,
          connectors: { managed: () => connector },
        } as unknown as RouterDeps),
        { context: { actor: a } as never },
      );

      await client.connections.revoke({ connectionId: doomed });

      expect(await prisma.inboxSenderFeedback.count({ where: { userId: userA } })).toBe(1);
      await prisma.connection.delete({ where: { id: doomed } });
    });
  });
});
