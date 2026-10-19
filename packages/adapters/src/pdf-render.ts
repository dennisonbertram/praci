import { getLogger } from "@rakazo/logging";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

let warned = false;

/**
 * Renders PDF pages to PNG for scanned-PDF reading. The native canvas binary loads on first use;
 * if it is missing or fails, scanned PDFs are not read (one warning) and nothing else breaks.
 */
export async function renderPdfPages(bytes: Uint8Array, maxPages: number): Promise<Uint8Array[]> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const pages: Uint8Array[] = [];
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
      const png = await renderPageAsImage(pdf, n, {
        canvasImport: () => import("@napi-rs/canvas"),
        scale: 1.5,
      });
      pages.push(new Uint8Array(png));
    }
    return pages;
  } catch (error) {
    if (!warned) {
      warned = true;
      getLogger().warn("scanned PDF rendering is unavailable", error);
    }
    return [];
  }
}
