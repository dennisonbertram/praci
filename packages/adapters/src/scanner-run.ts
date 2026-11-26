import { randomUUID } from "node:crypto";
import type { JobPublisher } from "@rakazo/adapter-kit";
import { runContinueJob } from "@rakazo/adapter-kit";
import { scannerAgentSpawnKey } from "@rakazo/contracts";
import { ACTIVE_RUN_STATUSES, newRunUnattended } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";

type Scope = { spaceId: string; userId: string };
type Candidate = Scope & { id: string };

const SCANNER_PROMPT = (itemId: string) =>
  `Name and type the new scan: Data room item ${itemId}. Read it with read_data_room_item, then update only its name and document type with update_scan. Use the saved name and folder from tools in one short reply.`;

export async function scheduleScannerRun(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  scope: Scope,
  itemId: string,
): Promise<string | null> {
  const spawnKey = scannerAgentSpawnKey(scope.userId);
  const bot = await deps.prisma.bot.findFirst({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      spawnKey,
      archivedAt: null,
    },
    select: { id: true, thread: { select: { id: true } } },
  });
  const threadId = bot?.thread?.id;
  if (!bot || !threadId) return null;

  const taskId = randomUUID();
  const runId = randomUUID();
  const scheduledRunId = await deps.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('scanner-run'), hashtext(${`${scope.spaceId}:${scope.userId}`}))`;
    const threads = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM threads
      WHERE id = ${threadId} AND "spaceId" = ${scope.spaceId} AND "userId" = ${scope.userId}
      FOR UPDATE`;
    if (!threads.length) return null;

    const currentBot = await tx.bot.findUnique({
      where: { id: bot.id },
      select: {
        spaceId: true,
        userId: true,
        spawnKey: true,
        archivedAt: true,
        thread: { select: { id: true } },
      },
    });
    if (
      !currentBot ||
      currentBot.spaceId !== scope.spaceId ||
      currentBot.userId !== scope.userId ||
      currentBot.spawnKey !== spawnKey ||
      currentBot.archivedAt !== null ||
      currentBot.thread?.id !== threadId
    ) {
      return null;
    }

    const active = await tx.run.findFirst({
      where: { threadId, status: { in: [...ACTIVE_RUN_STATUSES] } },
      select: { id: true },
    });
    if (active) return null;

    const claimed = await tx.$queryRaw<{ id: string }[]>`
      UPDATE data_room_items AS i
      SET "scannerRunId" = ${runId}
      WHERE i.id = ${itemId}
        AND i."spaceId" = ${scope.spaceId}
        AND i."userId" = ${scope.userId}
        AND i.source = 'scan'
        AND i.status = 'ready'
        AND i."scannerRunId" IS NULL
        AND EXISTS (
          SELECT 1 FROM data_room_item_texts AS t
          WHERE t."itemId" = i.id
            AND t."spaceId" = i."spaceId"
            AND t."userId" = i."userId"
            AND btrim(t.text) <> ''
        )
      RETURNING i.id`;
    if (!claimed.length) return null;

    await tx.task.create({
      data: {
        id: taskId,
        spaceId: scope.spaceId,
        userId: scope.userId,
        botId: bot.id,
        threadId,
        prompt: SCANNER_PROMPT(itemId),
        status: "queued",
      },
    });
    await tx.run.create({
      data: {
        id: runId,
        spaceId: scope.spaceId,
        userId: scope.userId,
        botId: bot.id,
        threadId,
        taskId,
        status: "queued",
        trigger: "routine",
        unattended: newRunUnattended({ trigger: "routine" }),
      },
      select: { id: true },
    });
    return runId;
  });

  if (scheduledRunId) {
    await deps.jobs.enqueue(runContinueJob(scheduledRunId)).catch(() => undefined);
  }
  return scheduledRunId;
}

export async function scheduleReadyScans(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  options: { scope?: Scope; batchSize?: number } = {},
): Promise<number> {
  const scopeFilter = options.scope
    ? Prisma.sql`AND i."spaceId" = ${options.scope.spaceId} AND i."userId" = ${options.scope.userId}`
    : Prisma.empty;
  const candidates = await deps.prisma.$queryRaw<Candidate[]>`
    SELECT i.id, i."spaceId", i."userId"
    FROM data_room_items AS i
    WHERE i.source = 'scan'
      AND i.status = 'ready'
      AND i."scannerRunId" IS NULL
      AND EXISTS (
        SELECT 1 FROM data_room_item_texts AS x
        WHERE x."itemId" = i.id
          AND x."spaceId" = i."spaceId"
          AND x."userId" = i."userId"
          AND btrim(x.text) <> ''
      )
      AND EXISTS (
        SELECT 1
        FROM bots AS b
        JOIN threads AS t ON t."botId" = b.id
        WHERE b."spaceId" = i."spaceId"
          AND b."userId" = i."userId"
          AND b."spawnKey" = 'scanner-agent:' || i."userId"
          AND b."archivedAt" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM runs AS r
            WHERE r."threadId" = t.id
              AND r.status IN (${Prisma.join(ACTIVE_RUN_STATUSES)})
          )
      )
      ${scopeFilter}
    ORDER BY i."createdAt" ASC, i.id ASC
    LIMIT ${options.batchSize ?? 200}`;

  let scheduled = 0;
  for (const candidate of candidates) {
    const runId = await scheduleScannerRun(deps, candidate, candidate.id);
    if (runId) scheduled++;
  }
  return scheduled;
}
