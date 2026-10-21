import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { DevinCallTool } from "./devin-call-tool.js";
import { devinFailureOf } from "./devin-call-tool.js";
import {
  devinKindOf,
  latestDevinMessage,
  parseDevinMessages,
  parseDevinSessionSearch,
} from "./devin-sessions.js";

/** Pages of 100 sessions one refresh follows; a longer listing is stored as incomplete. */
export const DEVIN_MAX_PAGES = 10;
const PAGE_SIZE = 100;
const LEASE_MS = 90_000;
const CALL_TIMEOUT_MS = 15_000;
const QUESTION_MAX_CHARS = 500;
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60_000;
const MIN = 60_000;

export type DevinRefreshDeps = {
  prisma: Pick<
    PrismaClient,
    "devinConnectionState" | "devinSession" | "spaceMember" | "mcpServer" | "$transaction"
  >;
  callTool: DevinCallTool;
  now?: () => Date;
};

export type DevinRefreshOutcome =
  /** Results committed. */
  | "refreshed"
  /** Another process holds the lease; nothing was read. */
  | "busy"
  /** No connection, rejected key, or inside a backoff window; nothing was read. */
  | "skipped"
  | "connector_gone"
  /** The call failed; the failure was recorded. */
  | "failed"
  /** The lease or the server revision changed during the run; nothing was written. */
  | "discarded";

/** Devin's latest question for a waiting session, or null when Devin refuses to show it. */
async function readQuestion(
  deps: DevinRefreshDeps,
  serverId: string,
  sessionId: string,
): Promise<{ question: string; messageId: string } | null> {
  try {
    const text = await deps.callTool(
      serverId,
      "devin_session_interact",
      { action: "get_messages", session_id: sessionId },
      AbortSignal.timeout(CALL_TIMEOUT_MS),
    );
    const message = latestDevinMessage(parseDevinMessages(text).messages);
    return message
      ? { question: (message.body ?? "").slice(0, QUESTION_MAX_CHARS), messageId: message.eventId }
      : null;
  } catch (error) {
    // One session the key may not read is not a connection problem.
    if (devinFailureOf(error, { phase: "session" }) === "session_forbidden") return null;
    throw error;
  }
}

/**
 * Reads Devin once for the page and the worker: the only code that does. A fenced lease keeps
 * several processes from reading or writing together; no transaction is open while Devin is
 * called; results are committed only if the lease and the server's `revision` are still ours.
 */
export async function refreshDevinConnection(
  deps: DevinRefreshDeps,
  serverId: string,
): Promise<DevinRefreshOutcome> {
  const { prisma, callTool } = deps;
  const now = (deps.now ?? (() => new Date()))();

  const state = await prisma.devinConnectionState.findUnique({
    where: { serverId },
    include: { server: { select: { spaceId: true, userId: true, revision: true } } },
  });
  if (!state || state.rejectedAt || (state.backoffUntil && state.backoffUntil > now)) {
    return "skipped";
  }
  const { spaceId, userId, revision } = state.server;
  const member = await prisma.spaceMember.findFirst({
    where: { spaceId, userId },
    select: { id: true },
  });
  if (!member) {
    await prisma.devinConnectionState.updateMany({
      where: { serverId },
      data: { lastError: "connector_gone" },
    });
    return "connector_gone";
  }

  const leaseToken = randomUUID();
  const claimed = await prisma.devinConnectionState.updateMany({
    where: {
      serverId,
      version: state.version,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    data: {
      leaseToken,
      leaseUntil: new Date(now.getTime() + LEASE_MS),
      version: { increment: 1 },
    },
  });
  if (claimed.count === 0) return "busy";
  const fence = { serverId, leaseToken, version: state.version + 1 };

  /** Writes the state (and, on success, the rows) only while the fence and revision still hold. */
  const commit = (
    data: Record<string, unknown>,
    write?: (tx: Pick<PrismaClient, "devinSession">) => Promise<void>,
  ) =>
    prisma.$transaction(
      async (tx) => {
        const release = { leaseToken: null, leaseUntil: null };
        if ((await tx.mcpServer.count({ where: { id: serverId, revision } })) === 0) {
          await tx.devinConnectionState.updateMany({ where: fence, data: release });
          return false;
        }
        const written = await tx.devinConnectionState.updateMany({
          where: fence,
          data: { ...data, ...release },
        });
        if (written.count === 0) return false;
        await write?.(tx);
        return true;
      },
      { timeout: 30_000 },
    );

  let phase: "listing" | "session" = "listing";
  let result: {
    data: Record<string, unknown>;
    write?: (tx: Pick<PrismaClient, "devinSession">) => Promise<void>;
    failed?: true;
  };
  try {
    const listed: ReturnType<typeof parseDevinSessionSearch>["sessions"] = [];
    let skipped = 0;
    let complete = false;
    let cursor: string | null = null;
    for (let page = 0; page < DEVIN_MAX_PAGES; page += 1) {
      try {
        const text = await callTool(
          serverId,
          "devin_session_search",
          { first: PAGE_SIZE, ...(cursor ? { after: cursor } : {}) },
          AbortSignal.timeout(CALL_TIMEOUT_MS),
        );
        const parsed = parseDevinSessionSearch(text);
        listed.push(...parsed.sessions);
        skipped += parsed.skipped;
        cursor = parsed.nextCursor;
      } catch (error) {
        // A later page failing keeps what was read; only the first page failing fails the run.
        if (page === 0) throw error;
        break;
      }
      if (!cursor) {
        complete = true;
        break;
      }
    }

    phase = "session";
    const first = state.lastSucceededAt === null;
    const previous = new Map(
      (await prisma.devinSession.findMany({ where: { serverId } })).map((row) => [
        row.sessionId,
        row,
      ]),
    );
    const rows: Array<Omit<Prisma.DevinSessionCreateManyInput, "serverId" | "spaceId">> = [];
    for (const session of listed) {
      const kind = devinKindOf(session.status, session.statusDetail);
      const updatedAt = new Date(
        (session.updatedAt ?? session.createdAt ?? now.getTime() / 1000) * 1000,
      );
      const before = previous.get(session.id);
      let question = kind === "needs_you" ? (before?.question ?? null) : null;
      let lastMessageId = before?.lastMessageId ?? null;
      let notifiedMessageId = before?.notifiedMessageId ?? null;
      const changed =
        !before ||
        before.kind !== "needs_you" ||
        before.devinUpdatedAt < updatedAt ||
        before.question === null;
      if (kind === "needs_you" && changed) {
        const read = await readQuestion(deps, serverId, session.id);
        question = read?.question ?? null;
        lastMessageId = read?.messageId ?? lastMessageId;
        // Only the connection's first refresh is a silent baseline; S5 alerts for the rest.
        if (first) notifiedMessageId = lastMessageId;
      }
      rows.push({
        sessionId: session.id,
        title: session.title ?? "",
        status: session.status ?? "",
        statusDetail: session.statusDetail,
        kind,
        question,
        prs: session.prs,
        origin: session.origin ?? "",
        devinUpdatedAt: updatedAt,
        lastMessageId,
        notifiedMessageId,
        lastSeenAt: now,
      });
    }

    result = {
      data: {
        lastSucceededAt: now,
        complete,
        skipped,
        lastError: null,
        backoffUntil: null,
        backoffStep: 0,
      },
      write: async (tx) => {
        for (const row of rows) {
          await tx.devinSession.upsert({
            where: { serverId_sessionId: { serverId, sessionId: row.sessionId } },
            create: { ...row, serverId, spaceId },
            update: row,
          });
        }
        // Rows are never deleted because a listing omitted them: only after 7 days unseen, and
        // only following a listing that read everything.
        if (complete && skipped === 0) {
          await tx.devinSession.deleteMany({
            where: { serverId, lastSeenAt: { lt: new Date(now.getTime() - PRUNE_AFTER_MS) } },
          });
        }
      },
    };
  } catch (error) {
    const failure = devinFailureOf(error, { phase });
    const step = state.backoffStep + 1;
    const data =
      failure === "rejected"
        ? { rejectedAt: now, lastError: "rejected" }
        : failure === "rate_limited"
          ? {
              lastError: "rate_limited",
              backoffStep: step,
              backoffUntil: new Date(now.getTime() + Math.min(10 * 2 ** (step - 1), 60) * MIN),
            }
          : { lastError: "unreachable", backoffUntil: new Date(now.getTime() + 5 * MIN) };
    result = { data, failed: true };
  }
  if (!(await commit(result.data, result.write))) return "discarded";
  return result.failed ? "failed" : "refreshed";
}

/** The `devin.refresh` job: cron passes no payload and refreshes every connection, a payload names one. */
export async function runDevinRefreshJob(
  deps: DevinRefreshDeps,
  payload: { serverId?: string },
): Promise<void> {
  const serverIds = payload.serverId
    ? [payload.serverId]
    : (
        await deps.prisma.devinConnectionState.findMany({
          where: { rejectedAt: null },
          select: { serverId: true },
        })
      ).map((row) => row.serverId);
  for (const serverId of serverIds) {
    await refreshDevinConnection(deps, serverId).catch((error) =>
      getLogger().error("devin.refresh error", error),
    );
  }
}
