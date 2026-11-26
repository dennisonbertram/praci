import type { BackgroundJob, JobPublisher } from "@rakazo/adapter-kit";
import type { EmulatedMessage, PreparedMailReply } from "@rakazo/adapters";
import {
  buildApprovalAskBlock,
  mailBatchStepSummary,
  mailReplyFlags,
  mailSendRefusal,
  parseRawMime,
  prepareMailReplyBatch,
  priorBatchRows,
  reconcileMailReplyBatches,
  runMailReplyBatch,
  startsUnticked,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { mailReplyHash } from "@rakazo/core/node/approval-effect-key";
import {
  answerWaitingRunWithTextInTransaction,
  createDb,
  createPendingSteeringRun,
  createThreadEvents,
  MAX_NEW_RECIPIENT_SENDS_PER_DAY,
  reserveNewRecipientSends,
  retryMailReplyBatch,
  runAsSystem,
  runAsTenant,
} from "@rakazo/db";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { answerEditedMailApproval } from "./mail-approval-edit.js";
import {
  mailBatchRowToComposer,
  previewMailBatch,
  readMailBatch,
  retryMailBatch,
  sendMailBatch,
} from "./mail-reply-batch.js";
import type { MailFixture } from "./test-support/mail-fixture.js";
import { createMailFixture, daysAgo } from "./test-support/mail-fixture.js";
import { sendThreadMessage, stopThreadRuns } from "./thread-target.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("mail_reply_batch (PostgreSQL)", () => {
  let f: MailFixture;
  let prisma: MailFixture["prisma"];
  let botId: string;
  let threadId: string;
  let enqueued: BackgroundJob[];
  let onSync: (() => Promise<void>) | undefined;
  let seq = 0;
  const jobs: JobPublisher = {
    enqueue: async (job) => {
      enqueued.push(job);
      if (job.name === "mail.sync") await onSync?.();
    },
    cancel: async () => {},
    close: async () => {},
  };
  const events = () => createThreadEvents(prisma);
  const scope = () => ({ spaceId: f.a.spaceId, userId: f.a.userId });
  const target = () => ({ threadId });
  const workerDeps = () => ({ prisma, mail: f.mail, jobs, events: events() });
  const rpcDeps = () => ({ prisma, mail: f.mail, jobs, events: events() });

  const THREADS = ["t1", "t2", "t3", "t4"];
  const inbound = (
    thread: string,
    id = `${thread}-m1`,
    from = customer(thread),
  ): EmulatedMessage => ({
    id,
    threadId: thread,
    date: daysAgo(1).toISOString(),
    labels: ["INBOX"],
    from,
    to: "box-a@example.test",
    subject: `Subject ${thread}`,
    text: "A question",
  });
  const customer = (thread: string) => `${thread}@customer.example.test`;
  const cacheInbound = (thread: string, id = `${thread}-m1`, receivedAt = daysAgo(1)) =>
    f.cache(f.a, f.connA, id, {
      threadId: thread,
      from: customer(thread),
      receivedAt,
      signals: null,
    });

  beforeAll(async () => {
    f = await createMailFixture("batch", databaseUrl!);
    prisma = f.prisma;
    botId = (
      await prisma.bot.create({
        data: { spaceId: f.a.spaceId, userId: f.a.userId, name: "Support", color: "blue" },
      })
    ).id;
    threadId = (
      await prisma.thread.create({ data: { spaceId: f.a.spaceId, userId: f.a.userId, botId } })
    ).id;
  });
  afterAll(async () => {
    await f?.dispose();
  });
  beforeEach(async () => {
    enqueued = [];
    onSync = undefined;
    await f.wipe();
    f.seed({ "box-a": THREADS.map((thread) => inbound(thread)) });
    for (const thread of THREADS) await cacheInbound(thread);
    await prisma.bot.update({
      where: { id: botId },
      data: { disabledBuiltinTools: [], firewall: false },
    });
    await prisma.connection.update({
      where: { id: f.connA },
      data: { agentBotId: null, writesEnabled: false, status: "connected", allAgents: true },
    });
    await prisma.botConnectionAccess.deleteMany({ where: { botId } });
  });
  afterEach(async () => {
    await prisma.run.deleteMany({ where: { threadId } });
    await prisma.message.deleteMany({ where: { threadId } });
    await prisma.task.deleteMany({ where: { threadId } });
    await prisma.event.deleteMany({ where: { threadId } });
  });

  const argsFor = (threads: string[], extra: Record<string, unknown> = {}) => ({
    replies: threads.map((thread) => ({
      replyToId: `${thread}-m1`,
      to: [customer(thread)],
      subject: `Re: Subject ${thread}`,
      body: `Hello ${thread}`,
      ...extra,
    })),
  });

  /** A waiting run with the batch's card and rows, as the executor leaves it. */
  async function card(
    threads = ["t1", "t2", "t3"],
    args: Record<string, unknown> = argsFor(threads),
    extra: { refuseNewEmail?: boolean; outsideContent?: boolean } = {},
  ) {
    const n = seq++;
    const task = await prisma.task.create({
      data: { ...scope(), botId, threadId, prompt: "p", status: "running" },
    });
    const run = await prisma.run.create({
      data: {
        ...scope(),
        botId,
        threadId,
        taskId: task.id,
        status: "waiting_input",
        trigger: "user",
      },
    });
    const effect = await prisma.externalEffect.create({
      data: {
        spaceId: f.a.spaceId,
        runId: run.id,
        kind: "mail_reply_batch",
        idempotencyKey: `batch-${process.pid}-${Date.now()}-${n}`,
        status: "intended",
        request: args as never,
      },
    });
    const prepared = await prepare(effect.id, run.id, args, extra);
    if ("error" in prepared) throw new Error(prepared.error);
    const message = await prisma.message.create({
      data: {
        threadId,
        seq: 1000 + n,
        role: "bot",
        runId: run.id,
        botId,
        blocks: [
          buildApprovalAskBlock(effect.id, "mail_reply_batch", args, [], {
            mailBatch: prepared.rows,
          }) as never,
        ],
      },
    });
    return {
      run,
      effect,
      message,
      rows: prepared.rows,
      ids: { runId: run.id, messageId: message.id },
    };
  }
  const prepare = async (
    effectId: string,
    runId: string,
    args: Record<string, unknown>,
    extra: { refuseNewEmail?: boolean; outsideContent?: boolean } = {},
  ) =>
    prepareMailReplyBatch(
      {
        prisma,
        accounts: () =>
          f.mail
            .listAccounts(scope(), {
              operationId: "t",
              traceId: "t",
              ...scope(),
              signal: new AbortController().signal,
            })
            .then((accounts) => accounts.filter((account) => account.id === f.connA)),
        scope: { ...scope(), botId },
        runId,
        effectId,
        secrets: [],
        prior: await priorBatchRows(prisma, scope(), runId),
        ...extra,
      },
      args,
    );

  type Card = Awaited<ReturnType<typeof card>>;
  const read = (c: Card, who: Actor = f.a) => readMailBatch(rpcDeps(), who, target(), c.ids);
  const pressRows = async (c: Card, ticked: number[], edits: Record<number, object> = {}) => {
    const { rows } = await read(c);
    // What the card shows: the flags of each row as it stands with its edits.
    const shown = await Promise.all(
      ticked.map(async (index) =>
        edits[index]
          ? (
              await previewMailBatch(rpcDeps(), f.a, target(), {
                ...c.ids,
                rows: [{ itemId: rows[index]!.itemId, edits: edits[index] as never }],
              })
            ).rows[0]!.flags
          : rows[index]!.flags,
      ),
    );
    return ticked.map((index, position) => ({
      itemId: rows[index]!.itemId,
      hash: rows[index]!.hash,
      seenMessageId: rows[index]!.seenMessageId,
      flags: shown[position]!,
      ...(edits[index] ? { edits: edits[index] } : {}),
    }));
  };
  const press = async (c: Card, ticked: number[], edits: Record<number, object> = {}) =>
    sendMailBatch(rpcDeps(), f.a, target(), {
      ...c.ids,
      rows: await pressRows(c, ticked, edits),
    });
  const work = (c: Card) => runMailReplyBatch(workerDeps(), { effectId: c.effect.id, ...scope() });
  const reconcile = (minutes = 3) =>
    reconcileMailReplyBatches({
      prisma,
      jobs,
      events: events(),
      now: new Date(Date.now() + minutes * 60_000),
      batchSize: 100,
    });
  const rowsOf = (c: Card) =>
    prisma.mailReplyItem.findMany({
      where: { effectId: c.effect.id },
      orderBy: { position: "asc" },
    });
  const effectOf = (c: Card) =>
    prisma.externalEffect.findUniqueOrThrow({ where: { id: c.effect.id } });
  const runStatus = async (c: Card) =>
    (await prisma.run.findUniqueOrThrow({ where: { id: c.run.id } })).status;
  const sent = () =>
    f.gmail.sentOf("box-a").map((draft) => {
      const mime = parseRawMime(draft.raw);
      return {
        threadId: draft.threadId,
        to: mime.header("to") ?? "",
        cc: mime.header("cc") ?? "",
        text: (mime.text ?? "").trim(),
      };
    });
  const recordOf = (itemId: string) =>
    prisma.composeSend.findUniqueOrThrow({
      where: {
        spaceId_userId_clientId: { ...scope(), clientId: `agent:batch_${itemId}` },
      },
    });
  const resumes = () => enqueued.filter((job) => job.name === "run.continue");
  const flagsOf = (rows: PreparedMailReply[]) => rows.map((row) => row.flags);
  const flagged = async (c: Card) =>
    (await mailReplyFlags(prisma, scope(), await rowsOf(c))).map((row) => row.flags);

  describe("S1: proposal", () => {
    it("makes one set of rows when the call is replayed", async () => {
      const c = await card();
      const again = await prepare(c.effect.id, c.run.id, argsFor(["t1", "t2", "t3"]));
      expect("rows" in again && again.rows.map((row) => row.id)).toEqual(c.rows.map((r) => r.id));
      expect(await rowsOf(c)).toHaveLength(3);
    });

    it("stores the newest inbound message of each thread as seen", async () => {
      await cacheInbound("t1", "t1-m2", new Date());
      const c = await card();
      const [first] = await rowsOf(c);
      expect(first?.seenMessageId).toBe("t1-m2");
      expect(flagsOf(c.rows)).toEqual([[], [], []]);
    });

    describe("flags", () => {
      it("Not on this thread: a recipient who took no part", async () => {
        const c = await card(["t1"], {
          replies: [{ ...argsFor(["t1"]).replies[0], cc: ["stranger@elsewhere.example.test"] }],
        });
        expect(flagsOf(c.rows)).toEqual([["not_on_thread", "new_recipient"]]);
      });

      it("Not on this thread: a Cc hidden in a To entry", async () => {
        const c = await card(["t1"], {
          replies: [
            {
              ...argsFor(["t1"]).replies[0],
              to: [`${customer("t1")}, hidden@elsewhere.example.test`],
            },
          ],
        });
        expect(flagsOf(c.rows)).toEqual([["not_on_thread", "new_recipient"]]);
        // The row is split, so the card shows both, bare.
        expect((await read(c)).rows[0]?.to).toEqual([
          customer("t1"),
          "hidden@elsewhere.example.test",
        ]);
      });

      it("a display name cannot make an outsider look like a participant", async () => {
        const c = await card(["t1"], {
          replies: [
            {
              ...argsFor(["t1"]).replies[0],
              to: [`"${customer("t1")}" <attacker@elsewhere.example.test>`],
            },
          ],
        });
        expect(flagsOf(c.rows)).toEqual([["not_on_thread", "new_recipient"]]);
      });

      it("New message: a newer inbound message after the proposal, and none for our own", async () => {
        const c = await card(["t1"]);
        await f.cache(f.a, f.connA, "t1-self", {
          threadId: "t1",
          from: "box-a@example.test",
          fromSelf: true,
          receivedAt: new Date(),
          signals: null,
        });
        expect(await flagged(c)).toEqual([[]]);
        await cacheInbound("t1", "t1-m2", new Date());
        expect(await flagged(c)).toEqual([["new_message"]]);
      });

      it("Important sender: a marked sender in the thread, or a recipient in Contacts", async () => {
        await prisma.inboxSenderFeedback.create({
          data: {
            ...scope(),
            senderAddress: customer("t1"),
            mark: "important",
          },
        });
        await prisma.contact.create({
          data: { ...scope(), name: "A contact", email: "contact@customer.example.test" },
        });
        await prisma.cachedMailMessage.updateMany({
          where: { providerMessageId: "t2-m1" },
          data: { ccAddresses: ["contact@customer.example.test"] },
        });
        const c = await card(["t1", "t2", "t3"], {
          replies: [
            argsFor(["t1"]).replies[0],
            { ...argsFor(["t2"]).replies[0], cc: ["contact@customer.example.test"] },
            argsFor(["t3"]).replies[0],
          ],
        });
        expect(flagsOf(c.rows)).toEqual([["important_sender"], ["important_sender"], []]);
        await prisma.inboxSenderFeedback.deleteMany({ where: scope() });
        await prisma.contact.deleteMany({ where: scope() });
      });

      it("No-reply address", async () => {
        await prisma.cachedMailMessage.updateMany({
          where: { providerMessageId: "t1-m1" },
          data: { fromAddress: "no-reply@customer.example.test" },
        });
        const c = await card(["t1"], {
          replies: [{ ...argsFor(["t1"]).replies[0], to: ["no-reply@customer.example.test"] }],
        });
        expect(flagsOf(c.rows)).toEqual([["no_reply_address"]]);
      });

      it("Already sent: the same text to the same people in this thread moments ago", async () => {
        const reply = argsFor(["t1"]).replies[0]!;
        await prisma.cachedMailMessage.create({
          data: {
            ...scope(),
            connectionId: f.connA,
            providerMessageId: "t1-sent",
            threadId: "t1",
            fromAddress: "me@example.test",
            toAddresses: reply.to,
            ccAddresses: [],
            subject: reply.subject,
            snippet: reply.body.slice(0, 20),
            receivedAt: new Date(Date.now() - 60_000),
            unread: false,
            fromSelf: true,
            seenAt: new Date(),
          },
        });
        const c = await card(["t1"]);
        expect(flagsOf(c.rows)).toEqual([["already_sent"]]);
        expect(startsUnticked(c.rows[0]!.flags)).toBe(true);
        await prisma.cachedMailMessage.deleteMany({ where: { providerMessageId: "t1-sent" } });
      });

      it("You said no reply needed", async () => {
        await prisma.mailSenderStat.create({
          data: {
            ...scope(),
            connectionId: f.connA,
            senderAddress: customer("t1"),
            noReplyCount: 3,
          },
        });
        const c = await card(["t1"]);
        expect(flagsOf(c.rows)).toEqual([["no_reply_needed"]]);
      });

      it("Has a link stays ticked; the most serious flag comes first", async () => {
        const c = await card(["t1", "t2"], {
          replies: [
            { ...argsFor(["t1"]).replies[0], body: "See https://example.test/a" },
            {
              ...argsFor(["t2"]).replies[0],
              body: "See www.example.test",
              cc: ["stranger@elsewhere.example.test"],
            },
          ],
        });
        expect(flagsOf(c.rows)).toEqual([
          ["has_link"],
          ["not_on_thread", "new_recipient", "has_link"],
        ]);
        expect(flagsOf(c.rows).map(startsUnticked)).toEqual([false, true]);
      });

      it("rarely answered gets no flag", async () => {
        await prisma.mailSenderStat.create({
          data: {
            ...scope(),
            connectionId: f.connA,
            senderAddress: customer("t1"),
            messageCount: 50,
            priorContact: false,
          },
        });
        const c = await card(["t1"]);
        expect(flagsOf(c.rows)).toEqual([[]]);
      });
    });

    describe("the card cannot be approved or edited through the other paths", () => {
      it("an Allow answer is refused and the card stays open", async () => {
        const c = await card();
        const answered = await events().answerRunInput({
          ...c.ids,
          spaceId: f.a.spaceId,
          threadId,
          answeredByUserId: f.a.userId,
          answer: "allow",
        });
        expect(answered).toBe(false);
        expect((await effectOf(c)).status).toBe("intended");
        expect(await runStatus(c)).toBe("waiting_input");
      });

      it("composer text cannot answer it", async () => {
        const c = await card();
        const answered = await prisma.$transaction((tx) =>
          answerWaitingRunWithTextInTransaction(tx, {
            spaceId: f.a.spaceId,
            threadId,
            runId: c.run.id,
            answeredByUserId: f.a.userId,
            answer: "send them",
          }),
        );
        expect(answered).toBeNull();
        expect(await runStatus(c)).toBe("waiting_input");
      });

      it("the single card's edit path refuses it", async () => {
        const c = await card();
        await expect(
          answerEditedMailApproval(
            { ...rpcDeps(), mailWritesDisabled: false } as never,
            f.a,
            target(),
            { ...c.ids, mail: { body: "Edited" } },
          ),
        ).rejects.toMatchObject({ code: "CONFLICT" });
        expect((await effectOf(c)).status).toBe("intended");
      });

      it("Discard denies the effect, resumes the run and sends nothing", async () => {
        const c = await card();
        expect(
          await events().answerRunInput({
            ...c.ids,
            spaceId: f.a.spaceId,
            threadId,
            answeredByUserId: f.a.userId,
            answer: "deny",
          }),
        ).toBe(true);
        expect((await effectOf(c)).status).toBe("denied");
        expect(await runStatus(c)).toBe("queued");
        expect(enqueued).toEqual([]);
        expect(sent()).toEqual([]);
      });
    });

    describe("scope", () => {
      it("another user in the space or another space sees nothing", async () => {
        const c = await card();
        expect(
          await priorBatchRows(prisma, { spaceId: f.b.spaceId, userId: f.b.userId }, c.run.id),
        ).toEqual([]);
        expect(
          await mailReplyFlags(
            prisma,
            { spaceId: f.c.spaceId, userId: f.c.userId },
            await rowsOf(c),
          ),
        ).toMatchObject([
          { newestInboundId: null },
          { newestInboundId: null },
          { newestInboundId: null },
        ]);
      });

      it("a thread of another account is refused", async () => {
        await f.cache(f.a, f.connA2, "other-m1", { threadId: "other", signals: null });
        const refusal = await prepare("no-effect", "no-run", {
          replies: [{ ...argsFor(["t1"]).replies[0], replyToId: "other-m1" }],
        });
        expect(refusal).toEqual({
          error: expect.stringContaining("Reply 1 (other-m1) is not in the synced mail"),
        });
      });
    });
  });

  describe("S2: the press", () => {
    it("reads rows for the owner only, with bare recipients", async () => {
      const c = await card(["t1"], {
        replies: [
          {
            ...argsFor(["t1"]).replies[0],
            to: [`"${customer("t1")}" <attacker@elsewhere.example.test>`],
          },
        ],
      });
      const [row] = (await read(c)).rows;
      expect(row?.to).toEqual(["attacker@elsewhere.example.test"]);
      expect(row?.flags).toEqual(["not_on_thread", "new_recipient"]);
      expect(row?.startsUnticked).toBe(true);
      await expect(read(c, f.b)).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(read(c, f.c)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("the newest message comes back as the acknowledgement to post", async () => {
      const c = await card(["t1"]);
      await cacheInbound("t1", "t1-m2", new Date());
      const [row] = (await read(c)).rows;
      expect(row?.flags).toEqual(["new_message"]);
      expect(row?.startsUnticked).toBe(true);
      expect(row?.seenMessageId).toBe("t1-m2");
    });

    it("another user cannot press, retry or see a press applied", async () => {
      const c = await card();
      const rows = await pressRows(c, [0]);
      await expect(
        sendMailBatch(rpcDeps(), f.b, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        retryMailBatch(rpcDeps(), f.b, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await effectOf(c)).status).toBe("intended");
    });

    it("sends only ticked rows, each in its own thread", async () => {
      const c = await card();
      await press(c, [0, 2]);
      expect(sent()).toEqual([]);
      expect(enqueued.map((job) => job.name)).toEqual(["mail.reply.batch"]);
      expect((await rowsOf(c)).map((row) => row.dispatch)).toEqual(["queued", "skipped", "queued"]);
      await work(c);
      expect(sent().map((mail) => [mail.threadId, mail.to, mail.text])).toEqual([
        ["t1", customer("t1"), "Hello t1"],
        ["t3", customer("t3"), "Hello t3"],
      ]);
      const { rows } = await read(c);
      expect(rows.map((row) => row.state)).toEqual(["sent", "skipped", "sent"]);
    });

    it("sends an edit, and stores its hash as what was approved", async () => {
      const c = await card();
      await press(c, [0, 1], {
        1: {
          body: "An edited reply",
          cc: "extra@customer.example.test, second@customer.example.test",
        },
      });
      const rows = await rowsOf(c);
      expect(rows[1]?.approvedHash).toBe(mailReplyHash(rows[1]!));
      expect(rows[0]?.approvedHash).toBe(mailReplyHash(rows[0]!));
      await work(c);
      const [, edited] = sent();
      expect(edited?.text).toBe("An edited reply");
      expect(edited?.cc).toContain("extra@customer.example.test");
      expect(edited?.cc).toContain("second@customer.example.test");
    });

    it("a changed hash rejects the whole press and nothing changes", async () => {
      const c = await card();
      const rows = await pressRows(c, [0, 1]);
      await prisma.mailReplyItem.updateMany({
        where: { id: rows[1]!.itemId },
        data: { body: "Changed behind the card" },
      });
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await effectOf(c)).status).toBe("intended");
      expect((await rowsOf(c)).map((row) => row.dispatch)).toEqual([
        "reviewing",
        "reviewing",
        "reviewing",
      ]);
      expect(enqueued).toEqual([]);
    });

    it("a row of another batch cannot be posted", async () => {
      const c = await card(["t1"]);
      const other = await card(["t2"]);
      const rows = await pressRows(other, [0]);
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it.each([
      ["clears all recipients", { to: "" }],
      [
        "has too many recipients",
        {
          to: Array.from({ length: 101 }, (_, i) => `r${i}@customer.example.test`).join(", "),
        },
      ],
      ["has a bad address", { to: "not an address" }],
    ])("an edit that %s rejects the press and the card stays answerable", async (_label, edits) => {
      const c = await card();
      await expect(press(c, [0, 1], { 1: edits })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect((await effectOf(c)).status).toBe("intended");
      expect(await runStatus(c)).toBe("waiting_input");
      await press(c, [0, 1]);
      expect((await effectOf(c)).status).toBe("executing");
    });

    it("a second press sends nothing twice", async () => {
      const c = await card();
      const rows = await pressRows(c, [0]);
      await sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows });
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await work(c);
      await work(c);
      expect(sent()).toHaveLength(1);
    });

    it("rejects a stale press as changed, then a tick acknowledges the new message", async () => {
      const c = await card(["t1"]);
      const rows = await pressRows(c, [0]);
      await cacheInbound("t1", "t1-m2", new Date());
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await effectOf(c)).status).toBe("intended");
      await press(c, [0]);
      expect((await rowsOf(c))[0]?.seenMessageId).toBe("t1-m2");
      await work(c);
      expect(sent()).toHaveLength(1);
    });

    it("rejects a press for a row whose flags the client was not shown", async () => {
      const c = await card(["t1"]);
      const [row] = await pressRows(c, [0]);
      await cacheInbound("t1", "t1-m2", new Date());
      // The right acknowledgement, from a client that never showed New message.
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ ...row!, seenMessageId: "t1-m2", flags: [] }],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await effectOf(c)).status).toBe("intended");
      await press(c, [0]);
      expect((await effectOf(c)).status).toBe("executing");
    });

    it("rejects an edit whose new flag the client was not shown", async () => {
      const c = await card(["t1"]);
      const [row] = await pressRows(c, [0]);
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ ...row!, edits: { cc: "new@elsewhere.example.test" } }],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await effectOf(c)).status).toBe("intended");
    });

    it("refuses while sending is off for the bot or the deployment", async () => {
      const c = await card();
      const rows = await pressRows(c, [0]);
      await expect(
        sendMailBatch({ ...rpcDeps(), mailWritesDisabled: true }, f.a, target(), {
          ...c.ids,
          rows,
        }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      await prisma.bot.update({
        where: { id: botId },
        data: { disabledBuiltinTools: ["mail_send"] },
      });
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect((await effectOf(c)).status).toBe("intended");
    });
  });

  describe("S2: settlement", () => {
    it("the run waits through the sends and a reconciler pass, then resumes once with per-row outcomes", async () => {
      const c = await card();
      await press(c, [0, 1]);
      expect(await runStatus(c)).toBe("waiting_input");
      expect((await effectOf(c)).status).toBe("executing");
      await reconcile(0);
      expect(await runStatus(c)).toBe("waiting_input");
      // The row is queued and fresh: recovery does not touch it, and nothing resumes.
      expect(resumes()).toEqual([]);
      await work(c);
      expect(await runStatus(c)).toBe("queued");
      const settled = await effectOf(c);
      expect(settled.status).toBe("completed");
      expect(settled.result).toEqual({
        count: 3,
        sent: 2,
        failed: 0,
        unknown: 0,
        replies: [
          { replyToId: "t1-m1", outcome: "sent" },
          { replyToId: "t2-m1", outcome: "sent" },
          { replyToId: "t3-m1", outcome: "skipped" },
        ],
        note: "The user sees each reply's result on the card. Do not list them; answer in a sentence.",
      });
      expect(JSON.stringify(settled.result)).not.toContain("Hello");
      expect(resumes()).toHaveLength(1);
      await work(c);
      await reconcile();
      expect(resumes()).toHaveLength(1);
    });

    it("puts the counts on the card", async () => {
      const c = await card();
      await press(c, [0, 1]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument", skip: 1 });
      await work(c);
      const message = await prisma.message.findUniqueOrThrow({ where: { id: c.message.id } });
      expect((message.blocks as { mailBatch: unknown; status: string }[])[0]).toMatchObject({
        status: "answered",
        // The settled mark changes the card even when the last row left the counts as they were,
        // so a client reads Retry failed once it opens.
        mailBatch: { count: 3, sent: 1, failed: 1, unknown: 0, settled: true },
      });
    });

    it("Discard is no longer possible once pressed", async () => {
      const c = await card();
      await press(c, [0]);
      expect(
        await events().answerRunInput({
          ...c.ids,
          spaceId: f.a.spaceId,
          threadId,
          answeredByUserId: f.a.userId,
          answer: "deny",
        }),
      ).toBe(false);
      expect((await effectOf(c)).status).toBe("executing");
    });
  });

  describe("S2: failures and Retry failed", () => {
    it("row 2 failing does not stop row 3, and Retry sends only the failed row", async () => {
      const c = await card();
      await press(c, [0, 1, 2]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument", skip: 1 });
      await work(c);
      expect(sent().map((mail) => mail.text)).toEqual(["Hello t1", "Hello t3"]);
      const { rows } = await read(c);
      expect(rows.map((row) => row.state)).toEqual(["sent", "not_sent", "sent"]);
      expect(rows.map((row) => row.retryable)).toEqual([false, true, false]);
      expect((await effectOf(c)).result).toMatchObject({ sent: 2, failed: 1 });
      expect(await runStatus(c)).toBe("queued");
      enqueued = [];
      const count = await retryMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: rows.map((row) => ({ itemId: row.itemId, seenMessageId: row.seenMessageId })),
      });
      expect(count).toBe(1);
      await work(c);
      expect(sent().map((mail) => mail.text)).toEqual(["Hello t1", "Hello t3", "Hello t2"]);
      // A retry does not wake the agent or change its stored result.
      expect(resumes()).toEqual([]);
      expect((await effectOf(c)).result).toMatchObject({ sent: 2, failed: 1 });
      expect((await read(c)).rows.map((row) => row.state)).toEqual(["sent", "sent", "sent"]);
    });

    it("a whole-batch failure is retried after the run has ended", async () => {
      const c = await card();
      await press(c, [0, 1, 2]);
      f.gmail.failNext(429, { urlIncludes: "drafts", times: 200 });
      await work(c);
      f.gmail.clearFailures();
      expect(sent()).toEqual([]);
      expect((await effectOf(c)).result).toMatchObject({ sent: 0, failed: 3 });
      await prisma.run.update({ where: { id: c.run.id }, data: { status: "completed" } });
      const { rows } = await read(c);
      await retryMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: rows.map((row) => ({ itemId: row.itemId, seenMessageId: row.seenMessageId })),
      });
      await work(c);
      expect(sent()).toHaveLength(3);
    });

    it("cannot be retried before settlement", async () => {
      const c = await card();
      await press(c, [0]);
      const { rows } = await read(c);
      await expect(
        retryMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ itemId: rows[0]!.itemId, seenMessageId: rows[0]!.seenMessageId }],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("a second Retry press sends nothing twice", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      const { rows } = await read(c);
      const posted = {
        ...c.ids,
        rows: [{ itemId: rows[0]!.itemId, seenMessageId: rows[0]!.seenMessageId }],
      };
      expect(await retryMailBatch(rpcDeps(), f.a, target(), posted)).toBe(1);
      expect(await retryMailBatch(rpcDeps(), f.a, target(), posted)).toBe(0);
      await Promise.all([work(c), work(c)]);
      expect(sent()).toHaveLength(1);
    });

    it("a delayed worker cannot resend a failed record", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      const [row] = await rowsOf(c);
      expect((await recordOf(row!.id)).state).toBe("failed");
      // A worker that read the row before the failure and claims it now.
      await prisma.mailReplyItem.update({ where: { id: row!.id }, data: { dispatch: "queued" } });
      await work(c);
      expect(sent()).toEqual([]);
      expect((await recordOf(row!.id)).state).toBe("failed");
    });

    it("overwrites a draft changed in the mailbox after a failed attempt", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      const [row] = await rowsOf(c);
      const { draftId } = await recordOf(row!.id);
      const tampered = [
        "To: attacker@elsewhere.example.test",
        "Subject: Changed in Gmail",
        "Content-Type: text/plain",
        "",
        "Changed in Gmail",
      ].join("\r\n");
      f.gmail.handle(
        "box-a",
        `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`,
        "PUT",
        { message: { raw: Buffer.from(tampered).toString("base64url"), threadId: "t1" } },
      );
      const { rows } = await read(c);
      await retryMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: [{ itemId: rows[0]!.itemId, seenMessageId: rows[0]!.seenMessageId }],
      });
      await work(c);
      expect(sent()).toMatchObject([{ to: customer("t1"), text: "Hello t1" }]);
      expect(f.gmail.draftsOf("box-a")).toEqual([]);
    });

    it("makes a new draft on Retry when the draft is gone", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      const [row] = await rowsOf(c);
      const { draftId } = await recordOf(row!.id);
      f.gmail.handle(
        "box-a",
        `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draftId}`,
        "DELETE",
      );
      const { rows } = await read(c);
      await retryMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: [{ itemId: rows[0]!.itemId, seenMessageId: rows[0]!.seenMessageId }],
      });
      await work(c);
      expect(sent()).toMatchObject([{ text: "Hello t1" }]);
    });

    it("a send with an unclear outcome is unknown and never retried", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      f.gmail.failNext(500, { urlIncludes: "drafts/send", times: 10 });
      await work(c);
      f.gmail.clearFailures();
      const [row] = await rowsOf(c);
      expect((await recordOf(row!.id)).state).toBe("unknown");
      const { rows } = await read(c);
      expect(rows[0]).toMatchObject({ state: "unknown", retryable: false });
      expect((await effectOf(c)).result).toMatchObject({ unknown: 1, failed: 0 });
      expect(
        await retryMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ itemId: rows[0]!.itemId, seenMessageId: rows[0]!.seenMessageId }],
        }),
      ).toBe(0);
      await work(c);
      await reconcile();
      expect(sent()).toEqual([]);
      expect((await recordOf(row!.id)).state).toBe("unknown");
    });
  });

  describe("S2: holds", () => {
    const heldAfterWork = async (c: Card) => {
      await work(c);
      await reconcile();
      return (await rowsOf(c)).map((row) => [row.dispatch, row.error]);
    };

    it("a hash difference holds the row, no provider call, and is never retried", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      const [row] = await rowsOf(c);
      await prisma.mailReplyItem.update({ where: { id: row!.id }, data: { body: "Tampered" } });
      expect(await heldAfterWork(c)).toEqual([["held", "hash"]]);
      expect(sent()).toEqual([]);
      expect(f.gmail.draftsOf("box-a")).toEqual([]);
      const { rows } = await read(c);
      expect(rows[0]).toMatchObject({ state: "not_sent", retryable: false });
      expect(
        await retryMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ itemId: rows[0]!.itemId, seenMessageId: rows[0]!.seenMessageId }],
        }),
      ).toBe(0);
      await work(c);
      expect(sent()).toEqual([]);
    });

    it("a disconnected account holds the row, and recovery leaves it", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      await prisma.connection.update({ where: { id: f.connA }, data: { status: "revoked" } });
      expect(await heldAfterWork(c)).toEqual([["held", "account"]]);
      expect(sent()).toEqual([]);
    });

    it("a read-only agent's grant holds the row; a write grant sends", async () => {
      const c = await card(["t1", "t2"]);
      await press(c, [0, 1]);
      await prisma.connection.update({
        where: { id: f.connA },
        data: { agentBotId: botId === "" ? null : await ownerAgent(), writesEnabled: true },
      });
      await prisma.botConnectionAccess.create({
        data: { botId, connectionId: f.connA, ...scope(), canWrite: false },
      });
      expect(await heldAfterWork(c)).toEqual([
        ["held", "grant"],
        ["held", "grant"],
      ]);
      expect(sent()).toEqual([]);
      await prisma.botConnectionAccess.update({
        where: { connectionId_botId: { botId, connectionId: f.connA } },
        data: { canWrite: true },
      });
      const { rows } = await read(c);
      await retryMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: rows.map((row) => ({ itemId: row.itemId, seenMessageId: row.seenMessageId })),
      });
      await work(c);
      expect(sent()).toHaveLength(2);
    });

    it("the bot's sending switch holds the row", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      await prisma.bot.update({
        where: { id: botId },
        data: { disabledBuiltinTools: ["mail_send"] },
      });
      expect(await heldAfterWork(c)).toEqual([["held", "switch"]]);
      expect(sent()).toEqual([]);
    });

    it("a new message holds the row, and Retry with the acknowledgement sends", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      await cacheInbound("t1", "t1-m2", new Date());
      expect(await heldAfterWork(c)).toEqual([["held", "new_message"]]);
      expect(sent()).toEqual([]);
      const [before] = await rowsOf(c);
      await expect(
        retryMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ itemId: before!.id, seenMessageId: "t1-m1" }],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const { rows } = await read(c);
      await retryMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: [{ itemId: rows[0]!.itemId, seenMessageId: rows[0]!.seenMessageId }],
      });
      await work(c);
      expect(sent()).toHaveLength(1);
    });

    it("an invalid stored message holds the row", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      const [row] = await rowsOf(c);
      const broken = { ...row!, to: ["not an address"] };
      await prisma.mailReplyItem.update({
        where: { id: row!.id },
        data: { to: broken.to, approvedHash: mailReplyHash(broken) },
      });
      expect(await heldAfterWork(c)).toEqual([["held", "invalid"]]);
      expect(sent()).toEqual([]);
    });

    it("mail writes turned off hold the row without a record", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      await runMailReplyBatch(
        { ...workerDeps(), mailWritesDisabled: true },
        { effectId: c.effect.id, ...scope() },
      );
      expect((await rowsOf(c)).map((row) => [row.dispatch, row.error])).toEqual([
        ["held", "not_sent"],
      ]);
      expect(sent()).toEqual([]);
    });

    it("a grant revoked during the batch holds the rows not yet sent", async () => {
      const c = await card();
      await press(c, [0, 1, 2]);
      const agent = await ownerAgent();
      onSync = async () => {
        await prisma.connection.update({
          where: { id: f.connA },
          data: { agentBotId: agent, writesEnabled: true },
        });
      };
      await work(c);
      expect(sent().map((mail) => mail.text)).toEqual(["Hello t1"]);
      expect((await rowsOf(c)).map((row) => row.dispatch)).toEqual(["claimed", "held", "held"]);
    });

    it("a new message during the batch holds that row and sends the others", async () => {
      const c = await card();
      await press(c, [0, 1, 2]);
      onSync = async () => {
        onSync = undefined;
        await cacheInbound("t2", "t2-m2", new Date());
      };
      await work(c);
      expect(sent().map((mail) => mail.text)).toEqual(["Hello t1", "Hello t3"]);
      expect((await read(c)).rows.map((row) => row.state)).toEqual(["sent", "not_sent", "sent"]);
    });

    const ownerAgent = async () =>
      (
        await prisma.bot.upsert({
          where: { id: `${botId}-owner` },
          create: {
            id: `${botId}-owner`,
            ...scope(),
            name: "Inbox owner",
            color: "blue",
          },
          update: {},
        })
      ).id;
  });

  describe("S2: recovery", () => {
    /** Ages the row, its record and the effect past the staleness window. */
    const age = async (c: Card) => {
      const old = new Date(Date.now() - 10 * 60_000);
      await prisma.$executeRaw`UPDATE mail_reply_items SET "updatedAt" = ${old} WHERE "effectId" = ${c.effect.id}`;
      await prisma.$executeRaw`UPDATE external_effects SET "updatedAt" = ${old} WHERE id = ${c.effect.id}`;
      await prisma.$executeRaw`UPDATE compose_sends SET "updatedAt" = ${old} WHERE "userId" = ${f.a.userId}`;
    };
    const claimRow = async (c: Card, state?: string) => {
      const [row] = await rowsOf(c);
      await prisma.mailReplyItem.update({ where: { id: row!.id }, data: { dispatch: "claimed" } });
      if (state) {
        await prisma.composeSend.create({
          data: { ...scope(), clientId: `agent:batch_${row!.id}`, connectionId: f.connA, state },
        });
      }
      return row!.id;
    };
    const now = (extra = 0) =>
      reconcileMailReplyBatches({
        prisma,
        jobs,
        events: events(),
        now: new Date(Date.now() + extra),
        batchSize: 100,
      });

    it("enqueues a queued row again once stale, and not before", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      enqueued = [];
      await now();
      expect(enqueued).toEqual([]);
      await age(c);
      await now();
      expect(enqueued).toMatchObject([
        { name: "mail.reply.batch", payload: { effectId: c.effect.id }, keepExisting: true },
      ]);
    });

    it("moves a claimed row with no record, or one in draft, back to queued; the next job sends once", async () => {
      for (const state of [undefined, "draft"]) {
        const c = await card(["t1"]);
        await press(c, [0]);
        await claimRow(c, state);
        await age(c);
        await now();
        expect((await rowsOf(c))[0]?.dispatch).toBe("queued");
        await work(c);
        await work(c);
        expect(sent()).toHaveLength(1);
        f.seed({ "box-a": THREADS.map((thread) => inbound(thread)) });
      }
    });

    it("a killed worker leaves pending as unknown, never resent, and the batch settles", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      const id = await claimRow(c, "pending");
      await now();
      expect((await recordOf(id)).state).toBe("pending");
      expect(await runStatus(c)).toBe("waiting_input");
      await age(c);
      await now();
      expect((await recordOf(id)).state).toBe("unknown");
      await work(c);
      expect(sent()).toEqual([]);
      expect((await effectOf(c)).result).toMatchObject({
        unknown: 1,
        replies: [{ outcome: "unknown" }],
      });
      expect(await runStatus(c)).toBe("queued");
      expect(resumes()).toHaveLength(1);
    });

    it("leaves sent, failed and unknown records, and held, skipped and composer rows, alone", async () => {
      for (const state of ["sent", "failed", "unknown"]) {
        const c = await card(["t1"]);
        await press(c, [0]);
        const id = await claimRow(c, state);
        await age(c);
        await now();
        expect((await rowsOf(c))[0]?.dispatch).toBe("claimed");
        expect((await recordOf(id)).state).toBe(state);
        await prisma.composeSend.deleteMany({ where: { id: (await recordOf(id)).id } });
      }
      for (const dispatch of ["held", "skipped", "composer"]) {
        const c = await card(["t1"]);
        await press(c, [0]);
        const [row] = await rowsOf(c);
        await prisma.mailReplyItem.update({ where: { id: row!.id }, data: { dispatch } });
        await age(c);
        enqueued = [];
        await now();
        expect((await rowsOf(c))[0]?.dispatch).toBe(dispatch);
        expect(
          enqueued.filter(
            (job) => job.name === "mail.reply.batch" && job.payload.effectId === c.effect.id,
          ),
        ).toEqual([]);
      }
      expect(sent()).toEqual([]);
    });

    it("settles a batch whose worker died after the last row", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      await claimRow(c, "sent");
      await age(c);
      await now();
      expect((await effectOf(c)).status).toBe("completed");
      expect(await runStatus(c)).toBe("queued");
      expect(resumes()).toHaveLength(1);
      await age(c);
      await now();
      expect(resumes()).toHaveLength(1);
    });

    it("two workers at once send each row once", async () => {
      const c = await card();
      await press(c, [0, 1, 2]);
      await Promise.all([work(c), work(c)]);
      expect(sent()).toHaveLength(3);
      expect(resumes()).toHaveLength(1);
    });
  });

  describe("S3: edit preview", () => {
    const preview = (c: Card, rows: { itemId: string; edits: object }[], who: Actor = f.a) =>
      previewMailBatch(rpcDeps(), who, target(), { ...c.ids, rows });

    it("an edit adding a recipient flags and unticks that row; taking it out clears it", async () => {
      const c = await card(["t1", "t2"]);
      const [row] = (await read(c)).rows;
      expect(row?.flags).toEqual([]);
      expect(
        await preview(c, [{ itemId: row!.itemId, edits: { cc: "new@elsewhere.example.test" } }]),
      ).toEqual({
        rows: [
          {
            itemId: row!.itemId,
            flags: ["not_on_thread", "new_recipient"],
            startsUnticked: true,
          },
        ],
      });
      expect(await preview(c, [{ itemId: row!.itemId, edits: { cc: "" } }])).toEqual({
        rows: [{ itemId: row!.itemId, flags: [], startsUnticked: false }],
      });
    });

    it("a link added in an edit flags the row and stays ticked", async () => {
      const c = await card(["t1"]);
      const [row] = (await read(c)).rows;
      expect(
        await preview(c, [{ itemId: row!.itemId, edits: { body: "See https://example.test" } }]),
      ).toEqual({
        rows: [{ itemId: row!.itemId, flags: ["has_link"], startsUnticked: false }],
      });
    });

    it("an address that does not parse counts as off the thread", async () => {
      const c = await card(["t1"]);
      const [row] = (await read(c)).rows;
      const result = await preview(c, [{ itemId: row!.itemId, edits: { to: "not an address" } }]);
      expect(result.rows[0]).toMatchObject({ flags: ["not_on_thread"], startsUnticked: true });
    });

    it("nothing is stored, and another user or batch cannot preview", async () => {
      const c = await card(["t1"]);
      const other = await card(["t2"]);
      const [row] = (await read(c)).rows;
      const [foreign] = (await read(other)).rows;
      await preview(c, [{ itemId: row!.itemId, edits: { body: "Changed" } }]);
      expect((await rowsOf(c))[0]?.body).toBe("Hello t1");
      await expect(preview(c, [{ itemId: row!.itemId, edits: {} }], f.b)).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(preview(c, [{ itemId: foreign!.itemId, edits: {} }])).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });

  describe("S3: open in composer", () => {
    const failed = async (threads = ["t1"]) => {
      const c = await card(threads);
      await press(
        c,
        threads.map((_, i) => i),
      );
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      return c;
    };
    const open = (c: Card, itemId: string, who: Actor = f.a) =>
      mailBatchRowToComposer(rpcDeps(), who, target(), { ...c.ids, itemId });

    it("moves a failed row to composer and returns its fields, so Retry cannot send it", async () => {
      const c = await failed();
      const [row] = await rowsOf(c);
      const draft = await open(c, row!.id);
      expect(draft).toMatchObject({
        connectionId: f.connA,
        account: "box-a@example.test",
        to: [customer("t1")],
        subject: "Re: Subject t1",
        body: "Hello t1",
        replyToId: expect.any(String),
      });
      expect((await rowsOf(c))[0]?.dispatch).toBe("composer");
      const [read1] = (await read(c)).rows;
      expect(read1).toMatchObject({ state: "composer", retryable: false });
      expect(
        await retryMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ itemId: row!.id, seenMessageId: read1!.seenMessageId }],
        }),
      ).toBe(0);
      await work(c);
      await reconcile();
      expect(sent()).toEqual([]);
    });

    it("a lost response can be fetched again, and the row stays out of Retry", async () => {
      const c = await failed();
      const [row] = await rowsOf(c);
      const first = await open(c, row!.id);
      expect(await open(c, row!.id)).toEqual(first);
      expect((await rowsOf(c))[0]?.dispatch).toBe("composer");
      const [read1] = (await read(c)).rows;
      expect(
        await retryMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ itemId: row!.id, seenMessageId: read1!.seenMessageId }],
        }),
      ).toBe(0);
      await expect(open(c, row!.id, f.b)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("is refused for a sent row, a hash hold, before settlement, and for another user", async () => {
      const c = await card(["t1", "t2"]);
      await press(c, [0, 1]);
      const [first, second] = await rowsOf(c);
      await expect(open(c, first!.id)).rejects.toMatchObject({ code: "CONFLICT" });
      await prisma.mailReplyItem.update({ where: { id: second!.id }, data: { body: "Tampered" } });
      await work(c);
      await expect(open(c, first!.id)).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(open(c, second!.id)).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(open(c, second!.id, f.b)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect((await rowsOf(c))[1]?.dispatch).toBe("held");
    });

    it("mail_send cannot repeat a row taken to the composer", async () => {
      const c = await failed();
      const [row] = await rowsOf(c);
      await open(c, row!.id);
      const refusal = mailSendRefusal(
        { to: [customer("t1")], subject: "Re: Subject t1", body: "Other", replyToId: "t1-m1" },
        await priorBatchRows(prisma, scope(), c.run.id),
        c.run.id,
      );
      expect(refusal).toEqual(expect.stringContaining("Do not send it again"));
    });
  });

  describe("S3: card counts on Retry", () => {
    it("a retried row leaves the failed count at once and comes back if it fails again", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      const counts = async () =>
        (
          (await prisma.message.findUniqueOrThrow({ where: { id: c.message.id } })).blocks as {
            mailBatch: { failed: number };
          }[]
        )[0]?.mailBatch.failed;
      expect(await counts()).toBe(1);
      const { rows } = await read(c);
      await retryMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: [{ itemId: rows[0]!.itemId, seenMessageId: rows[0]!.seenMessageId }],
      });
      expect(await counts()).toBe(0);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      expect(await counts()).toBe(1);
    });
  });

  describe("S2: racing retries", () => {
    const failedOne = async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      const [row] = await rowsOf(c);
      expect((await recordOf(row!.id)).state).toBe("failed");
      const posted = (await read(c)).rows.map((r) => ({
        itemId: r.itemId,
        seenMessageId: r.seenMessageId,
      }));
      return { c, itemId: row!.id, posted };
    };
    /** A client whose retry pauses right after it read the compose record, until `resume`. */
    const pausedRetryClient = (resume: Promise<void>) => {
      let reached = () => {};
      const read = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const client = new Proxy(prisma, {
        get(target, key, receiver) {
          if (key !== "$transaction") return Reflect.get(target, key, receiver);
          return (run: (tx: never) => Promise<unknown>) =>
            target.$transaction((tx) =>
              run(
                new Proxy(tx, {
                  get(txTarget, txKey, txReceiver) {
                    const value = Reflect.get(txTarget, txKey, txReceiver);
                    if (txKey !== "composeSend") return value;
                    return new Proxy(value as object, {
                      get(delegate, method) {
                        const call = Reflect.get(delegate, method) as (
                          ...args: unknown[]
                        ) => Promise<unknown>;
                        if (method !== "findUnique") return call.bind(delegate);
                        return async (...args: unknown[]) => {
                          const result = await call.apply(delegate, args);
                          reached();
                          await resume;
                          return result;
                        };
                      },
                    });
                  },
                }) as never,
              ),
            );
        },
      });
      return { client, read };
    };
    const retryInput = (c: Card, rows: { itemId: string; seenMessageId: string | null }[]) => ({
      ...scope(),
      effectId: c.effect.id,
      rows,
    });

    it("two retries at once send exactly once", async () => {
      const { c, posted } = await failedOne();
      const counts = await Promise.all([
        retryMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows: posted }),
        retryMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows: posted }),
      ]);
      expect(counts.reduce((sum, count) => sum + count, 0)).toBe(1);
      await Promise.all([work(c), work(c)]);
      await reconcile();
      await work(c);
      expect(sent()).toHaveLength(1);
    });

    it("a retry that read a failed record cannot reset a send that already went out", async () => {
      const { c, itemId, posted } = await failedOne();
      let resume = () => {};
      const paused = pausedRetryClient(
        new Promise<void>((resolve) => {
          resume = resolve;
        }),
      );
      const stale = retryMailReplyBatch(paused.client, retryInput(c, posted));
      await paused.read;
      // The other retry wins and its send goes out while the first is still holding its stale read.
      expect(await retryMailReplyBatch(prisma, retryInput(c, posted))).toMatchObject({ count: 1 });
      await work(c);
      expect((await recordOf(itemId)).state).toBe("sent");
      resume();
      expect(await stale).toMatchObject({ count: 0 });
      expect((await recordOf(itemId)).state).toBe("sent");
      await prisma.$executeRaw`UPDATE mail_reply_items SET "updatedAt" = ${new Date(Date.now() - 600_000)} WHERE id = ${itemId}`;
      await reconcile();
      await work(c);
      expect(sent()).toHaveLength(1);
    });

    it("rolls the row back when the record is no longer failed", async () => {
      const { c, itemId, posted } = await failedOne();
      let resume = () => {};
      const paused = pausedRetryClient(
        new Promise<void>((resolve) => {
          resume = resolve;
        }),
      );
      const stale = retryMailReplyBatch(paused.client, retryInput(c, posted));
      await paused.read;
      await prisma.composeSend.updateMany({
        where: { clientId: `agent:batch_${itemId}` },
        data: { state: "unknown" },
      });
      resume();
      expect(await stale).toMatchObject({ count: 0 });
      expect((await rowsOf(c))[0]?.dispatch).toBe("claimed");
      expect((await recordOf(itemId)).state).toBe("unknown");
      await work(c);
      expect(sent()).toEqual([]);
    });
  });

  describe("S2: recovery past finished rows", () => {
    it("reaches an interrupted row behind more than a batch of finished ones", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      const [interrupted] = await rowsOf(c);
      await prisma.mailReplyItem.update({
        where: { id: interrupted!.id },
        data: { dispatch: "claimed" },
      });
      // Finished rows of invented batches, all older than the interrupted row.
      const older = new Date(Date.now() - 60 * 60_000);
      const states = ["sent", "failed", "unknown"];
      const finished = Array.from({ length: 6 }, (_, i) => `finished-${c.effect.id}-${i}`);
      await prisma.mailReplyItem.createMany({
        data: finished.map((id, i) => ({
          id,
          effectId: c.effect.id,
          position: 100 + i,
          ...scope(),
          connectionId: f.connA,
          replyToId: `old-${i}`,
          providerThreadId: `old-t-${i}`,
          to: ["old@example.test"],
          cc: [],
          bcc: [],
          subject: "Old",
          body: "Old",
          dispatch: "claimed",
        })),
      });
      await prisma.composeSend.createMany({
        data: finished.map((id, i) => ({
          ...scope(),
          clientId: `agent:batch_${id}`,
          connectionId: f.connA,
          state: states[i % 3]!,
        })),
      });
      await prisma.$executeRaw`UPDATE mail_reply_items SET "updatedAt" = ${older} WHERE id = ANY(${finished})`;
      const stale = new Date(Date.now() - 10 * 60_000);
      await prisma.$executeRaw`UPDATE mail_reply_items SET "updatedAt" = ${stale} WHERE id = ${interrupted!.id}`;
      await reconcileMailReplyBatches({
        prisma,
        jobs,
        events: events(),
        now: new Date(),
        batchSize: 5,
      });
      const after = await prisma.mailReplyItem.findUniqueOrThrow({
        where: { id: interrupted!.id },
      });
      expect(after.dispatch).toBe("queued");
      expect(
        await prisma.mailReplyItem.count({ where: { id: { in: finished }, dispatch: "claimed" } }),
      ).toBe(6);
      await prisma.composeSend.deleteMany({
        where: { clientId: { in: finished.map((id) => `agent:batch_${id}`) } },
      });
    });

    it.runIf(process.env.DATABASE_RUNTIME_URL)(
      "finds interrupted rows as the runtime login, only in a system context",
      async () => {
        const runtime = createDb(process.env.DATABASE_RUNTIME_URL as string);
        try {
          const c = await card(["t1"]);
          await press(c, [0]);
          const [row] = await rowsOf(c);
          await prisma.mailReplyItem.update({
            where: { id: row!.id },
            data: { dispatch: "claimed" },
          });
          const stale = new Date(Date.now() - 10 * 60_000);
          await prisma.$executeRaw`UPDATE mail_reply_items SET "updatedAt" = ${stale} WHERE id = ${row!.id}`;
          const pass = () =>
            reconcileMailReplyBatches({
              prisma: runtime.prisma,
              jobs,
              events: createThreadEvents(runtime.prisma),
              now: new Date(),
              batchSize: 5,
            });
          await runAsTenant({ spaceId: f.c.spaceId, userId: f.c.userId }, pass);
          expect((await rowsOf(c))[0]?.dispatch).toBe("claimed");
          await runAsSystem("mail reply batch recovery test", pass);
          expect((await rowsOf(c))[0]?.dispatch).toBe("queued");
        } finally {
          await runtime.prisma.$disconnect();
          await runtime.pool.end();
        }
      },
    );
  });

  describe("S2: open checks", () => {
    const say = (text: string) =>
      sendThreadMessage(
        { prisma, events: events(), jobs } as never,
        f.a,
        { kind: "bot", botId, threadId } as never,
        { text } as never,
      );

    it("a new owner message during sending waits for settlement, and the run stays paused", async () => {
      const c = await card();
      await press(c, [0, 1]);
      await say("One more thing");
      expect(await runStatus(c)).toBe("waiting_input");
      const pending = await prisma.steeringMessage.findMany({
        where: { botId, message: { threadId } },
      });
      // Not given to the waiting run: it takes the message when it resumes, or a follow-up does.
      expect(pending).toMatchObject([{ runId: null }]);
      expect(await prisma.run.count({ where: { threadId } })).toBe(1);
      await work(c);
      expect(sent()).toHaveLength(2);
      expect((await effectOf(c)).status).toBe("completed");
      expect(await runStatus(c)).toBe("queued");
      await prisma.run.update({ where: { id: c.run.id }, data: { status: "completed" } });
      const followUp = await prisma.$transaction((tx) =>
        createPendingSteeringRun(tx, { spaceId: f.a.spaceId, threadId, botId }),
      );
      expect(followUp).toEqual(expect.any(String));
    });

    it("a message while the card still waits moves past it, and nothing on it can be sent", async () => {
      const c = await card([], {
        replies: [
          argsFor(["t1"]).replies[0],
          { to: ["ana@prospect.example.test"], subject: "Hi", body: "Hi Ana" },
        ],
      });
      const posted = await pressRows(c, [0, 1]);
      await say("One more thing");
      expect(await runStatus(c)).toBe("queued");
      expect((await effectOf(c)).status).toBe("denied");
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows: posted }),
      ).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await work(c);
      expect(sent()).toEqual([]);
    });

    it("Stop during sending: approved rows still send, settlement wakes nothing, the results stay", async () => {
      const c = await card();
      await press(c, [0, 1]);
      await stopThreadRuns({ prisma, events: events(), sandbox: {} } as never, f.a, {
        kind: "bot",
        botId,
        threadId,
      } as never);
      expect(await runStatus(c)).toBe("cancelled");
      expect((await effectOf(c)).status).toBe("executing");
      await work(c);
      expect(sent()).toHaveLength(2);
      expect((await effectOf(c)).status).toBe("completed");
      expect(await runStatus(c)).toBe("cancelled");
      expect(resumes()).toEqual([]);
      expect((await read(c)).rows.map((row) => row.state)).toEqual(["sent", "sent", "skipped"]);
      const message = await prisma.message.findUniqueOrThrow({ where: { id: c.message.id } });
      expect((message.blocks as { mailBatch: unknown }[])[0]?.mailBatch).toMatchObject({ sent: 2 });
    });

    it("Stop before the press closes the card and nothing can send", async () => {
      const c = await card();
      const rows = await pressRows(c, [0]);
      await stopThreadRuns({ prisma, events: events(), sandbox: {} } as never, f.a, {
        kind: "bot",
        botId,
        threadId,
      } as never);
      expect((await effectOf(c)).status).toBe("stopped");
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(enqueued).toEqual([]);
    });

    it("clearing the thread during sending holds unsent rows; a claimed row finishes", async () => {
      const c = await card(["t1", "t2", "t3"]);
      await press(c, [0, 1, 2]);
      const [first, second, third] = await rowsOf(c);
      // The worker has claimed the first row and is about to send it.
      await prisma.mailReplyItem.update({
        where: { id: first!.id },
        data: { dispatch: "claimed" },
      });
      await events().clearThread({ spaceId: f.a.spaceId, threadId, botId });
      expect(await prisma.message.count({ where: { id: c.message.id } })).toBe(0);
      expect(await runStatus(c)).toBe("cancelled");
      expect((await rowsOf(c)).map((row) => [row.dispatch, row.error])).toEqual([
        ["claimed", null],
        ["held", "thread_cleared"],
        ["held", "thread_cleared"],
      ]);
      expect([second?.id, third?.id]).toHaveLength(2);
      await work(c);
      expect(sent()).toEqual([]);
      // Nothing is queued, and the claimed row settles once its record is resolved.
      await prisma.composeSend.create({
        data: {
          ...scope(),
          clientId: `agent:batch_${first!.id}`,
          connectionId: f.connA,
          state: "sent",
        },
      });
      await work(c);
      expect((await effectOf(c)).result).toMatchObject({ sent: 1, failed: 2 });
      expect(resumes()).toEqual([]);
    });

    it("a claimed row that lost its worker is held, not sent, once the thread is cleared", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      const [row] = await rowsOf(c);
      await prisma.mailReplyItem.update({ where: { id: row!.id }, data: { dispatch: "claimed" } });
      await events().clearThread({ spaceId: f.a.spaceId, threadId, botId });
      const old = new Date(Date.now() - 10 * 60_000);
      await prisma.$executeRaw`UPDATE mail_reply_items SET "updatedAt" = ${old} WHERE id = ${row!.id}`;
      await reconcileMailReplyBatches({
        prisma,
        jobs,
        events: events(),
        now: new Date(),
        batchSize: 5,
      });
      expect((await rowsOf(c)).map((item) => [item.dispatch, item.error])).toEqual([
        ["held", "thread_cleared"],
      ]);
      await work(c);
      expect(sent()).toEqual([]);
    });

    it("clearing leaves other threads' queued rows alone", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      const otherThread = await prisma.thread.create({
        data: {
          ...scope(),
          botId: (await prisma.bot.create({ data: { ...scope(), name: "Other", color: "blue" } }))
            .id,
        },
      });
      await events().clearThread({
        spaceId: f.a.spaceId,
        threadId: otherThread.id,
        botId: otherThread.botId as string,
      });
      expect((await rowsOf(c))[0]?.dispatch).toBe("queued");
    });

    it("clearing the thread before the press closes the batch: the press finds no card", async () => {
      const c = await card();
      const rows = await pressRows(c, [0]);
      await events().clearThread({ spaceId: f.a.spaceId, threadId, botId });
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), { ...c.ids, rows }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("S2: repeat guard", () => {
    const repeat = async (runId: string, args: Record<string, unknown>) =>
      mailSendRefusal(args, await priorBatchRows(prisma, scope(), runId), runId);

    it("refuses mail_send for a sent, unknown or failed row, reworded or without the id", async () => {
      const c = await card();
      await press(c, [0, 1, 2]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument", skip: 1 });
      await work(c);
      for (const thread of ["t1", "t2", "t3"]) {
        const refusal = await repeat(c.run.id, {
          to: [customer(thread)],
          subject: `Re: Subject ${thread}`,
          body: "Reworded",
          replyToId: `${thread}-m1`,
        });
        expect(refusal).toEqual(expect.stringContaining("Do not send it again"));
        const withoutId = await repeat(c.run.id, {
          to: [customer(thread)],
          subject: `Re: Subject ${thread}`,
          body: "Reworded",
        });
        expect(withoutId).toEqual(expect.stringContaining("Do not send it again"));
      }
    });

    it("refuses mail_send repeating a skipped or discarded row, but lets another thread through", async () => {
      const c = await card();
      await press(c, [0]);
      await work(c);
      expect(
        await repeat(c.run.id, {
          to: [customer("t2")],
          subject: "Re: Subject t2",
          body: "Hello t2",
          replyToId: "t2-m1",
        }),
      ).toEqual(expect.stringContaining("discarded"));
      expect(
        await repeat(c.run.id, {
          to: [customer("t4")],
          subject: "Re: Subject t4",
          body: "Hello t4",
          replyToId: "t4-m1",
        }),
      ).toBeUndefined();
    });

    it("a batch row cannot repeat a sent row of the same run", async () => {
      const c = await card(["t1"]);
      await press(c, [0]);
      await work(c);
      const refusal = await prepare(c.effect.id, c.run.id, argsFor(["t1"]));
      expect(refusal).toEqual({ error: expect.stringContaining("Reply 1 (t1-m1)") });
    });
  });

  describe("new emails", () => {
    const address = (name: string) => `${name}@prospect.example.test`;
    const newRow = (name: string, extra: object = {}) => ({
      to: [address(name)],
      subject: `Hello ${name}`,
      body: `Hi ${name}, this was written for you.`,
      ...extra,
    });
    const outreach = (...names: string[]) => ({ replies: names.map((name) => newRow(name)) });
    const seedLimit = async (used: number) => {
      const c = await card(["t4"]);
      await prisma.mailReplyItem.updateMany({
        where: { effectId: c.effect.id },
        data: { newRecipientCount: used, newRecipientAt: new Date() },
      });
    };

    it("stores a row with no thread, flags the new recipient and leaves it ticked", async () => {
      const c = await card([], outreach("ana"));
      expect((await rowsOf(c))[0]).toMatchObject({
        replyToId: null,
        providerThreadId: null,
        seenMessageId: null,
      });
      const [row] = (await read(c)).rows;
      expect(row).toMatchObject({
        replyToId: null,
        flags: ["new_recipient"],
        startsUnticked: false,
      });
    });

    it("mixes with replies on one card, and a replyToId that is not synced stays refused", async () => {
      const c = await card([], {
        replies: [argsFor(["t1"]).replies[0], newRow("ana")],
      });
      expect((await read(c)).rows.map((row) => row.flags)).toEqual([[], ["new_recipient"]]);
      const bad = await prepare("unused", c.run.id, {
        replies: [newRow("ben", { replyToId: "not-synced" })],
      });
      expect(bad).toEqual({ error: expect.stringContaining("not in the synced mail") });
    });

    it.each([
      ["a to", { to: [] }],
      ["a subject", { subject: "  " }],
      ["a body", { body: "  " }],
    ])("refuses a new email without %s, naming the row", async (_label, missing) => {
      const c = await card(["t1"]);
      const refusal = await prepare(c.effect.id, c.run.id, {
        replies: [newRow("ana", missing)],
      });
      expect(refusal).toEqual({ error: expect.stringContaining("New email 1") });
    });

    it("a firewalled or external agent is refused new emails, and keeps its replies", async () => {
      const c = await card(["t1"]);
      const refusal = await prepare(
        c.effect.id,
        c.run.id,
        { replies: [argsFor(["t2"]).replies[0], newRow("attacker")] },
        { refuseNewEmail: true },
      );
      expect(refusal).toEqual({ error: expect.stringContaining("New email 2") });
      const replies = await card(["t2"], argsFor(["t2"]), { refuseNewEmail: true });
      expect(replies.rows).toHaveLength(1);
    });

    it("a new email from a run that read outside content starts unticked, even to someone known", async () => {
      await f.cache(f.a, f.connA, "known-1", {
        threadId: "known",
        from: address("known"),
        receivedAt: daysAgo(40),
        signals: null,
      });
      const c = await card([], outreach("ana", "known"), { outsideContent: true });
      const { rows } = await read(c);
      expect(rows.map((row) => [row.flags, row.startsUnticked])).toEqual([
        [["new_recipient"], true],
        [[], true],
      ]);
      // An untouched reply of the same run is not made suspect by it.
      const reply = await card(["t1"], argsFor(["t1"]), { outsideContent: true });
      expect((await read(reply)).rows[0]?.startsUnticked).toBe(false);
    });

    it("New recipient: any address with no prior mail in that account", async () => {
      const c = await card(["t1"], {
        replies: [{ ...argsFor(["t1"]).replies[0], cc: ["stranger@elsewhere.example.test"] }],
      });
      expect(flagsOf(c.rows)).toEqual([["not_on_thread", "new_recipient"]]);
      // Prior mail in another account does not count.
      await f.cache(f.a, f.connA, "seen-1", {
        threadId: "seen",
        from: "box-a@example.test",
        to: [address("Seen")],
        fromSelf: true,
        receivedAt: daysAgo(40),
        signals: null,
      });
      const known = await card([], outreach("seen"));
      expect(flagsOf(known.rows)).toEqual([[]]);
    });

    it("reuses the protected-sender and no-reply checks", async () => {
      await prisma.contact.create({
        data: { ...scope(), name: "Pat", email: address("pat") },
      });
      const c = await card([], {
        replies: [newRow("pat"), { ...newRow("x"), to: ["no-reply@prospect.example.test"] }],
      });
      expect(flagsOf(c.rows)).toEqual([
        ["important_sender", "new_recipient"],
        ["no_reply_address", "new_recipient"],
      ]);
      expect((await read(c)).rows.every((row) => row.startsUnticked)).toBe(true);
    });

    it("flags the same address twice on one card, both rows, and unticks them", async () => {
      const c = await card([], {
        replies: [newRow("ana"), { ...newRow("ana"), subject: "Another", body: "Different" }],
      });
      expect(flagsOf(c.rows)).toEqual([
        ["duplicate_email", "new_recipient"],
        ["duplicate_email", "new_recipient"],
      ]);
      expect((await read(c)).rows.every((row) => row.startsUnticked)).toBe(true);
    });

    it("flags a new email to someone just emailed about it, reworded or from another account", async () => {
      await f.cache(f.a, f.connA2, "just-1", {
        threadId: "just",
        from: "box-b@example.test",
        to: [address("ana")],
        subject: "Re: Hello ana",
        snippet: "A different wording entirely",
        fromSelf: true,
        receivedAt: new Date(Date.now() - 3 * 60_000),
        signals: null,
      });
      const c = await card([], outreach("ana"));
      expect(flagsOf(c.rows)[0]).toContain("already_sent");
      expect(startsUnticked(c.rows[0]!.flags)).toBe(true);
      // Someone else, another subject, or an older send is not this.
      const other = await card([], {
        replies: [newRow("ben"), newRow("ana", { subject: "Other" })],
      });
      expect(flagsOf(other.rows).flat()).not.toContain("already_sent");
      await prisma.cachedMailMessage.updateMany({
        where: { providerMessageId: "just-1" },
        data: { receivedAt: new Date(Date.now() - 16 * 60_000) },
      });
      const later = await card([], outreach("ana"));
      expect(flagsOf(later.rows)[0]).not.toContain("already_sent");
    });

    it("flags the same subject sent recently to the same address, in mail or on another card", async () => {
      await f.cache(f.a, f.connA, "out-1", {
        threadId: "out",
        from: "box-a@example.test",
        to: [address("ana")],
        subject: "hello ANA",
        fromSelf: true,
        receivedAt: daysAgo(2),
        signals: null,
      });
      const fromMail = await card([], outreach("ana"));
      expect(flagsOf(fromMail.rows)).toEqual([["duplicate_email"]]);

      const first = await card([], outreach("ben"));
      await press(first, [0]);
      const second = await card([], outreach("ben"));
      expect(flagsOf(second.rows)).toEqual([["duplicate_email", "new_recipient"]]);
      // Another subject to the same person is a different email.
      const other = await card([], { replies: [newRow("ben", { subject: "Other" })] });
      expect(flagsOf(other.rows)).toEqual([["new_recipient"]]);
    });

    it("identical text on three new rows is a flag that keeps them ticked; two is not", async () => {
      const same = { body: "The same words for everyone." };
      const three = await card([], {
        replies: ["ana", "ben", "cy"].map((name) => newRow(name, same)),
      });
      expect(flagsOf(three.rows)[0]).toEqual(["new_recipient", "same_text"]);
      expect((await read(three)).rows.every((row) => !row.startsUnticked)).toBe(true);
      const two = await card([], {
        replies: ["dee", "eli"].map((name) => newRow(name, same)),
      });
      expect(flagsOf(two.rows)[0]).toEqual(["new_recipient"]);
    });

    it("sends only the ticked rows, each in a thread of its own, and reports them", async () => {
      const c = await card([], { replies: [newRow("ana"), newRow("ben"), newRow("cy")] });
      await press(c, [0, 2]);
      await work(c);
      const out = sent();
      expect(out.map((mail) => mail.to)).toEqual([address("ana"), address("cy")]);
      expect(new Set(out.map((mail) => mail.threadId)).size).toBe(2);
      const raw = f.gmail.sentOf("box-a").map((draft) => parseRawMime(draft.raw));
      expect(raw.every((mime) => !mime.header("in-reply-to"))).toBe(true);
      expect((await read(c)).rows.map((row) => row.state)).toEqual(["sent", "skipped", "sent"]);
      expect((await effectOf(c)).result).toMatchObject({
        sent: 2,
        replies: [
          { replyToId: null, to: [address("ana")], outcome: "sent" },
          { replyToId: null, to: [address("ben")], outcome: "skipped" },
          { replyToId: null, to: [address("cy")], outcome: "sent" },
        ],
      });
      expect(mailBatchStepSummary((await effectOf(c)).result)).toBe("Sent 2 emails");
    });

    it("an edit that clears a new email's body or subject rejects the press", async () => {
      const c = await card([], outreach("ana"));
      await expect(press(c, [0], { 0: { body: " " } })).rejects.toThrow(/New email 1/);
      await expect(press(c, [0], { 0: { subject: "" } })).rejects.toThrow(/New email 1/);
      expect((await effectOf(c)).status).toBe("intended");
    });

    it("an edit that repeats another row's address flags both rows, and the press needs that seen", async () => {
      const c = await card([], outreach("ana", "ben"));
      const { rows } = await read(c);
      const edits = { to: [address("ben")] };
      const preview = await previewMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: [{ itemId: rows[0]!.itemId, edits }],
      });
      expect(preview.rows.map((row) => [row.itemId, row.flags, row.startsUnticked])).toEqual([
        [rows[0]!.itemId, ["duplicate_email", "new_recipient"], true],
        [rows[1]!.itemId, ["duplicate_email", "new_recipient"], true],
      ]);
      const posted = await pressRows(c, [0, 1], { 0: edits });
      await expect(
        sendMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: posted.map((row, index) =>
            index === 1 ? { ...row, flags: ["new_recipient"] as never } : row,
          ),
        }),
      ).rejects.toThrow(/changed/);
      await sendMailBatch(rpcDeps(), f.a, target(), {
        ...c.ids,
        rows: posted.map((row) => ({
          ...row,
          flags: ["duplicate_email", "new_recipient"] as never,
        })),
      });
    });

    it("double send under retry: one message however often the job and Retry run", async () => {
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      f.gmail.failNext(400, { urlIncludes: "drafts/send", reason: "invalidArgument" });
      await work(c);
      expect(sent()).toEqual([]);
      const { rows } = await read(c);
      expect(rows[0]).toMatchObject({ state: "not_sent", retryable: true });
      expect((await rowsOf(c))[0]?.newRecipientAt).toBeNull();

      const retry = () =>
        retryMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ itemId: rows[0]!.itemId, seenMessageId: null }],
        });
      expect(await retry()).toBe(1);
      expect(await retry()).toBe(0);
      await Promise.all([work(c), work(c)]);
      await work(c);
      expect(await retry()).toBe(0);
      await work(c);
      expect(sent().map((mail) => mail.to)).toEqual([address("ana")]);
      expect((await read(c)).rows[0]?.state).toBe("sent");
      expect((await rowsOf(c))[0]?.newRecipientCount).toBe(1);
    });

    const reserveAt = (c: Card, newRecipientAt: Date) =>
      prisma.mailReplyItem.updateMany({
        where: { effectId: c.effect.id },
        data: { newRecipientCount: 1, newRecipientAt },
      });
    const dayAgo = () => new Date(Date.now() - 25 * 60 * 60_000);

    it("a reservation older than the window must find room again", async () => {
      await seedLimit(MAX_NEW_RECIPIENT_SENDS_PER_DAY);
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      await reserveAt(c, dayAgo());
      await work(c);
      expect(sent()).toEqual([]);
      expect((await read(c)).rows[0]?.error).toBe("daily_limit");
    });

    it("a reservation older than the window is renewed when there is room", async () => {
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      await reserveAt(c, dayAgo());
      await work(c);
      expect(sent()).toHaveLength(1);
      const [row] = await rowsOf(c);
      expect(row?.newRecipientAt?.getTime()).toBeGreaterThan(Date.now() - 60_000);
    });

    it("a recovered row that a check refuses gives its place back", async () => {
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      await reserveAt(c, new Date());
      await prisma.bot.update({
        where: { id: botId },
        data: { disabledBuiltinTools: ["mail_send"] },
      });
      await work(c);
      expect((await rowsOf(c))[0]).toMatchObject({
        dispatch: "held",
        error: "switch",
        newRecipientCount: 0,
        newRecipientAt: null,
      });
    });

    it("recovery that holds a row of a cleared thread gives its place back", async () => {
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      await prisma.mailReplyItem.updateMany({
        where: { effectId: c.effect.id },
        data: { dispatch: "claimed", newRecipientCount: 1, newRecipientAt: new Date() },
      });
      await prisma.message.deleteMany({ where: { runId: c.run.id, role: "bot" } });
      await reconcile();
      expect((await rowsOf(c))[0]).toMatchObject({
        dispatch: "held",
        newRecipientCount: 0,
        newRecipientAt: null,
      });
    });

    it("an earlier card's Bcc counts as a recent send to that address", async () => {
      const first = await card([], {
        replies: [newRow("cy", { subject: "Same", bcc: [address("ben")] })],
      });
      await press(first, [0]);
      const second = await card([], { replies: [newRow("ben", { subject: "Same" })] });
      expect(flagsOf(second.rows)[0]).toContain("duplicate_email");
    });

    it("an interrupted row with a reservation is not counted twice", async () => {
      await seedLimit(MAX_NEW_RECIPIENT_SENDS_PER_DAY - 1);
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      const [row] = await rowsOf(c);
      expect(
        await reserveNewRecipientSends(prisma, {
          ...scope(),
          itemId: row!.id,
          connectionId: f.connA,
          count: 1,
        }),
      ).toBe(true);
      // Full now, and this row already holds its place.
      await work(c);
      expect(sent().map((mail) => mail.to)).toEqual([address("ana")]);
    });

    it("the limit holds across concurrent presses: only what is left goes out", async () => {
      await seedLimit(MAX_NEW_RECIPIENT_SENDS_PER_DAY - 2);
      const one = await card([], outreach("a1", "a2", "a3"));
      const two = await card([], outreach("b1", "b2", "b3"));
      await Promise.all([press(one, [0, 1, 2]), press(two, [0, 1, 2])]);
      await Promise.all([work(one), work(two)]);
      expect(sent()).toHaveLength(2);
      const rows = [...(await read(one)).rows, ...(await read(two)).rows];
      expect(rows.filter((row) => row.state === "sent")).toHaveLength(2);
      const held = rows.filter((row) => row.state === "not_sent");
      expect(held).toHaveLength(4);
      expect(held.every((row) => row.error === "daily_limit" && row.retryable)).toBe(true);
      const used = await prisma.mailReplyItem.aggregate({
        where: { connectionId: f.connA, newRecipientAt: { not: null } },
        _sum: { newRecipientCount: true },
      });
      expect(used._sum.newRecipientCount).toBe(MAX_NEW_RECIPIENT_SENDS_PER_DAY);
    });

    it("a held row tells the agent why, and Retry sends it once the window has room", async () => {
      await seedLimit(MAX_NEW_RECIPIENT_SENDS_PER_DAY);
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      await work(c);
      expect(sent()).toEqual([]);
      expect((await effectOf(c)).result).toMatchObject({
        replies: [{ outcome: "failed", reason: "daily_limit" }],
        note: expect.stringContaining("daily limit"),
      });
      const { rows } = await read(c);
      const retry = () =>
        retryMailBatch(rpcDeps(), f.a, target(), {
          ...c.ids,
          rows: [{ itemId: rows[0]!.itemId, seenMessageId: null }],
        });
      await retry();
      await work(c);
      expect(sent()).toEqual([]);
      expect((await read(c)).rows[0]?.error).toBe("daily_limit");

      // A day later the earlier sends no longer count.
      await prisma.mailReplyItem.updateMany({
        where: { connectionId: f.connA, newRecipientCount: MAX_NEW_RECIPIENT_SENDS_PER_DAY },
        data: { newRecipientAt: new Date(Date.now() - 25 * 60 * 60_000) },
      });
      await retry();
      await work(c);
      expect(sent().map((mail) => mail.to)).toEqual([address("ana")]);
    });

    it("the limit never holds a reply to someone already on the thread", async () => {
      await seedLimit(MAX_NEW_RECIPIENT_SENDS_PER_DAY);
      const c = await card(["t1"]);
      await press(c, [0]);
      await work(c);
      expect(sent()).toHaveLength(1);
      expect((await rowsOf(c))[0]?.newRecipientAt).toBeNull();
    });

    it("counts each new address of a row, not only the row", async () => {
      await seedLimit(MAX_NEW_RECIPIENT_SENDS_PER_DAY - 1);
      const c = await card([], {
        replies: [newRow("ana", { cc: [address("ben")] })],
      });
      await press(c, [0]);
      await work(c);
      expect(sent()).toEqual([]);
      expect((await read(c)).rows[0]?.error).toBe("daily_limit");
    });

    it("turning Firewall on after the card holds its new emails, and its replies still go", async () => {
      const c = await card([], { replies: [argsFor(["t1"]).replies[0], newRow("ana")] });
      await press(c, [0, 1]);
      await prisma.bot.update({ where: { id: botId }, data: { firewall: true } });
      // Firewall drops "all agents", and one sibling account without a grant denies the whole app.
      await prisma.botConnectionAccess.createMany({
        data: (await prisma.connection.findMany({ where: scope() })).map((connection) => ({
          botId,
          connectionId: connection.id,
          ...scope(),
          canWrite: true,
        })),
      });
      await work(c);
      expect(sent().map((mail) => mail.to)).toEqual([customer("t1")]);
      expect((await read(c)).rows[1]).toMatchObject({ state: "not_sent", error: "firewall" });
    });

    it("Open in composer on a new email has no thread to answer", async () => {
      await seedLimit(MAX_NEW_RECIPIENT_SENDS_PER_DAY);
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      await work(c);
      const { rows } = await read(c);
      const draft = await mailBatchRowToComposer(rpcDeps(), f.a, target(), {
        ...c.ids,
        itemId: rows[0]!.itemId,
      });
      expect(draft.to).toEqual([address("ana")]);
      expect(draft).not.toHaveProperty("replyToId");
    });

    it("a repeat of a sent new email in the same run is refused before any card", async () => {
      const c = await card([], outreach("ana"));
      await press(c, [0]);
      await work(c);
      const refusal = await prepare(c.effect.id, c.run.id, outreach("ana"));
      expect(refusal).toEqual({ error: expect.stringContaining("New email 1") });
    });
  });
});
