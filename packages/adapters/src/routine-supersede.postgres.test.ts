import type { PrismaClient } from "@rakazo/db";
import { createDb, createThreadEvents, runAsSystem } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { expireSupersededRoutineRuns } from "./stuck-work.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("a new routine run closing older runs waiting on approval (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = {
    user: `rsup-user-${suffix}`,
    org: `rsup-org-${suffix}`,
    space: `rsup-sp-${suffix}`,
  };
  // Fixtures use the owner login; the reconciler runs as the runtime login, as a job does.
  let prisma: PrismaClient;
  let app: ReturnType<typeof createDb>;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;
  let n = 0;
  const routine = async () =>
    (
      await prisma.routine.create({
        data: {
          spaceId: ids.space,
          userId: ids.user,
          botId,
          threadId,
          name: "Check",
          prompt: "p",
          crons: ["0 */4 * * *"],
          active: true,
        },
      })
    ).id;

  beforeAll(async () => {
    const db = createDb(process.env.DATABASE_MIGRATION_URL || databaseUrl!);
    app = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
      await app.prisma.$disconnect();
      await app.pool.end();
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

  /** A run paused on an approval card, plus a second intended effect that is not the card. */
  async function waitingCard(
    routineId: string,
    opts: { unattended?: boolean; waiting?: boolean } = {},
  ) {
    const unattended = opts.unattended ?? true;
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
        trigger: "routine",
        routineId,
        unattended,
        leaseOwner: "worker",
        leaseFence: 1,
      },
    });
    const attempt = await prisma.attempt.create({
      data: { runId: run.id, status: "running", fence: 1 },
    });
    const effect = (kind: string, i: number) =>
      prisma.externalEffect.create({
        data: {
          spaceId: ids.space,
          runId: run.id,
          kind,
          idempotencyKey: `rsup-${suffix}-${seq}-${i}`,
          status: "intended",
          request: { seq },
        },
      });
    const card = await effect("shell", 0);
    const other = await effect("contacts_list", 1);
    if (opts.waiting === false) {
      // Dated ahead so the 24-hour reconcile in background-approval-expiry.postgres.test.ts, which
      // scans the whole database when it runs in parallel, never sees these runs as stale.
      await prisma.run.update({
        where: { id: run.id },
        data: { updatedAt: new Date(Date.now() + 7 * 24 * 60 * 60_000) },
      });
      return { run, card, other };
    }
    await createThreadEvents(prisma).pauseRunForInput({
      spaceId: ids.space,
      threadId,
      botId,
      runId: run.id,
      attemptId: attempt.id,
      leaseOwner: "worker",
      leaseFence: 1,
      blocks: [
        {
          kind: "ask",
          text: "Run it?",
          status: "pending",
          approvalEffectId: card.id,
          actions: [
            { id: "allow", label: "Allow" },
            { id: "deny", label: "Deny" },
          ],
        },
      ],
    });
    // Dated ahead so the 24-hour reconcile in background-approval-expiry.postgres.test.ts, which
    // scans the whole database when it runs in parallel, never sees these runs as stale.
    await prisma.run.update({
      where: { id: run.id },
      data: { updatedAt: new Date(Date.now() + 7 * 24 * 60 * 60_000) },
    });
    return { run, card, other };
  }

  const supersede = (routineId: string, exceptRunId: string) =>
    runAsSystem("routine supersede test", () =>
      expireSupersededRoutineRuns(
        {
          prisma: app.prisma,
          jobs: { enqueue: async () => undefined } as never,
          now: new Date(),
        },
        { routineId, exceptRunId },
      ),
    );
  const status = async (runId: string) =>
    (await prisma.run.findUniqueOrThrow({ where: { id: runId } })).status;
  const effectStatus = async (id: string) =>
    (await prisma.externalEffect.findUniqueOrThrow({ where: { id } })).status;
  const cardText = async (runId: string) =>
    JSON.stringify(
      (await prisma.message.findFirstOrThrow({ where: { runId, role: "bot" } })).blocks,
    );

  it("closes an older waiting run of the same routine and leaves everything else alone", async () => {
    const routineId = await routine();
    const stale = await waitingCard(routineId);
    const attended = await waitingCard(routineId, { unattended: false });
    const running = await waitingCard(routineId, { waiting: false });
    const otherRoutine = await waitingCard(await routine());
    const fresh = await waitingCard(routineId);

    await supersede(routineId, fresh.run.id);

    expect(await status(stale.run.id)).toBe("cancelled");
    expect(await effectStatus(stale.card.id)).toBe("expired");
    expect(await effectStatus(stale.other.id)).toBe("expired");
    expect(await cardText(stale.run.id)).toContain('"expired"');
    for (const [name, kept] of Object.entries({ attended, otherRoutine, fresh })) {
      expect([name, await status(kept.run.id)]).toEqual([name, "waiting_input"]);
      expect(await effectStatus(kept.card.id)).toBe("intended");
    }
    expect(await status(running.run.id)).toBe("running");
    expect(await effectStatus(running.card.id)).toBe("intended");
  });

  it("leaves a newer waiting run alone when an older run's sweep arrives late", async () => {
    const routineId = await routine();
    const older = await waitingCard(routineId);
    const newer = await waitingCard(routineId);
    await supersede(routineId, older.run.id);
    expect(await status(newer.run.id)).toBe("waiting_input");
    expect(await effectStatus(newer.card.id)).toBe("intended");
    expect(await status(older.run.id)).toBe("waiting_input");
  });

  it("does nothing when the expired card is answered afterwards", async () => {
    const routineId = await routine();
    const stale = await waitingCard(routineId);
    const fresh = await waitingCard(routineId);
    await supersede(routineId, fresh.run.id);
    const message = await prisma.message.findFirstOrThrow({
      where: { threadId, runId: stale.run.id, role: "bot" },
    });
    const answered = await createThreadEvents(prisma).answerRunInput({
      spaceId: ids.space,
      threadId,
      runId: stale.run.id,
      messageId: message.id,
      answeredByUserId: ids.user,
      answer: "allow",
    });
    expect(answered).toBe(false);
    expect(await status(stale.run.id)).toBe("cancelled");
    expect(await effectStatus(stale.card.id)).toBe("expired");
  });
});
