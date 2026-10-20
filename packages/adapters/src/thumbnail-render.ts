import { getLogger } from "@rakazo/logging";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

/** Width of a stored thumbnail; a smaller image is never enlarged. */
export const THUMBNAIL_WIDTH = 320;
/** The most pixels an image may have before it is decoded; the size is read from its header. */
export const THUMBNAIL_MAX_SOURCE_PIXELS = 40_000_000;
/** A PDF page taller than this many times its width is not drawn. */
export const THUMBNAIL_MAX_PAGE_ASPECT = 4;
export const THUMBNAIL_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const THUMBNAIL_PDF_MAX_BYTES = 25 * 1024 * 1024;

let warned = false;

const u16 = (b: Uint8Array, at: number) => ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
const u32 = (b: Uint8Array, at: number) => u16(b, at) * 65_536 + u16(b, at + 2);
const le = (b: Uint8Array, at: number, n: number) => {
  let v = 0;
  for (let i = n - 1; i >= 0; i--) v = v * 256 + (b[at + i] ?? 0);
  return v;
};
const ascii = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, at + n));

/** Width and height from a PNG, GIF, JPEG or WebP header, without decoding; null if unreadable. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (ascii(bytes, 1, 3) === "PNG") return { width: u32(bytes, 16), height: u32(bytes, 20) };
  if (ascii(bytes, 0, 3) === "GIF") return { width: le(bytes, 6, 2), height: le(bytes, 8, 2) };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    const kind = ascii(bytes, 12, 4);
    if (kind === "VP8X") return { width: le(bytes, 24, 3) + 1, height: le(bytes, 27, 3) + 1 };
    if (kind === "VP8L") {
      const bits = le(bytes, 21, 4);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8 ")
      return { width: le(bytes, 26, 2) & 0x3fff, height: le(bytes, 28, 2) & 0x3fff };
    return null;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1] ?? 0;
      // Start-of-frame markers carry the size; 0xc4, 0xc8 and 0xcc are not frames.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { width: u16(bytes, at + 7), height: u16(bytes, at + 5) };
      at += 2 + u16(bytes, at + 2);
    }
  }
  return null;
}

type Canvas = typeof import("@napi-rs/canvas");

/** Scales a decoded image to the thumbnail width on white and encodes it as WebP. */
async function toWebp(canvas: Canvas, source: Uint8Array): Promise<Uint8Array> {
  const image = await canvas.loadImage(Buffer.from(source));
  const scale = Math.min(1, THUMBNAIL_WIDTH / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const surface = canvas.createCanvas(width, height);
  const context = surface.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return new Uint8Array(await surface.encode("webp", 80));
}

async function pdfFirstPage(bytes: Uint8Array): Promise<Uint8Array | null> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  // The page size comes from the file: size the drawing from it before anything is allocated.
  const { width, height } = (await pdf.getPage(1)).getViewport({ scale: 1 });
  if (!(width > 0) || !(height > 0) || height / width > THUMBNAIL_MAX_PAGE_ASPECT) return null;
  const png = await renderPageAsImage(pdf, 1, {
    canvasImport: () => import("@napi-rs/canvas"),
    scale: THUMBNAIL_WIDTH / width,
  });
  return new Uint8Array(png);
}

/**
 * A WebP of at most 320 px width for a PDF's first page or a raster image, or null when the file
 * is too big, unreadable, has too many pixels, or the native canvas binary is missing. The binary
 * loads on first use; nothing else depends on it.
 */
export async function renderThumbnail(bytes: Uint8Array, type: string): Promise<Uint8Array | null> {
  const isPdf = type === "application/pdf";
  if (bytes.byteLength > (isPdf ? THUMBNAIL_PDF_MAX_BYTES : THUMBNAIL_IMAGE_MAX_BYTES)) return null;
  if (!isPdf) {
    const size = imageSize(bytes);
    if (!size || size.width < 1 || size.height < 1) return null;
    if (size.width * size.height > THUMBNAIL_MAX_SOURCE_PIXELS) return null;
  }
  try {
    const canvas = await import("@napi-rs/canvas");
    const source = isPdf ? await pdfFirstPage(bytes) : bytes;
    return source ? await toWebp(canvas, source) : null;
  } catch (error) {
    if (!warned) {
      warned = true;
      getLogger().warn("thumbnails are unavailable for a file", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}
