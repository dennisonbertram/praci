import { randomUUID } from "node:crypto";
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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryArtifacts, RecordingJobs } from "./data-room-test-fakes.js";
import type { EmulatedMessage } from "./gmail-api-emulator.js";
import { GmailApiEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { runMailAttachmentFiling } from "./mail-attachment-filing.js";
import { syncMailbox } from "./mail-sync.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const file = (filename: string, mimeType: string, bytes = 20_000) => ({
  filename,
  mimeType,
  size: bytes,
  data: Buffer.alloc(bytes, "x").toString("base64"),
});
const pdf = (filename = "contract.pdf") => file(filename, "application/pdf");

describePostgres(
  "automatic Data room filing of mail attachments (PostgreSQL + Gmail emulator)",
  () => {
    const run = randomUUID().slice(0, 8);
    const owner = { userId: `auto-a-${run}`, spaceId: `auto-space-a-${run}` };
    const other = { userId: `auto-b-${run}`, spaceId: `auto-space-b-${run}` };
    let prisma: PrismaClient;
    let close: () => Promise<void>;
    let gmail: GmailApiEmulator;
    const artifacts = new MemoryArtifacts();
    const sink = new RecordingJobs();

    const connector = {
      proxy: async (request: ConnectorProxyRequest) =>
        gmail.handle(request.accountRef, request.url, request.method, request.body),
    } as unknown as ManagedConnectorProvider;
    let mail: ReturnType<typeof createMailProvider>;

    const ctx = (who: typeof owner): AdapterContext => ({
      operationId: "op",
      traceId: "op",
      ...who,
      signal: new AbortController().signal,
    });
    const mailboxes: Record<string, { address: string; messages: EmulatedMessage[] }> = {};
    const message = (id: string, days: number, over: Partial<EmulatedMessage> = {}) =>
      ({
        id,
        date: daysAgo(days),
        labels: ["INBOX"],
        from: "Ann Sender <ann@example.test>",
        to: "me@example.test",
        subject: `Subject ${id}`,
        snippet: `Snippet ${id}`,
        attachments: [pdf()],
        ...over,
      }) satisfies EmulatedMessage;

    async function connect(
      ref: string,
      messages: EmulatedMessage[],
      who = owner,
    ): Promise<MailAccount> {
      mailboxes[ref] = { address: `${ref}@example.test`, messages };
      gmail = new GmailApiEmulator({ mailboxes });
      const row = await prisma.connection.create({
        data: {
          ...who,
          connectorId: "emulator",
          provider: "gmail",
          displayName: ref,
          status: "connected",
          providerRef: ref,
          metadata: { mailAddress: `${ref}@example.test` },
        },
      });
      const accounts = await mail.listAccounts(who, ctx(who));
      return accounts.find((a) => a.id === row.id) as MailAccount;
    }

    /** Syncs the account and returns the filing jobs the sync queued. */
    async function sync(account: MailAccount, who = owner) {
      const queued: BackgroundJob[] = [];
      const jobs = {
        enqueue: async (job: BackgroundJob) => void queued.push(job),
        cancel: async () => {},
        close: async () => {},
      } as JobPublisher;
      await syncMailbox({ prisma, mail, jobs }, account, ctx(who));
      return queued.filter((job) => job.name === "mail.attachments");
    }
    const runJob = (job: BackgroundJob) =>
      runMailAttachmentFiling(
        { prisma, mail, artifacts, jobs: sink },
        job.payload as Parameters<typeof runMailAttachmentFiling>[1],
      );
    const items = (who: typeof owner) =>
      prisma.dataRoomItem.findMany({ where: who, orderBy: { name: "asc" } });
    const ids = (jobs: BackgroundJob[]) =>
      jobs.map((job) => (job.payload as { messageId: string }).messageId).sort();

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
      for (const who of [owner, other]) {
        const orgId = `org-${who.spaceId}`;
        await prisma.user.create({
          data: { id: who.userId, name: who.userId, email: `${who.userId}@rakazo.test` },
        });
        await prisma.organization.create({
          data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
        });
        await prisma.space.create({
          data: { id: who.spaceId, organizationId: orgId, name: who.spaceId, isDefault: true },
        });
        // A trigger adds the member to the organization's default space.
        await prisma.member.create({
          data: {
            id: `m-${who.userId}`,
            organizationId: orgId,
            userId: who.userId,
            role: "owner",
            createdAt: new Date(),
          },
        });
      }
    });
    afterAll(async () => {
      if (!prisma) return;
      await prisma.organization.deleteMany({
        where: { id: { in: [owner, other].map((who) => `org-${who.spaceId}`) } },
      });
      await prisma.user.deleteMany({ where: { id: { in: [owner.userId, other.userId] } } });
      await close();
    });

    it("queues a job for a new recent message and files its document into the Data room", async () => {
      const account = await connect("new-1", [
        message("m1", 1, {
          attachments: [pdf("contract.pdf"), file("q3.xlsx", "application/zip")],
        }),
      ]);
      const queued = await sync(account);
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        name: "mail.attachments",
        replaceKey: `mail.attachments:${account.id}:m1`,
      });
      await runJob(queued[0] as BackgroundJob);
      const filed = (await items(owner)).filter((i) => i.sourceConnectionId === account.id);
      expect(filed.map((i) => i.name)).toEqual(["contract.pdf", "q3.xlsx"]);
      expect(filed.every((i) => i.source === "gmail")).toBe(true);
      expect(filed[0]?.externalId).toMatch(/^gmail:m1:/);
      expect(sink.all.some((job) => job.name === "dataroom.ingest")).toBe(true);
    });

    it("does not import the 90-day cache: only mail from the last two days is queued", async () => {
      const account = await connect("backfill-1", [
        message("recent", 1),
        message("old", 30),
        message("older", 80),
      ]);
      expect(ids(await sync(account))).toEqual(["recent"]);
      expect(await prisma.cachedMailMessage.count({ where: { connectionId: account.id } })).toBe(3);
    });

    it("skips newsletters, bulk mail and no-reply senders", async () => {
      const account = await connect("clutter-1", [
        message("news", 1, {
          headers: [
            { name: "List-Unsubscribe", value: "<https://news.example.test/unsub>" },
            { name: "List-Id", value: "<news.example.test>" },
          ],
        }),
        message("bulk", 1, { headers: [{ name: "Precedence", value: "bulk" }] }),
        message("noreply", 1, { from: "Billing <no-reply@example.test>" }),
        message("real", 1),
      ]);
      expect(ids(await sync(account))).toEqual(["real"]);
    });

    it("files only documents: not inline images, small files or calendar invites", async () => {
      const account = await connect("types-1", [
        message("mix", 1, {
          attachments: [
            pdf("keep.pdf"),
            file("tiny.pdf", "application/pdf", 2_000),
            file("logo.png", "image/png", 50_000),
            file("invite.ics", "text/calendar", 30_000),
          ],
          inlineImages: [{ contentId: "sig", mimeType: "image/png", data: "aGVsbG8=" }],
        }),
      ]);
      const [job] = await sync(account);
      await runJob(job as BackgroundJob);
      const filed = (await items(owner)).filter((i) => i.sourceConnectionId === account.id);
      expect(filed.map((i) => i.name)).toEqual(["keep.pdf"]);
    });

    it("is idempotent: a second sync queues nothing and a repeated job files nothing new", async () => {
      const account = await connect("idem-1", [message("m1", 1)]);
      const [job] = await sync(account);
      await runJob(job as BackgroundJob);
      await runJob(job as BackgroundJob);
      await prisma.$executeRaw`UPDATE mail_sync_states SET "lastSyncedAt" = now() - interval '5 minutes' WHERE "connectionId" = ${account.id}`;
      expect(await sync(account)).toHaveLength(0);
      const filed = (await items(owner)).filter((i) => i.sourceConnectionId === account.id);
      expect(filed).toHaveLength(1);
    });

    it("files nothing while the setting is off, and a missing setting means on", async () => {
      await prisma.dataRoomPreference.create({
        data: { ...owner, autoFileEmail: false },
      });
      const off = await connect("off-1", [message("m1", 1)]);
      expect(await sync(off)).toHaveLength(0);
      // A job that was queued before the setting changed also files nothing.
      await runMailAttachmentFiling(
        { prisma, mail, artifacts, jobs: sink },
        { ...owner, connectionId: off.id, messageId: "m1" },
      );
      expect((await items(owner)).filter((i) => i.sourceConnectionId === off.id)).toHaveLength(0);
      await prisma.dataRoomPreference.delete({ where: { spaceId_userId: owner } });
      const on = await connect("off-2", [message("m2", 1)]);
      expect(await sync(on)).toHaveLength(1);
    });

    it("files mail the owner sent, except mail sent only to themselves", async () => {
      const account = await connect("sent-1", [
        message("out", 1, {
          labels: ["SENT"],
          from: "me@sent-1.example.test",
          to: "client@example.test",
        }),
        message("self", 1, {
          labels: ["SENT"],
          from: "me@sent-1.example.test",
          to: "me@sent-1.example.test",
        }),
      ]);
      expect(ids(await sync(account))).toEqual(["out"]);
    });

    it("keeps another user's mail out of this user's Data room", async () => {
      const theirs = await connect("other-1", [message("secret", 1)], other);
      const queued = await sync(theirs, other);
      await runJob(queued[0] as BackgroundJob);
      expect((await items(other)).some((i) => i.sourceConnectionId === theirs.id)).toBe(true);
      expect((await items(owner)).some((i) => i.sourceConnectionId === theirs.id)).toBe(false);
      // A job that names the other user's connection under this owner's scope finds no message.
      const before = (await items(owner)).length;
      await runMailAttachmentFiling(
        { prisma, mail, artifacts, jobs: sink },
        { ...owner, connectionId: theirs.id, messageId: "secret" },
      );
      expect((await items(owner)).length).toBe(before);
    });

    it("files without Data room consent, as a manual upload does; the job asks no model", async () => {
      // The job takes no consent or model dependency at all, and no consent row exists for this user.
      expect(await prisma.aiDataConsent.count({ where: owner })).toBe(0);
      const account = await connect("consent-1", [message("m1", 1)]);
      const [job] = await sync(account);
      await runJob(job as BackgroundJob);
      expect((await items(owner)).filter((i) => i.sourceConnectionId === account.id)).toHaveLength(
        1,
      );
    });
  },
);
