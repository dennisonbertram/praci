import { PAGE_SOURCES_MAX_PER_PAGE, PageSourceNameSchema } from "@rakazo/contracts";

/**
 * An HTML page says which of its page's sources it reads with two meta tags in the head:
 *   <meta name="praci-sources" content="Overview, Revenue">
 *   <meta name="praci-history" content="Revenue">
 * This is a small strict reader, not an HTML parser: the document is never executed or fully parsed.
 * It walks the document from the start over a leading run of head elements only: whitespace, a doctype,
 * comments, <html>, <head>, and <meta>, <link>, <base>, <title> and <style> tags. The first other tag,
 * any text, </head> or <body ends the walk, so a "<meta" inside an attribute value, <xmp>, <textarea>,
 * <script>, SVG CDATA or the body is never read. Only the first HTML_META_SCAN_CHARS are read. If a name
 * appears in more than one tag, the first tag wins. Names are matched to sources case-insensitively.
 */
export const HTML_META_SCAN_CHARS = 20_000;
const CONTENT_MAX_CHARS = 2_000;

const SKIPPED = /(?:\uFEFF|\s+|<!doctype[^>]*>|<!--[\s\S]*?-->)/iy;
// A tag whose quoted attribute values may contain ">".
const TAG = /<(\/?)([a-z][a-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/iy;
const HEAD_TAGS = new Set(["html", "head", "meta", "link", "base", "title", "style"]);
const RAW_TEXT = new Set(["title", "style"]);
const ATTRIBUTE = /([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

function attributes(text: string): Map<string, string> {
  const attrs = new Map<string, string>();
  for (const match of text.matchAll(ATTRIBUTE)) {
    const key = (match[1] ?? "").toLowerCase();
    if (!attrs.has(key)) attrs.set(key, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

/** The attributes of each <meta> in the leading run of head elements. */
function headMetas(html: string): Map<string, string>[] {
  const text = html.slice(0, HTML_META_SCAN_CHARS);
  const metas: Map<string, string>[] = [];
  let at = 0;
  for (;;) {
    SKIPPED.lastIndex = at;
    const skipped = SKIPPED.exec(text);
    if (skipped) {
      at += skipped[0].length;
      continue;
    }
    TAG.lastIndex = at;
    const tag = TAG.exec(text);
    if (!tag) return metas;
    const name = (tag[2] ?? "").toLowerCase();
    if (tag[1] || !HEAD_TAGS.has(name)) return metas; // </head>, <body, <script, <xmp, ...
    at += tag[0].length;
    if (name === "meta") metas.push(attributes(tag[3] ?? ""));
    else if (RAW_TEXT.has(name)) {
      const close = text.toLowerCase().indexOf(`</${name}`, at);
      if (close < 0) return metas;
      at = close;
      TAG.lastIndex = at;
      const end = TAG.exec(text);
      if (!end) return metas;
      at += end[0].length;
    }
  }
}

function declared(html: string, wanted: string): string | null {
  for (const attrs of headMetas(html))
    if (attrs.get("name")?.trim().toLowerCase() === wanted) return attrs.get("content") ?? "";
  return null;
}

export interface HtmlPageDeclaration {
  /** Source names the page reads, as written, without duplicates. */
  sources: string[];
  /** The subset of `sources` the page also wants history for. */
  history: string[];
  /** Why the declaration is not valid; the page is refused when set. Names that were valid are still returned. */
  error?: string;
}

function names(content: string | null, label: string, errors: string[]): string[] {
  if (content === null || content.trim() === "") return [];
  if (content.length > CONTENT_MAX_CHARS) {
    errors.push(`${label} is longer than ${CONTENT_MAX_CHARS} characters.`);
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of content.split(",")) {
    const parsed = PageSourceNameSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`${label} has an invalid source name "${raw.trim().slice(0, 40)}".`);
      continue;
    }
    const key = parsed.data.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed.data);
  }
  return out;
}

export function htmlPageDeclaration(html: string): HtmlPageDeclaration {
  const errors: string[] = [];
  const sources = names(declared(html, "praci-sources"), "praci-sources", errors);
  const history = names(declared(html, "praci-history"), "praci-history", errors);
  if (sources.length > PAGE_SOURCES_MAX_PER_PAGE)
    errors.push(`praci-sources names more than ${PAGE_SOURCES_MAX_PER_PAGE} sources.`);
  const known = new Set(sources.map((name) => name.toLowerCase()));
  for (const name of history)
    if (!known.has(name.toLowerCase()))
      errors.push(`praci-history names "${name}", which praci-sources does not list.`);
  return {
    sources: sources.slice(0, PAGE_SOURCES_MAX_PER_PAGE),
    history: history.filter((name) => known.has(name.toLowerCase())),
    ...(errors.length ? { error: errors[0] } : {}),
  };
}

/**
 * The sources to send an HTML page: only data for this exact page and revision. Data fetched for
 * another page or an older or newer revision is never shown, so a page switch or an edit cannot
 * pass the previous document's data to the new one.
 */
export function htmlPageSourcesFor(
  page: { id: string; revision: number } | null | undefined,
  data: { pageId: string; revision: number; sources?: Record<string, unknown> } | null | undefined,
): Record<string, unknown> | undefined {
  if (!page || !data?.sources) return undefined;
  return data.pageId === page.id && data.revision === page.revision ? data.sources : undefined;
}
