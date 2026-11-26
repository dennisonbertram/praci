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
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("routines.resume (PostgreSQL)", () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (name: string) => `rrs-${name}-${suffix}`;
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
  let botId: string;
  const jobs = { enqueue: vi.fn(), cancel: vi.fn() };
  let client: {
    routines: {
      resume(input: { routineId: string }): Promise<{
        id: string;
        status: { pausedReason: string | null; nextRunAt: string | null };
      }>;
      list(input: {
        botId: string;
      }): Promise<{ id: string; status: { pausedReason: string | null } }[]>;
    };
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const owner of [userId, otherUserId]) {
      await prisma.user.create({
        data: { id: owner, name: owner, email: `${owner}@rakazo.test`, emailVerified: false },
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
        id: id("m"),
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
    botId = bot.id;
    client = createRouterClient(
      createRouter({
        prisma,
        env: {},
        events: { append: vi.fn(), notify: vi.fn() },
        jobs,
      } as unknown as RouterDeps),
      { context: { actor } as never },
    ) as never;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("resumes a watch the system paused and checks it again now", async () => {
    const routine = await prisma.routine.create({
      data: {
        spaceId,
        botId,
        userId,
        name: "Pricing page",
        prompt: "Tell me what changed.",
        crons: [],
        active: true,
        watch: { kind: "page", url: "https://example.com/pricing", intervalMinutes: 60 },
      },
    });
    await prisma.routineWatchState.create({
      data: {
        routineId: routine.id,
        spaceId,
        pausedReason: "errors",
        consecutiveErrors: 5,
        nextCheckAt: null,
      },
    });

    const before = Date.now();
    const resumed = await client.routines.resume({ routineId: routine.id });

    expect(resumed.status.pausedReason).toBeNull();
    const state = await prisma.routineWatchState.findUniqueOrThrow({
      where: { routineId: routine.id },
    });
    expect(state.pausedReason).toBeNull();
    expect(state.consecutiveErrors).toBe(0);
    expect(state.nextCheckAt).not.toBeNull();
    expect(state.nextCheckAt!.getTime()).toBeGreaterThanOrEqual(before - 1_000);
    expect(state.nextCheckAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1_000);
  });

  it("clears a credit hold and schedules the next run", async () => {
    const credential = await prisma.userModelCredential.create({
      data: { userId, provider: "openrouter", label: "Fixture", secretId: id("secret") },
    });
    await prisma.modelConnectionPause.create({
      data: {
        spaceId,
        userId,
        credentialId: credential.id,
        pausedUntil: new Date(Date.now() + 60 * 60_000),
      },
    });
    const routine = await prisma.routine.create({
      data: {
        spaceId,
        botId,
        userId,
        name: "Hourly",
        prompt: "p",
        crons: ["0 * * * *"],
        active: true,
        pausedConnectionId: credential.id,
      },
    });
    const pausedReason = async () =>
      (await client.routines.list({ botId })).find((r) => r.id === routine.id)?.status.pausedReason;
    expect(await pausedReason()).toBe("credit");

    const before = Date.now();
    const resumed = await client.routines.resume({ routineId: routine.id });

    expect(resumed.status.pausedReason).toBeNull();
    expect(resumed.status.nextRunAt).not.toBeNull();
    expect(new Date(resumed.status.nextRunAt!).getTime()).toBeGreaterThan(before);
    expect(
      await prisma.modelConnectionPause.count({
        where: { spaceId, userId, credentialId: credential.id },
      }),
    ).toBe(0);
    expect(await pausedReason()).toBeNull();
    expect(jobs.enqueue).toHaveBeenCalled();
  });

  it("refuses another user's routine", async () => {
    const routine = await prisma.routine.create({
      data: {
        spaceId,
        botId,
        userId: otherUserId,
        name: "Other",
        prompt: "p",
        crons: [],
        active: true,
      },
    });
    await prisma.routineWatchState.create({
      data: { routineId: routine.id, spaceId, pausedReason: "noisy" },
    });

    await expect(client.routines.resume({ routineId: routine.id })).rejects.toThrow();
    expect(
      (await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: routine.id } }))
        .pausedReason,
    ).toBe("noisy");
  });

  it("refuses a routine that is not system-paused", async () => {
    const routine = await prisma.routine.create({
      data: {
        spaceId,
        botId,
        userId,
        name: "Fine",
        prompt: "p",
        crons: ["0 9 * * *"],
        active: true,
      },
    });

    await expect(client.routines.resume({ routineId: routine.id })).rejects.toThrow(/paused/i);
  });
});
