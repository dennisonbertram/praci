/** Pure helpers for page watches: normalize fetched HTML, truncate it, and diff two snapshots. */

export const WATCH_SNAPSHOT_MAX_CHARS = 16_384;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name: string) => {
    if (name[0] === "#") {
      const code =
        name[1]?.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

/** Readable text of a page: no scripts or styles, tags removed, entities decoded, one space between words, no empty lines. Deterministic. */
export function normalizePageText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(
      /<\/?(?:p|div|br|li|ul|ol|tr|table|section|article|header|footer|nav|main|h[1-6]|blockquote|pre|hr)\b[^>]*>/gi,
      "\n",
    )
    .replace(/<[^>]*>/g, " ");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Cut text to at most maxChars characters, on a line boundary when one is available in the last quarter. */
export function truncateSnapshot(text: string, maxChars = WATCH_SNAPSHOT_MAX_CHARS): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastBreak = cut.lastIndexOf("\n");
  return lastBreak > maxChars * 0.75 ? cut.slice(0, lastBreak) : cut;
}

/**
 * Compact line diff: "- removed" and "+ added" lines in page order, as a multiset
 * difference (a moved line is not a change). Past maxChars the rest is summarized.
 */
export function diffSnapshots(before: string, after: string, maxChars = 4_000): string {
  const count = new Map<string, number>();
  const lines = (text: string) => (text ? text.split("\n") : []);
  for (const line of lines(before)) count.set(line, (count.get(line) ?? 0) + 1);
  const added: string[] = [];
  for (const line of lines(after)) {
    const n = count.get(line) ?? 0;
    if (n > 0) count.set(line, n - 1);
    else added.push(`+ ${line}`);
  }
  const removed: string[] = [];
  for (const line of lines(before)) {
    const n = count.get(line) ?? 0;
    if (n > 0) {
      count.set(line, n - 1);
      removed.push(`- ${line}`);
    }
  }
  const changes = [...removed, ...added];
  const out: string[] = [];
  let used = 0;
  for (const [index, change] of changes.entries()) {
    const line = change.length > 500 ? `${change.slice(0, 500)}...` : change;
    if (used + line.length + 1 > maxChars) {
      out.push(`…${changes.length - index} more changes`);
      break;
    }
    out.push(line);
    used += line.length + 1;
  }
  return out.join("\n");
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
}

/** A tool result as indented JSON with keys in sorted order, so equal data gives equal text and the line diff shows what changed. */
export function stableJsonText(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2) ?? "null";
}
