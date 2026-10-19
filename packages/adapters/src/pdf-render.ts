import { getLogger } from "@rakazo/logging";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

let warned = false;

const MAX_EDGE_PX = 2_000;
const MAX_TOTAL_PIXELS = 40_000_000;
const SCALE = 1.5;

/**
 * Renders PDF pages to PNG for scanned-PDF reading. The native canvas binary loads on first use;
 * if it is missing or fails, scanned PDFs are not read (one warning) and nothing else breaks.
 */
export async function renderPdfPages(bytes: Uint8Array, maxPages: number): Promise<Uint8Array[]> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const pages: Uint8Array[] = [];
    let pixelsLeft = MAX_TOTAL_PIXELS;
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
      // The page size is attacker controlled: size the canvas from the viewport before allocating.
      const { width, height } = (await pdf.getPage(n)).getViewport({ scale: 1 });
      const scale = Math.min(SCALE, MAX_EDGE_PX / Math.max(width, height));
      const pixels = Math.ceil(width * scale) * Math.ceil(height * scale);
      pixelsLeft -= pixels;
      if (pixelsLeft < 0 || pixels < 1) break;
      const png = await renderPageAsImage(pdf, n, {
        canvasImport: () => import("@napi-rs/canvas"),
        scale,
      });
      pages.push(new Uint8Array(png));
    }
    return pages;
  } catch (error) {
    if (!warned) {
      warned = true;
      getLogger().warn("scanned PDF rendering is unavailable", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return [];
  }
}
