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

  it.skipIf(!canvas)("caps the rendered size of a huge page", async () => {
    const huge = new TextDecoder("latin1")
      .decode(makePdf("Hello"))
      .replace("[0 0 612 792]", "[0 0 20000 30000]");
    const [png] = await renderPdfPages(new Uint8Array([...huge].map((c) => c.charCodeAt(0))), 20);
    const view = new DataView(png!.buffer, png!.byteOffset);
    // PNG IHDR: width and height at bytes 16 and 20.
    expect(Math.max(view.getUint32(16), view.getUint32(20))).toBeLessThanOrEqual(2_000);
  });

  it("returns no pages for bytes that are not a PDF", async () => {
    expect(await renderPdfPages(new Uint8Array([1, 2, 3]), 20)).toEqual([]);
  });
});
