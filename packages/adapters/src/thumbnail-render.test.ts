import { describe, expect, it } from "vitest";
import { makePdf } from "./data-room-test-fakes.js";
import {
  imageSize,
  renderThumbnail,
  THUMBNAIL_IMAGE_MAX_BYTES,
  THUMBNAIL_WIDTH,
} from "./thumbnail-render.js";

const canvas = await import("@napi-rs/canvas").then(
  (module) => module,
  () => null,
);

const picture = async (width: number, height: number, format: "png" | "jpeg" | "webp") => {
  const surface = canvas!.createCanvas(width, height);
  const context = surface.getContext("2d");
  context.fillStyle = "#3366aa";
  context.fillRect(0, 0, width, height);
  return new Uint8Array(await surface.encode(format as "png"));
};

/** A PNG header that claims `width` by `height` with no pixel data behind it. */
const claimedPng = (width: number, height: number) => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};

describe("imageSize", () => {
  it("reads the size from a GIF header and from a PNG header", () => {
    const gif = new Uint8Array([...new TextEncoder().encode("GIF89a"), 40, 1, 20, 0]);
    expect(imageSize(gif)).toEqual({ width: 296, height: 20 });
    expect(imageSize(claimedPng(1000, 500))).toEqual({ width: 1000, height: 500 });
  });

  it.skipIf(!canvas)("reads the size of a real JPEG and WebP", async () => {
    expect(imageSize(await picture(123, 45, "jpeg"))).toEqual({ width: 123, height: 45 });
    expect(imageSize(await picture(123, 45, "webp"))).toEqual({ width: 123, height: 45 });
  });

  it("gives null for bytes that are not an image", () => {
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("renderThumbnail", () => {
  it.skipIf(!canvas)(
    "downscales a PNG to a 320 px wide WebP (skipped: @napi-rs/canvas binary not available)",
    async () => {
      const webp = await renderThumbnail(await picture(1280, 640, "png"), "image/png");
      expect(webp).not.toBeNull();
      expect(imageSize(webp!)).toEqual({ width: THUMBNAIL_WIDTH, height: 160 });
    },
  );

  it.skipIf(!canvas)("does not enlarge a small image", async () => {
    const webp = await renderThumbnail(await picture(100, 50, "png"), "image/png");
    expect(imageSize(webp!)).toEqual({ width: 100, height: 50 });
  });

  it.skipIf(!canvas)("draws the first page of a PDF", async () => {
    const webp = await renderThumbnail(makePdf("Hello thumbnail"), "application/pdf");
    expect(webp).not.toBeNull();
    expect(imageSize(webp!)).toEqual({ width: THUMBNAIL_WIDTH, height: 414 });
  });

  it("refuses an image that claims more pixels than the cap, before decoding it", async () => {
    expect(await renderThumbnail(claimedPng(20_000, 20_000), "image/png")).toBeNull();
  });

  it("refuses a file over the input size limit", async () => {
    const big = new Uint8Array(THUMBNAIL_IMAGE_MAX_BYTES + 1);
    expect(await renderThumbnail(big, "image/png")).toBeNull();
  });

  it.skipIf(!canvas)("refuses a PDF page that is far taller than it is wide", async () => {
    const tall = new TextDecoder("latin1")
      .decode(makePdf("Hello"))
      .replace("[0 0 612 792]", "[0 0 100 90000]");
    const bytes = new Uint8Array([...tall].map((c) => c.charCodeAt(0)));
    expect(await renderThumbnail(bytes, "application/pdf")).toBeNull();
  });

  it("gives null for bytes that are not a PDF", async () => {
    expect(await renderThumbnail(new Uint8Array([1, 2, 3]), "application/pdf")).toBeNull();
  });
});
