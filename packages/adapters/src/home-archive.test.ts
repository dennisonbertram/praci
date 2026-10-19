import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as tar from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
import { packDirectory, skipSnapshotPath, unpackArchive } from "./home-archive.js";
import { ObjectAgentHomeStore } from "./object-home.js";

const dirs: string[] = [];
async function tmp() {
  const dir = await mkdtemp(path.join(tmpdir(), "rakazo-archive-"));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("home archives", () => {
  it("skips a file that vanishes while the archive is written", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, "a.txt"), "A");
    await writeFile(path.join(dir, "b.txt"), "B");
    const archive = path.join(await tmp(), "o.tgz");
    let removed = false;
    await packDirectory(dir, archive, (relative) => {
      if (relative === "a.txt" && !removed) {
        removed = true;
        void rm(path.join(dir, "b.txt"), { force: true });
      }
    });
    const out = await tmp();
    await unpackArchive(archive, out);
    expect(await readFile(path.join(out, "a.txt"), "utf8")).toBe("A");
  });

  it("refuses an archive with a path that leaves the target", async () => {
    const root = await tmp();
    await mkdir(path.join(root, "inner"));
    await writeFile(path.join(root, "escape.txt"), "x");
    const archive = path.join(await tmp(), "bad.tgz");
    await tar.create(
      { file: archive, cwd: path.join(root, "inner"), preservePaths: true, gzip: true },
      ["../escape.txt"],
    );
    const out = await tmp();
    await expect(unpackArchive(archive, out)).rejects.toThrow(/unsafe path/);
    await expect(stat(path.join(out, "escape.txt"))).rejects.toThrow();
  });

  it("leaves out browser caches but not ordinary files", () => {
    expect(skipSnapshotPath("./.cache/pip/x")).toBe(true);
    expect(skipSnapshotPath("proj/node_modules/.cache/y")).toBe(true);
    expect(skipSnapshotPath("proj/src/cache.ts")).toBe(false);
  });
});

describe("a 300 MB home", () => {
  it("saves and restores with bounded memory and without blocking the event loop", async () => {
    const source = await tmp();
    for (let i = 0; i < 30; i++) {
      const chunk =
        i % 10 === 0 ? randomBytes(10 * 1024 * 1024) : Buffer.alloc(10 * 1024 * 1024, i);
      await writeFile(path.join(source, `file-${i}.bin`), chunk);
    }
    const dataDir = await tmp();
    const artifactDir = await tmp();
    const row = {
      id: "c1",
      spaceId: "s",
      homeKey: "k",
      homeRevision: "empty",
      homeSnapshotId: null,
      homePreviousSnapshotId: null,
    };
    const prisma = {
      computer: {
        findFirst: async () => ({ ...row }),
        updateMany: async ({ data }: { data: Partial<typeof row> }) => {
          Object.assign(row, data);
          return { count: 1 };
        },
      },
      $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
        work({ $executeRaw: async () => 0 }),
    };
    const ctx = {
      operationId: "o",
      traceId: "t",
      spaceId: "s",
      userId: "u",
      signal: new AbortController().signal,
    };
    const store = new ObjectAgentHomeStore(
      prisma as never,
      new LocalArtifactStore(artifactDir),
      dataDir,
    );

    const baseline = process.memoryUsage().rss;
    let peak = baseline;
    let worstLag = 0;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      worstLag = Math.max(worstLag, now - last - 50);
      last = now;
      peak = Math.max(peak, process.memoryUsage().rss);
    }, 50);
    try {
      await store.commit("k", source, ctx);
      const other = new ObjectAgentHomeStore(
        prisma as never,
        new LocalArtifactStore(artifactDir),
        await tmp(),
      );
      const live = await other.liveDirectory("k", ctx);
      expect((await stat(path.join(live, "file-29.bin"))).size).toBe(10 * 1024 * 1024);
    } finally {
      clearInterval(timer);
    }
    // A whole-file implementation holds the home several times over (about 900 MB here). Streaming
    // grew about 200 MB at both 300 MB and 600 MB of data, so the growth does not follow home size.
    expect(peak - baseline).toBeLessThan(260 * 1024 * 1024);
    expect(worstLag).toBeLessThan(2000);
  }, 180_000);
});
