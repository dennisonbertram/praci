import { describe, expect, it } from "vitest";
import { muxOggOpus, oggCrc } from "./omi-records.js";
import { splitOggOpus } from "./omi-segments.js";

/** Reads every page, checking its CRC; returns flags, granule, sequence and packet bytes. */
function readPages(bytes: Uint8Array) {
  const pages = [];
  for (let at = 0; at < bytes.byteLength; ) {
    const lacing = bytes[at + 26] as number;
    let size = 27 + lacing;
    for (let i = 0; i < lacing; i += 1) size += bytes[at + 27 + i] as number;
    const page = Uint8Array.from(bytes.subarray(at, at + size));
    const view = new DataView(page.buffer);
    const crc = view.getUint32(22, true);
    view.setUint32(22, 0, true);
    expect(oggCrc(page)).toBe(crc);
    pages.push({
      flags: page[5] as number,
      granule: Number(view.getBigUint64(6, true)),
      seq: view.getUint32(18, true),
      body: page.subarray(27 + lacing),
    });
    at += size;
  }
  return pages;
}

describe("splitOggOpus", () => {
  // 1250 synthetic 20 ms frames: 25 seconds, 50 frames to a page.
  const frames = Array.from({ length: 1250 }, (_, i) => new Uint8Array(30).fill(i % 250));
  const source = muxOggOpus(frames, { sampleRate: 16000, frameMs: 20 });

  it("makes valid files of at most the limit, with headers, and keeps all audio", () => {
    const segments = splitOggOpus(source, 10);
    expect(segments.map((s) => s.startSeconds)).toEqual([0, 10, 20]);
    let audioBytes = 0;
    for (const { bytes } of segments) {
      const pages = readPages(bytes);
      expect(new TextDecoder().decode(pages[0]?.body.subarray(0, 8))).toBe("OpusHead");
      expect(new TextDecoder().decode(pages[1]?.body.subarray(0, 8))).toBe("OpusTags");
      expect(pages.map((p) => p.seq)).toEqual(pages.map((_, i) => i));
      expect(pages[0]?.flags).toBe(0x02);
      expect(pages[pages.length - 1]?.flags).toBe(0x04);
      expect((pages[pages.length - 1]?.granule as number) / 48000).toBeLessThanOrEqual(10);
      audioBytes += pages.slice(2).reduce((n, p) => n + p.body.byteLength, 0);
    }
    const original = readPages(source).slice(2);
    expect(audioBytes).toBe(original.reduce((n, p) => n + p.body.byteLength, 0));
    expect((readPages(segments[2]?.bytes as Uint8Array).at(-1)?.granule as number) / 48000).toBe(5);
  });

  it("returns one segment when the recording is short", () => {
    const segments = splitOggOpus(source, 600);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.bytes).toEqual(source);
  });
});
