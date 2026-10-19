import { createHmac, timingSafeEqual } from "node:crypto";
import { fetchSafeWebBytes, type SafeWebFetchOptions } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { getLogger } from "@rakazo/logging";
import type { Hono } from "hono";

export const IMAGE_PROXY_PATH = "/api/inbox/image";
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
// SVG is left out on purpose: it can carry script.
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

type Scope = Pick<Actor, "userId" | "spaceId">;

/** HMAC over the target and the person it was made for. The prefix keeps it from matching any other use of the secret. */
function sign(secret: string, url: string, scope: Scope): string {
  return createHmac("sha256", secret)
    .update(`email-image\0${scope.userId}\0${scope.spaceId}\0${url}`)
    .digest("base64url");
}

export function signedImageUrl(secret: string, url: string, scope: Scope): string {
  const params = new URLSearchParams({
    u: url,
    s: `${scope.userId}.${scope.spaceId}`,
    t: sign(secret, url, scope),
  });
  return `${IMAGE_PROXY_PATH}?${params}`;
}

function validToken(secret: string, url: string, token: string, scope: Scope): boolean {
  const a = Buffer.from(sign(secret, url, scope));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

const IMG_TAG = /<img\b[^>]*>/gi;
const ATTR = (name: string) => new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "i");
const decodeAmp = (v: string) => v.replace(/&amp;/gi, "&");

/**
 * Points every http(s) `<img src>` at the signed proxy so the sender never sees the reader's address, and drops
 * `srcset`. Anything this misses (a CSS background, an odd tag) simply stays blocked by the frame's CSP.
 */
export function proxyEmailImages(html: string, secret: string, scope: Scope): string {
  return html.replace(IMG_TAG, (tag) => {
    const out = tag.replace(ATTR("srcset"), "");
    return out.replace(ATTR("src"), (_all, raw: string) => {
      const value = decodeAmp(raw.replace(/^["']|["']$/g, "").trim());
      if (!/^https?:\/\//i.test(value)) return _all;
      return ` src="${signedImageUrl(secret, value, scope).replace(/&/g, "&amp;")}"`;
    });
  });
}

export interface ImageProxyOptions {
  secret: string;
  /** Test seams for the guarded fetch. */
  fetch?: SafeWebFetchOptions["fetch"];
  resolveHostname?: SafeWebFetchOptions["resolveHostname"];
}

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; sandbox",
  "cache-control": "private, max-age=86400",
};

/**
 * The image behind a signed link, fetched by the server. The browser loads it from a sandboxed frame with no
 * cookies, so the signed token is what authorizes it: it names one URL, one person and one space. A session,
 * when the browser does send one, must be the same person.
 */
export function mountEmailImageProxy(
  app: Hono,
  options: ImageProxyOptions,
  authenticate: (request: Request) => Promise<Actor | null>,
) {
  app.get(IMAGE_PROXY_PATH, async (c) => {
    const target = c.req.query("u") ?? "";
    const token = c.req.query("t") ?? "";
    const actor = await authenticate(c.req.raw);
    // The token carries the user and space; try the session's, then reject when there is none to match against.
    const scope = actor
      ? { userId: actor.userId, spaceId: actor.spaceId }
      : parseScope(c.req.query("s"));
    if (!scope || !target || !validToken(options.secret, target, token, scope)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    try {
      const image = await fetchSafeWebBytes(target, {
        fetch: options.fetch,
        resolveHostname: options.resolveHostname,
        timeoutMs: TIMEOUT_MS,
        maxBytes: MAX_BYTES,
        maxRedirects: MAX_REDIRECTS,
        userAgent: "Mozilla/5.0 (compatible; ImageProxy)",
        headers: { accept: "image/png,image/jpeg,image/gif,image/webp,image/avif" },
        signal: c.req.raw.signal,
      });
      const type = (image.contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
      if (!IMAGE_TYPES.has(type)) return c.json({ error: "Not an image" }, 415);
      return new Response(new Uint8Array(image.body), {
        headers: {
          ...SECURITY_HEADERS,
          "content-type": type,
          "content-length": String(image.body.byteLength),
        },
      });
    } catch (error) {
      // The query string is left out: tracking links put identifiers in it.
      const host = safeHost(target);
      getLogger().warn("email image proxy failed", {
        host,
        reason: error instanceof Error ? error.message : "error",
      });
      return c.json({ error: "Image unavailable" }, 502);
    }
  });
}

function parseScope(raw: string | undefined): Scope | null {
  const [userId, spaceId] = (raw ?? "").split(".");
  return userId && spaceId ? { userId, spaceId } : null;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid url";
  }
}
