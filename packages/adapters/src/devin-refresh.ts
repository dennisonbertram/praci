import { createHash, randomUUID } from "node:crypto";
import { devinSessionUrl, isDevinSessionUrl } from "@rakazo/contracts";
import type { NotificationEvents, Prisma, PrismaClient } from "@rakazo/db";
import { createNotification, NOTIFICATION_BODY_MAX } from "@rakazo/db";
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
    | "devinConnectionState"
    | "devinSession"
    | "spaceMember"
    | "notification"
    | "notificationDelivery"
    | "notificationPreference"
    | "$transaction"
  >;
  callTool: DevinCallTool;
  /** Sends the live signal for a new alert; without it the alert is stored and found on the next poll. */
  notificationEvents?: NotificationEvents;
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

type DevinAlert = { sessionId: string; title: string; question: string | null; identity: string };

/**
 * Tells the connector that a session waits on them: one "needs_input" notification per Devin
 * message, linking to the session in Devin. `help: false` in their preferences creates nothing.
 * A repeat of the same message is a no-op, so a crash before it was recorded alerts once.
 */
export async function notifyDevinNeedsInput(
  prisma: DevinRefreshDeps["prisma"],
  events: NotificationEvents | undefined,
  target: { serverId: string; spaceId: string; userId: string; botId: string | null },
  alert: DevinAlert,
): Promise<"created" | "deduped" | "off"> {
  const preference = await prisma.notificationPreference.findUnique({
    where: { spaceId_userId: { spaceId: target.spaceId, userId: target.userId } },
    select: { help: true },
  });
  if (preference?.help === false) return "off";
  const title = alert.title || "A Devin session";
  const question = alert.question?.replace(/\s+/g, " ").trim();
  const result = await createNotification(prisma, {
    spaceId: target.spaceId,
    userId: target.userId,
    botId: target.botId,
    surface: "devin",
    title: "Devin needs input",
    body: (question ? `${title}: ${question}` : `${title} is waiting for your answer.`).slice(
      0,
      NOTIFICATION_BODY_MAX,
    ),
    externalLink: { url: devinSessionUrl(alert.sessionId), allow: isDevinSessionUrl },
    importance: "attention",
    kind: "needs_input",
    dedupeKey: createHash("sha256")
      .update(`devin\n${target.serverId}\n${alert.sessionId}\n${alert.identity}`)
      .digest("hex"),
    skipRateLimits: true,
  });
  if (result.status !== "created") return "deduped";
  const { id, importance } = result.notification;
  await events?.notify(
    { spaceId: target.spaceId, userId: target.userId },
    { id, surface: "devin", importance },
  );
  return "created";
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
    include: {
      server: { select: { spaceId: true, userId: true, revision: true, agentBotId: true } },
    },
  });
  if (!state || state.rejectedAt || (state.backoffUntil && state.backoffUntil > now)) {
    return "skipped";
  }
  const { spaceId, userId, revision, agentBotId } = state.server;
  const member = await prisma.spaceMember.findFirst({
    where: { spaceId, userId },
    select: { id: true },
  });
  if (!member) {
    await prisma.devinConnectionState.updateMany({
      where: { serverId },
      // Dropping the lease also stops an in-flight refresh from committing over this.
      data: { lastError: "connector_gone", leaseToken: null, leaseUntil: null },
    });
    return "connector_gone";
  }

  const leaseToken = randomUUID();
  const claimed = await prisma.devinConnectionState.updateMany({
    where: {
      serverId,
      version: state.version,
      // Rechecked here: another holder may have recorded a rejection or backoff since the read.
      rejectedAt: null,
      AND: [
        { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
        { OR: [{ backoffUntil: null }, { backoffUntil: { lte: now } }] },
      ],
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
        // FOR SHARE holds the server row until commit, so a concurrent edit waits and cannot
        // change the revision between this check and the writes.
        const current = await tx.$queryRaw<unknown[]>`
          SELECT 1 FROM mcp_servers WHERE id = ${serverId} AND revision = ${revision} FOR SHARE`;
        if (current.length === 0) {
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

  const alerts: DevinAlert[] = [];
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
        // A later page failing keeps what was read, unless the key or the rate limit is the
        // cause: those fail the run like a first-page failure.
        if (page === 0 || devinFailureOf(error, { phase }) !== "unreachable") throw error;
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
      // Without a message id the update time stands in for the question's identity.
      const surrogate = `t:${updatedAt.toISOString()}`;
      let readFailed = false;
      const changed =
        before?.kind !== "needs_you" ||
        before.devinUpdatedAt < updatedAt ||
        before.question === null;
      if (kind === "needs_you" && changed) {
        const read = await readQuestion(deps, serverId, session.id);
        question = read?.question ?? null;
        // A failed read forgets the old id: it belongs to an earlier question.
        readFailed = !read;
        lastMessageId = read ? read.messageId : null;
      }
      if (kind === "needs_you") {
        const identity = readFailed ? surrogate : (lastMessageId ?? surrogate);
        if (first) {
          // Only the connection's first refresh is a silent baseline.
          notifiedMessageId = identity;
        } else if (lastMessageId && notifiedMessageId === surrogate) {
          // A late successful read of the question already alerted for: record it, alert nothing.
          notifiedMessageId = lastMessageId;
        } else if (identity !== notifiedMessageId) {
          alerts.push({ sessionId: session.id, title: session.title ?? "", question, identity });
        }
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
  // After the commit, with no transaction open: a failure here leaves the row unrecorded, so the
  // next run tries again and the notification's dedupe key keeps it to one.
  // The connector may have left, or the connection been removed or replaced, since the lease was
  // taken; alert nobody then. The check and the alerts are not one transaction, so a change in
  // the milliseconds between them can still send one alert to the previous connector.
  const stillActive =
    alerts.length > 0 &&
    !result.failed &&
    (await prisma.spaceMember.findFirst({ where: { spaceId, userId }, select: { id: true } })) &&
    (await prisma.devinConnectionState.findUnique({
      where: { serverId },
      select: { serverId: true },
    }));
  for (const alert of stillActive ? alerts : []) {
    try {
      await notifyDevinNeedsInput(
        prisma,
        deps.notificationEvents,
        { serverId, spaceId, userId, botId: agentBotId },
        alert,
      );
      await prisma.devinSession.updateMany({
        where: { serverId, sessionId: alert.sessionId },
        data: { notifiedMessageId: alert.identity },
      });
    } catch (error) {
      getLogger().error("devin.refresh alert error", error);
    }
  }
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
