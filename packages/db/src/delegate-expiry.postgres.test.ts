import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { createThreadEvents } from "./events.js";
import { createThreadMessageInTransaction } from "./messages.js";
import { delegatePendingIds } from "./run-pauses.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("delegated approvals when the requester fails (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = { user: `dx-user-${suffix}`, org: `dx-org-${suffix}`, space: `dx-sp-${suffix}` };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let requesterBot: string;
  let requesterThread: string;
  let delegateBot: string;
  let delegateThread: string;
  let n = 0;
  const events = () => createThreadEvents(prisma);

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: ids.user, name: "Tester", email: `${ids.user}@example.test` },
    });
    await prisma.organization.create({
      data: { id: ids.org, name: "Org", slug: ids.org, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: ids.space, organizationId: ids.org, name: "General", isDefault: true },
    });
    const bot = (name: string) =>
      prisma.bot.create({
        data: { spaceId: ids.space, userId: ids.user, name, color: "blue" },
      });
    requesterBot = (await bot("Chief")).id;
    delegateBot = (await bot("Mercury")).id;
    const thread = (botId: string) =>
      prisma.thread
        .create({ data: { spaceId: ids.space, userId: ids.user, botId } })
        .then((t) => t.id);
    requesterThread = await thread(requesterBot);
    delegateThread = await thread(delegateBot);
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.delete({ where: { id: ids.user } });
    await close();
  });

  async function runningRun(botId: string, threadId: string, extra: object = {}) {
    const task = await prisma.task.create({
      data: {
        spaceId: ids.space,
        botId,
        threadId,
        userId: ids.user,
        prompt: "p",
        status: "running",
      },
    });
    const run = await prisma.run.create({
      data: {
        spaceId: ids.space,
        botId,
        threadId,
        taskId: task.id,
        userId: ids.user,
        status: "running",
        trigger: "user",
        leaseOwner: "worker",
        leaseFence: 1,
        ...extra,
      },
    });
    const attempt = await prisma.attempt.create({
      data: { runId: run.id, status: "running", fence: 1 },
    });
    return { task, run, attempt };
  }

  /** A requester run that sent work to the delegate, whose run then asks for payment approval. */
  async function delegation() {
    const seq = n++;
    const requester = await runningRun(requesterBot, requesterThread);
    const post = (input: Parameters<typeof createThreadMessageInTransaction>[1]) =>
      prisma.$transaction((tx) => createThreadMessageInTransaction(tx, input));
    const sent = await post({
      threadId: requesterThread,
      role: "bot",
      botId: requesterBot,
      runId: requester.run.id,
      blocks: [{ kind: "text", text: "asked" }],
    });
    const inbound = await post({
      threadId: delegateThread,
      role: "user",
      blocks: [
        {
          kind: "bot_message_received",
          fromBotId: requesterBot,
          fromBotName: "Chief",
          text: "pay",
          returnToMessageId: sent.id,
        },
      ],
    });
    const delegate = await runningRun(delegateBot, delegateThread, {
      trigger: "bot_message",
      sourceMessageId: inbound.id,
    });
    const effect = await prisma.externalEffect.create({
      data: {
        spaceId: ids.space,
        runId: delegate.run.id,
        kind: "requestSendMoney",
        idempotencyKey: `dx-${suffix}-${seq}`,
        status: "intended",
        request: { amount: 75, seq },
      },
    });
    const block = {
      kind: "ask" as const,
      text: "Send $75?",
      status: "pending" as const,
      approvalEffectId: effect.id,
      actions: [
        { id: "allow", label: "Send $75.00" },
        { id: "deny", label: "Deny" },
      ],
    };
    const lease = { leaseOwner: "worker", leaseFence: 1 };
    const pause = () =>
      events().pauseRunForInput({
        ...lease,
        spaceId: ids.space,
        threadId: delegateThread,
        botId: delegateBot,
        runId: delegate.run.id,
        attemptId: delegate.attempt.id,
        blocks: [block],
      });
    const failRequester = (fence = 1) =>
      events().finalizeRun({
        spaceId: ids.space,
        threadId: requesterThread,
        botId: requesterBot,
        runId: requester.run.id,
        taskId: requester.task.id,
        attemptId: requester.attempt.id,
        leaseOwner: "worker",
        leaseFence: fence,
        outcome: "failed",
        error: "This agent could not finish.",
      });
    const delegateStatus = async () =>
      (await prisma.run.findUniqueOrThrow({ where: { id: delegate.run.id } })).status;
    const effectStatus = async () =>
      (await prisma.externalEffect.findUniqueOrThrow({ where: { id: effect.id } })).status;
    const requesterError = async () =>
      (await prisma.run.findUniqueOrThrow({ where: { id: requester.run.id } })).error;
    const answer = async (choice: string) => {
      const card = await prisma.message.findFirstOrThrow({
        where: { threadId: delegateThread, runId: delegate.run.id, role: "bot" },
      });
      return events().answerRunInput({
        spaceId: ids.space,
        threadId: delegateThread,
        runId: delegate.run.id,
        messageId: card.id,
        answeredByUserId: ids.user,
        answer: choice,
      });
    };
    return { sent, pause, failRequester, delegateStatus, effectStatus, requesterError, answer };
  }

  const pendingEvents = async () =>
    (
      await prisma.event.findMany({
        where: { threadId: requesterThread, type: "thread.delegate_pending" },
        orderBy: { seq: "asc" },
      })
    ).map((event) => (event.payload as { pending: string[] }).pending);
  const pendingNow = () =>
    delegatePendingIds(prisma, {
      spaceId: ids.space,
      userId: ids.user,
      fromBotId: requesterBot,
      threadId: requesterThread,
    });

  it("tells the requester thread when its delegate pauses on approval", async () => {
    const d = await delegation();
    expect(await d.pause()).toBe(true);
    expect(await pendingNow()).toContain(d.sent.id);
    expect((await pendingEvents()).at(-1)).toContain(d.sent.id);
    await d.answer("deny");
  });

  it("expires only the delegates of the failed run, and says which action was not done", async () => {
    const failing = await delegation();
    const other = await delegation();
    await failing.pause();
    await other.pause();

    expect(await failing.failRequester()).toBeTruthy();

    expect(await failing.delegateStatus()).toBe("cancelled");
    expect(await failing.effectStatus()).toBe("expired");
    expect(await failing.requesterError()).toBe(
      "This agent could not finish. The approval for requestSendMoney expired, so that action was not done.",
    );
    // Another run of the same bot, started around the same time, keeps its approval.
    expect(await other.delegateStatus()).toBe("waiting_input");
    expect(await other.effectStatus()).toBe("intended");
    expect(await pendingNow()).toEqual([other.sent.id]);
    expect((await pendingEvents()).at(-1)).toEqual([other.sent.id]);
    await other.answer("deny");
  });

  it("leaves delegates alone when the failing worker no longer holds the lease", async () => {
    const d = await delegation();
    await d.pause();
    expect(await d.failRequester(99)).toBe(false);
    expect(await d.delegateStatus()).toBe("waiting_input");
    expect(await d.effectStatus()).toBe("intended");
    await d.answer("deny");
  });

  it("does not claim an action was not done when the owner approved it first", async () => {
    const d = await delegation();
    await d.pause();
    expect(await d.answer("allow")).toBe(true);

    expect(await d.failRequester()).toBeTruthy();

    expect(await d.delegateStatus()).toBe("queued");
    expect(await d.effectStatus()).not.toBe("expired");
    expect(await d.requesterError()).toBe("This agent could not finish.");
  });

  it("expiry and an approval of the same delegate never deadlock; one of them wins", async () => {
    for (let i = 0; i < 5; i++) {
      const d = await delegation();
      await d.pause();
      const [failed, answered] = await Promise.all([d.failRequester(), d.answer("allow")]);
      expect(failed).toBeTruthy();
      const status = await d.delegateStatus();
      // Either the approval queued the run before expiry, or expiry cancelled it first.
      expect(answered ? status : "cancelled").toBe(answered ? "queued" : "cancelled");
      expect(["queued", "cancelled"]).toContain(status);
      expect((await d.effectStatus()) === "expired").toBe(status === "cancelled");
    }
  });
});
