import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  AdapterContext,
  AgentHomeStore,
  ArtifactStore,
  PortableFile,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { LocalAgentHomeStore } from "./home.js";

/** Another writer published a newer revision of this home first. */
export class AgentHomeConflictError extends Error {
  constructor(homeKey: string) {
    super(`Agent home ${homeKey} changed while it was being saved`);
    this.name = "AgentHomeConflictError";
  }
}

const MANIFEST = ".rakazo-snapshot.json";

/** Zip of the home's files plus a manifest of executable paths (zip entries here carry no mode). */
export function packHome(files: PortableFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  const executable: string[] = [];
  for (const file of files) {
    if (file.path === MANIFEST) continue;
    entries[file.path] = file.content;
    if (file.executable) executable.push(file.path);
  }
  entries[MANIFEST] = strToU8(JSON.stringify({ executable }));
  return zipSync(entries);
}

export function unpackHome(bytes: Uint8Array): PortableFile[] {
  const entries = unzipSync(bytes);
  const manifest = entries[MANIFEST];
  const executable = new Set<string>(
    manifest ? (JSON.parse(strFromU8(manifest)) as { executable: string[] }).executable : [],
  );
  return Object.entries(entries)
    .filter(([name]) => name !== MANIFEST && !name.endsWith("/"))
    .map(([name, content]) => ({ path: name, content, executable: executable.has(name) }));
}

type HomeRow = { id: string; homeRevision: string; homeSnapshotId: string | null };

/**
 * Keeps each Computer's home as one zip snapshot in the artifact store, with the current
 * revision and snapshot id on the Computer row. `DATA_DIR/homes/<key>` is only a working copy:
 * the Docker supervisor mounts it, and reads use it. It is refreshed from the snapshot whenever
 * the recorded revision differs from the revision it last synced.
 *
 * Every operation looks the Computer up by home key and the caller's space, so one space cannot
 * touch another's home. Team Computers are shared inside their space, so the user is not checked.
 */
export class ObjectAgentHomeStore implements AgentHomeStore {
  private readonly working: LocalAgentHomeStore;
  private readonly syncDir: string;
  private readonly chains = new Map<string, Promise<unknown>>();

  constructor(
    private readonly prisma: Pick<PrismaClient, "computer">,
    private readonly artifacts: ArtifactStore,
    dataDir: string,
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
    await this.exclusive(botId, () => this.current(botId, context));
    return this.working.checkout(botId, dest, context);
  }

  async commit(botId: string, src: string, context: AdapterContext, expectedRevision?: string) {
    return this.exclusive(botId, async () => {
      const row = await this.row(botId, context);
      if (expectedRevision !== undefined && expectedRevision !== row.homeRevision) {
        throw new AgentHomeConflictError(botId);
      }
      await this.working.commit(botId, src, context);
      return this.publish(botId, row, context);
    });
  }

  async revise(botId: string, context: AdapterContext) {
    return this.exclusive(botId, async () =>
      this.publish(botId, await this.row(botId, context), context),
    );
  }

  async liveDirectory(botId: string, context: AdapterContext) {
    await this.exclusive(botId, () => this.current(botId, context));
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
    await this.exclusive(botId, () => this.current(botId, context));
    yield* this.working.exportHome(botId, context, options);
  }

  async readFile(
    botId: string,
    filePath: string,
    context: AdapterContext,
    options?: { maxBytes?: number },
  ) {
    await this.exclusive(botId, () => this.current(botId, context));
    return this.working.readFile(botId, filePath, context, options);
  }

  async writeFile(botId: string, filePath: string, content: string, context: AdapterContext) {
    await this.exclusive(botId, async () => {
      const row = await this.current(botId, context);
      await this.working.writeFile(botId, filePath, content, context);
      await this.publish(botId, row, context);
    });
  }

  async list(botId: string, dirPath: string, context: AdapterContext) {
    await this.exclusive(botId, () => this.current(botId, context));
    return this.working.list(botId, dirPath, context);
  }

  async removeEntry(botId: string, parent: string, name: string, context: AdapterContext) {
    await this.exclusive(botId, async () => {
      const row = await this.current(botId, context);
      await this.working.removeEntry(botId, parent, name, context);
      await this.publish(botId, row, context);
    });
  }

  async remove(botId: string, context: AdapterContext, stored?: { snapshotId?: string | null }) {
    await this.exclusive(botId, async () => {
      const row = await this.prisma.computer.findFirst({
        where: { homeKey: botId, spaceId: context.spaceId },
        select: { id: true, homeSnapshotId: true },
      });
      const snapshotId = row?.homeSnapshotId ?? stored?.snapshotId;
      if (snapshotId) await this.artifacts.remove(snapshotId, context);
      if (row) {
        await this.prisma.computer.updateMany({
          where: { id: row.id, spaceId: context.spaceId },
          data: { homeSnapshotId: null, homeRevision: "empty" },
        });
      }
      await this.working.remove(botId);
      await rm(this.markerPath(botId), { force: true });
    });
  }

  private async row(botId: string, context: AdapterContext): Promise<HomeRow> {
    this.working.pathFor(botId); // validates the key before it reaches a path
    const row = await this.prisma.computer.findFirst({
      where: { homeKey: botId, spaceId: context.spaceId },
      select: { id: true, homeRevision: true, homeSnapshotId: true },
    });
    if (!row) throw new Error("Agent home not found");
    return row;
  }

  /** Makes the working copy match the stored snapshot, uploading a legacy local home once. */
  private async current(botId: string, context: AdapterContext): Promise<HomeRow> {
    let row = await this.row(botId, context);
    if (!row.homeSnapshotId) {
      const legacy = await stat(this.working.pathFor(botId)).catch(() => null);
      if (!legacy?.isDirectory()) return row;
      try {
        await this.publish(botId, row, context);
        return await this.row(botId, context);
      } catch (error) {
        if (!(error instanceof AgentHomeConflictError)) throw error;
        row = await this.row(botId, context); // another worker migrated first
        if (!row.homeSnapshotId) throw error;
      }
    }
    if ((await this.synced(botId)) !== row.homeRevision) await this.install(botId, row, context);
    return row;
  }

  private async install(botId: string, row: HomeRow, context: AdapterContext) {
    const bytes = await this.artifacts.get(row.homeSnapshotId!, context);
    const staging = await mkdtemp(path.join(tmpdir(), "rakazo-home-"));
    try {
      for (const file of unpackHome(bytes)) {
        const relative = path.posix.normalize(file.path);
        if (relative.startsWith("../") || relative === ".." || path.posix.isAbsolute(relative)) {
          throw new Error("Home snapshot contains an unsafe path");
        }
        const target = path.join(staging, relative);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content);
        await chmod(target, file.executable ? 0o755 : 0o644);
      }
      await this.working.commit(botId, staging, context);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    await this.mark(botId, row.homeRevision);
  }

  /** Uploads the working copy and swaps the row's revision only if nobody else did meanwhile. */
  private async publish(botId: string, row: HomeRow, context: AdapterContext) {
    const files: PortableFile[] = [];
    for await (const file of this.working.exportHome(botId, context)) files.push(file);
    const stored = await this.artifacts.put(
      { name: `home-${botId}.zip`, mimeType: "application/zip", bytes: packHome(files) },
      context,
    );
    const revision = `rev-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const won = await this.prisma.computer.updateMany({
      where: { id: row.id, spaceId: context.spaceId, homeRevision: row.homeRevision },
      data: { homeRevision: revision, homeSnapshotId: stored.id },
    });
    if (won.count !== 1) {
      await this.artifacts.remove(stored.id, context).catch(() => undefined);
      throw new AgentHomeConflictError(botId);
    }
    if (row.homeSnapshotId)
      await this.artifacts.remove(row.homeSnapshotId, context).catch(() => undefined);
    await this.mark(botId, revision);
    return revision;
  }

  private markerPath(botId: string) {
    return path.join(this.syncDir, `${botId}.txt`);
  }

  private async synced(botId: string) {
    return readFile(this.markerPath(botId), "utf8").catch(() => undefined);
  }

  private async mark(botId: string, revision: string) {
    await mkdir(this.syncDir, { recursive: true });
    await writeFile(this.markerPath(botId), revision, "utf8");
  }

  private exclusive<T>(botId: string, work: () => Promise<T>): Promise<T> {
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

/** Object-storage homes by default; `RAKAZO_AGENT_HOME_STORE=local` is the development opt-out. */
export function createAgentHomeStore(
  env: Record<string, string | undefined>,
  prisma: Pick<PrismaClient, "computer">,
  artifacts: ArtifactStore,
  dataDir: string,
): AgentHomeStore {
  return env.RAKAZO_AGENT_HOME_STORE === "local"
    ? new LocalAgentHomeStore(dataDir)
    : new ObjectAgentHomeStore(prisma, artifacts, dataDir);
}
