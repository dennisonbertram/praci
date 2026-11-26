import type { RecordStore } from "./buffer";
import { UPLOAD_BATCH_BYTES } from "./buffer";
import { framesInRecord, progressMinutes, RECORD_SIZE } from "./protocol";
import type { RingTransport, SyncResult } from "./sync";
import { runSync } from "./sync";

/** Minutes of audio between server-side assembly runs during one long download. */
const ASSEMBLE_EVERY_MIN = 10;

type Session = {
  transport: RingTransport;
  store: RecordStore;
  codec: number;
  rtcValid: boolean;
  frameMs: number;
  /** Uploads every stored record in seq order and deletes each after the server accepted it. */
  upload: () => Promise<number>;
  /** Asks the server to turn uploaded records into recordings. Safe to repeat. */
  assemble: () => Promise<void>;
  /** The server holds uploads that no assembly has handled yet. */
  hadPending: boolean;
  signal?: AbortSignal;
  idleMs?: number;
  onProgress?: (progress: { done: number; total: number | null }) => void;
};

/**
 * One pass over the pendant. Records go to the browser's store as they arrive, and to the server
 * about every 256 KB, so hours of audio are never held only in the browser. The server is asked
 * to assemble every ~10 minutes of audio and once more at the end, however the download ended.
 */
export async function downloadSession(session: Session): Promise<SyncResult> {
  const { store, upload, assemble, codec, rtcValid, frameMs } = session;
  let frames = 0;
  let sinceUpload = 0;
  let uploadedAny = false;
  let midRunFailed = false;
  let assembledAtMin = 0;
  const minutes = () => (frames * frameMs) / 60000;

  const finish = async () => {
    // A failed final upload throws and leaves the records in the store for the next sync.
    uploadedAny = (await upload()) > 0 || uploadedAny;
    if (uploadedAny || session.hadPending) await assemble().catch(() => undefined);
  };

  let result: SyncResult;
  try {
    result = await runSync(session.transport, {
      signal: session.signal,
      idleMs: session.idleMs,
      onRecords: async (firstSeq, bytes) => {
        const batch = [];
        for (let at = 0; at < bytes.length; at += RECORD_SIZE) {
          const record = bytes.slice(at, at + RECORD_SIZE);
          frames += framesInRecord(record);
          batch.push({ seq: firstSeq + at / RECORD_SIZE, bytes: record, codec, rtcValid });
        }
        await store.put(batch);
        sinceUpload += bytes.length;
        if (midRunFailed || sinceUpload < UPLOAD_BATCH_BYTES) return;
        sinceUpload = 0;
        try {
          uploadedAny = (await upload()) > 0 || uploadedAny;
          if (uploadedAny && minutes() - assembledAtMin >= ASSEMBLE_EVERY_MIN) {
            assembledAtMin = minutes();
            await assemble().catch(() => undefined);
          }
        } catch {
          // The records stay in the store; the final upload reports the failure.
          midRunFailed = true;
        }
      },
      onProgress: (done, total) => {
        session.onProgress?.(progressMinutes(done, total, frames, frameMs));
      },
    });
  } catch (error) {
    await finish().catch(() => undefined);
    throw error;
  }
  await finish();
  return result;
}
