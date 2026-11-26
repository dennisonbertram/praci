import { afterEach, describe, expect, it, vi } from "vitest";
import type { BufferedRecord, RecordStore } from "./buffer";
import { createRecordStore, flushRecords, indexedDbStore, memoryStore } from "./buffer";
import {
  framesInRecord,
  isRingBufferFirmware,
  parseNotification,
  parseStatus,
  progressMinutes,
  RECORD_SIZE,
  Reassembler,
  readCommand,
} from "./protocol";
import { downloadSession } from "./session";
import type { RingTransport } from "./sync";
import { runSync } from "./sync";

/** A record with `frames` Opus-like frames of 20 bytes each, then zero padding. */
function record(seed: number, frames = 3): Uint8Array {
  const out = new Uint8Array(RECORD_SIZE);
  out[3] = seed;
  let offset = 4;
  for (let i = 0; i < frames; i++) {
    out[offset] = 20;
    out.fill(seed, offset + 1, offset + 21);
    offset += 21;
  }
  return out;
}
const join = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const u64 = (n: number) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n));
  return b;
};
const info = (read: number, write: number, packetBytes = 444) => {
  const tail = new Uint8Array(14);
  new DataView(tail.buffer).setUint16(12, packetBytes);
  return join([Uint8Array.of(0x02), u64(read), u64(write), tail]);
};
const begin = (start: number, count: number) => {
  const c = new Uint8Array(4);
  new DataView(c.buffer).setUint32(0, count);
  return join([Uint8Array.of(0x05), u64(start), c]);
};
const done = (next: number) => join([Uint8Array.of(0x04, 0), u64(next)]);
const data = (bytes: Uint8Array) => join([Uint8Array.of(0x03), bytes]);

describe("protocol", () => {
  it("compares firmware like the Omi app", () => {
    expect(isRingBufferFirmware("3.0.20")).toBe(true);
    expect(isRingBufferFirmware("3.1.0")).toBe(true);
    expect(isRingBufferFirmware("4.0.0")).toBe(true);
    expect(isRingBufferFirmware("3.0.19")).toBe(false);
    expect(isRingBufferFirmware("2.9.99")).toBe(false);
    expect(isRingBufferFirmware("Unknown")).toBe(false);
    expect(isRingBufferFirmware(null)).toBe(false);
  });

  it("parses the status read as little-endian", () => {
    const view = new DataView(new ArrayBuffer(16));
    view.setUint32(0, 1000, true);
    view.setUint32(4, 38, true);
    view.setUint32(8, 5, true);
    view.setUint32(12, 1, true);
    expect(parseStatus(view)).toEqual({
      usedBytes: 1000,
      unreadPackets: 38,
      freeBytes: 5,
      rtcValid: true,
    });
    expect(parseStatus(new DataView(new ArrayBuffer(8)))).toBeNull();
  });

  it("parses notifications and encodes the read command", () => {
    expect(parseNotification(info(7, 45))).toEqual({
      kind: "info",
      readSeq: 7,
      writeSeq: 45,
      packetBytes: 444,
      droppedPackets: 0,
    });
    expect(parseNotification(begin(7, 38))).toEqual({
      kind: "begin",
      startSeq: 7,
      count: 38,
    });
    expect(parseNotification(done(45))).toEqual({
      kind: "done",
      status: 0,
      nextSeq: 45,
    });
    expect(parseNotification(Uint8Array.of(1, 10))).toEqual({
      kind: "ack",
      status: 10,
    });
    expect(parseNotification(Uint8Array.of(0x04, 0))).toEqual({
      kind: "other",
    });
    expect([...readCommand(7, 38)]).toEqual([0x11, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 38]);
  });

  it("reassembles unaligned chunks into whole records", () => {
    const stream = join([record(1), record(2), record(3)]);
    const reassembler = new Reassembler();
    const out: Uint8Array[] = [];
    for (let at = 0; at < stream.length; at += 200) {
      out.push(reassembler.push(stream.subarray(at, at + 200)));
    }
    expect(join(out)).toEqual(stream);
    expect(out.every((chunk) => chunk.length % RECORD_SIZE === 0)).toBe(true);
  });

  it("counts frames and estimates minutes", () => {
    expect(framesInRecord(record(1, 3))).toBe(3);
    expect(framesInRecord(new Uint8Array(RECORD_SIZE))).toBe(0);
    // 3000 frames of 20 ms = 1 minute for 10 of 40 records.
    expect(progressMinutes(10, 40, 3000, 20)).toEqual({ done: 1, total: 4 });
    expect(progressMinutes(0, 40, 0, 20)).toEqual({ done: 0, total: null });
  });
});

function fakePendant(records: Uint8Array[], firstSeq: number, chunk: number) {
  const listeners = new Set<(bytes: Uint8Array) => void>();
  const emit = (bytes: Uint8Array) => {
    for (const listener of listeners) listener(bytes);
  };
  const stream = join(records);
  const writes: Uint8Array[] = [];
  const transport: RingTransport = {
    readStatus: async () => ({
      usedBytes: stream.length,
      unreadPackets: records.length,
      freeBytes: 0,
      rtcValid: true,
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    write: async (bytes) => {
      writes.push(bytes);
      if (bytes[0] === 0x10) queueMicrotask(() => emit(info(firstSeq, firstSeq + records.length)));
      if (bytes[0] === 0x11) {
        queueMicrotask(() => {
          emit(begin(firstSeq, records.length));
          for (let at = 0; at < stream.length; at += chunk) {
            emit(data(stream.subarray(at, at + chunk)));
          }
          emit(done(firstSeq + records.length));
        });
      }
    },
  };
  return { transport, writes };
}

describe("runSync", () => {
  it("reads every record with its sequence number", async () => {
    const records = [record(1), record(2), record(3), record(4)];
    const { transport, writes } = fakePendant(records, 100, 197);
    const got: { seq: number; bytes: Uint8Array }[] = [];
    const result = await runSync(transport, {
      onRecords: (seq, bytes) => {
        for (let i = 0; i < bytes.length / RECORD_SIZE; i++) {
          got.push({
            seq: seq + i,
            bytes: bytes.slice(i * RECORD_SIZE, (i + 1) * RECORD_SIZE),
          });
        }
      },
    });
    expect(result).toEqual({ outcome: "complete", records: 4 });
    expect(got.map((entry) => entry.seq)).toEqual([100, 101, 102, 103]);
    expect(join(got.map((entry) => entry.bytes))).toEqual(join(records));
    expect([...(writes[1] ?? [])].slice(8)).toEqual([100, 0, 0, 0, 4]);
  });

  it("does nothing when nothing is unread", async () => {
    const { transport, writes } = fakePendant([], 0, 100);
    expect(await runSync(transport, { onRecords: () => undefined })).toEqual({
      outcome: "complete",
      records: 0,
    });
    expect(writes).toHaveLength(0);
  });

  it("pauses after repeated reads that bring nothing, keeping what arrived", async () => {
    const seen: number[] = [];
    let reads = 0;
    const listeners: ((b: Uint8Array) => void)[] = [];
    const custom: RingTransport = {
      readStatus: async () => ({ usedBytes: 0, unreadPackets: 2000, freeBytes: 0, rtcValid: true }),
      subscribe: (l) => {
        listeners.push(l);
        return () => undefined;
      },
      write: async (bytes) => {
        if (bytes[0] === 0x10) for (const l of listeners) l(info(5, 2005));
        if (bytes[0] === 0x11) {
          reads += 1;
          // Only the first read delivers anything.
          if (reads === 1) for (const l of listeners) l(data(record(1)));
        }
      },
    };
    const result = await runSync(custom, { idleMs: 20, onRecords: (seq) => void seen.push(seq) });
    expect(result).toEqual({ outcome: "paused", records: 1 });
    expect(seen).toEqual([5]);
    expect(reads).toBe(4);
  });

  it("re-issues the read until a long backlog is drained", async () => {
    const pendant = livePendant({ backlog: 2500, maxPerRead: 1000, trickle: 0 });
    const got: number[] = [];
    const result = await runSync(pendant.transport, { onRecords: collect(got) });
    expect(result).toEqual({ outcome: "complete", records: 2500 });
    expect(got).toEqual(Array.from({ length: 2500 }, (_, i) => 100 + i));
    expect(pendant.reads).toBe(3);
  });

  it("ends as complete when only live recording keeps arriving", async () => {
    const pendant = livePendant({ backlog: 3000, maxPerRead: 1500, trickle: 40 });
    const got: number[] = [];
    const result = await runSync(pendant.transport, { onRecords: collect(got) });
    expect(result.outcome).toBe("complete");
    expect(got.length).toBeGreaterThanOrEqual(3000);
    expect(got).toEqual(got.map((_, i) => 100 + i));
    expect(pendant.reads).toBeLessThan(6);
  });

  it("restarts from where it stopped when a read ends with an error status", async () => {
    const pendant = livePendant({ backlog: 1500, maxPerRead: 700, trickle: 0, failFirst: true });
    const got: number[] = [];
    const result = await runSync(pendant.transport, { onRecords: collect(got) });
    expect(result).toEqual({ outcome: "complete", records: 1500 });
    expect(got).toEqual(Array.from({ length: 1500 }, (_, i) => 100 + i));
  });
});

function collect(into: number[]) {
  return (seq: number, bytes: Uint8Array) => {
    for (let i = 0; i < bytes.length / RECORD_SIZE; i++) into.push(seq + i);
  };
}

/**
 * A pendant that keeps recording: each read ends after at most `maxPerRead` records, as the
 * firmware's read may, and `trickle` new records arrive after each read.
 */
function livePendant(o: {
  backlog: number;
  maxPerRead: number;
  trickle: number;
  failFirst?: boolean;
}) {
  const listeners = new Set<(bytes: Uint8Array) => void>();
  const emit = (bytes: Uint8Array) => {
    for (const listener of listeners) listener(bytes);
  };
  let readSeq = 100;
  let writeSeq = 100 + o.backlog;
  let reads = 0;
  let finished = false;
  const transport: RingTransport = {
    readStatus: async () => ({
      usedBytes: 0,
      unreadPackets: writeSeq - readSeq,
      freeBytes: 0,
      rtcValid: true,
    }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    write: async (bytes) => {
      if (bytes[0] === 0x10) queueMicrotask(() => emit(info(readSeq, writeSeq)));
      if (bytes[0] === 0x11) {
        const start = Number(new DataView(bytes.buffer).getBigUint64(1));
        const asked = new DataView(bytes.buffer).getUint32(9);
        reads += 1;
        const count = Math.min(asked, o.maxPerRead, writeSeq - start);
        void (async () => {
          emit(begin(start, count));
          const chunks = join(Array.from({ length: count }, (_, i) => record((start + i) % 250)));
          for (let at = 0, n = 0; at < chunks.length; at += 197, n += 1) {
            emit(data(chunks.subarray(at, at + 197)));
            // Notifications arrive over time, so the page's own work runs in between.
            if (n % 200 === 199) await new Promise((r) => setTimeout(r, 0));
          }
          if (o.failFirst && reads === 1) {
            // The read stops early with a "not ready" status.
            emit(join([Uint8Array.of(0x04, 9), u64(start + count)]));
          } else emit(done(start + count));
          finished = true;
          readSeq = start + count;
          writeSeq += o.trickle;
        })();
      }
    },
  };
  return {
    transport,
    get reads() {
      return reads;
    },
    get finished() {
      return finished;
    },
  };
}

describe("downloadSession", () => {
  const setup = (pendant: ReturnType<typeof livePendant>, pending = false) => {
    const store = memoryStore();
    const events: string[] = [];
    const uploaded: number[] = [];
    const upload = () =>
      flushRecords(store, async (batch) => {
        uploaded.push(batch.firstSeq);
        events.push(pendant.finished ? "upload-after" : "upload-during");
      });
    const run = (extra: { idleMs?: number } = {}) =>
      downloadSession({
        transport: pendant.transport,
        store,
        codec: 21,
        rtcValid: true,
        frameMs: 20,
        upload,
        assemble: async () => void events.push("assemble"),
        hadPending: pending,
        ...extra,
      });
    return { store, events, uploaded, run };
  };

  it("uploads while the download is still running and assembles when it ends", async () => {
    const pendant = livePendant({ backlog: 3000, maxPerRead: 3000, trickle: 0 });
    const { store, events, uploaded, run } = setup(pendant);
    const result = await run();
    expect(result.outcome).toBe("complete");
    // 3000 records are about 1.3 MB: several uploads, not one at the end.
    expect(uploaded.length).toBeGreaterThan(3);
    expect(await store.all()).toEqual([]);
    expect(events.at(-1)).toBe("assemble");
    expect(events.filter((e) => e === "assemble")).toHaveLength(1);
    expect(events.filter((e) => e === "upload-during").length).toBeGreaterThan(2);
  });

  it("assembles after a pause as well", async () => {
    const listeners: ((b: Uint8Array) => void)[] = [];
    const transport: RingTransport = {
      readStatus: async () => ({ usedBytes: 0, unreadPackets: 5000, freeBytes: 0, rtcValid: true }),
      subscribe: (l) => {
        listeners.push(l);
        return () => undefined;
      },
      write: async (bytes) => {
        if (bytes[0] === 0x10) for (const l of listeners) l(info(0, 5000));
        if (bytes[0] === 0x11 && !listeners.length) return;
      },
    };
    const store = memoryStore();
    await store.put([{ seq: 1, bytes: record(1), codec: 21, rtcValid: true }]);
    let assembled = 0;
    const result = await downloadSession({
      transport,
      store,
      codec: 21,
      rtcValid: true,
      frameMs: 20,
      idleMs: 10,
      upload: () => flushRecords(store, async () => undefined),
      assemble: async () => {
        assembled += 1;
      },
      hadPending: false,
    });
    expect(result.outcome).toBe("paused");
    expect(assembled).toBe(1);
  });

  it("assembles uploads an earlier sync left on the server even when nothing new arrives", async () => {
    const pendant = livePendant({ backlog: 0, maxPerRead: 10, trickle: 0 });
    let assembled = 0;
    const store = memoryStore();
    await downloadSession({
      transport: pendant.transport,
      store,
      codec: 21,
      rtcValid: true,
      frameMs: 20,
      upload: async () => 0,
      assemble: async () => {
        assembled += 1;
      },
      hadPending: true,
    });
    expect(assembled).toBe(1);
  });

  it("assembles about every ten minutes of audio during a long download", async () => {
    // 20 ms frames, 3 per record: 3000 records are 3 minutes, so use many records.
    const pendant = livePendant({ backlog: 30000, maxPerRead: 30000, trickle: 0 });
    const { events, run } = setup(pendant);
    await run();
    // 30000 records x 3 frames x 20 ms = 30 min: about three mid-run runs plus the final one.
    expect(events.filter((e) => e === "assemble").length).toBeGreaterThanOrEqual(3);
  });
});

const rec = (seq: number, extra: Partial<BufferedRecord> = {}): BufferedRecord => ({
  seq,
  bytes: record(seq % 250),
  codec: 21,
  rtcValid: true,
  ...extra,
});

describe("record buffer", () => {
  it("uploads in seq order, in batches, and deletes only after success", async () => {
    const store = memoryStore();
    await store.put([rec(3), rec(1), rec(2), rec(7), rec(8, { codec: 20 })]);
    const batches: { firstSeq: number; size: number }[] = [];
    let failOn = 2;
    const upload = async (batch: { firstSeq: number; bytes: Uint8Array }) => {
      if (batches.length + 1 === failOn) throw new Error("offline");
      batches.push({
        firstSeq: batch.firstSeq,
        size: batch.bytes.length / RECORD_SIZE,
      });
    };
    await expect(flushRecords(store, upload)).rejects.toThrow("offline");
    // seq 1-3 went; 7 (gap) failed and stays with 8.
    expect(batches).toEqual([{ firstSeq: 1, size: 3 }]);
    expect((await store.all()).map((r) => r.seq)).toEqual([7, 8]);
    failOn = 99;
    expect(await flushRecords(store, upload)).toBe(2);
    expect(batches.map((b) => b.firstSeq)).toEqual([1, 7, 8]);
    expect(await store.all()).toEqual([]);
  });

  it("splits batches at the byte limit", async () => {
    const store = memoryStore();
    await store.put([rec(1), rec(2), rec(3)]);
    const sizes: number[] = [];
    await flushRecords(
      store,
      async (b) => void sizes.push(b.bytes.length / RECORD_SIZE),
      undefined,
      RECORD_SIZE * 2,
    );
    expect(sizes).toEqual([2, 1]);
  });

  it("keeps records in memory when IndexedDB fails", async () => {
    const broken: RecordStore = {
      put: async () => {
        throw new Error("blocked");
      },
      all: async () => {
        throw new Error("blocked");
      },
      remove: async () => {
        throw new Error("blocked");
      },
    };
    const store = createRecordStore(broken);
    await store.put([rec(2), rec(1)]);
    expect((await store.all()).map((r) => r.seq)).toEqual([1, 2]);
    const uploaded: number[] = [];
    await flushRecords(store, async (b) => void uploaded.push(b.firstSeq));
    expect(uploaded).toEqual([1]);
    expect(await store.all()).toEqual([]);
  });

  describe("persistent storage request", () => {
    afterEach(() => vi.unstubAllGlobals());
    const stubIndexedDb = () => vi.stubGlobal("indexedDB", { open: () => ({}) });

    it("asks the browser once to keep the IndexedDB copy", () => {
      const persist = vi.fn(async () => true);
      vi.stubGlobal("navigator", { storage: { persist } });
      stubIndexedDb();
      indexedDbStore();
      expect(persist).toHaveBeenCalledTimes(1);
    });

    it("does not throw without the storage API or when persist rejects or throws", async () => {
      stubIndexedDb();
      vi.stubGlobal("navigator", {});
      expect(() => indexedDbStore()).not.toThrow();
      vi.stubGlobal("navigator", {
        storage: { persist: async () => Promise.reject(new Error("no")) },
      });
      expect(() => indexedDbStore()).not.toThrow();
      vi.stubGlobal("navigator", {
        storage: {
          persist: () => {
            throw new Error("no");
          },
        },
      });
      expect(() => indexedDbStore()).not.toThrow();
      await Promise.resolve();
    });
  });
});
