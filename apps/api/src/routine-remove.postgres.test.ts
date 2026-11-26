import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;

describePostgres("routines.remove (PostgreSQL)", () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (name: string) => `rrm-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userId = id("owner");
  const otherUserId = id("other");
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let client: {
    routines: {
      remove(input: { routineId: string }): Promise<{ ok: true }>;
      update(input: { routineId: string; active: boolean }): Promise<unknown>;
    };
    checkIn: { set(input: { botId: string; cadence: "off" }): Promise<unknown> };
  };
  let routineId: string;
  let ownedRunId: string;
  let otherRunId: string;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of [userId, otherUserId]) {
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    await prisma.member.create({
      data: {
        id: id("member"),
        organizationId: orgId,
        userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    const bot = await createRepos(prisma).createBot(actor, {
      name: "Runner",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: false,
    });
    const threadId = (await prisma.thread.findFirstOrThrow({ where: { botId: bot.id } })).id;
    client = createRouterClient(
      createRouter({
        prisma,
        env: {},
        events: { append: vi.fn(), notify: vi.fn() },
        jobs: { enqueue: vi.fn(), cancel: vi.fn() },
      } as unknown as RouterDeps),
      { context: { actor } as never },
    ) as never;
    const routine = await prisma.routine.create({
      data: {
        id: id("routine"),
        spaceId,
        botId: bot.id,
        userId,
        name: "Daily",
        prompt: "routine prompt",
        crons: ["0 9 * * *"],
      },
    });
    const createQueuedRun = async (runUserId: string) => {
      const task = await prisma.task.create({
        data: {
          spaceId,
          botId: bot.id,
          threadId,
          userId: runUserId,
          prompt: "routine prompt",
          status: "queued",
        },
      });
      return prisma.run.create({
        data: {
          spaceId,
          botId: bot.id,
          threadId,
          taskId: task.id,
          userId: runUserId,
          status: "queued",
          trigger: "routine",
          routineId: routine.id,
        },
      });
    };
    const [ownedRun, otherRun] = await Promise.all([
      createQueuedRun(userId),
      createQueuedRun(otherUserId),
    ]);
    routineId = routine.id;
    ownedRunId = ownedRun.id;
    otherRunId = otherRun.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("cancels only the actor's queued routine runs before deleting", async () => {
    await client.routines.remove({ routineId });

    const [ownedRun, otherRun] = await Promise.all([
      prisma.run.findUniqueOrThrow({ where: { id: ownedRunId } }),
      prisma.run.findUniqueOrThrow({ where: { id: otherRunId } }),
    ]);
    expect(ownedRun.status).toBe("cancelled");
    expect(ownedRun.leaseOwner).toBeNull();
    expect(ownedRun.leaseExpiresAt).toBeNull();
    expect(ownedRun.startedAt).toBeNull();
    expect(otherRun.status).toBe("queued");
    expect(otherRun.leaseOwner).toBeNull();
    expect(otherRun.leaseExpiresAt).toBeNull();
    expect(otherRun.startedAt).toBeNull();
  });

  const createQueuedRun = async (
    routineOwnerId: string,
    status: "queued" | "running" | "waiting_input" | "waiting_takeover" = "queued",
    managed = false,
  ) => {
    const ownerRoutine = await prisma.routine.create({
      data: {
        spaceId,
        botId: (await prisma.bot.findFirstOrThrow({ where: { spaceId } })).id,
        userId: routineOwnerId,
        name: `Routine ${status} ${randomUUID()}`,
        prompt: "routine prompt",
        crons: ["0 9 * * *"],
        active: true,
        ...(managed ? { managedKind: "check_in" } : {}),
      },
    });
    const threadId = (
      await prisma.thread.findFirstOrThrow({ where: { botId: ownerRoutine.botId } })
    ).id;
    const task = await prisma.task.create({
      data: {
        spaceId,
        botId: ownerRoutine.botId,
        threadId,
        userId: routineOwnerId,
        prompt: "routine prompt",
        status,
      },
    });
    const run = await prisma.run.create({
      data: {
        spaceId,
        botId: ownerRoutine.botId,
        threadId,
        taskId: task.id,
        userId: routineOwnerId,
        status,
        trigger: "routine",
        routineId: ownerRoutine.id,
      },
    });
    return { routine: ownerRoutine, run, task };
  };

  it("cancels only queued runs when a routine is turned off and keeps its row and history", async () => {
    const own = await createQueuedRun(userId);
    const otherUser = await createQueuedRun(otherUserId);
    const running = await createQueuedRun(userId, "running");
    const waitingInput = await createQueuedRun(userId, "waiting_input");
    const waitingTakeover = await createQueuedRun(userId, "waiting_takeover");

    await client.routines.update({ routineId: own.routine.id, active: false });

    const [routine, ownRun, ownTask, otherRun, runningRun, waitingInputRun, waitingTakeoverRun] =
      await Promise.all([
        prisma.routine.findUniqueOrThrow({ where: { id: own.routine.id } }),
        prisma.run.findUniqueOrThrow({ where: { id: own.run.id } }),
        prisma.task.findUniqueOrThrow({ where: { id: own.task.id } }),
        prisma.run.findUniqueOrThrow({ where: { id: otherUser.run.id } }),
        prisma.run.findUniqueOrThrow({ where: { id: running.run.id } }),
        prisma.run.findUniqueOrThrow({ where: { id: waitingInput.run.id } }),
        prisma.run.findUniqueOrThrow({ where: { id: waitingTakeover.run.id } }),
      ]);
    expect(routine.active).toBe(false);
    expect(ownRun.status).toBe("cancelled");
    expect(ownTask.status).toBe("cancelled");
    expect(otherRun.status).toBe("queued");
    expect(runningRun.status).toBe("running");
    expect(waitingInputRun.status).toBe("waiting_input");
    expect(waitingTakeoverRun.status).toBe("waiting_takeover");
    expect(await prisma.run.count({ where: { routineId: own.routine.id } })).toBe(1);
  });

  it("cancels queued check-in runs when the cadence is turned off", async () => {
    const checkIn = await createQueuedRun(userId, "queued", true);

    await client.checkIn.set({ botId: checkIn.routine.botId, cadence: "off" });

    const [routine, run, task] = await Promise.all([
      prisma.routine.findUniqueOrThrow({ where: { id: checkIn.routine.id } }),
      prisma.run.findUniqueOrThrow({ where: { id: checkIn.run.id } }),
      prisma.task.findUniqueOrThrow({ where: { id: checkIn.task.id } }),
    ]);
    expect(routine.active).toBe(false);
    expect(run.status).toBe("cancelled");
    expect(task.status).toBe("cancelled");
  });
});
