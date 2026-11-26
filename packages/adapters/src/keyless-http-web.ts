import { Readability } from "@mozilla/readability";
import type {
  AdapterContext,
  WebFetchRequest,
  WebFetchResult,
  WebProvider,
  WebSearchHit,
  WebSearchRequest,
} from "@rakazo/adapter-kit";
import { JSDOM } from "jsdom";
import { classifyBotWall } from "./bot-wall.js";
import { clampMaxChars, clampMaxResults } from "./web-limits.js";
import type { ResolveHostname } from "./web-ssrf.js";
import { fetchSafeWebText, WebHttpError } from "./web-ssrf.js";

export {
  clampMaxChars,
  clampMaxResults,
  DEFAULT_WEB_FETCH_MAX_CHARS,
  DEFAULT_WEB_SEARCH_MAX_RESULTS,
  MAX_WEB_FETCH_MAX_CHARS,
  MAX_WEB_SEARCH_RESULTS,
  MIN_WEB_FETCH_MAX_CHARS,
} from "./web-limits.js";

const DEFAULT_SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";

export type KeylessHtmlSearchBackend = {
  id: string;
  endpoint: string;
  parse(html: string, maxResults: number): WebSearchHit[];
};

export type KeylessHttpWebOptions = {
  fetch?: typeof globalThis.fetch;
  resolveHostname?: ResolveHostname;
  searchBackend?: KeylessHtmlSearchBackend;
  searchTimeoutMs?: number;
  fetchTimeoutMs?: number;
  maxBufferBytes?: number;
  userAgent?: string;
};

/** HTML search backend using DuckDuckGo’s public HTML form. One keyless option, not the interface. */
export const duckDuckGoHtmlSearchBackend: KeylessHtmlSearchBackend = {
  id: "duckduckgo-html",
  endpoint: DEFAULT_SEARCH_ENDPOINT,
  parse: parseDuckDuckGoResults,
};

/**
 * Keyless HTTP web search + page fetch. No API key, no sandbox, no JS execution.
 * Search uses a pluggable HTML backend (default: DuckDuckGo HTML). Fetch uses
 * Mozilla Readability with a lightweight HTML-strip fallback.
 */
export class KeylessHttpWebProvider implements WebProvider {
  private readonly fetchImpl?: typeof globalThis.fetch;
  private readonly resolveHostname?: ResolveHostname;
  private readonly searchBackend: KeylessHtmlSearchBackend;
  private readonly searchTimeoutMs: number;
  private readonly fetchTimeoutMs: number;
  private readonly maxBufferBytes: number;
  private readonly userAgent: string;

  constructor(options: KeylessHttpWebOptions = {}) {
    this.fetchImpl = options.fetch;
    this.resolveHostname = options.resolveHostname;
    this.searchBackend = options.searchBackend ?? duckDuckGoHtmlSearchBackend;
    this.searchTimeoutMs = options.searchTimeoutMs ?? 15_000;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? 15_000;
    this.maxBufferBytes = options.maxBufferBytes ?? 5 * 1024 * 1024;
    this.userAgent =
      options.userAgent ?? "Praci/0.1 (+https://github.com/dennisonbertram/rakazo; web tools)";
  }

  describe() {
    return {
      id: "keyless-http",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: {
        search: true,
        fetch: true,
        keyless: true,
        native: false,
        readability: true,
      },
    };
  }

  async search(request: WebSearchRequest, context: AdapterContext): Promise<WebSearchHit[]> {
    const query = request.query.trim();
    if (!query) throw new Error("query is required");
    const maxResults = clampMaxResults(request.maxResults);
    const searchUrl = new URL(this.searchBackend.endpoint);
    searchUrl.searchParams.set("q", query);
    const { body } = await fetchSafeWebText(searchUrl.href, {
      fetch: this.fetchImpl,
      resolveHostname: this.resolveHostname,
      timeoutMs: this.searchTimeoutMs,
      maxBytes: 1024 * 1024,
      userAgent: this.userAgent,
      signal: request.signal ?? context.signal,
    });
    return this.searchBackend.parse(body, maxResults);
  }

  async fetch(request: WebFetchRequest, context: AdapterContext): Promise<WebFetchResult> {
    const maxChars = clampMaxChars(request.maxChars);
    let page: Awaited<ReturnType<typeof fetchSafeWebText>>;
    try {
      page = await fetchSafeWebText(request.url, {
        fetch: this.fetchImpl,
        resolveHostname: this.resolveHostname,
        timeoutMs: this.fetchTimeoutMs,
        maxBytes: this.maxBufferBytes,
        userAgent: this.userAgent,
        signal: request.signal ?? context.signal,
      });
    } catch (error) {
      if (!(error instanceof WebHttpError)) throw error;
      const wall = classifyBotWall({ ...error, body: error.bodyPrefix });
      if (!wall) throw error;
      return {
        url: request.url,
        title: "",
        text: "",
        truncated: false,
        wall: { ...wall, status: error.status },
      };
    }
    const { url, body } = page;
    const wall = classifyBotWall({
      status: page.status ?? 200,
      headers: page.headers ?? new Headers(),
      body,
    });
    if (wall)
      return {
        url,
        title: "",
        text: "",
        truncated: false,
        wall: { ...wall, status: page.status ?? 200 },
      };
    if (!body.trim()) throw new Error(`Failed to fetch content from ${url}`);
    const extracted = extractReadableText(body, url);
    const truncated = extracted.text.length > maxChars;
    return {
      url,
      title: extracted.title,
      text: truncated
        ? `${extracted.text.slice(0, maxChars)}\n\n[Content truncated]`
        : extracted.text,
      truncated,
    };
  }
}

export function parseDuckDuckGoResults(html: string, maxResults: number): WebSearchHit[] {
  const dom = new JSDOM(html, { url: DEFAULT_SEARCH_ENDPOINT });
  const document = dom.window.document;
  const results: WebSearchHit[] = [];

  for (const node of Array.from(document.querySelectorAll(".result"))) {
    const link = node.querySelector("a.result__a");
    if (!link) continue;
    const title = normalizeWhitespace(link.textContent ?? "");
    let url: string;
    try {
      url = unwrapDuckDuckGoUrl(link.getAttribute("href") ?? "");
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;
      url = parsed.href;
    } catch {
      continue;
    }
    const snippet = normalizeWhitespace(node.querySelector(".result__snippet")?.textContent ?? "");
    if (title && url) results.push({ title, url, snippet });
    if (results.length >= maxResults) break;
  }
  return results;
}

function unwrapDuckDuckGoUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, DEFAULT_SEARCH_ENDPOINT);
    const target = parsed.searchParams.get("uddg");
    if (target) return target;
    return parsed.href;
  } catch {
    return rawUrl;
  }
}

export function extractReadableText(html: string, url: string): { title: string; text: string } {
  const readable = extractWithReadability(html, url);
  if (readable) return readable;
  return stripHtmlFallback(html);
}

// Readability runs synchronously and slows sharply on element-heavy pages, freezing the server.
// Bigger pages take the linear fallback.
const MAX_READABILITY_ELEMENTS = 10_000;

function extractWithReadability(html: string, url: string): { title: string; text: string } | null {
  try {
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document, {
      maxElemsToParse: MAX_READABILITY_ELEMENTS,
    }).parse();
    if (article?.textContent && article.textContent.length > 0) {
      return {
        title: article.title?.trim() || "Untitled",
        text: normalizeArticleText(article.textContent),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// These scans give the same result as the obvious regexes (/<title[^>]*>([\s\S]*?)<\/title>/i,
// /<script[^>]*>[\s\S]*?<\/script>/gi, /<[^>]+>/g), which backtrack quadratically on unclosed tags.
function stripHtmlFallback(html: string): { title: string; text: string } {
  const titleOpen = forwardSearch(html, "<title")(0);
  const titleEnd = titleOpen === -1 ? -1 : html.indexOf(">", titleOpen);
  const titleClose = titleEnd === -1 ? -1 : forwardSearch(html, "</title>")(titleEnd + 1);
  const title = titleClose === -1 ? "" : html.slice(titleEnd + 1, titleClose);
  return {
    title: normalizeWhitespace(title) || "Untitled",
    text: normalizeArticleText(stripTags(removeElements(removeElements(html, "script"), "style"))),
  };
}

/** Finds a case-insensitive literal at or after `from`; calls must not move backwards. */
function forwardSearch(text: string, literal: string): (from: number) => number {
  const pattern = new RegExp(literal, "gi");
  let found = -2;
  return (from) => {
    if (found === -1 || found >= from) return found;
    pattern.lastIndex = from;
    found = pattern.exec(text)?.index ?? -1;
    return found;
  };
}

function removeElements(html: string, name: string): string {
  const open = forwardSearch(html, `<${name}`);
  const end = forwardSearch(html, ">");
  const close = forwardSearch(html, `</${name}>`);
  let kept = "";
  let position = 0;
  for (;;) {
    const start = open(position);
    const startEnd = start === -1 ? -1 : end(start);
    const finish = startEnd === -1 ? -1 : close(startEnd + 1);
    // A later opener cannot find a closer this one missed.
    if (finish === -1) break;
    kept += html.slice(position, start);
    position = finish + name.length + 3;
  }
  return kept + html.slice(position);
}

function stripTags(html: string): string {
  let text = "";
  let position = 0;
  for (;;) {
    const start = html.indexOf("<", position);
    const end = start === -1 ? -1 : html.indexOf(">", start + 1);
    if (end === -1) break;
    // "<>" is text, not an empty tag.
    text += end === start + 1 ? html.slice(position, end) : `${html.slice(position, start)} `;
    position = end === start + 1 ? end : end + 1;
  }
  return text + html.slice(position);
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeArticleText(text: string): string {
  // Collapse runs before trimming line ends: /[ \t]+\n/ rescans long runs quadratically.
  return text
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
