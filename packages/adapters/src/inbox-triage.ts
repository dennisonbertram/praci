import { randomUUID } from "node:crypto";
import type { AgentRunModel, AgentRuntime, JobPublisher } from "@rakazo/adapter-kit";
import { inboxTriageJob, inboxTriageJobKey } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION, inboxAgentSpawnKey } from "@rakazo/contracts";
import type { TriageInputMessage, TriageItem } from "@rakazo/core";
import {
  buildTriagePrompt,
  MAX_TRIAGE_PER_RUN,
  parseTriageResponse,
  planTodoSync,
  selectTodoCandidates,
  TRIAGE_BATCH_SIZE,
  TRIAGE_INSTRUCTIONS,
  TRIAGE_VERSION,
} from "@rakazo/core";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { recordUsage } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { aiRecipient } from "./ai-consent.js";
import { formatCurrentTimeInstruction } from "./current-time.js";

const WINDOW_MS = 14 * 86_400_000;
const MODEL_TIMEOUT_MS = 30_000;

type Scope = { userId: string; spaceId: string };

export interface TriageReadinessDeps {
  prisma: Pick<PrismaClient, "bot" | "aiDataConsent">;
  /** The executor's resolver; without it no model can be resolved. */
  resolveModel?: (scope: Scope & { botId?: string }) => Promise<AgentRunModel>;
}

export interface InboxTriageDeps extends TriageReadinessDeps {
  prisma: PrismaClient;
  runtime: AgentRuntime;
  jobs: JobPublisher;
}

/**
 * The one check shared by the triage job and the API's `enabled` flag, so they always agree.
 * Resolves the model the Inbox agent would use (its override, else the user's default) and returns
 * null unless it is a real model whose exact recipient the user has allowed to receive their data.
 */
export async function triageReadiness(
  deps: TriageReadinessDeps,
  { userId, spaceId }: Scope,
): Promise<{ model: AgentRunModel; botId: string | undefined } | null> {
  if (!deps.resolveModel) return null;
  const bot = await deps.prisma.bot.findFirst({
    where: { spaceId, userId, spawnKey: inboxAgentSpawnKey(userId), archivedAt: null },
    select: { id: true },
  });
  let model: AgentRunModel;
  try {
    model = await deps.resolveModel({ userId, spaceId, botId: bot?.id });
  } catch {
    return null;
  }
  // Same recipient as `aiConsentStatus` lists; `baseUrl` is only set for OpenAI-compatible connections.
  const recipient = aiRecipient({
    provider: model.provider,
    modelId: model.id,
    baseUrl: model.baseUrl,
    use: "model",
  });
  if (!recipient) return null;
  const consent = await deps.prisma.aiDataConsent.findFirst({
    where: { userId, spaceId, recipientKey: recipient.key, version: AI_DISCLOSURE_VERSION },
    select: { userId: true },
  });
  return consent ? { model, botId: bot?.id } : null;
}

/**
 * Classifies a user's new inbox mail and syncs their to-dos. Only metadata and snippets reach the
 * model, which has no tools. Every query is scoped to the user and space.
 */
export async function runInboxTriage(deps: InboxTriageDeps, scope: Scope): Promise<void> {
  const { prisma } = deps;
  const { userId, spaceId } = scope;
  const started = Date.now();
  const ready = await triageReadiness(deps, scope);
  if (!ready) {
    getLogger().info("inbox triage skipped: no usable model or consent");
    return;
  }

  const windowStart = new Date(Date.now() - WINDOW_MS);
  await markAlreadyHandled(prisma, scope, windowStart);

  // One extra row shows whether the cap left a backlog.
  const eligible = await prisma.cachedMailMessage.findMany({
    where: {
      spaceId,
      userId,
      inInbox: true,
      fromSelf: false,
      receivedAt: { gte: windowStart },
      connection: { status: "connected" },
      OR: [{ triagedAt: null }, { triageVersion: { lt: TRIAGE_VERSION } }],
    },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: MAX_TRIAGE_PER_RUN + 1,
    include: { connection: { select: { metadata: true } } },
  });
  const hasBacklog = eligible.length > MAX_TRIAGE_PER_RUN;
  const selected = eligible.slice(0, MAX_TRIAGE_PER_RUN);

  let classified = 0;
  for (let i = 0; i < selected.length; i += TRIAGE_BATCH_SIZE) {
    const batch = selected.slice(i, i + TRIAGE_BATCH_SIZE);
    const items = await classify(deps, ready, scope, await toInput(prisma, scope, batch));
    const byId = new Map(items.map((item) => [item.id, item]));
    // An id the model skipped is stamped too, with null fields, so it is not paid for again.
    await prisma.$transaction(
      batch.map((row) => {
        const item = byId.get(row.id);
        return prisma.cachedMailMessage.updateMany({
          where: { id: row.id, userId, spaceId },
          data: {
            triagedAt: new Date(),
            triageVersion: TRIAGE_VERSION,
            needsReply: item?.needsReply ?? null,
            priority: item?.priority ?? null,
            category: item?.category ?? null,
            reason: item?.reason ?? null,
            todoText: item?.todo ?? null,
            dueOn: item?.due ? new Date(`${item.due}T00:00:00Z`) : null,
          },
        });
      }),
    );
    classified += batch.length;
  }

  // Runs even when nothing was classified: a sent reply can end a to-do with no new triage.
  await syncTodos(prisma, scope, windowStart);

  // A run that classified nothing never re-enqueues, so a failing model cannot loop.
  if (hasBacklog && classified > 0) await deps.jobs.enqueue(inboxTriageJob(userId, spaceId));
  getLogger().info("inbox triage finished", {
    classified,
    backlog: hasBacklog,
    durationMs: Date.now() - started,
  });
}

/** True for a message when the cache holds a later sent message in the same thread and account. */
async function markAlreadyHandled(prisma: PrismaClient, scope: Scope, windowStart: Date) {
  const { userId, spaceId } = scope;
  await prisma.$executeRaw`
    UPDATE mail_messages m SET "alreadyHandled" = h.handled
    FROM (
      SELECT m2.id, EXISTS (
        SELECT 1 FROM mail_messages s
        WHERE s."connectionId" = m2."connectionId" AND s."threadId" = m2."threadId"
          AND s."fromSelf" AND s."receivedAt" > m2."receivedAt"
      ) AS handled
      FROM mail_messages m2
      JOIN connections c ON c.id = m2."connectionId"
      WHERE m2."spaceId" = ${spaceId} AND m2."userId" = ${userId}
        AND c."spaceId" = ${spaceId} AND c."userId" = ${userId} AND c.status = 'connected'
        AND m2."receivedAt" >= ${windowStart}
    ) h
    WHERE m.id = h.id AND m."alreadyHandled" <> h.handled`;
}

async function toInput(
  prisma: PrismaClient,
  { userId, spaceId }: Scope,
  batch: Array<{
    id: string;
    connectionId: string;
    threadId: string;
    fromName: string | null;
    fromAddress: string;
    toAddresses: string[];
    ccAddresses: string[];
    subject: string;
    snippet: string;
    receivedAt: Date;
    connection: { metadata: Prisma.JsonValue };
  }>,
): Promise<TriageInputMessage[]> {
  const threads = await prisma.cachedMailMessage.groupBy({
    by: ["connectionId", "threadId"],
    where: {
      spaceId,
      userId,
      OR: batch.map((m) => ({ connectionId: m.connectionId, threadId: m.threadId })),
    },
    _count: { _all: true },
  });
  const length = new Map(threads.map((t) => [`${t.connectionId}\0${t.threadId}`, t._count._all]));
  return batch.map((m) => {
    const metadata = m.connection.metadata as { mailAddress?: unknown } | null;
    const mine =
      typeof metadata?.mailAddress === "string" ? metadata.mailAddress.toLowerCase() : "";
    return {
      id: m.id,
      from: m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress,
      to: m.toAddresses,
      cc: m.ccAddresses,
      subject: m.subject,
      snippet: m.snippet,
      receivedAt: m.receivedAt.toISOString(),
      addressedToMe: mine !== "" && m.toAddresses.some((a) => a.toLowerCase() === mine),
      threadLength: length.get(`${m.connectionId}\0${m.threadId}`) ?? 1,
    };
  });
}

async function classify(
  deps: InboxTriageDeps,
  ready: { model: AgentRunModel; botId: string | undefined },
  { userId, spaceId }: Scope,
  messages: TriageInputMessage[],
): Promise<TriageItem[]> {
  const runId = `triage:${randomUUID()}`;
  const attribution = {
    spaceId,
    userId,
    ...(ready.botId ? { botId: ready.botId } : {}),
    operationId: runId,
    operationKind: "triage" as const,
  };
  let text = "";
  for await (const event of deps.runtime.run(
    {
      botId: ready.botId ?? "inbox-triage",
      threadId: runId,
      runId,
      usageOperationKind: "triage",
      onUsage: async (usage) => {
        await recordUsage(deps.prisma, usage, attribution);
      },
      prompt: buildTriagePrompt(messages),
      instructions: [formatCurrentTimeInstruction(), TRIAGE_INSTRUCTIONS].join("\n\n"),
      history: [],
      tools: [],
      model: ready.model,
    },
    {
      operationId: runId,
      traceId: runId,
      spaceId,
      userId,
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    },
  )) {
    if (event.type === "usage" && !event.accounted) {
      await recordUsage(deps.prisma, event, attribution);
    }
    if (event.type === "done" && event.text) text = event.text;
  }
  return parseTriageResponse(
    text,
    messages.map((m) => m.id),
  );
}

/** Two overlapping runs for one user apply their to-do changes one after the other. */
async function syncTodos(prisma: PrismaClient, { userId, spaceId }: Scope, windowStart: Date) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inboxTriageJobKey(userId, spaceId)}))`;
    const [messages, existing] = await Promise.all([
      tx.cachedMailMessage.findMany({
        where: {
          spaceId,
          userId,
          receivedAt: { gte: windowStart },
          connection: { status: "connected" },
          todoText: { not: null },
          alreadyHandled: false,
          category: { in: ["reply", "action"] },
        },
      }),
      tx.inboxTodo.findMany({
        where: { spaceId, userId },
        select: { id: true, messageId: true, doneAt: true, touchedAt: true },
      }),
    ]);
    const { deleteIds, inserts } = planTodoSync(existing, selectTodoCandidates(messages));
    if (deleteIds.length > 0) {
      await tx.inboxTodo.deleteMany({ where: { id: { in: deleteIds }, spaceId, userId } });
    }
    if (inserts.length > 0) {
      await tx.inboxTodo.createMany({
        data: inserts.map((todo) => ({ ...todo, spaceId, userId })),
        skipDuplicates: true,
      });
    }
  });
}
