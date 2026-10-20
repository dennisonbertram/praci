import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { serve } from "@hono/node-server";
import { LocalArtifactStore } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { createDb } from "@rakazo/db";
import { Hono } from "hono";
import { afterAll, beforeAll, expect, it } from "vitest";
import { mountDataRoomRoutes } from "./data-room.js";

// A manual runtime check, not part of the normal suite: it sends a very large body over a real
// socket to the real route and store, and records how much memory the process used. Run it with
//   NODE_OPTIONS=--expose-gc DATA_ROOM_BIG_UPLOAD_MB=1024 VERIFY_DATABASE=1 DATABASE_URL=<throwaway> \
//     pnpm vitest run <this file>
const megabytes = Number(process.env.DATA_ROOM_BIG_UPLOAD_MB ?? 0);
const databaseUrl = process.env.DATABASE_URL;
const run = process.env.VERIFY_DATABASE && databaseUrl && megabytes > 0 ? it : it.skip;

const MIB = 1024 * 1024;
const id = randomUUID().slice(0, 8);
let root = "";
let closeAll = async () => {};
let url = "";
const actor: Actor = {
  userId: `big-user-${id}`,
  spaceId: `big-space-${id}`,
  email: "big@rakazo.test",
  isDeploymentOwner: false,
};
let prisma: ReturnType<typeof createDb>["prisma"];
const store = () => new LocalArtifactStore(root);

beforeAll(async () => {
  if (!(process.env.VERIFY_DATABASE && databaseUrl && megabytes > 0)) return;
  const db = createDb(databaseUrl);
  prisma = db.prisma;
  root = await mkdtemp(path.join(tmpdir(), "dr-big-"));
  await prisma.user.create({
    data: { id: actor.userId, name: "big", email: actor.email, emailVerified: false },
  });
  await prisma.organization.create({
    data: { id: actor.spaceId, name: "big", slug: actor.spaceId, createdAt: new Date() },
  });
  await prisma.space.create({
    data: { id: actor.spaceId, organizationId: actor.spaceId, name: "big", isDefault: true },
  });
  const app = new Hono();
  mountDataRoomRoutes(
    app,
    { prisma, artifacts: store(), jobs: { enqueue: async () => undefined } },
    async () => actor,
  );
  const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" });
  // The same setting as the API's entry point.
  if ("requestTimeout" in server) server.requestTimeout = 12 * 60 * 60 * 1000;
  await new Promise((resolve) => server.once("listening", resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  closeAll = async () => {
    server.closeAllConnections?.();
    server.close();
    await prisma.dataRoomItem.deleteMany({ where: { spaceId: actor.spaceId } });
    await prisma.space.deleteMany({ where: { id: actor.spaceId } });
    await prisma.organization.deleteMany({ where: { id: actor.spaceId } });
    await prisma.user.deleteMany({ where: { id: actor.userId } });
    await prisma.$disconnect();
    await db.pool.end();
    await rm(root, { recursive: true, force: true });
  };
});
afterAll(async () => closeAll());

/**
 * The sender runs in its own process, so its buffers do not count as the API's. It generates the
 * body a chunk at a time (every chunk differs) and prints the SHA-256 of what it sent.
 */
const SENDER = `
const { createHash } = require("node:crypto");
const [url, mb] = [process.argv[1], Number(process.argv[2])];
const MIB = 1024 * 1024;
const hash = createHash("sha256");
let produced = 0;
const body = new ReadableStream({
  pull(controller) {
    if (produced >= mb * MIB) return controller.close();
    const chunk = Buffer.alloc(MIB, produced / MIB);
    chunk.writeUInt32BE(produced / MIB, 0);
    hash.update(chunk);
    controller.enqueue(chunk);
    produced += MIB;
  },
});
fetch(url, { method: "POST", body, duplex: "half", headers: { "content-type": "application/octet-stream" } })
  .then(async (response) => {
    console.log(JSON.stringify({ status: response.status, sha256: hash.digest("hex"), body: await response.json() }));
  })
  .catch((error) => { console.error(error); process.exit(1); });
`;

run(
  "uploads a very large generated body with flat memory and reads it back byte for byte",
  async () => {
    const total = megabytes * MIB;
    global.gc?.();
    const before = process.memoryUsage();
    let peakRss = before.rss;
    let peakLive = before.heapUsed + before.arrayBuffers;
    // Live memory (heap plus buffers) is the measure: RSS also holds memory the allocator has freed
    // but not returned to the system, which varies run to run.
    const sampler = setInterval(() => {
      global.gc?.();
      const now = process.memoryUsage();
      peakRss = Math.max(peakRss, now.rss);
      peakLive = Math.max(peakLive, now.heapUsed + now.arrayBuffers);
    }, 25);
    const started = Date.now();
    const sent = await new Promise<{
      status: number;
      sha256: string;
      body: { item: { id: string; size: number } };
    }>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["-e", SENDER, `${url}/api/data-room/upload?name=generated.bin`, String(megabytes)],
        { stdio: ["ignore", "pipe", "inherit"] },
      );
      let out = "";
      child.stdout.on("data", (piece) => {
        out += piece;
      });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`sender exited with ${code}`)),
      );
    });
    clearInterval(sampler);
    const seconds = (Date.now() - started) / 1000;

    expect(sent.status).toBe(201);
    const { item } = sent.body;
    expect(item.size).toBe(total);
    const row = await prisma.dataRoomItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(row.size).toBe(BigInt(total));
    expect(row.sha256).toBe(sent.sha256);

    // Read it back through the store and compare the hash of what comes out.
    const readHash = createHash("sha256");
    let read = 0;
    const stream = await store().getStream(row.storageKey ?? "", {
      spaceId: actor.spaceId,
      userId: actor.userId,
      operationId: "read",
      traceId: "read",
      signal: new AbortController().signal,
    });
    for await (const piece of stream as unknown as AsyncIterable<Uint8Array>) {
      readHash.update(piece);
      read += piece.length;
    }
    expect(read).toBe(total);
    expect(readHash.digest("hex")).toBe(row.sha256);

    const liveMb = Math.round((peakLive - before.heapUsed - before.arrayBuffers) / MIB);
    const rssMb = Math.round((peakRss - before.rss) / MIB);
    process.stderr.write(
      `uploaded ${megabytes} MB in ${seconds.toFixed(1)} s; API process growth: live ${liveMb} MB, RSS ${rssMb} MB\n`,
    );
    // Holding the file would add about its size; a stream adds a few chunks and some garbage.
    if (global.gc) expect(liveMb).toBeLessThan(128);
  },
  30 * 60_000,
);

/** A sender that never finishes; the test kills it mid-upload. */
const ENDLESS_SENDER = `
let sent = 0;
const body = new ReadableStream({
  pull(controller) {
    controller.enqueue(Buffer.alloc(1024 * 1024, 7));
    sent += 1;
    if (sent === 20) console.log("sending");
    return new Promise((resolve) => setTimeout(resolve, 20));
  },
});
fetch(process.argv[1], { method: "POST", body, duplex: "half" }).catch(() => {});
`;

run(
  "removes the partial object when the client disconnects mid-upload",
  async () => {
    const items = await prisma.dataRoomItem.count({ where: { spaceId: actor.spaceId } });
    const child = spawn(
      process.execPath,
      ["-e", ENDLESS_SENDER, `${url}/api/data-room/upload?name=endless.bin`],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    await new Promise<void>((resolve) => child.stdout.once("data", () => resolve()));
    const dir = path.join(root, "artifacts", actor.spaceId);
    const writing = async () => (await readdir(dir).catch(() => [])).length;
    // Part of the file is on disk while the upload runs, beside any file stored earlier.
    const stored = (await writing()) - 1;
    expect(stored).toBeGreaterThanOrEqual(0);
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
    for (let wait = 0; wait < 100 && (await writing()) > stored; wait++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(await writing()).toBe(stored);
    expect(await prisma.dataRoomItem.count({ where: { spaceId: actor.spaceId } })).toBe(items);
  },
  60_000,
);
