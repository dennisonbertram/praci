import { createHash } from "node:crypto";
import type { HttpSourceCall, McpSourceCall, MessageBlock } from "@rakazo/contracts";
import { approvalTitle, MessageBlock as MessageBlockSchema } from "@rakazo/contracts";
import type { NotificationEvents, PrismaClient, ThreadEvents } from "@rakazo/db";
import { appendEventInTransaction, createThreadMessageInTransaction } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { announcePageData } from "./pages.js";
import { notifyThreadEvent } from "./run-notification.js";

type Events = Pick<ThreadEvents, "append"> & Partial<Pick<ThreadEvents, "notify">>;

export interface PageSourceApprovalDeps {
  prisma: PrismaClient;
  events: Events;
  notificationEvents?: NotificationEvents;
}

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

/**
 * What the owner approves: the kind and the exact call, key order ignored. Anything else about the
 * source (name, schedule, page) can change without a new approval.
 */
export type OutsideSourceCall = McpSourceCall | HttpSourceCall;

export function pageSourceCallHash(kind: string, call: OutsideSourceCall): string {
  const parts =
    "url" in call
      ? { kind, url: call.url, secret: call.secret, accept: call.accept }
      : { kind, serverId: call.serverId, tool: call.tool, args: call.args };
  return createHash("sha256")
    .update(JSON.stringify(canonical(parts)))
    .digest("hex");
}

/** The card's Request line. Never cut: the hash covers every argument. */
export const pageSourceRequestLine = (call: OutsideSourceCall) => {
  if ("url" in call) return `Request: GET ${call.url}`;
  const args = Object.keys(call.args).length ? ` ${JSON.stringify(call.args)}` : "";
  return `Request: ${call.tool}${args}`;
};
export const PAGE_SOURCE_REQUEST_LINE_MAX = 500;

const EVERY: Record<string, string> = {
  "15m": "every 15 minutes",
  "1h": "every hour",
  "6h": "every 6 hours",
  "1d": "every day",
  "1w": "every week",
};

/**
 * The owner's card for an mcp source: Allow runs exactly this call on this schedule, Not now
 * refuses it. It carries the hash of the call it shows, so it can never approve a different one.
 */
export function pageSourceApprovalBlock(input: {
  sourceId: string;
  callHash: string;
  /** The MCP server's name, or the API's host. */
  serverName: string;
  schedule: string;
  pageTitle: string;
  call: OutsideSourceCall;
}): MessageBlock {
  return {
    kind: "ask",
    text: `Read ${input.serverName} ${EVERY[input.schedule] ?? input.schedule}?`,
    detail: [
      pageSourceRequestLine(input.call),
      ...("url" in input.call && input.call.secret ? [`Key: ${input.call.secret}`] : []),
      `Page: ${input.pageTitle}`.slice(0, 100),
    ].join("\n"),
    pageSource: { sourceId: input.sourceId, callHash: input.callHash },
    status: "pending",
    actions: [
      { id: "allow", label: "Allow" },
      { id: "deny", label: "Not now" },
    ],
  };
}

/** Post the card in the bot's thread, mark the thread unread and notify the owner. The run is not paused. */
export async function postPageSourceApproval(
  deps: PageSourceApprovalDeps,
  run: { id: string; spaceId: string; userId: string; botId: string; threadId: string },
  botName: string,
  block: MessageBlock,
): Promise<void> {
  const blocks = [block];
  const { messageId, seq } = await deps.prisma.$transaction(async (tx) => {
    const card = await createThreadMessageInTransaction(tx, {
      threadId: run.threadId,
      role: "bot",
      blocks,
      botId: run.botId,
      runId: run.id,
      markUnread: true,
      allowCancelledRun: true,
    });
    const event = await appendEventInTransaction(tx, {
      spaceId: run.spaceId,
      threadId: run.threadId,
      botId: run.botId,
      type: "thread.message.created",
      runId: run.id,
      allowCancelledRun: true,
      payload: { messageId: card.id, role: "bot", blocks },
    });
    return { messageId: card.id, seq: event.seq };
  });
  await deps.events.notify?.(run.threadId, seq).catch((error: unknown) => {
    getLogger().error("page source approval realtime notification", error);
  });
  if (block.kind !== "ask") return;
  try {
    await notifyThreadEvent(
      deps.prisma,
      deps.notificationEvents,
      run,
      {
        kind: "help",
        title: approvalTitle(botName),
        body: block.text,
        botId: run.botId,
        threadId: run.threadId,
      },
      `${messageId}\npage-source`,
    );
  } catch (error) {
    getLogger().error("page source approval notification", error);
  }
}

type Scope = { spaceId: string; userId: string; threadId: string };
type Input = { runId: string; messageId: string };

/** The pending page source card a thread answer names, or null when it is any other message. */
export async function findPageSourceApproval(prisma: PrismaClient, scope: Scope, input: Input) {
  const message = await prisma.message.findFirst({
    where: {
      id: input.messageId,
      threadId: scope.threadId,
      runId: input.runId,
      role: "bot",
      thread: { spaceId: scope.spaceId, userId: scope.userId },
    },
    select: { id: true, botId: true, blocks: true },
  });
  const parsed = MessageBlockSchema.array().safeParse(message?.blocks);
  if (!message || !parsed.success) return null;
  const ask = parsed.data.find((block) => block.kind === "ask" && block.pageSource);
  if (ask?.kind !== "ask" || !ask.pageSource || ask.status === "answered") return null;
  return { message: { id: message.id, botId: message.botId, blocks: parsed.data }, ask };
}

async function closeCard(
  deps: PageSourceApprovalDeps,
  scope: Scope,
  runId: string,
  message: { id: string; botId: string | null; blocks: MessageBlock[] },
  answer: string,
) {
  const blocks = message.blocks.map((block) =>
    block.kind === "ask" && block.pageSource
      ? { ...block, status: "answered" as const, answer }
      : block,
  );
  const seq = await deps.prisma.$transaction(async (tx) => {
    await tx.message.update({ where: { id: message.id }, data: { blocks } });
    const event = await appendEventInTransaction(tx, {
      spaceId: scope.spaceId,
      threadId: scope.threadId,
      botId: message.botId ?? "",
      type: "thread.message.updated",
      runId,
      allowCancelledRun: true,
      payload: { messageId: message.id, role: "bot", blocks },
    });
    return event.seq;
  });
  await deps.events.notify?.(scope.threadId, seq).catch((error: unknown) => {
    getLogger().error("page source approval answer notification", error);
  });
}

/** Closing a card the answer refuses is tidy-up; the refusal stands if it fails. */
const closeRefusedCard = (...args: Parameters<typeof closeCard>) =>
  closeCard(...args).catch((error: unknown) => {
    getLogger().warn("page source approval card close failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

/**
 * The owner's answer to a page source card. Allow approves the call the card shows, only if the
 * source still has exactly that call, and starts it (the caller refreshes). Not now marks it
 * denied. Returns the approved source row, "denied", or null when the card can no longer be
 * answered: another bot's or owner's, already answered, the source gone, or its call changed
 * since the card (that card is closed as replaced and approves nothing).
 */
export async function answerPageSourceApproval(
  deps: PageSourceApprovalDeps,
  scope: Scope,
  input: Input & { answer: string },
) {
  if (input.answer !== "allow" && input.answer !== "deny") return null;
  const found = await findPageSourceApproval(deps.prisma, scope, input);
  if (!found?.ask.pageSource) return null;
  const { message, ask } = found;
  const { sourceId, callHash } = ask.pageSource!;
  // Only the owner of the bot the card sits under: the thread query already matched the actor.
  const bot = await deps.prisma.bot.findFirst({
    where: { id: message.botId ?? "", spaceId: scope.spaceId, userId: scope.userId },
    select: { id: true },
  });
  if (!bot) return null;
  const source = await deps.prisma.pageSource.findFirst({
    where: {
      id: sourceId,
      spaceId: scope.spaceId,
      userId: scope.userId,
      botId: bot.id,
      kind: { in: ["mcp", "http"] },
    },
  });
  if (!source) {
    await closeRefusedCard(deps, scope, input.runId, message, "expired");
    return null;
  }
  if (pageSourceCallHash(source.kind, source.call as OutsideSourceCall) !== callHash) {
    await closeRefusedCard(deps, scope, input.runId, message, "superseded");
    return null;
  }
  if (source.status !== "pending") return null;
  const now = new Date();
  // updatedAt makes a call change between the read and this write lose instead of be approved.
  const claimed = await deps.prisma.pageSource.updateMany({
    where: {
      id: source.id,
      spaceId: scope.spaceId,
      userId: scope.userId,
      status: "pending",
      updatedAt: source.updatedAt,
    },
    data:
      input.answer === "allow"
        ? {
            status: "active",
            approvedCallHash: callHash,
            failures: 0,
            lastError: null,
            leaseUntil: null,
            nextRefreshAt: now,
          }
        : { status: "denied" },
  });
  if (claimed.count !== 1) return null;
  await closeCard(deps, scope, input.runId, message, input.answer);
  if (input.answer === "deny") {
    await announcePageData(deps, source);
    return "denied" as const;
  }
  return deps.prisma.pageSource.findFirstOrThrow({
    where: { id: source.id, spaceId: scope.spaceId, userId: scope.userId, botId: bot.id },
  });
}
