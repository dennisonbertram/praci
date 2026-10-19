import { describe, expect, it } from "vitest";
import { makePdf } from "./data-room-test-fakes.js";
import { renderPdfPages } from "./pdf-render.js";

const canvas = await import("@napi-rs/canvas").then(
  () => true,
  () => false,
);

describe("renderPdfPages", () => {
  it.skipIf(!canvas)(
    "renders a PDF page to a PNG (skipped: @napi-rs/canvas binary not available)",
    async () => {
      const pages = await renderPdfPages(makePdf("Hello"), 20);
      expect(pages).toHaveLength(1);
      expect([...pages[0]!.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    },
  );

  it("returns no pages for bytes that are not a PDF", async () => {
    expect(await renderPdfPages(new Uint8Array([1, 2, 3]), 20)).toEqual([]);
  });
});
