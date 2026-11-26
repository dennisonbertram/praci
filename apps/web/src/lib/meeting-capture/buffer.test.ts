import { expect, it, vi } from "vitest";
import type { BufferedChunk, CaptureOwner } from "./buffer";
import {
  chunkKey,
  classifyUpload,
  dropCapture,
  dropUser,
  flushChunks,
  memoryChunkStore,
  UploadRejected,
} from "./buffer";

const A: CaptureOwner = { userId: "u1", spaceId: "sA", captureId: "c1" };
const chunk = (seq: number, owner = A): BufferedChunk => ({
  key: chunkKey(owner, "microphone", seq),
  ...owner,
  track: "microphone",
  seq,
  startMs: seq * 1000,
  endMs: seq * 1000 + 900,
  blob: new Blob(["x"]),
});

it("deletes a chunk only after its upload succeeded", async () => {
  const store = memoryChunkStore();
  await store.put(chunk(1));
  const upload = vi.fn(async () => {
    expect(await store.all()).toHaveLength(1); // still stored while the request is in flight
  });
  expect(await flushChunks(store, A, upload)).toEqual({ uploaded: 1, failed: false, rejected: [] });
  expect(await store.all()).toHaveLength(0);
});

it("keeps the failed chunk and every later one, then sends them on retry", async () => {
  const store = memoryChunkStore();
  for (const seq of [1, 2, 3]) await store.put(chunk(seq));
  const upload = vi.fn(async (c: BufferedChunk) => {
    if (c.seq === 2) throw new Error("offline");
  });
  expect(await flushChunks(store, A, upload)).toEqual({ uploaded: 1, failed: true, rejected: [] });
  expect((await store.all()).map((c) => c.seq).sort()).toEqual([2, 3]);
  upload.mockResolvedValue(undefined);
  expect((await flushChunks(store, A, upload)).uploaded).toBe(2);
  expect(await store.all()).toHaveLength(0);
});

it("finishing one space's capture keeps another space's chunks", async () => {
  const store = memoryChunkStore();
  const B: CaptureOwner = { userId: "u1", spaceId: "sB", captureId: "c1" };
  await store.put(chunk(1));
  await store.put(chunk(1, B));
  await dropCapture(store, B);
  expect((await store.all()).map((c) => c.spaceId)).toEqual(["sA"]);
});

it("sign-out drops one user's chunks, not another user's", async () => {
  const store = memoryChunkStore();
  await store.put(chunk(1));
  await store.put(chunk(1, { ...A, userId: "u2" }));
  await dropUser(store, "u1");
  expect((await store.all()).map((c) => c.userId)).toEqual(["u2"]);
});

it("classifies terminal and retryable responses", () => {
  expect(classifyUpload(404)?.endsCapture).toBe(true);
  expect(classifyUpload(409, "Capture is closed")?.endsCapture).toBe(true);
  expect(classifyUpload(409, "Chunk already stored with other bytes")?.endsCapture).toBe(false);
  expect(classifyUpload(413)?.endsCapture).toBe(false);
  expect(classifyUpload(400)?.endsCapture).toBe(false);
  expect(classifyUpload(401)).toBeNull();
  expect(classifyUpload(503)).toBeNull();
});

it("drops a refused chunk and keeps going; a closed capture stops the pass", async () => {
  const store = memoryChunkStore();
  for (const seq of [1, 2, 3]) await store.put(chunk(seq));
  const upload = vi.fn(async (c: BufferedChunk) => {
    if (c.seq === 1) throw new UploadRejected(413, false);
    if (c.seq === 2) throw new UploadRejected(404, true);
  });
  const result = await flushChunks(store, A, upload);
  expect(result.failed).toBe(false);
  expect(result.rejected.map((r) => r.status)).toEqual([413, 404]);
  expect((await store.all()).map((c) => c.seq)).toEqual([3]);
});

it("keeps every chunk when the session expired (401)", async () => {
  const store = memoryChunkStore();
  await store.put(chunk(1));
  const upload = vi.fn(async () => {
    throw new Error("401");
  });
  expect((await flushChunks(store, A, upload)).failed).toBe(true);
  expect(await store.all()).toHaveLength(1);
});
