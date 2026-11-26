import type { AdapterContext, ArtifactStore, JobPublisher, SecretStore } from "@rakazo/adapter-kit";
import { omiSortJob, omiTranscribeJob } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { dataRoomPreviewText } from "@rakazo/db";
import { dataRoomBlobContext } from "./data-room-files.js";
import { splitOggOpus } from "./omi-segments.js";
import { createTranscriptionProvider, MAX_TRANSCRIBE_BYTES } from "./voice-factory.js";
import { selectTranscriptionTarget } from "./voice-target.js";

export const NO_TRANSCRIPTION_PROVIDER = "no_transcription_provider";

export interface OmiTranscribeDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  secrets: SecretStore;
  /** Queues sorting after a transcript is saved. */
  jobs?: JobPublisher;
  /** For tests; defaults to the real provider factory. */
  createProvider?: typeof createTranscriptionProvider;
}

/** Failed attempts after which the item keeps the error instead of retrying. */
const MAX_FAILURES = 3;
export const TRANSCRIPTION_FAILED = "transcription_failed";

/**
 * One timestamp per segment, so sorting can cut a meeting out of a long recording. Providers charge
 * per audio minute, so the cost is the same. ponytail: a word cut at a boundary is lost or split.
 */
const SEGMENT_SECONDS = 60;

const mmss = (seconds: number) =>
  `[${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}]`;

/**
 * Transcribes one Omi recording and stores the text for preview and sorting (the item stays
 * `notIndexed`). Recordings hold other people's speech, so a provider is used only with consent;
 * without one the item gets the error `no_transcription_provider` and the job ends without retry.
 * Never logs audio or text.
 */
export async function runOmiTranscribe(
  deps: OmiTranscribeDeps,
  payload: { spaceId: string; userId: string; itemId: string },
): Promise<void> {
  const { prisma } = deps;
  const actor: Actor = {
    userId: payload.userId,
    spaceId: payload.spaceId,
    email: "",
    isDeploymentOwner: false,
  };
  const owned = { id: payload.itemId, spaceId: actor.spaceId, userId: actor.userId };
  const item = await prisma.dataRoomItem.findFirst({
    where: { ...owned, source: "omi", storageKey: { not: null } },
    select: { storageKey: true, text: { select: { text: true } } },
  });
  if (!item?.storageKey || item.text?.text) return;

  const save = (error: string | null, text?: string) =>
    prisma.$transaction(async (tx) => {
      const { count } = await tx.dataRoomItem.updateMany({
        where: owned,
        data: {
          error,
          ...(text === undefined ? {} : { previewText: dataRoomPreviewText(text), failures: 0 }),
        },
      });
      if (count === 1 && text !== undefined) {
        await tx.dataRoomItemText.upsert({
          where: { itemId: owned.id },
          create: { itemId: owned.id, spaceId: actor.spaceId, userId: actor.userId, text },
          update: { text },
        });
      }
    });

  const { target, consented } = await selectTranscriptionTarget(deps, actor);
  const provider =
    target && consented
      ? (deps.createProvider ?? createTranscriptionProvider)(target.provider)
      : null;
  if (!target || !provider) return void (await save(NO_TRANSCRIPTION_PROVIDER));

  const blobContext = dataRoomBlobContext(actor, "omi.transcribe");
  const context: AdapterContext = {
    operationId: `omi.transcribe:${owned.id}`,
    traceId: `omi.transcribe:${owned.id}`,
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: new AbortController().signal,
  };
  const segments = splitOggOpus(
    await deps.artifacts.get(item.storageKey, blobContext),
    SEGMENT_SECONDS,
  );
  const parts: string[] = [];
  for (const segment of segments) {
    if (segment.bytes.byteLength > MAX_TRANSCRIBE_BYTES) throw new Error("Segment is too large");
    let text: string;
    try {
      ({ text } = await provider.transcribe(
        { audio: segment.bytes, mimeType: "audio/ogg", apiKey: target.apiKey },
        context,
      ));
    } catch {
      // The provider's message may echo request details; keep only a short reason.
      await prisma.dataRoomItem.updateMany({ where: owned, data: { failures: { increment: 1 } } });
      const failed = await prisma.dataRoomItem.findFirst({
        where: owned,
        select: { failures: true },
      });
      if ((failed?.failures ?? 0) < MAX_FAILURES) throw new Error("Transcription failed");
      return void (await save(TRANSCRIPTION_FAILED));
    }
    if (text.trim()) parts.push(`${mmss(segment.startSeconds)} ${text.trim()}`);
  }
  await save(null, parts.join("\n\n"));
  await deps.jobs?.enqueue(omiSortJob({ ...payload }));
}

/** Queues transcription again for the user's recordings that were waiting for a provider. */
export async function requeueOmiTranscriptions(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  actor: Pick<Actor, "spaceId" | "userId">,
): Promise<void> {
  const items = await deps.prisma.dataRoomItem.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      source: "omi",
      // The pipeline can clear the error while the job waits, so an empty text counts too.
      OR: [
        { error: { in: [NO_TRANSCRIPTION_PROVIDER, TRANSCRIPTION_FAILED] } },
        { text: { is: null } },
        { text: { is: { text: "" } } },
      ],
    },
    select: { id: true },
  });
  await deps.prisma.dataRoomItem.updateMany({
    where: { id: { in: items.map((item) => item.id) } },
    data: { failures: 0 },
  });
  // A failed one stops counting as "not transcribed" while it is tried again; a new failure sets it back.
  await deps.prisma.dataRoomItem.updateMany({
    where: { id: { in: items.map((item) => item.id) }, error: TRANSCRIPTION_FAILED },
    data: { error: null },
  });
  for (const { id } of items) {
    await deps.jobs.enqueue(
      omiTranscribeJob({ spaceId: actor.spaceId, userId: actor.userId, itemId: id }),
    );
  }
}
