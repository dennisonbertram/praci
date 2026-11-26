import type { Actor, RunActivityRow } from "@rakazo/contracts";
import { APPROVAL_TITLE_SUFFIX, MessageBlock } from "@rakazo/contracts";
import {
  ACTIVE_RUN_STATUSES,
  BACKGROUND_RUN_TRIGGERS,
  botMessageContext,
  plainTextFromMarkdown,
  runFailureError,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { Prisma } from "@rakazo/db";

const RECENT_LIMIT = 20;
const QUIET_LIMIT = 5;
const RECENT_SCAN_LIMIT = 200;
const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

function promptSnippet(prompt: string, max = 120): string {
  const oneLine = prompt.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

export function activityPromptSnippet(
  input: { trigger: string; prompt: string; sourceBlocks?: unknown },
  max = 120,
): string {
  // A new bot's introduction runs on an internal prompt; say what happened instead.
  if (input.trigger === "created") return "Introduced itself";
  if (input.trigger !== "bot_message") return promptSnippet(input.prompt, max);
  const parsed = MessageBlock.array().safeParse(input.sourceBlocks);
  const message = parsed.success ? botMessageContext(parsed.data) : undefined;
  if (!message) return "Message from another agent";
  const name = message.fromBotName.trim() || "Another agent";
  const label =
    message.intent === "result" || message.intent === "status" || message.intent === "fyi"
      ? `Update from ${name}`
      : `${name} asked`;
  // The other agent's text is markdown; the row shows one plain line.
  const text = plainTextFromMarkdown(message.text);
  return promptSnippet(text ? `${label}: ${text}` : label, max);
}

/** The question or approval a held run is waiting on, as one plain line; undefined when none is pending. */
export function pendingAskSnippet(messages: readonly { blocks: unknown }[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const parsed = MessageBlock.array().safeParse(messages[index]?.blocks);
    if (!parsed.success) continue;
    for (const block of parsed.data) {
      if (block.kind === "ask" && block.status !== "answered") {
        return promptSnippet(plainTextFromMarkdown(block.text));
      }
    }
  }
  return undefined;
}

/** The pending card on a held run asks to allow an action (as the "needs approval" notification does), not a question. */
export function pendingAskIsApproval(messages: readonly { blocks: unknown }[]): boolean {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const parsed = MessageBlock.array().safeParse(messages[index]?.blocks);
    if (!parsed.success) continue;
    for (const block of parsed.data) {
      if (block.kind === "ask" && block.status !== "answered") {
        return Boolean(block.approvalEffectId || block.mail);
      }
    }
  }
  return false;
}

export function activityNotificationsEnabled(
  groupId: string | null,
  notifyOnFinish: boolean,
): boolean {
  return groupId !== null || notifyOnFinish;
}

export async function listSpaceRuns(
  prisma: PrismaClient,
  actor: Actor,
  filter: "active" | "recent",
): Promise<RunActivityRow[]> {
  const where = {
    spaceId: actor.spaceId,
    userId: actor.userId,
    bot: { archivedAt: null },
    // Archiving a group cancels its runs but keeps them; an archived group cannot be opened.
    thread: { OR: [{ groupId: null }, { group: { archivedAt: null } }] },
    // Background ticket work belongs on the board, not in the activity list.
    trigger: { notIn: [...BACKGROUND_RUN_TRIGGERS] },
    ...(filter === "active"
      ? { status: { in: [...ACTIVE_RUN_STATUSES] } }
      : { status: { in: [...TERMINAL_STATUSES] } }),
  };
  const orderBy =
    filter === "active"
      ? [{ updatedAt: "desc" as const }, { id: "desc" as const }]
      : [
          { completedAt: { sort: "desc" as const, nulls: "last" as const } },
          { updatedAt: "desc" as const },
          { id: "desc" as const },
        ];

  // A routine run that completed without posting a message ended silently.
  const findSpoke = async (runIds: string[]) =>
    new Set(
      runIds.length
        ? (
            await prisma.message.findMany({
              where: {
                runId: { in: runIds },
                role: "bot",
                thread: { spaceId: actor.spaceId, userId: actor.userId },
              },
              select: { runId: true },
            })
          ).map((message) => message.runId)
        : [],
    );
  const isQuietCandidate = (row: { trigger: string; status: string }) =>
    row.trigger === "routine" && row.status === "completed";

  // Finished runs: quiet routine runs get their own small cap so they cannot crowd out real results.
  // ponytail: 200-row scan; if the newest 200 finished runs are all quiet, Finished shows fewer than 20. Add server paging when that happens.
  let ids: string[] | undefined;
  const silentIds = new Set<string>();
  if (filter === "recent") {
    const scan = await prisma.run.findMany({
      where,
      orderBy,
      take: RECENT_SCAN_LIMIT,
      select: { id: true, trigger: true, status: true },
    });
    const spoke = await findSpoke(scan.filter(isQuietCandidate).map((row) => row.id));
    ids = [];
    let loud = 0;
    for (const row of scan) {
      const silent = isQuietCandidate(row) && !spoke.has(row.id);
      if (silent ? silentIds.size < QUIET_LIMIT : loud < RECENT_LIMIT) {
        ids.push(row.id);
        if (silent) silentIds.add(row.id);
        else loud += 1;
      }
    }
  }
  const found = await prisma.run.findMany({
    where: ids ? { ...where, id: { in: ids } } : where,
    include: {
      bot: { select: { name: true, notifyOnFinish: true } },
      routine: { select: { name: true } },
      task: { select: { prompt: true } },
      sourceMessage: { select: { blocks: true } },
      thread: {
        select: {
          groupId: true,
          group: { select: { name: true } },
        },
      },
    },
    orderBy,
  });
  // A row can vanish between the two queries (deleted or archived meanwhile); skip it.
  const rows = ids ? ids.flatMap((id) => found.filter((row) => row.id === id)) : found;

  const replies = rows.length
    ? await prisma.$queryRaw<Array<{ id: string; runId: string }>>(Prisma.sql`
        SELECT DISTINCT ON (m."runId") m.id, m."runId"
        FROM messages m
        INNER JOIN runs r ON r.id = m."runId" AND r."threadId" = m."threadId"
        INNER JOIN threads t ON t.id = m."threadId"
        WHERE r.id IN (${Prisma.join(rows.map((row) => row.id))})
          AND r."spaceId" = ${actor.spaceId} AND r."userId" = ${actor.userId}
          AND t."spaceId" = ${actor.spaceId} AND t."userId" = ${actor.userId}
          AND m.role = 'bot'
        ORDER BY m."runId", m."createdAt" DESC, m.id DESC
      `)
    : [];
  const replyByRun = new Map(replies.map((message) => [message.runId, message.id]));

  // A held run previews its own question or approval instead of the prompt that started it.
  const heldRunIds = rows.filter((row) => row.status === "waiting_input").map((row) => row.id);
  const askMessages = heldRunIds.length
    ? await prisma.message.findMany({
        where: {
          runId: { in: heldRunIds },
          thread: { spaceId: actor.spaceId, userId: actor.userId },
        },
        orderBy: { seq: "asc" },
        select: { runId: true, blocks: true },
      })
    : [];

  return rows.map((row) => ({
    silent: silentIds.has(row.id) ? true : undefined,
    needsApproval:
      row.status === "waiting_input" &&
      pendingAskIsApproval(askMessages.filter((message) => message.runId === row.id)),
    runId: row.id,
    botId: row.botId,
    botName: row.bot.name,
    groupId: row.thread.groupId,
    groupName: row.thread.group?.name ?? null,
    threadId: row.threadId,
    status: row.status as RunActivityRow["status"],
    error:
      row.status === "failed"
        ? runFailureError({ type: `run.${row.status}`, payload: { error: row.error } })
        : null,
    messageId: replyByRun.get(row.id) ?? null,
    trigger: row.trigger as RunActivityRow["trigger"],
    notificationsEnabled: activityNotificationsEnabled(row.thread.groupId, row.bot.notifyOnFinish),
    promptSnippet:
      pendingAskSnippet(askMessages.filter((message) => message.runId === row.id)) ??
      (row.trigger === "routine" && row.routine?.name.trim()
        ? promptSnippet(row.routine.name)
        : undefined) ??
      activityPromptSnippet({
        trigger: row.trigger,
        prompt: row.task.prompt,
        sourceBlocks: row.sourceMessage?.blocks,
      }),
    updatedAt: (filter === "recent" && row.completedAt
      ? row.completedAt
      : row.updatedAt
    ).toISOString(),
  }));
}

/**
 * The "needs approval" notifications (seen or not: viewing a card is not answering it) whose card is still waiting for an answer, one per card: the run is
 * held for input, its agent exists and is not archived, and a card on it is unanswered. Reading the
 * runs rather than the notification history keeps an old approval, or one for a deleted agent,
 * from being restored or dropped by how long ago it was sent.
 */
export async function listPendingApprovalNotifications(prisma: PrismaClient, actor: Actor) {
  const runs = await prisma.run.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      status: "waiting_input",
      bot: { archivedAt: null },
    },
    select: { id: true, threadId: true },
  });
  if (runs.length === 0) return [];
  const messages = await prisma.message.findMany({
    where: {
      runId: { in: runs.map((run) => run.id) },
      thread: { spaceId: actor.spaceId, userId: actor.userId },
    },
    orderBy: { seq: "asc" },
    select: { runId: true, blocks: true },
  });
  // A held run waits on one card, and it must be an approval: an older approval notification does
  // not count while the run now waits on a plain question.
  const runIds = runs
    .filter((run) => pendingAskIsApproval(messages.filter((m) => m.runId === run.id)))
    .map((run) => run.id);
  if (runIds.length === 0) return [];
  const notifications = await prisma.notification.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      surface: "thread",
      runId: { in: runIds },
      importance: "attention",
      kind: "needs_input",
      title: { endsWith: APPROVAL_TITLE_SUFFIX },
      dismissedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  // Every approval the run asked leaves a notification; answering a card only marks it seen. Only
  // the newest one belongs to the card still waiting, so keep one per run (oldest run first).
  const newestPerRun = new Map<string, (typeof notifications)[number]>();
  for (const notification of notifications) {
    if (notification.runId && !newestPerRun.has(notification.runId)) {
      newestPerRun.set(notification.runId, notification);
    }
  }
  return [...newestPerRun.values()].reverse();
}
