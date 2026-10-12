import { randomUUID } from "node:crypto";
import type {
  AdapterContext,
  ConnectorProxyRequest,
  ConnectorProxyResponse,
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
  const sync = (account: MailAccount, operationId = "op", extra = {}) =>
    syncMailbox({ prisma, mail, ...extra }, account, ctx(operationId));
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

    seed("leave", [message("stay", 1, ["INBOX"]), message("gone", 2, [])]);
    await expireThrottle(account.id);
    expect(await sync(account)).toBe("synced");

    const byId = Object.fromEntries((await rows(account.id)).map((r) => [r.providerMessageId, r]));
    expect(byId.gone?.inInbox).toBe(false);
    expect(byId.stay).toMatchObject({ inInbox: true, needsReply: true });
  });

  it("calls the provider once when two processes sync one account at the same time", async () => {
    seed("race", [message("a", 1, ["INBOX"])]);
    const account = await connect("race");
    const otherMail = providerFor(second.prisma);

    const results = await Promise.all([
      syncMailbox({ prisma, mail }, account, ctx("race-1")),
      syncMailbox({ prisma: second.prisma, mail: otherMail }, account, ctx("race-2")),
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
    expect((await state(account.id)).lastErrorAt).not.toBeNull();
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
