import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type {
  AdapterContext,
  BackgroundJob,
  ConnectorProxyRequest,
  ConnectorProxyResponse,
  JobPublisher,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { MAIL_SIGNALS_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { type EmulatedMessage, GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { deleteMailConnectionData, syncMailbox } from "./mail-sync.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

function message(
  id: string,
  days: number,
  labels: string[],
  extra: Partial<EmulatedMessage> = {},
): EmulatedMessage {
  return {
    id,
    date: daysAgo(days),
    labels,
    from: "Ann Sender <ann@example.test>",
    to: "me@example.test",
    subject: `Subject ${id}`,
    snippet: `Snippet ${id}`,
    ...extra,
  };
}

describePostgres("mail cache sync (PostgreSQL + Gmail emulator)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `mail-sync-user-${suffix}`;
  const organizationId = `mail-sync-org-${suffix}`;
  const spaceId = `mail-sync-space-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let second: Awaited<ReturnType<typeof createDb>>;

  // The Gmail fake behind every provider in this file. Tests replace its contents and may
  // hold calls open per operation id to interleave two syncs.
  let gmail: GmailApiEmulator;
  const holds = new Map<string, Promise<void>>();
  /** Makes every message fetch slow, to run a sync into its deadline. */
  let getDelayMs = 0;
  /** Requests whose URL contains this text wait for the signal to abort, then are still answered. */
  let answerLateUrl: string | undefined;
  /** Requests whose URL contains this text wait for the signal to abort, then throw. */
  let throwLate: { url: string; error: () => unknown } | undefined;
  /** Window lists; the prior-contact searches (`in:sent to:...`) are counted by their own tests. */
  const listCalls = () =>
    gmail.requests.filter(
      (r) => /\/messages\?/.test(r.url) && !/[ +]to:/.test(decodeURIComponent(r.url)),
    ).length;
  const getCalls = () => gmail.requests.filter((r) => /\/messages\/[^?]/.test(r.url)).length;

  const connector = {
    proxy: async (
      request: ConnectorProxyRequest,
      context: AdapterContext,
    ): Promise<ConnectorProxyResponse> => {
      if (throwLate && request.url.includes(throwLate.url)) {
        await new Promise<void>((resolve) => {
          if (context.signal.aborted) resolve();
          context.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        throw throwLate.error();
      }
      if (answerLateUrl && request.url.includes(answerLateUrl)) {
        await new Promise<void>((resolve) => {
          if (context.signal.aborted) resolve();
          context.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        return gmail.handle(request.accountRef, request.url);
      }
      const hold = holds.get(context.operationId);
      if (hold) {
        await Promise.race([
          hold,
          new Promise<void>((resolve) =>
            context.signal.addEventListener("abort", () => resolve(), { once: true }),
          ),
        ]);
        if (context.signal.aborted) throw context.signal.reason;
      }
      if (getDelayMs && /\/messages\/[^?]/.test(request.url)) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, getDelayMs);
          context.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        });
        if (context.signal.aborted) throw context.signal.reason;
      }
      return gmail.handle(request.accountRef, request.url);
    },
  } as unknown as ManagedConnectorProvider;

  const ctx = (operationId = "op", signal = new AbortController().signal): AdapterContext => ({
    operationId,
    traceId: operationId,
    spaceId,
    userId,
    signal,
  });
  const providerFor = (client: PrismaClient) =>
    createMailProvider({
      prisma: client,
      connectors: { managed: () => connector },
      sleep: async () => {},
      random: () => 0,
    });
  let mail: ReturnType<typeof providerFor>;

  async function connect(ref: string): Promise<MailAccount> {
    const row = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        connectorId: "emulator",
        provider: "gmail",
        displayName: `Mailbox ${ref}`,
        status: "connected",
        providerRef: ref,
        metadata: { mailAddress: `${ref}@example.test` },
      },
    });
    const accounts = await mail.listAccounts({ spaceId, userId }, ctx());
    return accounts.find((a) => a.id === row.id) as MailAccount;
  }
  const enqueued: BackgroundJob[] = [];
  const jobs = {
    enqueue: async (job: BackgroundJob) => {
      enqueued.push(job);
    },
    cancel: async () => {},
    close: async () => {},
  } as JobPublisher;
  const sync = (account: MailAccount, operationId = "op", extra = {}) =>
    syncMailbox({ prisma, mail, jobs, ...extra }, account, ctx(operationId));
  const rows = (connectionId: string) =>
    prisma.cachedMailMessage.findMany({ where: { connectionId }, orderBy: { receivedAt: "desc" } });
  const state = (connectionId: string) =>
    prisma.mailSyncState.findUniqueOrThrow({ where: { connectionId } });
  const expireThrottle = (connectionId: string) =>
    prisma.$executeRaw`UPDATE mail_sync_states SET "lastSyncedAt" = now() - interval '5 minutes', "backoffUntil" = NULL WHERE "connectionId" = ${connectionId}`;
  const seed = (ref: string, messages: EmulatedMessage[]) => {
    gmail = new GmailApiEmulator({
      mailboxes: { [ref]: { address: `${ref}@example.test`, messages } },
    });
  };

  beforeAll(async () => {
    const first = createDb(databaseUrl as string);
    second = createDb(databaseUrl as string);
    prisma = first.prisma;
    close = async () => {
      for (const db of [first, second]) {
        await db.prisma.$disconnect();
        await db.pool.end();
      }
    };
    mail = providerFor(prisma);
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Mail Sync Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("syncs the inbox and sent mail of the last 90 days on the first run", async () => {
    seed("first", [
      message("in-1", 1, ["INBOX", "UNREAD"]),
      message("in-old", 80, ["INBOX"]),
      message("in-ancient", 100, ["INBOX"]),
      message("sent-1", 2, ["SENT"], { from: "me@example.test", to: "ann@example.test" }),
      message("both", 3, ["INBOX", "SENT"]),
    ]);
    const account = await connect("first");

    expect(await sync(account)).toBe("synced");

    const byId = Object.fromEntries((await rows(account.id)).map((r) => [r.providerMessageId, r]));
    expect(Object.keys(byId).sort()).toEqual(["both", "in-1", "in-old", "sent-1"]);
    expect(byId["in-1"]).toMatchObject({
      inInbox: true,
      fromSelf: false,
      unread: true,
      fromName: "Ann Sender",
      fromAddress: "ann@example.test",
      toAddresses: ["me@example.test"],
      spaceId,
      userId,
    });
    expect(byId["sent-1"]).toMatchObject({ inInbox: false, fromSelf: true });
    expect(byId.both).toMatchObject({ inInbox: true, fromSelf: true });
    const after = await state(account.id);
    expect(after.lastSyncedAt).not.toBeNull();
    expect(after.lastErrorAt).toBeNull();
    expect(after.syncStartedAt).toBeNull();
    expect(after.claimToken).toBeNull();
  });

  it("enqueues one inbox.triage job for the user after a successful sync, and only then", async () => {
    seed("enqueue", [message("a", 1, ["INBOX"])]);
    const account = await connect("enqueue");
    const bad = await connect("enqueue-no-mailbox");
    enqueued.length = 0;

    expect(await sync(bad)).toBe("failed");
    expect(enqueued).toEqual([]);

    expect(await sync(account)).toBe("synced");
    const expected = {
      name: "inbox.triage",
      payload: { userId, spaceId },
      replaceKey: `inbox.triage:${spaceId}:${userId}`,
      maxAttempts: 3,
    };
    expect(enqueued).toEqual([expected]);

    // A throttled sync did not sync, so it enqueues nothing.
    expect(await sync(account)).toBe("skipped");
    expect(enqueued).toHaveLength(1);

    // A sync that finds no new mail still enqueues, so a sent reply or a new model is picked up.
    await expireThrottle(account.id);
    expect(await sync(account)).toBe("synced");
    expect(enqueued).toEqual([expected, expected]);
  });

  it("still reports synced when the triage job cannot be enqueued", async () => {
    seed("enqueue-fails", [message("a", 1, ["INBOX"])]);
    const account = await connect("enqueue-fails");
    const failing = {
      enqueue: async () => {
        throw new Error("queue down");
      },
    } as unknown as JobPublisher;

    expect(await sync(account, "op", { jobs: failing })).toBe("synced");
    expect(await rows(account.id)).toHaveLength(1);
  });

  it("caps subject and snippet at 500 characters", async () => {
    seed("caps", [
      message("long", 1, ["INBOX"], { subject: "s".repeat(900), snippet: "n".repeat(900) }),
    ]);
    const account = await connect("caps");
    await sync(account);
    const [row] = await rows(account.id);
    expect(row?.subject).toHaveLength(500);
    expect(row?.snippet).toHaveLength(500);
  });

  it("skips a second sync inside 60 seconds without calling the provider", async () => {
    seed("throttle", [message("a", 1, ["INBOX"])]);
    const account = await connect("throttle");
    expect(await sync(account)).toBe("synced");
    const before = gmail.requests.length;

    expect(await sync(account)).toBe("skipped");
    expect(gmail.requests.length).toBe(before);
  });

  it("clears a message that left the inbox and keeps triage columns intact", async () => {
    seed("leave", [message("stay", 1, ["INBOX"]), message("gone", 2, ["INBOX"])]);
    const account = await connect("leave");
    await sync(account);
    await prisma.cachedMailMessage.updateMany({
      where: { connectionId: account.id, providerMessageId: "stay" },
      data: { needsReply: true },
    });

    // A brand-new emulator has no history for the stored cursor, so this sync lists the window.
    seed("leave", [message("stay", 1, ["INBOX"]), message("gone", 2, [])]);
    await prisma.$executeRaw`UPDATE mail_sync_states SET "changeCursor" = NULL WHERE "connectionId" = ${account.id}`;
    await expireThrottle(account.id);
    expect(await sync(account)).toBe("synced");

    const byId = Object.fromEntries((await rows(account.id)).map((r) => [r.providerMessageId, r]));
    expect(byId.gone?.inInbox).toBe(false);
    expect(byId.stay).toMatchObject({ inInbox: true, needsReply: true });
  });

  describe("incremental sync from the change cursor", () => {
    const modify = (ref: string, id: string, change: object) =>
      gmail.handle(
        ref,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`,
        "POST",
        change,
      );
    const cursorOf = async (connectionId: string) => (await state(connectionId)).changeCursor;
    const byId = async (connectionId: string) =>
      Object.fromEntries((await rows(connectionId)).map((r) => [r.providerMessageId, r]));

    it("stores a cursor, then applies only new, relabelled and deleted mail without listing", async () => {
      seed("inc", [
        message("keep", 1, ["INBOX", "UNREAD"]),
        message("gone", 2, ["INBOX"]),
        message("filed", 3, ["INBOX"]),
      ]);
      const account = await connect("inc");
      expect(await sync(account)).toBe("synced");
      const first = await cursorOf(account.id);
      expect(first).not.toBeNull();
      await prisma.cachedMailMessage.updateMany({
        where: { connectionId: account.id, providerMessageId: "keep" },
        data: { needsReply: true },
      });

      gmail.addMessage("inc", message("fresh", 0.5, ["INBOX", "UNREAD"]));
      modify("inc", "keep", { removeLabelIds: ["UNREAD"] });
      modify("inc", "filed", { removeLabelIds: ["INBOX"] });
      gmail.deleteMessage("inc", "gone");
      await expireThrottle(account.id);
      const lists = listCalls();
      enqueued.length = 0;

      expect(await sync(account)).toBe("synced");

      expect(listCalls()).toBe(lists);
      const rowsNow = await byId(account.id);
      expect(Object.keys(rowsNow).sort()).toEqual(["filed", "fresh", "keep"]);
      expect(rowsNow.fresh).toMatchObject({ inInbox: true, unread: true });
      expect(rowsNow.keep).toMatchObject({ inInbox: true, unread: false, needsReply: true });
      expect(rowsNow.filed).toMatchObject({ inInbox: false });
      expect(await cursorOf(account.id)).not.toBe(first);
      expect(enqueued).toHaveLength(1);

      // Nothing changed since: another sync costs one history call and changes nothing.
      await expireThrottle(account.id);
      const before = gmail.requests.length;
      expect(await sync(account)).toBe("synced");
      expect(gmail.requests.length - before).toBe(1);
      expect(Object.keys(await byId(account.id)).sort()).toEqual(["filed", "fresh", "keep"]);
    });

    it("keeps a message moved to spam with isSpam and no inInbox, and still deletes trash", async () => {
      seed("inc-trash", [message("t", 1, ["INBOX"]), message("s", 2, ["INBOX"])]);
      const account = await connect("inc-trash");
      await sync(account);

      modify("inc-trash", "t", { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] });
      modify("inc-trash", "s", { addLabelIds: ["SPAM"], removeLabelIds: ["INBOX"] });
      gmail.addMessage(
        "inc-trash",
        message("out", 0.5, ["SENT"], { from: "me@example.test", to: "ann@example.test" }),
      );
      await expireThrottle(account.id);
      expect(await sync(account)).toBe("synced");

      const rowsNow = await byId(account.id);
      expect(Object.keys(rowsNow).sort()).toEqual(["out", "s"]);
      expect(rowsNow.s).toMatchObject({ isSpam: true, inInbox: false });
      expect(rowsNow.s?.signals).toMatchObject({ categories: { spam: true } });
      expect(rowsNow.out).toMatchObject({ inInbox: false, fromSelf: true, isSpam: false });
      // A spam row gets its pile from the safety rule, even though it is not in the inbox.
      expect(rowsNow.s).toMatchObject({ rulePile: "spam", pile: "spam" });
    });

    it("lists the window again when Gmail no longer has history that old, and stores a new cursor", async () => {
      seed("inc-expired", [message("a", 1, ["INBOX"])]);
      const account = await connect("inc-expired");
      await sync(account);
      const first = await cursorOf(account.id);
      gmail.addMessage("inc-expired", message("b", 0.5, ["INBOX"]));
      gmail.expireHistory("inc-expired");
      await expireThrottle(account.id);
      const lists = listCalls();

      expect(await sync(account)).toBe("synced");

      expect(listCalls()).toBe(lists + 2);
      expect(Object.keys(await byId(account.id)).sort()).toEqual(["a", "b"]);
      expect(await cursorOf(account.id)).not.toBe(first);

      // The new cursor works: the next sync is incremental again.
      gmail.addMessage("inc-expired", message("c", 0.4, ["INBOX"]));
      await expireThrottle(account.id);
      expect(await sync(account)).toBe("synced");
      expect(listCalls()).toBe(lists + 2);
      expect(Object.keys(await byId(account.id)).sort()).toEqual(["a", "b", "c"]);
    });

    it("lists the window instead when more than 500 things changed", async () => {
      seed("inc-many", [message("a", 1, ["INBOX"])]);
      const account = await connect("inc-many");
      await sync(account);
      for (let i = 0; i < 501; i++) gmail.addMessage("inc-many", message(`n${i}`, 0.5, ["INBOX"]));
      await expireThrottle(account.id);
      const lists = listCalls();

      expect(await sync(account)).toBe("synced");

      // Two pages of 100 for the inbox, which stops at 200 messages, and one for sent mail.
      expect(listCalls()).toBe(lists + 3);
    });

    it("drops a message deleted in Gmail even when too many changes sent sync back to the window", async () => {
      seed("inc-many-del", [message("old", 13, ["INBOX"])]);
      const account = await connect("inc-many-del");
      await sync(account);
      for (let i = 0; i < 501; i++)
        gmail.addMessage("inc-many-del", message(`n${i}`, 0.5 - i / 10_000, ["INBOX"]));
      gmail.deleteMessage("inc-many-del", "old");
      await expireThrottle(account.id);

      expect(await sync(account)).toBe("synced");

      expect((await byId(account.id)).old?.inInbox ?? false).toBe(false);
    });

    it("does not list the window again when archiving mail from a full cache", async () => {
      seed(
        "inc-refill",
        Array.from({ length: 250 }, (_, i) => message(`b${i}`, i * 0.04, ["INBOX"])),
      );
      const account = await connect("inc-refill");
      await sync(account);
      const inInbox = () =>
        prisma.cachedMailMessage.count({ where: { connectionId: account.id, inInbox: true } });
      expect(await inInbox()).toBe(200);

      modify("inc-refill", "b0", { removeLabelIds: ["INBOX"] });
      await expireThrottle(account.id);
      const lists = listCalls();
      expect(await sync(account)).toBe("synced");

      // The 50 older messages came in through the backfill; b0 is archived.
      expect(await inInbox()).toBe(249);
      expect((await byId(account.id)).b0?.inInbox).toBe(false);
      // Only the backfill of older mail lists, one inbox page, never the whole window.
      expect(listCalls() - lists).toBe(1);
    });

    it("keeps the cursor when some changed messages could not be fetched, and finishes next time", async () => {
      seed("inc-partial", [message("a", 1, ["INBOX"])]);
      const account = await connect("inc-partial");
      await sync(account);
      const first = await cursorOf(account.id);
      gmail.addMessage("inc-partial", message("ok", 0.5, ["INBOX"]));
      gmail.addMessage("inc-partial", message("limited", 0.4, ["INBOX"]));
      gmail.deleteMessage("inc-partial", "a");
      gmail.failNext(429, { times: 1000, urlIncludes: "messages/limited" });
      await expireThrottle(account.id);

      expect(await sync(account)).toBe("failed");

      expect(await cursorOf(account.id)).toBe(first);
      expect(Object.keys(await byId(account.id)).sort()).toEqual(["ok"]);
      expect((await state(account.id)).lastErrorAt).toBeNull();

      gmail.clearFailures();
      await expireThrottle(account.id);
      expect(await sync(account)).toBe("synced");
      expect(Object.keys(await byId(account.id)).sort()).toEqual(["limited", "ok"]);
      expect(await cursorOf(account.id)).not.toBe(first);
    });

    it("keeps the cursor when a change sync fails outright", async () => {
      seed("inc-fail", [message("a", 1, ["INBOX"])]);
      const account = await connect("inc-fail");
      await sync(account);
      const first = await cursorOf(account.id);
      gmail.addMessage("inc-fail", message("b", 0.5, ["INBOX"]));
      gmail.failNext(503, { times: 1000, urlIncludes: "/history" });
      await expireThrottle(account.id);

      expect(await sync(account)).toBe("failed");
      expect(await cursorOf(account.id)).toBe(first);
      expect((await state(account.id)).lastErrorAt).not.toBeNull();

      gmail.clearFailures();
      expect(await sync(account)).toBe("synced");
      expect(Object.keys(await byId(account.id)).sort()).toEqual(["a", "b"]);
    });
  });

  it("calls the provider once when two processes sync one account at the same time", async () => {
    seed("race", [message("a", 1, ["INBOX"])]);
    const account = await connect("race");
    const otherMail = providerFor(second.prisma);

    const results = await Promise.all([
      syncMailbox({ prisma, mail, jobs }, account, ctx("race-1")),
      syncMailbox({ prisma: second.prisma, mail: otherMail, jobs }, account, ctx("race-2")),
    ]);

    expect(results.sort()).toEqual(["skipped", "synced"]);
    // One inbox list and one sent list, not two of each.
    expect(listCalls()).toBe(2);
  });

  it("takes over a claim older than 5 minutes and the old sync then writes nothing", async () => {
    seed("stale", [message("a", 1, ["INBOX"])]);
    const account = await connect("stale");
    let releaseOld!: () => void;
    let releaseNew!: () => void;
    holds.set("stale-old", new Promise<void>((resolve) => (releaseOld = resolve)));
    holds.set("stale-new", new Promise<void>((resolve) => (releaseNew = resolve)));

    const oldSync = sync(account, "stale-old");
    await expect.poll(async () => (await state(account.id)).claimToken).not.toBeNull();
    const oldToken = (await state(account.id)).claimToken;
    await prisma.$executeRaw`UPDATE mail_sync_states SET "syncStartedAt" = now() - interval '6 minutes' WHERE "connectionId" = ${account.id}`;

    const newSync = sync(account, "stale-new");
    await expect.poll(async () => (await state(account.id)).claimToken).not.toBe(oldToken);
    const newToken = (await state(account.id)).claimToken;

    releaseOld();
    expect(await oldSync).toBe("skipped");
    // The old sync neither wrote rows nor cleared the new claim.
    expect(await rows(account.id)).toHaveLength(0);
    expect(await state(account.id)).toMatchObject({ claimToken: newToken });
    expect((await state(account.id)).syncStartedAt).not.toBeNull();

    releaseNew();
    expect(await newSync).toBe("synced");
    expect(await rows(account.id)).toHaveLength(1);
  });

  it("records a failure on one account and leaves the others intact", async () => {
    seed("good", [message("g", 1, ["INBOX"])]);
    const good = await connect("good");
    const bad = await connect("bad-no-mailbox");

    expect(await sync(good)).toBe("synced");
    expect(await sync(bad)).toBe("failed");

    const badState = await state(bad.id);
    expect(badState.lastErrorAt).not.toBeNull();
    expect(badState.lastSyncedAt).toBeNull();
    expect(badState.claimToken).toBeNull();
    expect(badState.syncStartedAt).toBeNull();
    expect((await state(good.id)).lastErrorAt).toBeNull();
    expect(await rows(good.id)).toHaveLength(1);
    // A failure does not start the 60-second throttle, so retrying is allowed at once.
    expect(await sync(bad)).toBe("failed");
  });

  it("gives up at the deadline without recording a failure and releases the claim", async () => {
    seed("slow", [message("a", 1, ["INBOX"])]);
    const account = await connect("slow");
    holds.set("slow-op", new Promise<void>(() => {}));

    expect(await sync(account, "slow-op", { deadlineMs: 50 })).toBe("failed");

    const after = await state(account.id);
    expect(after.lastErrorAt).toBeNull();
    expect(after.lastErrorKind).toBeNull();
    expect(after.lastSyncedAt).toBeNull();
    expect(after.claimToken).toBeNull();
    expect(await rows(account.id)).toHaveLength(0);
  });

  describe("a window larger than one deadline", () => {
    const bulk = (count: number, label: string) =>
      Array.from({ length: count }, (_, i) =>
        message(`${label}-${i}`, 1 + i / 1000, [label === "in" ? "INBOX" : "SENT"]),
      );
    afterEach(() => {
      getDelayMs = 0;
      answerLateUrl = undefined;
      throwLate = undefined;
    });
    const nextRun = (connectionId: string) =>
      prisma.mailSyncState.updateMany({ where: { connectionId }, data: { backoffUntil: null } });

    it("does not list sent mail or record a failure when the deadline hits during the inbox", async () => {
      seed("deadline-inbox", bulk(150, "in"));
      const account = await connect("deadline-inbox");
      getDelayMs = 10;

      expect(await sync(account, "op", { deadlineMs: 200 })).toBe("failed");

      const after = await state(account.id);
      expect(after.lastErrorAt).toBeNull();
      expect(after.lastErrorKind).toBeNull();
      expect(after.lastSyncedAt).toBeNull();
      expect(after.claimToken).toBeNull();
      expect(gmail.requests.some((r) => /messages\?.*sent/.test(r.url))).toBe(false);
      expect((await rows(account.id)).length).toBeGreaterThan(0);
    });

    it("records an auth failure that arrives after the deadline", async () => {
      seed("late-401", [message("a", 1, ["INBOX"])]);
      const account = await connect("late-401");
      answerLateUrl = "/profile";
      gmail.failNext(401, { times: 1000 });

      expect(await sync(account, "op", { deadlineMs: 50 })).toBe("failed");

      const after = await state(account.id);
      expect(after.lastErrorKind).toBe("auth");
      expect(after.needsReconnect).toBe(true);
    });

    it("leaves the state alone when the caller cancels during hydration", async () => {
      seed("cancel", bulk(150, "in"));
      const account = await connect("cancel");
      getDelayMs = 10;
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 100);

      const outcome = await syncMailbox(
        { prisma, mail, jobs },
        account,
        ctx("op", controller.signal),
      );

      expect(outcome).toBe("skipped");
      const after = await state(account.id);
      expect(after.lastErrorAt).toBeNull();
      expect(after.backoffUntil).toBeNull();
      expect(after.claimToken).toBeNull();
    });

    it("records a connector crash that happens after the deadline", async () => {
      seed("late-crash", [message("a", 1, ["INBOX"])]);
      const account = await connect("late-crash");
      throwLate = { url: "/profile", error: () => new TypeError("connector bug") };

      expect(await sync(account, "op", { deadlineMs: 50 })).toBe("failed");

      const after = await state(account.id);
      expect(after.lastErrorAt).not.toBeNull();
      expect(after.lastErrorKind).toBe("unavailable");
    });

    it("keeps the inbox it listed when the deadline ends the sent list", async () => {
      seed("late-sent", [...bulk(5, "in"), ...bulk(5, "sent")]);
      const account = await connect("late-sent");
      throwLate = { url: "in%3Asent", error: () => new DOMException("aborted", "AbortError") };

      expect(await sync(account, "op", { deadlineMs: 300 })).toBe("failed");

      const after = await state(account.id);
      expect(after.lastErrorAt).toBeNull();
      expect(after.lastSyncedAt).toBeNull();
      expect(after.changeCursor).toBeNull();
      expect(await rows(account.id)).toHaveLength(5);
    });

    it("records a 503 that arrives after the deadline while hydrating", async () => {
      seed("late-503", bulk(5, "in"));
      const account = await connect("late-503");
      answerLateUrl = "messages/in-0";
      gmail.failNext(503, { times: 1000, urlIncludes: "messages/in-0" });

      expect(await sync(account, "op", { deadlineMs: 100 })).toBe("failed");

      const after = await state(account.id);
      expect(after.lastErrorKind).toBe("unavailable");
      expect(after.lastErrorAt).not.toBeNull();
    });

    it("gives a full window re-list a longer deadline than an incremental sync", async () => {
      seed("long", [...bulk(200, "in"), ...bulk(200, "sent")]);
      const account = await connect("long");
      getDelayMs = 10;
      const timers: number[] = [];
      const realSetTimeout = globalThis.setTimeout;
      const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
        fn: () => void,
        ms?: number,
        ...rest: unknown[]
      ) => {
        if (ms && ms >= 90_000) timers.push(ms);
        return realSetTimeout(fn, ms, ...rest);
      }) as typeof setTimeout);
      try {
        expect(await sync(account)).toBe("synced");
        expect(await rows(account.id)).toHaveLength(400);
        expect(timers[0]).toBe(90_000);
        expect(timers[1]).toBeGreaterThan(230_000);
        expect(timers[1]).toBeLessThanOrEqual(240_000);

        timers.length = 0;
        await expireThrottle(account.id);
        expect(await sync(account)).toBe("synced");
        expect(timers).toEqual([90_000]);
      } finally {
        spy.mockRestore();
      }
    });

    it("stays incomplete without an error when too slow, then finishes with fresh labels", async () => {
      seed("slow-window", [...bulk(200, "in"), ...bulk(200, "sent")]);
      const account = await connect("slow-window");
      getDelayMs = 10;
      expect(await sync(account, "op", { deadlineMs: 300 })).toBe("failed");
      const first = await state(account.id);
      expect(first.lastErrorKind).toBeNull();
      expect(first.lastErrorAt).toBeNull();
      expect(first.lastSyncedAt).toBeNull();

      gmail.handle(
        "slow-window",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/in-0/modify",
        "POST",
        { addLabelIds: ["STARRED"], removeLabelIds: ["INBOX"] },
      );
      await nextRun(account.id);
      expect(await sync(account)).toBe("synced");
      expect((await state(account.id)).lastSyncedAt).not.toBeNull();
      const inboxFlags = new Map(
        (await rows(account.id)).map((r) => [r.providerMessageId, r.inInbox]),
      );
      expect(inboxFlags.get("in-0")).toBe(false);
      expect(inboxFlags.get("in-1")).toBe(true);
    });
  });

  it("keeps what a rate-limited sync hydrated, clears nothing and reports a failure", async () => {
    seed("partial", [message("ok", 1, ["INBOX"]), message("limited", 2, ["INBOX"])]);
    const account = await connect("partial");
    await prisma.cachedMailMessage.create({
      data: {
        spaceId,
        userId,
        connectionId: account.id,
        providerMessageId: "earlier",
        threadId: "earlier",
        fromAddress: "x@example.test",
        subject: "earlier",
        snippet: "",
        receivedAt: new Date(Date.now() - 5 * DAY),
        unread: false,
        inInbox: true,
        seenAt: new Date(),
      },
    });
    gmail.failNext(429, { times: 1000, urlIncludes: "messages/limited" });

    expect(await sync(account)).toBe("failed");

    const byId = Object.fromEntries((await rows(account.id)).map((r) => [r.providerMessageId, r]));
    expect(byId.ok?.inInbox).toBe(true);
    expect(byId.limited).toBeUndefined();
    // The incomplete list proves nothing about "earlier", so it stays in the inbox.
    expect(byId.earlier?.inInbox).toBe(true);
  });

  it("does not record an incomplete sync as a failure, but waits before calling Gmail again", async () => {
    seed("incomplete", [message("ok", 1, ["INBOX"]), message("limited", 2, ["INBOX"])]);
    const account = await connect("incomplete");
    gmail.failNext(429, { times: 1000, urlIncludes: "messages/limited" });

    expect(await sync(account)).toBe("failed");

    const after = await state(account.id);
    expect(after.lastErrorAt).toBeNull();
    expect(after.needsReconnect).toBe(false);
    expect(after.lastSyncedAt).toBeNull();
    expect(after.claimToken).toBeNull();
    // A rate-limited sync backs off, so repeated page loads do not keep hitting Gmail.
    const before = listCalls();
    expect(await sync(account)).toBe("skipped");
    expect(listCalls()).toBe(before);
    // Once the pause is over the next sync calls the provider again.
    await prisma.mailSyncState.update({
      where: { connectionId: account.id },
      data: { backoffUntil: new Date(Date.now() - 1000) },
    });
    await sync(account);
    expect(listCalls()).toBeGreaterThan(before);
  });

  it("pauses syncing after a rate-limited failure, and a good sync clears the pause", async () => {
    seed("limited-list", [message("ok", 1, ["INBOX"])]);
    const account = await connect("limited-list");
    gmail.failNext(429, { times: 1000 });
    expect(await sync(account)).toBe("failed");
    expect((await state(account.id)).backoffUntil).not.toBeNull();
    const before = listCalls();
    expect(await sync(account)).toBe("skipped");
    expect(listCalls()).toBe(before);

    gmail.failNext(429, { times: 0 });
    await prisma.mailSyncState.update({
      where: { connectionId: account.id },
      data: { backoffUntil: new Date(Date.now() - 1000) },
    });
    expect(await sync(account)).toBe("synced");
    expect((await state(account.id)).backoffUntil).toBeNull();
  });

  it("clears an earlier failure when a later sync is only incomplete", async () => {
    seed("heals", [message("ok", 1, ["INBOX"]), message("limited", 2, ["INBOX"])]);
    const account = await connect("heals");
    gmail.failNext(401, { times: 1000 });
    expect(await sync(account)).toBe("failed");
    expect((await state(account.id)).lastErrorAt).not.toBeNull();

    gmail.failNext(429, { times: 1000, urlIncludes: "messages/limited" });
    expect(await sync(account)).toBe("failed");

    const after = await state(account.id);
    expect(after.lastErrorAt).toBeNull();
    expect(after.needsReconnect).toBe(false);
  });

  it("enqueues triage after an incomplete sync that stored rows, and not when it stored none", async () => {
    seed("incomplete-enqueue", [message("ok", 1, ["INBOX"]), message("limited", 2, ["INBOX"])]);
    const account = await connect("incomplete-enqueue");
    gmail.failNext(429, { times: 1000, urlIncludes: "messages/limited" });
    enqueued.length = 0;

    expect(await sync(account)).toBe("failed");
    expect(await rows(account.id)).toHaveLength(1);
    expect(enqueued).toEqual([
      {
        name: "inbox.triage",
        payload: { userId, spaceId },
        replaceKey: `inbox.triage:${spaceId}:${userId}`,
        maxAttempts: 3,
      },
    ]);

    seed("incomplete-empty", [message("only", 1, ["INBOX"])]);
    const empty = await connect("incomplete-empty");
    gmail.failNext(429, { times: 1000, urlIncludes: "messages/only" });
    enqueued.length = 0;
    expect(await sync(empty)).toBe("failed");
    expect(await rows(empty.id)).toHaveLength(0);
    expect(enqueued).toEqual([]);
  });

  it("marks an account whose Gmail login was refused as needing a reconnect, and clears it on success", async () => {
    seed("auth", [message("a", 1, ["INBOX"])]);
    const account = await connect("auth");
    gmail.failNext(401, { times: 1000 });

    expect(await sync(account)).toBe("failed");

    const refused = await state(account.id);
    expect(refused.lastErrorAt).not.toBeNull();
    expect(refused.needsReconnect).toBe(true);

    gmail.failNext(503, { times: 1000 });
    expect(await sync(account)).toBe("failed");
    const down = await state(account.id);
    expect(down.lastErrorAt).not.toBeNull();
    expect(down.needsReconnect).toBe(false);
    expect(down.lastErrorKind).toBe("unavailable");

    seed("auth", [message("a", 1, ["INBOX"])]);
    expect(await sync(account)).toBe("synced");
    const ok = await state(account.id);
    expect(ok.lastErrorAt).toBeNull();
    expect(ok.needsReconnect).toBe(false);
    expect(ok.lastErrorKind).toBeNull();
  });

  it("clears only rows newer than the oldest listed message when the list hits the cap", async () => {
    const many = Array.from({ length: 205 }, (_, i) =>
      message(`m${String(i).padStart(3, "0")}`, 0.5 + i * 0.05, ["INBOX"]),
    );
    seed("capped", many);
    const account = await connect("capped");
    const row = (id: string, days: number) => ({
      spaceId,
      userId,
      connectionId: account.id,
      providerMessageId: id,
      threadId: id,
      fromAddress: "x@example.test",
      subject: id,
      snippet: "",
      receivedAt: new Date(Date.now() - days * DAY),
      unread: false,
      inInbox: true,
      seenAt: new Date(),
      // Already fetched with headers, so the signal backfill leaves it alone.
      signalsVersion: MAIL_SIGNALS_VERSION,
    });
    await prisma.cachedMailMessage.createMany({
      // Newer than the oldest listed message but absent from the list: it left the inbox.
      // Older than the oldest listed message: beyond the cap, so the sync cannot tell.
      data: [row("deleted-newer", 3), row("beyond-cap", 12)],
    });

    expect(await sync(account)).toBe("synced");

    const byId = Object.fromEntries((await rows(account.id)).map((r) => [r.providerMessageId, r]));
    expect(byId["deleted-newer"]?.inInbox).toBe(false);
    expect(byId["beyond-cap"]?.inInbox).toBe(true);
    expect(
      (await rows(account.id)).filter((r) => r.inInbox && r.providerMessageId.startsWith("m")),
    ).toHaveLength(200);
  });

  it("prunes beyond 90 days: the inbox flag goes off and unseen archived rows are deleted", async () => {
    seed("expire", [message("a", 1, ["INBOX"])]);
    const account = await connect("expire");
    const cached = (id: string, receivedDaysAgo: number, seenDaysAgo: number, inInbox = false) => ({
      spaceId,
      userId,
      connectionId: account.id,
      providerMessageId: id,
      threadId: id,
      fromAddress: "x@example.test",
      subject: id,
      snippet: "",
      receivedAt: new Date(Date.now() - receivedDaysAgo * DAY),
      unread: false,
      inInbox,
      seenAt: new Date(Date.now() - seenDaysAgo * DAY),
    });
    await prisma.cachedMailMessage.createMany({
      data: [
        cached("stale-search", 120, 91),
        cached("fresh-search", 100, 89),
        cached("old-inbox", 95, 1, true),
        cached("recent-archived", 60, 40),
      ],
    });

    await sync(account);

    const stored = await rows(account.id);
    expect(stored.map((r) => r.providerMessageId).sort()).toEqual([
      "a",
      "fresh-search",
      "old-inbox",
      "recent-archived",
    ]);
    expect(stored.find((r) => r.providerMessageId === "old-inbox")?.inInbox).toBe(false);
  });

  describe("90-day window, paged", () => {
    const byId = async (connectionId: string) =>
      Object.fromEntries((await rows(connectionId)).map((r) => [r.providerMessageId, r]));
    const backfillOf = async (connectionId: string) => (await state(connectionId)).backfill;
    const spread = (count: number, spanDays: number, label: string, flags = ["INBOX"]) =>
      Array.from({ length: count }, (_, i) =>
        message(`${label}-${i}`, 0.5 + (i * spanDays) / count, flags),
      );
    const dayOf = (days: number) => daysAgo(days).slice(0, 10);

    it("bounds the work of every run and finishes the window over several runs", async () => {
      seed("bound", spread(350, 80, "in"));
      const account = await connect("bound");

      expect(await sync(account)).toBe("synced");
      expect(await rows(account.id)).toHaveLength(200);
      const marker = (await backfillOf(account.id)) as {
        inbox: string | null;
        sent: string | null;
      };
      expect(marker.inbox).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(marker.sent).toBeNull();

      for (const expected of [true, false]) {
        await expireThrottle(account.id);
        const gets = getCalls();
        const lists = listCalls();
        expect(await sync(account)).toBe("synced");
        // One inbox page of 100 at most; sent mail was complete.
        expect(listCalls() - lists).toBe(1);
        expect(getCalls() - gets).toBeLessThanOrEqual(100);
        expect((await backfillOf(account.id)) !== null).toBe(expected);
      }
      expect(await rows(account.id)).toHaveLength(350);
    });

    it("caches the rest of the window for a connection that synced before the migration", async () => {
      seed("existing", [message("recent", 1, ["INBOX"]), message("older", 40, ["INBOX"])]);
      const account = await connect("existing");
      await sync(account);
      // What the old release left: a change cursor, no backfill, and only the recent mail cached.
      await prisma.cachedMailMessage.deleteMany({
        where: { connectionId: account.id, providerMessageId: "older" },
      });
      expect(await backfillOf(account.id)).toBeNull();

      const migration = readFileSync(
        new URL(
          "../../db/prisma/migrations/20261114000000_mail_background_sync/migration.sql",
          import.meta.url,
        ),
        "utf8",
      );
      const seedSql = migration.slice(migration.indexOf("UPDATE")).replace(/;\s*$/, "");
      await prisma.$executeRawUnsafe(`${seedSql} AND "connectionId" = $1`, account.id);
      expect(await backfillOf(account.id)).toEqual({ inbox: dayOf(14), sent: dayOf(14) });

      await expireThrottle(account.id);
      expect(await sync(account)).toBe("synced");

      expect(Object.keys(await byId(account.id)).sort()).toEqual(["older", "recent"]);
      expect(await backfillOf(account.id)).toBeNull();
    });

    it("keeps inInbox for a message in both lists when its sent page arrives later", async () => {
      seed("both", [
        ...spread(250, 50, "in"),
        ...spread(250, 50, "sent", ["SENT"]),
        message("both", 75, ["INBOX", "SENT"]),
      ]);
      const account = await connect("both");
      await sync(account);
      expect((await byId(account.id)).both).toBeUndefined();

      await expireThrottle(account.id);
      expect(await sync(account)).toBe("synced");

      expect((await byId(account.id)).both).toMatchObject({ inInbox: true, fromSelf: true });
      expect(await backfillOf(account.id)).toBeNull();
    });

    it("clears an archived message inside a backfill page but nothing newer or older", async () => {
      seed("range", spread(350, 80, "in"));
      const account = await connect("range");
      await sync(account);
      const stale = (id: string, days: number) => ({
        spaceId,
        userId,
        connectionId: account.id,
        providerMessageId: id,
        threadId: id,
        fromAddress: "x@example.test",
        subject: id,
        snippet: "",
        receivedAt: new Date(Date.now() - days * DAY),
        unread: false,
        inInbox: true,
        signalsVersion: MAIL_SIGNALS_VERSION,
        seenAt: new Date(),
      });
      // The backfill page covers roughly days 46 to 69; these are not in Gmail's inbox.
      await prisma.cachedMailMessage.createMany({
        data: [stale("newer", 3.3), stale("inside", 58.1), stale("older", 79.9)],
      });

      await expireThrottle(account.id);
      expect(await sync(account)).toBe("synced");

      const stored = await byId(account.id);
      expect(stored.inside?.inInbox).toBe(false);
      expect(stored.newer?.inInbox).toBe(true);
      expect(stored.older?.inInbox).toBe(true);
    });

    it("moves on by a day when more than 100 messages share the marker day", async () => {
      const noon = (days: number) => new Date(`${dayOf(days)}T12:00:00Z`);
      const crowded = Array.from({ length: 250 }, (_, i) =>
        message(`day-${i}`, 0, ["INBOX"], {
          date: new Date(noon(40).getTime() - i * 60_000).toISOString(),
        }),
      );
      seed("crowd", [...spread(100, 10, "new"), ...crowded]);
      const account = await connect("crowd");
      await sync(account);
      expect((await backfillOf(account.id)) as unknown).toEqual({ inbox: dayOf(40), sent: null });

      await expireThrottle(account.id);
      await sync(account);
      const previousDay = new Date(noon(40).getTime() - DAY).toISOString().slice(0, 10);
      expect(await backfillOf(account.id)).toEqual({ inbox: previousDay, sent: null });

      await expireThrottle(account.id);
      await sync(account);
      expect(await backfillOf(account.id)).toBeNull();
    });

    it("does not fail the sync when the backfill errors, and keeps the marker", async () => {
      seed("bf-error", spread(350, 80, "in"));
      const account = await connect("bf-error");
      await sync(account);
      const before = await backfillOf(account.id);
      await expireThrottle(account.id);
      gmail.failNext(500, { times: 20, urlIncludes: "before" });

      expect(await sync(account)).toBe("synced");

      expect((await state(account.id)).lastErrorAt).toBeNull();
      expect(await backfillOf(account.id)).toEqual(before);
      gmail.clearFailures();
      await expireThrottle(account.id);
      await sync(account);
      // The page overlaps the marker day, so a little under 100 new messages arrive.
      expect((await rows(account.id)).length).toBeGreaterThan(285);
      expect((await rows(account.id)).length).toBeLessThanOrEqual(300);
    });

    it("takes at most 50 stale-signal rows per run across the window", async () => {
      const many = Array.from({ length: 120 }, (_, i) =>
        message(`s${String(i).padStart(3, "0")}`, 1 + i * 0.7, ["INBOX"]),
      );
      seed("wide-stale", many);
      const account = await connect("wide-stale");
      await sync(account);
      await prisma.$executeRaw`UPDATE mail_messages SET "signalsVersion" = 0, signals = NULL WHERE "connectionId" = ${account.id}`;
      await expireThrottle(account.id);
      const gets = getCalls();

      expect(await sync(account)).toBe("synced");

      expect(getCalls() - gets).toBe(50);
    });
  });

  it("does not sync a revoked connection", async () => {
    seed("revoked", [message("a", 1, ["INBOX"])]);
    const account = await connect("revoked");
    await prisma.connection.update({ where: { id: account.id }, data: { status: "revoked" } });

    expect(await sync(account)).toBe("skipped");
    expect(await rows(account.id)).toHaveLength(0);
    expect(gmail.requests.some((r) => r.url.includes("/messages"))).toBe(false);
  });

  it("deleteMailConnectionData removes one connection's rows and state and nothing else", async () => {
    seed("del-a", [message("a", 1, ["INBOX"])]);
    const target = await connect("del-a");
    seed("del-b", [message("b", 1, ["INBOX"])]);
    const other = await connect("del-b");
    await sync(other);
    seed("del-a", [message("a", 1, ["INBOX"])]);
    await sync(target);

    await prisma.$transaction((tx) =>
      deleteMailConnectionData(tx, { spaceId, userId, connectionId: target.id }),
    );

    expect(await rows(target.id)).toHaveLength(0);
    expect(
      await prisma.mailSyncState.findUnique({ where: { connectionId: target.id } }),
    ).toBeNull();
    expect(await rows(other.id)).toHaveLength(1);
    expect(
      await prisma.mailSyncState.findUnique({ where: { connectionId: other.id } }),
    ).not.toBeNull();
  });

  it("deleteMailConnectionData removes the connection's to-dos, done ones included, and keeps others", async () => {
    seed("todo-a", [message("a", 1, ["INBOX"])]);
    const target = await connect("todo-a");
    seed("todo-b", [message("b", 1, ["INBOX"])]);
    const other = await connect("todo-b");
    const todo = (connectionId: string, extra: { doneAt?: Date } = {}) =>
      prisma.inboxTodo.create({
        data: { spaceId, userId, connectionId, text: "Reply to Ann", ...extra },
      });
    await todo(target.id);
    await todo(target.id, { doneAt: new Date() });
    await todo(other.id);

    await prisma.$transaction((tx) =>
      deleteMailConnectionData(tx, { spaceId, userId, connectionId: target.id }),
    );

    expect(await prisma.inboxTodo.count({ where: { connectionId: target.id } })).toBe(0);
    expect(await prisma.inboxTodo.count({ where: { connectionId: other.id } })).toBe(1);
  });

  it("allows one to-do per message and keeps the to-do, with no message, when the message is pruned", async () => {
    seed("todo-key", [message("a", 1, ["INBOX"])]);
    const account = await connect("todo-key");
    await sync(account);
    const [cached] = await rows(account.id);
    const data = {
      spaceId,
      userId,
      connectionId: account.id,
      messageId: cached?.id,
      text: "Reply",
    };
    await prisma.inboxTodo.create({ data });

    await expect(prisma.inboxTodo.create({ data })).rejects.toThrow();

    await prisma.cachedMailMessage.delete({ where: { id: cached?.id } });
    const todo = await prisma.inboxTodo.findFirstOrThrow({ where: { connectionId: account.id } });
    expect(todo.messageId).toBeNull();
    // Many to-dos without a message are fine: Postgres treats NULLs as distinct.
    await prisma.inboxTodo.create({ data: { ...data, messageId: null } });
  });

  it("does not delete to-dos when the scope does not match", async () => {
    seed("todo-scoped", [message("a", 1, ["INBOX"])]);
    const account = await connect("todo-scoped");
    await prisma.inboxTodo.create({
      data: { spaceId, userId, connectionId: account.id, text: "Reply to Ann" },
    });

    await prisma.$transaction((tx) =>
      deleteMailConnectionData(tx, {
        spaceId,
        userId: `someone-else-${randomUUID()}`,
        connectionId: account.id,
      }),
    );

    expect(await prisma.inboxTodo.count({ where: { connectionId: account.id } })).toBe(1);
  });

  it("does not delete another user's connection data when the scope does not match", async () => {
    seed("scoped", [message("a", 1, ["INBOX"])]);
    const account = await connect("scoped");
    await sync(account);

    await prisma.$transaction((tx) =>
      deleteMailConnectionData(tx, {
        spaceId,
        userId: `someone-else-${randomUUID()}`,
        connectionId: account.id,
      }),
    );

    expect(await rows(account.id)).toHaveLength(1);
    expect(
      await prisma.mailSyncState.findUnique({ where: { connectionId: account.id } }),
    ).not.toBeNull();
  });

  it("writes nothing when the connection is revoked while a sync is in flight", async () => {
    seed("revoke-mid", [message("a", 1, ["INBOX"])]);
    const account = await connect("revoke-mid");
    let release!: () => void;
    holds.set("revoke-mid-op", new Promise<void>((resolve) => (release = resolve)));

    const inFlight = sync(account, "revoke-mid-op");
    await expect.poll(async () => (await state(account.id)).claimToken).not.toBeNull();
    await prisma.$transaction(async (tx) => {
      await tx.connection.update({ where: { id: account.id }, data: { status: "revoked" } });
      await deleteMailConnectionData(tx, { spaceId, userId, connectionId: account.id });
    });
    release();

    expect(await inFlight).toBe("skipped");
    expect(await rows(account.id)).toHaveLength(0);
    expect(
      await prisma.mailSyncState.findUnique({ where: { connectionId: account.id } }),
    ).toBeNull();
  });

  describe("signals, backfill, sender stats and piles", () => {
    const newsletter = (id: string, days: number, extra: Partial<EmulatedMessage> = {}) =>
      message(id, days, ["INBOX", "CATEGORY_PROMOTIONS"], {
        from: "Weekly <weekly@news.example.test>",
        subject: "Five things",
        headers: [
          { name: "List-Unsubscribe", value: "<https://news.example.test/u/abc>" },
          { name: "List-Id", value: "Weekly <weekly.news.example.test>" },
          {
            name: "Authentication-Results",
            value: "mx.google.com; dkim=pass header.i=@news.example.test; spf=pass; dmarc=pass",
          },
        ],
        ...extra,
      });
    const byId = async (connectionId: string) =>
      Object.fromEntries((await rows(connectionId)).map((r) => [r.providerMessageId, r]));
    const makeStale = (connectionId: string) =>
      prisma.$executeRaw`UPDATE mail_messages SET "signalsVersion" = 0, signals = NULL WHERE "connectionId" = ${connectionId}`;
    const versions = async (connectionId: string) =>
      (await rows(connectionId)).filter((r) => r.signalsVersion === MAIL_SIGNALS_VERSION);
    /** Points the stored cursor at Gmail's latest change, so the next sync sees no changes. */
    const catchUpCursor = async (account: MailAccount) => {
      const cursor = await mail.getCursor(account, ctx());
      await prisma.mailSyncState.update({
        where: { connectionId: account.id },
        data: { changeCursor: cursor },
      });
    };

    it("stores signals, signalsVersion and isSpam for listed messages", async () => {
      seed("sig", [newsletter("n1", 1), message("plain", 2, ["INBOX"])]);
      const account = await connect("sig");

      expect(await sync(account)).toBe("synced");

      const stored = await byId(account.id);
      expect(stored.n1).toMatchObject({
        signalsVersion: MAIL_SIGNALS_VERSION,
        isSpam: false,
        signals: {
          listUnsubscribe: ["https://news.example.test/u/abc"],
          listId: "Weekly <weekly.news.example.test>",
          auth: { dkim: "pass", spf: "pass", dmarc: "pass" },
          categories: { promotions: true, spam: false },
        },
      });
      expect(stored.plain?.signalsVersion).toBe(MAIL_SIGNALS_VERSION);
    });

    it("maintains sender stats and resolves prior contact from the lookup and from sent mail", async () => {
      seed("stats", [
        message("a1", 1, ["INBOX", "UNREAD"], { from: "Ann <ann@example.test>" }),
        message("a2", 2, ["INBOX"], { from: "Ann <ann@example.test>" }),
        message("b1", 3, ["INBOX"], { from: "Bob <bob@example.test>" }),
        message("sent", 4, ["SENT"], { from: "me@example.test", to: "bob@example.test" }),
      ]);
      const account = await connect("stats");

      expect(await sync(account)).toBe("synced");

      const stats = await prisma.mailSenderStat.findMany({
        where: { connectionId: account.id },
        orderBy: { senderAddress: "asc" },
      });
      expect(
        stats.map((s) => [s.senderAddress, s.messageCount, s.readCount, s.priorContact]),
      ).toEqual([
        ["ann@example.test", 2, 1, false],
        ["bob@example.test", 1, 1, true],
      ]);
      expect(stats.every((s) => s.spaceId === spaceId && s.userId === userId)).toBe(true);
      // The lookup ran for both senders, and its result for Bob agrees with his sent mail.
      expect(stats[0]?.priorContactCheckedAt).not.toBeNull();
    });

    it("fetches rows with an older signalsVersion again, 50 per sync and by id, until none are left", async () => {
      const many = Array.from({ length: 120 }, (_, i) =>
        message(`m${String(i).padStart(3, "0")}`, 0.5 + i * 0.05, ["INBOX"]),
      );
      seed("backfill", many);
      const account = await connect("backfill");
      await sync(account);
      await makeStale(account.id);
      expect(await versions(account.id)).toHaveLength(0);

      await expireThrottle(account.id);
      const gets = getCalls();
      const lists = listCalls();
      expect(await sync(account)).toBe("synced");

      const fixed = await versions(account.id);
      expect(fixed).toHaveLength(50);
      expect(getCalls() - gets).toBe(50);
      expect(listCalls()).toBe(lists);
      // The newest rows come first.
      expect(fixed.map((r) => r.providerMessageId).sort()).toEqual(
        many.slice(0, 50).map((m) => m.id),
      );
      expect(fixed.every((r) => r.signals !== null)).toBe(true);

      await expireThrottle(account.id);
      await sync(account);
      expect(await versions(account.id)).toHaveLength(100);
      await expireThrottle(account.id);
      await sync(account);
      expect(await versions(account.id)).toHaveLength(120);

      await expireThrottle(account.id);
      const settled = getCalls();
      await sync(account);
      expect(getCalls()).toBe(settled);
    });

    it("drops a stale row whose message was trashed in the meantime", async () => {
      seed("backfill-trash", [message("keep", 1, ["INBOX"]), message("trashed", 2, ["INBOX"])]);
      const account = await connect("backfill-trash");
      await sync(account);
      await makeStale(account.id);
      gmail.handle(
        "backfill-trash",
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/trashed/modify",
        "POST",
        { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] },
      );
      await catchUpCursor(account);
      await expireThrottle(account.id);

      expect(await sync(account)).toBe("synced");

      const stored = await byId(account.id);
      expect(Object.keys(stored)).toEqual(["keep"]);
      expect(stored.keep?.signalsVersion).toBe(MAIL_SIGNALS_VERSION);
    });

    it("leaves stale rows as they are and the outcome unchanged when a rate limit hits the backfill", async () => {
      seed("backfill-limit", [message("a", 1, ["INBOX"]), message("b", 2, ["INBOX"])]);
      const account = await connect("backfill-limit");
      await sync(account);
      await makeStale(account.id);
      gmail.failNext(429, { times: 1000, urlIncludes: "/messages/" });
      await expireThrottle(account.id);

      expect(await sync(account)).toBe("synced");

      expect(await versions(account.id)).toHaveLength(0);
      expect((await state(account.id)).lastErrorAt).toBeNull();
      gmail.clearFailures();
      await expireThrottle(account.id);
      await sync(account);
      expect(await versions(account.id)).toHaveLength(2);
    });

    it("writes the rule pile with no model configured, and recomputes it after a sender mark changes", async () => {
      seed("piles", [
        newsletter("news", 1),
        message("friend", 2, ["INBOX"], { from: "Pal <pal@example.test>", subject: "Weekend?" }),
        message("sent", 3, ["SENT"], { from: "me@example.test", to: "pal@example.test" }),
        message("other", 4, ["INBOX"], { from: "Kim <kim@example.test>", subject: "Hello" }),
      ]);
      const account = await connect("piles");

      expect(await sync(account)).toBe("synced");

      const first = await byId(account.id);
      expect(first.news).toMatchObject({
        rulePile: "newsletters",
        pile: "newsletters",
        ruleReasons: ["promotions", "list_unsubscribe", "list_id"],
      });
      expect(first.friend).toMatchObject({ rulePile: "important", ruleReasons: ["prior_contact"] });
      // Nothing for the rules to go on: the model decides later.
      expect(first.other).toMatchObject({ rulePile: null, pile: null });

      await prisma.inboxSenderFeedback.create({
        data: { spaceId, userId, senderAddress: "weekly@news.example.test", mark: "important" },
      });
      await expireThrottle(account.id);
      expect(await sync(account)).toBe("synced");

      expect((await byId(account.id)).news).toMatchObject({
        rulePile: "important",
        ruleReasons: ["marked_important"],
      });
      await prisma.inboxSenderFeedback.deleteMany({ where: { spaceId, userId } });
    });

    it("leaves a bulk sender with unknown prior contact to the model, and decides it once the lookup works", async () => {
      seed("unknown-prior", [newsletter("news", 1)]);
      const account = await connect("unknown-prior");
      gmail.failNext(429, { times: 1000, urlIncludes: "to%3A%22" });

      expect(await sync(account)).toBe("synced");

      expect((await byId(account.id)).news).toMatchObject({
        rulePile: null,
        ruleReasons: ["prior_contact_unknown"],
      });
      const unchecked = await prisma.mailSenderStat.findFirstOrThrow({
        where: { connectionId: account.id },
      });
      expect(unchecked).toMatchObject({ priorContact: null, priorContactCheckedAt: null });

      gmail.clearFailures();
      await expireThrottle(account.id);
      expect(await sync(account)).toBe("synced");

      expect((await byId(account.id)).news).toMatchObject({
        rulePile: "newsletters",
        pile: "newsletters",
      });
    });

    it("does not add searched sent mail to the cache", async () => {
      seed("lookup-cache", [newsletter("news", 1)]);
      const account = await connect("lookup-cache");
      await sync(account);
      expect(Object.keys(await byId(account.id))).toEqual(["news"]);
    });

    it("deleteMailConnectionData removes that connection's sender stats only", async () => {
      seed("del-stats-a", [newsletter("a", 1)]);
      const a = await connect("del-stats-a");
      const b = await connect("del-stats-b");
      await sync(a);
      await prisma.mailSenderStat.create({
        data: { spaceId, userId, connectionId: b.id, senderAddress: "keep@example.test" },
      });

      await prisma.$transaction((tx) =>
        deleteMailConnectionData(tx, { spaceId, userId, connectionId: a.id }),
      );

      expect(await prisma.mailSenderStat.count({ where: { connectionId: a.id } })).toBe(0);
      expect(await prisma.mailSenderStat.count({ where: { connectionId: b.id } })).toBe(1);
    });
  });

  describe("metadata cache in listMessages", () => {
    const three = [
      message("c1", 1, ["INBOX"]),
      message("c2", 2, ["INBOX"]),
      message("c3", 3, ["INBOX", "UNREAD"]),
    ];

    it("hydrates only ids it has not seen and never marks them as inbox rows", async () => {
      seed("cache", three);
      const account = await connect("cache");
      const request = { query: "", pageSize: 10 };

      const first = await mail.listMessages(account, request, ctx());
      expect(getCalls()).toBe(3);
      const calls = gmail.requests.length;

      const again = await mail.listMessages(account, request, ctx());
      expect(gmail.requests.length - calls).toBe(1); // only the id list
      expect(again.messages.map((m) => m.id)).toEqual(first.messages.map((m) => m.id));
      expect(again.messages.find((m) => m.id === "c3")).toMatchObject({
        unread: true,
        subject: "Subject c3",
        from: { name: "Ann Sender", address: "ann@example.test" },
        to: [{ address: "me@example.test" }],
      });
      expect((await rows(account.id)).every((r) => !r.inInbox)).toBe(true);
    });

    it("always hydrates and writes nothing when useCache is false", async () => {
      seed("nocache", three);
      const account = await connect("nocache");
      const request = { query: "", pageSize: 10, useCache: false };

      await mail.listMessages(account, request, ctx());
      await mail.listMessages(account, request, ctx());

      expect(getCalls()).toBe(6);
      expect(await rows(account.id)).toHaveLength(0);
    });

    it("never serves one connection's cached row to another connection with the same message id", async () => {
      seed("iso-a", [message("same-id", 1, ["INBOX"], { subject: "Mailbox A" })]);
      const first = await connect("iso-a");
      await mail.listMessages(first, { query: "", pageSize: 10 }, ctx());
      seed("iso-b", [message("same-id", 1, ["INBOX"], { subject: "Mailbox B" })]);
      const second = await connect("iso-b");

      const page = await mail.listMessages(second, { query: "", pageSize: 10 }, ctx());

      expect(page.messages.map((m) => m.subject)).toEqual(["Mailbox B"]);
      expect(getCalls()).toBe(1);
    });

    it("does not overwrite sync state when a search sees a synced message", async () => {
      seed("keep", [message("k1", 1, ["INBOX"])]);
      const account = await connect("keep");
      await sync(account);
      await prisma.cachedMailMessage.updateMany({
        where: { connectionId: account.id },
        data: { needsReply: true },
      });

      await mail.listMessages(account, { query: "", pageSize: 10 }, ctx());

      expect(await rows(account.id)).toMatchObject([{ inInbox: true, needsReply: true }]);
    });
  });
});
