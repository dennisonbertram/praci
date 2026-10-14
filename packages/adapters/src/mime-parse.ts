export interface ParsedMime {
  headers: Array<{ name: string; value: string }>;
  /** First header with this name (case-insensitive), unfolded and still RFC 2047 encoded. */
  header(name: string): string | undefined;
  /** Decoded text/plain and text/html bodies, found anywhere in the tree. */
  text?: string;
  html?: string;
  /** Content-Type of every part, outermost first. */
  types: string[];
}

/** Reads the RFC 2822 messages `buildRawMessage` writes. Test and emulator support, not a general parser. */
export function parseRawMime(raw: string): ParsedMime {
  const { headers, body } = split(raw);
  const result: ParsedMime = {
    headers,
    header: (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value,
    types: [],
  };
  visit(headers, body, result);
  return result;
}

function split(raw: string) {
  const match = /\r?\n\r?\n/.exec(raw);
  const head = match ? raw.slice(0, match.index) : raw;
  const body = match ? raw.slice(match.index + match[0].length) : "";
  const headers: Array<{ name: string; value: string }> = [];
  for (const line of head.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && headers.length) {
      (headers[headers.length - 1] as { value: string }).value += ` ${line.trim()}`;
      continue;
    }
    const colon = line.indexOf(":");
    if (colon > 0)
      headers.push({ name: line.slice(0, colon), value: line.slice(colon + 1).trim() });
  }
  return { headers, body };
}

function visit(headers: Array<{ name: string; value: string }>, body: string, out: ParsedMime) {
  const get = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const type = get("content-type") || "text/plain";
  const mime = (type.split(";")[0] as string).trim().toLowerCase();
  out.types.push(mime);
  if (mime.startsWith("multipart/")) {
    const boundary = /boundary="?([^";]+)"?/i.exec(type)?.[1];
    if (!boundary) return;
    for (const piece of body.split(`--${boundary}`).slice(1)) {
      if (piece.startsWith("--")) break;
      const part = split(piece.replace(/^\r?\n/, ""));
      visit(part.headers, part.body, out);
    }
    return;
  }
  const encoding = get("content-transfer-encoding").toLowerCase();
  const bytes =
    encoding === "base64"
      ? Buffer.from(body.replace(/\s+/g, ""), "base64")
      : encoding === "quoted-printable"
        ? Buffer.from(
            body
              .replace(/=\r?\n/g, "")
              .replace(/=([0-9A-F]{2})/gi, (_m, h: string) =>
                String.fromCharCode(Number.parseInt(h, 16)),
              ),
            "latin1",
          )
        : Buffer.from(body, "utf8");
  const text = bytes.toString("utf8");
  if (mime === "text/plain") out.text ??= text;
  if (mime === "text/html") out.html ??= text;
}
