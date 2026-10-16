import type { DataRoomItemRecord } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import type { DataRoomJobDeps } from "./data-room-jobs.js";
import {
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
  chunkText,
  extractItemText,
} from "./data-room-jobs.js";
import { fakeAi, MemoryArtifacts, makePdf, RecordingJobs } from "./data-room-test-fakes.js";

describe("chunkText", () => {
  it("keeps short text in one chunk and returns none for blank text", () => {
    expect(chunkText("  hello world  ")).toEqual(["hello world"]);
    expect(chunkText(" \n\n ")).toEqual([]);
  });

  it("splits on paragraph breaks, caps each chunk and overlaps neighbours", () => {
    const paragraph = `${"word ".repeat(150)}end.`;
    const text = Array.from({ length: 12 }, () => paragraph).join("\n\n");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(CHUNK_TARGET_CHARS);
    for (let i = 1; i < chunks.length; i++) {
      // The next chunk starts inside the previous one: its first words appear there.
      const head = chunks[i]?.slice(0, 40) ?? "";
      expect(chunks[i - 1]).toContain(head);
    }
    // Every chunk but the last ends on a paragraph boundary.
    for (const chunk of chunks.slice(0, -1)) expect(chunk.endsWith("end.")).toBe(true);
    expect(chunks.at(-1)?.endsWith("end.")).toBe(true);
  });

  it("breaks on a sentence, then a space, then hard-cuts text with neither", () => {
    const sentences = `${"This is a sentence. ".repeat(400)}`;
    for (const chunk of chunkText(sentences).slice(0, -1)) expect(chunk.endsWith(".")).toBe(true);
    const words = chunkText("lorem ".repeat(1500));
    for (const chunk of words.slice(0, -1)) expect(chunk.endsWith("lorem")).toBe(true);
    const solid = chunkText("x".repeat(10_000));
    expect(solid[0]?.length).toBe(CHUNK_TARGET_CHARS);
    expect(solid.every((c) => c.length <= CHUNK_MAX_CHARS)).toBe(true);
    // Hard cuts still overlap by the configured amount, so a long token is not lost.
    expect(solid.length).toBe(
      Math.ceil((10_000 - CHUNK_OVERLAP_CHARS) / (CHUNK_TARGET_CHARS - CHUNK_OVERLAP_CHARS)),
    );
  });
});

describe("extractItemText", () => {
  const item = (name: string, mimeType: string) =>
    ({ name, mimeType }) as unknown as DataRoomItemRecord;
  const deps = {
    artifacts: new MemoryArtifacts(),
    jobs: new RecordingJobs(),
  } as unknown as DataRoomJobDeps;
  const ctx = { signal: new AbortController().signal } as never;
  const extract = (name: string, mimeType: string, bytes: Uint8Array | string, ai = fakeAi()) =>
    extractItemText(
      deps,
      ai,
      item(name, mimeType),
      typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes,
      ctx,
    );

  it("reads the text layer of a PDF", async () => {
    const text = await extract(
      "a.pdf",
      "application/pdf",
      makePdf("Quarterly invoice 4821 for Acme"),
    );
    expect(text).toContain("Quarterly invoice 4821 for Acme");
  });

  it("gives no text for a PDF without a text layer", async () => {
    expect(await extract("scan.pdf", "application/pdf", makePdf(""))).toBe("");
  });

  it("keeps a short PDF text layer", async () => {
    expect(await extract("a.pdf", "application/pdf", makePdf("Invoice 12"))).toBe("Invoice 12");
  });

  it("decodes plain text, markdown, csv and json as UTF-8", async () => {
    expect(await extract("a.txt", "text/plain", "héllo wörld")).toBe("héllo wörld");
    expect(await extract("a.md", "text/markdown", "# Title\n\nbody")).toBe("# Title\n\nbody");
    expect(await extract("a.csv", "text/csv", "a,b\n1,2")).toBe("a,b\n1,2");
    expect(await extract("a.json", "application/json", '{"k":"v"}')).toBe('{"k":"v"}');
    // An upload with no useful type is read by its extension.
    expect(await extract("notes.txt", "application/octet-stream", "by extension")).toBe(
      "by extension",
    );
  });

  it("strips tags, scripts and styles from HTML", async () => {
    const html =
      "<html><head><style>p{color:red}</style><script>alert(1)</script></head><body><h1>Title</h1><p>Hello &amp; welcome</p></body></html>";
    const text = await extract("a.html", "text/html", html);
    expect(text).toContain("Title");
    expect(text).toContain("Hello & welcome");
    expect(text).not.toMatch(/alert|color:red|<p>/);
  });

  it("stores no text for Office documents and unknown types", async () => {
    const docx = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    expect(await extract("a.docx", docx, "PK\u0003\u0004 not really")).toBe("");
    expect(await extract("a.bin", "application/x-unknown", "abc")).toBe("");
  });

  it("does not read an image without a model, consent or image support", async () => {
    expect(await extract("a.png", "image/png", "x", fakeAi({ model: null }))).toBe("");
    expect(await extract("a.png", "image/png", "x", fakeAi({ allowed: false }))).toBe("");
  });

  it("reads an image through the vision model only when it accepts images and consent is given", async () => {
    const seen: unknown[] = [];
    const runtime = {
      run: async function* (request: { currentTurnImages?: unknown[] }) {
        seen.push(request.currentTurnImages);
        yield { type: "done", text: "Receipt total 42" };
      },
    };
    const visionDeps = {
      ...deps,
      runtime,
      prisma: { usageRecord: { create: async () => ({}) } },
    } as unknown as DataRoomJobDeps;
    const read = (ai: ReturnType<typeof fakeAi>) =>
      extractItemText(visionDeps, ai, item("r.png", "image/png"), new Uint8Array([1, 2, 3]), ctx);
    const seeing = fakeAi({
      model: { provider: "openai-compatible", id: "vis", acceptsImages: true } as never,
    });
    expect(await read(seeing)).toBe("Receipt total 42");
    expect(seen).toHaveLength(1);
    // Text-only model: the catalog does not list this id as an image model.
    expect(await read(fakeAi({ model: { provider: "openai", id: "nope-1" } as never }))).toBe("");
    expect(await read({ ...seeing, allowed: false })).toBe("");
    expect(seen).toHaveLength(1);
  });
});
