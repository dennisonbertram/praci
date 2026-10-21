import { getDocumentProxy } from "unpdf";

type Item = { str: string; x: number; y: number; w: number };

// A PDF is untrusted: its page count, coordinates and text volume are all attacker controlled.
const MAX_PAGES = 200;
const MAX_TEXT_CHARS = 2_000_000;
const MAX_COLUMN = 200;

/**
 * Text of every page, one line per row of the page, with items placed at their horizontal
 * position so a table keeps its columns. Pages are separated by a blank line.
 */
export async function extractPdfText(
  bytes: Uint8Array,
  /** With `maxChars`, a long PDF is read in page order until that many characters (or MAX_PAGES pages) and the rest is dropped, instead of rejected. */
  opts: { maxChars?: number } = {},
): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const partial = opts.maxChars !== undefined;
  if (!partial && pdf.numPages > MAX_PAGES) {
    throw new Error(
      `This PDF has too many pages (limit ${MAX_PAGES}). Upload a smaller statement.`,
    );
  }
  const pages: string[] = [];
  let total = 0;
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4]!, y: it.transform[5]!, w: it.width });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Item[][] = [];
    for (const it of items) {
      const row = rows.at(-1);
      if (row && Math.abs(row[0]!.y - it.y) < 3) row.push(it);
      else rows.push([it]);
    }
    const text = rows.map(layoutRow).join("\n");
    total += text.length;
    if (partial) {
      pages.push(text);
      if (total >= opts.maxChars!) break;
      continue;
    }
    if (total > MAX_TEXT_CHARS) {
      throw new Error("This PDF holds too much text to read. Upload a smaller statement.");
    }
    pages.push(text);
  }
  return pages.join("\n\n");
}

const CHAR_WIDTH = 4.5;

function layoutRow(row: Item[]): string {
  let line = "";
  for (const it of row.sort((a, b) => a.x - b.x)) {
    const col = Math.min(MAX_COLUMN, Math.max(0, Math.round(it.x / CHAR_WIDTH) || 0));
    // At least one space between items; more where the page has a gap.
    line += " ".repeat(Math.max(line.length ? 1 : 0, col - line.length)) + it.str.trim();
  }
  return line;
}

/** Page count of a PDF, for deciding whether its text layer is empty. */
export async function pdfPageCount(bytes: Uint8Array): Promise<number> {
  return (await getDocumentProxy(new Uint8Array(bytes))).numPages;
}
