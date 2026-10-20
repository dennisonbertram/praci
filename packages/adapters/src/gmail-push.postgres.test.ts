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
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import {
  ensureMailWatch,
  type GmailPushConfig,
  runMailWatchRenewal,
  stopMailWatch,
  wakeMailConnections,
} from "./gmail-push.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const push: GmailPushConfig = {
  topic: "projects/example-project/topics/example-mail",
  serviceAccount: "push@example-project.iam.gserviceaccount.com",
  audience: "https://rakazo.example.test/api/v1/mail/push",
};

describePostgres("Gmail push watches (PostgreSQL + Gmail emulator)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `push-org-${suffix}`;
  const owners = [1, 2, 3].map((n) => ({
    userId: `push-user-${n}-${suffix}`,
    spaceId: `push-space-${n}-${suffix}`,
  }));
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let gmail: GmailApiEmulator;

  const connector = {
    proxy: async (request: ConnectorProxyRequest) =>
      gmail.handle(request.accountRef, request.url, request.method, request.body),
  } as unknown as ManagedConnectorProvider;
  let mail: ReturnType<typeof createMailProvider>;
  const contextFor = (owner: (typeof owners)[number]): AdapterContext => ({
    operationId: "op",
    traceId: "op",
    ...owner,
    signal: new AbortController().signal,
  });
  async function connect(
    ownerIndex: number,
    ref: string,
    options: { connectorId?: string; status?: string; address?: string | null } = {},
  ): Promise<MailAccount> {
    const owner = owners[ownerIndex] as (typeof owners)[number];
    const address = options.address === undefined ? `${ref}@example.test` : options.address;
    const row = await prisma.connection.create({
      data: {
        ...owner,
        connectorId: options.connectorId ?? "google",
        provider: "gmail",
        displayName: `Mailbox ${ref}`,
        status: options.status ?? "connected",
        providerRef: ref,
        metadata: address ? { mailAddress: address } : {},
      },
    });
    return {
      id: row.id,
      connectorId: row.connectorId,
      app: "gmail",
      accountRef: ref,
      label: row.displayName,
      ...owner,
      address,
    };
  }
  const seed = (refs: string[]) => {
    gmail = new GmailApiEmulator({
      mailboxes: Object.fromEntries(
        refs.map((ref) => [ref, { address: `${ref}@example.test`, messages: [] }]),
      ),
    });
  };
  const state = (connectionId: string) =>
    prisma.mailSyncState.findUnique({ where: { connectionId } });
  const posts = () => gmail.requests.filter((r) => r.method === "POST");

  let enqueued: BackgroundJob[] = [];
  const jobs: JobPublisher = {
    enqueue: async (job) => void enqueued.push(job),
    cancel: async () => {},
    close: async () => {},
  };

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
    await prisma.organization.create({
      data: { id: orgId, name: "Push Org", slug: orgId, createdAt: new Date() },
    });
    for (const { userId, spaceId } of owners) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      await prisma.space.create({
        data: {
          id: spaceId,
          organizationId: orgId,
          name: spaceId,
          isDefault: spaceId === owners[0]?.spaceId,
        },
      });
    }
  });
  beforeEach(async () => {
    enqueued = [];
    await prisma.connection.deleteMany({
      where: { spaceId: { in: owners.map((o) => o.spaceId) } },
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: owners.map((o) => o.userId) } } });
    await close();
  });

  describe("ensureMailWatch", () => {
    const ensure = (account: MailAccount, force = false) =>
      ensureMailWatch({ prisma, mail }, push, account, contextFor(account as never), { force });

    it("stores the lowercased address, expiry and history id", async () => {
      seed(["Ensure-One"]);
      const account = await connect(0, "Ensure-One", { address: "Ensure.One@Example.test" });

      await ensure(account);

      const row = await state(account.id);
      expect(row?.watchAddress).toBe("ensure.one@example.test");
      expect(row?.watchHistoryId).toMatch(/^\d+$/);
      expect((row?.watchExpiresAt?.getTime() ?? 0) - Date.now()).toBeGreaterThan(6 * DAY);
      expect(gmail.watchOf("Ensure-One")?.topicName).toBe(push.topic);
    });

    it("leaves a watch with more than two days left alone, renews one with less, and force always renews", async () => {
      seed(["ensure-two"]);
      const account = await connect(0, "ensure-two");
      await ensure(account);
      expect(posts()).toHaveLength(1);

      await ensure(account);
      expect(posts()).toHaveLength(1);

      await prisma.mailSyncState.update({
        where: { connectionId: account.id },
        data: { watchExpiresAt: new Date(Date.now() + DAY) },
      });
      await ensure(account);
      expect(posts()).toHaveLength(2);
      expect(
        ((await state(account.id))?.watchExpiresAt?.getTime() ?? 0) - Date.now(),
      ).toBeGreaterThan(6 * DAY);

      await ensure(account, true);
      expect(posts()).toHaveLength(3);
    });

    it("re-enrolls a connection whose address changed", async () => {
      seed(["ensure-move"]);
      const account = await connect(0, "ensure-move");
      await ensure(account);
      await prisma.mailSyncState.update({
        where: { connectionId: account.id },
        data: { watchAddress: "someone-else@example.test" },
      });
      await ensure(account);
      expect((await state(account.id))?.watchAddress).toBe("ensure-move@example.test");
    });

    it("skips accounts without a known address, and routes that cannot watch", async () => {
      seed(["ensure-null", "ensure-composio"]);
      const unknown = await connect(0, "ensure-null", { address: null });
      const composio = await connect(0, "ensure-composio", { connectorId: "composio" });

      await ensure(unknown);
      await ensure(composio);

      expect(gmail.requests).toEqual([]);
      expect(await state(unknown.id)).toBeNull();
      expect(await state(composio.id)).toBeNull();
    });

    it("logs and swallows a provider error", async () => {
      seed(["ensure-fail"]);
      const account = await connect(0, "ensure-fail");
      gmail.failNext(500, { times: 10 });
      await expect(ensure(account)).resolves.toBeUndefined();
      expect((await state(account.id))?.watchAddress ?? null).toBeNull();
    });
  });

  describe("runMailWatchRenewal", () => {
    it("renews only native Google Gmail connections, across users", async () => {
      seed(["renew-a", "renew-b", "renew-c", "renew-composio", "renew-revoked"]);
      const accounts = [
        await connect(0, "renew-a"),
        await connect(1, "renew-b"),
        await connect(2, "renew-c"),
      ];
      const composio = await connect(0, "renew-composio", { connectorId: "composio" });
      const revoked = await connect(1, "renew-revoked", { status: "revoked" });

      await runMailWatchRenewal({ prisma, mail, push });

      for (const account of accounts)
        expect((await state(account.id))?.watchAddress).toBe(`${account.accountRef}@example.test`);
      expect(await state(composio.id)).toBeNull();
      expect(await state(revoked.id)).toBeNull();
      expect(posts()).toHaveLength(3);

      // Force: a watch with plenty of time left is still renewed every day.
      await runMailWatchRenewal({ prisma, mail, push });
      expect(posts()).toHaveLength(6);
    });

    it("isolates one failing connection: the others are still renewed", async () => {
      seed(["iso2-a", "iso2-b"]);
      const a = await connect(0, "iso2-a");
      const b = await connect(1, "iso2-b");
      // Only the first watch call fails.
      gmail.failNext(500, { times: 1, urlIncludes: "/watch" });
      await runMailWatchRenewal({ prisma, mail, push });
      gmail.clearFailures();
      const states = await Promise.all([state(a.id), state(b.id)]);
      expect(states.filter((s) => s?.watchAddress).length).toBe(1);
    });

    it("does nothing without push configured", async () => {
      seed(["nopush"]);
      await connect(0, "nopush");
      await runMailWatchRenewal({ prisma, mail });
      expect(gmail.requests).toEqual([]);
    });
  });

  describe("stopMailWatch", () => {
    it("stops the watch and clears it from the state", async () => {
      seed(["stop-a"]);
      const account = await connect(0, "stop-a");
      await ensureMailWatch({ prisma, mail }, push, account, contextFor(owners[0] as never));
      expect(gmail.watchOf("stop-a")).toBeDefined();

      await stopMailWatch({ prisma, mail }, owners[0] as never, account.id);

      expect(gmail.watchOf("stop-a")).toBeUndefined();
      expect(await state(account.id)).toMatchObject({
        watchAddress: null,
        watchExpiresAt: null,
        watchHistoryId: null,
      });
    });

    it("makes no call when there is no watch, and never throws", async () => {
      seed(["stop-b"]);
      const account = await connect(0, "stop-b");
      await stopMailWatch({ prisma, mail }, owners[0] as never, account.id);
      expect(gmail.requests).toEqual([]);

      await ensureMailWatch({ prisma, mail }, push, account, contextFor(owners[0] as never));
      gmail.failNext(500, { times: 10 });
      await expect(
        stopMailWatch({ prisma, mail }, owners[0] as never, account.id),
      ).resolves.toBeUndefined();
      // The failed stop keeps the record, so a later stop can try again.
      expect((await state(account.id))?.watchAddress).not.toBeNull();
    });

    it("keeps the Gmail watch running while another connection watches the same mailbox", async () => {
      seed(["stop-shared"]);
      const mine = await connect(0, "stop-shared", { address: "shared-stop@example.test" });
      const theirs = await connect(1, "stop-shared", { address: "shared-stop@example.test" });
      await ensureMailWatch({ prisma, mail }, push, mine, contextFor(owners[0] as never));
      await ensureMailWatch({ prisma, mail }, push, theirs, contextFor(owners[1] as never));

      await stopMailWatch({ prisma, mail }, owners[0] as never, mine.id);

      expect(gmail.watchOf("stop-shared")).toBeDefined();
      expect((await state(mine.id))?.watchAddress).toBeNull();
      expect((await state(theirs.id))?.watchAddress).not.toBeNull();

      await stopMailWatch({ prisma, mail }, owners[1] as never, theirs.id);
      expect(gmail.watchOf("stop-shared")).toBeUndefined();
    });

    it("does not touch another user's connection", async () => {
      seed(["stop-c"]);
      const account = await connect(1, "stop-c");
      await ensureMailWatch({ prisma, mail }, push, account, contextFor(owners[1] as never));
      await stopMailWatch({ prisma, mail }, owners[0] as never, account.id);
      expect(gmail.watchOf("stop-c")).toBeDefined();
    });
  });

  describe("wakeMailConnections", () => {
    const watch = async (account: MailAccount, expiresInMs = 5 * DAY) => {
      await prisma.mailSyncState.upsert({
        where: { connectionId: account.id },
        create: {
          connectionId: account.id,
          watchAddress: account.address?.toLowerCase() ?? null,
          watchExpiresAt: new Date(Date.now() + expiresInMs),
        },
        update: {
          watchAddress: account.address?.toLowerCase() ?? null,
          watchExpiresAt: new Date(Date.now() + expiresInMs),
        },
      });
    };

    it("wakes every matching connection across spaces and users, each in its own scope", async () => {
      seed(["wake-shared"]);
      const first = await connect(0, "wake-1", { address: "shared@example.test" });
      const second = await connect(1, "wake-2", { address: "Shared@Example.test" });
      await watch(first);
      await watch(second);

      expect(await wakeMailConnections({ prisma, jobs }, "SHARED@example.test")).toBe(2);

      const payloads = enqueued.filter((j) => j.name === "mail.sync").map((j) => j.payload);
      expect(payloads).toEqual(
        expect.arrayContaining([
          { spaceId: owners[0]?.spaceId, userId: owners[0]?.userId, connectionId: first.id },
          { spaceId: owners[1]?.spaceId, userId: owners[1]?.userId, connectionId: second.id },
        ]),
      );
      expect(payloads).toHaveLength(2);
    });

    it("does not wake another address, an expired or missing watch, a revoked or non-native connection", async () => {
      seed(["wake-x"]);
      const matching = await connect(0, "wake-m", { address: "target@example.test" });
      const other = await connect(0, "wake-o", { address: "other@example.test" });
      const expired = await connect(1, "wake-e", { address: "target@example.test" });
      const revoked = await connect(1, "wake-r", {
        address: "target@example.test",
        status: "revoked",
      });
      const composio = await connect(2, "wake-c", {
        address: "target@example.test",
        connectorId: "composio",
      });
      const unwatched = await connect(2, "wake-u", { address: "target@example.test" });
      await watch(matching);
      await watch(other);
      await watch(expired, -1000);
      await watch(revoked);
      await watch(composio);
      void unwatched;

      expect(await wakeMailConnections({ prisma, jobs }, "target@example.test")).toBe(1);

      expect(enqueued.map((j) => j.payload)).toEqual([
        { spaceId: owners[0]?.spaceId, userId: owners[0]?.userId, connectionId: matching.id },
      ]);
    });

    it("ignores addresses that are not addresses", async () => {
      expect(await wakeMailConnections({ prisma, jobs }, "not an address")).toBe(0);
      expect(await wakeMailConnections({ prisma, jobs }, `${"a".repeat(400)}@example.test`)).toBe(
        0,
      );
      expect(enqueued).toEqual([]);
    });

    it("throws when an enqueue fails, so Pub/Sub delivers again", async () => {
      const account = await connect(0, "wake-fail", { address: "fail@example.test" });
      await watch(account);
      const failing: JobPublisher = {
        enqueue: async () => {
          throw new Error("queue down");
        },
        cancel: async () => {},
        close: async () => {},
      };
      await expect(
        wakeMailConnections({ prisma, jobs: failing }, "fail@example.test"),
      ).rejects.toThrow("queue down");
    });
  });
});
