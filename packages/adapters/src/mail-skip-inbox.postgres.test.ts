import type {
  AdapterContext,
  ConnectorProxyRequest,
  JobPublisher,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { MailSignals } from "@rakazo/contracts";
import { MAIL_SIGNALS_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type EmulatedMessage, GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { applySkipInbox } from "./mail-skip-inbox.js";
import { deleteMailConnectionData } from "./mail-sync.js";
import { runMailSyncJob } from "./mail-sync-job.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const quiet: MailSignals = {
  listUnsubscribe: ["https://lists.example.test/u/1"],
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

describePostgres("skip inbox (PostgreSQL + Gmail emulator)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `skip-user-${suffix}`;
  const otherUserId = `skip-other-${suffix}`;
  const organizationId = `skip-org-${suffix}`;
  const spaceId = `skip-space-${suffix}`;
  const otherSpaceId = `skip-space2-${suffix}`;
  const SENDER = "news@lists.example.test";
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let gmail: GmailApiEmulator;

  const connector = {
    proxy: async (request: ConnectorProxyRequest, _context: AdapterContext) =>
      gmail.handle(request.accountRef, request.url, request.method, request.body),
  } as unknown as ManagedConnectorProvider;
  let mail: ReturnType<typeof createMailProvider>;

  const context = (): AdapterContext => ({
    operationId: "skip",
    traceId: "skip",
    spaceId,
    userId,
    signal: new AbortController().signal,
  });
  const modifyCalls = () => gmail.requests.filter((r) => r.url.includes("/modify")).length;

  async function connect(ref: string, owner = { spaceId, userId }): Promise<MailAccount> {
    const row = await prisma.connection.create({
      data: {
        ...owner,
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
      ...owner,
      address: `${ref}@example.test`,
    };
  }
  const seed = (ref: string, ids: string[], from = SENDER) => {
    gmail = new GmailApiEmulator({
      mailboxes: {
        [ref]: {
          address: `${ref}@example.test`,
          messages: ids.map(
            (id): EmulatedMessage => ({
              id,
              date: daysAgo(1).toISOString(),
              labels: ["INBOX"],
              from: `News <${from}>`,
              to: "me@example.test",
              subject: `Subject ${id}`,
            }),
          ),
        },
      },
    });
  };
  async function cache(
    account: MailAccount,
    id: string,
    extra: Partial<{
      from: string;
      receivedAt: Date;
      pile: string | null;
      category: string | null;
      isSpam: boolean;
      signals: MailSignals;
      skipAppliedAt: Date | null;
      inInbox: boolean;
      threadId: string;
    }> = {},
  ) {
    return prisma.cachedMailMessage.create({
      data: {
        spaceId: account.spaceId,
        userId: account.userId,
        connectionId: account.id,
        providerMessageId: id,
        threadId: extra.threadId ?? id,
        fromAddress: extra.from ?? SENDER,
        subject: `Subject ${id}`,
        snippet: "",
        receivedAt: extra.receivedAt ?? daysAgo(0.5),
        unread: true,
        inInbox: extra.inInbox ?? true,
        isSpam: extra.isSpam ?? false,
        pile: extra.pile ?? null,
        category: extra.category ?? null,
        skipAppliedAt: extra.skipAppliedAt ?? null,
        seenAt: new Date(),
        signals: extra.signals ?? quiet,
        signalsVersion: MAIL_SIGNALS_VERSION,
      },
    });
  }
  const skip = (account: MailAccount, address = SENDER, at = daysAgo(2)) =>
    prisma.mailSenderDecision.create({
      data: {
        spaceId: account.spaceId,
        userId: account.userId,
        connectionId: account.id,
        senderAddress: address,
        skipInboxAt: at,
      },
    });
  const run = (account: MailAccount, writesDisabled = false) =>
    applySkipInbox({ prisma, mail, writesDisabled }, account, context());
  const inInbox = async (account: MailAccount) =>
    Object.fromEntries(
      (await prisma.cachedMailMessage.findMany({ where: { connectionId: account.id } })).map(
        (m) => [m.providerMessageId, m.inInbox],
      ),
    );
  const logs = (account: MailAccount) =>
    prisma.mailActionLog.findMany({ where: { connectionId: account.id } });
  const labelsOf = (ref: string, id: string) =>
    (
      gmail.handle(ref, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`).data as {
        labelIds: string[];
      }
    ).labelIds;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    mail = createMailProvider({
      prisma,
      connectors: { managed: () => connector },
      sleep: async () => {},
      random: () => 0,
    });
    for (const id of [userId, otherUserId])
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: organizationId, name: "Skip Org", slug: organizationId, createdAt: new Date() },
    });
    for (const id of [spaceId, otherSpaceId])
      await prisma.space.create({
        data: { id, organizationId, name: id, isDefault: id === spaceId },
      });
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("archives new mail from a skipped sender in Gmail and the cache, with one auto log row", async () => {
    seed("skip-1", ["n1", "n2"]);
    const account = await connect("skip-1");
    await cache(account, "n1");
    await cache(account, "n2");
    await skip(account);

    expect(await run(account)).toBe(2);

    expect(await inInbox(account)).toEqual({ n1: false, n2: false });
    expect(labelsOf("skip-1", "n1")).not.toContain("INBOX");
    const [log, ...rest] = await logs(account);
    expect(rest).toEqual([]);
    expect(log).toMatchObject({
      kind: "skip_inbox",
      source: "auto",
      reason: "skip_inbox",
      senderAddresses: [SENDER],
      undoneAt: null,
    });
    expect([...(log?.threadIds ?? [])].sort()).toEqual(["n1", "n2"]);
    const rows = await prisma.cachedMailMessage.findMany({ where: { connectionId: account.id } });
    expect(rows.every((r) => r.skipAppliedAt !== null)).toBe(true);
  });

  it("archives only the skipped sender's message and leaves another sender's reply in the thread", async () => {
    const account = await connect("skip-t");
    gmail = new GmailApiEmulator({
      mailboxes: {
        "skip-t": {
          address: "skip-t@example.test",
          messages: [
            {
              id: "n1",
              threadId: "t1",
              date: daysAgo(1).toISOString(),
              labels: ["INBOX"],
              from: `News <${SENDER}>`,
              to: "me@example.test",
              subject: "Subject n1",
            },
            {
              id: "r1",
              threadId: "t1",
              date: daysAgo(0.4).toISOString(),
              labels: ["INBOX"],
              from: "Colleague <colleague@example.test>",
              to: "me@example.test",
              subject: "Re: Subject n1",
            },
          ],
        },
      },
    });
    await cache(account, "n1", { threadId: "t1" });
    await cache(account, "r1", { threadId: "t1", from: "colleague@example.test" });
    await skip(account);

    expect(await run(account)).toBe(1);

    expect(await inInbox(account)).toEqual({ n1: false, r1: true });
    expect(labelsOf("skip-t", "n1")).not.toContain("INBOX");
    expect(labelsOf("skip-t", "r1")).toContain("INBOX");
  });

  it("leaves mail that arrived before the decision and other senders alone", async () => {
    seed("skip-2", ["old", "new", "other"]);
    const account = await connect("skip-2");
    await cache(account, "old", { receivedAt: daysAgo(5) });
    await cache(account, "new");
    await cache(account, "other", { from: "friend@example.test" });
    await skip(account);

    expect(await run(account)).toBe(1);
    expect(await inInbox(account)).toEqual({ old: true, new: false, other: true });
  });

  it("makes no provider call when every message was handled, so an undo is not archived again", async () => {
    seed("skip-3", ["n1"]);
    const account = await connect("skip-3");
    await cache(account, "n1");
    await skip(account);
    expect(await run(account)).toBe(1);
    const calls = modifyCalls();

    // The user undoes the auto archive: the message is back in the inbox.
    await prisma.cachedMailMessage.updateMany({
      where: { connectionId: account.id },
      data: { inInbox: true },
    });
    expect(await run(account)).toBe(0);
    expect(modifyCalls()).toBe(calls);
    expect(await inInbox(account)).toEqual({ n1: true });
  });

  it("never archives spam, spam-like, failed-authentication or important-marked mail", async () => {
    seed("skip-4", ["gmail-spam", "pile-spam", "scam", "forged", "marked", "ok"]);
    const account = await connect("skip-4");
    await cache(account, "gmail-spam", {
      signals: { ...quiet, categories: { ...quiet.categories, spam: true } },
    });
    await cache(account, "pile-spam", { pile: "spam" });
    await cache(account, "scam", { category: "scam" });
    await cache(account, "forged", {
      signals: { ...quiet, auth: { dkim: "pass", spf: "fail", dmarc: "pass" } },
    });
    await cache(account, "marked", { from: "vip@lists.example.test" });
    await cache(account, "ok");
    await skip(account);
    await skip(account, "vip@lists.example.test");
    await prisma.inboxSenderFeedback.create({
      data: { spaceId, userId, senderAddress: "vip@lists.example.test", mark: "important" },
    });

    expect(await run(account)).toBe(1);
    expect(await inInbox(account)).toEqual({
      "gmail-spam": true,
      "pile-spam": true,
      scam: true,
      forged: true,
      marked: true,
      ok: false,
    });
    await prisma.inboxSenderFeedback.deleteMany({ where: { spaceId, userId } });
  });

  it("does nothing while mail writes are disabled", async () => {
    seed("skip-5", ["n1"]);
    const account = await connect("skip-5");
    await cache(account, "n1");
    await skip(account);

    expect(await run(account, true)).toBe(0);
    expect(modifyCalls()).toBe(0);
    expect(await inInbox(account)).toEqual({ n1: true });
    expect(await logs(account)).toEqual([]);
  });

  it("ignores another user's, space's or account's decision for the same address", async () => {
    seed("skip-6", ["n1"]);
    const account = await connect("skip-6");
    const otherAccount = await connect("skip-6b");
    const strangerAccount = await connect("skip-6c", {
      spaceId: otherSpaceId,
      userId: otherUserId,
    });
    await cache(account, "n1");
    await skip(otherAccount);
    await skip(strangerAccount);

    expect(await run(account)).toBe(0);
    expect(modifyCalls()).toBe(0);
    expect(await inInbox(account)).toEqual({ n1: true });
  });

  it("leaves a message for the next sync when Gmail fails, then archives it on retry", async () => {
    seed("skip-7", ["n1"]);
    const account = await connect("skip-7");
    await cache(account, "n1");
    await skip(account);
    gmail.failNext(500, { urlIncludes: "/modify", times: 20 });

    expect(await run(account)).toBe(0);
    const [row] = await prisma.cachedMailMessage.findMany({ where: { connectionId: account.id } });
    expect(row).toMatchObject({ inInbox: true, skipAppliedAt: null });
    expect(await logs(account)).toEqual([]);

    gmail.clearFailures();
    expect(await run(account)).toBe(1);
    expect(await inInbox(account)).toEqual({ n1: false });
  });

  it("stops the run on a rate limit", async () => {
    seed("skip-8", ["n1", "n2", "n3", "n4"]);
    const account = await connect("skip-8");
    for (const id of ["n1", "n2", "n3", "n4"]) await cache(account, id);
    await skip(account);
    gmail.failNext(429, { urlIncludes: "/modify", times: 100 });

    expect(await run(account)).toBe(0);
    // Two workers each try one thread (the provider retries it) before the run stops.
    const threads = new Set(
      gmail.requests.filter((r) => r.url.includes("/modify")).map((r) => r.url),
    );
    expect(threads.size).toBeLessThanOrEqual(2);
    gmail.clearFailures();
  });

  it("flags the account for reconnect when Gmail refuses the login", async () => {
    seed("skip-9", ["n1"]);
    const account = await connect("skip-9");
    await cache(account, "n1");
    await skip(account);
    gmail.failNext(401, { urlIncludes: "/modify" });

    expect(await run(account)).toBe(0);
    const state = await prisma.mailSyncState.findUnique({ where: { connectionId: account.id } });
    expect(state?.needsReconnect).toBe(true);
  });

  it("archives new mail at the end of a sync job and sorts the sender into a pile with the skip reason", async () => {
    seed("skip-10", ["j1", "j2"]);
    const account = await connect("skip-10");
    await skip(account);
    const jobs: JobPublisher = {
      enqueue: async () => {},
      cancel: async () => {},
      close: async () => {},
    };

    await runMailSyncJob({ prisma, mail, jobs }, { spaceId, userId, connectionId: account.id });

    expect(await inInbox(account)).toEqual({ j1: false, j2: false });
    expect(labelsOf("skip-10", "j1")).not.toContain("INBOX");
    const rows = await prisma.cachedMailMessage.findMany({ where: { connectionId: account.id } });
    expect(rows.map((r) => [r.pile, r.ruleReasons])).toEqual([
      ["updates", ["skip_inbox"]],
      ["updates", ["skip_inbox"]],
    ]);
    expect((await logs(account)).map((l) => l.source)).toEqual(["auto"]);
  });

  it("archives nothing at the end of a sync job when writes are disabled", async () => {
    seed("skip-11", ["j1"]);
    const account = await connect("skip-11");
    await skip(account);
    const jobs: JobPublisher = {
      enqueue: async () => {},
      cancel: async () => {},
      close: async () => {},
    };

    await runMailSyncJob(
      { prisma, mail, jobs, mailWritesDisabled: true },
      { spaceId, userId, connectionId: account.id },
    );

    expect(await inInbox(account)).toEqual({ j1: true });
    expect(modifyCalls()).toBe(0);
  });

  it("deletes the decisions and the log with the account's cached mail", async () => {
    seed("skip-12", ["n1"]);
    const account = await connect("skip-12");
    await cache(account, "n1");
    await skip(account);
    await run(account);
    expect(await prisma.mailSenderDecision.count({ where: { connectionId: account.id } })).toBe(1);
    expect(await logs(account)).toHaveLength(1);

    await prisma.$transaction((tx) =>
      deleteMailConnectionData(tx, { spaceId, userId, connectionId: account.id }),
    );

    expect(await prisma.mailSenderDecision.count({ where: { connectionId: account.id } })).toBe(0);
    expect(await logs(account)).toEqual([]);
  });
});
