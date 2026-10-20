import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { JobPublisher } from "@rakazo/adapter-kit";
import type { ThreadEvents } from "@rakazo/db";
import { createDb, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
import { provisionComputer } from "./computer-lifecycle.js";
import { FakeSandboxProvider } from "./fake-sandbox.js";
import { AgentHomeConflictError, ObjectAgentHomeStore } from "./object-home.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE === "1" && databaseUrl ? describe.sequential : describe.skip;

describePostgres("object-storage agent homes (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `home-org-${suffix}`;
  const spaceId = `home-space-${suffix}`;
  const userId = `home-user-${suffix}`;
  const homeKey = `home-key-${suffix}`;
  const dirs: string[] = [];
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const ctx = (id = spaceId) => ({
    operationId: "o",
    traceId: "t",
    spaceId: id,
    userId,
    signal: new AbortController().signal,
  });
  const tmp = async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "rakazo-home-pg-"));
    dirs.push(dir);
    return dir;
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Home Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: spaceId } });
    await prisma.computer.create({
      data: { spaceId, userId, scopeKey: `team:${spaceId}`, homeKey, kind: "docker" },
    });
  });

  afterAll(async () => {
    await prisma.computer.deleteMany({ where: { spaceId } });
    await prisma.space.deleteMany({ where: { id: spaceId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("migrates a legacy home once when two processes share the volume and race", async () => {
    const dataDir = await tmp();
    const artifactDir = await tmp();
    await mkdir(path.join(dataDir, "homes", homeKey), { recursive: true });
    await writeFile(path.join(dataDir, "homes", homeKey, "old.txt"), "legacy");
    const artifacts = new LocalArtifactStore(artifactDir);
    const a = new ObjectAgentHomeStore(prisma, artifacts, dataDir);
    const b = new ObjectAgentHomeStore(prisma, artifacts, dataDir);
    const [liveA, liveB] = await Promise.all([
      a.liveDirectory(homeKey, ctx()),
      b.liveDirectory(homeKey, ctx()),
    ]);
    const pathA = liveA.path;
    expect(pathA).toBe(liveB.path);
    expect(await readFile(path.join(pathA, "old.txt"), "utf8")).toBe("legacy");
    const row = await prisma.computer.findFirstOrThrow({ where: { homeKey } });
    expect(row.homeSnapshotId).toBeTruthy();
    expect(row.homePreviousSnapshotId).toBeNull(); // one upload won; the other never ran
  });

  it("serializes saves from separate stores and rejects a stale revision against the real row", async () => {
    const artifacts = new LocalArtifactStore(await tmp());
    const a = new ObjectAgentHomeStore(prisma, artifacts, await tmp());
    const b = new ObjectAgentHomeStore(prisma, artifacts, await tmp());
    const src = await tmp();
    await writeFile(path.join(src, "f.txt"), "one");
    const before = (await prisma.computer.findFirstOrThrow({ where: { homeKey } })).homeRevision;
    const results = await Promise.allSettled([
      a.commit(homeKey, src, ctx(), before),
      b.commit(homeKey, src, ctx(), before),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AgentHomeConflictError);
  });

  it("runs more concurrent homes than the pool has connections without waiting on a lock", async () => {
    const db = createDb(databaseUrl!, { poolMax: 4 });
    const homes = Array.from({ length: 10 }, (_, i) => `${homeKey}-pool-${i}`);
    try {
      for (const [i, key] of homes.entries()) {
        await prisma.computer.create({
          data: { spaceId, userId, scopeKey: `pool:${suffix}:${i}`, homeKey: key, kind: "docker" },
        });
      }
      const dataDir = await tmp();
      const store = new ObjectAgentHomeStore(
        db.prisma,
        new LocalArtifactStore(await tmp()),
        dataDir,
      );
      const started = Date.now();
      await Promise.all(
        homes.map(async (key) => {
          const live = (await store.liveDirectory(key, ctx())).path;
          await writeFile(path.join(live, "f.txt"), key);
          await store.revise(key, ctx());
          await store.writeFile(key, "g.txt", "g", ctx());
          expect(await store.list(key, "", ctx())).toHaveLength(2);
        }),
      );
      // The pool waits up to 10 s for a connection; holding one per home would stall here.
      expect(Date.now() - started).toBeLessThan(8_000);
      const rows = await prisma.computer.findMany({ where: { homeKey: { in: homes } } });
      expect(rows.every((row) => row.homeSnapshotId)).toBe(true);
    } finally {
      await prisma.computer.deleteMany({ where: { homeKey: { in: homes } } });
      await db.prisma.$disconnect();
      await db.pool.end();
    }
  });

  it("lets concurrent checkpoints of one shared Docker home all succeed", async () => {
    const dataDir = await tmp();
    const artifacts = new LocalArtifactStore(await tmp());
    // Separate stores stand in for the API and worker processes on the Docker host.
    const stores = Array.from(
      { length: 4 },
      () => new ObjectAgentHomeStore(prisma, artifacts, dataDir),
    );
    const key = `${homeKey}-shared`;
    await prisma.computer.create({
      data: { spaceId, userId, scopeKey: `shared:${suffix}`, homeKey: key, kind: "docker" },
    });
    const live = (await stores[0]!.liveDirectory(key, ctx())).path;
    await Promise.all(
      stores.map(async (store, i) => {
        for (let round = 0; round < 3; round++) {
          await writeFile(path.join(live, `bot-${i}-${round}.txt`), "work");
          await store.revise(key, ctx());
        }
      }),
    );
    // The last save each bot made holds its own files: a fresh host sees all twelve.
    const reader = new ObjectAgentHomeStore(prisma, artifacts, await tmp());
    expect((await reader.list(key, "", ctx())).map((entry) => entry.path).sort()).toEqual(
      (await readdir(live)).sort(),
    );
    expect(await readdir(live)).toHaveLength(12);
  });

  it("keeps the boot claim while a legacy home migrates during provisioning", async () => {
    // Regression: the migration's snapshot swap bumped the Computer's updatedAt, which is the
    // boot claim's fence. Activation then missed, the row stayed "booting", and every run on
    // the computer was requeued as busy until the claim went stale five minutes later.
    const dataDir = await tmp();
    const key = `${homeKey}-boot`;
    await mkdir(path.join(dataDir, "homes", key), { recursive: true });
    await writeFile(path.join(dataDir, "homes", key, "old.txt"), "legacy");
    const computer = await prisma.computer.create({
      data: { spaceId, userId, scopeKey: `boot:${suffix}`, homeKey: key, kind: "docker" },
    });
    const sandbox = new FakeSandboxProvider();
    sandbox.provisionKind = async () => "docker";
    const home = new ObjectAgentHomeStore(prisma, new LocalArtifactStore(await tmp()), dataDir);
    await provisionComputer(
      { prisma, sandbox, home, jobs: {} as JobPublisher, events: {} as ThreadEvents, dataDir },
      computer.id,
      ctx(),
    );
    const row = await prisma.computer.findUniqueOrThrow({ where: { id: computer.id } });
    expect(row.homeSnapshotId).toBeTruthy();
    expect(row.state).toBe("running");
  });

  it("does not expose a home to another space", async () => {
    const store = new ObjectAgentHomeStore(
      prisma,
      new LocalArtifactStore(await tmp()),
      await tmp(),
    );
    await expect(store.list(homeKey, "", ctx(`other-${spaceId}`))).rejects.toThrow(/not found/);
  });
});
