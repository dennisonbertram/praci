import { describe, expect, it, vi } from "vitest";

const doc = vi.hoisted(() => ({ pages: [] as { str: string; x: number; y?: number }[][] }));
vi.mock("unpdf", () => ({
  getDocumentProxy: async () => ({
    numPages: doc.pages.length,
    getPage: async (n: number) => ({
      getTextContent: async () => ({
        items: doc.pages[n - 1]!.map((i) => ({
          str: i.str,
          transform: [1, 0, 0, 1, i.x, i.y ?? 700],
          width: 10,
        })),
      }),
    }),
  }),
}));

import { extractPdfText } from "./pdf-text.js";

const run = () => extractPdfText(new Uint8Array([1]));

describe("extractPdfText limits", () => {
  it("clamps a huge x coordinate to a bounded run of spaces", async () => {
    doc.pages = [
      [
        { str: "a", x: 0 },
        { str: "b", x: 4_500_000 },
      ],
    ];
    const text = await run();
    expect(text.length).toBeLessThan(300);
    expect(text.startsWith("a")).toBe(true);
    expect(text.endsWith("b")).toBe(true);
  });

  it("survives NaN and negative coordinates", async () => {
    doc.pages = [
      [
        { str: "a", x: Number.NaN },
        { str: "b", x: -9e9 },
      ],
    ];
    expect(await run()).toBe("a b");
  });

  it("rejects a document with too many pages", async () => {
    doc.pages = Array.from({ length: 201 }, () => [{ str: "x", x: 0 }]);
    await expect(run()).rejects.toThrow("too many pages");
  });

  it("rejects when the extracted text is too large", async () => {
    // 100 pages of 100 rows of 300 characters is 3 MB.
    const rows = Array.from({ length: 100 }, (_, i) => ({ str: "x".repeat(300), x: 0, y: i * 10 }));
    doc.pages = Array.from({ length: 100 }, () => rows);
    await expect(run()).rejects.toThrow("too much text");
  });
});
