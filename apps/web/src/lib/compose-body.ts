const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;

/** Escapes `text`, turning each http(s) URL (without trailing punctuation) into a link. */
function linkify(text: string): string {
  let out = "";
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[.,;:!?'")\]]+$/, "");
    out += `${escapeHtml(text.slice(last, match.index))}<a href="${escapeHtml(url).replace(/"/g, "&quot;")}">${escapeHtml(url)}</a>`;
    last = match.index + url.length;
  }
  return out + escapeHtml(text.slice(last));
}

/** The server's plain-text reply or forward body as editor HTML: `>` lines become a blockquote. */
export function textToHtml(text: string): string {
  const out: string[] = [];
  let quote: string[][] | null = null;
  const flush = () => {
    if (!quote) return;
    out.push(`<blockquote>${quote.map((p) => `<p>${p.join("<br>")}</p>`).join("")}</blockquote>`);
    quote = null;
  };
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const quoted = /^>( ?)(.*)$/.exec(line);
    if (quoted) {
      quote ??= [[]];
      const content = linkify(quoted[2] ?? "");
      if (content) (quote[quote.length - 1] as string[]).push(content);
      else if ((quote[quote.length - 1] as string[]).length) quote.push([]);
      continue;
    }
    flush();
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  flush();
  return out.join("");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Base64 of the file's bytes, without a data: prefix. */
export async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
