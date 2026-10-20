import { Inflate } from "fflate";

// A zip from a user is untrusted. Everything is judged from its central directory (names, sizes,
// flags) before any byte is inflated, and inflation itself never trusts the sizes it declares.
export const ZIP_MAX_ENTRIES = 1_000;
export const ZIP_MAX_TOTAL_BYTES = 500 * 1024 * 1024;
export const ZIP_MAX_RATIO = 100;
/** Small files may compress better than the ratio (a page of spaces); only larger ones are bombs. */
const RATIO_FLOOR_BYTES = 1024 * 1024;
/** Input is inflated in slices so output can be stopped between them. */
const SLICE_BYTES = 16 * 1024;

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

const ZIP_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "multipart/x-zip",
]);

/** True for a file that is a zip by its type or its name. */
export const isZipFile = (name: string, mimeType: string) =>
  ZIP_TYPES.has(mimeType.toLowerCase().split(";")[0]?.trim() ?? "") || /\.zip$/i.test(name);

/**
 * The files of a zip worth unpacking. Refuses the whole zip for an encrypted entry, an unsafe
 * path or symlink, too many entries, too much output or a bomb-like ratio. Folders, `__MACOSX`,
 * hidden files and empty names are left out; files over `maxEntryBytes` are counted in `oversized`.
 */
export function listZip(
  bytes: Uint8Array,
  { maxEntryBytes }: { maxEntryBytes: number },
): { entries: ZipEntry[]; oversized: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at--) {
    if (view.getUint32(at, true) === 0x06054b50) {
      eocd = at;
      break;
    }
  }
  if (eocd < 0) throw new ZipRefusal("invalid");
  const count = view.getUint16(eocd + 10, true);
  const dirOffset = view.getUint32(eocd + 16, true);
  // Zip64 (more than 65,534 entries or 4 GB) is far beyond every limit here.
  if (count === 0xffff || dirOffset === 0xffffffff) throw new ZipRefusal("too-large");

  const entries: ZipEntry[] = [];
  let oversized = 0;
  let total = 0;
  let at = dirOffset;
  for (let i = 0; i < count; i++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) {
      throw new ZipRefusal("invalid");
    }
    const madeBy = view.getUint16(at + 4, true);
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const compressedSize = view.getUint32(at + 20, true);
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const next =
      at + 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const mode = view.getUint32(at + 38, true) >>> 16;
    const localOffset = view.getUint32(at + 42, true);
    if (next > bytes.length) throw new ZipRefusal("invalid");
    const path = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
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
    if (size > maxEntryBytes) {
      oversized += 1;
      continue;
    }
    if (size > RATIO_FLOOR_BYTES && size > compressedSize * ZIP_MAX_RATIO) {
      throw new ZipRefusal("too-large");
    }
    total += size;
    if (total > ZIP_MAX_TOTAL_BYTES || entries.length >= ZIP_MAX_ENTRIES) {
      throw new ZipRefusal("too-large");
    }
    entries.push({
      folders: parts.filter(Boolean),
      name,
      size,
      compressedSize,
      method,
      localOffset,
    });
  }
  return { entries, oversized };
}

/** The bytes of one listed entry. Stops at the entry's declared size; a mismatch is an error. */
export function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const { localOffset: at } = entry;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) {
    throw new ZipRefusal("invalid");
  }
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (data.length !== entry.compressedSize) throw new ZipRefusal("invalid");
  if (entry.method === 0) {
    if (data.length !== entry.size) throw new ZipRefusal("invalid");
    return data.slice();
  }
  if (entry.method !== 8) throw new ZipRefusal("invalid");

  const out = new Uint8Array(entry.size);
  let written = 0;
  const inflate = new Inflate((chunk) => {
    if (written + chunk.length > entry.size) throw new ZipRefusal("too-large");
    out.set(chunk, written);
    written += chunk.length;
  });
  try {
    for (let i = 0; i < data.length; i += SLICE_BYTES) {
      inflate.push(data.subarray(i, i + SLICE_BYTES), i + SLICE_BYTES >= data.length);
    }
  } catch (error) {
    throw error instanceof ZipRefusal ? error : new ZipRefusal("invalid");
  }
  if (written !== entry.size) throw new ZipRefusal("invalid");
  return out;
}
