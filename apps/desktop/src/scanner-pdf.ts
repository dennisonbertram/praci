const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const MAX_IMAGE_DIMENSION = 20_000;
const MAX_IMAGE_PIXELS = 300_000_000;
const MAX_PAGES = 500;

export interface JpegFrame {
  width: number;
  height: number;
  components: 1 | 3;
}

export function jpegFrame(bytes: Uint8Array): JpegFrame {
  if (
    bytes.byteLength < 16 ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.byteLength - 2] !== 0xff ||
    bytes[bytes.byteLength - 1] !== 0xd9
  ) {
    throw new Error("Invalid JPEG.");
  }

  let offset = 2;
  while (offset < bytes.byteLength - 1) {
    if (bytes[offset] !== 0xff) throw new Error("Invalid JPEG marker.");
    while (offset < bytes.byteLength && bytes[offset] === 0xff) offset++;
    if (offset >= bytes.byteLength) break;
    const marker = bytes[offset++]!;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.byteLength) throw new Error("Invalid JPEG segment.");

    const length = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (length < 2 || offset + length > bytes.byteLength) {
      throw new Error("Invalid JPEG segment.");
    }
    if (SOF_MARKERS.has(marker)) {
      if (length < 8) throw new Error("Invalid JPEG frame.");
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      const components = bytes[offset + 7]!;
      if (
        bytes[offset + 2] !== 8 ||
        width < 1 ||
        height < 1 ||
        width > MAX_IMAGE_DIMENSION ||
        height > MAX_IMAGE_DIMENSION ||
        width * height > MAX_IMAGE_PIXELS ||
        (components !== 1 && components !== 3) ||
        length !== 8 + 3 * components
      ) {
        throw new Error("Unsupported JPEG frame.");
      }
      return { width, height, components };
    }
    offset += length;
  }
  throw new Error("JPEG frame is missing.");
}

function points(pixels: number, dpi: number) {
  return ((pixels * 72) / dpi).toFixed(4).replace(/\.?0+$/, "");
}

export function scannedPdf(pages: readonly Uint8Array[], dpi = 300): Buffer {
  if (
    pages.length === 0 ||
    pages.length > MAX_PAGES ||
    !Number.isInteger(dpi) ||
    dpi < 72 ||
    dpi > 1200
  ) {
    throw new Error("Invalid scan dimensions.");
  }

  const frames = pages.map(jpegFrame);
  const objects: Buffer[] = [];
  const setObject = (id: number, body: Buffer | string) => {
    objects[id] = Buffer.isBuffer(body) ? body : Buffer.from(body, "binary");
  };
  const kids: string[] = [];

  setObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  for (let index = 0; index < pages.length; index++) {
    const pageId = 3 + index * 3;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const frame = frames[index]!;
    const width = points(frame.width, dpi);
    const height = points(frame.height, dpi);
    const image = Buffer.from(pages[index]!);
    const content = Buffer.from(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`, "ascii");

    setObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    setObject(
      imageId,
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${frame.width} /Height ${frame.height} /ColorSpace /Device${frame.components === 1 ? "Gray" : "RGB"} /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.byteLength} >>\nstream\n`,
          "ascii",
        ),
        image,
        Buffer.from("\nendstream", "ascii"),
      ]),
    );
    setObject(
      contentId,
      Buffer.concat([
        Buffer.from(`<< /Length ${content.byteLength} >>\nstream\n`, "ascii"),
        content,
        Buffer.from("endstream", "ascii"),
      ]),
    );
    kids.push(`${pageId} 0 R`);
  }

  setObject(2, `<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`);
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    chunks.push(
      Buffer.from(`${id} 0 obj\n`, "ascii"),
      objects[id]!,
      Buffer.from("\nendobj\n", "ascii"),
    );
  }
  const xrefOffset = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const xref = [
    `xref\n0 ${objects.length}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ];
  chunks.push(Buffer.from(xref.join(""), "ascii"));
  return Buffer.concat(chunks);
}
