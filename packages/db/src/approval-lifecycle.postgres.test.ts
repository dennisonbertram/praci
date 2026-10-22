import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { createThreadEvents } from "./events.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("approval card lifecycle (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = {
    user: `life-user-${suffix}`,
    org: `life-org-${suffix}`,
    space: `life-sp-${suffix}`,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;
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
    botId = (
      await prisma.bot.create({
        data: { spaceId: ids.space, userId: ids.user, name: "Mercury", color: "blue" },
      })
    ).id;
    threadId = (
      await prisma.thread.create({ data: { spaceId: ids.space, userId: ids.user, botId } })
    ).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.delete({ where: { id: ids.user } });
    await close();
  });

  /** A delegated run that has recorded a payment approval and is about to pause on it. */
  async function runningDelegate(request: object = { amount: 75 }) {
    const seq = n++;
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
        trigger: "bot_message",
        leaseOwner: "worker",
        leaseFence: 1,
      },
    });
    const attempt = await prisma.attempt.create({
      data: { runId: run.id, status: "running", fence: 1 },
    });
    const effect = await prisma.externalEffect.create({
      data: {
        spaceId: ids.space,
        runId: run.id,
        kind: "requestSendMoney",
        idempotencyKey: `life-${suffix}-${seq}`,
        status: "intended",
        request,
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
    const base = { spaceId: ids.space, threadId, botId, runId: run.id };
    return {
      run,
      effect,
      pause: () =>
        events().pauseRunForInput({ ...base, ...lease, attemptId: attempt.id, blocks: [block] }),
      fail: (error: string) =>
        events().finalizeRun({
          ...base,
          ...lease,
          taskId: task.id,
          attemptId: attempt.id,
          outcome: "failed",
          error,
        }),
      answer: async (answer: string) => {
        const card = await prisma.message.findFirstOrThrow({
          where: { threadId, runId: run.id, role: "bot" },
        });
        return events().answerRunInput({
          spaceId: ids.space,
          threadId,
          runId: run.id,
          messageId: card.id,
          answeredByUserId: ids.user,
          answer,
        });
      },
      card: async () => {
        const message = await prisma.message.findFirstOrThrow({
          where: { threadId, runId: run.id, role: "bot" },
        });
        return (message.blocks as Array<{ status: string; answer?: string }>)[0]!;
      },
      effectStatus: async () =>
        (await prisma.externalEffect.findUniqueOrThrow({ where: { id: effect.id } })).status,
      runStatus: async () => (await prisma.run.findUniqueOrThrow({ where: { id: run.id } })).status,
    };
  }

  it("a newer request supersedes the older card, and the older card can never be approved", async () => {
    const older = await runningDelegate();
    expect(await older.pause()).toBe(true);
    expect(await older.card()).toMatchObject({ status: "pending" });

    const newer = await runningDelegate();
    expect(await newer.pause()).toBe(true);

    expect(await older.card()).toMatchObject({ status: "answered", answer: "superseded" });
    expect(await older.effectStatus()).toBe("superseded");
    expect(await older.runStatus()).toBe("cancelled");
    expect(await newer.card()).toMatchObject({ status: "pending" });

    // Deny the newer card: the older one stays closed and rejects an approval.
    expect(await newer.answer("deny")).toBe(true);
    expect(await newer.effectStatus()).toBe("denied");
    expect(await older.answer("allow")).toBe(false);
    expect(await older.effectStatus()).toBe("superseded");
  });

  it("a different payment in the same thread does not supersede an older card", async () => {
    const first = await runningDelegate({ amount: 10, recipient: "a" });
    expect(await first.pause()).toBe(true);
    const second = await runningDelegate({ amount: 20, recipient: "b" });
    expect(await second.pause()).toBe(true);
    expect(await first.card()).toMatchObject({ status: "pending" });
    expect(await first.effectStatus()).toBe("intended");
    expect(await second.card()).toMatchObject({ status: "pending" });
    await first.answer("deny");
    await second.answer("deny");
  });

  it("a run that fails after asking for approval expires the card and says nothing was sent", async () => {
    const delegate = await runningDelegate();
    // The card was posted, then the run failed before anyone answered.
    await delegate.pause();
    await prisma.run.update({
      where: { id: delegate.run.id },
      data: { status: "running", leaseOwner: "worker", leaseFence: 1 },
    });
    await prisma.attempt.updateMany({
      where: { runId: delegate.run.id },
      data: { status: "running" },
    });

    expect(await delegate.fail("This agent could not finish. Try again.")).toBeTruthy();

    expect(await delegate.card()).toMatchObject({ status: "answered", answer: "expired" });
    expect(await delegate.effectStatus()).toBe("expired");
    const run = await prisma.run.findUniqueOrThrow({ where: { id: delegate.run.id } });
    expect(run.error).toBe(
      "This agent could not finish. Try again. The approval for requestSendMoney expired, so that action was not done.",
    );
    expect(await delegate.answer("allow")).toBe(false);
  });
});
