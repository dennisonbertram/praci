import { ORPCError } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import type { Hono } from "hono";
import type { InboxDeps } from "./inbox.js";
import { inboxAttachment } from "./inbox.js";

/** Types a browser would render or run if it were served inline; they download as opaque bytes. */
export const RENDERABLE =
  /^(text\/html|application\/xhtml|image\/svg|[^;]*[/+]xml|text\/javascript|application\/(java|ecma)script)/i;
const SAFE_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i;

export function downloadType(mimeType: string): string {
  return SAFE_TYPE.test(mimeType) && !RENDERABLE.test(mimeType)
    ? mimeType
    : "application/octet-stream";
}

/** `attachment` with an ASCII fallback plus the RFC 5987 UTF-8 name; no CR, LF, quote or path part. */
export function contentDisposition(filename: string): string {
  const clean = filename
    .replace(/[\p{Cc}\p{Cf}\\/:*?"<>|;]+/gu, "_")
    .replace(/^[.\s]+/, "")
    .slice(0, 150);
  const name = clean || "attachment";
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/%/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

/** The signed-in user's own message attachment as a forced download. */
export function mountInboxAttachment(
  app: Hono,
  deps: Pick<InboxDeps, "prisma" | "mail">,
  authenticate: (request: Request) => Promise<Actor | null>,
) {
  app.get("/api/inbox/messages/:messageId/attachments/:attachmentId", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    try {
      const file = await inboxAttachment(
        deps as InboxDeps,
        actor,
        { messageId: c.req.param("messageId"), attachmentId: c.req.param("attachmentId") },
        c.req.raw.signal,
      );
      // Copy into a fresh ArrayBuffer-backed view: DOM-lib BodyInit rejects Uint8Array<ArrayBufferLike>.
      return new Response(new Uint8Array(file.bytes), {
        headers: {
          "content-type": downloadType(file.mimeType),
          "content-length": String(file.bytes.length),
          "content-disposition": contentDisposition(file.filename),
          "x-content-type-options": "nosniff",
          "content-security-policy": "sandbox; default-src 'none'",
          "cache-control": "private, no-store",
        },
      });
    } catch (error) {
      if (error instanceof ORPCError) {
        return c.json({ error: error.message }, error.status as 404 | 412 | 413 | 503);
      }
      throw error;
    }
  });
}
