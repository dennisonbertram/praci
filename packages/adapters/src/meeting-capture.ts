import type { AdapterContext, ArtifactStore, JobPublisher, SecretStore } from "@rakazo/adapter-kit";
import {
  dataRoomBlobDeleteJob,
  meetingsCaptureFinalizeJob,
  meetingsDigestJob,
} from "@rakazo/adapter-kit";
import type { Actor, MeetingTranscriptLine, SourceMeeting } from "@rakazo/contracts";
import { MEETING_TRANSCRIPT_MAX_BYTES, MEETING_TRUNCATION_MARKER } from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { upsertMeeting } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { dataRoomBlobContext } from "./data-room-files.js";
import { createTranscriptionProvider } from "./voice-factory.js";
import { selectTranscriptionTarget } from "./voice-target.js";

/** A capture that sent nothing for this long is finished with what arrived. */
export const CAPTURE_ABANDONED_MS = 30 * 60_000;
const MAX_ATTEMPTS = 3;
export const CAPTURE_PROVIDER = "praci";

type Owner = { spaceId: string; userId: string };

/** The audio type from its first bytes; the route stores bytes only. */
export function sniffAudioMime(bytes: Uint8Array): string {
  const at = (i: number, text: string) =>
    text.split("").every((c, j) => bytes[i + j] === c.charCodeAt(0));
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3)
    return "audio/webm";
  if (at(4, "ftyp")) return "audio/mp4";
  if (at(0, "OggS")) return "audio/ogg";
  if (at(0, "RIFF")) return "audio/wav";
  return "audio/webm";
}

/**
 * Queues the blob's deletion. Call it before the last reference to the blob is dropped, so an
 * interruption leaves a delete job and a harmless duplicate, never an orphan. Throws if not queued.
 */
export function queueCaptureBlobDelete(
  jobs: JobPublisher,
  spaceId: string,
  key: string,
): Promise<void> {
  return jobs.enqueue(dataRoomBlobDeleteJob(spaceId, key));
}

/** Best-effort immediate removal after the delete job is queued; the job is the guarantee. */
export async function removeCaptureBlobNow(
  artifacts: ArtifactStore,
  actor: Pick<Actor, "spaceId" | "userId">,
  key: string,
): Promise<void> {
  await artifacts
    .remove(key, dataRoomBlobContext(actor as Actor, "meeting-capture.cleanup"))
    .catch(() => undefined);
}

type Tx = Pick<Prisma.TransactionClient, "$queryRaw">;

/**
 * Locks the caller's capture row until the transaction ends and returns its status, or null when
 * it is not theirs. Every path that changes a capture or its chunks starts with this.
 */
export async function lockCapture(
  tx: Tx,
  owner: { spaceId: string; userId: string },
  captureId: string,
): Promise<string | null> {
  const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM meeting_captures
    WHERE id = ${captureId} AND "spaceId" = ${owner.spaceId} AND "userId" = ${owner.userId}
    FOR UPDATE`;
  return rows[0]?.status ?? null;
}

export interface CaptureTranscribeDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  secrets: SecretStore;
  jobs: JobPublisher;
  /** For tests; defaults to the real provider factory. */
  createProvider?: typeof createTranscriptionProvider;
}

/** Queues finalize when the capture is finishing and none of its chunks is still pending. */
async function finalizeIfSettled(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  owner: Owner,
  captureId: string,
) {
  const [capture, pending] = await Promise.all([
    deps.prisma.meetingCapture.findFirst({
      where: { id: captureId, ...owner },
      select: { status: true },
    }),
    deps.prisma.meetingCaptureChunk.count({ where: { captureId, ...owner, status: "pending" } }),
  ]);
  if (capture?.status === "finishing" && pending === 0)
    await deps.jobs.enqueue(meetingsCaptureFinalizeJob({ ...owner, captureId }));
}

/**
 * Transcribes one chunk with the user's provider, keeps only the text, and deletes the audio.
 * A provider is used only with consent. Never logs audio or text; errors carry a short reason.
 */
export async function runCaptureTranscribe(
  deps: CaptureTranscribeDeps,
  payload: Owner & { chunkId: string },
): Promise<void> {
  const { prisma } = deps;
  const owner = { spaceId: payload.spaceId, userId: payload.userId };
  const chunk = await prisma.meetingCaptureChunk.findFirst({
    where: { id: payload.chunkId, ...owner, status: "pending", blobKey: { not: null } },
  });
  if (!chunk?.blobKey) return;
  const actor: Actor = { ...owner, email: "", isDeploymentOwner: false };

  // Only a pending chunk is settled, so a second worker never overwrites a finished one. The
  // delete job is queued first: the blob key is dropped only once its deletion is durable.
  const settle = async (data: { status: "done" | "failed"; text?: string }) => {
    await queueCaptureBlobDelete(deps.jobs, owner.spaceId, chunk.blobKey as string);
    const { count } = await prisma.meetingCaptureChunk.updateMany({
      where: { id: chunk.id, ...owner, status: "pending" },
      data: { ...data, blobKey: null },
    });
    await removeCaptureBlobNow(deps.artifacts, owner, chunk.blobKey as string);
    if (count) await finalizeIfSettled(deps, owner, chunk.captureId);
  };

  const { target, consented } = await selectTranscriptionTarget(deps, actor);
  const provider =
    target && consented
      ? (deps.createProvider ?? createTranscriptionProvider)(target.provider)
      : null;
  if (!target || !provider) return void (await settle({ status: "failed" }));

  const context: AdapterContext = {
    operationId: `meetings.capture_transcribe:${chunk.id}`,
    traceId: `meetings.capture_transcribe:${chunk.id}`,
    ...owner,
    signal: new AbortController().signal,
  };
  let text: string;
  try {
    const bytes = await deps.artifacts.get(
      chunk.blobKey,
      dataRoomBlobContext(actor, "meeting-capture.transcribe"),
    );
    ({ text } = await provider.transcribe(
      { audio: bytes, mimeType: sniffAudioMime(bytes), apiKey: target.apiKey },
      context,
    ));
  } catch {
    // The provider's message may echo request details; keep only a short reason.
    const attempts = chunk.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) return void (await settle({ status: "failed" }));
    await prisma.meetingCaptureChunk.updateMany({
      where: { id: chunk.id, ...owner, status: "pending" },
      data: { attempts },
    });
    throw new Error("Transcription failed");
  }
  await settle({ status: "done", text: text.trim() });
}

const timeLabel = (at: Date) =>
  `Meeting ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;

/** Lines in time order across tracks, microphone lines under the user's name. */
function transcriptOf(
  chunks: Array<{
    track: string;
    seq: number;
    startMs: number;
    endMs: number;
    text: string | null;
  }>,
  startedAt: Date,
  name: string,
): MeetingTranscriptLine[] | null {
  const lines: MeetingTranscriptLine[] = [];
  let bytes = 0;
  const ordered = chunks
    .filter((chunk) => chunk.text)
    .sort(
      (a, b) =>
        a.startMs - b.startMs ||
        a.endMs - b.endMs ||
        a.track.localeCompare(b.track) ||
        a.seq - b.seq,
    );
  for (const chunk of ordered) {
    const speaker = chunk.track === "microphone" ? name : "Them";
    const text = chunk.text as string;
    bytes += Buffer.byteLength(speaker) + Buffer.byteLength(text) + 2;
    if (bytes > MEETING_TRANSCRIPT_MAX_BYTES) {
      lines.push({ text: MEETING_TRUNCATION_MARKER.trim() });
      break;
    }
    lines.push({ speaker, text, at: new Date(startedAt.getTime() + chunk.startMs).toISOString() });
  }
  return lines.length ? lines : null;
}

/**
 * Stores a finishing capture as one meeting and queues its digest, all under the capture's lock:
 * a late append is either already in the chunks read here or is refused afterwards. Waits
 * (returns) while chunks are pending; the last transcription queues it again. A pending chunk
 * idle past the abandon window counts as failed. The meeting's text is the only copy kept: chunk
 * text is cleared. Only a `finishing` capture is finalized, so a discarded or stored one is left
 * alone and a repeat does nothing.
 */
export async function runCaptureFinalize(
  deps: { prisma: PrismaClient; jobs: JobPublisher; artifacts?: ArtifactStore },
  payload: Owner & { captureId: string },
  now = new Date(),
): Promise<void> {
  const { prisma } = deps;
  const owner = { spaceId: payload.spaceId, userId: payload.userId };
  const removed: string[] = [];
  await prisma.$transaction(
    async (tx) => {
      if ((await lockCapture(tx, owner, payload.captureId)) !== "finishing") return;
      const capture = await tx.meetingCapture.findFirstOrThrow({
        where: { id: payload.captureId, ...owner },
      });
      const chunks = await tx.meetingCaptureChunk.findMany({
        where: { captureId: capture.id, ...owner },
      });
      const pending = chunks.filter((chunk) => chunk.status === "pending");
      if (pending.length > 0) {
        if (now.getTime() - capture.updatedAt.getTime() < CAPTURE_ABANDONED_MS) return;
        for (const chunk of pending) {
          if (chunk.blobKey) {
            await queueCaptureBlobDelete(deps.jobs, owner.spaceId, chunk.blobKey);
            removed.push(chunk.blobKey);
          }
        }
        await tx.meetingCaptureChunk.updateMany({
          where: { captureId: capture.id, ...owner, status: "pending" },
          data: { status: "failed", blobKey: null },
        });
        for (const chunk of chunks)
          if (chunk.status === "pending") Object.assign(chunk, { status: "failed" });
      }

      const endedAt = capture.endedAt ?? capture.lastChunkAt ?? now;
      let meetingId: string | null = null;
      if (chunks.length > 0) {
        const user = await tx.user.findUnique({
          where: { id: owner.userId },
          select: { name: true, email: true, emailVerified: true },
        });
        if (!user) throw new Error("Capture owner not found");
        const meeting: SourceMeeting = {
          externalId: capture.id,
          title: capture.title?.trim() || timeLabel(capture.startedAt),
          startedAt: capture.startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          attendees: [{ name: user.name, ...(user.emailVerified ? { email: user.email } : {}) }],
          organizerEmail: null,
          sourceUrl: null,
          folders: [],
          summary: "",
          privateNotes: "",
          transcript: transcriptOf(chunks, capture.startedAt, user.name),
          updatedAt: now.toISOString(),
        };
        const outcome = await upsertMeeting(tx, owner, null, CAPTURE_PROVIDER, meeting);
        if (outcome !== "tombstoned") {
          meetingId =
            (
              await tx.meeting.findFirst({
                where: { ...owner, provider: CAPTURE_PROVIDER, externalId: capture.id },
                select: { id: true },
              })
            )?.id ?? null;
        }
      }
      // Queued inside the transaction: if it fails, nothing is marked done and a retry redoes it.
      if (meetingId) await deps.jobs.enqueue(meetingsDigestJob({ ...owner, meetingId }));
      // The meeting holds the text now; chunks keep status and offsets for `partial`.
      await tx.meetingCaptureChunk.updateMany({
        where: { captureId: capture.id, ...owner },
        data: { text: null },
      });
      await tx.meetingCapture.updateMany({
        where: { id: capture.id, ...owner },
        data: {
          status: "done",
          meetingId,
          endedAt,
          ...(chunks.some((chunk) => chunk.status === "failed")
            ? { error: "part_not_transcribed" }
            : {}),
        },
      });
    },
    { timeout: 30_000 },
  );
  if (deps.artifacts)
    for (const key of removed) await removeCaptureBlobNow(deps.artifacts, owner, key);
}

/**
 * Finishes captures that stopped sending: a recording with no chunk for 30 minutes, and a
 * finishing capture that has not moved for as long. System-wide, so it runs as the system.
 */
export async function runCaptureSweep(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  now = new Date(),
): Promise<number> {
  const before = new Date(now.getTime() - CAPTURE_ABANDONED_MS);
  const rows = await deps.prisma.meetingCapture.findMany({
    where: {
      OR: [
        { status: "recording", lastChunkAt: { lt: before } },
        { status: "recording", lastChunkAt: null, startedAt: { lt: before } },
        { status: "finishing", updatedAt: { lt: before } },
      ],
    },
    select: {
      id: true,
      spaceId: true,
      userId: true,
      status: true,
      lastChunkAt: true,
      startedAt: true,
    },
    take: 200,
  });
  for (const row of rows) {
    const owner = { spaceId: row.spaceId, userId: row.userId };
    if (row.status === "recording") {
      await deps.prisma.meetingCapture.updateMany({
        where: { id: row.id, status: "recording" },
        data: { status: "finishing", endedAt: row.lastChunkAt ?? row.startedAt },
      });
    }
    await deps.jobs.enqueue(meetingsCaptureFinalizeJob({ ...owner, captureId: row.id }));
  }
  return rows.length;
}
