import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import type { Hono } from "hono";

/** The signed-in user's own stored photo for one email address. Never another user's, never Google's URL. */
export function mountContactPhoto(
  app: Hono,
  deps: { prisma: Pick<PrismaClient, "contactPhoto">; artifacts: Pick<ArtifactStore, "get"> },
  authenticate: (request: Request) => Promise<Actor | null>,
) {
  app.get("/api/contacts/photo", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const email = (c.req.query("email") ?? "").trim().toLowerCase();
    const photo = email
      ? await deps.prisma.contactPhoto.findUnique({
          where: {
            spaceId_userId_email: { spaceId: actor.spaceId, userId: actor.userId, email },
          },
        })
      : null;
    if (!photo) return c.json({ error: "Not found" }, 404);
    const bytes = await deps.artifacts
      .get(photo.storageKey, {
        operationId: "contact-photo",
        traceId: "contact-photo",
        spaceId: actor.spaceId,
        userId: actor.userId,
        signal: c.req.raw.signal,
      })
      .catch(() => null);
    if (!bytes) return c.json({ error: "Not found" }, 404);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": photo.contentType,
        "content-length": String(bytes.byteLength),
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox; default-src 'none'",
        "cache-control": "private, max-age=300",
      },
    });
  });
}
