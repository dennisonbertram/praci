import { randomUUID } from "node:crypto";
import type {
  AdapterContext,
  AgentRunModel,
  AgentRuntime,
  InboxClassification,
  InboxClassifierProvider,
  JobPublisher,
} from "@rakazo/adapter-kit";
import { inboxTriageJob, inboxTriageJobKey } from "@rakazo/adapter-kit";
import type { TriageBlocked } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION, inboxAgentSpawnKey } from "@rakazo/contracts";
import type { TriageInputMessage, TriageItem } from "@rakazo/core";
import {
  isNoReplyCategory,
  MAX_TRIAGE_PER_RUN,
  needsLlmDetail,
  planTodoSync,
  resolvePile,
  selectTodoCandidates,
  senderMarkMap,
  TODO_CATEGORIES,
  TRIAGE_BATCH_SIZE,
  TRIAGE_VERSION,
} from "@rakazo/core";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { recordUsage } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { aiRecipient } from "./ai-consent.js";
import { LlmInboxClassifier } from "./llm-inbox-classifier.js";

const WINDOW_MS = 14 * 86_400_000;
// A first sort of the demo mailbox took about 39 seconds, and 30 seconds per batch aborted runs.
const MODEL_TIMEOUT_MS = 90_000;
/** A batch is up to 20 requests to the optional classifier, a few at a time. */
const CLASSIFIER_TIMEOUT_MS = 60_000;

type Scope = { userId: string; spaceId: string };

export interface TriageReadinessDeps {
  prisma: Pick<PrismaClient, "bot" | "aiDataConsent">;
  /** The executor's resolver; without it no model can be resolved. */
  resolveModel?: (scope: Scope & { botId?: string }) => Promise<AgentRunModel>;
  /** Optional first-pass classifier. It is used only after the user consents to its recipient. */
  classifier?: InboxClassifierProvider | null;
}

export interface InboxTriageDeps extends TriageReadinessDeps {
  prisma: PrismaClient;
  runtime: AgentRuntime;
  jobs: JobPublisher;
}

type Ready = {
  model: AgentRunModel;
  botId: string | undefined;
  /** The optional classifier when its recipient is allowed; otherwise null and the LLM does it all. */
  classifier: InboxClassifierProvider | null;
};

/**
 * The one check shared by the triage job and the API's `enabled` flag, so they always agree.
 * Resolves the model the Inbox agent would use (its override, else the user's default). It is
 * `ready` only for a real model whose exact recipient the user has allowed to receive their data;
 * otherwise `blocked` says whether a model is missing or that recipient needs consent. A configured
 * classifier is another recipient: it is returned only with its own consent, and never blocks.
 */
export async function triageStatus(
  deps: TriageReadinessDeps,
  { userId, spaceId }: Scope,
): Promise<{ ready: Ready; blocked: null } | { ready: null; blocked: TriageBlocked }> {
  const noModel = { ready: null, blocked: { reason: "no_model" } } as const;
  if (!deps.resolveModel) return noModel;
  const bot = await deps.prisma.bot.findFirst({
    where: { spaceId, userId, spawnKey: inboxAgentSpawnKey(userId), archivedAt: null },
    select: { id: true },
  });
  let model: AgentRunModel;
  try {
    model = await deps.resolveModel({ userId, spaceId, botId: bot?.id });
  } catch {
    return noModel;
  }
  // Same recipient as `aiConsentStatus` lists; `baseUrl` is only set for OpenAI-compatible connections.
  const recipient = aiRecipient({
    provider: model.provider,
    modelId: model.id,
    baseUrl: model.baseUrl,
    use: "model",
  });
  if (!recipient) return noModel;
  const allowed = (recipientKey: string) =>
    deps.prisma.aiDataConsent.findFirst({
      where: { userId, spaceId, recipientKey, version: AI_DISCLOSURE_VERSION },
      select: { userId: true },
    });
  if (!(await allowed(recipient.key))) {
    return {
      ready: null,
      blocked: {
        reason: "needs_consent",
        recipient: { key: recipient.key, name: recipient.name },
      },
    };
  }
  const classifierRecipient = deps.classifier
    ? aiRecipient({ provider: deps.classifier.describe().id, use: "model" })
    : null;
  const classifier =
    deps.classifier && classifierRecipient && (await allowed(classifierRecipient.key))
      ? deps.classifier
      : null;
  return { ready: { model, botId: bot?.id, classifier }, blocked: null };
}

/** `triageStatus` when only the yes or no matters. */
export async function triageReadiness(
  deps: TriageReadinessDeps,
  scope: Scope,
): Promise<Ready | null> {
  return (await triageStatus(deps, scope)).ready;
}

/** A run that finds the user busy looks again after this, in case mail arrived since the holder read its list. */
const BUSY_RETRY_MS = 15_000;
/** Longer than the slowest run: five model batches, each bounded by the timeouts above. */
const RUN_LOCK_TIMEOUT_MS = 15 * 60_000;

/**
 * Classifies a user's new inbox mail and syncs their to-dos. Only metadata and snippets reach the
 * model or the optional classifier, and the model has no tools. Every query is scoped to the user
 * and space.
 *
 * At most one run per user and space executes at a time, across all worker processes. Adding a job
 * while the keyed job is running does not merge with it (graphile detaches the key from a running
 * job and queues another), so refreshes, syncs and the backlog follow-up used to start parallel
 * runs that sent the same messages to the model. The run holds a transaction-scoped advisory lock
 * on its own connection; model calls and writes use other pooled connections. Postgres drops the
 * lock when the transaction ends or its connection dies, so a crashed run cannot block the user.
 */
export async function runInboxTriage(deps: InboxTriageDeps, scope: Scope): Promise<void> {
  const { userId, spaceId } = scope;
  const started = Date.now();
  const ready = await triageReadiness(deps, scope);
  if (!ready) {
    getLogger().info("inbox triage skipped: no usable model or consent");
    return;
  }

  const outcome = await deps.prisma.$transaction(
    async (lock) => {
      const [row] = await lock.$queryRaw<
        { ok: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtext('inbox.triage.run'), hashtext(${`${spaceId}:${userId}`})) AS ok`;
      return row?.ok ? await triagePass(deps, ready, scope) : null;
    },
    { timeout: RUN_LOCK_TIMEOUT_MS, maxWait: 10_000 },
  );

  if (!outcome) {
    getLogger().info("inbox triage deferred: another run holds this user");
    await deps.jobs.enqueue(inboxTriageJob(userId, spaceId, new Date(Date.now() + BUSY_RETRY_MS)));
    return;
  }
  // Queued only after the lock is released, so the follow-up does not find the user busy.
  // A run that classified nothing never re-enqueues, so a failing model cannot loop.
  if (outcome.hasBacklog && outcome.classified > 0) {
    await deps.jobs.enqueue(inboxTriageJob(userId, spaceId));
  }
  getLogger().info("inbox triage finished", {
    classified: outcome.classified,
    backlog: outcome.hasBacklog,
    durationMs: Date.now() - started,
  });
}

async function triagePass(
  deps: InboxTriageDeps,
  ready: Ready,
  scope: Scope,
): Promise<{ classified: number; hasBacklog: boolean }> {
  const { prisma } = deps;
  const { userId, spaceId } = scope;

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
    const items = await triageBatch(deps, ready, scope, await toInput(prisma, scope, batch));
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
            // The free rules win when they decided, unless the model calls it spam; its category fills the rest.
            pile: item
              ? resolvePile(row.rulePile, item.category, row.notSpamAt !== null)
              : row.rulePile,
            reason: item?.reason || null,
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

  return { classified, hasBacklog };
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

/**
 * Classifier first, when the user allowed one. A message it labeled confidently keeps that label;
 * the LLM then only writes the one-line summary (reason), to-do and due, and skips suspicious mail.
 * A message the classifier skipped or failed on, or a classifier that threw, goes to the LLM whole.
 */
async function triageBatch(
  deps: InboxTriageDeps,
  ready: Ready,
  { userId, spaceId }: Scope,
  messages: TriageInputMessage[],
): Promise<TriageItem[]> {
  const context = (timeoutMs: number): AdapterContext => {
    const id = `triage:${randomUUID()}`;
    return {
      operationId: id,
      traceId: id,
      spaceId,
      userId,
      signal: AbortSignal.timeout(timeoutMs),
    };
  };
  const labeled = new Map<string, InboxClassification>();
  if (ready.classifier) {
    const ids = new Set(messages.map((m) => m.id));
    try {
      const call = context(CLASSIFIER_TIMEOUT_MS);
      const result = await ready.classifier.classify(messages, call);
      for (const item of result.items) {
        if (ids.has(item.id) && !labeled.has(item.id)) labeled.set(item.id, item);
      }
      if (result.usage) {
        await recordUsage(
          deps.prisma,
          {
            type: "usage",
            provider: ready.classifier.describe().id,
            model: result.model,
            ...result.usage,
          },
          {
            spaceId,
            userId,
            ...(ready.botId ? { botId: ready.botId } : {}),
            operationId: call.operationId,
            operationKind: "triage",
          },
        );
      }
    } catch (error) {
      getLogger().warn("inbox classifier failed, using the model", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const detail = messages.filter((m) => {
    const label = labeled.get(m.id);
    return !label || needsLlmDetail(label);
  });
  const llm = new LlmInboxClassifier({
    runtime: deps.runtime,
    model: ready.model,
    ...(ready.botId ? { botId: ready.botId } : {}),
    onUsage: (usage, attribution) => recordUsage(deps.prisma, usage, attribution),
  });
  const written = new Map(
    (detail.length > 0 ? (await llm.classify(detail, context(MODEL_TIMEOUT_MS))).items : []).map(
      (item) => [item.id, item],
    ),
  );
  return messages.flatMap((m): TriageItem[] => {
    const text = written.get(m.id);
    // The classifier's label wins; the model's answer only adds the written parts.
    const label = labeled.get(m.id);
    const base = label ?? text;
    if (!base) return [];
    // The model now reads every labeled message for its summary; its to-do only counts where the label calls for one.
    const todoable = !label || label.needsReply || TODO_CATEGORIES.includes(label.category);
    return [
      {
        id: m.id,
        needsReply: !isNoReplyCategory(base.category) && base.needsReply,
        priority: base.priority,
        category: base.category,
        reason: text?.reason ?? "",
        todo: todoable ? (text?.todo ?? null) : null,
        due: todoable ? (text?.due ?? null) : null,
      },
    ];
  });
}

/** Two overlapping runs for one user apply their to-do changes one after the other. */
async function syncTodos(prisma: PrismaClient, { userId, spaceId }: Scope, windowStart: Date) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${inboxTriageJobKey(userId, spaceId)}))`;
    const [messages, existing, feedback] = await Promise.all([
      tx.cachedMailMessage.findMany({
        where: {
          spaceId,
          userId,
          receivedAt: { gte: windowStart },
          connection: { status: "connected" },
          isSpam: false,
          todoText: { not: null },
          alreadyHandled: false,
          OR: [{ needsReply: true }, { category: { in: [...TODO_CATEGORIES] } }],
        },
      }),
      tx.inboxTodo.findMany({
        where: { spaceId, userId },
        select: { id: true, messageId: true, doneAt: true, touchedAt: true },
      }),
      tx.inboxSenderFeedback.findMany({
        where: { spaceId, userId },
        select: { senderAddress: true, mark: true },
      }),
    ]);
    // A sender marked noise gets no to-do, and an important sender's mail ranks first.
    const marks = senderMarkMap(feedback);
    const candidates = selectTodoCandidates(
      messages.map((m) => ({ ...m, senderMark: marks.get(m.fromAddress.toLowerCase()) ?? null })),
    );
    const { deleteIds, inserts } = planTodoSync(existing, candidates);
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
