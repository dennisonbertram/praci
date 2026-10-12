import { ORPCError } from "@orpc/server";
import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { prepareManagedConnectorForTransaction, sanitizeComposioError } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "@rakazo/db";

/**
 * Finish a native OAuth connect (Google) from the callback page. The pending row is found by
 * `state`, which `begin` stored in `providerRef`, and only for the signed-in owner, so a link
 * sent by someone else cannot attach their account to this user's Rakazo account.
 */
export async function completeNativeOAuth(options: {
  prisma: PrismaClient;
  actor: Pick<Actor, "spaceId" | "userId">;
  connector: ManagedConnectorProvider;
  connectorId: string;
  state: string;
  code: string;
  context: AdapterContext;
  /** The same per-provider advisory lock `connections.begin` and `connections.revoke` take. */
  lock: (tx: Prisma.TransactionClient, connectorId: string, provider: string) => Promise<void>;
}) {
  const { prisma, actor, connectorId, state } = options;
  const owner = { spaceId: actor.spaceId, userId: actor.userId };
  const pending = await prisma.connection.findFirst({
    where: { ...owner, connectorId, status: "pending", providerRef: state },
  });
  if (!pending) throw new ORPCError("NOT_FOUND", { message: "Connection attempt not found" });
  const prepared = await prepareManagedConnectorForTransaction(options.connector);
  if (!prepared.provider)
    throw new ORPCError("BAD_REQUEST", { message: "Integration provider is not configured" });

  let completed: Awaited<ReturnType<ManagedConnectorProvider["complete"]>>;
  try {
    completed = await prepared.provider.complete({ state, code: options.code }, options.context);
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", { message: sanitizeComposioError(error) });
  }
  const { connectionRef, secretId } = completed;
  if (!secretId)
    throw new ORPCError("BAD_REQUEST", { message: "Connection did not return a credential" });

  try {
    const row = await prisma.$transaction(
      async (tx) => {
        await options.lock(tx, connectorId, pending.provider);
        const current = await tx.connection.findFirst({
          where: { id: pending.id, ...owner, status: "pending", providerRef: state },
        });
        if (!current) throw new ORPCError("NOT_FOUND", { message: "Connection attempt not found" });
        if (prepared.recheck && !(await prepared.recheck(tx)))
          throw new ORPCError("CONFLICT", { message: "Integration credentials changed; retry." });
        const taken = await tx.connection.findFirst({
          where: {
            ...owner,
            connectorId,
            provider: current.provider,
            id: { not: current.id },
            status: { in: ["connected", "pending", "error"] },
            providerRef: connectionRef,
          },
          select: { id: true },
        });
        if (taken)
          throw new ORPCError("CONFLICT", { message: "This Google account is already connected." });
        return tx.connection.update({
          where: { id: current.id },
          data: { status: "connected", providerRef: connectionRef, secretId, metadata: {} },
        });
      },
      { timeout: 60_000 },
    );
    return {
      id: row.id,
      connectorId: row.connectorId,
      provider: row.provider,
      displayName: row.displayName,
      status: row.status as "pending" | "connected" | "revoked" | "error",
      capabilities: [],
      createdAt: row.createdAt.toISOString(),
    };
  } catch (error) {
    // The transaction rolled back, so nothing references the new credential. Google keeps
    // the token valid; it is not revoked here because revoking one token of a grant can
    // invalidate the tokens of an account that is already connected.
    await prisma.secret.deleteMany({ where: { id: secretId, ...owner } });
    throw error;
  }
}
