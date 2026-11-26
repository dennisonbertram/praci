import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import { scannerAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataRoomJobDeps } from "./data-room-jobs.js";
import { reconcileDataRoom, runDataRoomIndex } from "./data-room-jobs.js";
import { fakeAi, MemoryArtifacts, RecordingJobs } from "./data-room-test-fakes.js";
import { scheduleReadyScans, scheduleScannerRun } from "./scanner-run.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("durable Scanner runs (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const spaceIds = [`sr-space-a-${run}`, `sr-space-b-${run}`];
  const users: Actor[] = [];
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let jobs: RecordingJobs;
  let serial = 0;

  const createActor = async (label: string, spaceId: string) => {
    const userId = `sr-user-${label}-${run}`;
    await prisma.user.create({
      data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: true },
    });
    await prisma.member.create({
      data: {
        id: `member-${userId}`,
        organizationId: spaceId,
        userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    const actor = { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    users.push(actor);
    return actor;
  };

  const createScanner = (actor: Actor) =>
    createRepos(prisma).createBot(actor, {
      spawnKey: scannerAgentSpawnKey(actor.userId),
      name: "Scanner agent",
      title: "",
      description: "",
      instructions: "Scanner test",
      notifyOnFinish: true,
    });

  const addItem = async (
    actor: Actor,
    source: string,
    status = "ready",
    extractedText: string | null = "synthetic extracted text",
  ) => {
    const id = `sr-item-${run}-${serial++}`;
    await prisma.dataRoomItem.create({
      data: {
        id,
        spaceId: actor.spaceId,
        userId: actor.userId,
        source,
        sha256: randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64),
        name: `${id}.pdf`,
        mimeType: source === "scan" ? "application/pdf" : "text/plain",
        size: 1n,
        status,
      },
    });
    if (extractedText !== null) {
      await prisma.dataRoomItemText.create({
        data: {
          itemId: id,
          spaceId: actor.spaceId,
          userId: actor.userId,
          text: extractedText,
        },
      });
    }
    return id;
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.dataRoomItem.deleteMany({ where: { spaceId: { in: spaceIds } } });
      await prisma.bot.deleteMany({ where: { spaceId: { in: spaceIds } } });
      await prisma.organization.deleteMany({ where: { id: { in: spaceIds } } });
      await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.userId) } } });
      await prisma.$disconnect();
      await db.pool.end();
    };
    for (const spaceId of spaceIds) {
      await prisma.organization.create({
        data: { id: spaceId, name: spaceId, slug: spaceId, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id: spaceId, organizationId: spaceId, name: spaceId, isDefault: true },
      });
    }
    jobs = new RecordingJobs();
  });

  afterAll(async () => close?.());

  it("creates one task/run under concurrent scheduling and persists the run id atomically", async () => {
    const actor = await createActor("owner", spaceIds[0] as string);
    const scanner = await createScanner(actor);
    const itemId = await addItem(actor, "scan");

    const results = await Promise.all([
      scheduleScannerRun({ prisma, jobs }, actor, itemId),
      scheduleScannerRun({ prisma, jobs }, actor, itemId),
    ]);
    const runId = results.find(Boolean);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(runId).toBeTruthy();
    expect(await prisma.run.count({ where: { botId: scanner.id } })).toBe(1);
    expect(await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({
      scannerRunId: runId,
    });
    expect(jobs.queue).toHaveLength(1);
    const task = await prisma.task.findFirstOrThrow({
      where: { botId: scanner.id },
      orderBy: { createdAt: "desc" },
    });
    expect(task.prompt).toContain(itemId);
    expect(task.prompt).not.toContain("synthetic extracted text");
  });

  it("schedules only ready, text-bearing scan rows in the requested owner scope", async () => {
    const actor = await createActor("eligible", spaceIds[0] as string);
    const other = await createActor("other", spaceIds[1] as string);
    await createScanner(actor);
    await createScanner(other);
    const eligible = await addItem(actor, "scan");
    const pending = await addItem(actor, "scan", "indexing");
    const empty = await addItem(actor, "scan", "ready", "");
    const noText = await addItem(actor, "scan", "ready", null);
    const upload = await addItem(actor, "upload");
    const foreign = await addItem(other, "scan");

    const scheduled = await scheduleReadyScans(
      { prisma, jobs },
      {
        scope: { spaceId: actor.spaceId, userId: actor.userId },
      },
    );

    expect(scheduled).toBe(1);
    expect(
      await prisma.dataRoomItem.findMany({
        where: { id: { in: [eligible, pending, empty, noText, upload, foreign] } },
        select: { id: true, scannerRunId: true },
      }),
    ).toEqual(
      expect.arrayContaining([
        { id: eligible, scannerRunId: expect.any(String) },
        { id: pending, scannerRunId: null },
        { id: empty, scannerRunId: null },
        { id: noText, scannerRunId: null },
        { id: upload, scannerRunId: null },
        { id: foreign, scannerRunId: null },
      ]),
    );
  });

  it("schedules a scan when its Data room indexing step completes", async () => {
    const actor = await createActor("indexed", spaceIds[0] as string);
    const scanner = await createScanner(actor);
    const itemId = await addItem(actor, "scan", "indexing");
    const deps = {
      prisma,
      jobs,
      artifacts: new MemoryArtifacts(),
      resolveAi: async () => fakeAi(),
    } satisfies Pick<DataRoomJobDeps, "prisma" | "jobs" | "artifacts" | "resolveAi">;

    await runDataRoomIndex(deps as DataRoomJobDeps, {
      spaceId: actor.spaceId,
      userId: actor.userId,
      itemId,
    });

    expect(await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({
      status: "ready",
      scannerRunId: expect.any(String),
    });
    expect(await prisma.run.count({ where: { botId: scanner.id, trigger: "routine" } })).toBe(1);
  });

  it("reconciles a ready scan after first Scanner provisioning and after a busy thread clears", async () => {
    const actor = await createActor("recovery", spaceIds[0] as string);
    const itemId = await addItem(actor, "scan");

    expect(await scheduleReadyScans({ prisma, jobs }, { scope: actor })).toBe(0);
    const scanner = await createScanner(actor);

    const task = await prisma.task.create({
      data: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        botId: scanner.id,
        threadId: scanner.threadId,
        prompt: "active test run",
        status: "queued",
      },
    });
    const active = await prisma.run.create({
      data: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        botId: scanner.id,
        threadId: scanner.threadId,
        taskId: task.id,
        status: "running",
        trigger: "user",
        unattended: false,
      },
    });

    expect(await scheduleReadyScans({ prisma, jobs }, { scope: actor })).toBe(0);
    expect(await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({
      scannerRunId: null,
    });
    await prisma.run.update({ where: { id: active.id }, data: { status: "completed" } });

    await reconcileDataRoom({ prisma, jobs });
    expect(await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({
      scannerRunId: expect.any(String),
    });
  });

  it("keeps the committed task and claim when enqueue fails for the run reconciler to recover", async () => {
    const actor = await createActor("enqueue", spaceIds[0] as string);
    const scanner = await createScanner(actor);
    const itemId = await addItem(actor, "scan");
    const failingJobs = { enqueue: async () => Promise.reject(new Error("queue unavailable")) };

    const runId = await scheduleScannerRun({ prisma, jobs: failingJobs as never }, actor, itemId);

    expect(runId).toBeTruthy();
    expect(await prisma.run.findUnique({ where: { id: runId as string } })).toMatchObject({
      botId: scanner.id,
      status: "queued",
      trigger: "routine",
    });
    expect(await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: itemId } })).toMatchObject({
      scannerRunId: runId,
    });
  });
});
