import type { MeetingCaptureTrack } from "@rakazo/contracts";

/** One cut piece of audio, kept until the server confirms it. */
export type BufferedChunk = {
  /** `${userId}:${spaceId}:${captureId}:${track}:${seq}` */
  key: string;
  captureId: string;
  userId: string;
  spaceId: string;
  track: MeetingCaptureTrack;
  seq: number;
  startMs: number;
  endMs: number;
  blob: Blob;
};

/** What this browser knows about a capture it started: who owns it, and whether Stop was pressed. */
export type CaptureRecord = {
  captureId: string;
  userId: string;
  spaceId: string;
  tracks: MeetingCaptureTrack[];
  title: string | null;
  /** Epoch ms of the capture's start. */
  startedAt: number;
  stopped: boolean;
  /** Where speech becomes text; a record from before on-device speech has none and means "server". */
  engine?: "device" | "server";
  /** Pieces the server refused for good; sent with finish so the meeting shows as partial. */
  lostChunks: number;
};

export type CaptureOwner = { userId: string; spaceId: string; captureId: string };

export const chunkKey = (owner: CaptureOwner, track: MeetingCaptureTrack, seq: number) =>
  `${owner.userId}:${owner.spaceId}:${owner.captureId}:${track}:${seq}`;

const sameCapture = (a: CaptureOwner, b: CaptureOwner) =>
  a.userId === b.userId && a.spaceId === b.spaceId && a.captureId === b.captureId;

export type ChunkStore = {
  put: (chunk: BufferedChunk) => Promise<void>;
  all: () => Promise<BufferedChunk[]>;
  remove: (key: string) => Promise<void>;
  putRecord: (record: CaptureRecord) => Promise<void>;
  records: () => Promise<CaptureRecord[]>;
  removeRecord: (captureId: string) => Promise<void>;
};

export function memoryChunkStore(): ChunkStore {
  const chunks = new Map<string, BufferedChunk>();
  const records = new Map<string, CaptureRecord>();
  return {
    put: async (chunk) => void chunks.set(chunk.key, chunk),
    all: async () => [...chunks.values()],
    remove: async (key) => void chunks.delete(key),
    putRecord: async (record) => void records.set(record.captureId, record),
    records: async () => [...records.values()],
    removeRecord: async (id) => void records.delete(id),
  };
}

// One schema version; the name is new so no browser holds an older shape of this database.
const DB_NAME = "praci-meeting-capture-buffer";
const CHUNKS = "chunks";
const RECORDS = "records";

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Chunks and capture records in IndexedDB, so a closed tab does not lose audio that was not uploaded yet. */
export function indexedDbChunkStore(): ChunkStore {
  const open = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(CHUNKS, { keyPath: "key" });
      req.result.createObjectStore(RECORDS, { keyPath: "captureId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const write = async (name: string, change: (store: IDBObjectStore) => void) => {
    const tx = (await open).transaction(name, "readwrite");
    change(tx.objectStore(name));
    await done(tx);
  };
  const readAll = async <T>(name: string) =>
    (await request((await open).transaction(name).objectStore(name).getAll())) as T[];
  return {
    put: (chunk) => write(CHUNKS, (store) => void store.put(chunk)),
    all: () => readAll<BufferedChunk>(CHUNKS),
    remove: (key) => write(CHUNKS, (store) => void store.delete(key)),
    putRecord: (record) => write(RECORDS, (store) => void store.put(record)),
    records: () => readAll<CaptureRecord>(RECORDS),
    removeRecord: (id) => write(RECORDS, (store) => void store.delete(id)),
  };
}

/**
 * IndexedDB when it works, memory for any call that fails (private windows, blocked storage).
 * Reads merge both, so nothing written to memory is lost to a later read.
 */
export function createChunkStore(
  idb: ChunkStore | null = typeof indexedDB === "undefined" ? null : indexedDbChunkStore(),
): ChunkStore {
  const memory = memoryChunkStore();
  const write = async (action: (target: ChunkStore) => Promise<void>) => {
    try {
      if (!idb) throw new Error("no IndexedDB");
      await action(idb);
    } catch {
      await action(memory);
    }
  };
  return {
    put: (chunk) => write((target) => target.put(chunk)),
    putRecord: (record) => write((target) => target.putRecord(record)),
    all: async () => {
      const stored = (await idb?.all().catch(() => [] as BufferedChunk[])) ?? [];
      const merged = new Map<string, BufferedChunk>();
      for (const chunk of [...stored, ...(await memory.all())]) merged.set(chunk.key, chunk);
      return [...merged.values()];
    },
    records: async () => {
      const stored = (await idb?.records().catch(() => [] as CaptureRecord[])) ?? [];
      const merged = new Map<string, CaptureRecord>();
      for (const record of [...stored, ...(await memory.records())])
        merged.set(record.captureId, record);
      return [...merged.values()];
    },
    remove: async (key) => {
      await memory.remove(key);
      await idb?.remove(key).catch(() => undefined);
    },
    removeRecord: async (id) => {
      await memory.removeRecord(id);
      await idb?.removeRecord(id).catch(() => undefined);
    },
  };
}

/** Forgets one capture: its record and only its own chunks. */
export async function dropCapture(store: ChunkStore, owner: CaptureOwner): Promise<void> {
  for (const chunk of await store.all())
    if (sameCapture(chunk, owner)) await store.remove(chunk.key);
  await store.removeRecord(owner.captureId);
}

/** Forgets everything this user left in the browser; with no user known, everything. */
export async function dropUser(store: ChunkStore, userId: string | null): Promise<void> {
  for (const chunk of await store.all())
    if (userId === null || chunk.userId === userId) await store.remove(chunk.key);
  for (const record of await store.records())
    if (userId === null || record.userId === userId) await store.removeRecord(record.captureId);
}

/** Chunks still waiting for this capture. */
export async function pendingChunks(
  store: ChunkStore,
  owner: CaptureOwner,
): Promise<BufferedChunk[]> {
  return (await store.all()).filter((chunk) => sameCapture(chunk, owner));
}

/** The server answered a chunk with a status that retrying cannot change. */
export class UploadRejected extends Error {
  constructor(
    readonly status: number,
    /** The capture itself is gone or closed, so nothing more can be uploaded for it. */
    readonly endsCapture: boolean,
  ) {
    super(`Upload rejected (${status})`);
  }
}

/** Decides what a failed chunk upload means. Null: retry later (offline, 5xx, 401). */
export function classifyUpload(status: number, serverMessage = ""): UploadRejected | null {
  if (status === 404) return new UploadRejected(status, true);
  if (status === 409)
    return new UploadRejected(status, !serverMessage.startsWith("Chunk already stored"));
  if (status === 400 || status === 413) return new UploadRejected(status, false);
  return null;
}

/**
 * Uploads stored chunks of one capture in time order. A chunk is deleted only after its upload
 * resolved (the caller resolves on a 2xx), or when the server refused it for good (`UploadRejected`),
 * which is reported in `rejected`. Any other failure stops the pass and leaves that chunk and every
 * later one in the store. A refusal that ends the capture stops the pass too.
 */
export async function flushChunks(
  store: ChunkStore,
  owner: CaptureOwner,
  upload: (chunk: BufferedChunk) => Promise<void>,
): Promise<{ uploaded: number; failed: boolean; rejected: UploadRejected[] }> {
  const chunks = (await pendingChunks(store, owner)).sort(
    (a, b) => a.startMs - b.startMs || a.seq - b.seq,
  );
  let uploaded = 0;
  const rejected: UploadRejected[] = [];
  for (const chunk of chunks) {
    try {
      await upload(chunk);
      uploaded += 1;
    } catch (error) {
      if (!(error instanceof UploadRejected)) return { uploaded, failed: true, rejected };
      rejected.push(error);
      if (error.endsCapture) {
        await store.remove(chunk.key);
        return { uploaded, failed: false, rejected };
      }
    }
    await store.remove(chunk.key);
  }
  return { uploaded, failed: false, rejected };
}
