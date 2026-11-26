import { randomUUID } from "node:crypto";
import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { SharedArtifact } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { openArtifactShare } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { Context, Hono } from "hono";
import * as z from "zod";

const PATH = "/api/share";

/** What the public lookup needs: the artifact the token names, or null. */
export interface ShareStore {
  open(token: string): Promise<
    | {
        name: string;
        mimeType: string;
        spaceId: string;
        userId: string;
        storageKey: string;
      }
    | "limited"
    | null
  >;
}

export const prismaShareStore = (prisma: PrismaClient): ShareStore => ({
  open: (token) => openArtifactShare(prisma, token),
});

const OpenBody = z.object({ token: z.string().min(1).max(512) });

/**
 * The public share endpoint. It never reads the session cookie or any other credential: the only
 * input is the link token in the POST body (the page reads it from the URL fragment), and the only
 * data it can return is the artifact row that token names.
 */
export function mountArtifactShare(
  app: Hono,
  deps: {
    store: ShareStore;
    artifacts: ArtifactStore;
  },
): void {
  // Set before the handler runs so refusals and errors carry them too.
  app.use(`${PATH}/*`, async (c, next) => {
    c.header("cache-control", "private, no-store");
    c.header("referrer-policy", "no-referrer");
    c.header("x-content-type-options", "nosniff");
    await next();
  });

  const gone = (c: Context) => c.json({ error: "Not found" }, 404);

  app.post(`${PATH}/open`, async (c) => {
    const body = OpenBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return gone(c);
    const operationId = `share.open:${randomUUID()}`;
    try {
      const artifact = await deps.store.open(body.data.token);
      // The window is one minute long, so a minute is an honest upper bound.
      if (artifact === "limited") {
        return c.json({ error: "Too many requests" }, 429, { "retry-after": "60" });
      }
      if (!artifact) return gone(c);
      const bytes = await deps.artifacts.get(artifact.storageKey, {
        operationId,
        traceId: operationId,
        spaceId: artifact.spaceId,
        userId: artifact.userId,
        signal: c.req.raw.signal,
      });
      return c.json({
        name: artifact.name,
        mimeType: artifact.mimeType,
        contentBase64: Buffer.from(bytes).toString("base64"),
      } satisfies SharedArtifact);
    } catch (error) {
      // Never log the token or the request body.
      getLogger().error("shared artifact open failed", error, { operationId });
      return c.json({ error: "Unavailable" }, 500);
    }
  });
}
