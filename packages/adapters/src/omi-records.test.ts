import { describe, expect, it } from "vitest";
import { muxOggOpus, OMI_RECORD_BYTES, parseRecords, splitRecordings } from "./omi-records.js";

/** A synthetic record: fake frames (not audio) packed the way the pendant stores them. */
function record(timestamp: number, frames: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(OMI_RECORD_BYTES);
  new DataView(out.buffer).setUint32(0, timestamp, false);
  let at = 4;
  for (const frame of frames) {
    out[at] = frame.byteLength;
    out.set(frame, at + 1);
    at += 1 + frame.byteLength;
  }
  return out;
}
const frame = (n: number, size = 40) => new Uint8Array(size).fill(n);
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
};

describe("parseRecords", () => {
  it("reads timestamps, frames and sequence numbers", () => {
    const bytes = concat([record(1000, [frame(1), frame(2)]), record(1000, [frame(3, 255)])]);
    const parsed = parseRecords(bytes, 7);
    expect(parsed.map((r) => [r.seq, r.timestamp, r.frames.length])).toEqual([
      [7, 1000, 2],
      [8, 1000, 1],
    ]);
    expect(parsed[0]?.frames[1]).toEqual(frame(2));
    expect(parsed[1]?.frames[0]?.byteLength).toBe(255);
  });

  it("rejects a length that is not a whole number of records", () => {
    expect(() => parseRecords(new Uint8Array(443), 0)).toThrow();
    expect(() => parseRecords(new Uint8Array(0), 0)).toThrow();
  });
});

describe("splitRecordings", () => {
  it("splits where the gap is longer than the limit", () => {
    // 5 frames of 20 ms per record: each record covers 0.1 s.
    const f = [frame(1), frame(1), frame(1), frame(1), frame(1)];
    const records = parseRecords(
      concat([record(1000, f), record(1000, f), record(1100, f), record(1221, f)]),
      0,
    );
    const out = splitRecordings(records, { gapSeconds: 120, frameMs: 20 });
    // 1100 is within 120 s of the end of the first stretch; 1221 is 120.8 s after 1100.1.
    expect(out.map((r) => [r.firstSeq, r.frames.length, r.durationMs])).toEqual([
      [0, 15, 300],
      [3, 5, 100],
    ]);
    expect(out[1]?.timestamp).toBe(1221);
  });
});

// An independent bitwise CRC-32/MPEG-2 style Ogg checksum.
function referenceCrc(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 24;
    for (let i = 0; i < 8; i += 1) crc = crc & 0x80000000 ? (crc << 1) ^ 0x04c11db7 : crc << 1;
  }
  return crc >>> 0;
}

describe("muxOggOpus", () => {
  it("writes valid pages: headers first, good CRCs, rising granules, all frames", () => {
    const frames = Array.from({ length: 130 }, (_, i) => frame(i % 250, 30 + (i % 3) * 100));
    const ogg = muxOggOpus(frames, { sampleRate: 16000, frameMs: 20 });
    const view = new DataView(ogg.buffer, ogg.byteOffset, ogg.byteLength);
    const pages: { flags: number; granule: bigint; seq: number; packets: Uint8Array[] }[] = [];
    for (let at = 0; at < ogg.byteLength; ) {
      expect(new TextDecoder().decode(ogg.subarray(at, at + 4))).toBe("OggS");
      const count = ogg[at + 26] as number;
      const lacing = ogg.subarray(at + 27, at + 27 + count);
      const body = lacing.reduce((n, v) => n + v, 0);
      const size = 27 + count + body;
      const copy = ogg.slice(at, at + size);
      const stored = view.getUint32(at + 22, true);
      copy.fill(0, 22, 26);
      expect(referenceCrc(copy)).toBe(stored);
      const packets: Uint8Array[] = [];
      let pos = at + 27 + count;
      let length = 0;
      for (const seg of lacing) {
        length += seg;
        if (seg < 255) {
          packets.push(ogg.slice(pos, pos + length));
          pos += length;
          length = 0;
        }
      }
      pages.push({
        flags: ogg[at + 5] as number,
        granule: view.getBigUint64(at + 6, true),
        seq: view.getUint32(at + 18, true),
        packets,
      });
      at += size;
    }
    expect(new TextDecoder().decode(pages[0]?.packets[0]?.subarray(0, 8))).toBe("OpusHead");
    expect(new TextDecoder().decode(pages[1]?.packets[0]?.subarray(0, 8))).toBe("OpusTags");
    expect(pages[0]?.flags).toBe(0x02);
    expect(pages.at(-1)?.flags).toBe(0x04);
    expect(pages.map((p) => p.seq)).toEqual(pages.map((_, i) => i));
    const granules = pages.slice(2).map((p) => p.granule);
    expect(granules.every((g, i) => i === 0 || g > (granules[i - 1] as bigint))).toBe(true);
    // 130 frames of 20 ms at 48 kHz.
    expect(granules.at(-1)).toBe(130n * 960n);
    // 50 frames per page, so 3 audio pages, and every frame comes back byte for byte.
    expect(pages.length).toBe(2 + 3);
    expect(pages.slice(2).flatMap((p) => p.packets)).toEqual(frames);
  });
});
