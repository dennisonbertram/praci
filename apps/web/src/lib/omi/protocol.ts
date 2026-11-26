/** Omi pendant Bluetooth protocol (ring-buffer firmware 3.0.20 and later). Pure functions only. */

export const UUID = {
  omi: "19b10000-e8f2-537e-4f6c-d104768a1214",
  codec: "19b10002-e8f2-537e-4f6c-d104768a1214",
  storage: "30295780-4301-eabd-2904-2849adfeae43",
  storageCommand: "30295781-4301-eabd-2904-2849adfeae43",
  storageStatus: "30295782-4301-eabd-2904-2849adfeae43",
  battery: 0x180f,
  deviceInfo: 0x180a,
  model: 0x2a24,
  firmware: 0x2a26,
  hardware: 0x2a27,
} as const;

export const RECORD_SIZE = 444;
const AUDIO_BYTES = RECORD_SIZE - 4;

/** Firmware 3.0.20 or later stores audio in the ring buffer this module reads. */
export function isRingBufferFirmware(version: string | null | undefined): boolean {
  if (!version || version === "Unknown") return false;
  const parts = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  if (parts.length < 3) return false;
  const [major = 0, minor = 0, patch = 0] = parts;
  if (major !== 3) return major > 3;
  return minor > 0 || patch >= 20;
}

/** Codec byte to Opus frame length in ms; null for a codec this module cannot read. */
export function codecFrameMs(codec: number): number | null {
  return codec === 20 ? 10 : codec === 21 ? 20 : null;
}

export type RingStatus = {
  usedBytes: number;
  unreadPackets: number;
  freeBytes: number;
  rtcValid: boolean;
};

/** The 16-byte status read: four little-endian u32 values. */
export function parseStatus(view: DataView): RingStatus | null {
  if (view.byteLength < 16) return null;
  return {
    usedBytes: view.getUint32(0, true),
    unreadPackets: view.getUint32(4, true),
    freeBytes: view.getUint32(8, true),
    rtcValid: view.getUint32(12, true) !== 0,
  };
}

export type RingNotification =
  | { kind: "ack"; status: number }
  | {
      kind: "info";
      readSeq: number;
      writeSeq: number;
      /** Bytes per ring packet (offset 29); null when the notification is the short form. */
      packetBytes: number | null;
      /** Packets the full ring overwrote before they were read (offset 21); null when absent. */
      droppedPackets: number | null;
    }
  | { kind: "data"; bytes: Uint8Array }
  | { kind: "done"; status: number; nextSeq: number }
  | { kind: "begin"; startSeq: number; count: number }
  | { kind: "other" };

/** Decodes one notification on the storage command characteristic. Multi-byte fields are big-endian. */
export function parseNotification(bytes: Uint8Array): RingNotification {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  switch (bytes[0]) {
    case 0x01:
      return bytes.length >= 2 ? { kind: "ack", status: bytes[1] ?? 0 } : { kind: "other" };
    case 0x02:
      return bytes.length >= 17
        ? {
            kind: "info",
            readSeq: Number(view.getBigUint64(1)),
            writeSeq: Number(view.getBigUint64(9)),
            packetBytes: bytes.length >= 31 ? view.getUint16(29) : null,
            droppedPackets: bytes.length >= 29 ? Number(view.getBigUint64(21)) : null,
          }
        : { kind: "other" };
    case 0x03:
      return { kind: "data", bytes: bytes.subarray(1) };
    case 0x04:
      return bytes.length >= 10
        ? {
            kind: "done",
            status: bytes[1] ?? 0,
            nextSeq: Number(view.getBigUint64(2)),
          }
        : { kind: "other" };
    case 0x05:
      return bytes.length >= 13
        ? {
            kind: "begin",
            startSeq: Number(view.getBigUint64(1)),
            count: view.getUint32(9),
          }
        : { kind: "other" };
    default:
      return { kind: "other" };
  }
}

export const INFO_COMMAND = Uint8Array.of(0x10);
export const STOP_COMMAND = Uint8Array.of(0x03);

/** `[0x11][start_seq u64 BE][count u32 BE]`. */
export function readCommand(startSeq: number, count: number): Uint8Array {
  const out = new Uint8Array(13);
  const view = new DataView(out.buffer);
  out[0] = 0x11;
  view.setBigUint64(1, BigInt(startSeq));
  view.setUint32(9, count);
  return out;
}

/** Joins data chunks, which do not end on record boundaries, into whole 444-byte records. */
export class Reassembler {
  private buffer = new Uint8Array(0);

  /** Adds a chunk and returns the bytes of the whole records it completed (empty when none). */
  push(chunk: Uint8Array): Uint8Array {
    const joined = new Uint8Array(this.buffer.length + chunk.length);
    joined.set(this.buffer);
    joined.set(chunk, this.buffer.length);
    const whole = joined.length - (joined.length % RECORD_SIZE);
    this.buffer = joined.slice(whole);
    return joined.subarray(0, whole);
  }
}

/** Opus frames in one record: the 440-byte payload is `[size][frame]...` with zero padding. */
export function framesInRecord(record: Uint8Array): number {
  const audio = record.subarray(4, RECORD_SIZE);
  let frames = 0;
  let offset = 0;
  while (offset < AUDIO_BYTES - 1) {
    const size = audio[offset] ?? 0;
    if (size === 0) {
      offset += 1;
      continue;
    }
    if (offset + 1 + size >= AUDIO_BYTES) break;
    frames += 1;
    offset += size + 1;
  }
  return frames;
}

/**
 * Minutes downloaded and the estimated total (unrounded, so callers can tell under a minute), from the frames seen so far. The total is null until a
 * record has arrived, because a record's length in time depends on how the audio compressed.
 */
export function progressMinutes(
  recordsDone: number,
  recordsTotal: number,
  framesDone: number,
  frameMs: number,
): { done: number; total: number | null } {
  const done = (framesDone * frameMs) / 60000;
  if (recordsDone === 0 || recordsTotal === 0) return { done, total: null };
  const total = done * (recordsTotal / recordsDone);
  return { done, total: Math.max(total, done) };
}
