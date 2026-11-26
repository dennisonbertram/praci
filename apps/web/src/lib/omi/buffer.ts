import { RECORD_SIZE } from "./protocol";

/** One downloaded record, kept until the server confirms it. */
export type BufferedRecord = {
  seq: number;
  bytes: Uint8Array;
  codec: number;
  rtcValid: boolean;
};

export type RecordStore = {
  put: (records: BufferedRecord[]) => Promise<void>;
  /** Every stored record, in seq order. */
  all: () => Promise<BufferedRecord[]>;
  remove: (seqs: number[]) => Promise<void>;
};

export function memoryStore(): RecordStore {
  const map = new Map<number, BufferedRecord>();
  return {
    put: async (records) => {
      for (const record of records) map.set(record.seq, record);
    },
    all: async () => [...map.values()].sort((a, b) => a.seq - b.seq),
    remove: async (seqs) => {
      for (const seq of seqs) map.delete(seq);
    },
  };
}

const DB_NAME = "praci-omi";
const STORE = "records";

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

/** Records in IndexedDB, so a closed tab does not lose audio the pendant already freed. */
export function indexedDbStore(): RecordStore {
  // Best effort: ask the browser not to evict the buffer. The result is ignored.
  try {
    void Promise.resolve(navigator.storage?.persist?.()).catch(() => undefined);
  } catch {
    // Storage API unavailable or blocked; the memory fallback still works.
  }
  const open = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "seq" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return {
    put: async (records) => {
      const tx = (await open).transaction(STORE, "readwrite");
      for (const record of records) tx.objectStore(STORE).put(record);
      await done(tx);
    },
    all: async () => {
      const rows = await request((await open).transaction(STORE).objectStore(STORE).getAll());
      return (rows as BufferedRecord[]).sort((a, b) => a.seq - b.seq);
    },
    remove: async (seqs) => {
      const tx = (await open).transaction(STORE, "readwrite");
      for (const seq of seqs) tx.objectStore(STORE).delete(seq);
      await done(tx);
    },
  };
}

/**
 * IndexedDB when it works, with memory as the fallback for any call that fails (private windows,
 * blocked storage, full disk). Records still upload; only a closed tab would lose the memory ones.
 */
export function createRecordStore(
  idb: RecordStore | null = typeof indexedDB === "undefined" ? null : indexedDbStore(),
): RecordStore {
  const memory = memoryStore();
  return {
    put: async (records) => {
      try {
        if (!idb) throw new Error("no IndexedDB");
        await idb.put(records);
      } catch {
        await memory.put(records);
      }
    },
    all: async () => {
      const stored = await idb?.all().catch(() => [] as BufferedRecord[]);
      const merged = new Map<number, BufferedRecord>();
      for (const record of [...(stored ?? []), ...(await memory.all())]) {
        merged.set(record.seq, record);
      }
      return [...merged.values()].sort((a, b) => a.seq - b.seq);
    },
    remove: async (seqs) => {
      await memory.remove(seqs);
      await idb?.remove(seqs).catch(() => undefined);
    },
  };
}

export const UPLOAD_BATCH_BYTES = 256 * 1024;

export type BatchUpload = (batch: {
  firstSeq: number;
  codec: number;
  rtcValid: boolean;
  bytes: Uint8Array;
}) => Promise<void>;

/**
 * Uploads stored records in seq order, in batches of about 256 KB made of consecutive records with
 * the same codec and clock state. A record is deleted only after its batch uploaded; the first failed
 * batch throws and leaves it and everything after it in the store.
 */
export async function flushRecords(
  store: RecordStore,
  upload: BatchUpload,
  onUploaded?: (records: number) => void,
  batchBytes = UPLOAD_BATCH_BYTES,
): Promise<number> {
  const perBatch = Math.max(1, Math.floor(batchBytes / RECORD_SIZE));
  const records = await store.all();
  let uploaded = 0;
  for (let start = 0; start < records.length; ) {
    const first = records[start] as BufferedRecord;
    let end = start + 1;
    while (end < records.length && end - start < perBatch) {
      const prev = records[end - 1] as BufferedRecord;
      const next = records[end] as BufferedRecord;
      if (
        next.seq !== prev.seq + 1 ||
        next.codec !== first.codec ||
        next.rtcValid !== first.rtcValid
      )
        break;
      end += 1;
    }
    const batch = records.slice(start, end);
    const bytes = new Uint8Array(batch.length * RECORD_SIZE);
    for (const [index, record] of batch.entries()) bytes.set(record.bytes, index * RECORD_SIZE);
    await upload({
      firstSeq: first.seq,
      codec: first.codec,
      rtcValid: first.rtcValid,
      bytes,
    });
    await store.remove(batch.map((record) => record.seq));
    uploaded += batch.length;
    onUploaded?.(uploaded);
    start = end;
  }
  return uploaded;
}
