import { createReadStream } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  lutimes,
  mkdir,
  readdir,
  readlink,
  rm,
  symlink,
  utimes,
} from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import { shouldSkipPortableWorkspaceFile } from "./computer-workspace.js";

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

const MAX_VANISHED = 50;

/**
 * Writes a gzip tar of `directory` to `file`. Symlinks, empty directories, modes and mtimes are
 * kept as they are. A file that disappears while the archive is written (a live workspace) is
 * left out and the archive is written again, so one deleted cache file does not fail a save.
 */
export async function packDirectory(
  directory: string,
  file: string,
  onEntry?: (relative: string) => void,
) {
  const vanished = new Set<string>();
  for (let attempt = 0; ; attempt++) {
    try {
      await tar.create(
        {
          gzip: { level: 3 },
          cwd: directory,
          file,
          portable: true,
          filter: (entry) => {
            const relative = entry.replace(/^\.\/?/, "");
            onEntry?.(relative);
            return !skipSnapshotPath(relative) && !vanished.has(relative);
          },
        },
        ["."],
      );
      return;
    } catch (error) {
      const missing = error as NodeJS.ErrnoException;
      if (missing.code !== "ENOENT" || !missing.path || attempt >= MAX_VANISHED) throw error;
      const relative = path.relative(directory, missing.path);
      if (!relative || relative.startsWith("..") || vanished.has(relative)) throw error;
      vanished.add(relative);
      await rm(file, { force: true });
    }
  }
}

/**
 * Extracts an archive made by `packDirectory`. Symlink targets are kept exactly as stored (tar's
 * own path cleaning would rewrite absolute targets), so entry paths are checked here instead:
 * an absolute path or a `..` segment fails the whole restore.
 */
export async function unpackArchive(file: string, cwd: string) {
  await mkdir(cwd, { recursive: true });
  let unsafe: string | undefined;
  await pipeline(
    createReadStream(file, { highWaterMark: 256 * 1024 }),
    tar.extract({
      cwd,
      preserveOwner: false,
      umask: 0,
      preservePaths: true,
      jobs: 1,
      filter: (entry) => {
        if (entry.startsWith("/") || entry.split("/").includes("..")) {
          unsafe ??= entry;
          return false;
        }
        return true;
      },
    }),
  );
  if (unsafe) throw new Error("Home snapshot contains an unsafe path");
}

/**
 * Makes `target` match `source` without replacing `target` itself, so a container that mounts it
 * keeps seeing the same directory. Entries missing from `source` are removed.
 */
export async function syncDirectoryInPlace(source: string, target: string) {
  await mkdir(target, { recursive: true });
  const wanted = new Set(await readdir(source));
  for (const name of await readdir(target)) {
    if (!wanted.has(name)) await rm(path.join(target, name), { recursive: true, force: true });
  }
  for (const name of wanted) {
    const from = path.join(source, name);
    const to = path.join(target, name);
    const info = await lstat(from);
    const existing = await lstat(to).catch(() => null);
    if (info.isDirectory()) {
      if (existing && !existing.isDirectory()) await rm(to, { recursive: true, force: true });
      await syncDirectoryInPlace(from, to);
    } else if (info.isSymbolicLink()) {
      if (existing) await rm(to, { recursive: true, force: true });
      await symlink(await readlink(from), to);
      await lutimes(to, info.atime, info.mtime).catch(() => undefined);
      continue;
    } else if (info.isFile()) {
      if (existing && !existing.isFile()) await rm(to, { recursive: true, force: true });
      await copyFile(from, to);
    } else {
      continue;
    }
    await chmod(to, info.mode & 0o7777);
    await utimes(to, info.atime, info.mtime);
  }
}
