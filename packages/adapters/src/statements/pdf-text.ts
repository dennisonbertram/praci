import { getDocumentProxy } from "unpdf";

type Item = { str: string; x: number; y: number; w: number };

/**
 * Text of every page, one line per row of the page, with items placed at their horizontal
 * position so a table keeps its columns. Pages are separated by a blank line.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const pages: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
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
    pages.push(rows.map(layoutRow).join("\n"));
  }
  return pages.join("\n\n");
}

const CHAR_WIDTH = 4.5;

function layoutRow(row: Item[]): string {
  let line = "";
  for (const it of row.sort((a, b) => a.x - b.x)) {
    const col = Math.round(it.x / CHAR_WIDTH);
    // At least one space between items; more where the page has a gap.
    line += " ".repeat(Math.max(line.length ? 1 : 0, col - line.length)) + it.str.trim();
  }
  return line;
}
