import type { AdapterContext, MailAccount, MailProvider } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { MailSignals } from "@rakazo/contracts";
import { MAIL_SIGNALS_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type EmulatedMessage, GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import {
  checkPriorContact,
  MAX_PRIOR_CONTACT_CHECKS,
  markPriorContactFromSent,
  pickPriorContactCandidates,
  refreshSenderStats,
  storePriorContact,
} from "./mail-sender-stats.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const NOW = new Date("2026-10-15T12:00:00Z");
const WINDOW_START = new Date(NOW.getTime() - 14 * DAY);
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

const quiet: MailSignals = {
  listUnsubscribe: [],
  oneClick: false,
  listId: null,
  bulk: false,
  autoSubmitted: false,
  auth: { dkim: "pass", spf: "pass", dmarc: "pass" },
  dkimCoversUnsubscribe: false,
  categories: {
    spam: false,
    promotions: false,
    social: false,
    updates: false,
    forums: false,
    important: false,
  },
};

describePostgres("sender stats (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `stats-user-${suffix}`;
  const otherUserId = `stats-other-${suffix}`;
  const organizationId = `stats-org-${suffix}`;
  const spaceId = `stats-space-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let counter = 0;

  const scopeOf = (connectionId: string, user = userId) => ({
    spaceId,
    userId: user,
    connectionId,
  });
  const context = (): AdapterContext => ({
    operationId: "stats",
    traceId: "stats",
    spaceId,
    userId,
    signal: new AbortController().signal,
  });

  async function connect(ref: string, user = userId): Promise<MailAccount> {
    const row = await prisma.connection.create({
      data: {
        spaceId,
        userId: user,
        connectorId: "emulator",
        provider: "gmail",
        displayName: ref,
        status: "connected",
        providerRef: ref,
        metadata: { mailAddress: `${ref}@example.test` },
      },
    });
    return {
      id: row.id,
      connectorId: "emulator",
      app: "gmail",
      accountRef: ref,
      label: ref,
      spaceId,
      userId: user,
      address: `${ref}@example.test`,
    };
  }

  /** A cached message from `from`, received `days` ago. */
  async function cache(
    account: MailAccount,
    from: string,
    days: number,
    extra: Partial<{
      unread: boolean;
      fromSelf: boolean;
      isSpam: boolean;
      signals: MailSignals | null;
      id: string;
    }> = {},
  ) {
    counter += 1;
    await prisma.cachedMailMessage.create({
      data: {
        spaceId: account.spaceId,
        userId: account.userId,
        connectionId: account.id,
        providerMessageId: extra.id ?? `m-${counter}`,
        threadId: `t-${counter}`,
        fromName: null,
        fromAddress: from,
        toAddresses: [],
        ccAddresses: [],
        subject: "Subject",
        snippet: "",
        receivedAt: daysAgo(days),
        unread: extra.unread ?? false,
        inInbox: true,
        fromSelf: extra.fromSelf ?? false,
        isSpam: extra.isSpam ?? false,
        seenAt: NOW,
        signals: (extra.signals === undefined ? quiet : extra.signals) ?? undefined,
        signalsVersion: MAIL_SIGNALS_VERSION,
      },
    });
  }

  const refresh = (account: MailAccount) =>
    prisma.$transaction((tx) => refreshSenderStats(tx, scopeOf(account.id), WINDOW_START));
  const stats = (connectionId: string) =>
    prisma.mailSenderStat.findMany({ where: { connectionId }, orderBy: { senderAddress: "asc" } });
  const statFor = async (connectionId: string, address: string) =>
    prisma.mailSenderStat.findUniqueOrThrow({
      where: { connectionId_senderAddress: { connectionId, senderAddress: address } },
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of [userId, otherUserId])
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: organizationId, name: "Stats Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("counts messages and read messages per lowercased sender and does not double-count a re-fetched message", async () => {
    const account = await connect("count");
    await cache(account, "News@Example.test", 1, { unread: true, id: "n1" });
    await cache(account, "news@example.test", 2, { id: "n2" });
    await cache(account, "other@example.test", 3);

    await refresh(account);
    await refresh(account);

    const news = await statFor(account.id, "news@example.test");
    expect(news).toMatchObject({ messageCount: 2, readCount: 1, spaceId, userId });
    expect(news.lastReceivedAt).toEqual(daysAgo(1));
    expect((await stats(account.id)).map((s) => s.senderAddress)).toEqual([
      "news@example.test",
      "other@example.test",
    ]);
  });

  it("excludes sent, spam and out-of-window messages", async () => {
    const account = await connect("exclude");
    await cache(account, "me@example.test", 1, { fromSelf: true });
    await cache(account, "junk@example.test", 1, { isSpam: true });
    await cache(account, "old@example.test", 20);
    await cache(account, "real@example.test", 1);

    await refresh(account);

    expect((await stats(account.id)).map((s) => s.senderAddress)).toEqual(["real@example.test"]);
  });

  it("takes unsubscribeTarget, oneClick and bulk from the newest message", async () => {
    const account = await connect("newest");
    const listy = (target: string, oneClick: boolean): MailSignals => ({
      ...quiet,
      listUnsubscribe: [target],
      oneClick,
      listId: "List <l.example.test>",
    });
    await cache(account, "list@example.test", 5, {
      signals: listy("https://l.example.test/old", false),
    });
    await cache(account, "list@example.test", 1, {
      signals: listy("https://l.example.test/new", true),
    });
    await cache(account, "plain@example.test", 1);
    await cache(account, "plain@example.test", 2, { signals: null });
    await cache(account, "bulk@example.test", 1, { signals: { ...quiet, bulk: true } });

    await refresh(account);

    expect(await statFor(account.id, "list@example.test")).toMatchObject({
      unsubscribeTarget: "https://l.example.test/new",
      oneClick: true,
      bulk: true,
    });
    expect(await statFor(account.id, "plain@example.test")).toMatchObject({
      unsubscribeTarget: null,
      oneClick: false,
      bulk: false,
    });
    expect(await statFor(account.id, "bulk@example.test")).toMatchObject({
      unsubscribeTarget: null,
      bulk: true,
    });
  });

  it("keeps one row per connection and sender, scoped to the user", async () => {
    const a = await connect("scope-a");
    const b = await connect("scope-b");
    const stranger = await connect("scope-c", otherUserId);
    await cache(a, "shared@example.test", 1);
    await cache(b, "shared@example.test", 1);
    await cache(b, "shared@example.test", 2);
    await cache(stranger, "shared@example.test", 1);

    await refresh(a);
    await refresh(b);

    expect((await statFor(a.id, "shared@example.test")).messageCount).toBe(1);
    expect((await statFor(b.id, "shared@example.test")).messageCount).toBe(2);
    expect(await stats(stranger.id)).toEqual([]);
    expect(await prisma.mailSenderStat.count({ where: { userId: otherUserId } })).toBe(0);
  });

  it("drops counts to zero when messages leave the window and keeps priorContact", async () => {
    const account = await connect("leave");
    await cache(account, "gone@example.test", 1, { id: "gone-1" });
    await refresh(account);
    await prisma.mailSenderStat.updateMany({
      where: { connectionId: account.id },
      data: { priorContact: true, priorContactCheckedAt: NOW },
    });

    await prisma.cachedMailMessage.deleteMany({ where: { connectionId: account.id } });
    await refresh(account);

    expect(await statFor(account.id, "gone@example.test")).toMatchObject({
      messageCount: 0,
      readCount: 0,
      priorContact: true,
    });
  });

  describe("prior contact", () => {
    const sentTo = (id: string, to: string): EmulatedMessage => ({
      id,
      date: daysAgo(3).toISOString(),
      labels: ["SENT"],
      from: "me@example.test",
      to,
      subject: "Hi",
    });
    function emulatorProvider(ref: string, messages: EmulatedMessage[]) {
      const gmail = new GmailApiEmulator({
        now: NOW,
        mailboxes: { [ref]: { address: `${ref}@example.test`, messages } },
      });
      const mail = createMailProvider({
        prisma,
        connectors: {
          managed: () =>
            ({
              proxy: async (request: { accountRef: string; url: string }) =>
                gmail.handle(request.accountRef, request.url),
            }) as never,
        },
        sleep: async () => {},
        random: () => 0,
      });
      return { gmail, mail };
    }

    it("is true when a sent message exists, false when none, and checks nothing else", async () => {
      const account = await connect("prior-a");
      const { gmail, mail } = emulatorProvider("prior-a", [sentTo("s1", "friend@example.test")]);

      const results = await checkPriorContact(mail, account, context(), [
        "friend@example.test",
        "stranger@example.test",
      ]);

      expect(results).toEqual([
        { address: "friend@example.test", priorContact: true },
        { address: "stranger@example.test", priorContact: false },
      ]);
      expect(
        gmail.requests.some((r) => decodeURIComponent(r.url).includes('to:"friend@example.test"')),
      ).toBe(true);
    });

    it("uses useCache false, so mail_messages gains no row from the search", async () => {
      const account = await connect("prior-nocache");
      const { mail } = emulatorProvider("prior-nocache", [sentTo("s1", "friend@example.test")]);
      await checkPriorContact(mail, account, context(), ["friend@example.test"]);
      expect(await prisma.cachedMailMessage.count({ where: { connectionId: account.id } })).toBe(0);
    });

    it("leaves the rest unknown when the provider is rate limited", async () => {
      const account = await connect("prior-limited");
      const listMessages = vi
        .fn()
        .mockResolvedValueOnce({ messages: [{ id: "x" }] })
        .mockRejectedValueOnce(new MailProviderError("rate_limited", "slow down"));
      const mail = { listMessages } as unknown as MailProvider;

      const results = await checkPriorContact(mail, account, context(), [
        "a@example.test",
        "b@example.test",
        "c@example.test",
      ]);

      expect(results).toEqual([{ address: "a@example.test", priorContact: true }]);
      expect(listMessages).toHaveBeenCalledTimes(2);
    });

    it("stops and leaves the address unknown when the page could not be hydrated", async () => {
      const account = await connect("prior-unhydrated");
      const listMessages = vi.fn().mockResolvedValue({ messages: [], unhydratedIds: ["x"] });
      const mail = { listMessages } as unknown as MailProvider;
      expect(
        await checkPriorContact(mail, account, context(), ["a@example.test", "b@example.test"]),
      ).toEqual([]);
      expect(listMessages).toHaveBeenCalledTimes(1);
    });

    it("records an address the provider cannot search as checked without a result", async () => {
      const account = await connect("prior-invalid");
      const listMessages = vi.fn().mockResolvedValue({ messages: [] });
      const mail = { listMessages } as unknown as MailProvider;
      expect(
        await checkPriorContact(mail, account, context(), [
          'bad"addr@example.test',
          "ok@example.test",
        ]),
      ).toEqual([
        { address: 'bad"addr@example.test', priorContact: null },
        { address: "ok@example.test", priorContact: false },
      ]);
      expect(listMessages).toHaveBeenCalledTimes(1);
    });

    it("stores results, keeps a true that a sent message set in the same sync, and only touches named rows", async () => {
      const account = await connect("prior-store");
      for (const sender of ["a", "b", "c", "d"]) await cache(account, `${sender}@example.test`, 1);
      await refresh(account);

      await prisma.$transaction(async (tx) => {
        await markPriorContactFromSent(tx, scopeOf(account.id), ["c@example.test"], NOW);
        await storePriorContact(
          tx,
          scopeOf(account.id),
          [
            { address: "a@example.test", priorContact: true },
            { address: "b@example.test", priorContact: false },
            { address: "c@example.test", priorContact: false },
          ],
          NOW,
        );
      });

      expect(await statFor(account.id, "a@example.test")).toMatchObject({ priorContact: true });
      expect(await statFor(account.id, "b@example.test")).toMatchObject({
        priorContact: false,
        priorContactCheckedAt: NOW,
      });
      expect(await statFor(account.id, "c@example.test")).toMatchObject({ priorContact: true });
      expect(await statFor(account.id, "d@example.test")).toMatchObject({
        priorContact: null,
        priorContactCheckedAt: null,
      });
    });

    it("flips false to true when a later sent message names the sender, and ignores other scopes", async () => {
      const account = await connect("prior-flip");
      const stranger = await connect("prior-flip-other", otherUserId);
      await cache(account, "pal@example.test", 1);
      await cache(stranger, "pal@example.test", 1);
      await refresh(account);
      await prisma.$transaction((tx) =>
        refreshSenderStats(tx, scopeOf(stranger.id, otherUserId), WINDOW_START),
      );
      await prisma.mailSenderStat.updateMany({
        data: { priorContact: false, priorContactCheckedAt: NOW },
        where: { connectionId: { in: [account.id, stranger.id] } },
      });

      await prisma.$transaction((tx) =>
        markPriorContactFromSent(
          tx,
          scopeOf(account.id),
          ["pal@example.test", "nobody@example.test"],
          NOW,
        ),
      );

      expect((await statFor(account.id, "pal@example.test")).priorContact).toBe(true);
      expect((await statFor(stranger.id, "pal@example.test")).priorContact).toBe(false);
      expect(await prisma.mailSenderStat.count({ where: { connectionId: account.id } })).toBe(1);
    });

    it("picks at most 10 senders, fresh senders first and newest first, and skips resolved or recently checked ones", async () => {
      const account = await connect("prior-pick");
      for (let i = 0; i < 14; i += 1) await cache(account, `s${i}@example.test`, i + 0.5);
      await refresh(account);
      await prisma.mailSenderStat.updateMany({
        where: { connectionId: account.id, senderAddress: "s1@example.test" },
        data: { priorContact: false, priorContactCheckedAt: NOW },
      });
      await prisma.mailSenderStat.updateMany({
        where: { connectionId: account.id, senderAddress: "s2@example.test" },
        data: { priorContactCheckedAt: new Date(NOW.getTime() - 3_600_000) },
      });

      const picked = await pickPriorContactCandidates(
        prisma,
        scopeOf(account.id),
        [
          "s12@example.test",
          "s0@example.test",
          "s1@example.test",
          "s2@example.test",
          "new@example.test",
        ],
        MAX_PRIOR_CONTACT_CHECKS,
        NOW,
      );

      expect(MAX_PRIOR_CONTACT_CHECKS).toBe(10);
      expect(picked).toHaveLength(10);
      // Fresh addresses keep their order; a sender with no row yet counts as unchecked.
      expect(picked.slice(0, 3)).toEqual([
        "s12@example.test",
        "s0@example.test",
        "new@example.test",
      ]);
      expect(picked).not.toContain("s1@example.test");
      expect(picked).not.toContain("s2@example.test");
      // The backlog comes newest first.
      expect(picked.slice(3)).toEqual(
        ["s3", "s4", "s5", "s6", "s7", "s8", "s9"].map((s) => `${s}@example.test`),
      );
    });

    it("checks a sender again once a day has passed", async () => {
      const account = await connect("prior-recheck");
      await cache(account, "late@example.test", 1);
      await refresh(account);
      await prisma.mailSenderStat.updateMany({
        where: { connectionId: account.id },
        data: { priorContactCheckedAt: new Date(NOW.getTime() - 2 * DAY) },
      });
      expect(await pickPriorContactCandidates(prisma, scopeOf(account.id), [], 10, NOW)).toEqual([
        "late@example.test",
      ]);
    });
  });
});
