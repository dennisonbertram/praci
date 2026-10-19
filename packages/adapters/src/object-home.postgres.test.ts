import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDb, type PrismaClient } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
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
    const { mkdir } = await import("node:fs/promises");
    await mkdir(path.join(dataDir, "homes", homeKey), { recursive: true });
    await writeFile(path.join(dataDir, "homes", homeKey, "old.txt"), "legacy");
    const artifacts = new LocalArtifactStore(artifactDir);
    const a = new ObjectAgentHomeStore(prisma, artifacts, dataDir);
    const b = new ObjectAgentHomeStore(prisma, artifacts, dataDir);
    const [pathA, pathB] = await Promise.all([
      a.liveDirectory(homeKey, ctx()),
      b.liveDirectory(homeKey, ctx()),
    ]);
    expect(pathA).toBe(pathB);
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

  it("does not expose a home to another space", async () => {
    const store = new ObjectAgentHomeStore(
      prisma,
      new LocalArtifactStore(await tmp()),
      await tmp(),
    );
    await expect(store.list(homeKey, "", ctx(`other-${spaceId}`))).rejects.toThrow(/not found/);
  });
});
