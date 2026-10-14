import { randomUUID } from "node:crypto";
import type {
  AdapterContext,
  BackgroundJob,
  ConnectorProxyRequest,
  ConnectorProxyResponse,
  JobPublisher,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  const listCalls = () => gmail.requests.filter((r) => /\/messages\?/.test(r.url)).length;
  const getCalls = () => gmail.requests.filter((r) => /\/messages\/[^?]/.test(r.url)).length;

  const connector = {
    proxy: async (
      request: ConnectorProxyRequest,
      context: AdapterContext,
    ): Promise<ConnectorProxyResponse> => {
      const hold = holds.get(context.operationId);
      if (hold) {
        await Promise.race([
          hold,
          new Promise<void>((resolve) =>
            context.signal.addEventListener("abort", () => resolve(), { once: true }),
          ),
        ]);
        if (context.signal.aborted) throw new Error("aborted");
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
    prisma.$executeRaw`UPDATE mail_sync_states SET "lastSyncedAt" = now() - interval '5 minutes' WHERE "connectionId" = ${connectionId}`;
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

  it("syncs the inbox and sent mail of the last 14 days on the first run", async () => {
    seed("first", [
      message("in-1", 1, ["INBOX", "UNREAD"]),
      message("in-old", 20, ["INBOX"]),
      message("sent-1", 2, ["SENT"], { from: "me@example.test", to: "ann@example.test" }),
      message("both", 3, ["INBOX", "SENT"]),
    ]);
    const account = await connect("first");

    expect(await sync(account)).toBe("synced");

    const byId = Object.fromEntries((await rows(account.id)).map((r) => [r.providerMessageId, r]));
    expect(Object.keys(byId).sort()).toEqual(["both", "in-1", "sent-1"]);
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

    it("removes a message that moved to trash or spam and keeps sent mail it sees", async () => {
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
      expect(Object.keys(rowsNow)).toEqual(["out"]);
      expect(rowsNow.out).toMatchObject({ inInbox: false, fromSelf: true });
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

    it("refills the inbox from older mail when archiving leaves the cache below its cap", async () => {
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
      expect(await sync(account)).toBe("synced");

      expect(await inInbox()).toBe(200);
      expect((await byId(account.id)).b0?.inInbox).toBe(false);
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

  it("takes over a claim older than 2 minutes and the old sync then writes nothing", async () => {
    seed("stale", [message("a", 1, ["INBOX"])]);
    const account = await connect("stale");
    let releaseOld!: () => void;
    let releaseNew!: () => void;
    holds.set("stale-old", new Promise<void>((resolve) => (releaseOld = resolve)));
    holds.set("stale-new", new Promise<void>((resolve) => (releaseNew = resolve)));

    const oldSync = sync(account, "stale-old");
    await expect.poll(async () => (await state(account.id)).claimToken).not.toBeNull();
    const oldToken = (await state(account.id)).claimToken;
    await prisma.$executeRaw`UPDATE mail_sync_states SET "syncStartedAt" = now() - interval '3 minutes' WHERE "connectionId" = ${account.id}`;

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

  it("gives up at the deadline, records the failure and releases the claim", async () => {
    seed("slow", [message("a", 1, ["INBOX"])]);
    const account = await connect("slow");
    holds.set("slow-op", new Promise<void>(() => {}));

    expect(await sync(account, "slow-op", { deadlineMs: 50 })).toBe("failed");

    const after = await state(account.id);
    expect(after.lastErrorAt).not.toBeNull();
    expect(after.claimToken).toBeNull();
    expect(await rows(account.id)).toHaveLength(0);
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

  it("does not record an incomplete sync as a failure, and still allows an immediate retry", async () => {
    seed("incomplete", [message("ok", 1, ["INBOX"]), message("limited", 2, ["INBOX"])]);
    const account = await connect("incomplete");
    gmail.failNext(429, { times: 1000, urlIncludes: "messages/limited" });

    expect(await sync(account)).toBe("failed");

    const after = await state(account.id);
    expect(after.lastErrorAt).toBeNull();
    expect(after.needsReconnect).toBe(false);
    expect(after.lastSyncedAt).toBeNull();
    expect(after.claimToken).toBeNull();
    // Nothing started the 60-second throttle, so the next sync calls the provider again.
    const before = listCalls();
    await sync(account);
    expect(listCalls()).toBeGreaterThan(before);
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

    seed("auth", [message("a", 1, ["INBOX"])]);
    expect(await sync(account)).toBe("synced");
    const ok = await state(account.id);
    expect(ok.lastErrorAt).toBeNull();
    expect(ok.needsReconnect).toBe(false);
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

  it("deletes search-cached rows unseen for 14 days and keeps recent ones", async () => {
    seed("expire", [message("a", 1, ["INBOX"])]);
    const account = await connect("expire");
    const cached = (id: string, seenDaysAgo: number) => ({
      spaceId,
      userId,
      connectionId: account.id,
      providerMessageId: id,
      threadId: id,
      fromAddress: "x@example.test",
      subject: id,
      snippet: "",
      receivedAt: new Date(Date.now() - 100 * DAY),
      unread: false,
      seenAt: new Date(Date.now() - seenDaysAgo * DAY),
    });
    await prisma.cachedMailMessage.createMany({
      data: [cached("stale-search", 15), cached("fresh-search", 1)],
    });

    await sync(account);

    const ids = (await rows(account.id)).map((r) => r.providerMessageId).sort();
    expect(ids).toEqual(["a", "fresh-search"]);
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
