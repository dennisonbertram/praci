import { ORPCError } from "@orpc/server";
import { MeetingSourceError } from "@rakazo/adapter-kit";
import type { MeetingSourceRegistry } from "@rakazo/adapters";
import {
  aiRecipient,
  parseModelSecret,
  persistPreparedSecret,
  queueMeetingDigests,
  requestMeetingSync,
  selectConfiguredModel,
} from "@rakazo/adapters";
import type { Actor, MeetingsStatus, StoredMeeting } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION, GRANOLA_API_CONNECTOR_ID } from "@rakazo/contracts";
import {
  deleteMeeting,
  findDefaultModelCredential,
  findModelCredential,
  getMeetingSyncState,
  IsolationError,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
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

const owner = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });

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
          select: { modelProvider: true, modelId: true, thinkingLevel: true },
        })
      : null,
    findDefaultModelCredential(prisma, actor),
    prisma.deploymentSettings.findUnique({ where: { id: "default" } }),
  ]);
  const overrideCredential =
    bot?.modelProvider && bot.modelId
      ? await findModelCredential(prisma, actor, bot.modelProvider, bot.modelId)
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
async function recordConsent(deps: MeetingsDeps, actor: Actor, botId: string | null) {
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
  );
  return { ok: true };
}

export async function granolaStatus(deps: MeetingsDeps, actor: Actor): Promise<MeetingsStatus> {
  const connection = await findConnection(deps, actor);
  if (!connection) return null;
  const { prisma } = deps.router;
  const [state, syncedCount] = await Promise.all([
    getMeetingSyncState(prisma, owner(actor), { connectionId: connection.id }),
    prisma.meeting.count({ where: { ...owner(actor), deletedAt: null } }),
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
): Promise<StoredMeeting[]> {
  const rows = await deps.router.prisma.meeting.findMany({
    where: { ...owner(actor), deletedAt: null },
    select: { id: true, title: true, startedAt: true },
    orderBy: [{ startedAt: "desc" }, { id: "asc" }],
    take: 1000,
  });
  return rows.map((row) => ({ ...row, startedAt: row.startedAt.toISOString() }));
}

export async function deleteStoredMeeting(
  deps: MeetingsDeps,
  actor: Actor,
  meetingId: string,
): Promise<{ ok: true }> {
  try {
    await deleteMeeting(deps.router.prisma, owner(actor), meetingId);
  } catch (error) {
    if (error instanceof IsolationError)
      throw new ORPCError("NOT_FOUND", { message: "Meeting not found" });
    throw error;
  }
  return { ok: true };
}
