import { Unzip, UnzipInflate, UnzipPassThrough } from "fflate";

// An Office file is an untrusted zip: bound what it may expand to and how much work it costs.
export const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 2_000;
/** Input is fed in slices so inflation can stop between them; one slice expands to ~16 MB at most. */
const SLICE_BYTES = 16 * 1024;
/** Same limit as the stored text; extraction stops once it is reached. */
const MAX_CHARS = 1_000_000;

export const OFFICE_TYPES = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
} as const;
export type OfficeKind = (typeof OFFICE_TYPES)[keyof typeof OFFICE_TYPES];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
export const decode = (s: string) =>
  s.includes("&")
    ? s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
        if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
        const code =
          e[1]?.toLowerCase() === "x" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
      })
    : s;

const numeric = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Characters still allowed in the output; `take` clips to what is left. */
class Budget {
  left = MAX_CHARS;
  get done() {
    return this.left <= 0;
  }
  take(s: string) {
    const out = s.length > this.left ? s.slice(0, this.left) : s;
    this.left -= out.length;
    return out;
  }
}

/**
 * Walks the tags of an XML fragment in one forward pass (each `indexOf` only moves ahead, so cost
 * is linear even for unclosed or hostile markup). `onTag` and `onText` return false to stop.
 */
export function walk(
  xml: string,
  onTag: (name: string, closing: boolean, selfClosing: boolean, attrs: string) => boolean | void,
  onText: (text: string) => boolean | void,
): void {
  let pos = 0;
  while (pos < xml.length) {
    const lt = xml.indexOf("<", pos);
    if (lt < 0) {
      onText(xml.slice(pos));
      return;
    }
    if (lt > pos && onText(xml.slice(pos, lt)) === false) return;
    const gt = xml.indexOf(">", lt);
    if (gt < 0) return;
    pos = gt + 1;
    const inner = xml.slice(lt + 1, gt);
    if (inner[0] === "?" || inner[0] === "!") continue;
    const closing = inner[0] === "/";
    const selfClosing = inner.endsWith("/");
    const body = inner.slice(closing ? 1 : 0, selfClosing ? -1 : undefined);
    const space = body.search(/\s/);
    const name = space < 0 ? body : body.slice(0, space);
    if (onTag(name, closing, selfClosing, space < 0 ? "" : body.slice(space)) === false) return;
  }
}

/** Paragraphs of `w:p` / `a:p` text runs; one line per non-empty paragraph. */
function paragraphs(xml: string, para: string, tag: string, budget: Budget): string {
  const lines: string[] = [];
  let line = "";
  let inText = false;
  const flush = () => {
    if (line.trim()) lines.push(budget.take(`${line}\n`).trimEnd());
    line = "";
    return !budget.done;
  };
  walk(
    xml,
    (name, closing, selfClosing) => {
      if (name === tag) inText = !closing && !selfClosing;
      else if (closing && name === para) return flush();
      else if (!closing && (name === "w:tab" || name === "a:tab")) line += "\t";
      else if (!closing && (name === "w:br" || name === "a:br")) line += "\n";
    },
    (text) => {
      if (inText) line += decode(text);
    },
  );
  flush();
  return lines.join("\n");
}

/** Text of each `<si>` entry in sharedStrings.xml, up to the character budget. */
function sharedStrings(xml: string, budget: Budget): string[] {
  const strings: string[] = [];
  let current = "";
  let inT = false;
  walk(
    xml,
    (name, closing, selfClosing) => {
      if (name === "si" && !closing) current = "";
      else if (name === "si" && closing) {
        strings.push(budget.take(current));
        return !budget.done;
      } else if (name === "t") inT = !closing && !selfClosing;
    },
    (text) => {
      if (inT) current += decode(text);
    },
  );
  return strings;
}

function sheetText(xml: string, shared: string[], budget: Budget): string {
  const rows: string[] = [];
  let cells: string[] = [];
  let type = "";
  let cell = "";
  let inV = false;
  let inT = false;
  let rowChars = 0;
  // A shared string can be referenced by millions of cells: stop the sheet as soon as the row
  // alone passes the budget, before anything is joined.
  const endCell = () => {
    const value = type === "s" ? (shared[Number(cell)] ?? "") : cell;
    cells.push(value);
    rowChars += value.length + 1;
    type = cell = "";
    return rowChars <= budget.left;
  };
  walk(
    xml,
    (name, closing, selfClosing, attrs) => {
      if (name === "c" && !closing) {
        type = /\bt="([^"]*)"/.exec(attrs)?.[1] ?? "";
        cell = "";
        if (selfClosing) return endCell();
      } else if (name === "c") return endCell();
      else if (name === "v") inV = !closing && !selfClosing;
      else if (name === "t") inT = !closing && !selfClosing;
      else if (name === "row" && !closing) {
        cells = [];
        rowChars = 0;
      } else if (name === "row" && closing) {
        if (cells.some((c) => c))
          rows.push(budget.take(`${cells.join("\t").trimEnd()}\n`).trimEnd());
        return !budget.done;
      }
    },
    (text) => {
      if (inV || inT) cell += type === "s" ? text : decode(text);
    },
  );
  return rows.join("\n");
}

/**
 * Reads the wanted entries of a zip, inflating in slices and stopping an entry the moment it
 * passes the shared byte budget. Sizes declared in the zip are never trusted.
 */
export function readEntries(
  bytes: Uint8Array,
  wanted: RegExp,
): { files: Record<string, Uint8Array>; overBudget: boolean } {
  const files: Record<string, Uint8Array> = {};
  let entries = 0;
  let total = 0;
  let overBudget = false;
  const unzip = new Unzip((file) => {
    if (++entries > MAX_ENTRIES) overBudget = true;
    if (overBudget || !wanted.test(file.name)) return;
    const chunks: Uint8Array[] = [];
    file.ondata = (err, chunk, final) => {
      if (err || overBudget) return;
      total += chunk.length;
      if (total > MAX_UNZIPPED_BYTES) {
        overBudget = true;
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) {
        const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
        let at = 0;
        for (const c of chunks) {
          out.set(c, at);
          at += c.length;
        }
        files[file.name] = out;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.register(UnzipPassThrough);
  for (let at = 0; at < bytes.length && !overBudget; at += SLICE_BYTES) {
    unzip.push(bytes.subarray(at, at + SLICE_BYTES), at + SLICE_BYTES >= bytes.length);
  }
  return { files, overBudget };
}

/** Text of a .docx, .xlsx or .pptx, read locally from its XML. Unreadable or oversized input gives "". */
export function extractOfficeText(bytes: Uint8Array, kind: OfficeKind): string {
  if (bytes.byteLength > MAX_INPUT_BYTES) return "";
  const want: Record<OfficeKind, RegExp> = {
    docx: /^word\/document\.xml$/,
    xlsx: /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/,
    pptx: /^ppt\/slides\/slide\d+\.xml$/,
  };
  let files: Record<string, Uint8Array>;
  try {
    files = readEntries(bytes, want[kind]).files;
  } catch {
    return "";
  }
  const xml = (name: string) => new TextDecoder().decode(files[name]);
  const names = Object.keys(files).sort(numeric);
  const budget = new Budget();
  const parts: string[] = [];
  if (kind === "docx") {
    return files["word/document.xml"]
      ? paragraphs(xml("word/document.xml"), "w:p", "w:t", budget)
      : "";
  }
  if (kind === "pptx") {
    for (const n of names) {
      if (budget.done) break;
      const slide = paragraphs(xml(n), "a:p", "a:t", budget);
      if (slide) parts.push(slide);
    }
    return parts.join("\n\n");
  }
  // Shared strings are counted against their own budget so they cannot starve the sheets.
  const shared = files["xl/sharedStrings.xml"]
    ? sharedStrings(xml("xl/sharedStrings.xml"), new Budget())
    : [];
  for (const n of names) {
    if (budget.done) break;
    if (!n.includes("worksheets/")) continue;
    const sheet = sheetText(xml(n), shared, budget);
    if (sheet) parts.push(sheet);
  }
  return parts.join("\n\n");
}
