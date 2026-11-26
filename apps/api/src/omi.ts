import { createHash } from "node:crypto";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { dataRoomBlobDeleteJob, omiAssembleJob } from "@rakazo/adapter-kit";
import { dataRoomBlobContext, TRANSCRIPTION_FAILED } from "@rakazo/adapters";
import type { Actor, OmiConnectInput, OmiStatus } from "@rakazo/contracts";
import { OMI_CONNECTOR_ID, OMI_UPLOAD_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, deleteOmiOutputs, isUniqueViolation } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { Hono } from "hono";
import { cancelBody } from "./http-body.js";
import type { ensureConnectedAppAgent } from "./integration-agent.js";
import { provisionConnectionAgent } from "./integration-agent.js";

/** A stored record: 4 bytes of timestamp, then 440 bytes of frames. */
const RECORD_BYTES = 444;

export interface OmiDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
  artifacts: ArtifactStore;
}

const owner = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });

const findConnection = (prisma: PrismaClient, actor: Actor) =>
  prisma.connection.findFirst({
    where: { ...owner(actor), connectorId: OMI_CONNECTOR_ID, status: { not: "revoked" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

/** One Omi connection per user and space: a second connect refreshes its pendant details. */
export async function connectOmi(
  deps: OmiDeps & { agent: Parameters<typeof ensureConnectedAppAgent>[0] },
  actor: Actor,
  input: OmiConnectInput,
): Promise<{ connectionId: string }> {
  const metadata = {
    model: input.model,
    firmware: input.firmware,
    hardware: input.hardware,
    deviceId: input.deviceId,
  };
  const connection = await deps.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('omi-connect'), hashtext(${`${actor.spaceId}:${actor.userId}`}))`;
    const existing = await tx.connection.findFirst({
      where: { ...owner(actor), connectorId: OMI_CONNECTOR_ID, status: { not: "revoked" } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (existing) {
      return tx.connection.update({
        where: { id: existing.id },
        data: { status: "connected", metadata },
      });
    }
    return tx.connection.create({
      data: {
        ...owner(actor),
        connectorId: OMI_CONNECTOR_ID,
        provider: "omi",
        displayName: "Omi",
        status: "connected",
        metadata,
        // Private to its own agent, as every connected app.
        allAgents: false,
        privateByDefault: true,
      },
    });
  });
  // Best-effort, as for Granola: Create agent repairs a failed provision.
  await provisionConnectionAgent(deps.agent, actor, connection.id);
  return { connectionId: connection.id };
}

export async function omiStatus(deps: OmiDeps, actor: Actor): Promise<OmiStatus> {
  const connection = await findConnection(deps.prisma, actor);
  if (connection?.status !== "connected") return null;
  const [pendingUploads, recordings, notTranscribed] = await Promise.all([
    deps.prisma.omiUpload.count({ where: { connectionId: connection.id, assembledAt: null } }),
    deps.prisma.dataRoomItem.count({
      where: { ...owner(actor), source: "omi", sourceConnectionId: connection.id },
    }),
    deps.prisma.dataRoomItem.count({
      where: {
        ...owner(actor),
        source: "omi",
        sourceConnectionId: connection.id,
        error: TRANSCRIPTION_FAILED,
      },
    }),
  ]);
  return {
    connectionId: connection.id,
    pendingUploads,
    recordings,
    notTranscribed,
    agentBotId: connection.agentBotId,
  };
}

/** Deletes the connection's recordings, uploads, segments, meetings with to-dos, and notes. The connection stays. */
async function deleteOmiRecordings(
  deps: OmiDeps,
  actor: Actor,
  connectionId: string,
): Promise<void> {
  const { prisma, jobs } = deps;
  // Blob cleanup is queued first: if a row delete fails, the job finds the row and keeps the blob.
  const repo = createDataRoomRepos(prisma);
  for (const key of await deleteOmiOutputs(prisma, actor, { connectionId })) {
    await jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, key));
  }
  const items = await prisma.dataRoomItem.findMany({
    where: { ...owner(actor), source: "omi", sourceConnectionId: connectionId },
    select: { id: true, storageKey: true, thumbnailKey: true },
  });
  for (const item of items) {
    for (const key of [item.storageKey, item.thumbnailKey]) {
      if (key) await jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, key));
    }
    await repo.deleteItem(actor, item.id);
  }
  const uploads = await prisma.omiUpload.findMany({
    where: { connectionId, assembledAt: null },
    select: { storageKey: true },
  });
  await prisma.omiUpload.deleteMany({ where: { connectionId, ...owner(actor) } });
  for (const upload of uploads)
    await jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, upload.storageKey));
}

export async function deleteOmiRecordingsFor(deps: OmiDeps, actor: Actor): Promise<{ ok: true }> {
  const connection = await findConnection(deps.prisma, actor);
  if (connection) await deleteOmiRecordings(deps, actor, connection.id);
  return { ok: true };
}

export async function disconnectOmi(
  deps: OmiDeps,
  actor: Actor,
  input: { deleteRecordings: boolean },
): Promise<{ ok: true }> {
  const connection = await findConnection(deps.prisma, actor);
  if (!connection) return { ok: true };
  await deps.prisma.connection.update({
    where: { id: connection.id },
    data: { status: "disconnected" },
  });
  if (input.deleteRecordings) await deleteOmiRecordings(deps, actor, connection.id);
  return { ok: true };
}

/** The body, or null when it is over `max` bytes. Never holds more than `max` + one chunk. */
export async function readBody(request: Request, max: number): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > max) {
    cancelBody(request.body);
    return null;
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      cancelBody(reader);
      return null;
    }
    parts.push(value);
  }
  return Buffer.concat(parts);
}

/** Session-authenticated raw upload of pendant records, and the "sync finished" signal. */
export function mountOmiRoutes(
  app: Hono,
  deps: OmiDeps,
  authenticate: (request: Request) => Promise<Actor | null>,
) {
  const { prisma, artifacts, jobs } = deps;
  const connectionOf = (actor: Actor, id: string | undefined) =>
    id
      ? prisma.connection.findFirst({
          where: {
            id,
            ...owner(actor),
            connectorId: OMI_CONNECTOR_ID,
            status: "connected",
          },
          select: { id: true },
        })
      : null;

  app.post("/api/omi/records", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const reject = (message: string, status: 400 | 404 | 413) => {
      cancelBody(c.req.raw.body);
      return c.json({ error: message }, status);
    };
    const connection = await connectionOf(actor, c.req.query("connectionId"));
    if (!connection) return reject("Connection not found", 404);
    const firstSeqText = c.req.query("firstSeq") ?? "";
    const firstSeq = Number(firstSeqText);
    const codec = Number(c.req.query("codec"));
    const rtcValid = c.req.query("rtcValid");
    if (!/^\d{1,15}$/.test(firstSeqText) || !Number.isSafeInteger(firstSeq))
      return reject("Invalid firstSeq", 400);
    if (codec !== 20 && codec !== 21) return reject("Invalid codec", 400);
    if (rtcValid !== "true" && rtcValid !== "false") return reject("Invalid rtcValid", 400);

    const body = await readBody(c.req.raw, OMI_UPLOAD_MAX_BYTES);
    if (!body) return c.json({ error: "Too large" }, 413);
    if (body.byteLength === 0 || body.byteLength % RECORD_BYTES !== 0)
      return c.json({ error: "Body must be whole 444-byte records" }, 400);
    const stored = body.byteLength / RECORD_BYTES;

    // A retry (same position and same bytes) answers the same and stores nothing. The same
    // position with other bytes is new audio from a restarted counter.
    const sha256 = createHash("sha256").update(body).digest("hex");
    const known = () =>
      prisma.omiUpload.findFirst({
        where: { connectionId: connection.id, firstSeq: BigInt(firstSeq), sha256 },
        select: { id: true },
      });
    if (await known()) return c.json({ stored }, 200);

    const context = dataRoomBlobContext(actor, "omi.upload", c.req.raw.signal);
    const blob = await artifacts.put(
      { name: `omi-${firstSeq}.bin`, mimeType: "application/octet-stream", bytes: body },
      context,
    );
    try {
      await prisma.omiUpload.create({
        data: {
          ...owner(actor),
          connectionId: connection.id,
          firstSeq: BigInt(firstSeq),
          sha256,
          recordCount: stored,
          codec,
          rtcValid: rtcValid === "true",
          storageKey: blob.id,
        },
      });
    } catch (error) {
      try {
        await jobs.enqueue(dataRoomBlobDeleteJob(actor.spaceId, blob.id));
      } catch (enqueueError) {
        getLogger().error("omi.upload: blob delete not queued", enqueueError);
      }
      await artifacts.remove(blob.id, context).catch(() => undefined);
      // A concurrent identical retry won the insert.
      if (isUniqueViolation(error)) return c.json({ stored }, 200);
      throw error;
    }
    return c.json({ stored }, 201);
  });

  app.post("/api/omi/sync-complete", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const connection = await connectionOf(actor, c.req.query("connectionId"));
    if (!connection) return c.json({ error: "Connection not found" }, 404);
    await jobs.enqueue(omiAssembleJob({ ...owner(actor), connectionId: connection.id }));
    return c.json({ queued: true }, 202);
  });
}
