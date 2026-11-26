import type { RingNotification, RingStatus } from "./protocol";
import {
  INFO_COMMAND,
  parseNotification,
  RECORD_SIZE,
  Reassembler,
  readCommand,
  STOP_COMMAND,
} from "./protocol";

/** What the sync needs from the Bluetooth link; Web Bluetooth in the app, a fake in tests. */
export type RingTransport = {
  readStatus: () => Promise<RingStatus>;
  write: (bytes: Uint8Array) => Promise<void>;
  /** Calls `listener` for each notification until the returned function is called. */
  subscribe: (listener: (bytes: Uint8Array) => void) => () => void;
};

export type SyncResult = {
  /** "complete": the ring is drained (or only live recording keeps arriving). "paused": the link dropped, went quiet or was stopped. */
  outcome: "complete" | "paused";
  records: number;
};

type Options = {
  /** Called with each run of whole records. Awaited before the sync ends. */
  onRecords: (firstSeq: number, bytes: Uint8Array) => void | Promise<void>;
  onProgress?: (recordsDone: number, recordsTotal: number) => void;
  signal?: AbortSignal;
  /** Gives up on silence (default 15 s). */
  idleMs?: number;
  /** A ring with this many unread records or fewer, after a read, counts as drained (default 600, about a minute). */
  drainedRecords?: number;
};

/** Reads that bring no new record, in a row, before the sync gives up. */
const MAX_EMPTY_READS = 3;

/**
 * Reads everything unread from the pendant. The firmware ends each read at the write pointer it
 * saw when the read began (and may end it early with an error status), while the pendant keeps
 * recording. So this asks for the ring state again after every read and reads on from where it
 * stopped, until only a minute or so of live audio is left. The pendant frees records as it
 * delivers them, so every record handed to `onRecords` must be stored.
 */
export async function runSync(transport: RingTransport, options: Options): Promise<SyncResult> {
  const { onRecords, onProgress, signal, idleMs = 15000, drainedRecords = 600 } = options;
  const status = await transport.readStatus();
  if (status.unreadPackets === 0) return { outcome: "complete", records: 0 };

  let phase: (note: RingNotification) => void = () => undefined;
  const unsubscribe = transport.subscribe((bytes) => phase(parseNotification(bytes)));
  let records = 0;
  let nextSeq = 0;
  let chain: Promise<void> = Promise.resolve();
  let total = 0;

  /** Writes one command and feeds notifications to `onNote` until it calls `end`, or the link is quiet. */
  const exchange = <T>(
    command: Uint8Array,
    onNote: (note: RingNotification, end: (value: T) => void) => void,
  ) =>
    new Promise<T | null>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const end = (value: T | null) => {
        clearTimeout(timer);
        phase = () => undefined;
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      };
      const onAbort = () => end(null);
      const bump = () => {
        clearTimeout(timer);
        timer = setTimeout(() => end(null), idleMs);
      };
      phase = (note) => {
        bump();
        onNote(note, end);
      };
      signal?.addEventListener("abort", onAbort);
      bump();
      transport.write(command).catch((error: unknown) => {
        clearTimeout(timer);
        phase = () => undefined;
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      });
    });

  try {
    let empty = 0;
    let started = false;
    let tailRead = false;
    while (!signal?.aborted && empty < MAX_EMPTY_READS) {
      const ring = await exchange<Extract<RingNotification, { kind: "info" }>>(
        INFO_COMMAND,
        (note, end) => {
          if (note.kind === "info") end(note);
        },
      );
      if (!ring) {
        empty += 1;
        continue;
      }
      if (ring.packetBytes !== null && ring.packetBytes !== 0 && ring.packetBytes !== RECORD_SIZE) {
        break;
      }
      // The ring's own read pointer can lag behind what was already delivered, or jump ahead
      // when a full ring overwrote the oldest records.
      const start = started ? Math.max(ring.readSeq, nextSeq) : ring.readSeq;
      nextSeq = start;
      const unread = ring.writeSeq - start;
      if (!started) total = unread;
      // The last small amount is read once; more live audio after that is left for the next sync.
      if (unread <= 0 || (tailRead && unread <= drainedRecords)) {
        await chain;
        return { outcome: "complete", records };
      }
      if (unread <= drainedRecords) tailRead = true;
      started = true;
      total = Math.max(total, records + unread);

      const before = records;
      const reassembler = new Reassembler();
      const finished = await exchange<true>(readCommand(start, unread), (note, end) => {
        if (note.kind === "begin") {
          nextSeq = note.startSeq;
        } else if (note.kind === "data") {
          const whole = reassembler.push(note.bytes);
          if (whole.length === 0) return;
          const firstSeq = nextSeq;
          const count = whole.length / RECORD_SIZE;
          nextSeq += count;
          records += count;
          const copy = whole.slice();
          chain = chain.then(() => onRecords(firstSeq, copy));
          chain.catch(() => end(true));
          onProgress?.(records, total);
        } else if (note.kind === "done" || (note.kind === "ack" && note.status !== 0)) {
          end(true);
        }
      });
      // A read that went quiet may still be running on the pendant; stop it before the next one.
      if (finished === null) await transport.write(STOP_COMMAND).catch(() => undefined);
      await chain;
      empty = records > before ? 0 : empty + 1;
    }
    await chain;
    return { outcome: "paused", records };
  } finally {
    unsubscribe();
    await chain.catch(() => undefined);
  }
}
