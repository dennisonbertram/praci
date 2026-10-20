import { createHash, randomBytes } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ArtifactStore } from "@rakazo/adapter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { LocalArtifactStore } from "./artifacts.js";
import { MemoryArtifacts } from "./data-room-test-fakes.js";
import { LocalFallbackArtifactStore, S3ArtifactStore } from "./s3-artifacts.js";
import { startFakeS3 } from "./testing/fake-s3.js";

const MIB = 1024 * 1024;
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const ctx = (signal: AbortSignal = new AbortController().signal) =>
  ({ spaceId: "space-1", operationId: "op", traceId: "op", userId: "u", signal }) as never;
const file = { name: "a.bin", mimeType: "application/octet-stream" };

async function* chunked(bytes: Uint8Array, size = 1 * MIB) {
  for (let at = 0; at < bytes.length; at += size) yield bytes.subarray(at, at + size);
}
async function readAll(stream: ReadableStream<Uint8Array>) {
  const parts: Buffer[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts);
}

interface Harness {
  store: ArtifactStore;
  /** Objects left behind (completed or in progress). */
  leftover(): Promise<number>;
  scopedBySpace: boolean;
  /** Bytes the store has finished handling so far (written, or sent to the object store). */
  sunk(): number;
  /** Largest read-ahead the store allows between its source and its sink, in bytes. */
  maxLead: number;
}

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((fn) => fn()));
});

async function localHarness(): Promise<Harness> {
  const dir = await mkdtemp(path.join(tmpdir(), "rakazo-conf-"));
  cleanups.push(() => rm(dir, { recursive: true, force: true }));
  return {
    store: new LocalArtifactStore(dir),
    scopedBySpace: true,
    maxLead: 2 * MIB,
    sunk: () => {
      const root = path.join(dir, "artifacts", "space-1");
      try {
        return readdirSync(root).reduce((n, f) => n + statSync(path.join(root, f)).size, 0);
      } catch {
        return 0;
      }
    },
    leftover: async () =>
      (await readdir(path.join(dir, "artifacts", "space-1")).catch(() => [])).length,
  };
}
async function s3Harness(): Promise<Harness> {
  const s3 = await startFakeS3();
  cleanups.push(s3.close);
  return {
    store: new S3ArtifactStore(s3.config),
    scopedBySpace: true,
    maxLead: 16 * MIB,
    sunk: () =>
      [...s3.objects.values()].reduce((n, b) => n + b.length, 0) +
      [...s3.uploads.values()].reduce(
        (n, u) => n + [...u.parts.values()].reduce((m, b) => m + b.length, 0),
        0,
      ),
    leftover: async () => s3.objects.size + s3.uploads.size,
  };
}
async function fallbackHarness(): Promise<Harness> {
  const s3 = await startFakeS3();
  const dir = await mkdtemp(path.join(tmpdir(), "rakazo-conf-"));
  cleanups.push(s3.close, () => rm(dir, { recursive: true, force: true }));
  return {
    store: new LocalFallbackArtifactStore(
      new S3ArtifactStore(s3.config),
      new LocalArtifactStore(dir),
    ),
    scopedBySpace: true,
    maxLead: 16 * MIB,
    sunk: () =>
      [...s3.objects.values()].reduce((n, b) => n + b.length, 0) +
      [...s3.uploads.values()].reduce(
        (n, u) => n + [...u.parts.values()].reduce((m, b) => m + b.length, 0),
        0,
      ),
    leftover: async () => s3.objects.size + s3.uploads.size,
  };
}
async function memoryHarness(): Promise<Harness> {
  const store = new MemoryArtifacts();
  return {
    store,
    scopedBySpace: false,
    maxLead: 2 * MIB,
    sunk: () => store.consumedBytes,
    leftover: async () => store.blobs.size + store.partial.size,
  };
}

describe.each([
  ["LocalArtifactStore", localHarness],
  ["S3ArtifactStore", s3Harness],
  ["LocalFallbackArtifactStore", fallbackHarness],
  ["MemoryArtifacts", memoryHarness],
])("%s streaming", (_name, make) => {
  it("putStream returns the sha-256 and size of an empty, a 1-byte and a 20 MiB stream", async () => {
    const { store } = await make();
    for (const size of [0, 1, 20 * MIB]) {
      const bytes = randomBytes(size);
      const stored = await store.putStream(chunked(bytes), file, ctx());
      expect(stored).toMatchObject({ hash: sha(bytes), size });
      expect(sha(await store.get(stored.id, ctx()))).toBe(sha(bytes));
    }
  });

  it("getStream returns the whole object and the [start, end) range", async () => {
    const { store } = await make();
    const bytes = randomBytes(3 * MIB + 17);
    const { id } = await store.putStream(chunked(bytes), file, ctx());
    expect((await readAll(await store.getStream(id, ctx()))).equals(bytes)).toBe(true);
    const part = await readAll(await store.getStream(id, ctx(), { start: 5, end: 2 * MIB + 9 }));
    expect(part.equals(bytes.subarray(5, 2 * MIB + 9))).toBe(true);
  });

  it("getStream rejects for a missing id and for another space's id", async () => {
    const { store, scopedBySpace } = await make();
    await expect(store.getStream("missing", ctx())).rejects.toThrow();
    if (!scopedBySpace) return;
    const { id } = await store.putStream(chunked(randomBytes(10)), file, ctx());
    await expect(
      store.getStream(id, { ...(ctx() as object), spaceId: "space-2" } as never),
    ).rejects.toThrow();
  });

  it("putStream leaves no object when the source throws mid-stream", async () => {
    const { store, leftover } = await make();
    async function* broken() {
      yield randomBytes(9 * MIB);
      throw new Error("source broke");
    }
    await expect(store.putStream(broken(), file, ctx())).rejects.toThrow("source broke");
    expect(await leftover()).toBe(0);
  });

  it("putStream stops when the signal aborts", async () => {
    const { store, leftover } = await make();
    const controller = new AbortController();
    async function* slow() {
      yield randomBytes(9 * MIB);
      controller.abort();
      yield randomBytes(9 * MIB);
    }
    await expect(store.putStream(slow(), file, ctx(controller.signal))).rejects.toThrow();
    expect(await leftover()).toBe(0);
  });

  it("putStream does not read ahead", async () => {
    const { store, maxLead, sunk } = await make();
    let produced = 0;
    let lead = 0;
    const total = 40 * MIB;
    const piece = randomBytes(MIB);
    async function* pull() {
      while (produced < total) {
        lead = Math.max(lead, produced - sunk());
        produced += piece.length;
        yield piece;
      }
    }
    const stored = await store.putStream(pull(), file, ctx());
    expect(stored.size).toBe(total);
    // A pull-based source is asked for the next chunk only when the store wants it, so its lead
    // over what the store has finished with stays within one part.
    expect(lead).toBeLessThan(maxLead);
  });
});
