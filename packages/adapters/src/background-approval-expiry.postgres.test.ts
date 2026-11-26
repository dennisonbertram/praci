import { STUCK_WORK_EXPIRE_AFTER_MS } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createThreadEvents, runAsSystem } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reconcileStuckWork } from "./stuck-work.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("expiry of unanswered approval cards (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = { user: `bae-user-${suffix}`, org: `bae-org-${suffix}`, space: `bae-sp-${suffix}` };
  // Fixtures use the owner login; the reconciler runs as the runtime login, as a job does.
  let prisma: PrismaClient;
  let app: ReturnType<typeof createDb>;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;
  let n = 0;

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
  async function waitingCard(unattended: boolean) {
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
          idempotencyKey: `bae-${suffix}-${seq}-${i}`,
          status: "intended",
          request: { seq },
        },
      });
    const card = await effect("shell", 0);
    const other = await effect("contacts_list", 1);
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
    return { run, card, other };
  }

  const tick = (hoursAfterPause: number) =>
    runAsSystem("stuck-work test", () =>
      reconcileStuckWork({
        prisma: app.prisma,
        jobs: { enqueue: async () => undefined } as never,
        now: new Date(Date.now() + hoursAfterPause * 60 * 60_000),
        batchSize: 500,
      }),
    );
  const status = async (runId: string) =>
    (await prisma.run.findUniqueOrThrow({ where: { id: runId } })).status;
  const effectStatus = async (id: string) =>
    (await prisma.externalEffect.findUniqueOrThrow({ where: { id } })).status;
  const cardText = async (runId: string) =>
    JSON.stringify(
      (await prisma.message.findFirstOrThrow({ where: { runId, role: "bot" } })).blocks,
    );
  const pastExpiry = STUCK_WORK_EXPIRE_AFTER_MS / 3_600_000 + 1;

  it("expires a background card: card shows expired, its effect and the run's other pending effect expire, run is cancelled", async () => {
    const { run, card, other } = await waitingCard(true);
    await tick(pastExpiry);
    expect(await status(run.id)).toBe("cancelled");
    expect(await effectStatus(card.id)).toBe("expired");
    expect(await effectStatus(other.id)).toBe("expired");
    expect(await cardText(run.id)).toContain('"expired"');
  });

  it("leaves a background card younger than 24 hours", async () => {
    const { run, card } = await waitingCard(true);
    await tick(23);
    expect(await status(run.id)).toBe("waiting_input");
    expect(await effectStatus(card.id)).toBe("intended");
  });

  it("keeps today's behaviour for an attended card: the run is cancelled, the card is left as it was", async () => {
    const { run, card } = await waitingCard(false);
    await tick(pastExpiry);
    expect(await status(run.id)).toBe("cancelled");
    expect(await effectStatus(card.id)).toBe("intended");
    expect(await cardText(run.id)).not.toContain('"expired"');
  });
});
