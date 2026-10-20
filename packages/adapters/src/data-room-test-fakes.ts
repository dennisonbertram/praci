import { createHash } from "node:crypto";
import type {
  AdapterContext,
  ArtifactStore,
  BackgroundJob,
  DataRoomClassifier,
  Embedder,
  JobPublisher,
} from "@rakazo/adapter-kit";
import { DATA_ROOM_EMBEDDING_DIMENSIONS } from "@rakazo/adapter-kit";
import type { DataRoomClassification } from "@rakazo/contracts";
import { strToU8, zipSync } from "fflate";
import type { DataRoomAi } from "./data-room-models.js";

/**
 * A one-page PDF whose text layer holds `text` (ASCII, no parentheses or backslashes), wrapped at
 * about 80 characters: a PDF reader drops text that runs past the page edge.
 */
export function makePdf(text: string): Uint8Array {
  const lines = text.match(/\S.{0,79}(?=\s|$)|\S{80}/g) ?? [];
  const shown = lines.map((line) => `(${line.trim()}) Tj T*`).join(" ");
  const stream = `BT /F1 12 Tf 14 TL 72 720 Td ${shown} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((body, i) => {
    const at = pdf.length;
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const at of offsets) pdf += `${String(at).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

/** A zip of the given files (text or bytes), keyed by their path inside the zip. */
export function makeZip(files: Record<string, string | Uint8Array>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, data]) => [
        path,
        typeof data === "string" ? strToU8(data) : data,
      ]),
    ),
  );
}

export class MemoryArtifacts implements ArtifactStore {
  readonly blobs = new Map<string, Uint8Array>();
  /** Objects whose stream is still being written; empty once every put settled. */
  readonly partial = new Set<string>();
  /** Chunks, largest chunk and bytes received so far by `putStream`, across all calls. */
  chunks = 0;
  maxChunkBytes = 0;
  consumedBytes = 0;
  /** Makes `put` throw, so a route that buffers a whole body fails its test. */
  failPut = false;
  private next = 0;
  describe() {
    return {
      id: "memory",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { stream: false },
    };
  }
  async put(artifact: { bytes: Uint8Array }) {
    if (this.failPut) throw new Error("put is not allowed here");
    const id = `blob-${++this.next}`;
    this.blobs.set(id, artifact.bytes);
    return { id, hash: createHash("sha256").update(artifact.bytes).digest("hex") };
  }
  async putStream(
    body: AsyncIterable<Uint8Array>,
    _file: { name: string; mimeType: string },
    context: AdapterContext,
  ) {
    const id = `blob-${++this.next}`;
    const hash = createHash("sha256");
    const parts: Uint8Array[] = [];
    let size = 0;
    this.partial.add(id);
    try {
      for await (const chunk of body) {
        context.signal?.throwIfAborted();
        hash.update(chunk);
        parts.push(chunk);
        size += chunk.byteLength;
        this.chunks += 1;
        this.consumedBytes += chunk.byteLength;
        this.maxChunkBytes = Math.max(this.maxChunkBytes, chunk.byteLength);
      }
      context.signal?.throwIfAborted();
      this.blobs.set(id, Buffer.concat(parts));
    } finally {
      this.partial.delete(id);
    }
    return { id, hash: hash.digest("hex"), size };
  }
  async get(id: string) {
    const bytes = this.blobs.get(id);
    if (!bytes) throw new Error("missing blob");
    return bytes;
  }
  async getStream(id: string, _context: AdapterContext, range?: { start: number; end: number }) {
    const bytes = this.blobs.get(id);
    if (!bytes) throw new Error("missing blob");
    let at = range?.start ?? 0;
    const end = Math.min(range?.end ?? bytes.byteLength, bytes.byteLength);
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (at >= end) return controller.close();
        controller.enqueue(bytes.subarray(at, Math.min(end, at + 64 * 1024)));
        at += 64 * 1024;
      },
    });
  }
  async remove(id: string) {
    this.blobs.delete(id);
  }
}

/** Collects enqueued jobs; `take` removes and returns them in order. */
export class RecordingJobs implements JobPublisher {
  readonly queue: BackgroundJob[] = [];
  readonly all: BackgroundJob[] = [];
  async enqueue(job: BackgroundJob) {
    this.queue.push(job);
    this.all.push(job);
  }
  async cancel() {}
  async close() {}
  take() {
    return this.queue.splice(0);
  }
}

/** A fixed 1024-number vector per text, so equal texts embed equally. */
export function fakeVector(text: string): number[] {
  const hash = createHash("sha256").update(text).digest();
  return Array.from(
    { length: DATA_ROOM_EMBEDDING_DIMENSIONS },
    (_, i) => (hash[i % 32] ?? 0) / 255,
  );
}

export class FakeEmbedder implements Embedder {
  calls: string[][] = [];
  failWith: Error | null = null;
  constructor(readonly modelName = "fake-embed-1") {}
  describe() {
    return {
      id: "fake",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { dimensions: DATA_ROOM_EMBEDDING_DIMENSIONS, maxBatch: 64 },
    };
  }
  async embed(texts: string[], _context: AdapterContext) {
    this.calls.push(texts);
    if (this.failWith) throw this.failWith;
    return { model: this.modelName, vectors: texts.map(fakeVector) };
  }
}

export class FakeClassifier implements DataRoomClassifier {
  calls: { name: string; text: string; folders: string[][] }[] = [];
  failWith: Error | null = null;
  result: DataRoomClassification = {
    docType: "invoice",
    title: "Invoice",
    docDate: "2026-03-15",
    parties: ["Acme Example Co"],
    amountCents: 123_456,
    currency: "USD",
    summary: "An invoice.",
    tags: ["billing"],
    folderPath: ["Invoices", "2026"],
    confidence: 0.9,
  };
  describe() {
    return { id: "fake", contractVersion: "1", adapterVersion: "1", capabilities: {} };
  }
  async classify(input: { name: string; text: string; folders: string[][] }) {
    this.calls.push({ name: input.name, text: input.text, folders: input.folders });
    if (this.failWith) throw this.failWith;
    return this.result;
  }
  async planQuery(): Promise<never> {
    throw new Error("not used");
  }
}

export function fakeAi(overrides: Partial<DataRoomAi> = {}): DataRoomAi {
  return {
    model: { provider: "openai-compatible", id: "chat-1" } as DataRoomAi["model"],
    embedder: null,
    embeddingModel: null,
    recipients: [{ key: "k1", name: "Example (https://llm.example.test)", detail: "chat-1" }],
    consentKey: "data-room:test",
    allowed: true,
    ...overrides,
  };
}
