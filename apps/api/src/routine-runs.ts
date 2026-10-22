import { ORPCError } from "@orpc/server";
import type { Actor, RoutineHistory, RoutineRun, RoutineRunCursor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { historyMessageText, Prisma } from "@rakazo/db";

export async function listRoutineRuns(
  prisma: PrismaClient,
  actor: Actor,
  routineId: string,
  before?: RoutineRunCursor,
): Promise<RoutineHistory> {
  const routine = await prisma.routine.findFirst({
    where: {
      id: routineId,
      spaceId: actor.spaceId,
      userId: actor.userId,
      bot: { archivedAt: null },
    },
    select: { botId: true },
  });
  if (!routine) throw new ORPCError("NOT_FOUND");

  const rows = await prisma.run.findMany({
    where: {
      routineId,
      botId: routine.botId,
      spaceId: actor.spaceId,
      userId: actor.userId,
      ...(before
        ? {
            OR: [
              { createdAt: { lt: new Date(before.createdAt) } },
              { createdAt: new Date(before.createdAt), id: { lt: before.id } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      botId: true,
      threadId: true,
      thread: { select: { groupId: true } },
      status: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
  });
  const runs = rows.slice(0, 20);
  const last = runs.at(-1);
  const nextCursor =
    rows.length > 20 && last ? { id: last.id, createdAt: last.createdAt.toISOString() } : null;
  // Routine runs can finish silently. A chat link is offered only when a message exists.
  const messages = runs.length
    ? await prisma.$queryRaw<
        Array<{ id: string; runId: string; threadId: string; blocks: Prisma.JsonValue }>
      >(Prisma.sql`
        SELECT DISTINCT ON (m."runId") m.id, m."runId", m."threadId", m.blocks
        FROM messages m
        INNER JOIN runs r ON r.id = m."runId" AND r."threadId" = m."threadId"
        INNER JOIN threads t ON t.id = m."threadId"
        WHERE r.id IN (${Prisma.join(runs.map((run) => run.id))})
          AND r."spaceId" = ${actor.spaceId} AND r."userId" = ${actor.userId}
          AND t."spaceId" = ${actor.spaceId} AND t."userId" = ${actor.userId}
          AND m.role = 'bot'
        ORDER BY m."runId", m."createdAt" DESC, m.id DESC
      `)
    : [];
  const replyByRun = new Map(messages.map((message) => [message.runId, message]));
  // A run that only asked another agent finishes at once; it stays "waiting" until that agent's run ends and its reply is delivered.
  const finished = runs.filter((run) => run.status === "completed").map((run) => run.id);
  const waiting = finished.length
    ? await prisma.$queryRaw<Array<{ runId: string; name: string }>>(Prisma.sql`
        SELECT DISTINCT ON (o."runId") o."runId", b.name
        FROM messages o
        INNER JOIN messages i
          ON i.blocks @> jsonb_build_array(jsonb_build_object('returnToMessageId', o.id))
        INNER JOIN runs c ON c."sourceMessageId" = i.id AND c.trigger = 'bot_message'
        INNER JOIN bots b ON b.id = c."botId"
        WHERE o."runId" IN (${Prisma.join(finished)})
          AND c."spaceId" = ${actor.spaceId} AND c."userId" = ${actor.userId}
          AND (
            c.status IN ('queued', 'leased', 'running', 'waiting_input', 'waiting_takeover')
            -- Finished, but its reply has not reached the asking agent yet (delivery is retried).
            OR (c.status IN ('completed', 'failed') AND c."botOutcomeReturnedAt" IS NULL)
          )
        ORDER BY o."runId", c."createdAt" DESC
      `)
    : [];
  const waitingOn = new Map(waiting.map((row) => [row.runId, row.name]));
  return {
    nextCursor,
    runs: runs.map((run) => ({
      id: run.id,
      botId: run.botId,
      groupId: run.thread.groupId,
      status: run.status as RoutineRun["status"],
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      messageId: replyByRun.get(run.id)?.id ?? null,
      preview: firstLine(replyByRun.get(run.id)?.blocks),
      waitingOn: waitingOn.get(run.id) ?? null,
    })),
  };
}

function firstLine(blocks: Prisma.JsonValue | undefined): string | null {
  // A subagent block contributes its result, not the task it was given.
  const shown = Array.isArray(blocks)
    ? blocks.map((block) =>
        block && typeof block === "object" && !Array.isArray(block) && block.kind === "subagent"
          ? { kind: "text", text: String(block.result ?? "") }
          : block,
      )
    : null;
  const line = historyMessageText(shown)
    .split("\n")
    .map((text) => text.trim())
    .find(Boolean);
  return line ? line.slice(0, 200) : null;
}
