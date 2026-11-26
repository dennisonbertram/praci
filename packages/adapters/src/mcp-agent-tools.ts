import { randomUUID } from "node:crypto";
import type { JobPublisher } from "@rakazo/adapter-kit";
import { runContinueJob } from "@rakazo/adapter-kit";
import type { MessageBlock } from "@rakazo/contracts";
import { mcpClientNonce } from "@rakazo/core";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";

/** What `agent_send` needs to start a bot run: the same send path the app and inbound webhooks use. */
export interface McpAgentDeps {
  events: Pick<ThreadEvents, "sendUserMessage" | "notify">;
  jobs: Pick<JobPublisher, "enqueue">;
}

type Scope = { spaceId: string; userId: string };

export const AGENT_SEND_DEFAULT_WAIT_SECONDS = 60;
export const AGENT_SEND_MAX_WAIT_SECONDS = 120;
export const AGENT_SEND_MAX_CHARS = 10_000;
const POLL_MS = 500;
const THREAD_READ_DEFAULT = 20;
const THREAD_READ_MAX = 50;

const NOT_FOUND = { error: "Agent not found" };

export type AgentRunStatus =
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "cancelled";

function runStatus(status: string): AgentRunStatus {
  if (status === "waiting_input" || status === "waiting_takeover") return "waiting_for_approval";
  if (status === "completed" || status === "failed" || status === "cancelled") return status;
  return "running";
}

const textOf = (blocks: unknown) =>
  (Array.isArray(blocks) ? (blocks as MessageBlock[]) : [])
    .flatMap((block) =>
      block?.kind === "text" && typeof block.text === "string" ? [block.text] : [],
    )
    .join("\n")
    .trim();

/** The run's state and, once it has finished, the bot's reply. The member's own runs only. */
export async function agentRunState(prisma: PrismaClient, scope: Scope, runId: string) {
  const run = await prisma.run.findFirst({
    where: { id: runId, spaceId: scope.spaceId, userId: scope.userId },
    select: { id: true, threadId: true, status: true },
  });
  if (!run) return null;
  const status = runStatus(run.status);
  const base = { threadId: run.threadId, runId: run.id, status };
  if (status !== "completed") return base;
  const messages = await prisma.message.findMany({
    where: { runId: run.id, role: "bot" },
    orderBy: { seq: "asc" },
    select: { blocks: true },
  });
  const reply = messages
    .map((message) => textOf(message.blocks))
    .filter(Boolean)
    .join("\n\n");
  return { ...base, reply };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sends a message to one of the member's agents and starts a normal run with trigger `mcp`
 * (unattended and tainted, so its risky tool calls ask in Praci). With `wait`, polls the run
 * for up to the asked seconds; each poll is its own short query, so no connection is held.
 */
export async function agentSend(
  prisma: PrismaClient,
  deps: McpAgentDeps | undefined,
  scope: Scope,
  connectionId: string,
  args: Record<string, unknown>,
  options: { wait: boolean; key?: string },
) {
  if (!deps) return { error: "Sending to agents is not available" };
  const text = typeof args.message === "string" ? args.message.trim() : "";
  if (!text) return { error: "message is required" };
  if (text.length > AGENT_SEND_MAX_CHARS) return { error: "message is too long" };
  const botId = typeof args.botId === "string" ? args.botId : "";
  const thread = botId
    ? await prisma.thread.findFirst({
        where: {
          botId,
          spaceId: scope.spaceId,
          bot: { userId: scope.userId, spaceId: scope.spaceId, archivedAt: null },
        },
        select: { id: true },
      })
    : null;
  // An agent has one thread; a threadId that is not that thread is not found.
  if (!thread || (args.threadId !== undefined && args.threadId !== thread.id)) return NOT_FOUND;
  const sent = await deps.events.sendUserMessage({
    spaceId: scope.spaceId,
    threadId: thread.id,
    botId,
    userId: scope.userId,
    blocks: [{ kind: "text", text }],
    prompt: text,
    trigger: "mcp",
    clientNonce: mcpClientNonce(connectionId, options.key ?? randomUUID()),
  });
  if (!sent.runId) return { error: "The agent could not start a run" };
  await deps.jobs.enqueue(runContinueJob(sent.runId)).catch(() => undefined);
  const seconds = Math.min(
    AGENT_SEND_MAX_WAIT_SECONDS,
    Math.max(
      0,
      typeof args.waitSeconds === "number" ? args.waitSeconds : AGENT_SEND_DEFAULT_WAIT_SECONDS,
    ),
  );
  const deadline = Date.now() + (options.wait ? seconds * 1000 : 0);
  for (;;) {
    const state = await agentRunState(prisma, scope, sent.runId);
    if (!state) return { error: "The run is gone" };
    if (state.status !== "running" || Date.now() >= deadline) return state;
    await sleep(POLL_MS);
  }
}

/** The latest messages of one of the member's agent threads, oldest first. */
export async function threadRead(
  prisma: PrismaClient,
  scope: Scope,
  args: Record<string, unknown>,
) {
  const threadId = typeof args.threadId === "string" ? args.threadId : "";
  const thread = threadId
    ? await prisma.thread.findFirst({
        where: {
          id: threadId,
          spaceId: scope.spaceId,
          bot: { userId: scope.userId, spaceId: scope.spaceId, archivedAt: null },
        },
        select: { id: true },
      })
    : null;
  if (!thread) return { error: "Thread not found" };
  const limit = Math.min(
    THREAD_READ_MAX,
    Math.max(1, typeof args.limit === "number" ? Math.floor(args.limit) : THREAD_READ_DEFAULT),
  );
  const rows = await prisma.message.findMany({
    where: { threadId: thread.id },
    orderBy: { seq: "desc" },
    take: limit,
    select: { seq: true, role: true, blocks: true, createdAt: true },
  });
  return {
    threadId: thread.id,
    messages: rows
      .reverse()
      .map((row) => ({
        seq: row.seq,
        role: row.role,
        at: row.createdAt.toISOString(),
        text: textOf(row.blocks),
      }))
      .filter((message) => message.text),
  };
}

export const AGENT_SEND_DESCRIPTOR = {
  name: "agent_send",
  description:
    "Send a message to one of the member's agents and wait for its reply. The agent runs unattended: risky actions ask the member in Praci. If it has not finished, the result is running or waiting_for_approval with a runId: check it with agent_run_status instead of sending again.",
  inputSchema: {
    type: "object" as const,
    properties: {
      botId: { type: "string", description: "The id of an agent from agents_list." },
      message: { type: "string" },
      threadId: { type: "string", description: "The agent's thread; defaults to its main thread." },
      waitSeconds: {
        type: "number",
        description: `Seconds to wait for the reply (default ${AGENT_SEND_DEFAULT_WAIT_SECONDS}, max ${AGENT_SEND_MAX_WAIT_SECONDS}).`,
      },
    },
    required: ["botId", "message"],
  },
};

export const AGENT_RUN_STATUS_DESCRIPTOR = {
  name: "agent_run_status",
  description:
    "The state of an agent run that agent_send left running or waiting_for_approval, with the reply once it has completed.",
  inputSchema: {
    type: "object" as const,
    properties: { runId: { type: "string" } },
    required: ["runId"],
  },
};

export const THREAD_READ_DESCRIPTOR = {
  name: "thread_read",
  description: "Read the latest messages of one of the member's agent threads.",
  inputSchema: {
    type: "object" as const,
    properties: {
      threadId: { type: "string" },
      limit: {
        type: "number",
        description: `Default ${THREAD_READ_DEFAULT}, max ${THREAD_READ_MAX}.`,
      },
    },
    required: ["threadId"],
  },
};
