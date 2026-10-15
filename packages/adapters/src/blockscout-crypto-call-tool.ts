import { isCryptoEndpoint } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

/**
 * The user's enabled Blockscout server (oldest first), or null. Crypto sync does not call it; its
 * row is the key for the sync throttle (`finance_sync_states` is keyed by McpServer id).
 */
export async function findCryptoServer(
  prisma: Pick<PrismaClient, "mcpServer">,
  scope: { spaceId: string; userId: string },
): Promise<{ id: string; endpoint: string } | null> {
  const rows = await prisma.mcpServer.findMany({
    where: { spaceId: scope.spaceId, userId: scope.userId, enabled: true },
    select: { id: true, endpoint: true },
    orderBy: { createdAt: "asc" },
  });
  const row = rows.find((r) => isCryptoEndpoint(r.endpoint));
  return row?.endpoint ? { id: row.id, endpoint: row.endpoint } : null;
}
