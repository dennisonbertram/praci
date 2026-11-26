/** Omi pendant storage records: parse, split into recordings, and mux to Ogg Opus. No I/O. */

/** A stored record: a 4-byte big-endian timestamp, then 440 bytes of (size, frame) pairs. */
export const OMI_RECORD_BYTES = 444;
/** Opus pre-skip at 48 kHz, the usual encoder delay. */
const PRE_SKIP = 312;
const SERIAL = 0x6f6d6931;

export interface OmiRecord {
  seq: number;
  /** Seconds, from the pendant's clock (Unix time only when its RTC was valid). */
  timestamp: number;
  frames: Uint8Array[];
}

export interface OmiRecording {
  firstSeq: number;
  lastSeq: number;
  /** Timestamp of the first record, in seconds. */
  timestamp: number;
  frames: Uint8Array[];
  durationMs: number;
}

/** Omi's codec byte: 20 is 10 ms Opus frames, 21 is 20 ms. */
export function omiFrameMs(codec: number): number | null {
  return codec === 21 ? 20 : codec === 20 ? 10 : null;
}

export function parseRecords(bytes: Uint8Array, firstSeq: number): OmiRecord[] {
  if (bytes.byteLength === 0 || bytes.byteLength % OMI_RECORD_BYTES !== 0) {
    throw new Error("Record data must be a whole number of 444-byte records");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records: OmiRecord[] = [];
  for (let at = 0, seq = firstSeq; at < bytes.byteLength; at += OMI_RECORD_BYTES, seq += 1) {
    const frames: Uint8Array[] = [];
    const end = at + OMI_RECORD_BYTES;
    for (let pos = at + 4; pos < end; ) {
      const size = bytes[pos] ?? 0;
      if (size === 0 || pos + 1 + size > end) break;
      frames.push(bytes.slice(pos + 1, pos + 1 + size));
      pos += 1 + size;
    }
    records.push({ seq, timestamp: view.getUint32(at, false), frames });
  }
  return records;
}

/**
 * Starts a new recording where a record begins more than `gapSeconds` after the last one ended, or
 * once the recording holds `maxMs` of audio.
 */
export function splitRecordings(
  records: OmiRecord[],
  options: { gapSeconds: number; frameMs: number; maxMs?: number },
): OmiRecording[] {
  const out: OmiRecording[] = [];
  let currentEnd = 0;
  for (const record of [...records].sort((a, b) => a.seq - b.seq)) {
    const last = out[out.length - 1];
    if (
      !last ||
      record.timestamp - currentEnd > options.gapSeconds ||
      last.durationMs >= (options.maxMs ?? Number.POSITIVE_INFINITY)
    ) {
      out.push({
        firstSeq: record.seq,
        lastSeq: record.seq,
        timestamp: record.timestamp,
        frames: [],
        durationMs: 0,
      });
    }
    const recording = out[out.length - 1] as OmiRecording;
    recording.lastSeq = record.seq;
    for (const frame of record.frames) recording.frames.push(frame);
    recording.durationMs = recording.frames.length * options.frameMs;
    currentEnd = recording.timestamp + recording.durationMs / 1000;
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let r = i << 24;
    for (let bit = 0; bit < 8; bit += 1) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    table[i] = r >>> 0;
  }
  return table;
})();

/** Ogg's CRC: polynomial 0x04c11db7, not reflected, zero start and no final xor. */
export function oggCrc(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes)
    crc = ((crc << 8) ^ (CRC_TABLE[((crc >>> 24) ^ byte) & 0xff] as number)) >>> 0;
  return crc;
}

function page(flags: number, granule: number, seq: number, packets: Uint8Array[]): Uint8Array {
  const lacing: number[] = [];
  for (const packet of packets) {
    for (let left = packet.byteLength; ; left -= 255) {
      lacing.push(Math.min(left, 255));
      if (left < 255) break;
    }
  }
  const body = packets.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(27 + lacing.length + body);
  const view = new DataView(out.buffer);
  out.set([0x4f, 0x67, 0x67, 0x53, 0, flags]);
  view.setBigUint64(6, BigInt(granule), true);
  view.setUint32(14, SERIAL, true);
  view.setUint32(18, seq, true);
  out[26] = lacing.length;
  out.set(lacing, 27);
  let at = 27 + lacing.length;
  for (const packet of packets) {
    out.set(packet, at);
    at += packet.byteLength;
  }
  view.setUint32(22, oggCrc(out), true);
  return out;
}

const text = (value: string) => new TextEncoder().encode(value);

export function muxOggOpus(
  frames: Uint8Array[],
  options: { sampleRate: number; frameMs: number },
): Uint8Array {
  const head = new Uint8Array(19);
  head.set(text("OpusHead"));
  head[8] = 1;
  head[9] = 1;
  const headView = new DataView(head.buffer);
  headView.setUint16(10, PRE_SKIP, true);
  headView.setUint32(12, options.sampleRate, true);
  const vendor = text("praci");
  const tags = new Uint8Array(8 + 4 + vendor.byteLength + 4);
  tags.set(text("OpusTags"));
  new DataView(tags.buffer).setUint32(8, vendor.byteLength, true);
  tags.set(vendor, 12);

  const pages = [page(0x02, 0, 0, [head]), page(0, 0, 1, [tags])];
  const perPage = Math.max(1, Math.round(1000 / options.frameMs));
  const samplesPerFrame = (options.frameMs * 48000) / 1000;
  for (let i = 0; i < frames.length; i += perPage) {
    const slice = frames.slice(i, i + perPage);
    const last = i + perPage >= frames.length;
    pages.push(page(last ? 0x04 : 0, (i + slice.length) * samplesPerFrame, pages.length, slice));
  }
  const out = new Uint8Array(pages.reduce((n, p) => n + p.byteLength, 0));
  let at = 0;
  for (const p of pages) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}
