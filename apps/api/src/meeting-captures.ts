import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { meetingsCaptureFinalizeJob, meetingsCaptureTranscribeJob } from "@rakazo/adapter-kit";
import {
  dataRoomBlobContext,
  lockCapture,
  queueCaptureBlobDelete,
  removeCaptureBlobNow,
} from "@rakazo/adapters";
import type {
  Actor,
  MeetingCaptureActive,
  MeetingCaptureTrack,
  MeetingRecordingPolicy,
} from "@rakazo/contracts";
import {
  isSpaceOwnerOrAdminRole,
  MEETING_CAPTURE_CHUNK_MAX_BYTES,
  MeetingCaptureTrackSchema,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  IsolationError,
  isUniqueViolation,
  lockSpaceForContentCreation,
  Prisma,
  SpaceDeletionInProgressError,
  withTransactionRetry,
} from "@rakazo/db";
import type { Hono } from "hono";
import { cancelBody } from "./http-body.js";
import { readBody } from "./omi.js";

export interface MeetingCaptureDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
  artifacts: ArtifactStore;
}

const owner = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });
const notFound = () => new ORPCError("NOT_FOUND", { message: "Capture not found" });
const sha256Of = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");

/** Owners and admins only; applies to captures started afterwards. */
export async function setMeetingRecording(
  deps: MeetingCaptureDeps,
  actor: Actor,
  policy: MeetingRecordingPolicy,
): Promise<{ policy: MeetingRecordingPolicy }> {
  await withTransactionRetry(() =>
    deps.prisma.$transaction(
      async (tx) => {
        try {
          await lockSpaceForContentCreation(tx, { spaceId: actor.spaceId, userId: actor.userId });
        } catch (error) {
          if (error instanceof IsolationError)
            throw new ORPCError("NOT_FOUND", { message: "Space not found" });
          if (error instanceof SpaceDeletionInProgressError)
            throw new ORPCError("CONFLICT", { message: error.message });
          throw error;
        }
        const member = await tx.spaceMember.findUniqueOrThrow({
          where: { spaceId_userId: { spaceId: actor.spaceId, userId: actor.userId } },
          select: { role: true },
        });
        if (!isSpaceOwnerOrAdminRole(member.role))
          throw new ORPCError("FORBIDDEN", { message: "Only owners and admins can change this" });
        await tx.space.update({
          where: { id: actor.spaceId },
          data: { meetingRecording: policy },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return { policy };
}

/** Starts a recording after the space's policy allows it. A repeat with the same clientId returns the first. */
export async function startCapture(
  deps: MeetingCaptureDeps,
  actor: Actor,
  input: {
    clientId: string;
    title?: string;
    engine: "device" | "server";
    tracks: MeetingCaptureTrack[];
    consentConfirmed?: boolean;
  },
): Promise<{ captureId: string }> {
  const { prisma } = deps;
  const existing = await prisma.meetingCapture.findFirst({
    where: { userId: actor.userId, spaceId: actor.spaceId, clientId: input.clientId },
    select: { id: true },
  });
  if (existing) return { captureId: existing.id };

  const space = await prisma.space.findUnique({
    where: { id: actor.spaceId },
    select: { meetingRecording: true },
  });
  if (!space) throw new ORPCError("NOT_FOUND", { message: "Space not found" });
  if (space.meetingRecording === "off")
    throw new ORPCError("FORBIDDEN", { message: "Recording is off in this space" });
  const confirmed = input.consentConfirmed === true;
  if (space.meetingRecording === "confirm" && !confirmed)
    throw new ORPCError("BAD_REQUEST", { message: "Everyone must agree to be recorded" });
  try {
    const capture = await prisma.meetingCapture.create({
      data: {
        ...owner(actor),
        clientId: input.clientId,
        title: input.title?.trim() || null,
        engine: input.engine,
        tracks: [...new Set(input.tracks)],
        // The time of consent is kept whenever the client says everyone agreed.
        consentConfirmedAt: confirmed ? new Date() : null,
      },
      select: { id: true },
    });
    return { captureId: capture.id };
  } catch (error) {
    // A concurrent start with the same clientId won the insert.
    if (!isUniqueViolation(error)) throw error;
    const won = await prisma.meetingCapture.findFirstOrThrow({
      where: { userId: actor.userId, spaceId: actor.spaceId, clientId: input.clientId },
      select: { id: true },
    });
    return { captureId: won.id };
  }
}

/** The caller's own capture that can still take chunks. */
async function openCapture(deps: MeetingCaptureDeps, actor: Actor, captureId: string) {
  const capture = await deps.prisma.meetingCapture.findFirst({
    where: { id: captureId, ...owner(actor) },
  });
  if (!capture || capture.status === "discarded") throw notFound();
  return capture;
}

export async function appendCaptureText(
  deps: MeetingCaptureDeps,
  actor: Actor,
  input: {
    captureId: string;
    track: MeetingCaptureTrack;
    seq: number;
    startMs: number;
    endMs: number;
    text: string;
  },
): Promise<{ ok: true }> {
  const capture = await openCapture(deps, actor, input.captureId);
  if (capture.engine !== "device" || !capture.tracks.includes(input.track))
    throw new ORPCError("BAD_REQUEST", {
      message: "This capture does not take text for this track",
    });
  const sha256 = sha256Of(input.text);
  const key = { captureId: capture.id, track: input.track, seq: input.seq };
  await deps.prisma.$transaction(async (tx) => {
    // Under the capture's lock, so a finalize or discard is either before this or after it.
    const status = await lockCapture(tx, owner(actor), capture.id);
    if (status === null || status === "discarded") throw notFound();
    if (status !== "recording" && status !== "finishing")
      throw new ORPCError("CONFLICT", { message: "Capture is closed" });
    const known = await tx.meetingCaptureChunk.findUnique({
      where: { captureId_track_seq: key },
      select: { sha256: true },
    });
    if (known) {
      if (known.sha256 !== sha256)
        throw new ORPCError("CONFLICT", { message: "Chunk already stored with other content" });
      return;
    }
    await tx.meetingCaptureChunk.create({
      data: {
        ...owner(actor),
        ...key,
        startMs: input.startMs,
        endMs: input.endMs,
        sha256,
        text: input.text.trim(),
        status: "done",
      },
    });
    await tx.meetingCapture.updateMany({
      where: { id: capture.id, ...owner(actor) },
      data: { lastChunkAt: new Date() },
    });
  });
  return { ok: true };
}

export async function finishCapture(
  deps: MeetingCaptureDeps,
  actor: Actor,
  input: { captureId: string; endedAt: string; lostChunks?: number },
): Promise<{ ok: true }> {
  await deps.prisma.$transaction(async (tx) => {
    const status = await lockCapture(tx, owner(actor), input.captureId);
    if (status === null || status === "discarded") throw notFound();
    // Audio the client could not deliver makes the meeting partial; finalize keeps this error.
    const lost = input.lostChunks && status !== "done" && status !== "failed";
    if (status === "recording" || lost) {
      let endedAt: Date | undefined;
      if (status === "recording") {
        // The device clock can be off; keep the span between the server's start and now.
        const row = await tx.meetingCapture.findFirst({
          where: { id: input.captureId, ...owner(actor) },
          select: { startedAt: true },
        });
        if (!row) throw notFound();
        endedAt = new Date(
          Math.min(
            Math.max(new Date(input.endedAt).getTime(), row.startedAt.getTime()),
            Date.now(),
          ),
        );
      }
      await tx.meetingCapture.updateMany({
        where: { id: input.captureId, ...owner(actor) },
        data: {
          ...(endedAt ? { status: "finishing", endedAt } : {}),
          ...(lost ? { error: "part_not_transcribed" } : {}),
        },
      });
    }
  });
  // Safe to repeat: one queued job per capture, and finalizing twice stores one meeting.
  await deps.jobs.enqueue(
    meetingsCaptureFinalizeJob({ ...owner(actor), captureId: input.captureId }),
  );
  return { ok: true };
}

/**
 * Deletes the chunks and their audio. The capture row stays as "discarded" so a retry is a no-op.
 * One transaction: the audio's delete jobs are queued inside it, so an interrupted discard
 * changes nothing and a retry does it all.
 */
export async function discardCapture(
  deps: MeetingCaptureDeps,
  actor: Actor,
  captureId: string,
): Promise<{ ok: true }> {
  const keys = await deps.prisma.$transaction(async (tx) => {
    const status = await lockCapture(tx, owner(actor), captureId);
    if (status === null) throw notFound();
    if (status === "discarded") return [];
    if (status === "done" || status === "failed")
      throw new ORPCError("CONFLICT", { message: "Capture is already stored" });
    const chunks = await tx.meetingCaptureChunk.findMany({
      where: { captureId, ...owner(actor) },
      select: { blobKey: true },
    });
    const blobKeys = chunks.flatMap(({ blobKey }) => (blobKey ? [blobKey] : []));
    for (const key of blobKeys) await queueCaptureBlobDelete(deps.jobs, actor.spaceId, key);
    await tx.meetingCapture.updateMany({
      where: { id: captureId, ...owner(actor) },
      data: { status: "discarded" },
    });
    await tx.meetingCaptureChunk.deleteMany({ where: { captureId, ...owner(actor) } });
    return blobKeys;
  });
  for (const key of keys) await removeCaptureBlobNow(deps.artifacts, actor, key);
  return { ok: true };
}

export async function activeCapture(
  deps: MeetingCaptureDeps,
  actor: Actor,
): Promise<MeetingCaptureActive> {
  const capture = await deps.prisma.meetingCapture.findFirst({
    where: { ...owner(actor), status: { in: ["recording", "finishing"] } },
    orderBy: { startedAt: "desc" },
  });
  if (!capture) return null;
  return {
    captureId: capture.id,
    title: capture.title,
    engine: capture.engine as "device" | "server",
    tracks: capture.tracks as MeetingCaptureTrack[],
    status: capture.status as "recording" | "finishing",
    startedAt: capture.startedAt.toISOString(),
  };
}

const intParam = (value: string | undefined) =>
  value !== undefined && /^\d{1,9}$/.test(value) ? Number(value) : null;

/** Session-authenticated raw upload of one audio chunk. */
export function mountMeetingCaptureRoutes(
  app: Hono,
  deps: MeetingCaptureDeps,
  authenticate: (request: Request) => Promise<Actor | null>,
) {
  const { prisma, artifacts, jobs } = deps;
  app.post("/api/meeting-captures/:id/chunks", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const reject = (message: string, status: 400 | 404 | 409 | 413) => {
      cancelBody(c.req.raw.body);
      return c.json({ error: message }, status);
    };
    const capture = await prisma.meetingCapture.findFirst({
      where: { id: c.req.param("id"), ...owner(actor) },
    });
    if (!capture || capture.status === "discarded") return reject("Capture not found", 404);
    if (
      capture.engine !== "server" ||
      (capture.status !== "recording" && capture.status !== "finishing")
    )
      return reject("Capture does not take audio", 409);
    const track = MeetingCaptureTrackSchema.safeParse(c.req.query("track"));
    const seq = intParam(c.req.query("seq"));
    const startMs = intParam(c.req.query("startMs"));
    const endMs = intParam(c.req.query("endMs"));
    if (!track.success || !capture.tracks.includes(track.data)) return reject("Invalid track", 400);
    if (seq === null || startMs === null || endMs === null || endMs < startMs)
      return reject("Invalid seq, startMs or endMs", 400);

    const body = await readBody(c.req.raw, MEETING_CAPTURE_CHUNK_MAX_BYTES);
    if (!body) return c.json({ error: "Too large" }, 413);
    if (body.byteLength === 0) return c.json({ error: "Empty chunk" }, 400);

    const key = { captureId: capture.id, track: track.data, seq };
    const sha256 = sha256Of(body);
    // A retry (same position and bytes) answers the same; it queues transcription again in case
    // the first request stored the chunk and died before queueing. The same position with other
    // bytes is a client bug.
    const known = await prisma.meetingCaptureChunk.findUnique({
      where: { captureId_track_seq: key },
      select: { id: true, sha256: true, status: true },
    });
    const queue = (chunkId: string) =>
      jobs.enqueue(meetingsCaptureTranscribeJob({ ...owner(actor), chunkId }));
    if (known) {
      if (known.sha256 !== sha256)
        return c.json({ error: "Chunk already stored with other bytes" }, 409);
      if (known.status === "pending") await queue(known.id);
      return c.json({ stored: true }, 200);
    }

    const context = dataRoomBlobContext(actor, "meeting-capture.upload", c.req.raw.signal);
    const blob = await artifacts.put(
      { name: `capture-${seq}.bin`, mimeType: "application/octet-stream", bytes: body },
      context,
    );
    // Our blob is dropped durably when this upload does not become the chunk's audio.
    const dropBlob = async () => {
      await queueCaptureBlobDelete(jobs, actor.spaceId, blob.id);
      await removeCaptureBlobNow(artifacts, actor, blob.id);
    };
    let outcome:
      | { kind: "created"; id: string }
      | { kind: "known"; id: string; sha256: string; status: string }
      | { kind: "closed" };
    try {
      // Under the capture's lock: a discard or finalize is either before this or after it.
      outcome = await prisma.$transaction(async (tx) => {
        const status = await lockCapture(tx, owner(actor), capture.id);
        if (status !== "recording" && status !== "finishing") return { kind: "closed" as const };
        const winner = await tx.meetingCaptureChunk.findUnique({
          where: { captureId_track_seq: key },
          select: { id: true, sha256: true, status: true },
        });
        if (winner) return { kind: "known" as const, ...winner };
        const created = await tx.meetingCaptureChunk.create({
          data: { ...owner(actor), ...key, startMs, endMs, sha256, blobKey: blob.id },
          select: { id: true },
        });
        await tx.meetingCapture.updateMany({
          where: { id: capture.id, ...owner(actor) },
          data: { lastChunkAt: new Date() },
        });
        return { kind: "created" as const, id: created.id };
      });
    } catch (error) {
      await dropBlob();
      throw error;
    }
    if (outcome.kind === "closed") {
      await dropBlob();
      return c.json({ error: "Capture is closed" }, 409);
    }
    if (outcome.kind === "known") {
      // A concurrent upload won the position; ours is surplus either way.
      await dropBlob();
      if (outcome.sha256 !== sha256)
        return c.json({ error: "Chunk already stored with other bytes" }, 409);
      if (outcome.status === "pending") await queue(outcome.id);
      return c.json({ stored: true }, 200);
    }
    const chunkId = outcome.id;
    await queue(chunkId);
    return c.json({ stored: true }, 201);
  });
}
