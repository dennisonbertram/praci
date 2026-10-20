import type { AdapterContext, ArtifactStore } from "@rakazo/adapter-kit";
import { Inflate } from "fflate";
import { streamChunks } from "./stream-chunks.js";

// A zip from a user is untrusted. Everything is judged from its central directory (names, sizes,
// flags) before any byte is inflated, and inflation itself never trusts the sizes it declares.
// Entries are read from a random-access source (stored object or bytes) and streamed out, so no
// file is ever held whole in memory.
export const ZIP_MAX_ENTRIES = 1_000;
export const ZIP_MAX_RATIO = 100;
/** The central directory is read whole; 1,000 entries need far less than this. */
const ZIP_MAX_DIRECTORY_BYTES = 32 * 1024 * 1024;
/** Small files may compress better than the ratio (a page of spaces); only larger ones are bombs. */
const RATIO_FLOOR_BYTES = 1024 * 1024;
/** Input is inflated in slices so output can be stopped between them. */
const SLICE_BYTES = 8 * 1024;

export type ZipRefusalCode = "too-large" | "encrypted" | "unsafe" | "invalid";

/** The whole zip is refused: it is unreadable, protected, unsafe, or larger than it may expand. */
export class ZipRefusal extends Error {
  constructor(readonly code: ZipRefusalCode) {
    super(
      {
        "too-large": "This zip is too large to unpack",
        encrypted: "This zip is password-protected",
        unsafe: "This zip has unsafe file paths",
        invalid: "This zip can't be read",
      }[code],
    );
  }
}

export interface ZipEntry {
  /** Folder names from the zip root down to the file. */
  folders: string[];
  name: string;
  size: number;
  compressedSize: number;
  method: number;
  localOffset: number;
}

/** Random access to a zip's bytes: `range(start, end)` yields bytes [start, end). */
export interface ZipSource {
  size: number;
  range(start: number, end: number): AsyncIterable<Uint8Array>;
}

export const bytesZipSource = (bytes: Uint8Array): ZipSource => ({
  size: bytes.byteLength,
  async *range(start, end) {
    yield bytes.subarray(start, end);
  },
});

/** A zip held in the artifact store, read with ranged requests. */
export const storeZipSource = (
  store: ArtifactStore,
  id: string,
  size: number,
  context: AdapterContext,
): ZipSource => ({
  size,
  async *range(start, end) {
    if (end > start) yield* streamChunks(await store.getStream(id, context, { start, end }));
  },
});

const ZIP_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "multipart/x-zip",
]);

/** True for a file that is a zip by its type or its name. */
export const isZipFile = (name: string, mimeType: string) =>
  ZIP_TYPES.has(mimeType.toLowerCase().split(";")[0]?.trim() ?? "") || /\.zip$/i.test(name);

async function readRange(source: ZipSource, start: number, end: number) {
  if (start < 0 || end > source.size || end < start) throw new ZipRefusal("invalid");
  const out = new Uint8Array(end - start);
  let at = 0;
  for await (const chunk of source.range(start, end)) {
    if (at + chunk.length > out.length) throw new ZipRefusal("invalid");
    out.set(chunk, at);
    at += chunk.length;
  }
  if (at !== out.length) throw new ZipRefusal("invalid");
  return out;
}

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
/** A 64-bit little-endian field; refuses values JavaScript cannot hold exactly. */
const u64 = (v: DataView, at: number) => {
  const value = v.getBigUint64(at, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new ZipRefusal("too-large");
  return Number(value);
};

/** Where the central directory starts and how many entries it holds, with Zip64 support. */
async function locateDirectory(source: ZipSource) {
  const tailLength = Math.min(source.size, 22 + 0xffff);
  const tail = await readRange(source, source.size - tailLength, source.size);
  const t = view(tail);
  let eocd = -1;
  for (let at = tail.length - 22; at >= 0; at--) {
    if (t.getUint32(at, true) === 0x06054b50) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new ZipRefusal("invalid");
  let count = t.getUint16(eocd + 10, true);
  let dirSize = t.getUint32(eocd + 12, true);
  let dirOffset = t.getUint32(eocd + 16, true);
  if (count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) {
    const eocdAt = source.size - tailLength + eocd;
    const locator = await readRange(source, eocdAt - 20, eocdAt).catch(() => {
      throw new ZipRefusal("invalid");
    });
    if (view(locator).getUint32(0, true) !== 0x07064b50) throw new ZipRefusal("invalid");
    const recordAt = u64(view(locator), 8);
    const record = await readRange(source, recordAt, recordAt + 56);
    const r = view(record);
    if (r.getUint32(0, true) !== 0x06064b50) throw new ZipRefusal("invalid");
    count = u64(r, 32);
    dirSize = u64(r, 40);
    dirOffset = u64(r, 48);
  }
  return { count, dirSize, dirOffset };
}

/**
 * The files of a zip worth unpacking. Refuses the whole zip for an encrypted entry, an unsafe
 * path or symlink, too many entries, or a bomb-like ratio. Folders, `__MACOSX`, hidden files and
 * empty names are left out. There is no size limit: entries are streamed to storage.
 */
export async function listZip(source: ZipSource): Promise<ZipEntry[]> {
  if (source.size < 22) throw new ZipRefusal("invalid");
  const { count, dirSize, dirOffset } = await locateDirectory(source);
  if (dirSize > ZIP_MAX_DIRECTORY_BYTES) throw new ZipRefusal("too-large");
  const bytes = await readRange(source, dirOffset, dirOffset + dirSize);
  const v = view(bytes);

  const entries: ZipEntry[] = [];
  let at = 0;
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || v.getUint32(at, true) !== 0x02014b50) {
      throw new ZipRefusal("invalid");
    }
    const madeBy = v.getUint16(at + 4, true);
    const flags = v.getUint16(at + 8, true);
    const method = v.getUint16(at + 10, true);
    let compressedSize = v.getUint32(at + 20, true);
    let size = v.getUint32(at + 24, true);
    const nameLength = v.getUint16(at + 28, true);
    const extraLength = v.getUint16(at + 30, true);
    const next = at + 46 + nameLength + extraLength + v.getUint16(at + 32, true);
    const mode = v.getUint32(at + 38, true) >>> 16;
    let localOffset = v.getUint32(at + 42, true);
    if (next > bytes.length) throw new ZipRefusal("invalid");
    const path = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));

    if (size === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      // Zip64 extra field: only the fields that overflowed are present, in this order.
      const extraStart = at + 46 + nameLength;
      for (let e = extraStart; e + 4 <= extraStart + extraLength; ) {
        const id = v.getUint16(e, true);
        const length = v.getUint16(e + 2, true);
        if (id === 0x0001) {
          let p = e + 4;
          const take = () => {
            if (p + 8 > e + 4 + length) throw new ZipRefusal("invalid");
            const value = u64(v, p);
            p += 8;
            return value;
          };
          if (size === 0xffffffff) size = take();
          if (compressedSize === 0xffffffff) compressedSize = take();
          if (localOffset === 0xffffffff) localOffset = take();
          break;
        }
        e += 4 + length;
      }
      if (size === 0xffffffff || compressedSize === 0xffffffff || localOffset === 0xffffffff) {
        throw new ZipRefusal("invalid");
      }
    }
    at = next;

    if (flags & 1) throw new ZipRefusal("encrypted");
    // Unix mode lives in the high attribute bits when the zip was made on Unix (host 3).
    if (madeBy >> 8 === 3 && (mode & 0xf000) === 0xa000) throw new ZipRefusal("unsafe");
    const parts = path.replaceAll("\\", "/").split("/");
    if (
      path.includes("\0") ||
      parts[0] === "" ||
      /^[a-z]:/i.test(path) ||
      parts.some((part) => part === "..")
    ) {
      throw new ZipRefusal("unsafe");
    }
    const name = parts.pop() ?? "";
    // A folder entry ends in "/"; macOS metadata and hidden files are not documents.
    if (!name || parts.includes("__MACOSX") || [...parts, name].some((p) => p.startsWith("."))) {
      continue;
    }
    if (size > RATIO_FLOOR_BYTES && size > compressedSize * ZIP_MAX_RATIO) {
      throw new ZipRefusal("too-large");
    }
    if (entries.length >= ZIP_MAX_ENTRIES) throw new ZipRefusal("too-large");
    entries.push({
      folders: parts.filter(Boolean),
      name,
      size,
      compressedSize,
      method,
      localOffset,
    });
  }
  return entries;
}

/**
 * The bytes of one listed entry as a stream of bounded chunks. Stops at the entry's declared
 * size (`too-large`); output that ends short or a damaged header is `invalid`.
 */
export async function* streamZipEntry(
  source: ZipSource,
  entry: ZipEntry,
): AsyncGenerator<Uint8Array> {
  const header = view(await readRange(source, entry.localOffset, entry.localOffset + 30));
  if (header.getUint32(0, true) !== 0x04034b50) throw new ZipRefusal("invalid");
  const start = entry.localOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  const end = start + entry.compressedSize;
  if (end > source.size) throw new ZipRefusal("invalid");

  if (entry.method === 0) {
    if (entry.compressedSize !== entry.size) throw new ZipRefusal("invalid");
    let written = 0;
    for await (const chunk of source.range(start, end)) {
      written += chunk.length;
      if (written > entry.size) throw new ZipRefusal("too-large");
      yield chunk;
    }
    if (written !== entry.size) throw new ZipRefusal("invalid");
    return;
  }
  if (entry.method !== 8) throw new ZipRefusal("invalid");
  if (entry.compressedSize === 0) {
    if (entry.size !== 0) throw new ZipRefusal("invalid");
    return;
  }

  let written = 0;
  let pending: Uint8Array[] = [];
  const inflate = new Inflate((chunk) => {
    written += chunk.length;
    if (written > entry.size) throw new ZipRefusal("too-large");
    pending.push(chunk);
  });
  let read = 0;
  for await (const chunk of source.range(start, end)) {
    for (let i = 0; i < chunk.length; i += SLICE_BYTES) {
      const slice = chunk.subarray(i, i + SLICE_BYTES);
      read += slice.length;
      try {
        inflate.push(slice, read >= entry.compressedSize);
      } catch (error) {
        throw error instanceof ZipRefusal ? error : new ZipRefusal("invalid");
      }
      const out = pending;
      pending = [];
      yield* out;
    }
  }
  if (read !== entry.compressedSize || written !== entry.size) throw new ZipRefusal("invalid");
}
