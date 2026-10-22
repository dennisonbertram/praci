import type { Actor, RunActivityRow } from "@rakazo/contracts";
import { MessageBlock } from "@rakazo/contracts";
import {
  ACTIVE_RUN_STATUSES,
  BACKGROUND_RUN_TRIGGERS,
  botMessageContext,
  plainTextFromMarkdown,
} from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";

const RECENT_LIMIT = 20;
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
  const rows = await prisma.run.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      bot: { archivedAt: null },
      // Background ticket work belongs on the board, not in the activity list.
      trigger: { notIn: [...BACKGROUND_RUN_TRIGGERS] },
      ...(filter === "active"
        ? { status: { in: [...ACTIVE_RUN_STATUSES] } }
        : { status: { in: [...TERMINAL_STATUSES] } }),
    },
    include: {
      bot: { select: { name: true, archivedAt: true, notifyOnFinish: true } },
      task: { select: { prompt: true } },
      sourceMessage: { select: { blocks: true } },
      thread: {
        select: {
          groupId: true,
          group: { select: { name: true } },
        },
      },
    },
    orderBy:
      filter === "active"
        ? [{ updatedAt: "desc" }, { id: "desc" }]
        : [{ completedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }],
    take: filter === "recent" ? RECENT_LIMIT : undefined,
  });

  // A held run previews its own question or approval instead of the prompt that started it.
  const heldRunIds = rows.filter((row) => row.status === "waiting_input").map((row) => row.id);
  const askMessages = heldRunIds.length
    ? await prisma.message.findMany({
        where: { runId: { in: heldRunIds }, thread: { spaceId: actor.spaceId } },
        orderBy: { seq: "asc" },
        select: { runId: true, blocks: true },
      })
    : [];

  return rows.map((row) => ({
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
    trigger: row.trigger as RunActivityRow["trigger"],
    notificationsEnabled: activityNotificationsEnabled(row.thread.groupId, row.bot.notifyOnFinish),
    promptSnippet:
      pendingAskSnippet(askMessages.filter((message) => message.runId === row.id)) ??
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
 * The "needs approval" notifications (seen or not: viewing a card is not answering it) whose card is still waiting for an answer: the run is
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
    where: { runId: { in: runs.map((run) => run.id) }, thread: { spaceId: actor.spaceId } },
    orderBy: { seq: "asc" },
    select: { runId: true, blocks: true },
  });
  const runIds = runs
    .filter((run) => pendingAskSnippet(messages.filter((m) => m.runId === run.id)) !== undefined)
    .map((run) => run.id);
  if (runIds.length === 0) return [];
  return prisma.notification.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      surface: "thread",
      runId: { in: runIds },
      importance: "attention",
      kind: "needs_input",
      title: { endsWith: " needs approval" },
      dismissedAt: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}
