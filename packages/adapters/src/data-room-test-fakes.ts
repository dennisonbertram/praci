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
import type { DataRoomAi } from "./data-room-models.js";

/** A one-page PDF whose text layer holds `text` (ASCII, no parentheses or backslashes). */
export function makePdf(text: string): Uint8Array {
  // One line per ~80 characters, so text past the page width is not clipped on extraction.
  const lines = text.match(/.{1,80}(\s|$)/g) ?? [text];
  const shown = lines.map((line) => `(${line.trim()}) Tj`).join(" T* ");
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

export class MemoryArtifacts implements ArtifactStore {
  readonly blobs = new Map<string, Uint8Array>();
  describe() {
    return {
      id: "memory",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { stream: false },
    };
  }
  async put(artifact: { bytes: Uint8Array }) {
    const id = `blob-${this.blobs.size + 1}`;
    this.blobs.set(id, artifact.bytes);
    return { id, hash: id };
  }
  async get(id: string) {
    const bytes = this.blobs.get(id);
    if (!bytes) throw new Error("missing blob");
    return bytes;
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
