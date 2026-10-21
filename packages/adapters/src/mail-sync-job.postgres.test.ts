import type {
  AdapterContext,
  BackgroundJob,
  ConnectorProxyRequest,
  JobPublisher,
  MailAccount,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { EmulatedMessage } from "./gmail-api-emulator.js";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import {
  mailSyncStatus,
  requestMailSync,
  runMailSyncJob,
  syncAfterSend,
  waitForMailSync,
} from "./mail-sync-job.js";
import { GraphileJobPublisher } from "./wakeup.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const message = (id: string, days: number, labels: string[] = ["INBOX"]): EmulatedMessage => ({
  id,
  date: daysAgo(days),
  labels,
  from: "Ann Sender <ann@example.test>",
  to: "me@example.test",
  subject: `Subject ${id}`,
  snippet: `Snippet ${id}`,
});

describePostgres("mail.sync job (PostgreSQL + Gmail emulator)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `mail-job-user-${suffix}`;
  const otherUserId = `mail-job-other-${suffix}`;
  const organizationId = `mail-job-org-${suffix}`;
  const spaceId = `mail-job-space-${suffix}`;
  const otherSpaceId = `mail-job-space2-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let gmail: GmailApiEmulator;
  /** Operation ids whose Gmail calls wait for the matching release. */
  const holds = new Map<string, Promise<void>>();

  const connector = {
    proxy: async (request: ConnectorProxyRequest, context: AdapterContext) => {
      const hold = holds.get(context.operationId);
      if (hold) await hold;
      return gmail.handle(request.accountRef, request.url, request.method, request.body);
    },
  } as unknown as ManagedConnectorProvider;
  const mailFor = (client: PrismaClient) =>
    createMailProvider({
      prisma: client,
      connectors: { managed: () => connector },
      sleep: async () => {},
      random: () => 0,
    });
  let mail: ReturnType<typeof mailFor>;

  const ctx = (): AdapterContext => ({
    operationId: "op",
    traceId: "op",
    spaceId,
    userId,
    signal: new AbortController().signal,
  });
  const scopeOf = (connectionId: string) => ({ spaceId, userId, connectionId });
  const seed = (ref: string, messages: EmulatedMessage[]) => {
    gmail = new GmailApiEmulator({
      mailboxes: { [ref]: { address: `${ref}@example.test`, messages } },
    });
  };
  async function connect(ref: string, owner = { spaceId, userId }): Promise<MailAccount> {
    const row = await prisma.connection.create({
      data: {
        ...owner,
        connectorId: "emulator",
        provider: "gmail",
        displayName: `Mailbox ${ref}`,
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
      label: row.displayName,
      ...owner,
      address: `${ref}@example.test`,
    };
  }
  /** Gmail calls made for one mailbox, so a run left over from another test does not count. */
  const callsFor = (accountRef: string) =>
    gmail.requests.filter((request) => request.accountRef === accountRef).length;
  /** Polls until the condition holds, for at most 5 seconds. */
  async function waitFor(condition: () => Promise<boolean>) {
    for (let i = 0; i < 250 && !(await condition()); i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    expect(await condition()).toBe(true);
  }
  const state = (connectionId: string) =>
    prisma.mailSyncState.findUniqueOrThrow({ where: { connectionId } });
  const stateRow = (connectionId: string) =>
    prisma.mailSyncState.findUnique({ where: { connectionId } });
  const cachedCount = (connectionId: string) =>
    prisma.cachedMailMessage.count({ where: { connectionId } });
  const ageSync = (connectionId: string) =>
    prisma.$executeRaw`UPDATE mail_sync_states SET "lastSyncedAt" = now() - interval '5 minutes', "backoffUntil" = NULL WHERE "connectionId" = ${connectionId}`;

  /** Records every job; with `runNow`, an immediate mail.sync job runs before enqueue returns. */
  let enqueued: BackgroundJob[] = [];
  let runNow = false;
  let failEnqueue = false;
  const jobs: JobPublisher = {
    enqueue: async (job) => {
      if (failEnqueue) throw new Error("queue down");
      enqueued.push(job);
      if (runNow && job.name === "mail.sync" && !job.availableAt)
        await runMailSyncJob({ prisma, mail, jobs }, job.payload);
    },
    cancel: async () => {},
    close: async () => {},
  };
  const syncJobs = () => enqueued.filter((j) => j.name === "mail.sync");
  const request = (connectionId: string, mode: "refresh" | "wake" | "now") =>
    requestMailSync({ prisma, jobs }, scopeOf(connectionId), mode);

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    mail = mailFor(prisma);
    for (const id of [userId, otherUserId])
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Mail Job Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    for (const id of [spaceId, otherSpaceId])
      await prisma.space.create({
        data: { id, organizationId, name: id, isDefault: id === spaceId },
      });
  });
  beforeEach(() => {
    enqueued = [];
    runNow = false;
    failEnqueue = false;
    holds.clear();
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  describe("requestMailSync", () => {
    it("queues one job on refresh, and a refresh while it is pending queues none and reports syncing", async () => {
      seed("req-1", [message("a", 1)]);
      const account = await connect("req-1");

      expect(await request(account.id, "refresh")).toEqual({ syncing: true });
      expect(syncJobs()).toHaveLength(1);
      expect(syncJobs()[0]).toMatchObject({
        name: "mail.sync",
        payload: scopeOf(account.id),
        replaceKey: `mail.sync:${account.id}`,
        maxAttempts: 3,
      });
      expect(syncJobs()[0]?.availableAt).toBeUndefined();
      expect((await state(account.id)).syncRequestedAt).not.toBeNull();

      expect(await request(account.id, "refresh")).toEqual({ syncing: true });
      expect(syncJobs()).toHaveLength(1);
    });

    it("collapses repeated requests into one queued job per connection", async () => {
      seed("req-collapse", [message("a", 1)]);
      const account = await connect("req-collapse");
      const pool = new Pool({ connectionString: databaseUrl, max: 2 });
      const publisher = new GraphileJobPublisher(pool);
      const key = `mail.sync:${account.id}`;
      try {
        for (let i = 0; i < 3; i++)
          await requestMailSync({ prisma, jobs: publisher }, scopeOf(account.id), "now");
        const { rows } = await pool.query(
          "select key, payload from graphile_worker._private_jobs where key = $1",
          [key],
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].payload).toMatchObject(scopeOf(account.id));
      } finally {
        await publisher.cancel(key).catch(() => undefined);
        await publisher.close();
        await pool.end();
      }
    });

    it("queues nothing inside the 60 second throttle and reports not syncing", async () => {
      seed("req-throttle", [message("a", 1)]);
      const account = await connect("req-throttle");
      runNow = true;
      await request(account.id, "refresh");
      enqueued = [];
      runNow = false;

      expect(await request(account.id, "refresh")).toEqual({ syncing: false });
      expect(enqueued).toEqual([]);
    });

    it("queues nothing for a refresh right after a failed sync", async () => {
      seed("req-failed", [message("a", 1)]);
      const account = await connect("req-failed");
      gmail.failNext(503, { times: 100 });
      await request(account.id, "refresh");
      await runMailSyncJob({ prisma, mail, jobs }, scopeOf(account.id));
      expect((await state(account.id)).lastErrorAt).not.toBeNull();
      enqueued = [];

      expect(await request(account.id, "refresh")).toEqual({ syncing: false });
      expect(enqueued).toEqual([]);
    });

    it("schedules the job at the end of a rate-limit backoff", async () => {
      seed("req-backoff", [message("a", 1)]);
      const account = await connect("req-backoff");
      await prisma.mailSyncState.create({
        data: {
          connectionId: account.id,
          backoffUntil: new Date(Date.now() + 20_000),
          lastErrorAt: new Date(),
        },
      });

      expect(await request(account.id, "refresh")).toEqual({ syncing: true });

      const at = syncJobs()[0]?.availableAt?.getTime() ?? 0;
      expect(at - Date.now()).toBeGreaterThan(18_000);
      expect(at - Date.now()).toBeLessThan(22_000);
    });

    it("wake inside the throttle schedules the job when the throttle ends", async () => {
      seed("req-wake", [message("a", 1)]);
      const account = await connect("req-wake");
      await prisma.mailSyncState.create({
        data: { connectionId: account.id, lastSyncedAt: new Date(Date.now() - 20_000) },
      });

      expect(await request(account.id, "wake")).toEqual({ syncing: true });

      const wait = (syncJobs()[0]?.availableAt?.getTime() ?? 0) - Date.now();
      expect(wait).toBeGreaterThan(38_000);
      expect(wait).toBeLessThan(42_000);
    });

    it("wake queues nothing while a job waits, and a follow-up while a sync runs", async () => {
      seed("req-wake2", [message("a", 1)]);
      const account = await connect("req-wake2");
      await request(account.id, "refresh");
      enqueued = [];
      await request(account.id, "wake");
      expect(enqueued).toEqual([]);

      await prisma.mailSyncState.update({
        where: { connectionId: account.id },
        data: { syncStartedAt: new Date(Date.now() - 1000) },
      });
      await request(account.id, "wake");
      const wait = (syncJobs()[0]?.availableAt?.getTime() ?? 0) - Date.now();
      expect(wait).toBeGreaterThan(55_000);
    });

    it("now clears the throttle and queues at once even when a request is pending", async () => {
      seed("req-now", [message("a", 1)]);
      const account = await connect("req-now");
      await prisma.mailSyncState.create({
        data: {
          connectionId: account.id,
          lastSyncedAt: new Date(Date.now() - 5_000),
          syncRequestedAt: new Date(),
        },
      });

      expect(await request(account.id, "now")).toEqual({ syncing: true });

      expect(syncJobs()).toHaveLength(1);
      expect(syncJobs()[0]?.availableAt).toBeUndefined();
      expect((await state(account.id)).lastSyncedAt).toBeNull();
    });

    it("never queues for another user's, another space's or a revoked connection, and creates no state row", async () => {
      seed("req-foreign", [message("a", 1)]);
      const theirs = await connect("req-foreign", { spaceId: otherSpaceId, userId: otherUserId });
      const revoked = await connect("req-revoked");
      await prisma.connection.update({ where: { id: revoked.id }, data: { status: "revoked" } });

      for (const mode of ["refresh", "wake", "now"] as const) {
        expect(await request(theirs.id, mode)).toEqual({ syncing: false });
        expect(await request(revoked.id, mode)).toEqual({ syncing: false });
        expect(await request("no-such-connection", mode)).toEqual({ syncing: false });
      }
      expect(enqueued).toEqual([]);
      expect(await stateRow(theirs.id)).toBeNull();
      expect(await stateRow(revoked.id)).toBeNull();
    });

    it("resets the request flag and rethrows when the enqueue fails", async () => {
      seed("req-fail", [message("a", 1)]);
      const account = await connect("req-fail");
      failEnqueue = true;

      await expect(request(account.id, "refresh")).rejects.toThrow("queue down");

      expect((await state(account.id)).syncRequestedAt).toBeNull();
    });
  });

  describe("runMailSyncJob", () => {
    const run = (account: MailAccount, extra = {}) =>
      runMailSyncJob({ prisma, mail, jobs, ...extra }, scopeOf(account.id));

    it("syncs, clears the request flag and queues triage", async () => {
      seed("run-1", [message("a", 1), message("b", 2)]);
      const account = await connect("run-1");
      await request(account.id, "refresh");
      enqueued = [];

      await run(account);

      expect(await cachedCount(account.id)).toBe(2);
      const after = await state(account.id);
      expect(after.lastSyncedAt).not.toBeNull();
      expect(after.syncRequestedAt).toBeNull();
      expect(enqueued.filter((j) => j.name !== "mail.attachments").map((j) => j.name)).toEqual([
        "inbox.triage",
      ]);
    });

    it("queues meeting digests after a sync only when digests can run, and never for a failed one", async () => {
      const meeting = (externalId: string, digestStatus: string | null) =>
        prisma.meeting.create({
          data: {
            spaceId,
            userId,
            provider: "granola",
            externalId: `${externalId}-${suffix}`,
            title: externalId,
            startedAt: new Date(),
            sourceUpdatedAt: new Date(),
            digestStatus,
          },
        });
      const waiting = await meeting("waiting", null);
      await meeting("failed", "failed");
      const digests = () => enqueued.filter((j) => j.name === "meetings.digest");
      try {
        for (const extra of [{}, { digestReady: async () => false }]) {
          seed("run-digest-off", [message("a", 1)]);
          const account = await connect("run-digest-off");
          await request(account.id, "refresh");
          enqueued = [];
          await run(account, extra);
          expect(digests()).toEqual([]);
        }
        seed("run-digest-on", [message("a", 1)]);
        const account = await connect("run-digest-on");
        await request(account.id, "refresh");
        enqueued = [];
        await run(account, { digestReady: async () => true });
        expect(digests().map((j) => (j.payload as { meetingId: string }).meetingId)).toEqual([
          waiting.id,
        ]);
      } finally {
        await prisma.meeting.deleteMany({ where: { spaceId, userId } });
      }
    });

    it("syncs once more when a request arrives while the job runs, so a sent message is not left for the next poll", async () => {
      seed("run-solo2", [message("a", 1)]);
      await run(await connect("run-solo2"));
      const single = callsFor("run-solo2");

      seed("run-race", [message("a", 1)]);
      const account = await connect("run-race");
      await request(account.id, "refresh");
      let release!: () => void;
      holds.set(`mail.sync:${account.id}`, new Promise<void>((resolve) => (release = resolve)));

      // The run must finish before the test ends, even when an assertion fails, or it keeps calling
      // the emulator of the next test and skews that test's request count.
      const running = run(account);
      try {
        await waitFor(async () => (await state(account.id)).syncStartedAt !== null);
        await request(account.id, "now");
      } finally {
        release();
        await running;
      }

      expect((await state(account.id)).syncRequestedAt).toBeNull();
      expect(callsFor("run-race")).toBeGreaterThan(single);
    });

    it("calls Gmail once when two runs start together", async () => {
      const messages = [message("a", 1), message("b", 2)];
      seed("run-solo", messages);
      const solo = await connect("run-solo");
      await run(solo);
      const single = callsFor("run-solo");

      seed("run-twin", messages);
      const twin = await connect("run-twin");
      await Promise.all([run(twin), run(twin)]);

      expect(callsFor("run-twin")).toBe(single);
      expect(await cachedCount(twin.id)).toBe(2);
    });

    it("makes no Gmail call inside the throttle and still clears the request", async () => {
      seed("run-throttled", [message("a", 1)]);
      const account = await connect("run-throttled");
      await run(account);
      await prisma.mailSyncState.update({
        where: { connectionId: account.id },
        data: { syncRequestedAt: new Date() },
      });
      const calls = gmail.requests.length;

      await run(account);

      expect(gmail.requests.length).toBe(calls);
      expect((await state(account.id)).syncRequestedAt).toBeNull();
    });

    it("returns without throwing for a missing or revoked connection and clears the request", async () => {
      seed("run-gone", [message("a", 1)]);
      const account = await connect("run-gone");
      await request(account.id, "refresh");
      await prisma.connection.update({ where: { id: account.id }, data: { status: "revoked" } });

      await expect(run(account)).resolves.toBeUndefined();
      await expect(
        runMailSyncJob({ prisma, mail, jobs }, scopeOf("no-such-connection")),
      ).resolves.toBeUndefined();

      expect(gmail.requests).toEqual([]);
      expect((await state(account.id)).syncRequestedAt).toBeNull();
    });

    it("records a provider failure on the state and still resolves", async () => {
      seed("run-fail", [message("a", 1)]);
      const account = await connect("run-fail");
      gmail.failNext(503, { times: 100 });

      await expect(run(account)).resolves.toBeUndefined();

      const after = await state(account.id);
      expect(after.lastErrorAt).not.toBeNull();
      expect(after.lastErrorKind).toBe("unavailable");
      expect(enqueued.filter((j) => j.name === "mail.sync")).toEqual([]);
    });

    it("runs the follow-up hook after a sync and survives its failure", async () => {
      seed("run-hook", [message("a", 1)]);
      const account = await connect("run-hook");
      const seen: string[] = [];

      await run(account, {
        afterSync: async (a: MailAccount) => {
          seen.push(a.id);
          throw new Error("hook failed");
        },
      });

      expect(seen).toEqual([account.id]);
      expect((await state(account.id)).lastSyncedAt).not.toBeNull();
    });

    it("queues itself 61 seconds later while older mail is pending, and not otherwise", async () => {
      seed(
        "run-chain",
        Array.from({ length: 250 }, (_, i) => message(`m${i}`, 0.5 + i / 5)),
      );
      const account = await connect("run-chain");

      await run(account);
      const chained = syncJobs();
      expect(chained).toHaveLength(1);
      const wait = (chained[0]?.availableAt?.getTime() ?? 0) - Date.now();
      expect(wait).toBeGreaterThan(59_000);
      expect(wait).toBeLessThan(63_000);

      // The window finishes on the next runs; the last one queues nothing.
      for (let i = 0; i < 3; i++) {
        await ageSync(account.id);
        enqueued = [];
        await run(account);
      }
      expect((await state(account.id)).backfill).toBeNull();
      expect(syncJobs()).toEqual([]);

      seed("run-nochain", [message("a", 1)]);
      const small = await connect("run-nochain");
      enqueued = [];
      await run(small);
      expect(syncJobs()).toEqual([]);
    });

    it("does not queue itself after a failed sync", async () => {
      seed(
        "run-chain-fail",
        Array.from({ length: 250 }, (_, i) => message(`m${i}`, 0.5 + i / 5)),
      );
      const account = await connect("run-chain-fail");
      await run(account);
      await ageSync(account.id);
      enqueued = [];
      gmail.failNext(503, { times: 100 });

      await run(account);

      expect(syncJobs()).toEqual([]);
    });
  });

  describe("status and waiting", () => {
    it("treats a live claim or a request under 2 minutes as syncing, and nothing older", async () => {
      seed("status", [message("a", 1)]);
      const account = await connect("status");
      const status = async () =>
        (await mailSyncStatus(prisma, { spaceId, userId }, [account.id]))[0];
      await prisma.mailSyncState.create({ data: { connectionId: account.id } });
      expect(await status()).toMatchObject({ syncing: false, lastSyncedAt: null, failed: false });

      const set = (data: object) =>
        prisma.mailSyncState.update({ where: { connectionId: account.id }, data });
      await set({ syncRequestedAt: new Date(Date.now() - 60_000) });
      expect((await status())?.syncing).toBe(true);
      await set({ syncRequestedAt: new Date(Date.now() - 3 * 60_000) });
      expect((await status())?.syncing).toBe(false);
      await set({ syncStartedAt: new Date(Date.now() - 60_000) });
      expect((await status())?.syncing).toBe(true);
      await set({ syncStartedAt: new Date(Date.now() - 6 * 60_000), lastErrorAt: new Date() });
      expect(await status()).toMatchObject({ syncing: false, failed: true });
    });

    it("does not report another user's connection", async () => {
      seed("status-foreign", [message("a", 1)]);
      const theirs = await connect("status-foreign", {
        spaceId: otherSpaceId,
        userId: otherUserId,
      });
      await prisma.mailSyncState.create({
        data: { connectionId: theirs.id, syncRequestedAt: new Date() },
      });
      expect((await mailSyncStatus(prisma, { spaceId, userId }, [theirs.id]))[0]).toMatchObject({
        syncing: false,
        lastSyncedAt: null,
      });
    });

    it("waits until the job finishes, and times out when no worker runs", async () => {
      seed("wait", [message("a", 1)]);
      const account = await connect("wait");
      await request(account.id, "refresh");

      const started = Date.now();
      const waiting = waitForMailSync(prisma, { spaceId, userId }, [account.id], 5_000);
      setTimeout(() => {
        void runMailSyncJob({ prisma, mail, jobs }, scopeOf(account.id));
      }, 300);
      expect(await waiting).toEqual({ timedOut: false });
      expect(Date.now() - started).toBeLessThan(4_000);
      expect(await cachedCount(account.id)).toBe(1);

      await prisma.mailSyncState.update({
        where: { connectionId: account.id },
        data: { syncRequestedAt: new Date() },
      });
      const t0 = Date.now();
      expect(await waitForMailSync(prisma, { spaceId, userId }, [account.id], 400)).toEqual({
        timedOut: true,
      });
      expect(Date.now() - t0).toBeLessThan(1_500);
    });

    it("syncAfterSend queues an immediate sync, waits for it, and never throws", async () => {
      seed("after-send", [message("a", 1)]);
      const account = await connect("after-send");
      runNow = true;
      await syncAfterSend({ prisma, jobs }, account, ctx());
      expect(await cachedCount(account.id)).toBe(1);

      failEnqueue = true;
      await expect(syncAfterSend({ prisma, jobs }, account, ctx(), 100)).resolves.toBeUndefined();
    });
  });
});
