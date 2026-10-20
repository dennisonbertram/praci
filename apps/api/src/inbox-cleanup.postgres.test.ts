import type { MailProvider } from "@rakazo/adapter-kit";
import type { MailSignals } from "@rakazo/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inboxCleanupArchive, inboxCleanupForget, inboxCleanupList } from "./inbox-cleanup.js";
import {
  bulkSignals,
  createMailFixture,
  daysAgo,
  type MailFixture,
} from "./test-support/mail-fixture.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const NEWS = "news@lists.example.test";
const failedAuth: MailSignals = {
  ...bulkSignals,
  auth: { dkim: "pass", spf: "fail", dmarc: "pass" },
};

describePostgres("inbox cleanup (PostgreSQL + Gmail emulator)", () => {
  let f: MailFixture;
  beforeAll(async () => {
    f = await createMailFixture("cleanup", databaseUrl as string);
  });
  afterAll(async () => {
    if (f) {
      await f.wipe();
      await f.dispose();
    }
  });

  /** Caches `count` threads from one sender and writes the stat the sync would. */
  async function sender(
    who = f.a,
    connectionId = f.connA,
    address = NEWS,
    opts: {
      count?: number;
      read?: number;
      prior?: boolean | null;
      extra?: Parameters<MailFixture["cache"]>[3];
      bulk?: boolean;
    } = {},
  ) {
    const count = opts.count ?? 5;
    const read = opts.read ?? 0;
    for (let i = 0; i < count; i++)
      await f.cache(who, connectionId, `${address}-${i}`, {
        from: address,
        unread: i >= read,
        receivedAt: daysAgo(1 + i / 10),
        ...opts.extra,
      });
    await f.prisma.mailSenderStat.upsert({
      where: { connectionId_senderAddress: { connectionId, senderAddress: address } },
      create: {
        spaceId: who.spaceId,
        userId: who.userId,
        connectionId,
        senderAddress: address,
        messageCount: count,
        readCount: read,
        lastReceivedAt: daysAgo(1),
        bulk: opts.bulk ?? true,
        priorContact: opts.prior === undefined ? false : opts.prior,
      },
      update: {},
    });
  }

  describe("list", () => {
    it("ranks senders by unopened mail, counts conversations and preselects bulk, rarely read senders", async () => {
      await f.wipe();
      await sender(f.a, f.connA, "big@lists.example.test", { count: 8 });
      await sender(f.a, f.connA, "small@lists.example.test", { count: 4 });
      await sender(f.a, f.connA, "read@lists.example.test", { count: 6, read: 5 });
      await sender(f.a, f.connA, "friend@example.test", { count: 5, prior: true });
      await sender(f.a, f.connA, "unchecked@example.test", { count: 5, prior: null });
      // Two messages of one thread count as one conversation.
      await f.cache(f.a, f.connA, "big-extra", {
        from: "big@lists.example.test",
        threadId: "big@lists.example.test-0",
      });

      const out = await inboxCleanupList(f.deps, f.a, {});

      expect(out.senders.map((s) => s.address)).toEqual([
        "big@lists.example.test",
        "friend@example.test",
        "unchecked@example.test",
        "small@lists.example.test",
        "read@lists.example.test",
      ]);
      const big = out.senders[0];
      expect(big).toMatchObject({
        connectionId: f.connA,
        name: "News",
        messageCount: 8,
        readCount: 0,
        inboxThreads: 8,
        preselected: true,
        spamLike: false,
        unsubscribe: "link",
        skipInbox: false,
        unsubscribeStatus: null,
      });
      const preselected = Object.fromEntries(out.senders.map((s) => [s.address, s.preselected]));
      expect(preselected).toEqual({
        "big@lists.example.test": true,
        "small@lists.example.test": true,
        "read@lists.example.test": false,
        "friend@example.test": false,
        "unchecked@example.test": false,
      });
      expect(out.accounts.map((a) => a.connectionId)).toEqual(
        expect.arrayContaining([f.connA, f.connA2]),
      );
    });

    it("never preselects spam-like senders and offers no unsubscribe for them", async () => {
      await f.wipe();
      await sender(f.a, f.connA, "forged@lists.example.test", { extra: { signals: failedAuth } });
      await sender(f.a, f.connA, "scam@lists.example.test", { extra: { category: "scam" } });
      await sender(f.a, f.connA, "junk@lists.example.test", { extra: { pile: "spam" } });

      const out = await inboxCleanupList(f.deps, f.a, {});

      expect(out.senders).toHaveLength(3);
      for (const s of out.senders)
        expect(s, s.address).toMatchObject({
          spamLike: true,
          preselected: false,
          unsubscribe: "refused",
        });
    });

    it("leaves out senders with no inbox mail, self-sent mail, old mail and revoked accounts", async () => {
      await f.wipe();
      await sender(f.a, f.connA, "archived@lists.example.test", { extra: { inInbox: false } });
      await sender(f.a, f.connA, "old@lists.example.test", { extra: { receivedAt: daysAgo(120) } });
      await sender(f.a, f.revokedA, "revoked@lists.example.test");
      await f.cache(f.a, f.connA, "mine", { from: "me@example.test", fromSelf: true });
      await sender(f.a, f.connA, "kept@lists.example.test");

      const out = await inboxCleanupList(f.deps, f.a, {});

      expect(out.senders.map((s) => s.address)).toEqual(["kept@lists.example.test"]);
    });

    it("keeps a skipped sender listed after its mail is archived, so the decision can be undone", async () => {
      await f.wipe();
      await sender(f.a, f.connA, "skipped@lists.example.test", { extra: { inInbox: false } });
      await f.prisma.mailSenderDecision.create({
        data: {
          spaceId: f.a.spaceId,
          userId: f.a.userId,
          connectionId: f.connA,
          senderAddress: "skipped@lists.example.test",
          skipInboxAt: new Date(),
        },
      });

      const out = await inboxCleanupList(f.deps, f.a, {});

      expect(out.senders).toHaveLength(1);
      expect(out.senders[0]).toMatchObject({
        skipInbox: true,
        inboxThreads: 0,
        preselected: false,
      });
    });

    it("keeps a skipped sender listed only on the account where it is skipped", async () => {
      await f.wipe();
      const address = "skipped@lists.example.test";
      await sender(f.a, f.connA, address, { extra: { inInbox: false } });
      await sender(f.a, f.connA2, address, { extra: { inInbox: false } });
      await f.prisma.mailSenderDecision.create({
        data: {
          spaceId: f.a.spaceId,
          userId: f.a.userId,
          connectionId: f.connA,
          senderAddress: address,
          skipInboxAt: new Date(),
        },
      });

      const out = await inboxCleanupList(f.deps, f.a, {});

      expect(out.senders.map((s) => s.connectionId)).toEqual([f.connA]);
    });

    it("filters by account, rejects a foreign one and hides other users' and spaces' data", async () => {
      await f.wipe();
      await sender(f.a, f.connA, "a1@lists.example.test");
      await sender(f.a, f.connA2, "a2@lists.example.test");
      await sender(f.b, f.connB, "b@lists.example.test");
      await sender(f.c, f.connC, "c@lists.example.test");

      expect(
        (await inboxCleanupList(f.deps, f.a, { connectionId: f.connA2 })).senders.map(
          (s) => s.address,
        ),
      ).toEqual(["a2@lists.example.test"]);
      expect(
        (await inboxCleanupList(f.deps, f.a, {})).senders.map((s) => s.address).sort(),
      ).toEqual(["a1@lists.example.test", "a2@lists.example.test"]);
      await expect(inboxCleanupList(f.deps, f.a, { connectionId: f.connB })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(inboxCleanupList(f.deps, f.a, { connectionId: f.connC })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(
        inboxCleanupList(f.deps, f.a, { connectionId: f.revokedA }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("flags a skipped sender and an important mark, and never calls the provider", async () => {
      await f.wipe();
      await sender(f.a, f.connA, "skipped@lists.example.test");
      await sender(f.a, f.connA, "vip@lists.example.test");
      await f.prisma.mailSenderDecision.create({
        data: {
          spaceId: f.a.spaceId,
          userId: f.a.userId,
          connectionId: f.connA,
          senderAddress: "skipped@lists.example.test",
          skipInboxAt: new Date(),
          unsubscribeStatus: "done",
          unsubscribeMethod: "one_click",
        },
      });
      await f.prisma.inboxSenderFeedback.create({
        data: {
          spaceId: f.a.spaceId,
          userId: f.a.userId,
          senderAddress: "vip@lists.example.test",
          mark: "important",
        },
      });
      const calls: string[] = [];
      const throwing = new Proxy({} as MailProvider, {
        get: (_target, name) => () => {
          calls.push(String(name));
          throw new Error("no provider calls allowed");
        },
      });

      const out = await inboxCleanupList({ ...f.deps, mail: throwing }, f.a, {});

      expect(calls).toEqual([]);
      const byAddress = Object.fromEntries(out.senders.map((s) => [s.address, s]));
      expect(byAddress["skipped@lists.example.test"]).toMatchObject({
        skipInbox: true,
        preselected: false,
        unsubscribeStatus: "done",
      });
      expect(byAddress["vip@lists.example.test"]).toMatchObject({ preselected: false });
    });
  });

  describe("archive", () => {
    const labelsOf = (ref: string, id: string) => f.labelsOf(ref, id);

    it("archives in pages of 50 with remaining, merging the pages into one log row", async () => {
      await f.wipe();
      const ids = Array.from({ length: 60 }, (_, i) => `p-${i}`);
      f.seed({ "box-a": ids.map((id) => f.gmailMessage(id)) });
      for (const id of ids) await f.cache(f.a, f.connA, id, { from: NEWS });

      const first = await inboxCleanupArchive(f.deps, f.a, {
        kind: "archive",
        connectionId: f.connA,
        address: NEWS.toUpperCase(),
      });
      expect(first).toMatchObject({ done: 50, failed: 0, remaining: 10 });
      const second = await inboxCleanupArchive(f.deps, f.a, {
        kind: "archive",
        connectionId: f.connA,
        address: NEWS,
        batchId: first.batchId,
      });
      expect(second).toMatchObject({ batchId: first.batchId, done: 10, failed: 0, remaining: 0 });

      expect(labelsOf("box-a", "p-0")).not.toContain("INBOX");
      expect(
        await f.prisma.cachedMailMessage.count({ where: { connectionId: f.connA, inInbox: true } }),
      ).toBe(0);
      const logs = await f.prisma.mailActionLog.findMany({ where: { connectionId: f.connA } });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({
        batchId: first.batchId,
        kind: "archive",
        source: "user",
        reason: "cleanup",
        senderAddresses: [NEWS],
      });
      expect(logs[0]?.threadIds).toHaveLength(60);
      // Nothing left: a third call is a no-op.
      expect(
        await inboxCleanupArchive(f.deps, f.a, {
          kind: "archive",
          connectionId: f.connA,
          address: NEWS,
        }),
      ).toMatchObject({ done: 0, remaining: 0 });
    });

    it("skips spam-pile mail on archive and marks it as spam on kind spam", async () => {
      await f.wipe();
      f.seed({ "box-a": ["ok", "junk"].map((id) => f.gmailMessage(id)) });
      await f.cache(f.a, f.connA, "ok", { from: NEWS });
      await f.cache(f.a, f.connA, "junk", { from: NEWS, pile: "spam" });

      const out = await inboxCleanupArchive(f.deps, f.a, {
        kind: "archive",
        connectionId: f.connA,
        address: NEWS,
      });
      expect(out).toMatchObject({ done: 1, remaining: 0 });
      expect(labelsOf("box-a", "junk")).toContain("INBOX");

      await f.cache(f.a, f.connA, "more", { from: NEWS });
      f.seed({ "box-a": [f.gmailMessage("more"), f.gmailMessage("junk")] });
      const spam = await inboxCleanupArchive(f.deps, f.a, {
        kind: "spam",
        connectionId: f.connA,
        address: NEWS,
      });
      // Spam takes the spam-pile mail too: the user asked for it.
      expect(spam.done).toBe(2);
      expect(labelsOf("box-a", "more")).toEqual(["SPAM"]);
      expect(
        await f.prisma.cachedMailMessage.findFirstOrThrow({
          where: { providerMessageId: "more", userId: f.a.userId },
        }),
      ).toMatchObject({ inInbox: false, isSpam: true });
      expect(
        (await f.prisma.mailActionLog.findMany({ where: { kind: "spam", connectionId: f.connA } }))
          .length,
      ).toBe(1);
    });

    it("records the skip decision, once, and refuses skip and unsubscribe for spam-like senders", async () => {
      await f.wipe();
      f.seed({
        "box-a": [f.gmailMessage("s1"), f.gmailMessage("x1", "Bad <bad@lists.example.test>")],
      });
      await f.cache(f.a, f.connA, "s1", { from: NEWS });
      await f.cache(f.a, f.connA, "x1", { from: "bad@lists.example.test", signals: failedAuth });

      const skip = await inboxCleanupArchive(f.deps, f.a, {
        kind: "skip_inbox",
        connectionId: f.connA,
        address: NEWS,
      });
      expect(skip.done).toBe(1);
      const decision = await f.prisma.mailSenderDecision.findFirstOrThrow({
        where: { connectionId: f.connA, senderAddress: NEWS },
      });
      expect(decision.skipInboxAt).not.toBeNull();
      await inboxCleanupArchive(f.deps, f.a, {
        kind: "skip_inbox",
        connectionId: f.connA,
        address: NEWS,
      });
      const again = await f.prisma.mailSenderDecision.findFirstOrThrow({
        where: { connectionId: f.connA, senderAddress: NEWS },
      });
      expect(again.skipInboxAt?.getTime()).toBe(decision.skipInboxAt?.getTime());

      for (const kind of ["skip_inbox", "unsubscribe"] as const)
        await expect(
          inboxCleanupArchive(f.deps, f.a, {
            kind,
            connectionId: f.connA,
            address: "bad@lists.example.test",
          }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(
        await f.prisma.mailSenderDecision.count({
          where: { senderAddress: "bad@lists.example.test", connectionId: f.connA },
        }),
      ).toBe(0);
      expect(labelsOf("box-a", "x1")).toContain("INBOX");
    });

    it("refuses when mail writes are off, for a foreign account, and reports a missing permission", async () => {
      await f.wipe();
      f.seed({ "box-a": [f.gmailMessage("w1")] });
      await f.cache(f.a, f.connA, "w1", { from: NEWS });
      const input = { kind: "archive" as const, connectionId: f.connA, address: NEWS };

      await expect(
        inboxCleanupArchive({ ...f.deps, mailWritesDisabled: true }, f.a, input),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        inboxCleanupArchive(f.deps, f.a, { ...input, connectionId: f.connB }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(inboxCleanupArchive(f.deps, f.b, input)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });

      f.gmail.failNext(403, { reason: "insufficientPermissions", urlIncludes: "/modify" });
      const out = await inboxCleanupArchive(f.deps, f.a, input);
      expect(out).toMatchObject({ done: 0, failed: 1, remaining: 1 });
      expect(labelsOf("box-a", "w1")).toContain("INBOX");
      expect(await f.prisma.mailActionLog.count({ where: { connectionId: f.connA } })).toBe(0);
    });

    it("stops paging on a thread Gmail already deleted instead of repeating it", async () => {
      await f.wipe();
      f.seed({ "box-a": [] });
      await f.cache(f.a, f.connA, "gone", { from: NEWS });

      const out = await inboxCleanupArchive(f.deps, f.a, {
        kind: "archive",
        connectionId: f.connA,
        address: NEWS,
      });

      expect(out).toMatchObject({ remaining: 0 });
    });
  });

  describe("forget", () => {
    it("deletes only the caller's decision, and twice is harmless", async () => {
      await f.wipe();
      const make = (who: typeof f.a, connectionId: string) =>
        f.prisma.mailSenderDecision.create({
          data: {
            spaceId: who.spaceId,
            userId: who.userId,
            connectionId,
            senderAddress: NEWS,
            skipInboxAt: new Date(),
          },
        });
      await make(f.a, f.connA);
      await make(f.b, f.connB);

      await inboxCleanupForget(f.deps, f.a, { connectionId: f.connA, address: NEWS.toUpperCase() });
      await inboxCleanupForget(f.deps, f.a, { connectionId: f.connA, address: NEWS });
      // Another user's account is not touched even when named.
      await inboxCleanupForget(f.deps, f.a, { connectionId: f.connB, address: NEWS });

      expect(await f.prisma.mailSenderDecision.count({ where: { connectionId: f.connA } })).toBe(0);
      expect(await f.prisma.mailSenderDecision.count({ where: { connectionId: f.connB } })).toBe(1);
    });
  });
});
