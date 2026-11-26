import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import type { BackgroundJob } from "@rakazo/adapter-kit";
import { createBackgroundJobHandlers, LocalArtifactStore, runOmiAssemble } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mountOmiRoutes } from "./omi.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

/** Synthetic records: fake frames packed the way the pendant stores them, not real audio. */
function records(timestamps: number[], framesEach = 5): Uint8Array {
  const out = new Uint8Array(444 * timestamps.length);
  timestamps.forEach((timestamp, i) => {
    const at = i * 444;
    new DataView(out.buffer).setUint32(at, timestamp, false);
    for (let f = 0; f < framesEach; f += 1) {
      out[at + 4 + f * 41] = 40;
      out.fill(f + 1, at + 5 + f * 41, at + 45 + f * 41);
    }
  });
  return out;
}

describePostgres("Omi uploads (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let root: string;
  let artifacts: LocalArtifactStore;
  let app: Hono;
  const enqueued: BackgroundJob[] = [];
  const actors: Record<string, Actor> = {};
  const spaceIds: string[] = [];
  const connections: Record<string, string> = {};

  const client = (who: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        env: { webOrigin: "https://app.example.com" },
        jobs: { enqueue: async (job: BackgroundJob) => void enqueued.push(job) },
        artifacts,
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );

  const post = (who: string | null, url: string, body?: Uint8Array) =>
    app.request(url, {
      method: "POST",
      body: body as BodyInit | undefined,
      headers: {
        "content-type": "application/octet-stream",
        ...(who ? { "x-test-actor": who } : {}),
      },
    });
  const upload = (who: string | null, connectionId: string, firstSeq: number, body: Uint8Array) =>
    post(
      who,
      `/api/omi/records?connectionId=${connectionId}&firstSeq=${firstSeq}&codec=21&rtcValid=true`,
      body,
    );

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    root = await mkdtemp(path.join(tmpdir(), "omi-"));
    artifacts = new LocalArtifactStore(root);
    for (const label of ["a", "b"]) {
      const userId = `omi-user-${label}-${run}`;
      const orgId = `omi-org-${label}-${run}`;
      const spaceId = `omi-space-${label}-${run}`;
      await prisma.organization.create({
        data: { id: orgId, name: label, slug: orgId, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id: spaceId, organizationId: orgId, name: label, isDefault: true },
      });
      spaceIds.push(spaceId);
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      await prisma.member.create({
        data: {
          id: `omi-mem-${label}-${run}`,
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
      await prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId, userId } },
        update: {},
        create: {
          id: `omi-sm-${label}-${run}`,
          spaceId,
          organizationId: orgId,
          userId,
          createdAt: new Date(),
        },
      });
      actors[label] = { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
      connections[label] = (
        await client(actors[label]).omi.connect({
          model: "Omi",
          firmware: "3.0.0",
          hardware: "dev",
          deviceId: `device-${label}`,
        })
      ).connectionId;
    }
    app = new Hono();
    mountOmiRoutes(
      app,
      { prisma, artifacts, jobs: { enqueue: async (j) => void enqueued.push(j) } },
      async (request) => actors[request.headers.get("x-test-actor") ?? ""] ?? null,
    );
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: { in: spaceIds } } });
    await prisma.organization.deleteMany({
      where: { id: { startsWith: "omi-org-" }, slug: { endsWith: run } },
    });
    await prisma.user.deleteMany({ where: { id: { startsWith: "omi-user-", endsWith: run } } });
    await rm(root, { recursive: true, force: true });
    await close();
  });

  it("connects once per user, with a private connection and its own agent", async () => {
    const a = client(actors.a as Actor);
    const again = await a.omi.connect({
      model: "Omi",
      firmware: "3.0.1",
      hardware: "dev",
      deviceId: "device-a",
    });
    expect(again.connectionId).toBe(connections.a);
    const row = await prisma.connection.findUniqueOrThrow({ where: { id: connections.a } });
    expect(row).toMatchObject({
      connectorId: "omi",
      provider: "omi",
      privateByDefault: true,
      allAgents: false,
      metadata: { firmware: "3.0.1", deviceId: "device-a" },
    });
    expect(row.agentBotId).toBeTruthy();
    expect(await a.omi.status()).toEqual({
      connectionId: connections.a,
      pendingUploads: 0,
      recordings: 0,
      notTranscribed: 0,
      agentBotId: row.agentBotId,
    });
    // The generic app list never shows it.
    expect((await a.connections.list()).some((c) => c.id === connections.a)).toBe(false);
  });

  it("refuses unauthenticated callers and another user's connection", async () => {
    const body = records([1000]);
    expect((await upload(null, connections.a as string, 0, body)).status).toBe(401);
    expect((await upload("b", connections.a as string, 0, body)).status).toBe(404);
    expect((await post("b", `/api/omi/sync-complete?connectionId=${connections.a}`)).status).toBe(
      404,
    );
    expect(await prisma.omiUpload.count({ where: { connectionId: connections.a } })).toBe(0);
  });

  it("rejects a body that is too large or not whole records", async () => {
    expect((await upload("a", connections.a as string, 0, new Uint8Array(443))).status).toBe(400);
    expect((await upload("a", connections.a as string, 0, new Uint8Array(0))).status).toBe(400);
    const big = new Uint8Array(1024 * 1024 + 444);
    expect((await upload("a", connections.a as string, 0, big)).status).toBe(413);
    const bad = await post(
      "a",
      `/api/omi/records?connectionId=${connections.a}&firstSeq=0&codec=9&rtcValid=true`,
      records([1]),
    );
    expect(bad.status).toBe(400);
    expect(await prisma.omiUpload.count({ where: { connectionId: connections.a } })).toBe(0);
  });

  it("stores an upload once and answers a retry the same way", async () => {
    const body = records([1000, 1000]);
    const first = await upload("a", connections.a as string, 0, body);
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ stored: 2 });
    const retry = await upload("a", connections.a as string, 0, body);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ stored: 2 });
    expect(await prisma.omiUpload.count({ where: { connectionId: connections.a } })).toBe(1);
    expect((await client(actors.a as Actor).omi.status())?.pendingUploads).toBe(1);
  });

  it("assembles uploads into recordings split at a gap, and a re-run adds nothing", async () => {
    // Seq 2-3 follow the first upload closely; seq 4 starts 10 minutes later.
    expect((await upload("a", connections.a as string, 2, records([1000, 1001]))).status).toBe(201);
    expect((await upload("a", connections.a as string, 4, records([1600]))).status).toBe(201);
    const sync = await post("a", `/api/omi/sync-complete?connectionId=${connections.a}`);
    expect(sync.status).toBe(202);
    const job = enqueued.find((j) => j.name === "omi.assemble");
    expect(job?.payload).toEqual({
      spaceId: actors.a?.spaceId,
      userId: actors.a?.userId,
      connectionId: connections.a,
    });

    const handlers = createBackgroundJobHandlers({
      prisma,
      jobs: { enqueue: async (j: BackgroundJob) => void enqueued.push(j) },
      artifacts,
    } as never);
    await handlers["omi.assemble"](job?.payload as never);
    await runOmiAssemble(
      { prisma, artifacts, jobs: { enqueue: async (j) => void enqueued.push(j) } },
      job?.payload as never,
    );

    const items = await prisma.dataRoomItem.findMany({
      where: { sourceConnectionId: connections.a },
      orderBy: { externalId: "asc" },
      include: { folder: { include: { parent: true } } },
    });
    expect(items.map((i) => i.externalId)).toEqual([
      expect.stringMatching(/^omi:0:[0-9a-f]{12}:3$/),
      expect.stringMatching(/^omi:4:[0-9a-f]{12}:4$/),
    ]);
    expect(items[0]).toMatchObject({
      source: "omi",
      mimeType: "audio/ogg",
      notIndexed: true,
      status: "ready",
      name: "Recording 1 Jan 00:16",
    });
    // Pendant audio never enters the Data room pipeline.
    expect(items.every((i) => i.status === "ready")).toBe(true);
    expect(enqueued.some((j) => j.name === "dataroom.ingest")).toBe(false);
    expect(items[0]?.folder?.name).toBe("Audio");
    expect(items[0]?.folder?.parent?.name).toBe("Omi");
    expect(items[0]?.folder?.createdBy).toBe("agent");
    const bytes = await artifacts.get(items[0]?.storageKey as string, {
      operationId: "t",
      traceId: "t",
      spaceId: actors.a?.spaceId as string,
      userId: actors.a?.userId as string,
      signal: new AbortController().signal,
    });
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("OggS");
    // Uploads are marked assembled and their raw blobs are gone.
    const uploads = await prisma.omiUpload.findMany({ where: { connectionId: connections.a } });
    expect(uploads.every((u) => u.assembledAt)).toBe(true);
    expect(await client(actors.a as Actor).omi.status()).toMatchObject({
      pendingUploads: 0,
      recordings: 2,
    });
    // A retried upload after assembly is still a no-op.
    expect((await upload("a", connections.a as string, 0, records([1000, 1000]))).status).toBe(200);
  });

  it("keeps new audio that reuses an old sequence number, and still ignores an identical retry", async () => {
    const id = connections.b as string;
    const wait = async () => {
      const job = enqueued.filter((j) => j.name === "omi.assemble").at(-1);
      await runOmiAssemble(
        { prisma, artifacts, jobs: { enqueue: async (j) => void enqueued.push(j) } },
        job?.payload as never,
      );
    };
    const first = records([2000, 2000]);
    // The pendant's counter restarted: same firstSeq, different audio.
    const second = records([9000, 9000], 4);
    expect((await upload("b", id, 0, first)).status).toBe(201);
    await post("b", `/api/omi/sync-complete?connectionId=${id}`);
    await wait();
    expect((await upload("b", id, 0, second)).status).toBe(201);
    expect((await upload("b", id, 0, second)).status).toBe(200);
    await post("b", `/api/omi/sync-complete?connectionId=${id}`);
    await wait();
    const items = await prisma.dataRoomItem.findMany({ where: { sourceConnectionId: id } });
    expect(items).toHaveLength(2);
    expect(items.every((i) => /^omi:0:[0-9a-f]{12}:[0-9]+$/.test(i.externalId ?? ""))).toBe(true);
    expect(new Set(items.map((i) => i.externalId)).size).toBe(2);
    expect(await prisma.omiUpload.count({ where: { connectionId: id } })).toBe(2);
  });

  it("disconnect keeps recordings unless asked to delete them", async () => {
    const a = client(actors.a as Actor);
    await a.omi.disconnect({ deleteRecordings: false });
    expect(await a.omi.status()).toBeNull();
    expect(await prisma.dataRoomItem.count({ where: { sourceConnectionId: connections.a } })).toBe(
      2,
    );
    await a.omi.connect({ model: "Omi", firmware: "3", hardware: "d", deviceId: "device-a" });
    await a.omi.disconnect({ deleteRecordings: true });
    expect(await prisma.dataRoomItem.count({ where: { sourceConnectionId: connections.a } })).toBe(
      0,
    );
  });

  it("deleteRecordings empties the connection but keeps it connected", async () => {
    const b = client(actors.b as Actor);
    const id = connections.b as string;
    expect(await prisma.dataRoomItem.count({ where: { sourceConnectionId: id } })).toBeGreaterThan(
      0,
    );
    await b.omi.deleteRecordings();
    expect(await b.omi.status()).toMatchObject({ connectionId: id, recordings: 0 });
    expect(await prisma.dataRoomItem.count({ where: { sourceConnectionId: id } })).toBe(0);
    expect(await prisma.omiSegment.count({ where: { connectionId: id } })).toBe(0);
    expect(await prisma.omiUpload.count({ where: { connectionId: id } })).toBe(0);
  });
  /** `count` records from `firstSeq`, 100 ms each (5 frames of 20 ms), uploaded 700 at a time. */
  async function uploadRun(who: string, firstSeq: number, count: number) {
    const id = connections[who] as string;
    // Earlier tests disconnected the connection.
    await client(actors[who] as Actor).omi.connect({
      model: "Omi",
      firmware: "3.0.21",
      hardware: "dev",
      deviceId: `device-${who}`,
    });
    for (let at = 0; at < count; at += 700) {
      const n = Math.min(700, count - at);
      const stamps = Array.from({ length: n }, (_, i) => 5_000_000 + Math.floor((at + i) / 10));
      expect((await upload(who, id, firstSeq + at, records(stamps))).status).toBe(201);
    }
  }
  const assembleDeps = () => ({
    prisma,
    artifacts,
    jobs: { enqueue: async (j: BackgroundJob) => void enqueued.push(j) },
  });
  const payloadOf = (who: string) => ({
    spaceId: actors[who]?.spaceId as string,
    userId: actors[who]?.userId as string,
    connectionId: connections[who] as string,
  });
  const assembleJobs = () => enqueued.filter((j) => j.name === "omi.assemble").length;
  /** Runs assembly the way the queue would: again while it asked to run again. */
  async function drain(who: string) {
    for (;;) {
      const before = assembleJobs();
      await runOmiAssemble(assembleDeps(), payloadOf(who));
      if (assembleJobs() === before) return;
    }
  }
  /** [firstSeq, lastSeq] of the recordings filed from `base` up, in order. */
  async function ranges(who: string, base: number) {
    const items = await prisma.dataRoomItem.findMany({
      where: { sourceConnectionId: connections[who], source: "omi" },
      select: { externalId: true },
    });
    return items
      .map((i) => (i.externalId as string).split(":"))
      .map((p) => [Number(p[1]), Number(p[3])] as const)
      .filter(([first]) => first >= base)
      .sort((x, y) => x[0] - y[0]);
  }
  const contiguous = (found: (readonly [number, number])[], first: number, last: number) => {
    expect(found[0]?.[0]).toBe(first);
    expect(found.at(-1)?.[1]).toBe(last);
    for (let i = 1; i < found.length; i += 1) {
      expect((found[i] as readonly [number, number])[0]).toBe(
        (found[i - 1] as readonly [number, number])[1] + 1,
      );
    }
  };

  it("assembles a 2.5 hour stretch in bounded batches and 60 minute recordings", async () => {
    const base = 100_000;
    await uploadRun("a", base, 90_300);
    const before = assembleJobs();
    await runOmiAssemble(assembleDeps(), payloadOf("a"));
    // One batch (about an hour) per run, and the run asks to run again while more remain.
    expect(assembleJobs()).toBe(before + 1);
    expect((await client(actors.a as Actor).omi.status())?.pendingUploads).toBeGreaterThan(0);
    await drain("a");
    const found = await ranges("a", base);
    contiguous(found, base, base + 90_299);
    // 36,000 records are 60 minutes: no recording is longer, and 2.5 h is three or more.
    expect(found.every(([first, last]) => last - first + 1 <= 36_000)).toBe(true);
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(
      await prisma.omiUpload.count({ where: { connectionId: connections.a, assembledAt: null } }),
    ).toBe(0);
    // A re-run adds nothing.
    const count = await prisma.dataRoomItem.count({ where: { sourceConnectionId: connections.a } });
    await drain("a");
    expect(await prisma.dataRoomItem.count({ where: { sourceConnectionId: connections.a } })).toBe(
      count,
    );
  }, 120_000);

  it("recovers from a crash between filing and marking, and files audio that arrived after", async () => {
    const base = 300_000;
    await uploadRun("b", base, 7_000);
    const mark = vi
      .spyOn(prisma.omiUpload, "updateMany")
      .mockRejectedValueOnce(new Error("crash after filing"));
    await expect(runOmiAssemble(assembleDeps(), payloadOf("b"))).rejects.toThrow("crash");
    mark.mockRestore();
    // Recordings are filed, the uploads are not marked, and their blobs are still there.
    const pending = await prisma.omiUpload.findMany({
      where: { connectionId: connections.b, assembledAt: null, firstSeq: { gte: base } },
    });
    expect(pending.length).toBe(10);
    for (const u of pending)
      expect((await artifacts.get(u.storageKey, blobCtx("b"))).byteLength).toBeGreaterThan(0);
    expect((await ranges("b", base)).length).toBe(1);
    // More audio follows the crashed stretch before the next run.
    await uploadRun("b", base + 7_000, 1_400);
    await drain("b");
    const found = await ranges("b", base);
    contiguous(found, base, base + 8_399);
    expect(
      await prisma.omiUpload.count({ where: { connectionId: connections.b, assembledAt: null } }),
    ).toBe(0);
  }, 60_000);

  const blobCtx = (who: string) => ({
    operationId: "t",
    traceId: "t",
    spaceId: actors[who]?.spaceId as string,
    userId: actors[who]?.userId as string,
    signal: new AbortController().signal,
  });
});
