import type { ArtifactStore } from "@rakazo/adapter-kit";
import { dataRoomBlobContext } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import type { Hono } from "hono";
import { contentDisposition } from "./inbox-attachment.js";

/** Streams the signed-in user's own finished export. Anyone else's id, or an expired one, is a 404. */
export function mountAccountExportDownload(
  app: Hono,
  deps: { prisma: PrismaClient; artifacts: ArtifactStore },
  authenticate: (request: Request) => Promise<Actor | null>,
) {
  app.get("/api/account/exports/:id/download", async (c) => {
    const actor = await authenticate(c.req.raw);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const row = await deps.prisma.accountExport.findFirst({
      where: {
        id: c.req.param("id"),
        userId: actor.userId,
        status: "ready",
        expiresAt: { gt: new Date() },
        storageKey: { not: null },
      },
    });
    if (!row?.storageKey || row.size === null) return c.json({ error: "Not found" }, 404);
    const stream = await deps.artifacts.getStream(
      row.storageKey,
      dataRoomBlobContext(
        { userId: row.userId, spaceId: row.spaceId, email: "", isDeploymentOwner: false },
        "account-export.download",
        c.req.raw.signal,
      ),
    );
    return new Response(stream, {
      headers: {
        "content-type": "application/zip",
        "content-length": String(row.size),
        "content-disposition": contentDisposition("praci-export.zip"),
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
      },
    });
  });
}
