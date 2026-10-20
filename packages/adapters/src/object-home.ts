import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import type {
  AdapterContext,
  AgentHomeStore,
  ArtifactStore,
  PortableFile,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { LocalAgentHomeStore } from "./home.js";
import { packDirectory, removeTree, unpackArchive } from "./home-archive.js";

/** Another writer published a newer revision of this home first. */
export class AgentHomeConflictError extends Error {
  constructor(homeKey: string) {
    super(`Agent home ${homeKey} changed while it was being saved`);
    this.name = "AgentHomeConflictError";
  }
}

type HomeRow = {
  id: string;
  kind: string;
  homeRevision: string;
  homeSnapshotId: string | null;
  homePreviousSnapshotId: string | null;
};
const HOME_COLUMNS = {
  id: true,
  kind: true,
  homeRevision: true,
  homeSnapshotId: true,
  homePreviousSnapshotId: true,
} as const;

/** Archive, upload, download and extract steps one process runs at once, across all homes. */
const HEAVY_OPERATIONS = 2;
/** Attempts for a save that keeps losing the revision race to other processes. */
const SAVE_ATTEMPTS = 5;
/** Temporary folders older than this belong to a process that died; younger ones may be in use. */
const LEFTOVER_MS = 6 * 60 * 60_000;
/** A cached revision used within this time is never removed, so a reader holding it can finish. */
const CACHE_READER_GRACE_MS = 60 * 60_000;
/** Cached revisions unused for this long are removed. */
const CACHE_TTL_MS = 24 * 60 * 60_000;
/** Above this many bytes in the cache, the least recently used revisions are removed. */
const CACHE_MAX_BYTES = 2 * 1024 ** 3;
export const HOME_CACHE_LIMITS = {
  readerGraceMs: CACHE_READER_GRACE_MS,
  ttlMs: CACHE_TTL_MS,
  leftoverMs: LEFTOVER_MS,
};

export type ObjectHomePrisma = Pick<PrismaClient, "computer">;

/**
 * Keeps each Computer's home as one gzip tar snapshot in the artifact store, with the current
 * revision and snapshot id on the Computer row. Every save is a compare-and-swap on that
 * revision; no database connection or lock is held while bytes move.
 *
 * Local copies under DATA_DIR:
 * - `homes/<key>` is the live directory of a Docker Computer, which the supervisor mounts. Only
 *   `liveDirectory` (called while provisioning) installs a snapshot into it: when it is missing,
 *   or when the caller confirms nothing mounts it. An install extracts into a new directory
 *   beside it and renames it into place; nothing is ever written into a tree an agent can change.
 *   `home-sync/<key>/<revision>` records the revisions saved from or installed into it here.
 *   This host is authoritative for the home while that record matches the current revision:
 *   reads and edits then use the live directory and saves archive it.
 * - `home-cache/<key>/homes/<revision>` is a read-only copy of one revision, made on first read,
 *   for every other Computer kind and for Docker homes this host is not authoritative for.
 *   Edits there work on a private extraction and publish from it, never from the cache.
 *
 * Every operation looks the Computer up by home key and the caller's space, so one space cannot
 * touch another's home. Team Computers are shared inside their space, so the user is not checked.
 */
export class ObjectAgentHomeStore implements AgentHomeStore {
  private readonly live: LocalAgentHomeStore;
  private readonly chains = new Map<string, Promise<unknown>>();
  private readonly heavy = semaphore(HEAVY_OPERATIONS);
  private leftovers?: Promise<void>;

  constructor(
    private readonly prisma: ObjectHomePrisma,
    private readonly artifacts: ArtifactStore,
    private readonly dataDir: string,
    private readonly cacheMaxBytes = CACHE_MAX_BYTES,
  ) {
    this.live = new LocalAgentHomeStore(dataDir);
  }

  describe() {
    return {
      id: "object-home",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { revisions: true },
    };
  }

  async checkout(botId: string, dest: string, context: AdapterContext) {
    await this.locked(botId, async () => {
      const view = await this.view(botId, context);
      await view.store.checkout(view.id, dest, context);
    });
    return "working";
  }

  /** Saves the contents of `src` as the new snapshot, unless the stored revision is no longer `expectedRevision`. */
  async commit(botId: string, src: string, context: AdapterContext, expectedRevision?: string) {
    return this.locked(botId, async () => {
      const row = await this.row(botId, context);
      if (expectedRevision !== undefined && expectedRevision !== row.homeRevision) {
        throw new AgentHomeConflictError(botId);
      }
      return this.publish(botId, row, src, context);
    });
  }

  /**
   * Saves the live directory a running Docker container mounts. It is the newest copy of the
   * home, so a revision another process saved meanwhile does not reject the save: the directory
   * is archived again and the save retried.
   */
  async revise(botId: string, context: AdapterContext) {
    return this.locked(botId, () => this.saveLive(botId, context));
  }

  /**
   * The live directory for a Docker Computer. A missing directory is created from the snapshot.
   * An existing one that does not hold the current revision is replaced only when `unmounted`
   * confirms no container uses it (the caller has claimed the Computer and its container is not
   * running). `current` says whether the directory now holds the current revision.
   */
  async liveDirectory(
    botId: string,
    context: AdapterContext,
    options?: { unmounted?: () => Promise<boolean> },
  ) {
    return this.locked(botId, async () => {
      const current = await this.withCurrentRow(botId, context, (row) =>
        this.prepareLive(botId, row, context, options?.unmounted),
      );
      return { path: this.live.pathFor(botId), current };
    });
  }

  async restore(botId: string, _revision: string, dest: string, context: AdapterContext) {
    await this.checkout(botId, dest, context);
  }

  async *exportHome(
    botId: string,
    context: AdapterContext,
    options?: { directory?: string; skipHidden?: boolean },
  ): AsyncIterable<PortableFile> {
    const view = await this.locked(botId, () => this.view(botId, context));
    yield* view.store.exportHome(view.id, context, options);
  }

  async readFile(
    botId: string,
    filePath: string,
    context: AdapterContext,
    options?: { maxBytes?: number },
  ) {
    return this.locked(botId, async () => {
      const view = await this.view(botId, context);
      return view.store.readFile(view.id, filePath, context, options);
    });
  }

  async writeFile(botId: string, filePath: string, content: string, context: AdapterContext) {
    await this.edit(botId, context, (store, id) => store.writeFile(id, filePath, content, context));
  }

  async list(botId: string, dirPath: string, context: AdapterContext) {
    return this.locked(botId, async () => {
      const view = await this.view(botId, context);
      return view.store.list(view.id, dirPath, context);
    });
  }

  async removeEntry(botId: string, parent: string, name: string, context: AdapterContext) {
    await this.edit(botId, context, (store, id) => store.removeEntry(id, parent, name, context));
  }

  /**
   * Deletes both stored snapshots and the local copies. Without `deletedRow` it does nothing
   * unless the Computer is found in this space. A caller that already deleted the Computer row
   * passes the snapshot ids that row held.
   */
  async remove(
    botId: string,
    context: AdapterContext,
    deletedRow?: { homeSnapshotId: string | null; homePreviousSnapshotId: string | null },
  ) {
    await this.locked(botId, async () => {
      let ids: Array<string | null>;
      if (deletedRow) {
        this.live.pathFor(botId); // validates the key before it reaches a path
        ids = [deletedRow.homeSnapshotId, deletedRow.homePreviousSnapshotId];
      } else {
        const row = await this.row(botId, context).catch(() => null);
        if (!row) return;
        ids = [row.homeSnapshotId, row.homePreviousSnapshotId];
        await this.prisma.computer.updateMany({
          where: { id: row.id, spaceId: context.spaceId },
          data: { homeSnapshotId: null, homePreviousSnapshotId: null, homeRevision: "empty" },
        });
      }
      for (const id of ids) if (id) await this.artifacts.remove(id, context);
      await removeTree(this.live.pathFor(botId));
      await removeTree(this.cacheRoot(botId));
      await removeTree(this.syncDir(botId));
    });
  }

  private async row(botId: string, context: AdapterContext): Promise<HomeRow> {
    this.live.pathFor(botId); // validates the key before it reaches a path
    const row = await this.prisma.computer.findFirst({
      where: { homeKey: botId, spaceId: context.spaceId },
      select: HOME_COLUMNS,
    });
    if (!row) throw new Error("Agent home not found");
    return row;
  }

  /** Uploads a home that only exists in the legacy `homes/<key>` directory, once. */
  private async migrated(botId: string, row: HomeRow, context: AdapterContext) {
    if (row.homeSnapshotId) return row;
    const legacy = this.live.pathFor(botId);
    const entries = await readdir(legacy).catch(() => []);
    if (entries.length === 0) return row;
    try {
      await this.publish(botId, row, legacy, context, true);
    } catch (error) {
      if (!(error instanceof AgentHomeConflictError)) throw error; // another process migrated it
    }
    return this.row(botId, context);
  }

  /** Whether this host's live directory holds (or is newer than) the current revision. */
  private async authoritative(botId: string, row: HomeRow) {
    return (
      row.kind === "docker" &&
      (await this.savedFromLive(botId, row.homeRevision)) &&
      (await isDirectory(this.live.pathFor(botId)))
    );
  }

  /** The local store and id that hold the current revision. Reads never install into `homes/`. */
  private view(botId: string, context: AdapterContext) {
    return this.withCurrentRow(botId, context, async (row) => {
      if (await this.authoritative(botId, row)) return { store: this.live, id: botId };
      const store = new LocalAgentHomeStore(this.cacheRoot(botId));
      if (row.homeSnapshotId) {
        const directory = store.pathFor(row.homeRevision);
        if (await isDirectory(directory)) {
          await touch(sizeFile(directory));
        } else {
          const bytes = await this.install(row, context, directory, false);
          await writeFile(sizeFile(directory), String(bytes));
          await this.sweepCache();
        }
      }
      return { store, id: row.homeRevision };
    });
  }

  /** Makes the live directory hold the current revision if it may; returns whether it does. */
  private async prepareLive(
    botId: string,
    row: HomeRow,
    context: AdapterContext,
    unmounted?: () => Promise<boolean>,
  ) {
    const directory = this.live.pathFor(botId);
    if (!row.homeSnapshotId) {
      await mkdir(directory, { recursive: true });
      await this.markLive(botId, row.homeRevision);
      return true;
    }
    if (await isDirectory(directory)) {
      if (await this.savedFromLive(botId, row.homeRevision)) return true;
      if (!unmounted || !(await unmounted())) return false;
      await this.install(row, context, directory, true);
    } else {
      await this.install(row, context, directory, false);
    }
    await this.markLive(botId, row.homeRevision);
    return true;
  }

  /**
   * Extracts the row's snapshot into a new directory beside `directory`, then renames it into
   * place, and returns the bytes extracted. With `replace` (only for a directory the caller
   * confirmed nothing mounts), the existing directory is moved aside and deleted. Without it, a
   * directory that appears meanwhile (another process installed it first) is kept, and this
   * extraction is discarded.
   */
  private async install(
    row: HomeRow,
    context: AdapterContext,
    directory: string,
    replace: boolean,
  ): Promise<number> {
    const parent = path.dirname(directory);
    const fresh = path.join(parent, `.${path.basename(directory)}.install-${randomUUID()}`);
    const aside = `${fresh}.old`;
    const scratch = await this.scratch();
    try {
      await mkdir(parent, { recursive: true });
      const { bytes } = await this.heavy(async () => {
        const archive = path.join(scratch, "home.tgz");
        await this.download(row.homeSnapshotId!, archive, context);
        return unpackArchive(archive, fresh);
      });
      if (replace) {
        await rename(directory, aside).catch(ignoreMissing);
        try {
          await rename(fresh, directory);
        } catch (error) {
          await rename(aside, directory).catch(() => undefined);
          throw error;
        }
        await removeTree(aside);
        // ponytail: an empty directory created in the instant between this check and the rename
        // is still replaced; Node has no rename that refuses to replace.
      } else if (!(await lstat(directory).catch(() => null))) {
        await rename(fresh, directory).catch(async (error: NodeJS.ErrnoException) => {
          if (!(await isDirectory(directory))) throw error;
        });
      }
      return bytes;
    } finally {
      await removeTree(fresh);
      await removeTree(scratch);
    }
  }

  /**
   * Runs `work` with the current row. A save may retire the snapshot id read a moment before a
   * download; then the row is read once more.
   */
  private async withCurrentRow<T>(
    botId: string,
    context: AdapterContext,
    work: (row: HomeRow) => Promise<T>,
  ): Promise<T> {
    const row = await this.migrated(botId, await this.row(botId, context), context);
    try {
      return await work(row);
    } catch (error) {
      if (!isMissingObject(error)) throw error;
      const again = await this.row(botId, context);
      if (again.homeSnapshotId === row.homeSnapshotId) throw error;
      return work(again);
    }
  }

  /** Applies a change to the current revision and publishes it, retrying when another process saves first. */
  private edit(
    botId: string,
    context: AdapterContext,
    change: (store: LocalAgentHomeStore, id: string) => Promise<void>,
  ) {
    return this.locked(botId, async () => {
      let row = await this.migrated(botId, await this.row(botId, context), context);
      if (await this.authoritative(botId, row)) {
        await change(this.live, botId);
        return this.saveLive(botId, context);
      }
      for (let attempt = 1; ; attempt++) {
        const scratch = await this.scratch();
        try {
          const store = new LocalAgentHomeStore(scratch);
          const copy = store.pathFor("home");
          if (row.homeSnapshotId) {
            await mkdir(path.dirname(copy));
            await this.heavy(async () => {
              const archive = path.join(scratch, "home.tgz");
              await this.download(row.homeSnapshotId!, archive, context);
              await unpackArchive(archive, copy);
            });
          }
          await change(store, "home");
          return await this.publish(botId, row, copy, context);
        } catch (error) {
          // Lost the revision race, or a save retired the snapshot this copy was made from.
          const retry = error instanceof AgentHomeConflictError || isMissingObject(error);
          if (!retry || attempt >= SAVE_ATTEMPTS) throw error;
          row = await this.row(botId, context);
        } finally {
          await removeTree(scratch);
        }
      }
    });
  }

  /**
   * Saves the live directory. When another process wins the swap, its archive may already hold
   * everything written before this call: if that save started reading the directory after this
   * call began, its revision is returned. Otherwise the directory is archived again.
   */
  private async saveLive(botId: string, context: AdapterContext) {
    const requestedAt = Date.now();
    for (let attempt = 1; ; attempt++) {
      // No legacy migration step here: the first save of this directory is that migration.
      const row = await this.row(botId, context);
      try {
        return await this.publish(botId, row, this.live.pathFor(botId), context, true);
      } catch (error) {
        if (!(error instanceof AgentHomeConflictError) || attempt >= SAVE_ATTEMPTS) throw error;
        const current = await this.row(botId, context);
        if (
          packedAt(current.homeRevision) > requestedAt &&
          (await this.savedFromLive(botId, current.homeRevision))
        ) {
          return current.homeRevision;
        }
      }
    }
  }

  /**
   * Archives `source`, uploads it, and swaps the row to the new snapshot only if its revision is
   * still the one in `row`. The swap is one conditional UPDATE, so it is the only point where
   * writers race, and the loser deletes its upload.
   */
  private async publish(
    botId: string,
    row: HomeRow,
    source: string,
    context: AdapterContext,
    fromLive = false,
  ) {
    const scratch = await this.scratch();
    let started = 0;
    try {
      const stored = await this.heavy(async () => {
        started = Date.now();
        const archive = path.join(scratch, "home.tgz");
        await mkdir(source, { recursive: true });
        const { skipped } = await packDirectory(source, archive);
        if (skipped.changed.length > 0) {
          getLogger().warn("agent home entries changed while saving and were left out", {
            homeKey: botId,
            count: skipped.changed.length,
          });
        }
        if (skipped.unreadable.length > 0) {
          getLogger().warn("agent home entries cannot be read or stored and were left out", {
            homeKey: botId,
            count: skipped.unreadable.length,
          });
        }
        return this.upload(botId, archive, context);
      });
      // The time the archive started reading `source`; see `saveLive`.
      const revision = `rev-${started}-${randomUUID().slice(0, 8)}`;
      const won = await this.prisma.computer.updateMany({
        where: { id: row.id, spaceId: context.spaceId, homeRevision: row.homeRevision },
        data: {
          homeRevision: revision,
          homeSnapshotId: stored.id,
          homePreviousSnapshotId: row.homeSnapshotId,
        },
      });
      if (won.count !== 1) {
        await this.artifacts.remove(stored.id, context).catch(() => undefined);
        throw new AgentHomeConflictError(botId);
      }
      if (fromLive) await this.markLive(botId, revision);
      // Keep the snapshot just replaced for one more save, so a reader holding its id can finish.
      if (row.homePreviousSnapshotId) {
        await this.artifacts.remove(row.homePreviousSnapshotId, context).catch(() => undefined);
      }
      return revision;
    } finally {
      await removeTree(scratch);
    }
  }

  private upload(botId: string, file: string, context: AdapterContext) {
    const meta = { path: file, name: `home-${botId}.tgz`, mimeType: "application/gzip" };
    if (this.artifacts.putFile) return this.artifacts.putFile(meta, context);
    return readFile(file).then((bytes) => this.artifacts.put({ ...meta, bytes }, context));
  }

  private async download(id: string, destination: string, context: AdapterContext) {
    if (this.artifacts.getFile) return this.artifacts.getFile(id, destination, context);
    await writeFile(destination, await this.artifacts.get(id, context), { flag: "wx" });
  }

  private async scratch() {
    this.leftovers ??= this.removeLeftovers().catch((error) => {
      getLogger().error("agent home leftover cleanup", error);
    });
    await this.leftovers;
    const root = path.join(this.dataDir, "home-staging");
    await mkdir(root, { recursive: true });
    return mkdtemp(path.join(root, "op-"));
  }

  /**
   * Deletes scratch and install folders a crashed process left behind, once per store. Age, not
   * name, protects folders another live process is still using.
   */
  private async removeLeftovers() {
    const cutoff = Date.now() - LEFTOVER_MS;
    const sweep = async (directory: string, match: (name: string) => boolean) => {
      for (const name of await readdir(directory).catch(() => [])) {
        if (!match(name)) continue;
        const info = await lstat(path.join(directory, name)).catch(() => null);
        if (info && info.mtimeMs < cutoff) await removeTree(path.join(directory, name));
      }
    };
    const installing = (name: string) => name.startsWith(".") && name.includes(".install-");
    await sweep(path.join(this.dataDir, "home-staging"), (name) => name.startsWith("op-"));
    await sweep(path.join(this.dataDir, "homes"), installing);
    const cache = path.join(this.dataDir, "home-cache");
    for (const key of await readdir(cache).catch(() => [])) {
      await sweep(path.join(cache, key, "homes"), installing);
    }
  }

  private cacheRoot(botId: string) {
    return path.join(this.dataDir, "home-cache", botId);
  }

  /**
   * Bounds the read cache across all homes. Nothing used within the reader grace period is
   * removed; beyond it, older revisions of a home go first, then anything unused for a day, then
   * the least recently used until the cache is under its size cap.
   */
  private async sweepCache() {
    const now = Date.now();
    const cache = path.join(this.dataDir, "home-cache");
    const entries: Array<{ directory: string; key: string; used: number; bytes: number }> = [];
    for (const key of await readdir(cache).catch(() => [])) {
      const homes = path.join(cache, key, "homes");
      for (const name of await readdir(homes).catch(() => [])) {
        if (name.startsWith(".")) continue;
        const directory = path.join(homes, name);
        const marker = await stat(sizeFile(directory)).catch(() => null);
        const bytes = Number(await readFile(sizeFile(directory), "utf8").catch(() => "0")) || 0;
        const used = marker?.mtimeMs ?? (await lstat(directory).catch(() => null))?.mtimeMs ?? 0;
        entries.push({ directory, key, used, bytes });
      }
    }
    const newest = new Map<string, number>();
    for (const entry of entries)
      newest.set(entry.key, Math.max(newest.get(entry.key) ?? 0, entry.used));
    const expired = (entry: (typeof entries)[number]) =>
      now - entry.used > CACHE_TTL_MS ||
      (entry.used < newest.get(entry.key)! && now - entry.used > CACHE_READER_GRACE_MS);
    let total = 0;
    const kept = [];
    for (const entry of entries) {
      if (expired(entry)) await this.dropCached(entry.directory);
      else {
        kept.push(entry);
        total += entry.bytes;
      }
    }
    for (const entry of kept.sort((a, b) => a.used - b.used)) {
      if (total <= this.cacheMaxBytes) break;
      if (now - entry.used <= CACHE_READER_GRACE_MS) continue;
      await this.dropCached(entry.directory);
      total -= entry.bytes;
    }
  }

  private async dropCached(directory: string) {
    await removeTree(directory);
    await removeTree(sizeFile(directory));
  }

  private syncDir(botId: string) {
    return path.join(this.dataDir, "home-sync", botId);
  }

  /**
   * One empty file per revision saved from (or installed into) the live directory on this host.
   * Writers only add their own file and delete older ones, so concurrent saves never remove each
   * other's record of a newer revision.
   */
  private async markLive(botId: string, revision: string) {
    const directory = this.syncDir(botId);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, revision), "");
    const saved = packedAt(revision);
    for (const name of await readdir(directory)) {
      if (name !== revision && packedAt(name) <= saved) {
        await removeTree(path.join(directory, name));
      }
    }
  }

  private savedFromLive(botId: string, revision: string) {
    return stat(path.join(this.syncDir(botId), revision)).then(
      () => true,
      () => false,
    );
  }

  /** Serializes work on one home inside this process. Across processes the revision swap decides. */
  private locked<T>(botId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(botId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(work);
    const tail = run.catch(() => undefined);
    this.chains.set(botId, tail);
    void tail.then(() => {
      if (this.chains.get(botId) === tail) this.chains.delete(botId);
    });
    return run;
  }
}

/** Beside each cached revision: its size in bytes, with the file's mtime as the time it was last used. */
function sizeFile(directory: string) {
  return path.join(path.dirname(directory), `.${path.basename(directory)}.size`);
}

async function touch(file: string) {
  const now = new Date();
  await utimes(file, now, now).catch(() => writeFile(file, "0"));
}

/** A snapshot that is gone: a local store reports ENOENT, S3 a 404. */
function isMissingObject(error: unknown) {
  if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return true;
  return /\b404\b|NoSuchKey|not found/i.test(String((error as Error)?.message));
}

/** The time a revision's archive started reading its source; 0 for "empty" and older ids. */
function packedAt(revision: string) {
  return Number(/^rev-(\d+)-/.exec(revision)?.[1] ?? 0);
}

function semaphore(limit: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async <T>(work: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await work();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

async function isDirectory(target: string) {
  return (await lstat(target).catch(() => null))?.isDirectory() === true;
}

function ignoreMissing(error: unknown) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

/** Object-storage homes by default; `RAKAZO_AGENT_HOME_STORE=local` is the development opt-out. */
export function createAgentHomeStore(
  env: Record<string, string | undefined>,
  prisma: ObjectHomePrisma,
  artifacts: ArtifactStore,
  dataDir: string,
): AgentHomeStore {
  return env.RAKAZO_AGENT_HOME_STORE === "local"
    ? new LocalAgentHomeStore(dataDir)
    : new ObjectAgentHomeStore(prisma, artifacts, dataDir);
}
