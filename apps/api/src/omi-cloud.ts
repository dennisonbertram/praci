import { ORPCError } from "@orpc/server";
import { MeetingSourceError } from "@rakazo/adapter-kit";
import { persistPreparedSecret, queueMeetingDigests, requestMeetingSync } from "@rakazo/adapters";
import type { Actor, OmiCloudStatus } from "@rakazo/contracts";
import {
  isOmiMcpKey,
  OMI_CLOUD_CONNECTOR_ID,
  OMI_CLOUD_PROVIDER,
  OMI_CONNECTOR_ID,
} from "@rakazo/contracts";
import { getMeetingSyncState } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { provisionConnectionAgent } from "./integration-agent.js";
import type { MeetingsDeps } from "./meetings.js";
import { owner, recordConsent } from "./meetings.js";

export const OMI_REJECTED = "Omi rejected this key";
export const OMI_MCP_KEY = "This is an MCP key. Create a Developer key in the Omi app.";
export const OMI_UNREACHABLE = "Could not reach Omi";
/** A sync older than this, or one that failed, shows its age. */
const LATE_MS = 15 * 60_000;

/** The user's Developer key connection, whatever its status except revoked. */
const findConnection = (deps: MeetingsDeps, actor: Actor) =>
  deps.router.prisma.connection.findFirst({
    where: { ...owner(actor), connectorId: OMI_CLOUD_CONNECTOR_ID, status: { not: "revoked" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

/** One list call decides whether Omi accepts the key. Nothing is stored here. */
async function checkKey(deps: MeetingsDeps, actor: Actor, apiKey: string, signal?: AbortSignal) {
  const entry = deps.registry[OMI_CLOUD_PROVIDER];
  if (!entry) throw new ORPCError("SERVICE_UNAVAILABLE", { message: OMI_UNREACHABLE });
  try {
    await entry.create({ ...owner(actor), apiKey }, signal ?? AbortSignal.timeout(20_000)).list({});
  } catch (error) {
    if (error instanceof MeetingSourceError && error.kind === "auth")
      throw new ORPCError("BAD_REQUEST", { message: OMI_REJECTED });
    throw new ORPCError("SERVICE_UNAVAILABLE", { message: OMI_UNREACHABLE });
  }
}

export async function connectOmiCloud(
  deps: MeetingsDeps,
  actor: Actor,
  input: { apiKey: string },
  signal?: AbortSignal,
): Promise<{ ok: true }> {
  const apiKey = input.apiKey.trim();
  if (isOmiMcpKey(apiKey)) throw new ORPCError("BAD_REQUEST", { message: OMI_MCP_KEY });
  if (!apiKey) throw new ORPCError("BAD_REQUEST", { message: OMI_REJECTED });
  await checkKey(deps, actor, apiKey, signal);

  const { prisma, secrets } = deps.router;
  const stored = await secrets.put(apiKey, {
    operationId: "omiCloud.connect",
    traceId: "omiCloud.connect",
    ...owner(actor),
    botId: "meetings",
    signal: signal ?? new AbortController().signal,
  });
  const connection = await persistPreparedSecret(prisma, secrets, stored, () =>
    prisma.$transaction(async (tx) => {
      // One cloud connection per user: a second connect updates it.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('omi-cloud-connect'), hashtext(${`${actor.spaceId}:${actor.userId}`}))`;
      const existing = await tx.connection.findFirst({
        where: { ...owner(actor), connectorId: OMI_CLOUD_CONNECTOR_ID, status: { not: "revoked" } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      await tx.secret.create({
        data: { id: stored.id, ...owner(actor), kind: "connection", ciphertext: stored.ciphertext },
      });
      if (!existing) {
        return tx.connection.create({
          data: {
            ...owner(actor),
            connectorId: OMI_CLOUD_CONNECTOR_ID,
            provider: OMI_CLOUD_PROVIDER,
            displayName: "Omi",
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

  // A user with a pendant already has an Omi agent: it reads the cloud meetings too. Otherwise
  // the connection gets its own agent. Best-effort: Create agent repairs a failed provision.
  const agentBotId = await attachAgent(deps, actor, connection.id);
  await recordConsent(deps, actor, agentBotId).catch((error) =>
    getLogger().error("omiCloud.connect: consent not recorded", error),
  );
  await queueMeetingDigests({ prisma, jobs: deps.router.jobs }, owner(actor)).catch((error) =>
    getLogger().error("omiCloud.connect: digests not queued", error),
  );
  await requestMeetingSync(
    { prisma, jobs: deps.router.jobs },
    owner(actor),
    { connectionId: connection.id },
    OMI_CLOUD_PROVIDER,
  ).catch((error) => getLogger().error("omiCloud.connect: sync not queued", error));
  return { ok: true };
}

async function attachAgent(deps: MeetingsDeps, actor: Actor, connectionId: string) {
  const { prisma } = deps.router;
  const pendant = await prisma.connection.findFirst({
    where: { ...owner(actor), connectorId: OMI_CONNECTOR_ID, status: { not: "revoked" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { agentBotId: true },
  });
  const bot = pendant?.agentBotId
    ? await prisma.bot.findFirst({
        where: { id: pendant.agentBotId, ...owner(actor), archivedAt: null },
        select: { id: true },
      })
    : null;
  if (bot) {
    const attached = await prisma
      .$transaction(async (tx) => {
        // Lock and re-read the connection, so a racing attach cannot leave a grant behind.
        await tx.$queryRaw`SELECT id FROM connections WHERE id = ${connectionId} FOR UPDATE`;
        const current = await tx.connection.findFirst({
          where: { id: connectionId, ...owner(actor), status: "connected" },
          select: { agentBotId: true },
        });
        if (!current) return null;
        if (current.agentBotId) return current.agentBotId;
        const { count } = await tx.connection.updateMany({
          where: { id: connectionId, ...owner(actor), agentBotId: null },
          data: { agentBotId: bot.id },
        });
        // Throwing rolls the grant back with it.
        if (count !== 1) throw new Error("omi cloud agent attach lost a race");
        await tx.botConnectionAccess.upsert({
          where: { connectionId_botId: { connectionId, botId: bot.id } },
          create: { connectionId, botId: bot.id, ...owner(actor) },
          update: {},
        });
        return bot.id;
      })
      .catch((error: unknown) => {
        getLogger().error("omiCloud.connect: agent not attached", error);
        return null;
      });
    if (attached) return attached;
  }
  await provisionConnectionAgent(deps.agent, actor, connectionId);
  return (
    (
      await prisma.connection.findFirst({
        where: { id: connectionId, ...owner(actor) },
        select: { agentBotId: true },
      })
    )?.agentBotId ?? null
  );
}

export async function omiCloudStatus(deps: MeetingsDeps, actor: Actor): Promise<OmiCloudStatus> {
  const connection = await findConnection(deps, actor);
  if (!connection) return null;
  const { prisma } = deps.router;
  const [state, syncedCount] = await Promise.all([
    getMeetingSyncState(prisma, owner(actor), { connectionId: connection.id }),
    prisma.meeting.count({
      where: { ...owner(actor), provider: OMI_CLOUD_PROVIDER, deletedAt: null },
    }),
  ]);
  const status =
    connection.status === "connected" || connection.status === "needs_reconnect"
      ? connection.status
      : "disconnected";
  const failing = Boolean(state?.error && !state.error.startsWith("Rate limited until "));
  const late = Boolean(state?.lastSyncedAt && Date.now() - state.lastSyncedAt.getTime() > LATE_MS);
  return {
    connectionId: connection.id,
    status,
    syncedThrough: state?.syncedThrough?.toISOString() ?? null,
    lastSyncedAt:
      state?.lastSyncedAt && (failing || late) ? state.lastSyncedAt.toISOString() : null,
    syncedCount,
    agentBotId: connection.agentBotId,
  };
}

export async function disconnectOmiCloud(deps: MeetingsDeps, actor: Actor): Promise<{ ok: true }> {
  await deps.router.prisma.$transaction(async (tx) => {
    // The lock connect takes, so a racing connect leaves exactly the current secret.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('omi-cloud-connect'), hashtext(${`${actor.spaceId}:${actor.userId}`}))`;
    const connection = await tx.connection.findFirst({
      where: { ...owner(actor), connectorId: OMI_CLOUD_CONNECTOR_ID, status: { not: "revoked" } },
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
