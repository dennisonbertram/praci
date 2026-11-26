import type { ActionApprovalRule } from "@rakazo/core";
import {
  BLOCKED_ACTION_MESSAGE,
  hardLineFor,
  resolveActionApprovalDetail,
  resolvePermissionLevel,
  toolRuleAllowsAllow,
} from "@rakazo/core";
import type { NotificationEvents, Prisma, PrismaClient } from "@rakazo/db";
import {
  createNotification,
  listApprovalRules,
  loadSpacePermissionLevel,
  NOTIFICATION_BODY_MAX,
  runAsSystem,
  setApprovalRule,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { McpAgentDeps } from "./mcp-agent-tools.js";
import { AGENT_SEND_MAX_CHARS, agentRunState } from "./mcp-agent-tools.js";
import type { McpWriteToolName } from "./mcp-read-tools.js";
import {
  callMcpWriteTool,
  mcpWriteToolDescriptors,
  ownBot,
  wrapUntrustedText,
} from "./mcp-read-tools.js";

/** A waiting action that nobody answered in this time is closed. */
export const EXTERNAL_ACTION_TTL_MS = 24 * 60 * 60 * 1000;
/** An approved action that has not finished in this time was cut off (a crashed process). */
const RUNNING_LIMIT_MS = 10 * 60 * 1000;
/** Actions one connection may have waiting at once, so a client cannot flood the member's cards. */
export const MAX_PENDING_PER_CONNECTION = 20;

type Owner = { spaceId: string; userId: string };
const scopeOf = ({ spaceId, userId }: Owner) => ({ spaceId, userId });
const failed = (result: unknown) =>
  typeof result === "object" && result !== null && "error" in result;
const json = (value: unknown) => value as Prisma.InputJsonValue;

export type McpWriteResult = {
  outcome: "ok" | "error" | "pending" | "blocked";
  result: unknown;
};

/** Runs the handler for an action and records how it ended. Callers claim the row first. */
async function execute(
  prisma: PrismaClient,
  action: Owner & { id: string; tool: string; args: unknown; connectionId: string },
  agents?: McpAgentDeps,
) {
  let result: unknown;
  try {
    result = await callMcpWriteTool(
      action.tool as McpWriteToolName,
      // An approved agent_send starts the run and returns; action_status reports the reply later.
      {
        prisma,
        scope: scopeOf(action),
        agents,
        connectionId: action.connectionId,
        key: action.id,
        wait: false,
      },
      (action.args ?? {}) as Record<string, unknown>,
    );
  } catch {
    result = { error: "The action failed" };
  }
  const status = failed(result) ? "failed" : "done";
  await prisma.externalAction.update({
    where: { id: action.id },
    data: { status, result: json(result) },
  });
  return { status, result } as const;
}

/** Why a write can never succeed, so the member is not asked to approve it. Null when it can run. */
async function preflightError(
  prisma: PrismaClient,
  caller: Owner,
  name: McpWriteToolName,
  args: Record<string, unknown>,
) {
  const schema = mcpWriteToolDescriptors().find((tool) => tool.name === name)?.inputSchema;
  const required = (schema?.required ?? []) as string[];
  for (const key of required) {
    const value = args[key];
    if (typeof value !== "string" || !value.trim()) return `${key} is required`;
  }
  if (name === "agent_send" && String(args.message).trim().length > AGENT_SEND_MAX_CHARS) {
    return "message is too long";
  }
  if (required.includes("botId") && !(await ownBot(prisma, scopeOf(caller), args.botId))) {
    return "Agent not found";
  }
  return null;
}

/**
 * One write from an outside client, under the member's space-wide approval rules (no bot
 * overrides) and permission level. Block refuses it. Only an explicit Allow rule (for the tool,
 * or for its action type) runs it now — and only below Ask for everything, where every write is
 * stored for the member to approve. With no rule, or with Ask, it is stored the same way. Unlike
 * a bot, an outside client gets no default Allow. A hard line (`hardLineFor`) is always stored
 * for the member, whatever rule matches, as is a write the level cannot be read for.
 */
export async function submitMcpWrite(
  prisma: PrismaClient,
  caller: Owner & { connectionId: string },
  name: McpWriteToolName,
  args: Record<string, unknown>,
  events?: NotificationEvents,
  agents?: McpAgentDeps,
): Promise<McpWriteResult> {
  const rules = (await listApprovalRules(prisma, scopeOf(caller))) as ActionApprovalRule[];
  // Read fresh like the rules, so a changed level applies to the next write. A failed read never
  // lets a saved Allow run the write below: it is stored for the member instead.
  let levelReadable = true;
  const level = await resolvePermissionLevel(() =>
    loadSpacePermissionLevel(prisma, scopeOf(caller))
      .then((row) => ({ spaceLevel: row?.permissionLevel }))
      .catch((error: unknown) => {
        levelReadable = false;
        throw error;
      }),
  );
  const resolved = resolveActionApprovalDetail({ toolName: name, rules, level });
  if (resolved.decision === "block") {
    return { outcome: "blocked", result: { error: BLOCKED_ACTION_MESSAGE } };
  }
  const invalid = await preflightError(prisma, caller, name, args);
  if (invalid) return { outcome: "error", result: { error: invalid } };
  const hardLine = hardLineFor({ toolName: name, args });
  if (
    !hardLine &&
    levelReadable &&
    level !== "ask_everything" &&
    resolved.source === "always_allow" &&
    resolved.decision === "allow"
  ) {
    const result = await callMcpWriteTool(
      name,
      { prisma, scope: scopeOf(caller), agents, connectionId: caller.connectionId },
      args,
    );
    return { outcome: failed(result) ? "error" : "ok", result };
  }
  const waiting = await prisma.externalAction.count({
    where: { connectionId: caller.connectionId, status: "pending" },
  });
  if (waiting >= MAX_PENDING_PER_CONNECTION) {
    return {
      outcome: "error",
      result: { error: "Too many actions are waiting for approval" },
    };
  }
  const action = await prisma.externalAction.create({
    data: { ...scopeOf(caller), connectionId: caller.connectionId, tool: name, args: json(args) },
  });
  await notifyWaiting(prisma, caller, action.id, name, events).catch(() => undefined);
  return { outcome: "pending", result: { status: "pending_approval", actionId: action.id } };
}

async function notifyWaiting(
  prisma: PrismaClient,
  caller: Owner & { connectionId: string },
  actionId: string,
  tool: string,
  events?: NotificationEvents,
) {
  const connection = await prisma.mcpConnection.findFirst({
    where: { id: caller.connectionId },
    select: { label: true },
  });
  const result = await createNotification(prisma, {
    ...scopeOf(caller),
    surface: "mcp",
    title: "Approval needed",
    body: `${connection?.label ?? "A connection"}: ${tool}`.slice(0, NOTIFICATION_BODY_MAX),
    link: "/app?settings=connections",
    importance: "attention",
    kind: "needs_input",
    dedupeKey: `external:${actionId}`,
    skipRateLimits: true,
  });
  if (result.status !== "created") return;
  const { id, importance } = result.notification;
  await events?.notify(scopeOf(caller), { id, surface: "mcp", importance });
}

/** The state of one action, for the connection that asked for it. Another connection's id is not found. */
export async function actionStatus(
  prisma: PrismaClient,
  caller: Owner & { connectionId: string },
  actionId: unknown,
) {
  if (typeof actionId !== "string" || !actionId) return { error: "actionId is required" };
  const row = await prisma.externalAction.findFirst({
    where: { id: actionId, connectionId: caller.connectionId, spaceId: caller.spaceId },
    select: { status: true, result: true, tool: true },
  });
  if (!row) return { error: "Action not found" };
  let result = row.result;
  // A sent message finishes later than the action: report the run's current state and reply.
  const runId = (result as { runId?: unknown } | null)?.runId;
  if (row.tool === "agent_send" && row.status === "done" && typeof runId === "string") {
    const state = await agentRunState(prisma, caller, runId);
    if (state) result = wrapUntrustedText(state, ["reply"]) as typeof result;
  }
  return {
    status: row.status,
    ...(result !== null && (row.status === "done" || row.status === "failed") ? { result } : {}),
  };
}

export type PendingExternalAction = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  connectionLabel: string;
  botName?: string;
  createdAt: string;
};

/** The member's actions waiting for an answer, oldest first. Run inside the member's tenant scope. */
export async function listPendingActions(
  prisma: PrismaClient,
  owner: Owner,
  now = new Date(),
): Promise<PendingExternalAction[]> {
  const rows = await prisma.externalAction.findMany({
    where: {
      ...scopeOf(owner),
      status: "pending",
      createdAt: { gt: new Date(now.getTime() - EXTERNAL_ACTION_TTL_MS) },
      connection: { revokedAt: null },
    },
    orderBy: { createdAt: "asc" },
    include: { connection: { select: { label: true } } },
  });
  const botIds = [
    ...new Set(
      rows.flatMap((row) => {
        const id = (row.args as { botId?: unknown } | null)?.botId;
        return typeof id === "string" ? [id] : [];
      }),
    ),
  ];
  const names = new Map(
    botIds.length
      ? (
          await prisma.bot.findMany({
            where: { id: { in: botIds }, ...scopeOf(owner) },
            select: { id: true, name: true },
          })
        ).map((bot) => [bot.id, bot.name])
      : [],
  );
  return rows.map((row) => {
    const botId = (row.args as { botId?: unknown } | null)?.botId;
    const botName = typeof botId === "string" ? names.get(botId) : undefined;
    return {
      id: row.id,
      tool: row.tool,
      args: (row.args ?? {}) as Record<string, unknown>,
      connectionLabel: row.connection.label,
      ...(botName ? { botName } : {}),
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/** The action is not waiting: answered already (maybe by a second click), expired, or not the member's. */
export class ExternalActionNotPending extends Error {}

/**
 * Approves or denies one waiting action. The conditional update from "pending" is what lets
 * exactly one caller, in any process, claim an action: later callers match no row and the handler
 * runs once. The action's key is `external:<id>`; handlers that take no key rely on that claim.
 */
export async function decideExternalAction(
  prisma: PrismaClient,
  owner: Owner,
  id: string,
  decision: "approve" | "deny",
  options: { alwaysAllow?: boolean; now?: Date; agents?: McpAgentDeps } = {},
) {
  const now = options.now ?? new Date();
  const claimed = await prisma.externalAction.updateMany({
    where: {
      id,
      ...scopeOf(owner),
      status: "pending",
      createdAt: { gt: new Date(now.getTime() - EXTERNAL_ACTION_TTL_MS) },
      connection: { revokedAt: null },
    },
    data: { status: decision === "approve" ? "approved" : "denied", decidedAt: now },
  });
  if (claimed.count !== 1) throw new ExternalActionNotPending();
  if (decision === "deny") return { status: "denied" as const };
  const action = await prisma.externalAction.findFirstOrThrow({ where: { id } });
  // "Always allow": a space-wide rule for this tool, as a bot's approval card saves. A hard line
  // asks every time, so no rule is saved for it.
  const args = (action.args ?? {}) as Record<string, unknown>;
  if (
    options.alwaysAllow &&
    toolRuleAllowsAllow(action.tool) &&
    !hardLineFor({ toolName: action.tool, args })
  ) {
    // The member already approved this action; a failed rule write must not strand it.
    try {
      await setApprovalRule(prisma, {
        ...scopeOf(owner),
        matchKind: "tool",
        matchValue: action.tool,
        effect: "always_allow",
      });
    } catch (error) {
      getLogger().warn("always-allow rule could not be saved", {
        actionId: action.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return execute(prisma, action, options.agents);
}

/** Closes unanswered actions after a day, and approved ones that never finished. Runs in the job reconciler. */
export function expireExternalActions(prisma: PrismaClient, now = new Date()) {
  return runAsSystem("expire external actions", async () => {
    await prisma.externalAction.updateMany({
      where: {
        status: "pending",
        createdAt: { lt: new Date(now.getTime() - EXTERNAL_ACTION_TTL_MS) },
      },
      data: { status: "expired", decidedAt: now },
    });
    await prisma.externalAction.updateMany({
      where: {
        status: "approved",
        decidedAt: { lt: new Date(now.getTime() - RUNNING_LIMIT_MS) },
      },
      data: { status: "failed", result: { error: "Interrupted" } },
    });
  });
}

/** Call log rows older than this are deleted. */
export const MCP_CALL_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Deletes call log rows past retention. Runs in the job reconciler. */
export function pruneMcpCallLog(prisma: PrismaClient, now = new Date()) {
  return runAsSystem("prune mcp call log", () =>
    prisma.mcpCallLog.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - MCP_CALL_LOG_RETENTION_MS) } },
    }),
  );
}
