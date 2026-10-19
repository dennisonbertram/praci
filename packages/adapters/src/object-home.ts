import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AdapterContext,
  AgentHomeStore,
  ArtifactStore,
  PortableFile,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { LocalAgentHomeStore } from "./home.js";
import { packDirectory, syncDirectoryInPlace, unpackArchive } from "./home-archive.js";

/** Another writer published a newer revision of this home first. */
export class AgentHomeConflictError extends Error {
  constructor(homeKey: string) {
    super(`Agent home ${homeKey} changed while it was being saved`);
    this.name = "AgentHomeConflictError";
  }
}

type HomeRow = {
  id: string;
  homeRevision: string;
  homeSnapshotId: string | null;
  homePreviousSnapshotId: string | null;
};
const HOME_COLUMNS = {
  id: true,
  homeRevision: true,
  homeSnapshotId: true,
  homePreviousSnapshotId: true,
} as const;

/** Upper bound for one save or restore, including the time spent waiting on another process. */
const LOCK_TIMEOUT_MS = 15 * 60_000;

export type ObjectHomePrisma = Pick<PrismaClient, "computer" | "$transaction">;

/**
 * Keeps each Computer's home as one gzip tar snapshot in the artifact store, with the current
 * revision and snapshot id on the Computer row. `DATA_DIR/homes/<key>` is only a working copy: the
 * Docker supervisor mounts it, and reads use it. It is refreshed from the snapshot whenever the
 * recorded revision differs from the revision it last synced, and it is updated in place, never
 * replaced, so a mounted directory stays valid.
 *
 * Every operation looks the Computer up by home key and the caller's space, so one space cannot
 * touch another's home. Team Computers are shared inside their space, so the user is not checked.
 * Operations on one home are serialized across processes with a Postgres advisory lock.
 */
export class ObjectAgentHomeStore implements AgentHomeStore {
  private readonly working: LocalAgentHomeStore;
  private readonly syncDir: string;
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: ObjectHomePrisma,
    private readonly artifacts: ArtifactStore,
    private readonly dataDir: string,
  ) {
    this.working = new LocalAgentHomeStore(dataDir);
    this.syncDir = path.join(dataDir, "home-sync");
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
    await this.locked(botId, () => this.current(botId, context));
    return this.working.checkout(botId, dest, context);
  }

  /**
   * Saves the contents of `src` as the new snapshot. The working copy is not touched; it is
   * refreshed from the snapshot the next time it is read.
   */
  async commit(botId: string, src: string, context: AdapterContext, expectedRevision?: string) {
    return this.locked(botId, async () => {
      const row = await this.row(botId, context);
      if (expectedRevision !== undefined && expectedRevision !== row.homeRevision) {
        throw new AgentHomeConflictError(botId);
      }
      return this.publish(botId, row, context, src, false);
    });
  }

  /**
   * Saves the live directory. It is rejected when the stored revision is not the one this working
   * copy last synced (another worker saved since) or not `expectedRevision`.
   */
  async revise(botId: string, context: AdapterContext, expectedRevision?: string) {
    return this.locked(botId, async () => {
      const row = await this.row(botId, context);
      if (
        (expectedRevision !== undefined && expectedRevision !== row.homeRevision) ||
        (row.homeSnapshotId && (await this.synced(botId)) !== row.homeRevision)
      ) {
        await this.invalidate(botId);
        throw new AgentHomeConflictError(botId);
      }
      return this.publish(botId, row, context, this.working.pathFor(botId), true);
    });
  }

  async liveDirectory(botId: string, context: AdapterContext) {
    await this.locked(botId, () => this.current(botId, context));
    return this.working.liveDirectory(botId);
  }

  async restore(botId: string, _revision: string, dest: string, context: AdapterContext) {
    await this.checkout(botId, dest, context);
  }

  async *exportHome(
    botId: string,
    context: AdapterContext,
    options?: { directory?: string; skipHidden?: boolean },
  ): AsyncIterable<PortableFile> {
    await this.locked(botId, () => this.current(botId, context));
    yield* this.working.exportHome(botId, context, options);
  }

  async readFile(
    botId: string,
    filePath: string,
    context: AdapterContext,
    options?: { maxBytes?: number },
  ) {
    await this.locked(botId, () => this.current(botId, context));
    return this.working.readFile(botId, filePath, context, options);
  }

  async writeFile(botId: string, filePath: string, content: string, context: AdapterContext) {
    await this.locked(botId, async () => {
      const row = await this.current(botId, context);
      await this.working.writeFile(botId, filePath, content, context);
      await this.publish(botId, row, context, this.working.pathFor(botId), true);
    });
  }

  async list(botId: string, dirPath: string, context: AdapterContext) {
    await this.locked(botId, () => this.current(botId, context));
    return this.working.list(botId, dirPath, context);
  }

  async removeEntry(botId: string, parent: string, name: string, context: AdapterContext) {
    await this.locked(botId, async () => {
      const row = await this.current(botId, context);
      await this.working.removeEntry(botId, parent, name, context);
      await this.publish(botId, row, context, this.working.pathFor(botId), true);
    });
  }

  /** Deletes both stored snapshots and the working copy. Does nothing unless the Computer is found in this space. */
  async remove(botId: string, context: AdapterContext) {
    await this.locked(botId, async () => {
      const row = await this.row(botId, context).catch(() => null);
      if (!row) return;
      for (const id of [row.homeSnapshotId, row.homePreviousSnapshotId]) {
        if (id) await this.artifacts.remove(id, context);
      }
      await this.prisma.computer.updateMany({
        where: { id: row.id, spaceId: context.spaceId },
        data: { homeSnapshotId: null, homePreviousSnapshotId: null, homeRevision: "empty" },
      });
      await this.working.remove(botId);
      await rm(this.markerPath(botId), { force: true });
    });
  }

  private async row(botId: string, context: AdapterContext): Promise<HomeRow> {
    this.working.pathFor(botId); // validates the key before it reaches a path
    const row = await this.prisma.computer.findFirst({
      where: { homeKey: botId, spaceId: context.spaceId },
      select: HOME_COLUMNS,
    });
    if (!row) throw new Error("Agent home not found");
    return row;
  }

  /** Makes the working copy match the stored snapshot, uploading a legacy local home once. */
  private async current(botId: string, context: AdapterContext, retried = false): Promise<HomeRow> {
    let row = await this.row(botId, context);
    if (!row.homeSnapshotId) {
      const legacy = await stat(this.working.pathFor(botId)).catch(() => null);
      if (!legacy?.isDirectory()) return row;
      try {
        await this.publish(botId, row, context, this.working.pathFor(botId), true);
        return await this.row(botId, context);
      } catch (error) {
        if (!(error instanceof AgentHomeConflictError)) throw error;
        row = await this.row(botId, context); // another worker migrated first
        if (!row.homeSnapshotId) throw error;
      }
    }
    if ((await this.synced(botId)) !== row.homeRevision) {
      try {
        await this.install(botId, row, context);
      } catch (error) {
        // A save may have retired the snapshot id read a moment ago; read the row once more.
        if (retried || !/not found/i.test(String((error as Error)?.message))) throw error;
        return this.current(botId, context, true);
      }
    }
    return row;
  }

  private async install(botId: string, row: HomeRow, context: AdapterContext) {
    const scratch = await this.scratch();
    try {
      const archive = path.join(scratch, "home.tgz");
      await this.download(row.homeSnapshotId!, archive, context);
      const extracted = path.join(scratch, "files");
      await unpackArchive(archive, extracted);
      await syncDirectoryInPlace(extracted, this.working.pathFor(botId));
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
    await this.mark(botId, row.homeRevision);
  }

  /**
   * Archives `source`, uploads it and swaps the row's revision only if nobody else did meanwhile.
   * When `source` is the working copy it is marked as synced before any cleanup, so another
   * process never sees the new revision with a marker that still calls the copy stale.
   */
  private async publish(
    botId: string,
    row: HomeRow,
    context: AdapterContext,
    source: string,
    isWorkingCopy: boolean,
  ) {
    const scratch = await this.scratch();
    try {
      const archive = path.join(scratch, "home.tgz");
      await packDirectory(source, archive);
      const stored = await this.upload(botId, archive, context);
      const revision = `rev-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
        await this.invalidate(botId);
        throw new AgentHomeConflictError(botId);
      }
      if (isWorkingCopy) await this.mark(botId, revision);
      else await this.invalidate(botId);
      // Keep the snapshot just replaced for one more save, so a reader holding its id can finish.
      if (row.homePreviousSnapshotId) {
        await this.artifacts.remove(row.homePreviousSnapshotId, context).catch(() => undefined);
      }
      return revision;
    } finally {
      await rm(scratch, { recursive: true, force: true });
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
    const root = path.join(this.dataDir, "home-staging");
    await mkdir(root, { recursive: true });
    return mkdtemp(path.join(root, "op-"));
  }

  private markerPath(botId: string) {
    return path.join(this.syncDir, `${botId}.txt`);
  }

  private synced(botId: string) {
    return readFile(this.markerPath(botId), "utf8").catch(() => undefined);
  }

  private async mark(botId: string, revision: string) {
    await mkdir(this.syncDir, { recursive: true });
    await writeFile(this.markerPath(botId), revision, "utf8");
  }

  /** Marks the working copy as not matching any revision, so the next read refreshes it. */
  private invalidate(botId: string) {
    return this.mark(botId, "stale");
  }

  /** Serializes work on one home inside this process, then across processes with an advisory lock. */
  private locked<T>(botId: string, work: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(botId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => this.withAdvisoryLock(botId, work));
    const tail = run.catch(() => undefined);
    this.chains.set(botId, tail);
    void tail.then(() => {
      if (this.chains.get(botId) === tail) this.chains.delete(botId);
    });
    return run;
  }

  private withAdvisoryLock<T>(botId: string, work: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rakazo:agent-home:${botId}`}, 0))`;
        return work();
      },
      { timeout: LOCK_TIMEOUT_MS, maxWait: LOCK_TIMEOUT_MS },
    );
  }
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
