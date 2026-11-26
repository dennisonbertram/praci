import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { jpegFrame, scannedPdf } from "./scanner-pdf.js";

async function fixture(name: string) {
  return Buffer.from(
    await readFile(new URL(`./fixtures/scanner/${name}.b64`, import.meta.url), "utf8"),
    "base64",
  );
}

describe("scanned PDF", () => {
  it("embeds valid JPEG pages in order at their 300 dpi physical sizes and writes byte offsets", async () => {
    const first = await fixture("page-one.jpg");
    const second = await fixture("page-two.jpg");
    expect(jpegFrame(first)).toEqual({ width: 12, height: 8, components: 3 });
    expect(jpegFrame(second)).toEqual({ width: 7, height: 11, components: 3 });

    const pdf = scannedPdf([first, second]);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/MediaBox [0 0 2.88 1.92]");
    expect(text).toContain("/MediaBox [0 0 1.68 2.64]");
    expect(pdf.indexOf(first)).toBeLessThan(pdf.indexOf(second));

    const startXref = Number(text.match(/startxref\n(\d+)\n/)?.[1]);
    expect(pdf.subarray(startXref, startXref + 4).toString("ascii")).toBe("xref");
    const xref = text.slice(startXref);
    const objectOffsets = [...xref.matchAll(/^(\d{10}) 00000 n $/gm)].map((match) =>
      Number(match[1]),
    );
    for (const [index, offset] of objectOffsets.entries()) {
      expect(pdf.subarray(offset, offset + 8).toString("ascii")).toBe(`${index + 1} 0 obj\n`);
    }
  });

  it("rejects invalid frames and unsupported component counts", async () => {
    expect(() => jpegFrame(Buffer.from("not a jpeg"))).toThrow();
    const jpeg = await fixture("page-one.jpg");
    const frame = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
    expect(frame).toBeGreaterThan(-1);
    jpeg[frame + 9] = 2;
    expect(() => jpegFrame(jpeg)).toThrow();
    expect(() => scannedPdf([])).toThrow();
  });
});
