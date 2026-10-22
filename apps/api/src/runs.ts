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
