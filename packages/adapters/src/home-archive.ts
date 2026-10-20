import { constants, createReadStream, createWriteStream } from "node:fs";
import {
  chmod,
  type FileHandle,
  lstat,
  mkdir,
  open,
  readdir,
  readlink,
  realpath,
  rm,
  utimes,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import * as tar from "tar";
import { shouldSkipPortableWorkspaceFile } from "./computer-workspace.js";
import { fileHandlePath } from "./file-handle-path.js";

/** Directories that are caches: large, rebuilt on demand, and not worth a snapshot. */
const CACHE_PATHS = [".cache", ".npm/_cacache", ".pnpm-store", "node_modules/.cache"];

export function skipSnapshotPath(relative: string) {
  const clean = relative.replace(/^\.\/?/, "");
  if (!clean) return false;
  if (shouldSkipPortableWorkspaceFile(clean)) return true;
  return CACHE_PATHS.some(
    (cache) =>
      clean === cache ||
      clean.startsWith(`${cache}/`) ||
      clean.includes(`/${cache}/`) ||
      clean.endsWith(`/${cache}`),
  );
}

/** Files up to this size are read whole before their entry is written, so a change can be retried. */
const BUFFERED_FILE_BYTES = 8 * 1024 * 1024;
const FILE_ATTEMPTS = 3;
const CHUNK_BYTES = 256 * 1024;

/**
 * Writes a gzip tar of `directory` to the new file `file`.
 *
 * The directory may be a live home that an agent changes while it is read, so nothing here
 * follows a link: entries come from `lstat`, files are opened with `O_NOFOLLOW` and kept only
 * when the opened file is inside `directory`, and a directory is listed only while it still
 * resolves to itself. Kept: file bytes, symlink targets, empty directories, permission bits
 * (including setuid, setgid and sticky), and mtimes of files and directories. Hard links inside
 * the home become tar links to the first path. Not kept: owners (every entry is uid and gid 0),
 * access times, extended attributes, sockets, FIFOs and devices.
 *
 * A file that changes while it is read is read again; after a few attempts it is left out, or,
 * above 8 MiB, written with its missing tail as zeros. Those paths, and entries that vanished or
 * were swapped, are returned in `skipped.changed`. Entries the host cannot read (permissions, or
 * a name tar cannot store) are in `skipped.unreadable`; the next save will not fix those.
 */
export async function packDirectory(directory: string, file: string) {
  const root = await realpath(directory);
  const skipped: Skipped = { changed: [], unreadable: [] };
  await pipeline(
    Readable.from(archiveBlocks(root, skipped)),
    createGzip({ level: 3 }),
    createWriteStream(file, { flags: "wx" }),
  );
  return { skipped };
}

type Skipped = { changed: string[]; unreadable: string[] };

async function* archiveBlocks(root: string, skipped: Skipped): AsyncGenerator<Buffer> {
  // A root entry keeps an archive of an empty home readable; extraction skips it.
  yield header({ path: "./", type: "Directory", mode: 0o755, mtime: new Date(0) });
  yield* walk(root, "", new Map(), skipped);
  yield Buffer.alloc(1024); // end-of-archive marker
}

async function* walk(
  root: string,
  relative: string,
  links: Map<string, string>,
  skipped: Skipped,
): AsyncGenerator<Buffer> {
  const directory = relative ? path.join(root, relative) : root;
  // ponytail: realpath-then-readdir can still race a swap and list one outside directory's
  // names; file contents are protected by the opened-file check. Use openat-style walking if
  // Node ever exposes it.
  if ((await realpath(directory).catch(() => null)) !== directory) {
    skipped.changed.push(relative);
    return;
  }
  const names = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
    (error.code === "ENOENT" ? skipped.changed : skipped.unreadable).push(relative);
    return null;
  });
  if (!names) return;
  for (const name of names.sort()) {
    const child = relative ? `${relative}/${name}` : name;
    if (skipSnapshotPath(child)) continue;
    const full = path.join(directory, name);
    const info = await lstat(full).catch(() => null);
    if (!info) {
      skipped.changed.push(child);
    } else if (unreadable(info.isDirectory() ? `${child}/` : child)) {
      skipped.unreadable.push(child);
    } else if (info.isDirectory()) {
      yield header({ path: `${child}/`, type: "Directory", mode: info.mode, mtime: info.mtime });
      yield* walk(root, child, links, skipped);
    } else if (info.isSymbolicLink()) {
      const target = await readlink(full).catch(() => null);
      if (target === null) skipped.changed.push(child);
      else if (unreadable(child, target)) skipped.unreadable.push(child);
      else yield header({ path: child, type: "SymbolicLink", linkpath: target, mtime: info.mtime });
    } else if (info.isFile()) {
      yield* fileEntry(root, full, child, links, skipped);
    }
  }
}

async function* fileEntry(
  root: string,
  full: string,
  relative: string,
  links: Map<string, string>,
  skipped: Skipped,
): AsyncGenerator<Buffer> {
  for (let attempt = 0; attempt < FILE_ATTEMPTS; attempt++) {
    const handle = await open(
      full,
      constants.O_RDONLY | constants.O_NOFOLLOW | (constants.O_NONBLOCK ?? 0),
    ).catch((error: NodeJS.ErrnoException) => {
      // ENOENT and ELOOP mean it vanished or became a link; anything else will not change.
      const changed = error.code === "ENOENT" || error.code === "ELOOP";
      (changed ? skipped.changed : skipped.unreadable).push(relative);
      return null;
    });
    if (!handle) return;
    try {
      const info = await handle.stat();
      if (!info.isFile() || !isInside(root, await fileHandlePath(handle.fd))) {
        skipped.changed.push(relative); // swapped for something else while it was opened
        return;
      }
      const linkKey = info.nlink > 1 ? `${info.dev}:${info.ino}` : undefined;
      const first = linkKey ? links.get(linkKey) : undefined;
      if (first) {
        yield header({
          path: relative,
          type: "Link",
          linkpath: first,
          mode: info.mode,
          mtime: info.mtime,
        });
        return;
      }
      const entry = header({
        path: relative,
        type: "File",
        size: info.size,
        mode: info.mode,
        mtime: info.mtime,
      });
      if (info.size <= BUFFERED_FILE_BYTES) {
        const bytes = Buffer.alloc(info.size);
        const complete =
          (await readInto(handle, bytes)) === info.size &&
          (await readInto(handle, Buffer.alloc(1))) === 0;
        if (!complete) continue; // it changed while it was read
        yield entry;
        yield bytes;
      } else {
        yield entry;
        let left = info.size;
        while (left > 0) {
          const chunk = Buffer.alloc(Math.min(CHUNK_BYTES, left));
          const read = await readInto(handle, chunk);
          if (read === 0) break;
          yield chunk.subarray(0, read);
          left -= read;
        }
        if (left > 0) {
          skipped.changed.push(relative); // it shrank while it was read; the rest of the entry is zeros
          yield Buffer.alloc(left);
        }
      }
      if (info.size % 512) yield Buffer.alloc(512 - (info.size % 512));
      if (linkKey) links.set(linkKey, relative);
      return;
    } finally {
      await handle.close();
    }
  }
  skipped.changed.push(relative);
}

async function readInto(handle: FileHandle, buffer: Buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const { bytesRead } = await handle.read(buffer, offset, buffer.length - offset, null);
    if (bytesRead === 0) break;
    offset += bytesRead;
  }
  return offset;
}

function header(fields: {
  path: string;
  type: "File" | "Directory" | "SymbolicLink" | "Link";
  mode?: number;
  mtime: Date;
  size?: number;
  linkpath?: string;
}) {
  const data = {
    path: fields.path,
    type: fields.type,
    mode: fields.type === "SymbolicLink" ? 0o777 : (fields.mode ?? 0) & 0o7777,
    uid: 0,
    gid: 0,
    size: fields.size ?? 0,
    mtime: fields.mtime,
    linkpath: fields.linkpath,
  };
  const block = Buffer.alloc(512);
  // A path or link target that does not fit the classic header goes in a PAX header first.
  if (!new tar.Header(data).encode(block)) return block;
  const pax = new tar.Pax({
    path: data.path,
    linkpath: data.linkpath,
    size: data.size,
    mtime: data.mtime,
  });
  return Buffer.concat([pax.encode(), block]);
}

/**
 * tar's reader splits PAX records at newlines, so a name or link target with a newline that is
 * too long for the classic header would come back as a different path. Such entries are left out.
 */
function unreadable(entryPath: string, linkpath?: string) {
  if (!`${entryPath}${linkpath ?? ""}`.includes("\n")) return false;
  return new tar.Header({
    path: entryPath,
    linkpath,
    size: 0,
    mode: 0,
    uid: 0,
    gid: 0,
    mtime: new Date(0),
  }).encode(Buffer.alloc(512));
}

function isInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

const UNSAFE = "Home snapshot contains an unsafe entry";

/**
 * Extracts an archive into `cwd`, which must not exist yet. Symlink targets are kept exactly as
 * stored, so tar's own path guards (which would rewrite absolute targets) are off and these
 * checks replace them. Any failure rejects the whole archive:
 * - no absolute path, and no `..`, `.` or empty segment;
 * - no entry at or below a path an earlier entry made a symlink, and no path twice (compared
 *   ignoring case and Unicode normalization, for macOS file systems);
 * - a hard link only to a regular file extracted earlier in the archive.
 * Devices, FIFOs and other special entries are skipped. Returns the bytes of regular files written.
 */
export async function unpackArchive(file: string, cwd: string) {
  await mkdir(cwd);
  let bytes = 0;
  const key = (entry: string) => entry.normalize("NFC").toLowerCase();
  const seen = new Set<string>();
  const symlinks = new Set<string>();
  const files = new Set<string>();
  const directories: Array<{ path: string; mode: number; mtime?: Date }> = [];
  const fileModes: Array<{ path: string; mode: number }> = [];
  let unsafe = false;
  const clean = (raw: string) => {
    if (raw.startsWith("/") || raw.includes("\\")) return null;
    const trimmed = raw.replace(/^(\.\/)+/, "").replace(/\/$/, "");
    const parts = trimmed.split("/");
    return parts.some((part) => part === "" || part === "." || part === "..") ? null : trimmed;
  };
  const throughSymlink = (entry: string) => {
    const parts = key(entry).split("/");
    return parts.some((_, index) => symlinks.has(parts.slice(0, index + 1).join("/")));
  };
  /** true extracts the entry, "skip" ignores it, false rejects the archive. */
  const verdict = (raw: string, entry: tar.ReadEntry): boolean | "skip" => {
    if (raw === "./" || raw === ".") return "skip";
    const relative = clean(raw);
    if (!relative || throughSymlink(relative) || seen.has(key(relative))) return false;
    switch (entry.type) {
      case "Directory":
        directories.push({ path: relative, mode: entry.mode ?? 0o755, mtime: entry.mtime });
        break;
      case "File":
      case "OldFile":
      case "ContiguousFile":
        files.add(key(relative));
        fileModes.push({ path: relative, mode: entry.mode ?? 0o644 });
        bytes += entry.size ?? 0;
        break;
      case "SymbolicLink":
        symlinks.add(key(relative));
        break;
      case "Link": {
        const target = clean(String(entry.linkpath ?? ""));
        if (!target || throughSymlink(target) || !files.has(key(target))) return false;
        files.add(key(relative));
        break;
      }
      default:
        return "skip";
    }
    seen.add(key(relative));
    return true;
  };
  await pipeline(
    createReadStream(file, { highWaterMark: CHUNK_BYTES }),
    tar.extract({
      cwd,
      preserveOwner: false,
      umask: 0,
      preservePaths: true,
      strict: true,
      jobs: 1,
      filter: (raw, entry) => {
        const result = verdict(raw, entry as tar.ReadEntry);
        if (result === false) unsafe = true;
        return !unsafe && result === true;
      },
    }),
  );
  if (unsafe) throw new Error(UNSAFE);
  // tar applies the process umask to files and gives directories owner rwx so it can fill them.
  // Restore the stored modes, and directory mtimes deepest first. The tree is new and private
  // and was checked above, so these paths have no links in them.
  for (const entry of fileModes) {
    const target = path.join(cwd, entry.path);
    if (!(await lstat(target)).isFile()) throw new Error(UNSAFE);
    await chmod(target, entry.mode & 0o7777);
  }
  for (const directory of directories.sort((a, b) => b.path.length - a.path.length)) {
    const target = path.join(cwd, directory.path);
    if (!(await lstat(target)).isDirectory()) throw new Error(UNSAFE);
    if (directory.mtime) await utimes(target, directory.mtime, directory.mtime);
    await chmod(target, directory.mode & 0o7777);
  }
  return { bytes };
}

/**
 * Deletes a tree nothing mounts, including one with read-only directories (a 0555 directory
 * cannot otherwise be emptied). Only directories seen through `lstat` are made writable.
 */
export async function removeTree(target: string) {
  try {
    await rm(target, { recursive: true, force: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EACCES" && code !== "EPERM") throw error;
    await makeWritable(target);
    await rm(target, { recursive: true, force: true });
  }
}

async function makeWritable(target: string): Promise<void> {
  const info = await lstat(target).catch(() => null);
  if (!info?.isDirectory()) return;
  await chmod(target, (info.mode & 0o777) | 0o700).catch(() => undefined);
  for (const name of await readdir(target).catch(() => [])) {
    await makeWritable(path.join(target, name));
  }
}
