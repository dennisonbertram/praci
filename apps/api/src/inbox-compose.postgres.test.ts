import { createRouterClient } from "@orpc/server";
import type {
  AdapterContext,
  BackgroundJob,
  ConnectorProxyRequest,
  JobPublisher,
  MailProvider,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import {
  createMailProvider,
  GmailApiEmulator,
  parseRawMime,
  runMailSyncJob,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inboxComposeDiscard,
  inboxComposeDraftSave,
  inboxComposePrefill,
  inboxComposeSend,
} from "./inbox-compose.js";
import { createRouter, type RouterDeps } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const b64 = (text: string) => Buffer.from(text).toString("base64");
const big = (mb: number) => Buffer.alloc(mb * 1024 * 1024 - 1, 1).toString("base64");

const SECRET_BODY = "SECRET-BODY-TEXT-do-not-log";

describePostgres("inbox compose (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `compose-${name}-${suffix}`;
  const [orgA, orgB, spaceA, spaceB, userA, userB, userC] = [
    "org-a",
    "org-b",
    "space-a",
    "space-b",
    "user-a",
    "user-b",
    "user-c",
  ].map(id) as [string, string, string, string, string, string, string];
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
  let connA: string;
  let connB: string;
  let connC: string;
  let revokedA: string;
  let requests: ConnectorProxyRequest[];
  /** Runs an immediate mail.sync job before enqueue returns, as a worker would. */
  const queued: BackgroundJob[] = [];
  const jobs: JobPublisher = {
    enqueue: async (job) => {
      queued.push(job);
      if (job.name === "mail.sync" && !job.availableAt)
        await runMailSyncJob({ prisma, mail, jobs }, job.payload);
    },
    cancel: async () => {},
    close: async () => {},
  };
  const deps = (extra: { mailWritesDisabled?: boolean } = {}) => ({ prisma, mail, jobs, ...extra });

  const connector = {
    proxy: async (request: ConnectorProxyRequest, _context: AdapterContext) => {
      requests.push(request);
      return gmail.handle(request.accountRef, request.url, request.method, request.body);
    },
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

  const message = (messageId: string, labels: string[], extra: Record<string, unknown> = {}) => ({
    id: messageId,
    date: new Date(Date.now() - 3_600_000).toISOString(),
    labels,
    from: "Ann Sender <ann@example.test>",
    to: "box-a@example.test, Carol <carol@example.test>",
    cc: "Dev <dev@example.test>, box-a@example.test",
    subject: `Subject ${messageId}`,
    text: `Body of ${messageId}\nsecond line`,
    ...extra,
  });

  const seed = () => {
    gmail = new GmailApiEmulator({
      mailboxes: {
        "box-a": {
          address: "box-a@example.test",
          messages: [
            message("a-1", ["INBOX"], { threadId: "t-a1" }),
            message("a-html", ["INBOX"], {
              date: "2026-09-23T15:04:05.000Z",
              text: undefined,
              html: '<h2>News</h2><p>Hi <b>there</b> <a href="https://e.test/x">link</a></p><script>x()</script>',
            }),
            message("a-files", ["INBOX"], {
              attachments: [
                { filename: "one.txt", mimeType: "text/plain", size: 5, data: b64("hello") },
                { filename: "two.bin", mimeType: "application/zip", size: 3, data: b64("zip") },
              ],
              inlineImages: [{ contentId: "pic", mimeType: "image/png", data: b64("png") }],
            }),
            message("a-big", ["INBOX"], {
              attachments: [
                { filename: "big.bin", mimeType: "application/zip", size: 6_000_000, data: big(6) },
                {
                  filename: "big2.bin",
                  mimeType: "application/zip",
                  size: 6_000_000,
                  data: big(6),
                },
              ],
            }),
          ],
        },
        "box-b": { address: "box-b@example.test", messages: [message("b-1", ["INBOX"])] },
        "box-c": { address: "box-c@example.test", messages: [message("c-1", ["INBOX"])] },
        "box-revoked": { address: "box-revoked@example.test", messages: [] },
      },
    });
    requests = [];
  };

  const cache = (who: Actor, connectionId: string, providerMessageId: string, threadId?: string) =>
    prisma.cachedMailMessage.create({
      data: {
        spaceId: who.spaceId,
        userId: who.userId,
        connectionId,
        providerMessageId,
        threadId: threadId ?? providerMessageId,
        fromName: "Ann Sender",
        fromAddress: "ann@example.test",
        subject: `Subject ${providerMessageId}`,
        snippet: "",
        receivedAt: new Date(Date.now() - 3_600_000),
        unread: false,
        inInbox: true,
        fromSelf: false,
        seenAt: new Date(),
      },
    });

  const wipe = async () => {
    const scope = { spaceId: { in: [spaceA, spaceB] } };
    await prisma.composeSend.deleteMany({ where: scope });
    await prisma.cachedMailMessage.deleteMany({ where: scope });
    await prisma.mailSyncState.deleteMany({ where: { connection: scope } });
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
    connA = await connect(a, "box-a");
    connB = await connect(b, "box-b");
    connC = await connect(c, "box-c");
    revokedA = await connect(a, "box-revoked", "revoked");
    mail = createMailProvider({
      prisma,
      connectors: { managed: () => connector },
      sleep: async () => {},
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await wipe();
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB, userC] } } });
    await close();
  });

  beforeEach(async () => {
    seed();
    await wipe();
  });
  afterEach(() => vi.restoreAllMocks());

  const fields = (extra: Record<string, unknown> = {}) => ({
    clientId: `client-${Math.random().toString(36).slice(2, 10)}`,
    connectionId: connA,
    to: "Priya Shah <priya@example.test>",
    cc: "",
    bcc: "",
    subject: "Hello",
    body: SECRET_BODY,
    ...extra,
  });
  const sendRequests = () => requests.filter((r) => r.url.endsWith("/drafts/send"));

  describe("prefill", () => {
    it("builds a reply, reply all and forward from the caller's own cached message", async () => {
      const row = await cache(a, connA, "a-1", "t-a1");
      const reply = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" });
      expect(reply).toMatchObject({
        connectionId: connA,
        to: "Ann Sender <ann@example.test>",
        cc: "",
        subject: "Re: Subject a-1",
        replyToMessageId: row.id,
      });
      // The composer's From line names the account the reply goes from.
      expect(reply.account?.connectionId).toBe(connA);
      expect(reply.account?.address).toMatch(/@/);
      expect(reply.body).toContain("> Body of a-1\n> second line");

      const all = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "replyAll" });
      expect(all.to).toBe("Ann Sender <ann@example.test>, Carol <carol@example.test>");
      expect(all.cc).toBe("Dev <dev@example.test>");

      const forward = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "forward" });
      expect(forward).toMatchObject({ to: "", cc: "", subject: "Fwd: Subject a-1" });
      expect(forward.replyToMessageId).toBeUndefined();
      expect(forward.body).toContain("---------- Forwarded message ---------");
    });

    it("writes the quoted date in the client's time zone, UTC without one", async () => {
      const row = await cache(a, connA, "a-html");
      const reply = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" });
      expect(reply.body).toContain("On Wed, Sep 23, 2026, 3:04 PM, Ann Sender");
      const tokyo = await inboxComposePrefill(deps(), a, {
        messageId: row.id,
        mode: "forward",
        timeZone: "Asia/Tokyo",
        locale: "en-US",
      });
      expect(tokyo.body).toContain("Date: Thu, Sep 24, 2026, 12:04 AM\n");
    });

    it("fills the Subject, but not To, from the cached message when Gmail is rate limited", async () => {
      const row = await cache(a, connA, "a-1", "t-a1");
      gmail.failNext(429, { urlIncludes: "/messages/a-1", times: 100 });
      const reply = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" });
      expect(reply).toMatchObject({
        connectionId: connA,
        to: "",
        cc: "",
        subject: "Re: Subject a-1",
        body: "",
        replyToMessageId: row.id,
        quoteUnavailable: true,
      });
      const forward = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "forward" });
      expect(forward).toMatchObject({
        to: "",
        subject: "Fwd: Subject a-1",
        quoteUnavailable: true,
      });
      gmail.clearFailures();
      expect(
        (await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" }))
          .quoteUnavailable,
      ).toBeUndefined();
    });

    it("fills To from the cached message when it is the user's own", async () => {
      const row = await cache(a, connA, "a-1", "t-a1");
      await prisma.cachedMailMessage.update({
        where: { id: row.id },
        data: {
          fromSelf: true,
          fromAddress: "box-a@example.test",
          toAddresses: ["pat@example.test"],
        },
      });
      gmail.failNext(429, { urlIncludes: "/messages/a-1", times: 100 });
      const reply = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" });
      expect(reply).toMatchObject({
        to: "pat@example.test",
        subject: "Re: Subject a-1",
        quoteUnavailable: true,
      });
    });

    it("treats a cached message sent from an alias as the user's own", async () => {
      const row = await cache(a, connA, "a-1", "t-a1");
      await prisma.cachedMailMessage.update({
        where: { id: row.id },
        data: {
          fromSelf: true,
          fromAddress: "alias@example.test",
          toAddresses: ["pat@example.test"],
        },
      });
      gmail.failNext(429, { urlIncludes: "/messages/a-1", times: 100 });
      const reply = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" });
      expect(reply.to).toBe("pat@example.test");
    });

    it("still reports a missing or revoked message instead of falling back", async () => {
      const row = await cache(a, connA, "a-gone");
      await expect(
        inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("carries an HTML mail's formatting into a forward, not a reply", async () => {
      const row = await cache(a, connA, "a-html");
      const forward = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "forward" });
      expect(forward.quotedHtml).toBe(
        '<p><strong>News</strong></p><p>Hi <b>there</b> <a href="https://e.test/x">link</a></p>',
      );
      const reply = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" });
      expect(reply.quotedHtml).toBeUndefined();
    });

    it("lists a forward's files, never inline pictures, and none for a reply", async () => {
      const row = await cache(a, connA, "a-files");
      const forward = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "forward" });
      expect(forward.attachments.map((f) => [f.filename, f.mimeType, f.size])).toEqual([
        ["one.txt", "text/plain", 5],
        ["two.bin", "application/zip", 3],
      ]);
      expect(forward.attachmentsTooLarge).toBeUndefined();
      const reply = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" });
      expect(reply.attachments).toEqual([]);
    });

    it("keeps the files that fit and names the ones over the limit", async () => {
      const row = await cache(a, connA, "a-big");
      const forward = await inboxComposePrefill(deps(), a, { messageId: row.id, mode: "forward" });
      expect(forward.attachments.map((f) => f.filename)).toEqual(["big.bin"]);
      expect(forward).toMatchObject({
        attachmentsTooLarge: true,
        attachmentsLeftOut: [{ filename: "big2.bin", size: expect.any(Number) }],
      });
    });

    it("does not reveal another user's, another space's or a revoked account's message", async () => {
      const theirs = await cache(b, connB, "b-1");
      const otherSpace = await cache(c, connC, "c-1");
      const revoked = await cache(a, revokedA, "r-1");
      for (const row of [theirs, otherSpace, revoked]) {
        await expect(
          inboxComposePrefill(deps(), a, { messageId: row.id, mode: "reply" }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
    });
  });

  describe("draftSave", () => {
    it("saves one Gmail draft for a client id and replaces it on the next save", async () => {
      const input = fields();
      expect(await inboxComposeDraftSave(deps(), a, input)).toEqual({ status: "saved" });
      expect(gmail.draftsOf("box-a")).toHaveLength(1);
      expect(gmail.sentOf("box-a")).toHaveLength(0);
      await inboxComposeDraftSave(deps(), a, { ...input, subject: "Hello again" });
      const drafts = gmail.draftsOf("box-a");
      expect(drafts).toHaveLength(1);
      expect(drafts[0]?.raw).toContain("Hello again");
      const row = await prisma.composeSend.findFirstOrThrow({ where: { userId: userA } });
      expect(row).toMatchObject({ spaceId: spaceA, connectionId: connA, state: "draft" });
      expect(row.draftId).toBe(drafts[0]?.id);
    });

    it("saves a reply into the original thread", async () => {
      const row = await cache(a, connA, "a-1", "t-a1");
      await inboxComposeDraftSave(
        deps(),
        a,
        fields({ replyToMessageId: row.id, subject: "Re: Subject a-1" }),
      );
      expect(gmail.draftsOf("box-a")[0]?.threadId).toBe("t-a1");
    });

    it("only uses the caller's own connected accounts and keeps clients apart", async () => {
      for (const connectionId of [connB, connC, revokedA, "nope"]) {
        await expect(
          inboxComposeDraftSave(deps(), a, fields({ connectionId })),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
      const other = await cache(b, connB, "b-1");
      await expect(
        inboxComposeDraftSave(deps(), a, fields({ replyToMessageId: other.id })),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(gmail.draftsOf("box-a")).toHaveLength(0);
      expect(gmail.draftsOf("box-b")).toHaveLength(0);

      // The same client id from two users is two separate drafts.
      await inboxComposeDraftSave(deps(), a, fields({ clientId: "same-client-id" }));
      await inboxComposeDraftSave(
        deps(),
        b,
        fields({ clientId: "same-client-id", connectionId: connB }),
      );
      expect(gmail.draftsOf("box-a")).toHaveLength(1);
      expect(gmail.draftsOf("box-b")).toHaveLength(1);
      expect(await prisma.composeSend.count({ where: { clientId: "same-client-id" } })).toBe(2);
    });

    it("does not let a draft change accounts", async () => {
      const input = fields();
      await inboxComposeDraftSave(deps(), a, input);
      const second = await connect(a, "box-a");
      await expect(
        inboxComposeDraftSave(deps(), a, { ...input, connectionId: second }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await prisma.connection.delete({ where: { id: second } });
    });
  });

  describe("send", () => {
    it("sends the draft once, records it, and a repeat or concurrent send adds nothing", async () => {
      const input = fields();
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "sent" });
      expect(gmail.sentOf("box-a")).toHaveLength(1);
      expect(gmail.draftsOf("box-a")).toHaveLength(0);
      const row = await prisma.composeSend.findFirstOrThrow({
        where: { clientId: input.clientId },
      });
      expect(row).toMatchObject({ state: "sent" });
      expect(row.providerMessageId).toBe(gmail.sentOf("box-a")[0]?.id);

      // A retry or a second click with the same client id answers "sent" without sending.
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "sent" });
      expect(gmail.sentOf("box-a")).toHaveLength(1);

      const racing = fields();
      const results = await Promise.all([
        inboxComposeSend(deps(), a, racing),
        inboxComposeSend(deps(), a, racing),
        inboxComposeSend(deps(), a, racing),
      ]);
      expect(results).toEqual([{ status: "sent" }, { status: "sent" }, { status: "sent" }]);
      expect(gmail.sentOf("box-a")).toHaveLength(2);
      expect(sendRequests()).toHaveLength(2);
    });

    it("refuses to send a record that recovery abandoned, and reports failed", async () => {
      const input = fields();
      await prisma.composeSend.create({
        data: {
          spaceId: spaceA,
          userId: userA,
          connectionId: connA,
          clientId: input.clientId,
          state: "abandoned",
        },
      });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "failed" });
      expect(await inboxComposeDraftSave(deps(), a, input)).toEqual({ status: "failed" });
      expect(gmail.draftsOf("box-a")).toHaveLength(0);
      expect(gmail.sentOf("box-a")).toHaveLength(0);
      expect(sendRequests()).toHaveLength(0);
      expect(
        (await prisma.composeSend.findFirstOrThrow({ where: { clientId: input.clientId } })).state,
      ).toBe("abandoned");
    });

    it("sends the latest text even when no draft was saved first, and threads a reply", async () => {
      const row = await cache(a, connA, "a-1", "t-a1");
      const input = fields({ replyToMessageId: row.id, subject: "Re: Subject a-1" });
      await inboxComposeDraftSave(deps(), a, { ...input, body: "stale text" });
      await inboxComposeSend(deps(), a, input);
      const [sent] = gmail.sentOf("box-a");
      expect(sent?.threadId).toBe("t-a1");
      const mime = parseRawMime(sent?.raw ?? "");
      expect(mime.header("In-Reply-To")).toBe("<a-1@mail.example.test>");
      expect(mime.text).toBe(SECRET_BODY);
      expect(gmail.draftsOf("box-a")).toHaveLength(0);
    });

    it("sends sanitized HTML, a text copy made from it, and attachments", async () => {
      const input = fields({
        to: "a@example.test, b@example.test",
        cc: "c@example.test",
        bcc: "d@example.test",
        html: '<p>Hi <strong>there</strong> <script>x()</script><a href="javascript:x()">no</a></p>',
        attachments: [
          {
            filename: "note.txt",
            mimeType: "text/plain",
            data: Buffer.from("hello").toString("base64"),
          },
        ],
      });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "sent" });
      const mime = parseRawMime(gmail.sentOf("box-a")[0]?.raw ?? "");
      expect(mime.header("To")).toBe("a@example.test, b@example.test");
      expect(mime.header("Bcc")).toBe("d@example.test");
      expect(mime.html).toBe("<p>Hi <strong>there</strong> no</p>");
      expect(mime.text).toBe("Hi there no");
      expect(mime.types).toContain("text/plain");
      expect(gmail.sentOf("box-a")[0]?.raw).toContain(Buffer.from("hello").toString("base64"));
    });

    it("attaches the original's chosen files to a forward, next to uploads", async () => {
      const row = await cache(a, connA, "a-files");
      const { attachments } = await inboxComposePrefill(deps(), a, {
        messageId: row.id,
        mode: "forward",
      });
      const one = attachments[0]?.id as string;
      const input = fields({
        forwardOf: { messageId: row.id, attachmentIds: [one] },
        attachments: [{ filename: "up.txt", mimeType: "text/plain", data: b64("uploaded") }],
      });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "sent" });
      const raw = gmail.sentOf("box-a")[0]?.raw ?? "";
      expect(raw).toContain('filename="one.txt"');
      expect(raw).toContain(b64("hello"));
      expect(raw).toContain(b64("uploaded"));
      expect(raw).not.toContain("two.bin");
    });

    it("does not forward files of a message that is not the caller's or does not exist", async () => {
      const theirs = await cache(b, connB, "b-1");
      for (const messageId of [theirs.id, "nope"]) {
        await expect(
          inboxComposeSend(deps(), a, fields({ forwardOf: { messageId, attachmentIds: ["1"] } })),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
      }
      expect(gmail.sentOf("box-a")).toHaveLength(0);
    });

    it("sends nothing when uploads plus forwarded files are over the limit", async () => {
      const row = await cache(a, connA, "a-big");
      const ids = ["1", "2"];
      const input = fields({
        forwardOf: { messageId: row.id, attachmentIds: ids },
        attachments: [{ filename: "up.bin", mimeType: "application/zip", data: big(1) }],
      });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "failed" });
      expect(gmail.sentOf("box-a")).toHaveLength(0);
      expect(gmail.draftsOf("box-a")).toHaveLength(0);
    });

    it("rejects attachments over the size limit or not base64, before any state changes", async () => {
      const big = Buffer.alloc(10 * 1024 * 1024 + 1).toString("base64");
      await expect(
        inboxComposeSend(
          deps(),
          a,
          fields({
            attachments: [{ filename: "big.bin", mimeType: "application/zip", data: big }],
          }),
        ),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        inboxComposeSend(
          deps(),
          a,
          fields({ attachments: [{ filename: "x.bin", mimeType: "text/plain", data: "***" }] }),
        ),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(gmail.sentOf("box-a")).toHaveLength(0);
    });

    it("syncs the mailbox afterwards through the sync job so the sent message is cached", async () => {
      const input = fields();
      queued.length = 0;
      await inboxComposeSend(deps(), a, input);
      expect(queued.filter((job) => job.name === "mail.sync").map((job) => job.payload)).toEqual([
        { spaceId: a.spaceId, userId: a.userId, connectionId: connA },
      ]);
      const sent = gmail.sentOf("box-a")[0];
      const cached = await prisma.cachedMailMessage.findFirst({
        where: { connectionId: connA, providerMessageId: sent?.id },
      });
      expect(cached).toMatchObject({ fromSelf: true, inInbox: false });
    });

    it("answers unknown after an unclear failure and never sends again for that client id", async () => {
      const input = fields();
      gmail.failNext(500, { urlIncludes: "drafts/send", times: 10 });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "unknown" });
      expect(
        (await prisma.composeSend.findFirstOrThrow({ where: { clientId: input.clientId } })).state,
      ).toBe("unknown");
      gmail.clearFailures();
      const before = sendRequests().length;
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "unknown" });
      expect(await inboxComposeDraftSave(deps(), a, input)).toEqual({ status: "unknown" });
      expect(sendRequests()).toHaveLength(before);
      expect(gmail.sentOf("box-a")).toHaveLength(0);
    });

    it("treats a send left pending by a crashed process as unknown, not as sendable", async () => {
      const input = fields();
      await inboxComposeDraftSave(deps(), a, input);
      await prisma.composeSend.updateMany({
        where: { clientId: input.clientId },
        data: { state: "pending", updatedAt: new Date(Date.now() - 10 * 60_000) },
      });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "unknown" });
      expect(sendRequests()).toHaveLength(0);
    });

    it("allows another try after a failure that proves nothing was sent", async () => {
      const input = fields();
      gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({
        status: "failed",
        reason: "rejected",
      });
      expect(gmail.sentOf("box-a")).toHaveLength(0);
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "sent" });
      expect(gmail.sentOf("box-a")).toHaveLength(1);
    });

    it("asks to reconnect when Gmail refuses the permission, and flags the account", async () => {
      const input = fields();
      gmail.failNext(403, { urlIncludes: "/drafts", reason: "insufficientPermissions", times: 10 });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "reconnect" });
      expect(await inboxComposeDraftSave(deps(), a, fields())).toEqual({ status: "reconnect" });
      const state = await prisma.mailSyncState.findUniqueOrThrow({
        where: { connectionId: connA },
      });
      expect(state.needsReconnect).toBe(true);
      expect(state.lastErrorAt).not.toBeNull();
      gmail.clearFailures();
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "sent" });
    });

    it("refuses another user's account and never sends for it", async () => {
      await expect(
        inboxComposeSend(deps(), a, fields({ connectionId: connB })),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        inboxComposeSend(deps(), a, fields({ connectionId: connC })),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(gmail.sentOf("box-b")).toHaveLength(0);
      expect(gmail.sentOf("box-c")).toHaveLength(0);
    });

    it("sends nothing when writes are turned off, and drafts nothing either", async () => {
      const off = deps({ mailWritesDisabled: true });
      expect(await inboxComposeSend(off, a, fields())).toEqual({ status: "disabled" });
      expect(await inboxComposeDraftSave(off, a, fields())).toEqual({ status: "disabled" });
      expect(requests.filter((r) => r.method !== "GET")).toHaveLength(0);
      expect(await prisma.composeSend.count({ where: { spaceId: spaceA } })).toBe(0);
      // Reading the original to reply still works.
      const row = await cache(a, connA, "a-1", "t-a1");
      await expect(
        inboxComposePrefill(off, a, { messageId: row.id, mode: "reply" }),
      ).resolves.toBeTruthy();
    });

    it("keeps message text and recipients out of the logs", async () => {
      const log = getLogger();
      const spies = (["debug", "info", "warn", "error"] as const).map((level) =>
        vi.spyOn(log, level).mockImplementation(() => {}),
      );
      await inboxComposeDraftSave(deps(), a, fields());
      gmail.failNext(500, { urlIncludes: "drafts/send", times: 10 });
      await inboxComposeSend(deps(), a, fields());
      gmail.clearFailures();
      await inboxComposeSend(deps(), a, fields());
      const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
      expect(logged).not.toContain(SECRET_BODY);
      expect(logged).not.toContain("priya@example.test");
      expect(logged).not.toContain("Hello");
    });
  });

  describe("discard", () => {
    it("deletes the Gmail draft and the record, and leaves sent mail and other users alone", async () => {
      const input = fields();
      await inboxComposeDraftSave(deps(), a, input);
      await inboxComposeDraftSave(deps(), b, { ...input, connectionId: connB });
      await inboxComposeDiscard(deps(), b, { clientId: input.clientId });
      expect(gmail.draftsOf("box-b")).toHaveLength(0);
      expect(gmail.draftsOf("box-a")).toHaveLength(1);
      await inboxComposeDiscard(deps(), a, { clientId: input.clientId });
      expect(gmail.draftsOf("box-a")).toHaveLength(0);
      expect(await prisma.composeSend.count({ where: { clientId: input.clientId } })).toBe(0);

      const sent = fields();
      await inboxComposeSend(deps(), a, sent);
      await inboxComposeDiscard(deps(), a, { clientId: sent.clientId });
      expect(gmail.sentOf("box-a")).toHaveLength(1);
      expect(await prisma.composeSend.count({ where: { clientId: sent.clientId } })).toBe(1);
    });
  });

  describe("rate limits", () => {
    it("answers a discard that Gmail rate limits with its own error", async () => {
      const input = fields();
      await inboxComposeDraftSave(deps(), a, input);
      gmail.failNext(429, { urlIncludes: "/drafts/", times: 100 });
      await expect(
        inboxComposeDiscard(deps(), a, { clientId: input.clientId }),
      ).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
        message: "Gmail is busy. Try again in a moment.",
      });
      gmail.clearFailures();
      expect(await inboxComposeDiscard(deps(), a, { clientId: input.clientId })).toEqual({
        ok: true,
      });
    });
  });

  describe("regressions", () => {
    it("recreates a draft that was deleted in Gmail, for both a save and a send", async () => {
      const input = fields();
      await inboxComposeDraftSave(deps(), a, input);
      const [first] = gmail.draftsOf("box-a");
      gmail.handle(
        "box-a",
        `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${first?.id}`,
        "DELETE",
      );
      expect(gmail.draftsOf("box-a")).toHaveLength(0);

      expect(await inboxComposeDraftSave(deps(), a, { ...input, subject: "Again" })).toEqual({
        status: "saved",
      });
      expect(gmail.draftsOf("box-a")).toHaveLength(1);
      const [second] = gmail.draftsOf("box-a");
      gmail.handle(
        "box-a",
        `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${second?.id}`,
        "DELETE",
      );

      expect(await inboxComposeSend(deps(), a, { ...input, subject: "Third" })).toEqual({
        status: "sent",
      });
      expect(gmail.sentOf("box-a")).toHaveLength(1);
      const row = await prisma.composeSend.findFirstOrThrow({
        where: { clientId: input.clientId },
      });
      expect(row.state).toBe("sent");
    });

    it("answers failed, and lets the user try again, when the rate limit never lets up", async () => {
      const input = fields();
      gmail.failNext(429, { urlIncludes: "drafts/send", times: 10 });
      expect(await inboxComposeSend(deps(), a, input)).toEqual({
        status: "failed",
        reason: "rate_limited",
      });
      expect(
        (await prisma.composeSend.findFirstOrThrow({ where: { clientId: input.clientId } })).state,
      ).toBe("failed");
      gmail.clearFailures();
      expect(await inboxComposeSend(deps(), a, input)).toEqual({ status: "sent" });
      expect(gmail.sentOf("box-a")).toHaveLength(1);
    });

    it("refuses a reply whose original belongs to another of the caller's accounts", async () => {
      const second = await connect(a, "box-b");
      const original = await cache(a, second, "b-1");
      await expect(
        inboxComposeSend(deps(), a, fields({ replyToMessageId: original.id })),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(gmail.sentOf("box-a")).toHaveLength(0);
      await prisma.connection.delete({ where: { id: second } });
    });

    it("sends nothing once the account is disconnected, even for a saved draft", async () => {
      const input = fields();
      await inboxComposeDraftSave(deps(), a, input);
      await prisma.connection.update({ where: { id: connA }, data: { status: "revoked" } });
      try {
        await expect(inboxComposeSend(deps(), a, input)).rejects.toMatchObject({
          code: "NOT_FOUND",
        });
        await inboxComposeDiscard(deps(), a, { clientId: input.clientId });
      } finally {
        await prisma.connection.update({ where: { id: connA }, data: { status: "connected" } });
      }
      expect(gmail.sentOf("box-a")).toHaveLength(0);
      expect(gmail.draftsOf("box-a")).toHaveLength(1);
    });

    it("drops a connection's compose records with the connection", async () => {
      const doomed = await connect(a, "box-doomed");
      await inboxComposeDraftSave(deps(), a, fields({ connectionId: doomed }));
      expect(await prisma.composeSend.count({ where: { connectionId: doomed } })).toBe(1);
      await prisma.connection.delete({ where: { id: doomed } });
      expect(await prisma.composeSend.count({ where: { connectionId: doomed } })).toBe(0);
    });
  });

  describe("through the router", () => {
    const client = (who: Actor) =>
      createRouterClient(createRouter({ ...deps(), env: {} } as unknown as RouterDeps), {
        context: { actor: who } as never,
      });

    it("sends for the caller and rejects oversized or malformed input before Gmail is touched", async () => {
      const api = client(a);
      expect(await api.inbox.compose.send(fields())).toEqual({ status: "sent" });
      requests = [];
      const bad: Array<Record<string, unknown>> = [
        { body: "x".repeat(150_001) },
        { subject: "x".repeat(999) },
        { subject: "Hi\r\nBcc: evil@example.test" },
        { to: "not an address" },
        { to: "", cc: "", bcc: "" },
        { to: Array.from({ length: 101 }, (_, i) => `p${i}@example.test`).join(",") },
        { clientId: "x" },
      ];
      for (const patch of bad) {
        await expect(api.inbox.compose.send(fields(patch))).rejects.toMatchObject({
          code: "BAD_REQUEST",
        });
      }
      expect(requests.filter((r) => r.method !== "GET")).toHaveLength(0);
    });

    it("serves prefill and discard", async () => {
      const row = await cache(a, connA, "a-1", "t-a1");
      const api = client(a);
      expect((await api.inbox.compose.prefill({ messageId: row.id, mode: "reply" })).subject).toBe(
        "Re: Subject a-1",
      );
      expect(await api.inbox.compose.discard({ clientId: "never-saved-1" })).toEqual({ ok: true });
    });
  });
});
