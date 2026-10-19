import { unzipSync } from "fflate";

// An Office file is an untrusted zip: bound what it may expand to.
const MAX_INPUT_BYTES = 50 * 1024 * 1024;
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 2_000;

export const OFFICE_TYPES = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
} as const;
export type OfficeKind = (typeof OFFICE_TYPES)[keyof typeof OFFICE_TYPES];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1]?.toLowerCase() === "x" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  });

const numeric = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Text runs (`<tag>` elements) of one XML fragment, with tabs and line breaks kept. */
function runs(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>|<(?:w:tab|w:br|a:br)\\s*/>`, "g");
  let out = "";
  for (const m of xml.matchAll(re)) {
    out += m[1] !== undefined ? decode(m[1]) : m[0].includes("tab") ? "\t" : "\n";
  }
  return out;
}

const paragraphs = (xml: string, para: string, tag: string) =>
  xml
    .split(`</${para}>`)
    .map((p) => runs(p, tag))
    .filter((p) => p.trim())
    .join("\n");

function sheetText(xml: string, shared: string[]): string {
  const rows: string[] = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const c of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = /\bt="([^"]*)"/.exec(c[1] ?? "")?.[1];
      const body = c[2] ?? "";
      const v = /<v>([^<]*)<\/v>/.exec(body)?.[1];
      cells.push(
        type === "inlineStr"
          ? runs(body, "t")
          : type === "s"
            ? (shared[Number(v)] ?? "")
            : v !== undefined
              ? decode(v)
              : "",
      );
    }
    if (cells.some((c) => c)) rows.push(cells.join("\t").trimEnd());
  }
  return rows.join("\n");
}

/** Text of a .docx, .xlsx or .pptx, read locally from its XML. Unreadable or oversized input gives "". */
export function extractOfficeText(bytes: Uint8Array, kind: OfficeKind): string {
  if (bytes.byteLength > MAX_INPUT_BYTES) return "";
  const want: Record<OfficeKind, RegExp> = {
    docx: /^word\/document\.xml$/,
    xlsx: /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/,
    pptx: /^ppt\/slides\/slide\d+\.xml$/,
  };
  let entries = 0;
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (file) => {
        // Entries past the caps are skipped, so a zip bomb yields what fits, not an expansion.
        if (++entries > MAX_ENTRIES || !want[kind].test(file.name)) return false;
        if (total + file.originalSize > MAX_UNZIPPED_BYTES) return false;
        total += file.originalSize;
        return true;
      },
    });
  } catch {
    return "";
  }
  const xml = (name: string) => new TextDecoder().decode(files[name]);
  const names = Object.keys(files).sort(numeric);
  if (kind === "docx")
    return files["word/document.xml"] ? paragraphs(xml("word/document.xml"), "w:p", "w:t") : "";
  if (kind === "pptx")
    return names
      .map((n) => paragraphs(xml(n), "a:p", "a:t"))
      .filter(Boolean)
      .join("\n\n");
  const shared = files["xl/sharedStrings.xml"]
    ? [...xml("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) =>
        runs(m[1] ?? "", "t"),
      )
    : [];
  return names
    .filter((n) => n.includes("worksheets/"))
    .map((n) => sheetText(xml(n), shared))
    .filter(Boolean)
    .join("\n\n");
}
