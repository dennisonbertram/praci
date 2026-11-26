import { oggCrc } from "./omi-records.js";

export interface OmiSegment {
  bytes: Uint8Array;
  /** Seconds from the start of the recording to the start of this segment. */
  startSeconds: number;
}

const SAMPLES_PER_SECOND = 48000;

/**
 * Splits an Ogg Opus file made by `muxOggOpus` into segments of at most `maxSeconds`, each a valid file: the two header pages, then whole audio pages with
 * their granules counted from the segment start. Relies on our own layout, one stream and the
 * headers on pages 0 and 1.
 */
export function splitOggOpus(bytes: Uint8Array, maxSeconds = 600): OmiSegment[] {
  const pages: Uint8Array[] = [];
  for (let at = 0; at < bytes.byteLength; ) {
    const lacing = bytes[at + 26] ?? 0;
    let size = 27 + lacing;
    for (let i = 0; i < lacing; i += 1) size += bytes[at + 27 + i] ?? 0;
    pages.push(bytes.subarray(at, at + size));
    at += size;
  }
  const headers = pages.slice(0, 2);
  const audio = pages.slice(2);
  const granule = (p: Uint8Array) =>
    Number(new DataView(p.buffer, p.byteOffset).getBigUint64(6, true));

  const groups: Uint8Array[][] = [];
  const bases: number[] = [];
  for (const p of audio) {
    const current = groups[groups.length - 1];
    const base = bases[bases.length - 1] as number;
    if (!current || granule(p) - base > maxSeconds * SAMPLES_PER_SECOND) {
      // The page that would end past the limit starts the next segment.
      groups.push([]);
      bases.push(current ? granule(current[current.length - 1] as Uint8Array) : 0);
    }
    (groups[groups.length - 1] as Uint8Array[]).push(p);
  }

  return groups.map((group, index) => {
    const base = bases[index] as number;
    const out = [...headers, ...group].map((source, n) => {
      const page = Uint8Array.from(source);
      const view = new DataView(page.buffer);
      view.setUint32(18, n, true);
      if (n >= 2) view.setBigUint64(6, BigInt(granule(source) - base), true);
      if (n === headers.length + group.length - 1) page[5] = (page[5] ?? 0) | 0x04;
      view.setUint32(22, 0, true);
      view.setUint32(22, oggCrc(page), true);
      return page;
    });
    const file = new Uint8Array(out.reduce((n, p) => n + p.byteLength, 0));
    let at = 0;
    for (const p of out) {
      file.set(p, at);
      at += p.byteLength;
    }
    return { bytes: file, startSeconds: Math.round(base / SAMPLES_PER_SECOND) };
  });
}

/** Length in whole seconds, from the last page's granule position (our own files, one stream). */
export function oggSeconds(bytes: Uint8Array): number {
  let last = 0;
  for (let at = 0; at + 27 <= bytes.byteLength; ) {
    const lacing = bytes[at + 26] ?? 0;
    let size = 27 + lacing;
    for (let i = 0; i < lacing; i += 1) size += bytes[at + 27 + i] ?? 0;
    last = Number(new DataView(bytes.buffer, bytes.byteOffset).getBigUint64(at + 6, true));
    at += size;
  }
  return Math.round(last / SAMPLES_PER_SECOND);
}
