import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { omiAssembleJob, omiTranscribeJob } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { OMI_CONNECTOR_ID } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos } from "@rakazo/db";
import { createFileDataRoomItem, dataRoomBlobContext } from "./data-room-files.js";
import type { OmiRecord } from "./omi-records.js";
import { muxOggOpus, omiFrameMs, parseRecords, splitRecordings } from "./omi-records.js";

export interface OmiAssembleDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** `Recording 29 Oct 09:14`, in UTC. */
export function omiRecordingName(start: Date): string {
  return `Recording ${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]} ${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`;
}

/** Records one assembly job reads: about an hour of audio, so memory and time stay bounded. */
export const OMI_BATCH_RECORDS = 36000;
/** A recording never holds more than this; a longer stretch becomes consecutive recordings. */
export const OMI_MAX_RECORDING_MS = 60 * 60 * 1000;

/**
 * Turns the connection's unassembled uploads into Ogg Opus items in "Omi/Audio", oldest first, one
 * batch of about an hour of audio per run. If uploads remain it queues itself again.
 *
 * Safe to run again and after a crash. For each batch the order is: file every recording, mark the
 * uploads assembled, delete their raw blobs. A recording's external id ends with its last sequence
 * number, so a re-run that finds it already filed skips what it holds and files only records after
 * it (for example audio that arrived after a crash).
 * ponytail: recordings are closed at the end of each batch, so a recording that spans two batches
 * becomes two items; extend the previous one while it is still untranscribed if that matters.
 * Overlap between uploads of different batches (a resend after a dropped link) is not removed.
 */
export async function runOmiAssemble(
  deps: OmiAssembleDeps,
  payload: { spaceId: string; userId: string; connectionId: string },
): Promise<void> {
  const actor: Actor = {
    userId: payload.userId,
    spaceId: payload.spaceId,
    email: "",
    isDeploymentOwner: false,
  };
  const { prisma, artifacts } = deps;
  const connection = await prisma.connection.findFirst({
    where: {
      id: payload.connectionId,
      spaceId: actor.spaceId,
      userId: actor.userId,
      connectorId: OMI_CONNECTOR_ID,
    },
    select: { id: true },
  });
  if (!connection) return;
  const uploads = await prisma.omiUpload.findMany({
    where: { connectionId: connection.id, assembledAt: null },
    orderBy: [{ receivedAt: "asc" }, { firstSeq: "asc" }],
  });
  if (uploads.length === 0) return;

  const repo = createDataRoomRepos(prisma);
  const filing = createFileDataRoomItem(deps, repo);
  const ctx = dataRoomBlobContext(actor, "omi.assemble");
  const folderId = await filing.folderAt(actor, null, ["Omi", "Audio"], [], "agent");

  // Uploads with the same codec and clock state make one stream; a change starts a new one, and
  // so does a sequence number that goes back (the pendant's counter restarted). A resend that
  // starts inside the previous upload overlaps it and stays in the stream. A stream is cut into
  // batches of about an hour of audio.
  type Upload = (typeof uploads)[number];
  const batches: Upload[][] = [];
  let open: { batch: Upload[]; records: number } | null = null;
  for (const upload of uploads) {
    const batch = open?.batch;
    const first = batch?.[0];
    const prev = batch?.[batch.length - 1];
    if (
      open &&
      first &&
      prev &&
      open.records < OMI_BATCH_RECORDS &&
      first.codec === upload.codec &&
      first.rtcValid === upload.rtcValid &&
      upload.firstSeq > prev.firstSeq
    ) {
      open.batch.push(upload);
      open.records += upload.recordCount;
    } else {
      open = { batch: [upload], records: upload.recordCount };
      batches.push(open.batch);
    }
  }

  let processed = 0;
  let done = 0;
  for (const run of batches) {
    if (processed >= OMI_BATCH_RECORDS) break;
    const first = run[0] as Upload;
    const last = run[run.length - 1] as Upload;
    const frameMs = omiFrameMs(first.codec);
    if (frameMs) {
      const records: OmiRecord[] = [];
      let lastSeq = -1;
      for (const upload of run) {
        for (const record of parseRecords(
          await artifacts.get(upload.storageKey, ctx),
          Number(upload.firstSeq),
        )) {
          if (record.seq > lastSeq) records.push(record);
          lastSeq = Math.max(lastSeq, record.seq);
        }
      }
      const options = { gapSeconds: 120, frameMs, maxMs: OMI_MAX_RECORDING_MS };
      const runEnd = Math.max(
        ...splitRecordings(records, options).map((r) => r.timestamp + r.durationMs / 1000),
      );
      const queue = [records];
      for (let todo = queue.pop(); todo; todo = queue.pop()) {
        for (const recording of splitRecordings(todo, options)) {
          // The upload holding the recording's first record names it, so a restarted counter
          // never collides with an older recording of the same sequence number.
          const holder = run.find(
            (u) =>
              Number(u.firstSeq) <= recording.firstSeq &&
              recording.firstSeq < Number(u.firstSeq) + u.recordCount,
          ) as Upload;
          const prefix = `omi:${recording.firstSeq}:${holder.sha256.slice(0, 12)}`;
          const filed = await prisma.dataRoomItem.findMany({
            where: {
              spaceId: actor.spaceId,
              userId: actor.userId,
              sourceConnectionId: connection.id,
              externalId: { startsWith: prefix },
            },
            select: { externalId: true },
          });
          // An id without a last sequence number was filed whole.
          const covered = Math.max(
            -1,
            ...filed.map((f) => {
              const end = (f.externalId ?? "").split(":")[3];
              return end === undefined ? recording.lastSeq : Number(end);
            }),
          );
          if (covered >= recording.lastSeq) continue;
          if (covered >= recording.firstSeq) {
            queue.push(todo.filter((r) => r.seq > covered && r.seq <= recording.lastSeq));
            continue;
          }
          // Without a valid pendant clock the timestamps only order records: place the newest
          // recording's end at the time of upload and the others relative to it.
          const start = first.rtcValid
            ? new Date(recording.timestamp * 1000)
            : new Date(last.receivedAt.getTime() - (runEnd - recording.timestamp) * 1000);
          const { item, created } = await filing.storeAndFile(actor, {
            content: { bytes: muxOggOpus(recording.frames, { sampleRate: 16000, frameMs }) },
            name: omiRecordingName(start),
            mimeType: "audio/ogg",
            folderId,
            source: "omi",
            sourceConnectionId: connection.id,
            externalId: `${prefix}:${recording.lastSeq}`,
            sourceUpdatedAt: start,
            notIndexed: true,
            ready: true,
          });
          if (created && item) {
            await deps.jobs.enqueue(
              omiTranscribeJob({ spaceId: actor.spaceId, userId: actor.userId, itemId: item.id }),
            );
          }
        }
      }
    }
    // Filed first, then marked, then the raw blobs go: a crash in between loses nothing.
    await prisma.omiUpload.updateMany({
      where: { id: { in: run.map((u) => u.id) } },
      data: { assembledAt: new Date() },
    });
    for (const upload of run) await filing.dropBlob(actor, upload.storageKey);
    processed += run.reduce((n, u) => n + u.recordCount, 0);
    done += 1;
  }
  if (done < batches.length) {
    await deps.jobs.enqueue(
      omiAssembleJob({ spaceId: actor.spaceId, userId: actor.userId, connectionId: connection.id }),
    );
  }
}
