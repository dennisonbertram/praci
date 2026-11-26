import type { PrivateFragments } from "./outbound-check.js";

/** Every string in a value, however deeply nested in arrays and objects (bounded). */
export function collectStrings(value: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > 8 || out.length > 200) return out;
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, depth + 1, out);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, depth + 1, out);
    }
  }
  return out;
}

/**
 * Deterministic exfiltration check for a URL the agent is about to fetch without asking (a blanket
 * "Allow all sites" rule, or a public research agent). Two tests, no vendor, offline:
 *
 * 1. Private text. The URL is decoded (percent, plus, base64, base64url, hex) token by token and
 *    across parameters, and every candidate is matched against the private fragments the run
 *    read. A match is never cleared by anything else.
 * 2. Shape. A URL that carries a payload rather than a page address is suspicious: very long URLs
 *    or query strings, many parameters, long dense tokens in a path or value, a host name that
 *    carries data, or a token that decodes to readable text.
 *
 * It lowers the chance of a leak and cannot remove it: a few words spread over ordinary-looking
 * path segments, or one fact per request, pass. Limits are tuned so documentation, package,
 * repository and news URLs with short queries pass (see the corpus test).
 */
export type UrlVerdict =
  | { verdict: "clean" }
  | { verdict: "fragment"; reason: string }
  | { verdict: "suspicious"; reason: string; indicators: string[] };

const MAX_URL_LENGTH = 400;
const MAX_QUERY_LENGTH = 160;
const MAX_PARAMS = 12;
const DENSE_TOKEN_MIN = 28;
const DENSE_ENTROPY = 4.3;
const HOST_LABEL_MAX = 24;
const MAX_HOST_LABELS = 7;
/** Hash lengths that appear in ordinary URLs (md5, sha1 commit, sha256). */
const COMMON_HASH_LENGTHS = new Set([32, 40, 64]);

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function percentDecoded(value: string): string {
  let out = value.replace(/\+/g, " ");
  for (let round = 0; round < 3; round += 1) {
    const next = decodeURIComponentSafe(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

function printableText(bytes: Buffer): string | undefined {
  if (bytes.length < 4) return undefined;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  const printable = [...text].filter((ch) => /[\p{L}\p{N}\p{P}\p{Zs}]/u.test(ch)).length;
  return printable / text.length >= 0.95 && /\p{L}/u.test(text) ? text : undefined;
}

/** Text hidden in a token as base64, base64url or hex, when it decodes to readable text. */
function decodeToken(token: string): string | undefined {
  if (token.length < 8) return undefined;
  if (/^[0-9a-f]+$/i.test(token) && token.length % 2 === 0) {
    const text = printableText(Buffer.from(token, "hex"));
    if (text) return text;
  }
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(token)) {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    const text = printableText(Buffer.from(normalized, "base64"));
    if (text) return text;
  }
  return undefined;
}

function entropy(value: string): number {
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/** A short, one-way-enough label for a flagged token (FNV-1a), so the token itself is never sent. */
function short(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Tokens of a URL: host labels, path segments, query keys and values, and the fragment. */
function urlTokens(url: URL, original: string) {
  // The URL parser lower-cases the host, which would break a base64 label: read the original.
  const rawHost = /^[a-z][a-z0-9+.-]*:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i.exec(original)?.[1];
  const labels = (rawHost ?? url.hostname).split(".").filter(Boolean);
  const segments = url.pathname.split("/").filter(Boolean).map(percentDecoded);
  const pairs = [...url.searchParams.entries()];
  const fragment = percentDecoded(url.hash.replace(/^#/, ""));
  return { labels, segments, pairs, fragment };
}

/** Every text a fragment could be hidden in, for matching against the private record. */
export function decodedCandidates(urlOrText: string): string[] {
  const candidates = new Set<string>([percentDecoded(urlOrText)]);
  let tokens: string[] = [];
  let joined: string[] = [];
  try {
    const url = new URL(urlOrText);
    const parts = urlTokens(url, urlOrText);
    tokens = [...parts.labels, ...parts.segments, ...parts.pairs.flat(), parts.fragment].flatMap(
      (token) => token.split(/[\s,;]+/),
    );
    // A payload split across parameters, segments or host labels is read in order.
    joined = [
      parts.pairs.map(([, value]) => value).join(""),
      parts.pairs.map(([key]) => key).join(""),
      parts.segments.join(""),
      parts.labels.slice(0, -2).join(""),
    ];
    for (const part of [
      parts.pairs.map(([, value]) => value).join(" "),
      parts.segments.join(" "),
      parts.labels.join(" "),
    ]) {
      candidates.add(part);
    }
  } catch {
    tokens = percentDecoded(urlOrText).split(/[^A-Za-z0-9+/_=-]+/);
  }
  for (const token of [...tokens, ...joined]) {
    const decoded = decodeToken(token);
    if (decoded) candidates.add(decoded);
  }
  return [...candidates].filter(Boolean);
}

/** True when any decoded form of the text repeats a private fragment. */
export function repeatsPrivateText(text: string, fragments: PrivateFragments): boolean {
  return decodedCandidates(text).some((candidate) => fragments.matches(candidate).length > 0);
}

/** The reason when the run's record of what it read could not be loaded. */
export const RUN_RECORD_UNKNOWN = "run record unknown";

/** The deterministic verdict for one URL. `fragments` undefined means the run's record is unknown. */
export function checkFetchUrl(
  urlText: string,
  fragments: PrivateFragments | undefined,
): UrlVerdict {
  if (!fragments) return { verdict: "fragment", reason: RUN_RECORD_UNKNOWN };
  if (repeatsPrivateText(urlText, fragments)) {
    return { verdict: "fragment", reason: "URL repeats private text" };
  }
  let url: URL;
  try {
    url = new URL(urlText);
  } catch {
    return { verdict: "suspicious", reason: "not a plain URL", indicators: [] };
  }
  const { labels, segments, pairs, fragment } = urlTokens(url, urlText);
  const flagged: string[] = [];
  const flag = (reason: string, token?: string) =>
    flagged.push(token ? `${reason}:${token.length}:${short(token)}` : reason);

  if (urlText.length > MAX_URL_LENGTH) flag("long_url");
  if (url.search.length > MAX_QUERY_LENGTH) flag("long_query", url.search);
  if (pairs.length > MAX_PARAMS) flag("many_params");
  const hostLabels = labels.slice(0, -2);
  if (labels.length > MAX_HOST_LABELS) flag("deep_host");
  for (const label of hostLabels) {
    if (label.length >= HOST_LABEL_MAX && /\d/.test(label)) flag("host_data", label);
    else if (
      label.length >= 16 &&
      /^[0-9a-f]+$/i.test(label) &&
      !COMMON_HASH_LENGTHS.has(label.length)
    ) {
      flag("host_hex", label);
    } else if (label.length >= 12 && decodeToken(label)) flag("host_encoded", label);
  }
  let hashes = 0;
  const tokens = [...segments, ...pairs.map(([, value]) => value), fragment].flatMap((t) =>
    t.split(/[\s,;]+/),
  );
  for (const token of tokens) {
    if (/^[0-9a-f]{24,}$/i.test(token)) {
      if (!COMMON_HASH_LENGTHS.has(token.length) || ++hashes > 1) flag("hex_token", token);
      continue;
    }
    const dense = /^[A-Za-z0-9+/_=~.-]+$/.test(token) && token.length >= DENSE_TOKEN_MIN;
    if (dense && entropy(token) >= DENSE_ENTROPY) flag("dense_token", token);
    else if (token.length >= 16 && !/[-_.]/.test(token)) {
      const decoded = decodeToken(token);
      if (decoded && decoded.length >= 10) flag("encoded_text", token);
    }
  }
  if (flagged.length === 0) return { verdict: "clean" };
  const reason = flagged[0]!.startsWith("long_")
    ? "unusually long URL"
    : flagged[0]!.startsWith("host")
      ? "data in the host name"
      : flagged[0]!.startsWith("encoded")
        ? "encoded text in the URL"
        : "long encoded value in the URL";
  return { verdict: "suspicious", reason, indicators: flagged.slice(0, 6) };
}
