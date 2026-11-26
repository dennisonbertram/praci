import type { PrismaClient } from "@rakazo/db";
import { createDb, createThreadEvents, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "./rpc-context.js";
import { stopThreadRuns } from "./thread-target.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("stopping a run with an open approval card (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = { user: `sap-user-${suffix}`, org: `sap-org-${suffix}`, space: `sap-sp-${suffix}` };
  // Fixtures use the owner login; the stop runs as the runtime login in the caller's space, as a
  // request does. Without DATABASE_MIGRATION_URL both are DATABASE_URL.
  let prisma: PrismaClient;
  let app: ReturnType<typeof createDb>;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;

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

  it("closes the card, settles every pending effect of the run and cancels the run", async () => {
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
          idempotencyKey: `sap-${suffix}-${i}`,
          status: "intended",
          request: { i },
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
    // An open approval pauses the run; the secret a typed answer would leave must go too.
    await prisma.secret.create({
      data: {
        userId: ids.user,
        spaceId: ids.space,
        kind: `run-secret:${run.id}`,
        ciphertext: "fake-ciphertext",
      },
    });

    await runAsTenant({ spaceId: ids.space, userId: ids.user }, () =>
      stopThreadRuns(
        {
          prisma: app.prisma,
          sandbox: {} as never,
          events: { notify: async () => undefined } as never,
        },
        { spaceId: ids.space, userId: ids.user } as Actor,
        { kind: "bot", botId, threadId } as never,
      ),
    );

    expect((await prisma.run.findUniqueOrThrow({ where: { id: run.id } })).status).toBe(
      "cancelled",
    );
    const status = async (id: string) =>
      (await prisma.externalEffect.findUniqueOrThrow({ where: { id } })).status;
    expect(await status(card.id)).toBe("stopped");
    expect(await status(other.id)).toBe("stopped");
    const blocks = JSON.stringify(
      (await prisma.message.findFirstOrThrow({ where: { runId: run.id, role: "bot" } })).blocks,
    );
    expect(blocks).toContain('"answer":"stopped"');
    expect(blocks).toContain('"status":"answered"');
    expect(await prisma.secret.count({ where: { kind: `run-secret:${run.id}` } })).toBe(0);
  });
});
