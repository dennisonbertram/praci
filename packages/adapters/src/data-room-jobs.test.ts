import type { DataRoomItemRecord } from "@rakazo/db";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { DataRoomJobDeps } from "./data-room-jobs.js";
import {
  CHUNK_MAX_CHARS,
  CHUNK_OVERLAP_CHARS,
  CHUNK_TARGET_CHARS,
  chunkText,
  DATA_ROOM_TEXT_MAX_CHARS,
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

  it("reads every word of a long line of PDF text", async () => {
    // Text past the page edge is not on the page, so the fake must wrap. The demo lease once lost
    // everything after "Renewal date" and could not be found by "November".
    const lease =
      "Office lease for 100 Placeholder Street. Monthly rent 7500 dollars. Renewal date 31 January. Notice of renewal due 30 November.";
    const text = await extract("lease.pdf", "application/pdf", makePdf(lease));
    expect(text.replace(/\s+/g, " ")).toBe(lease);
  });

  it("reads a PDF of more than 200 pages instead of failing", async () => {
    const text = await extract("policy.pdf", "application/pdf", makePdf("Policy clause 7", 250));
    expect(text).toContain("Policy clause 7");
    expect(text.length).toBeLessThanOrEqual(DATA_ROOM_TEXT_MAX_CHARS);
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

  const OFFICE = "application/vnd.openxmlformats-officedocument";
  const zip = (files: Record<string, string>) =>
    zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

  it("reads .docx paragraphs in order", async () => {
    const xml =
      "<w:document><w:body><w:p><w:r><w:t>First &amp; </w:t></w:r><w:r><w:t>part</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p></w:body></w:document>";
    const bytes = zip({ "word/document.xml": xml, "word/styles.xml": "<x>ignored</x>" });
    expect(await extract("a.docx", `${OFFICE}.wordprocessingml.document`, bytes)).toBe(
      "First & part\nSecond",
    );
  });

  it("reads .xlsx cells as rows, resolving shared strings", async () => {
    const bytes = zip({
      "xl/sharedStrings.xml": "<sst><si><t>Name</t></si><si><t>Total</t></si></sst>",
      "xl/worksheets/sheet1.xml":
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>Acme</t></is></c><c r="B2"><v>42</v></c></row></sheetData></worksheet>',
      "xl/worksheets/sheet2.xml":
        '<worksheet><sheetData><row><c t="inlineStr"><is><t>Second sheet</t></is></c></row></sheetData></worksheet>',
    });
    expect(await extract("a.xlsx", `${OFFICE}.spreadsheetml.sheet`, bytes)).toBe(
      "Name\tTotal\nAcme\t42\n\nSecond sheet",
    );
  });

  it("reads .pptx slides in numeric order", async () => {
    const slide = (t: string) => `<p:sld><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:sld>`;
    const bytes = zip({
      "ppt/slides/slide10.xml": slide("Ten"),
      "ppt/slides/slide2.xml": slide("Two"),
      "ppt/slides/slide1.xml": slide("One"),
    });
    expect(await extract("a.pptx", `${OFFICE}.presentationml.presentation`, bytes)).toBe(
      "One\n\nTwo\n\nTen",
    );
  });

  it("stops at the decompressed-size cap instead of expanding a zip bomb", async () => {
    const bomb = zip({
      "word/document.xml": `<w:p><w:t>${"a".repeat(60 * 1024 * 1024)}</w:t></w:p>`,
    });
    expect(bomb.byteLength).toBeLessThan(1024 * 1024);
    expect(await extract("a.docx", `${OFFICE}.wordprocessingml.document`, bomb)).toBe("");
  });

  it("reads hostile XML in linear time", async () => {
    const docx = `${OFFICE}.wordprocessingml.document`;
    const hostile = `<w:p><w:t>ok</w:t>${"<w:t ".repeat(200_000)}`;
    expect(hostile.length).toBeGreaterThan(1_000_000);
    const sheet = `<row>${"<c t=".repeat(200_000)}`;
    const files = zip({ "word/document.xml": hostile });
    const sheets = zip({ "xl/worksheets/sheet1.xml": sheet });
    const started = performance.now();
    expect(await extract("a.docx", docx, files)).toBe("ok");
    expect(await extract("a.xlsx", `${OFFICE}.spreadsheetml.sheet`, sheets)).toBe("");
    expect(performance.now() - started).toBeLessThan(200);
  });

  it("stops a sheet whose cells all reference one huge shared string at the character cap", async () => {
    const big = "x".repeat(900_000);
    const cells = '<c t="s"><v>0</v></c>'.repeat(5_000);
    const bytes = zip({
      "xl/sharedStrings.xml": `<sst><si><t>${big}</t></si></sst>`,
      "xl/worksheets/sheet1.xml": `<worksheet><row>${cells}</row><row>${cells}</row></worksheet>`,
    });
    const started = performance.now();
    const text = await extract("a.xlsx", `${OFFICE}.spreadsheetml.sheet`, bytes);
    expect(text.length).toBeLessThanOrEqual(1_000_000);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

  it("gives no text for legacy Office files, corrupt zips and unknown types", async () => {
    expect(await extract("a.doc", "application/msword", "ÐÏ\u0011à")).toBe("");
    expect(
      await extract("a.docx", `${OFFICE}.wordprocessingml.document`, "PK\u0003\u0004 no"),
    ).toBe("");
    expect(await extract("a.bin", "application/x-unknown", "abc")).toBe("");
  });

  describe("scanned PDFs", () => {
    const seen: string[] = [];
    const runtime = {
      run: async function* (request: { currentTurnImages?: { data: Uint8Array }[] }) {
        const page = request.currentTurnImages?.[0]?.data[0];
        seen.push(String(page));
        yield { type: "done", text: `page ${page}` };
      },
    };
    const rendered: number[] = [];
    const seeing = fakeAi({
      model: { provider: "openai-compatible", id: "vis", acceptsImages: true } as never,
    });
    const scanDeps = {
      ...deps,
      runtime,
      prisma: { usageRecord: { create: async () => ({}) } },
      resolveAi: async () => seeing,
      renderPdfPages: async (_bytes: Uint8Array, max: number) => {
        rendered.push(max);
        return [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])];
      },
    } as unknown as DataRoomJobDeps;
    const scan = (ai: ReturnType<typeof fakeAi>, pdf = makePdf("")) =>
      extractItemText(scanDeps, ai, item("scan.pdf", "application/pdf"), pdf, ctx);

    it("sends the rendered pages of a PDF without a text layer to vision and joins them", async () => {
      expect(await scan(seeing)).toBe("page 1\n\npage 2\n\npage 3");
      expect(seen).toEqual(["1", "2", "3"]);
      expect(rendered).toEqual([20]);
    });

    it("does not send a long PDF with a normal text layer to vision, but still reads a long scan", async () => {
      // 500 pages at 25 characters: the 200 pages read hold 5000 characters, under 20 per page of all 500.
      const before = seen.length;
      const text = await scan(seeing, makePdf("Clause text for the pages", 500));
      expect(text).toContain("Clause text");
      expect(seen.length).toBe(before);
      expect(await scan(seeing, makePdf("", 500))).toBe("page 1\n\npage 2\n\npage 3");
    });

    it("re-reads consent before rendering and before every page, and drops output if revoked", async () => {
      const calls = { render: 0, vision: 0 };
      let allowed = true;
      let revokeAtVision = 0;
      const countingDeps = {
        ...scanDeps,
        resolveAi: async () => ({ ...seeing, allowed }),
        renderPdfPages: async () => {
          calls.render += 1;
          return [new Uint8Array([1]), new Uint8Array([2])];
        },
        runtime: {
          run: async function* () {
            calls.vision += 1;
            if (calls.vision === revokeAtVision) allowed = false;
            yield { type: "done", text: "page" };
          },
        },
      } as unknown as DataRoomJobDeps;
      const read = () =>
        extractItemText(countingDeps, seeing, item("s.pdf", "application/pdf"), makePdf(""), ctx);
      // Revoked before the read starts, though the `ai` passed in is stale: no render, no call.
      allowed = false;
      expect(await read()).toBe("");
      expect(calls).toEqual({ render: 0, vision: 0 });
      // Revoked during the second (last) OCR call: nothing is kept.
      allowed = true;
      revokeAtVision = 2;
      expect(await read()).toBe("");
      expect(calls.vision).toBe(2);
      // Revoked during the first call: the second page is never sent.
      allowed = true;
      calls.vision = 0;
      revokeAtVision = 1;
      expect(await read()).toBe("");
      expect(calls.vision).toBe(1);
    });

    it("keeps a sparse text layer when vision gives nothing", async () => {
      const sparse = makePdf("Invoice 12");
      expect(await scan({ ...seeing, allowed: false }, sparse)).toBe("Invoice 12");
      const noCanvas = {
        ...scanDeps,
        renderPdfPages: async () => [],
      } as unknown as DataRoomJobDeps;
      expect(
        await extractItemText(noCanvas, seeing, item("s.pdf", "application/pdf"), sparse, ctx),
      ).toBe("Invoice 12");
    });

    it("makes no vision call when consent is off or the PDF has a text layer", async () => {
      seen.length = 0;
      expect(await scan({ ...seeing, allowed: false })).toBe("");
      const layered = makePdf("A real text layer, long enough.");
      expect(await scan(seeing, layered)).toBe("A real text layer, long enough.");
      expect(seen).toEqual([]);
    });
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
