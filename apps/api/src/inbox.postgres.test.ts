import { createRouterClient } from "@orpc/server";
import type {
  AdapterContext,
  BackgroundJob,
  ConnectorProxyRequest,
  JobPublisher,
  MailAccount,
  MailProvider,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { inboxTriageJob } from "@rakazo/adapter-kit";
import {
  aiRecipient,
  createMailProvider,
  GmailApiEmulator,
  runMailSyncJob,
} from "@rakazo/adapters";
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
import {
  inboxArchive,
  inboxArchiveMany,
  inboxMarkRead,
  inboxUnarchive,
  inboxUnarchiveMany,
} from "./inbox-modify.js";
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

  /** Where a queued mail.sync job runs: before enqueue returns, after a short delay, or not at all. */
  let workerMode: "inline" | "delayed" | "none" = "inline";
  const queuedSyncs: BackgroundJob[] = [];
  /** Queues like the real publisher and runs an immediate mail.sync job the way the worker would. */
  const syncingJobs = (onOther?: (job: BackgroundJob) => void): JobPublisher => {
    const publisher: JobPublisher = {
      enqueue: async (job) => {
        if (job.name !== "mail.sync") return onOther?.(job);
        queuedSyncs.push(job);
        if (job.availableAt || workerMode === "none") return;
        const run = () => runMailSyncJob({ prisma, mail, jobs: publisher }, job.payload);
        if (workerMode === "inline") await run();
        else setTimeout(() => void run(), 300);
      },
      cancel: async () => {},
      close: async () => {},
    };
    return publisher;
  };

  let connA: string;
  let connB: string;
  let connC: string;
  let revokedA: string;

  const connector = {
    proxy: async (request: ConnectorProxyRequest, _context: AdapterContext) =>
      gmail.handle(request.accountRef, request.url, request.method, request.body),
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
      isSpam: boolean;
      pile: string | null;
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
        isSpam: extra.isSpam ?? false,
        pile: extra.pile ?? null,
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
    workerMode = "inline";
    queuedSyncs.length = 0;
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
    deps = { prisma, mail, jobs: syncingJobs() };
  });

  afterAll(async () => {
    if (!prisma) return;
    await wipe();
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB, userC] } } });
    await close();
  });

  /** `withSent` adds the user's own sent message s-1 to box-a. */
  const seedMailboxes = (withSent = false) => {
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
        "box-a": {
          address: "box-a@example.test",
          messages: [
            message("a-1", ["INBOX", "UNREAD"]),
            ...(withSent ? [message("s-1", ["SENT"])] : []),
          ],
        },
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
      expect(out.accounts).toEqual([
        { connectionId: connA, label: "Mailbox box-a", address: "box-a@example.test" },
      ]);
      expect(out.syncedAt).toBeNull();
      expect(out.failedAccounts).toEqual([]);
    });

    it("keeps spam rows out of the list, the unread count and the thread siblings", async () => {
      await wipe();
      seedMailboxes();
      const open = await cache(a, connA, "a-1", { threadId: "t", receivedAt: daysAgo(1) });
      // Gmail removes INBOX when it adds SPAM; the thread sibling is the row that could still leak.
      await cache(a, connA, "spam-1", {
        threadId: "t",
        receivedAt: daysAgo(2),
        unread: true,
        inInbox: false,
        isSpam: true,
      });
      await cache(a, connA, "spam-2", {
        threadId: "spam-thread",
        unread: true,
        inInbox: false,
        isSpam: true,
      });

      expect((await inboxList(deps, a, {})).rows.map((row) => row.subject)).toEqual([
        "Subject a-1",
      ]);
      expect(await inboxUnreadCount(deps, a)).toEqual({ count: 0 });
      const opened = await inboxGet(deps, a, { messageId: open.id });
      expect([...opened.thread, ...opened.later]).toEqual([]);
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

    it("keeps reporting a rate limit after its backoff ends, until a sync clears it, even while another process holds the claim", async () => {
      await wipe();
      const expired = await connect(a, "box-a-expired");
      const cleared = await connect(a, "box-a-cleared");
      const syncing = await connect(a, "box-a-syncing");
      const hour = new Date(Date.now() - 3_600_000);
      const limited = {
        lastErrorAt: hour,
        lastErrorKind: "rate_limited",
        backoffUntil: new Date(hour.getTime() + 30_000),
      };
      await prisma.mailSyncState.create({ data: { connectionId: expired, ...limited } });
      // A successful sync clears the error fields, so this account has nothing to report.
      await prisma.mailSyncState.create({
        data: { connectionId: cleared, lastSyncedAt: new Date() },
      });
      await prisma.mailSyncState.create({
        data: { connectionId: syncing, ...limited, syncStartedAt: new Date() },
      });

      const out = await inboxList(deps, a, {});
      expect(out.rateLimitedAccounts.sort()).toEqual([expired, syncing].sort());
      expect(out.failedAccounts.sort()).toEqual([expired, syncing].sort());

      // A successful sync clears the stored error; then the account is no longer reported.
      await prisma.mailSyncState.update({
        where: { connectionId: syncing },
        data: { lastErrorAt: null, lastErrorKind: null, backoffUntil: null },
      });
      const after = await inboxList(deps, a, {});
      expect(after.failedAccounts).toEqual([expired]);
      await prisma.connection.deleteMany({ where: { id: { in: [expired, cleared, syncing] } } });
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

  describe("piles", () => {
    const subjects = (out: { rows: Array<{ subject: string }> }) =>
      out.rows.map((r) => r.subject.replace("Subject ", "")).sort();
    const seedPiles = async () => {
      await wipe();
      await cache(a, connA, "imp", { pile: "important", receivedAt: daysAgo(1) });
      await cache(a, connA, "undecided", { pile: null, receivedAt: daysAgo(2) });
      await cache(a, connA, "upd", {
        pile: "updates",
        fromAddress: "Billing@Shop.Example.Test",
        receivedAt: daysAgo(3),
      });
      await cache(a, connA, "news", { pile: "newsletters", receivedAt: daysAgo(4) });
      await cache(a, connA, "spam-inbox", { pile: "spam", receivedAt: daysAgo(5) });
      await cache(a, connA, "spam-gmail", {
        isSpam: true,
        inInbox: false,
        receivedAt: daysAgo(6),
      });
      await cache(a, connA, "archived", { pile: "updates", inInbox: false });
    };

    it("important pile returns pile important and pile null rows and nothing from other piles", async () => {
      await seedPiles();

      const out = await inboxList(deps, a, { pile: "important" });

      expect(subjects(out)).toEqual(["imp", "undecided"]);
      expect(out.rows.find((r) => r.subject === "Subject imp")?.pile).toBe("important");
      expect(out.rows.find((r) => r.subject === "Subject undecided")?.pile).toBeNull();
    });

    it("updates and newsletters piles return only their rows with lowercased fromAddress and pile on each row", async () => {
      await seedPiles();

      const updates = await inboxList(deps, a, { pile: "updates" });
      const newsletters = await inboxList(deps, a, { pile: "newsletters" });

      expect(subjects(updates)).toEqual(["upd"]);
      expect(updates.rows[0]).toMatchObject({
        fromAddress: "billing@shop.example.test",
        pile: "updates",
      });
      expect(subjects(newsletters)).toEqual(["news"]);
      expect(newsletters.rows[0]?.pile).toBe("newsletters");
    });

    it("spam pile returns isSpam rows that are not in the inbox and inbox rows with pile spam, and spam rows never appear in the other piles", async () => {
      await seedPiles();

      const spam = await inboxList(deps, a, { pile: "spam" });

      expect(subjects(spam)).toEqual(["spam-gmail", "spam-inbox"]);
      expect(spam.rows.every((r) => r.pile === "spam")).toBe(true);
      expect(spam.rows.find((r) => r.subject === "Subject spam-gmail")?.inInbox).toBe(false);
      for (const pile of ["important", "updates", "newsletters"] as const) {
        expect(
          subjects(await inboxList(deps, a, { pile })).filter((x) => x.startsWith("spam")),
        ).toEqual([]);
      }
      // The default list is unchanged by piles: it still shows every inbox row except Gmail spam.
      expect(subjects(await inboxList(deps, a, {}))).toEqual([
        "imp",
        "news",
        "spam-inbox",
        "undecided",
        "upd",
      ]);
    });

    it("pile views are filtered and carry no triage fields while triage is off", async () => {
      await seedPiles();
      await cache(a, connA, "triaged-upd", {
        pile: "updates",
        category: "receipt",
        priority: "low",
        reason: "Receipt from a shop",
        needsReply: false,
        triagedAt: new Date(),
        triageVersion: TRIAGE_VERSION,
      });

      const out = await inboxList(deps, a, { pile: "updates" });

      expect(out.enabled).toBe(false);
      expect(subjects(out)).toEqual(["triaged-upd", "upd"]);
      expect(out.rows.every((r) => r.category === null && r.reason === null)).toBe(true);
      expect(out.rows.every((r) => r.needsReply === null && r.priority === null)).toBe(true);
    });

    it("pileCounts counts threads, not messages, per pile and respects the account tab", async () => {
      await seedPiles();
      // A second message of the same thread, and a second account.
      await cache(a, connA, "upd-2", { pile: "updates", threadId: "upd", receivedAt: daysAgo(2) });
      const second = await connect(a, "box-a2");
      await cache(a, second, "other-news", { pile: "newsletters" });
      await cache(a, connA, "too-old", { pile: "updates", receivedAt: daysAgo(30) });

      const all = await inboxList(deps, a, {});
      const tab = await inboxList(deps, a, { connectionId: second });

      expect(all.pileCounts).toEqual({ important: 2, updates: 1, newsletters: 2, spam: 2 });
      expect(tab.pileCounts).toEqual({ important: 0, updates: 0, newsletters: 1, spam: 0 });
      // The count matches what each pile lists.
      for (const pile of ["important", "updates", "newsletters", "spam"] as const) {
        expect((await inboxList(deps, a, { pile })).rows).toHaveLength(
          all.pileCounts?.[pile] ?? -1,
        );
      }
      await prisma.connection.delete({ where: { id: second } });
    });

    it("leaves pileCounts off when no account is connected and on filtered lists", async () => {
      expect((await inboxList(deps, actor(userA, spaceB), {})).pileCounts).toBeUndefined();
    });

    it("rejects pile with view, category, filter or query before asking Gmail", async () => {
      await seedPiles();
      const before = gmail?.requests.length ?? 0;
      for (const input of [
        { pile: "updates" as const, view: "important" as const },
        { pile: "updates" as const, category: "billing" as const },
        { pile: "updates" as const, filter: "unread" as const },
        { pile: "updates" as const, query: "from:ann" },
      ]) {
        await expect(inboxList(deps, a, input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      }
      expect(gmail?.requests.length ?? 0).toBe(before);
    });

    it("the updates pile returns all 250 threads of one noisy sender (cap 500) while other views keep the 200 cap", async () => {
      await wipe();
      for (let start = 0; start < 250; start += 50) {
        await Promise.all(
          Array.from({ length: 50 }, (_, i) =>
            cache(a, connA, `noisy-${start + i}`, {
              pile: "updates",
              fromAddress: "noisy@shop.example.test",
              receivedAt: new Date(Date.now() - (start + i + 1) * 60_000),
            }),
          ),
        );
      }

      const updates = await inboxList(deps, a, { pile: "updates" });
      const all = await inboxList(deps, a, {});

      expect(updates.rows).toHaveLength(250);
      expect(new Set(updates.rows.map((r) => r.fromAddress))).toEqual(
        new Set(["noisy@shop.example.test"]),
      );
      expect(all.rows).toHaveLength(200);
      expect(all.pileCounts?.updates).toBe(250);
    });

    it("pile list and counts never include another user's, another space's or a revoked account's mail", async () => {
      await wipe();
      await cache(a, connA, "mine", { pile: "updates" });
      await cache(a, revokedA, "revoked", { pile: "updates" });
      await cache(b, connB, "theirs", { pile: "updates" });
      await cache(c, connC, "other-space", { pile: "updates" });
      await cache(b, connB, "theirs-spam", { isSpam: true, inInbox: false });

      const updates = await inboxList(deps, a, { pile: "updates" });
      const spam = await inboxList(deps, a, { pile: "spam" });

      expect(subjects(updates)).toEqual(["mine"]);
      expect(spam.rows).toEqual([]);
      expect(updates.pileCounts).toEqual({ important: 0, updates: 1, newsletters: 0, spam: 0 });
      await expect(
        inboxList(deps, a, { pile: "updates", connectionId: connB }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("omitting pile keeps the previous list unchanged", async () => {
      await seedPiles();
      const out = await inboxList(deps, a, {});
      expect(subjects(out)).toEqual(["imp", "news", "spam-inbox", "undecided", "upd"]);
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
      expect(unread.accounts).toEqual([
        { connectionId: connA, label: "Mailbox box-a", address: "box-a@example.test" },
      ]);
      expect(requestedBoxes()).toEqual(["box-a"]);

      const starred = await inboxList(deps, a, { filter: "starred" });
      expect(starred.rows.map((r) => r.subject)).toEqual(["Subject a-star"]);
      // A row returned for a message outside the cache window can be opened.
      const body = await inboxGet(deps, a, { messageId: (starred.rows[0] as { id: string }).id });
      expect(body.html).toBe("<p>Body of a-star</p>");
    });

    it("says why triage is off on a searched list as well, so every response carries the reason", async () => {
      await wipe();
      gmail = new GmailApiEmulator({
        mailboxes: {
          "box-a": mailbox("box-a@example.test", [
            { id: "a-1", days: 1, labels: ["INBOX"], subject: "Budget" },
          ]),
          "box-b": mailbox("box-b@example.test", []),
        },
      });
      const found = await inboxList(deps, a, { query: "budget" });
      expect(found.rows).toHaveLength(1);
      expect(found.triageBlocked).toEqual({ reason: "no_model" });
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
      // Gmail answers 401 for a mailbox it does not know, which the provider maps to "reconnect".
      expect(out.reconnectAccounts).toEqual([broken]);
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

      const result = await inboxRefresh(deps, a, {});
      expect(result).toMatchObject({ ok: true, syncing: false });
      expect(result.syncedAt).not.toBeNull();
      expect(queuedSyncs.map((job) => job.payload)).toEqual([
        { spaceId: spaceA, userId: userA, connectionId: connA },
      ]);

      const synced = await prisma.cachedMailMessage.findMany({
        where: { spaceId: { in: [spaceA, spaceB] } },
      });
      expect(synced.map((row) => row.providerMessageId)).toEqual(["a-1"]);
      expect(synced[0]).toMatchObject({ userId: userA, spaceId: spaceA, unread: true });
      expect(gmail.accountRefs().length).toBe(4);
      expect(gmail.requests.every((r) => r.accountRef === "box-a")).toBe(true);
      expect((await inboxList(deps, a, {})).syncedAt).not.toBeNull();
    });

    it("reports a failed sync, and whether the account needs a reconnect, but not an incomplete one", async () => {
      await wipe();
      seedMailboxes();
      const status = async () => {
        const out = await inboxList(deps, a, {});
        return { failed: out.failedAccounts, reconnect: out.reconnectAccounts };
      };

      gmail.failNext(401, { times: 1000 });
      await inboxRefresh(deps, a, {});
      expect(await status()).toEqual({ failed: [connA], reconnect: [connA] });

      // A failed sync throttles the next one for 60 seconds, so age the error first.
      await prisma.mailSyncState.update({
        where: { connectionId: connA },
        data: { lastErrorAt: new Date(Date.now() - 120_000) },
      });
      gmail.failNext(503, { times: 1000 });
      await inboxRefresh(deps, a, {});
      expect(await status()).toEqual({ failed: [connA], reconnect: [] });

      // One message cannot be hydrated (rate limit): the rest loaded, so this is not a failure.
      await prisma.mailSyncState.update({
        where: { connectionId: connA },
        data: { lastErrorAt: new Date(Date.now() - 120_000) },
      });
      gmail.failNext(429, { times: 1000, urlIncludes: "messages/a-1" });
      await inboxRefresh(deps, a, {});
      expect(await status()).toEqual({ failed: [], reconnect: [] });
    });

    it("returns at once with syncing true and calls Gmail zero times", async () => {
      await wipe();
      seedMailboxes();
      workerMode = "none";

      const started = Date.now();
      const result = await inboxRefresh(deps, a, {});

      expect(Date.now() - started).toBeLessThan(1000);
      expect(result).toEqual({ ok: true, syncing: true, syncedAt: null });
      expect(gmail.requests).toEqual([]);
      expect(queuedSyncs).toHaveLength(1);
      // A second refresh while the job waits reports the same and queues nothing more.
      expect((await inboxRefresh(deps, a, {})).syncing).toBe(true);
      expect(queuedSyncs).toHaveLength(1);
    });

    it("waits for the queued job when asked to", async () => {
      await wipe();
      seedMailboxes();
      workerMode = "delayed";

      const started = Date.now();
      const result = await inboxRefresh(deps, a, { waitMs: 5000 });

      expect(Date.now() - started).toBeGreaterThan(250);
      expect(result.syncing).toBe(false);
      expect(result.syncedAt).not.toBeNull();
      expect(await prisma.cachedMailMessage.count({ where: { userId: userA } })).toBe(1);
    });

    it("returns at once during a rate-limit backoff and schedules the job at its end", async () => {
      await wipe();
      seedMailboxes();
      await prisma.mailSyncState.create({
        data: {
          connectionId: connA,
          lastErrorAt: new Date(),
          lastErrorKind: "rate_limited",
          backoffUntil: new Date(Date.now() + 20_000),
        },
      });

      const started = Date.now();
      const result = await inboxRefresh(deps, a, { connectionId: connA });

      expect(Date.now() - started).toBeLessThan(1000);
      expect(result.syncing).toBe(true);
      const wait = (queuedSyncs[0]?.availableAt?.getTime() ?? 0) - Date.now();
      expect(wait).toBeGreaterThan(18_000);
      expect(gmail.requests).toEqual([]);
    });

    it("does not wait or sync when the request is already aborted", async () => {
      await wipe();
      seedMailboxes();
      await prisma.mailSyncState.create({
        data: {
          connectionId: connA,
          lastErrorAt: new Date(),
          lastErrorKind: "rate_limited",
          backoffUntil: new Date(Date.now() + 5000),
        },
      });

      const started = Date.now();
      await inboxRefresh(deps, a, { connectionId: connA }, AbortSignal.abort());

      expect(Date.now() - started).toBeLessThan(1000);
      expect(gmail.requests).toEqual([]);
    });

    it("only queues syncs for the caller's own connected accounts", async () => {
      await wipe();
      seedMailboxes();
      workerMode = "none";

      await inboxRefresh(deps, a, {});
      await inboxRefresh(deps, c, {});

      expect(queuedSyncs.map((job) => job.payload)).toEqual([
        { spaceId: spaceA, userId: userA, connectionId: connA },
        { spaceId: spaceB, userId: userC, connectionId: connC },
      ]);
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
      await cache(b, connB, "a-1");
      await cache(c, connC, "a-1");
      await inboxRefresh(deps, a, {});
      const row = await prisma.cachedMailMessage.findFirstOrThrow({
        where: { spaceId: spaceA, userId: userA, connectionId: connA, providerMessageId: "a-1" },
      });

      expect(row).toMatchObject({ spaceId: spaceA, userId: userA, connectionId: connA });
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

    it("lists the conversation's earlier and later messages, oldest first, and the cached state", async () => {
      await wipe();
      seedMailboxes(true);
      const first = await cache(a, connA, "t-1", { threadId: "t", receivedAt: daysAgo(3) });
      const second = await cache(a, connA, "t-2", {
        threadId: "t",
        receivedAt: daysAgo(2),
        fromName: null,
        fromAddress: "bob@example.test",
      });
      const latest = await cache(a, connA, "a-1", {
        threadId: "t",
        receivedAt: daysAgo(1),
        unread: true,
      });
      // The user's own reply, after the message that is open.
      const reply = await cache(a, connA, "s-1", {
        threadId: "t",
        receivedAt: new Date(),
        inInbox: false,
        fromSelf: true,
        fromName: null,
        fromAddress: "me@example.test",
      });
      // Same thread id on another user's mailbox stays out.
      await cache(b, connB, "b-1", { threadId: "t" });

      const message = await inboxGet(deps, a, { messageId: latest.id });
      expect(message.later).toEqual([
        {
          id: reply.id,
          from: "me@example.test",
          receivedAt: reply.receivedAt.toISOString(),
          snippet: "Snippet s-1",
          fromSelf: true,
        },
      ]);

      expect(message).toMatchObject({ unread: true, inInbox: true });
      expect(message.fromSelf).toBeUndefined();
      // The user's own message says so, so the dialog can name its sender "You".
      expect((await inboxGet(deps, a, { messageId: reply.id })).fromSelf).toBe(true);
      expect(message.thread).toEqual([
        {
          id: first.id,
          from: "Ann Sender",
          receivedAt: first.receivedAt.toISOString(),
          snippet: "Snippet t-1",
        },
        {
          id: second.id,
          from: "bob@example.test",
          receivedAt: second.receivedAt.toISOString(),
          snippet: "Snippet t-2",
        },
      ]);
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

    it("says why triage is off: no model, or consent needed for the model's exact recipient", async () => {
      await wipe();
      await wipeConsent();
      const recipient = {
        key: aiRecipient({
          provider: "openrouter",
          modelId: "vendor/small-model",
          use: "model",
        })!.key,
        name: "OpenRouter",
      };

      expect((await inboxList(deps, a, {})).triageBlocked).toEqual({ reason: "no_model" });
      expect((await inboxList({ ...deps, ...ready }, a, {})).triageBlocked).toEqual({
        reason: "needs_consent",
        recipient,
      });

      await allow(a);
      expect((await inboxList({ ...deps, ...ready }, a, {})).triageBlocked).toBeNull();
      // Consent is per user: b still has to allow it, and the empty list says so too.
      expect((await inboxList({ ...deps, ...ready }, b, {})).triageBlocked).toMatchObject({
        reason: "needs_consent",
      });
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

    describe("refresh starts triage", () => {
      const queued: unknown[] = [];
      const jobs = syncingJobs((job) => void queued.push(job));
      const job = inboxTriageJob(userA, spaceA);
      const refresh = (extra: object = ready) => inboxRefresh({ ...deps, ...extra, jobs }, a, {});

      it("enqueues triage after consent is granted inside the 60 second sync throttle", async () => {
        await wipe();
        await wipeConsent();
        seedMailboxes();
        queued.length = 0;

        // The first sync caches the mail; with no consent yet the job it queues would do nothing.
        await refresh();
        expect(await prisma.cachedMailMessage.count({ where: { userId: userA } })).toBe(1);
        queued.length = 0;

        // The user presses Allow, which refreshes. Every sync is throttled, so only the refresh
        // itself can start triage.
        await allow(a);
        const listed = () => gmail.requests.filter((r) => r.url.includes("/messages")).length;
        const before = listed();
        await refresh();
        expect(listed()).toBe(before);
        expect(queued).toEqual([job]);
      });

      it("enqueues triage for mail cached earlier even when Gmail fails during the refresh", async () => {
        await wipe();
        await wipeConsent();
        seedMailboxes();
        await refresh();
        await allow(a);
        await prisma.$executeRaw`UPDATE mail_sync_states SET "lastSyncedAt" = now() - interval '5 minutes' WHERE "connectionId" = ${connA}`;
        gmail.failNext(503, { times: 1000 });
        queued.length = 0;

        await refresh();

        expect(queued).toEqual([job]);
        await wipeConsent();
      });

      it("does not enqueue when triage is not ready or no mail waits for it", async () => {
        await wipe();
        await wipeConsent();
        seedMailboxes();
        await refresh();
        await allow(a);

        // Throttled, not ready: no model.
        queued.length = 0;
        await refresh({});
        expect(queued).toEqual([]);

        // Throttled, ready, but everything in the window is already triaged or sent.
        await prisma.cachedMailMessage.updateMany({
          where: { userId: userA },
          data: { triagedAt: new Date(), triageVersion: TRIAGE_VERSION },
        });
        await cache(a, connA, "sent", { fromSelf: true });
        await refresh();
        expect(queued).toEqual([]);

        // Someone else's untriaged mail does not count.
        await cache(b, connB, "theirs");
        await refresh();
        expect(queued).toEqual([]);

        // Mail that is waiting does.
        await cache(a, connA, "waiting");
        await refresh();
        expect(queued).toEqual([job]);
        await wipeConsent();
      });
    });

    it("lists only open to-dos, for connected accounts only", async () => {
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
      await todo(a, connA, { text: "Paid", doneAt: new Date(Date.now() - 3_600_000) });
      await todo(a, connA, { text: "Long ago", doneAt: new Date(Date.now() - 2 * DAY) });
      await todo(a, revokedA, { text: "Revoked account" });
      await todo(b, connB, { text: "Theirs" });
      await todo(c, connC, { text: "Elsewhere" });

      const out = await inboxTodosList({ ...deps, ...ready }, a, {});

      expect(out.enabled).toBe(true);
      expect(out.todos.map((t) => t.text).sort()).toEqual(["Sign it"]);
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

      it("shows the one-line summary on pile rows once triage is enabled", async () => {
        await setup();
        await cache(a, connA, "summarized", {
          pile: "updates",
          category: "receipt",
          reason: "Receipt from a shop",
          ...triaged,
        });

        const out = await inboxList(on(), a, { pile: "updates" });

        expect(out.enabled).toBe(true);
        expect(out.rows.map((r) => r.reason)).toEqual(["Receipt from a shop"]);
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

  describe("archive and mark read", () => {
    const labelsOf = (messageId: string) =>
      gmail.handle("box-a", `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`)
        .data as { labelIds: string[] };
    const setup = async () => {
      await wipe();
      const inThread = (messageId: string) => ({
        id: messageId,
        threadId: "t-a",
        date: daysAgo(1).toISOString(),
        labels: ["INBOX", "UNREAD"],
        from: "Ann Sender <ann@example.test>",
        to: "me@example.test",
        subject: `Subject ${messageId}`,
      });
      gmail = new GmailApiEmulator({
        mailboxes: {
          "box-a": {
            address: "box-a@example.test",
            messages: [inThread("a-1"), inThread("a-2")],
          },
          "box-b": { address: "box-b@example.test", messages: [inThread("b-1")] },
        },
      });
      const first = await cache(a, connA, "a-1", { threadId: "t-a", unread: true });
      const second = await cache(a, connA, "a-2", {
        threadId: "t-a",
        unread: true,
        receivedAt: daysAgo(0.5),
      });
      const theirs = await cache(b, connB, "b-1", { unread: true });
      return { first, second, theirs };
    };
    const cached = (userId: string) =>
      prisma.cachedMailMessage.findMany({
        where: { userId },
        orderBy: { providerMessageId: "asc" },
        select: { providerMessageId: true, unread: true, inInbox: true },
      });

    it("archives the whole thread in Gmail and the cache, and the row leaves the list", async () => {
      const { second, theirs } = await setup();

      await inboxArchive(deps, a, { messageId: second.id });

      expect(labelsOf("a-1").labelIds).not.toContain("INBOX");
      expect(labelsOf("a-2").labelIds).not.toContain("INBOX");
      expect(await cached(userA)).toEqual([
        { providerMessageId: "a-1", unread: true, inInbox: false },
        { providerMessageId: "a-2", unread: true, inInbox: false },
      ]);
      expect((await inboxList(deps, a, {})).rows).toEqual([]);
      await expect(inboxArchive(deps, a, { messageId: theirs.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(await cached(userB)).toEqual([
        { providerMessageId: "b-1", unread: true, inInbox: true },
      ]);
    });

    it("unarchive puts the whole thread back in the inbox", async () => {
      const { second } = await setup();
      await inboxArchive(deps, a, { messageId: second.id });

      await inboxUnarchive(deps, a, { messageId: second.id });

      expect(labelsOf("a-1").labelIds).toContain("INBOX");
      expect(labelsOf("a-2").labelIds).toContain("INBOX");
      expect((await cached(userA)).map((m) => m.inInbox)).toEqual([true, true]);
      expect((await inboxList(deps, a, {})).rows).toHaveLength(1);
    });

    it("also changes older messages of the thread that were never cached", async () => {
      const { second } = await setup();
      gmail.addMessage("box-a", {
        id: "a-0",
        threadId: "t-a",
        date: daysAgo(30).toISOString(),
        labels: ["INBOX", "UNREAD"],
        from: "Ann Sender <ann@example.test>",
        to: "me@example.test",
        subject: "Subject a-0",
      });

      await inboxMarkRead(deps, a, { messageId: second.id, read: true });
      await inboxArchive(deps, a, { messageId: second.id });

      expect(labelsOf("a-0").labelIds).toEqual([]);
    });

    it("marks every unread message of the thread read, and only the chosen one unread", async () => {
      const { second } = await setup();

      await inboxMarkRead(deps, a, { messageId: second.id, read: true });

      expect(labelsOf("a-1").labelIds).not.toContain("UNREAD");
      expect(labelsOf("a-2").labelIds).not.toContain("UNREAD");
      expect((await cached(userA)).map((m) => m.unread)).toEqual([false, false]);
      expect(await inboxUnreadCount(deps, a)).toEqual({ count: 0 });

      await inboxMarkRead(deps, a, { messageId: second.id, read: false });

      expect(labelsOf("a-1").labelIds).not.toContain("UNREAD");
      expect(labelsOf("a-2").labelIds).toContain("UNREAD");
      expect((await cached(userA)).map((m) => m.unread)).toEqual([false, true]);
      expect(await inboxUnreadCount(deps, a)).toEqual({ count: 1 });
    });

    it("asks to reconnect and changes nothing when the account lacks permission to change mail", async () => {
      const { second } = await setup();
      gmail.failNext(403, { reason: "insufficientPermissions", urlIncludes: "/modify" });

      await expect(inboxArchive(deps, a, { messageId: second.id })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });

      expect(await cached(userA)).toEqual([
        { providerMessageId: "a-1", unread: true, inInbox: true },
        { providerMessageId: "a-2", unread: true, inInbox: true },
      ]);
      const state = await prisma.mailSyncState.findUniqueOrThrow({
        where: { connectionId: connA },
      });
      expect(state.needsReconnect).toBe(true);
    });

    it("does nothing while mail writes are turned off", async () => {
      const { second } = await setup();

      await expect(
        inboxArchive({ ...deps, mailWritesDisabled: true }, a, { messageId: second.id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(labelsOf("a-2").labelIds).toContain("INBOX");
    });

    it("serves both procedures through the router", async () => {
      const { second } = await setup();
      const client = createRouterClient(
        createRouter({ ...deps, env: { mailWritesDisabled: false } } as unknown as RouterDeps),
        { context: { actor: a } as never },
      );

      expect(await client.inbox.markRead({ messageId: second.id, read: true })).toEqual({
        ok: true,
      });
      expect(await client.inbox.archive({ messageId: second.id })).toEqual({ ok: true });
      expect(await cached(userA)).toEqual([
        { providerMessageId: "a-1", unread: false, inInbox: false },
        { providerMessageId: "a-2", unread: false, inInbox: false },
      ]);
    });
  });

  describe("bulk archive", () => {
    const labelsOf = (ref: string, messageId: string) =>
      gmail.handle(ref, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`)
        .data as { labelIds: string[] };
    const inboxOf = (ref: string, messageId: string) =>
      labelsOf(ref, messageId).labelIds.includes("INBOX");
    const msg = (id: string) => ({
      id,
      threadId: id,
      date: daysAgo(1).toISOString(),
      labels: ["INBOX"],
      from: "Ann Sender <ann@example.test>",
      to: "me@example.test",
      subject: `Subject ${id}`,
    });
    const setup = async () => {
      await wipe();
      gmail = new GmailApiEmulator({
        mailboxes: {
          "box-a": {
            address: "box-a@example.test",
            messages: ["m1", "m2", "m3", "spam-1", "spam-2"].map(msg),
          },
          "box-a2": { address: "box-a2@example.test", messages: ["x1", "x2"].map(msg) },
          "box-b": { address: "box-b@example.test", messages: [msg("b1")] },
          "box-c": { address: "box-c@example.test", messages: [msg("c1")] },
          "box-revoked": { address: "box-revoked@example.test", messages: [msg("r1")] },
        },
      });
      const mine = await Promise.all(["m1", "m2", "m3"].map((m) => cache(a, connA, m)));
      return { mine };
    };
    const stateOf = async (userId: string) =>
      Object.fromEntries(
        (
          await prisma.cachedMailMessage.findMany({
            where: { userId },
            select: { providerMessageId: true, inInbox: true },
          })
        ).map((m) => [m.providerMessageId, m.inInbox]),
      );

    it("archiveMany archives many threads in Gmail and the cache and returns all ids in done", async () => {
      const { mine } = await setup();

      const out = await inboxArchiveMany(deps, a, { messageIds: mine.map((m) => m.id) });

      expect(out.failed).toEqual([]);
      expect([...out.done].sort()).toEqual(mine.map((m) => m.id).sort());
      expect(["m1", "m2", "m3"].map((m) => inboxOf("box-a", m))).toEqual([false, false, false]);
      expect(await stateOf(userA)).toEqual({ m1: false, m2: false, m3: false });
      expect((await inboxList(deps, a, {})).rows).toEqual([]);
    });

    it("de-duplicates ids and handles every id of a larger selection", async () => {
      await setup();
      const rows = await Promise.all(
        Array.from({ length: 12 }, async (_, i) => {
          gmail.addMessage("box-a", msg(`bulk-${i}`));
          return cache(a, connA, `bulk-${i}`);
        }),
      );

      const out = await inboxArchiveMany(deps, a, {
        messageIds: [...rows.map((r) => r.id), rows[0]?.id as string],
      });

      expect(out.done).toHaveLength(12);
      expect(out.failed).toEqual([]);
    });

    it("reports ids of another user, another space, a revoked account or unknown ids as not_found and still archives the caller's own", async () => {
      const { mine } = await setup();
      const theirs = await cache(b, connB, "b1");
      const otherSpace = await cache(c, connC, "c1");
      const revoked = await cache(a, revokedA, "r1");

      const out = await inboxArchiveMany(deps, a, {
        messageIds: [mine[0]?.id as string, theirs.id, otherSpace.id, revoked.id, "no-such-id"],
      });

      expect(out.done).toEqual([mine[0]?.id]);
      expect(out.failed.map((f) => f.reason)).toEqual([
        "not_found",
        "not_found",
        "not_found",
        "not_found",
      ]);
      expect(out.failed.map((f) => f.messageId).sort()).toEqual(
        [theirs.id, otherSpace.id, revoked.id, "no-such-id"].sort(),
      );
      expect(inboxOf("box-b", "b1")).toBe(true);
      expect(inboxOf("box-c", "c1")).toBe(true);
      expect(await stateOf(userB)).toEqual({ b1: true });
      expect(await stateOf(userC)).toEqual({ c1: true });
    });

    it("reports an account without permission as reconnect for its ids and archives the others", async () => {
      const { mine } = await setup();
      const second = await connect(a, "box-a2");
      const x1 = await cache(a, second, "x1");
      gmail.failNext(403, { reason: "insufficientPermissions", urlIncludes: "/threads/x1/modify" });

      const out = await inboxArchiveMany(deps, a, { messageIds: [x1.id, mine[0]?.id as string] });

      expect(out.done).toEqual([mine[0]?.id]);
      expect(out.failed).toEqual([{ messageId: x1.id, reason: "reconnect" }]);
      expect((await stateOf(userA)).x1).toBe(true);
      expect(
        (await prisma.mailSyncState.findUniqueOrThrow({ where: { connectionId: second } }))
          .needsReconnect,
      ).toBe(true);
      await prisma.mailSyncState.deleteMany({ where: { connectionId: second } });
      await prisma.connection.delete({ where: { id: second } });
    });

    it("reports a Gmail failure as unavailable for that id only", async () => {
      const { mine } = await setup();
      gmail.failNext(500, { times: 20, urlIncludes: "/threads/m2/modify" });

      const out = await inboxArchiveMany(deps, a, { messageIds: mine.map((m) => m.id) });

      gmail.clearFailures();
      expect(out.failed).toEqual([{ messageId: mine[1]?.id, reason: "unavailable" }]);
      expect(out.done.sort()).toEqual([mine[0]?.id, mine[2]?.id].sort());
      expect((await stateOf(userA)).m2).toBe(true);
    });

    it("does nothing and throws BAD_REQUEST while mail writes are turned off", async () => {
      const { mine } = await setup();

      await expect(
        inboxArchiveMany({ ...deps, mailWritesDisabled: true }, a, {
          messageIds: mine.map((m) => m.id),
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        inboxUnarchiveMany({ ...deps, mailWritesDisabled: true }, a, {
          messageIds: mine.map((m) => m.id),
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });

      expect(inboxOf("box-a", "m1")).toBe(true);
      expect(await stateOf(userA)).toEqual({ m1: true, m2: true, m3: true });
    });

    it("skips spam-pile and Gmail-spam rows with reason spam unless allowSpam is true", async () => {
      const { mine } = await setup();
      const piled = await cache(a, connA, "spam-1", { pile: "spam" });
      const gmailSpam = await cache(a, connA, "spam-2", { isSpam: true, inInbox: false });

      const refused = await inboxArchiveMany(deps, a, {
        messageIds: [mine[0]?.id as string, piled.id, gmailSpam.id],
      });

      expect(refused.done).toEqual([mine[0]?.id]);
      expect(refused.failed.map((f) => f.reason)).toEqual(["spam", "spam"]);
      expect(inboxOf("box-a", "spam-1")).toBe(true);
      expect((await stateOf(userA))["spam-1"]).toBe(true);

      const allowed = await inboxArchiveMany(deps, a, { messageIds: [piled.id], allowSpam: true });

      expect(allowed).toEqual({ done: [piled.id], failed: [] });
      expect(inboxOf("box-a", "spam-1")).toBe(false);
      expect((await stateOf(userA))["spam-1"]).toBe(false);
    });

    it("unarchiveMany puts the threads back in the inbox", async () => {
      const { mine } = await setup();
      const messageIds = mine.map((m) => m.id);
      await inboxArchiveMany(deps, a, { messageIds });

      const out = await inboxUnarchiveMany(deps, a, { messageIds });

      expect(out.failed).toEqual([]);
      expect(out.done).toHaveLength(3);
      expect(await stateOf(userA)).toEqual({ m1: true, m2: true, m3: true });
      expect(["m1", "m2", "m3"].every((m) => inboxOf("box-a", m))).toBe(true);
    });

    it("serves archiveMany and unarchiveMany through the router for the signed-in user only; rejects 0 and 51 ids", async () => {
      const { mine } = await setup();
      const theirs = await cache(b, connB, "b1");
      const client = createRouterClient(
        createRouter({ ...deps, env: { mailWritesDisabled: false } } as unknown as RouterDeps),
        { context: { actor: a } as never },
      );

      const archived = await client.inbox.archiveMany({
        messageIds: [mine[0]?.id as string, theirs.id],
      });
      expect(archived).toEqual({
        done: [mine[0]?.id],
        failed: [{ messageId: theirs.id, reason: "not_found" }],
      });
      expect(await client.inbox.unarchiveMany({ messageIds: [mine[0]?.id as string] })).toEqual({
        done: [mine[0]?.id],
        failed: [],
      });
      expect(inboxOf("box-b", "b1")).toBe(true);
      await expect(client.inbox.archiveMany({ messageIds: [] })).rejects.toThrow();
      await expect(
        client.inbox.archiveMany({
          messageIds: Array.from({ length: 51 }, (_, i) => `id-${i}`),
        }),
      ).rejects.toThrow();
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

    describe("with a Gmail push watch", () => {
      const googleConnection = async (ref: string) =>
        (
          await prisma.connection.create({
            data: {
              spaceId: spaceA,
              userId: userA,
              connectorId: "google",
              provider: "gmail",
              displayName: `Mailbox ${ref}`,
              status: "connected",
              providerRef: ref,
              metadata: { mailAddress: `${ref}@example.test` },
            },
          })
        ).id;
      const watched = async (ref: string) => {
        const id = await googleConnection(ref);
        await prisma.mailSyncState.create({
          data: {
            connectionId: id,
            watchAddress: `${ref}@example.test`,
            watchExpiresAt: new Date(Date.now() + 5 * 86_400_000),
          },
        });
        return id;
      };
      const revokeWith = (stop: (connectionId: string) => Promise<void>) =>
        createRouterClient(
          createRouter({
            prisma,
            mail: {
              listAccounts: mail.listAccounts.bind(mail),
              stopWatch: async (account: MailAccount) => stop(account.id),
            },
            connectors: { managed: () => connector },
          } as unknown as RouterDeps),
          { context: { actor: a } as never },
        );

      it("stops the watch before the connection is marked revoked", async () => {
        await wipe();
        const doomed = await watched("box-watched");
        const seen: string[] = [];

        await revokeWith(async (connectionId) => {
          seen.push(
            (await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } })).status,
          );
        }).connections.revoke({ connectionId: doomed });

        expect(seen).toEqual(["connected"]);
        expect((await prisma.connection.findUniqueOrThrow({ where: { id: doomed } })).status).toBe(
          "revoked",
        );
        await prisma.connection.delete({ where: { id: doomed } });
      });

      it("still revokes when stopping the watch fails", async () => {
        await wipe();
        const doomed = await watched("box-watch-fails");

        await revokeWith(async () => {
          throw new Error("gmail down");
        }).connections.revoke({ connectionId: doomed });

        expect((await prisma.connection.findUniqueOrThrow({ where: { id: doomed } })).status).toBe(
          "revoked",
        );
        await prisma.connection.delete({ where: { id: doomed } });
      });

      it("does not call Gmail for a connection without a watch", async () => {
        await wipe();
        const doomed = await googleConnection("box-unwatched");
        let calls = 0;

        await revokeWith(async () => void calls++).connections.revoke({ connectionId: doomed });

        expect(calls).toBe(0);
        await prisma.connection.delete({ where: { id: doomed } });
      });
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
