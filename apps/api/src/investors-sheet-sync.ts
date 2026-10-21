import type { Actor, MessageBlock } from "@rakazo/contracts";
import { actorScope, CapTableSourceRefSchema, investorsAgentSpawnKey } from "@rakazo/contracts";
import { ACTIVE_RUN_STATUSES } from "@rakazo/core";
import type { createRepos, PrismaClient } from "@rakazo/db";
import { appendEventInTransaction, createThreadMessageInTransaction } from "@rakazo/db";
import { ensureInvestorsAgent } from "./investors-agent.js";

/** Every sheet-read task starts with this, which is how its runs are told from the agent's other routine runs. */
const PROMPT_START = "Read the Google Sheet";

const sheetPrompt = (driveFileId: string) =>
  `${PROMPT_START} with file id ${driveFileId} and save it as the cap table. Call drive_read with that file id. This task allows cap_table_update for this read, whatever your other instructions say. If it reports truncated: true or contextTruncated: true, or any row cannot be read, stop and save nothing: say in one sentence that the sheet could not be read completely. Otherwise make cap_table_update your very next tool call, with the exact figures from the sheet, never estimated and null for anything the sheet does not give; set sourceRef.driveFileId to ${driveFileId}, list every holder row, and use the security as the sheet names it. Do not read anything else. Finish with one short sentence and no figures.`;

/** Matches the user's sheet-read runs. */
const sheetRunWhere = (actor: Actor) => ({
  ...actorScope(actor),
  bot: { spawnKey: investorsAgentSpawnKey(actor.userId) },
  trigger: "routine",
  routineId: null,
  task: { prompt: { startsWith: PROMPT_START } },
});

export type SheetReadDeps = {
  prisma: Pick<PrismaClient, "run" | "capTableSnapshot" | "$transaction">;
  repos: Pick<ReturnType<typeof createRepos>, "createBot">;
  /** False when no model is set up, so a run would only fail. */
  hasModel: (actor: Actor) => Promise<boolean>;
  enqueueRun: (runId: string) => Promise<void>;
};

/**
 * Starts one Investors agent run that reads the table's Google Sheet, unless one is already going.
 * Like the Carta read it uses the "routine" trigger, which offers the agent its tools without a
 * typed message. The database refuses the agent's cap_table_update unless the source is still this
 * sheet, so a result arriving after a switch is dropped.
 */
export async function startSheetRead(
  deps: SheetReadDeps,
  actor: Actor,
): Promise<"started" | "running" | "no_model" | "other_source"> {
  const table = await deps.prisma.capTableSnapshot.findUnique({
    where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
    select: { source: true, data: true },
  });
  const ref = CapTableSourceRefSchema.safeParse(
    (table?.data as { sourceRef?: unknown } | undefined)?.sourceRef,
  );
  if (table?.source !== "sheet" || !ref.success) return "other_source";
  const prompt = sheetPrompt(ref.data.driveFileId);
  const bot = await ensureInvestorsAgent(deps, actor);
  if (!(await deps.hasModel(actor))) return "no_model";
  const runId = await deps.prisma.$transaction(async (tx) => {
    // One read at a time per user, even for two requests at once.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('investors-sheet'), hashtext(${actor.userId}))`;
    const active = await tx.run.findFirst({
      // Only a read of this same sheet counts; one still running for a sheet since replaced does not.
      where: {
        ...sheetRunWhere(actor),
        task: { prompt },
        status: { in: [...ACTIVE_RUN_STATUSES] },
      },
      select: { id: true },
    });
    if (active) return null;
    const blocks: MessageBlock[] = [
      { kind: "meta", text: "You asked to read the cap table from a Google Sheet" },
    ];
    const message = await createThreadMessageInTransaction(tx, {
      threadId: bot.threadId,
      role: "system",
      blocks,
      botId: bot.id,
    });
    await appendEventInTransaction(tx, {
      spaceId: actor.spaceId,
      threadId: bot.threadId,
      botId: bot.id,
      type: "thread.message.created",
      payload: { messageId: message.id, role: "system", blocks },
    });
    const task = await tx.task.create({
      data: {
        ...actorScope(actor),
        botId: bot.id,
        threadId: bot.threadId,
        prompt,
        status: "queued",
      },
    });
    const run = await tx.run.create({
      data: {
        ...actorScope(actor),
        botId: bot.id,
        threadId: bot.threadId,
        taskId: task.id,
        status: "queued",
        trigger: "routine",
      },
      select: { id: true },
    });
    return run.id;
  });
  if (!runId) return "running";
  await deps.enqueueRun(runId);
  return "started";
}

/**
 * Whether a sheet read is going, and whether the latest one ended without a newer snapshot (the
 * snapshot's `updatedAt` is older than the run's `createdAt`), which includes a read the agent
 * stopped because the sheet was truncated.
 */
export async function sheetReadState(
  prisma: Pick<PrismaClient, "run">,
  actor: Actor,
  snapshotUpdatedAt: string | null,
): Promise<{ reading: boolean; lastReadFailed: boolean }> {
  const latest = await prisma.run.findFirst({
    where: sheetRunWhere(actor),
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true },
  });
  if (!latest) return { reading: false, lastReadFailed: false };
  if (ACTIVE_RUN_STATUSES.some((status) => status === latest.status))
    return { reading: true, lastReadFailed: false };
  return {
    reading: false,
    lastReadFailed: !snapshotUpdatedAt || latest.createdAt > new Date(snapshotUpdatedAt),
  };
}
