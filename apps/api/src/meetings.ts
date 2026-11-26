import { ORPCError } from "@orpc/server";
import { dataRoomBlobDeleteJob, MeetingSourceError, meetingsDigestJob } from "@rakazo/adapter-kit";
import type { MeetingSourceRegistry } from "@rakazo/adapters";
import {
  aiRecipient,
  attendeesOf,
  identityEmails,
  isMine,
  MeetingDigestSchema,
  parseModelSecret,
  persistPreparedSecret,
  queueMeetingDigests,
  requestMeetingSync,
  selectConfiguredModel,
  triageReadiness,
} from "@rakazo/adapters";
import type {
  Actor,
  MeetingsStatus,
  StoredMeetingDetail,
  StoredMeetingsPage,
} from "@rakazo/contracts";
import {
  AI_DISCLOSURE_VERSION,
  GRANOLA_API_CONNECTOR_ID,
  STORED_MEETINGS_PAGE_SIZE,
} from "@rakazo/contracts";
import {
  deleteMeeting,
  findBotModelCredential,
  findDefaultModelCredential,
  findMergeablePrevious,
  getMeetingSyncState,
  IsolationError,
  ignorePinnedConnectionLost,
  likeLiteral,
  mergeMeetingWithPrevious,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { DIGEST_WINDOW_MS } from "./inbox.js";
import type { ensureConnectedAppAgent } from "./integration-agent.js";
import { provisionConnectionAgent } from "./integration-agent.js";
import type { RouterDeps } from "./router.js";

export const GRANOLA_REJECTED = "Granola rejected this key";
export const GRANOLA_UNREACHABLE = "Could not reach Granola";
/** A sync older than this, or one that failed, shows its age on the card. */
const LATE_MS = 15 * 60_000;

export interface MeetingsDeps {
  router: RouterDeps;
  registry: MeetingSourceRegistry;
  agent: Parameters<typeof ensureConnectedAppAgent>[0];
}

export const owner = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });

/** The user's Granola key connection, whatever its status except revoked. */
const findConnection = (deps: MeetingsDeps, actor: Actor) =>
  deps.router.prisma.connection.findFirst({
    where: { ...owner(actor), connectorId: GRANOLA_API_CONNECTOR_ID, status: { not: "revoked" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

/** One list call decides whether Granola accepts the key. Nothing is stored here. */
async function checkKey(deps: MeetingsDeps, actor: Actor, apiKey: string, signal?: AbortSignal) {
  const entry = deps.registry.granola;
  if (!entry) throw new ORPCError("SERVICE_UNAVAILABLE", { message: GRANOLA_UNREACHABLE });
  try {
    await entry.create({ ...owner(actor), apiKey }, signal ?? AbortSignal.timeout(20_000)).list({});
  } catch (error) {
    if (error instanceof MeetingSourceError && error.kind === "auth")
      throw new ORPCError("BAD_REQUEST", { message: GRANOLA_REJECTED });
    // Network failure, 5xx, 429 or an unexpected body: the key was not shown to be bad.
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: GRANOLA_UNREACHABLE });
  }
}

/**
 * The recipient of the Granola agent's primary model (its own model, else the space default), the
 * one meeting text is sent to. Backup and helper models are not used for meetings.
 */
async function primaryRecipient(deps: MeetingsDeps, actor: Actor, botId?: string | null) {
  const { prisma, env } = deps.router;
  if (env.agentRuntime === "scripted") return null;
  const [bot, defaultCredential, settings] = await Promise.all([
    botId
      ? prisma.bot.findFirst({
          where: { id: botId, ...owner(actor), archivedAt: null },
          select: {
            modelProvider: true,
            modelId: true,
            modelCredentialId: true,
            thinkingLevel: true,
          },
        })
      : null,
    findDefaultModelCredential(prisma, actor),
    prisma.deploymentSettings.findUnique({ where: { id: "default" } }),
  ]);
  const overrideCredential =
    bot?.modelProvider && bot.modelId
      ? await findBotModelCredential(prisma, actor, {
          modelProvider: bot.modelProvider,
          modelId: bot.modelId,
          modelCredentialId: bot.modelCredentialId,
        }).catch(ignorePinnedConnectionLost)
      : null;
  const model = selectConfiguredModel({
    override: bot ?? null,
    overrideCredential,
    defaultCredential,
    settings,
    deployment: env.deploymentModelConfigured
      ? { provider: env.defaultProvider, model: env.defaultModel }
      : null,
  });
  if (!model.provider || !model.id) return null;
  let baseUrl: string | undefined;
  if (model.credential) {
    const secret = await prisma.secret.findFirst({
      where: { id: model.credential.secretId, userId: actor.userId, spaceId: null },
    });
    try {
      const parsed = secret
        ? parseModelSecret(await deps.router.secrets.load(secret.ciphertext, secret.id))
        : null;
      if (parsed?.kind === "openai_compatible") baseUrl = parsed.baseUrl;
    } catch {
      // An unreadable credential still discloses by provider.
    }
  }
  return aiRecipient({ provider: model.provider, modelId: model.id, baseUrl, use: "model" });
}

/** The primary model's recipient when the user has not consented to it, as a list of 0 or 1. */
async function missingConsent(deps: MeetingsDeps, actor: Actor, botId?: string | null) {
  const recipient = await primaryRecipient(deps, actor, botId);
  if (!recipient) return [];
  const granted = await deps.router.prisma.aiDataConsent.findFirst({
    where: { ...owner(actor), recipientKey: recipient.key, version: AI_DISCLOSURE_VERSION },
    select: { userId: true },
  });
  return granted ? [] : [recipient];
}

/** Connecting is the consent act: it records consent for the primary model's recipient. */
export async function recordConsent(deps: MeetingsDeps, actor: Actor, botId: string | null) {
  for (const recipient of await missingConsent(deps, actor, botId)) {
    await deps.router.prisma.aiDataConsent.upsert({
      where: {
        userId_spaceId_recipientKey: { ...owner(actor), recipientKey: recipient.key },
      },
      create: { ...owner(actor), recipientKey: recipient.key, version: AI_DISCLOSURE_VERSION },
      update: { version: AI_DISCLOSURE_VERSION, grantedAt: new Date() },
    });
  }
}

export async function connectGranola(
  deps: MeetingsDeps,
  actor: Actor,
  input: { apiKey: string },
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new ORPCError("BAD_REQUEST", { message: GRANOLA_REJECTED });
  await checkKey(deps, actor, apiKey, signal);

  const { prisma, secrets } = deps.router;
  const stored = await secrets.put(apiKey, {
    operationId: "meetings.connect",
    traceId: "meetings.connect",
    ...owner(actor),
    botId: "meetings",
    signal: signal ?? new AbortController().signal,
  });
  const connection = await persistPreparedSecret(prisma, secrets, stored, () =>
    prisma.$transaction(async (tx) => {
      // One Granola connection per user: a second connect updates it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('granola-connect'), hashtext(${`${actor.spaceId}:${actor.userId}`}))`;
      const existing = await tx.connection.findFirst({
        where: {
          ...owner(actor),
          connectorId: GRANOLA_API_CONNECTOR_ID,
          status: { not: "revoked" },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      await tx.secret.create({
        data: { id: stored.id, ...owner(actor), kind: "connection", ciphertext: stored.ciphertext },
      });
      if (!existing) {
        return tx.connection.create({
          data: {
            ...owner(actor),
            connectorId: GRANOLA_API_CONNECTOR_ID,
            provider: "granola",
            displayName: "Granola",
            status: "connected",
            secretId: stored.id,
            // Private to its own agent, writes off, as every connected app.
            allAgents: false,
            privateByDefault: true,
          },
        });
      }
      const updated = await tx.connection.update({
        where: { id: existing.id },
        data: { status: "connected", secretId: stored.id },
      });
      // A new key clears the old rejection so the next sync runs.
      await tx.meetingSyncState.updateMany({
        where: { connectionId: existing.id, ...owner(actor) },
        data: { error: null },
      });
      if (existing.secretId)
        await tx.secret.deleteMany({ where: { id: existing.secretId, ...owner(actor) } });
      return updated;
    }),
  );

  // The agent is made only now, after the key was accepted. Best-effort: Create agent repairs it.
  await provisionConnectionAgent(deps.agent, actor, connection.id);
  const agentBotId =
    (
      await prisma.connection.findFirst({
        where: { id: connection.id, ...owner(actor) },
        select: { agentBotId: true },
      })
    )?.agentBotId ?? null;
  await recordConsent(deps, actor, agentBotId).catch((error) =>
    getLogger().error("meetings.connect: consent not recorded", error),
  );
  // Consent is now recorded, so stored meetings without a digest can be digested.
  await queueMeetingDigests({ prisma, jobs: deps.router.jobs }, owner(actor)).catch((error) =>
    getLogger().error("meetings.connect: digests not queued", error),
  );
  await requestMeetingSync(
    { prisma, jobs: deps.router.jobs },
    owner(actor),
    { connectionId: connection.id },
    "granola",
  ).catch((error) => getLogger().error("meetings.connect: sync not queued", error));
  return { ok: true };
}

export async function granolaStatus(deps: MeetingsDeps, actor: Actor): Promise<MeetingsStatus> {
  const connection = await findConnection(deps, actor);
  if (!connection) return null;
  const { prisma } = deps.router;
  const [state, syncedCount] = await Promise.all([
    getMeetingSyncState(prisma, owner(actor), { connectionId: connection.id }),
    prisma.meeting.count({ where: { ...owner(actor), provider: "granola", deletedAt: null } }),
  ]);
  const status =
    connection.status === "connected" || connection.status === "needs_reconnect"
      ? connection.status
      : "disconnected";
  // Rate-limit back-off is silent: it is not a failure to show.
  const failing = Boolean(state?.error && !state.error.startsWith("Rate limited until "));
  const late = Boolean(state?.lastSyncedAt && Date.now() - state.lastSyncedAt.getTime() > LATE_MS);
  return {
    connectionId: connection.id,
    status,
    syncedThrough: state?.syncedThrough?.toISOString() ?? null,
    lastSyncedAt:
      state?.lastSyncedAt && (failing || late) ? state.lastSyncedAt.toISOString() : null,
    syncedCount,
    consentOff:
      status === "connected" &&
      (await missingConsent(deps, actor, connection.agentBotId).then((rows) => rows.length > 0)),
    agentBotId: connection.agentBotId,
  };
}

export async function disconnectGranola(deps: MeetingsDeps, actor: Actor): Promise<{ ok: true }> {
  const { prisma } = deps.router;
  await prisma.$transaction(async (tx) => {
    // The lock connect takes: a racing connect either finishes first (its new secret is the one
    // read and deleted here) or waits, and then replaces the disconnected row's secret.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('granola-connect'), hashtext(${`${actor.spaceId}:${actor.userId}`}))`;
    const connection = await tx.connection.findFirst({
      where: { ...owner(actor), connectorId: GRANOLA_API_CONNECTOR_ID, status: { not: "revoked" } },
    });
    if (!connection) return;
    await tx.connection.update({
      where: { id: connection.id },
      data: { status: "disconnected", secretId: null },
    });
    if (connection.secretId)
      await tx.secret.deleteMany({ where: { id: connection.secretId, ...owner(actor) } });
  });
  return { ok: true };
}

export async function refreshGranola(deps: MeetingsDeps, actor: Actor): Promise<{ ok: true }> {
  const connection = await findConnection(deps, actor);
  if (connection?.status === "connected")
    await requestMeetingSync(
      { prisma: deps.router.prisma, jobs: deps.router.jobs },
      owner(actor),
      { connectionId: connection.id },
      "granola",
    );
  return { ok: true };
}

/** A plain read of the actor's stored meetings: no model, no consent check, no source. */
export async function listStoredMeetings(
  deps: MeetingsDeps,
  actor: Actor,
  cursor?: string,
  filter: { q?: string; provider?: string; attendee?: string } = {},
): Promise<StoredMeetingsPage> {
  // The cursor is the last row's start time and id; rows sort by start time (newest first), then id.
  const at = cursor ? cursor.split("|") : [];
  const after =
    at.length === 2 && !Number.isNaN(Date.parse(at[0] ?? ""))
      ? {
          OR: [
            { startedAt: { lt: new Date(at[0] as string) } },
            { startedAt: new Date(at[0] as string), id: { gt: at[1] as string } },
          ],
        }
      : {};
  const rows = await deps.router.prisma.meeting.findMany({
    where: {
      ...owner(actor),
      deletedAt: null,
      ...(filter.provider ? { provider: filter.provider } : {}),
      ...(filter.q
        ? { title: { contains: likeLiteral(filter.q), mode: "insensitive" as const } }
        : {}),
      // Attendee emails are stored lowercase (packages/db meetings.ts); jsonb containment.
      ...(filter.attendee
        ? { attendees: { array_contains: [{ email: filter.attendee.toLowerCase() }] } }
        : {}),
      ...after,
    },
    select: { id: true, title: true, startedAt: true, endedAt: true, provider: true },
    orderBy: [{ startedAt: "desc" }, { id: "asc" }],
    take: STORED_MEETINGS_PAGE_SIZE + 1,
  });
  const page = rows.slice(0, STORED_MEETINGS_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    items: page.map((row) => ({
      ...row,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt?.toISOString() ?? null,
    })),
    nextCursor:
      rows.length > page.length && last ? `${last.startedAt.toISOString()}|${last.id}` : null,
  };
}

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** The longest the page waits to learn whether a digest can run. */
const READINESS_TIMEOUT_MS = 1500;

/**
 * Best effort: resolving the model may refresh a credential over the network. A failure or a slow
 * answer means "not summarizing", so the meeting itself is never delayed or failed by it.
 */
async function digestCanRun(deps: MeetingsDeps, actor: Actor): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), READINESS_TIMEOUT_MS);
    });
    const ready = await Promise.race([triageReadiness(deps.router, owner(actor)), timeout]);
    if (ready === null) getLogger().debug("meetings.get: digest readiness not available");
    return ready !== null;
  } catch (error) {
    getLogger().warn("meetings.get: digest readiness check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** One of the actor's meetings; anyone else's, in any space, is not found. */
export async function getStoredMeeting(
  deps: MeetingsDeps,
  actor: Actor,
  meetingId: string,
): Promise<StoredMeetingDetail> {
  const row = await deps.router.prisma.meeting.findFirst({
    where: { id: meetingId, ...owner(actor), deletedAt: null },
    include: {
      inboxTodos: {
        where: owner(actor),
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, text: true, dueOn: true, doneAt: true },
      },
    },
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Meeting not found" });
  const digest =
    row.digestStatus === "done" ? (row.digest as Record<string, unknown> | null) : null;
  // Same rule as the Inbox's "digests still to come": only while a digest can run and the meeting is new.
  const summarizing =
    (row.digestStatus === null || row.digestStatus === "running") &&
    row.createdAt.getTime() > Date.now() - DIGEST_WINDOW_MS &&
    (await digestCanRun(deps, actor));
  // Commitments that are not the user's; with no known identity none can be told apart, so none are shown.
  const identity = digest
    ? await identityEmails(deps.router.prisma, owner(actor))
    : new Set<string>();
  const attendees = attendeesOf(row.attendees);
  const parsed = identity.size > 0 ? MeetingDigestSchema.safeParse(digest) : null;
  const actionItems = (parsed?.success ? parsed.data.commitments : [])
    .filter((c) => !isMine(c.owner, attendees, identity))
    .map((c) => ({ owner: c.owner, text: c.text, due: c.due ?? null }));
  return {
    id: row.id,
    title: row.title,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    provider: row.provider,
    summary: row.summary,
    decisions: strings(digest?.decisions),
    followUps: strings(digest?.followUps),
    todos: row.inboxTodos.map((todo) => ({
      id: todo.id,
      text: todo.text,
      dueOn: todo.dueOn ? todo.dueOn.toISOString().slice(0, 10) : null,
      doneAt: todo.doneAt?.toISOString() ?? null,
    })),
    transcript: row.transcript,
    canMergeWithPrevious: !!(await findMergeablePrevious(deps.router.prisma, owner(actor), row)),
    summarizing,
    actionItems,
    // Read from the capture's chunks, so meetings has no column for it.
    partial:
      (await deps.router.prisma.meetingCaptureChunk.count({
        where: { ...owner(actor), status: "failed", capture: { meetingId: row.id } },
      })) > 0 ||
      (await deps.router.prisma.meetingCapture.count({
        where: { ...owner(actor), meetingId: row.id, error: "part_not_transcribed" },
      })) > 0,
  };
}

/** Merges one of the actor's meetings into the previous one; the digest is queued again. */
export async function mergeStoredMeeting(
  deps: MeetingsDeps,
  actor: Actor,
  meetingId: string,
): Promise<{ meetingId: string }> {
  try {
    const merged = await mergeMeetingWithPrevious(deps.router.prisma, owner(actor), meetingId);
    for (const key of merged.blobKeys) {
      await deps.router.jobs
        .enqueue(dataRoomBlobDeleteJob(actor.spaceId, key, new Date(Date.now() + 60_000)))
        .catch((error: unknown) =>
          getLogger().error("recording blob delete enqueue failed", error),
        );
    }
    await deps.router.jobs
      .enqueue({
        ...meetingsDigestJob({ ...owner(actor), meetingId: merged.meetingId }),
        keepExisting: true,
      })
      .catch((error: unknown) => getLogger().error("meeting digest enqueue failed", error));
    return { meetingId: merged.meetingId };
  } catch (error) {
    if (error instanceof IsolationError)
      throw new ORPCError("NOT_FOUND", { message: "Meeting not found" });
    throw error;
  }
}

export async function deleteStoredMeeting(
  deps: MeetingsDeps,
  actor: Actor,
  meetingId: string,
): Promise<{ ok: true }> {
  try {
    const keys = await deleteMeeting(deps.router.prisma, owner(actor), meetingId);
    // ponytail: a failed enqueue leaves an orphan blob, as dropNotes does; add a sweep if it shows.
    for (const key of keys) {
      await deps.router.jobs
        .enqueue(dataRoomBlobDeleteJob(actor.spaceId, key, new Date(Date.now() + 60_000)))
        .catch((error: unknown) =>
          getLogger().error("recording blob delete enqueue failed", error),
        );
    }
  } catch (error) {
    if (error instanceof IsolationError)
      throw new ORPCError("NOT_FOUND", { message: "Meeting not found" });
    throw error;
  }
  return { ok: true };
}
