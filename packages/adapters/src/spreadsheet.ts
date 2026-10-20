import { zipSync } from "fflate";
import { decode, MAX_INPUT_BYTES, readEntries, walk } from "./office-text.js";

export type SpreadsheetKind = "xlsx" | "csv" | "tsv";
export type CellValue = string | number | boolean | null;

const DEFAULT_ROWS = 200;
const MAX_ROWS = 1_000;
const MAX_COLS = 100;
const MAX_CELL_CHARS = 1_000;
/** Characters of cell text in one result, so a wide sheet cannot flood the model's context. */
const MAX_RESULT_CHARS = 100_000;
const XLSX_PARTS =
  /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|styles\.xml|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/;

/** The reader's kind for a file, or null. Legacy .xls is detected only to give a clear refusal. */
export function spreadsheetKind(name: string, mimeType: string): SpreadsheetKind | "xls" | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const type = mimeType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (ext === "xlsx" || ext === "xlsm" || type.includes("spreadsheetml.sheet")) return "xlsx";
  if (type === "application/vnd.ms-excel.sheet.macroenabled.12") return "xlsx";
  if (ext === "xls" || type === "application/vnd.ms-excel") return "xls";
  if (ext === "tsv" || type === "text/tab-separated-values") return "tsv";
  if (ext === "csv" || type === "text/csv") return "csv";
  return null;
}

// --- Addresses -----------------------------------------------------------------------------------

const colIndex = (letters: string) =>
  [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function colLetters(index: number): string {
  let out = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    out = String.fromCharCode(65 + ((n - 1) % 26)) + out;
  }
  return out;
}

type Bounds = { c1: number; r1: number; c2: number; r2: number };

function parseRange(range: string | undefined): Bounds | null | "invalid" {
  if (!range?.trim()) return null;
  const m = /^\s*\$?([A-Z]{1,3})\$?(\d{1,7})(?::\$?([A-Z]{1,3})\$?(\d{1,7}))?\s*$/i.exec(range);
  if (!m) return "invalid";
  const a = { c: colIndex(m[1] as string), r: Number(m[2]) };
  const b = m[3] ? { c: colIndex(m[3]), r: Number(m[4]) } : a;
  return {
    c1: Math.min(a.c, b.c),
    r1: Math.max(1, Math.min(a.r, b.r)),
    c2: Math.max(a.c, b.c),
    r2: Math.max(a.r, b.r),
  };
}

const attr = (attrs: string, name: string) =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? "";

function cellRef(ref: string): { c: number; r: number } | null {
  const m = /^([A-Z]{1,3})(\d+)$/i.exec(ref);
  return m ? { c: colIndex(m[1] as string), r: Number(m[2]) } : null;
}

// --- Dates ---------------------------------------------------------------------------------------

const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47, 50, 51,
  52, 53, 54, 55, 56, 57, 58,
]);

function isDateFormat(id: number, code: string | undefined): boolean {
  if (code === undefined) return BUILTIN_DATE_FORMATS.has(id);
  const bare = code
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[(?!(?:h+|m+|s+)\])[^\]]*\]/gi, "");
  return /[ymdhs]/i.test(bare);
}

function excelDate(serial: number, date1904: boolean): string | null {
  const shifted = serial + (date1904 ? 1462 : 0);
  if (!(shifted >= 0 && shifted < 2_958_466)) return null;
  const day = Math.floor(shifted);
  const ms = Math.round((shifted - day) * 86_400_000);
  const iso = new Date(Date.UTC(1899, 11, 30) + day * 86_400_000 + ms).toISOString();
  if (day === 0) return iso.slice(11, 19);
  return ms === 0 ? iso.slice(0, 10) : iso.slice(0, 19);
}

// --- XLSX ----------------------------------------------------------------------------------------

type Sheet = { name: string; part: string };
type Workbook = {
  files: Record<string, Uint8Array>;
  sheets: Sheet[];
  shared: string[];
  dateStyles: Set<number>;
  date1904: boolean;
};

function sharedStrings(xml: string): string[] {
  const out: string[] = [];
  let current = "";
  let inT = false;
  let skip = false;
  let chars = 0;
  walk(
    xml,
    (name, closing, selfClosing) => {
      if (name === "si" && !closing) current = "";
      else if (name === "si") {
        out.push(current);
        chars += current.length;
        return chars < 20_000_000;
      } else if (name === "rPh") skip = !closing && !selfClosing;
      else if (name === "t") inT = !closing && !selfClosing;
    },
    (text) => {
      if (inT && !skip) current += decode(text);
    },
  );
  return out;
}

function dateStyles(xml: string): Set<number> {
  const custom = new Map<number, string>();
  const styles = new Set<number>();
  let inXfs = false;
  let index = 0;
  walk(
    xml,
    (name, closing, selfClosing, attrs) => {
      if (name === "numFmt" && !closing) {
        custom.set(Number(attr(attrs, "numFmtId")), decode(attr(attrs, "formatCode")));
      } else if (name === "cellXfs") inXfs = !closing && !selfClosing;
      else if (name === "xf" && inXfs && !closing) {
        const id = Number(attr(attrs, "numFmtId"));
        if (isDateFormat(id, custom.get(id))) styles.add(index);
        index += 1;
      }
    },
    () => {},
  );
  return styles;
}

function openWorkbook(bytes: Uint8Array): { book?: Workbook; error?: string; overBudget: boolean } {
  let read: ReturnType<typeof readEntries>;
  try {
    read = readEntries(bytes, XLSX_PARTS);
  } catch {
    return { error: "This is not a readable .xlsx file.", overBudget: false };
  }
  const { files, overBudget } = read;
  const text = (name: string) => (files[name] ? new TextDecoder().decode(files[name]) : "");
  const workbook = text("xl/workbook.xml");
  if (!workbook) {
    return {
      error: overBudget
        ? "The workbook is too large to read."
        : "This is not a readable .xlsx file.",
      overBudget,
    };
  }
  const targets = new Map<string, string>();
  walk(
    text("xl/_rels/workbook.xml.rels"),
    (name, closing, _s, attrs) => {
      if (name !== "Relationship" || closing || !attr(attrs, "Type").endsWith("/worksheet")) return;
      const target = attr(attrs, "Target").replace(/^\//, "");
      targets.set(attr(attrs, "Id"), target.startsWith("xl/") ? target : `xl/${target}`);
    },
    () => {},
  );
  const sheets: Sheet[] = [];
  let date1904 = false;
  walk(
    workbook,
    (name, closing, _s, attrs) => {
      if (closing) return;
      if (name === "workbookPr") date1904 = /^(1|true)$/i.test(attr(attrs, "date1904"));
      if (name !== "sheet") return;
      const part =
        targets.get(attr(attrs, "r:id")) ?? `xl/worksheets/sheet${sheets.length + 1}.xml`;
      sheets.push({ name: decode(attr(attrs, "name")), part });
    },
    () => {},
  );
  return {
    overBudget,
    book: {
      files,
      sheets: sheets.filter((s) => files[s.part]),
      shared: sharedStrings(text("xl/sharedStrings.xml")),
      dateStyles: dateStyles(text("xl/styles.xml")),
      date1904,
    },
  };
}

/** The sheet's own `<dimension>`; it sits at the top of the file, so only the head is read. */
function sheetDimension(bytes: Uint8Array): string | null {
  const head = new TextDecoder().decode(bytes.subarray(0, 4096));
  return /<dimension\s+ref="([^"]+)"/.exec(head)?.[1] ?? null;
}

type Scan = {
  rows: { row: number; cells: CellValue[] }[];
  truncated: boolean;
};

/** Rows inside `bounds` with at least one value, stopping at `maxRows` or the character budget. */
function scanXlsxSheet(
  book: Workbook,
  sheet: Sheet,
  bounds: Bounds,
  maxRows: number,
  explicitRange: boolean,
  skip: number,
): Scan {
  const xml = new TextDecoder().decode(book.files[sheet.part]);
  const result: Scan = { rows: [], truncated: false };
  let chars = 0;
  let skipped = 0;
  let rowNo = 0;
  let nextCol = 0;
  let cells: CellValue[] = [];
  let hasValue = false;
  let col = 0;
  let type = "";
  let style = -1;
  let v = "";
  let inV = false;
  let inT = false;
  let inRow = false;

  const finishCell = () => {
    if (col > bounds.c2 && v !== "" && !explicitRange) result.truncated = true;
    if (col < bounds.c1 || col > bounds.c2 || rowNo < bounds.r1) return;
    let value: CellValue = null;
    if (type === "s") value = book.shared[Number(v)] ?? null;
    else if (type === "inlineStr" || type === "str" || type === "e") value = v === "" ? null : v;
    else if (type === "b") value = v === "" ? null : v === "1" || v.toLowerCase() === "true";
    else if (v !== "") {
      const n = Number(v);
      value = Number.isFinite(n)
        ? ((book.dateStyles.has(style) ? excelDate(n, book.date1904) : null) ??
          Number(n.toPrecision(15)))
        : v;
    }
    if (typeof value === "string") value = value.slice(0, MAX_CELL_CHARS);
    if (value === null || value === "") return;
    const at = col - bounds.c1;
    while (cells.length < at) cells.push(null);
    cells[at] = value;
    hasValue = true;
    chars += String(value).length + 1;
  };

  walk(
    xml,
    (name, closing, selfClosing, attrs) => {
      if (name === "row" && !closing) {
        rowNo = Number(attr(attrs, "r")) || rowNo + 1;
        if (rowNo > bounds.r2) return false;
        inRow = true;
        nextCol = 0;
        cells = [];
        hasValue = false;
      } else if (name === "row" && inRow) {
        inRow = false;
        if (!hasValue || rowNo < bounds.r1) return;
        if (result.rows.length > 0 && skipped < skip) {
          skipped += 1;
          return;
        }
        if (result.rows.length >= maxRows || chars > MAX_RESULT_CHARS) {
          result.truncated = true;
          return false;
        }
        result.rows.push({ row: rowNo, cells });
      } else if (name === "c" && !closing) {
        col = cellRef(attr(attrs, "r"))?.c ?? nextCol;
        nextCol = col + 1;
        type = attr(attrs, "t");
        style = Number(attr(attrs, "s") || -1);
        v = "";
        if (selfClosing) finishCell();
      } else if (name === "c") finishCell();
      else if (name === "v") inV = !closing && !selfClosing;
      else if (name === "t") inT = !closing && !selfClosing;
    },
    (text) => {
      if (!inRow) return;
      if (inV) v += type === "s" ? text : decode(text);
      else if (inT && type === "inlineStr") v += decode(text);
    },
  );
  return result;
}

// --- CSV / TSV -----------------------------------------------------------------------------------

/** Calls `onRow` for each record (quoted fields, doubled quotes, CRLF); `onRow` returns false to stop. */
function csvRows(text: string, delimiter: string, onRow: (cells: string[]) => boolean | void) {
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let started = false;
  const endRow = () => {
    cells.push(field);
    const keep = onRow(cells);
    cells = [];
    field = "";
    started = false;
    return keep !== false;
  };
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
    } else if (ch === '"' && field === "") {
      quoted = true;
      started = true;
    } else if (ch === delimiter) {
      cells.push(field);
      field = "";
      started = true;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      if (!endRow()) return;
    } else {
      field += ch;
      started = true;
    }
  }
  if (started || field !== "") endRow();
}

// --- Public read ---------------------------------------------------------------------------------

export type SpreadsheetRead = {
  sheets: { name: string; dimension: string | null }[];
  sheet: string;
  range: string;
  /** Column letters for the cells of every row. */
  columns: string[];
  headerRow: number | null;
  header: CellValue[];
  /** Each row is [sheet row number, ...cells]. */
  rows: CellValue[][];
  truncated: boolean;
  note?: string;
};

export type SpreadsheetReadOptions = {
  sheet?: string;
  range?: string;
  maxRows?: number;
  /** Data rows to pass over after the first row, which is always returned as the header. */
  skipRows?: number;
};

export function readSpreadsheet(
  bytes: Uint8Array,
  kind: SpreadsheetKind,
  fileName: string,
  options: SpreadsheetReadOptions = {},
): SpreadsheetRead | { error: string } {
  if (bytes.byteLength > MAX_INPUT_BYTES) return { error: "The file is too large to read." };
  const parsed = parseRange(options.range);
  if (parsed === "invalid") return { error: 'range must look like "A1:F200".' };
  const maxRows = Math.min(
    MAX_ROWS,
    Math.max(1, Math.floor(Number(options.maxRows)) || DEFAULT_ROWS),
  );
  const skip = Math.max(0, Math.floor(Number(options.skipRows)) || 0);
  const bounds: Bounds = parsed ?? { c1: 0, r1: 1, c2: MAX_COLS - 1, r2: Number.MAX_SAFE_INTEGER };
  let capped = false;
  if (bounds.c2 - bounds.c1 >= MAX_COLS) {
    bounds.c2 = bounds.c1 + MAX_COLS - 1;
    capped = true;
  }

  let sheets: { name: string; dimension: string | null }[];
  let chosen: string;
  let scan: Scan;
  let note: string | undefined;

  if (kind === "xlsx") {
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf) {
      return { error: "Legacy .xls files are not supported. Save the file as .xlsx or .csv." };
    }
    const { book, error, overBudget } = openWorkbook(bytes);
    if (!book) return { error: error ?? "This is not a readable .xlsx file." };
    if (!book.sheets.length) {
      return {
        error: overBudget
          ? "The workbook is too large to read."
          : "The workbook has no readable sheets.",
      };
    }
    sheets = book.sheets.map((s) => ({
      name: s.name,
      dimension: sheetDimension(book.files[s.part] as Uint8Array),
    }));
    const wanted = options.sheet?.trim();
    const sheet = wanted
      ? (book.sheets.find((s) => s.name === wanted) ??
        book.sheets.find((s) => s.name.toLowerCase() === wanted.toLowerCase()))
      : book.sheets[0];
    if (!sheet) {
      return {
        error: `No sheet named "${wanted}". Sheets: ${sheets.map((s) => s.name).join(", ")}`,
      };
    }
    chosen = sheet.name;
    scan = scanXlsxSheet(book, sheet, bounds, maxRows, parsed !== null, skip);
    if (overBudget) {
      scan.truncated = true;
      note = "The workbook is larger than the size limit, so some sheets were not read.";
    }
  } else {
    const delimiter = kind === "tsv" ? "\t" : ",";
    const text = new TextDecoder().decode(bytes);
    let rowNo = 0;
    let widest = 0;
    let chars = 0;
    let skipped = 0;
    scan = { rows: [], truncated: false };
    csvRows(text, delimiter, (fields) => {
      rowNo += 1;
      widest = Math.max(widest, fields.length);
      if (rowNo < bounds.r1 || rowNo > bounds.r2 || scan.truncated) return;
      const cells = fields
        .slice(bounds.c1, bounds.c2 + 1)
        .map((f) => (f === "" ? null : f.slice(0, MAX_CELL_CHARS)));
      if (!cells.some((c) => c !== null)) return;
      if (scan.rows.length > 0 && skipped < skip) {
        skipped += 1;
        return;
      }
      if (scan.rows.length >= maxRows || chars > MAX_RESULT_CHARS) {
        scan.truncated = true;
        return;
      }
      chars += cells.reduce((n: number, c) => n + (c?.length ?? 0) + 1, 0);
      scan.rows.push({ row: rowNo, cells });
    });
    chosen = fileName.replace(/\.[^.]*$/, "") || "Sheet1";
    sheets = [
      {
        name: chosen,
        dimension: rowNo ? `A1:${colLetters(Math.max(0, widest - 1))}${rowNo}` : null,
      },
    ];
  }

  const width = Math.min(
    MAX_COLS,
    scan.rows.reduce((n, r) => Math.max(n, r.cells.length), 0),
  );
  const pad = (cells: CellValue[]) => Array.from({ length: width }, (_, i) => cells[i] ?? null);
  const [head, ...rest] = scan.rows;
  return {
    sheets,
    sheet: chosen,
    range: options.range?.trim() || "all",
    columns: Array.from({ length: width }, (_, i) => colLetters(bounds.c1 + i)),
    headerRow: head?.row ?? null,
    header: head ? pad(head.cells) : [],
    rows: rest.map((r) => [r.row, ...pad(r.cells)]),
    truncated: scan.truncated || capped,
    ...(note ? { note } : {}),
  };
}

// --- Write ---------------------------------------------------------------------------------------

export const MAX_WRITE_SHEETS = 20;
export const MAX_WRITE_ROWS = 5_000;
export const MAX_WRITE_CELLS = 200_000;

const escapeXml = (s: string) =>
  s
    // biome-ignore lint/suspicious/noControlCharactersInRegex: XML 1.0 forbids these characters.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Excel sheet names: at most 31 characters, none of []:*?/\ , unique ignoring case. */
function sheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw, i) => {
    const base =
      raw
        .replace(/[[\]:*?/\\]/g, " ")
        .trim()
        .slice(0, 31) || `Sheet${i + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) {
      name = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

/**
 * A minimal .xlsx: values only, no styles. Text goes in as inline strings, so a cell that starts
 * with "=" stays text and is never evaluated as a formula.
 */
export function buildXlsx(input: { name: string; rows: CellValue[][] }[]): Uint8Array {
  const names = sheetNames(input.map((s) => s.name));
  const enc = (s: string) => new TextEncoder().encode(s);
  const sheetXml = (rows: CellValue[][]) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
      .map((row, r) => {
        const cells = row
          .map((value, c) => {
            const ref = `${colLetters(c)}${r + 1}`;
            if (value === null || value === undefined || value === "") return "";
            if (typeof value === "number") {
              return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : "";
            }
            if (typeof value === "boolean")
              return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("")}</sheetData></worksheet>`;
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": enc(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${names
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("")}</Types>`,
    ),
    "_rels/.rels": enc(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": enc(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${escapeXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": enc(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ),
  };
  input.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = enc(sheetXml(sheet.rows));
  });
  return zipSync(files);
}
