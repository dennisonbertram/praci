import { ORPCError } from "@orpc/server";
import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { prepareManagedConnectorForTransaction, sanitizeComposioError } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { integrationAgentSpawnKey } from "@rakazo/contracts";
import { providerErrorMessage } from "@rakazo/core";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

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
  /** Gives a newly connected private account its agent; a no-op when it has one or is not private. */
  provision?: (connectionId: string) => Promise<void>;
  /** Runs once the connection is saved, for work that must not delay or fail the connect. */
  afterConnect?: (connectionId: string) => void;
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
    const redirectUrl = (pending.metadata as { redirectUrl?: unknown } | null)?.redirectUrl;
    completed = await prepared.provider.complete(
      {
        state,
        code: options.code,
        provider: pending.provider,
        ...(typeof redirectUrl === "string" ? { redirectUrl } : {}),
      },
      options.context,
    );
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", { message: connectionFailureMessage(error) });
  }
  const { connectionRef, secretId, scope } = completed;
  if (!secretId)
    throw new ORPCError("BAD_REQUEST", { message: "Connection did not return a credential" });

  let row: Awaited<ReturnType<typeof prisma.connection.update>>;
  try {
    row = await prisma.$transaction(
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
          select: { id: true, secretId: true },
        });
        let carried: Prisma.ConnectionUncheckedUpdateInput = {};
        const replaces = (current.metadata as { replacesConnectionId?: unknown } | null)
          ?.replacesConnectionId;
        if (taken && taken.id === replaces) {
          // Lock both rows first (the order every access change uses: connection, then bot, then
          // grants), then read the old row's settings, so a concurrent change to them is not lost.
          await tx.$queryRaw`SELECT id FROM connections WHERE id IN (${taken.id}, ${current.id}) ORDER BY id FOR UPDATE`;
          const old = await tx.connection.findFirst({ where: { id: taken.id, ...owner } });
          if (!old) throw new ORPCError("CONFLICT", { message: "The connection changed; retry" });
          // The same account signing in again replaces its old connection: the Inbox's to-dos and
          // cached mail move over, so reconnecting loses nothing. Not revoked remotely, since that
          // could invalidate the new token of the same grant.
          const next = { connectionId: current.id };
          await tx.cachedMailMessage.updateMany({ where: { connectionId: taken.id }, data: next });
          // Sender stats (and the prior-contact answers in them) follow too. The new connection's
          // own rows, if it synced already, are rebuilt from its mail on the next sync.
          await tx.mailSenderStat.deleteMany({ where: { connectionId: current.id } });
          await tx.mailSenderStat.updateMany({ where: { connectionId: taken.id }, data: next });
          // Skip decisions and the action log cascade-delete with the old row, so they move too. A
          // decision keeps its Gmail filter id: it is the same Google account.
          await tx.mailSenderDecision.deleteMany({ where: { connectionId: current.id } });
          await tx.mailSenderDecision.updateMany({
            where: { connectionId: taken.id },
            data: next,
          });
          await tx.mailActionLog.updateMany({ where: { connectionId: taken.id }, data: next });
          await tx.inboxTodo.updateMany({ where: { connectionId: taken.id }, data: next });
          await tx.composeSend.updateMany({ where: { connectionId: taken.id }, data: next });
          // A Calendar or Drive agent is keyed by its connection, so it follows the new id; the
          // Inbox agent keeps its per-user key.
          await tx.bot.updateMany({
            where: { ...owner, spawnKey: integrationAgentSpawnKey(taken.id), archivedAt: null },
            data: { spawnKey: integrationAgentSpawnKey(current.id) },
          });
          // The new row takes exactly the old row's grants and settings.
          await tx.botConnectionAccess.deleteMany({ where: { connectionId: current.id } });
          await tx.botConnectionAccess.updateMany({
            where: { connectionId: taken.id },
            data: next,
          });
          carried = {
            agentBotId: old.agentBotId,
            writesEnabled: old.writesEnabled,
            allAgents: old.allAgents,
            privateByDefault: old.privateByDefault,
          };
          await tx.connection.delete({ where: { id: taken.id } });
          if (taken.secretId)
            await tx.secret.deleteMany({ where: { id: taken.secretId, ...owner } });
        } else if (taken)
          throw new ORPCError("CONFLICT", { message: "This Google account is already connected." });
        return tx.connection.update({
          where: { id: current.id },
          data: {
            status: "connected",
            providerRef: connectionRef,
            secretId,
            // The granted scopes tell the mail provider whether it may manage Gmail filters.
            metadata: scope ? { scope } : {},
            ...carried,
          },
        });
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    // The transaction rolled back, so nothing references the new credential. Google keeps
    // the token valid; it is not revoked here because revoking one token of a grant can
    // invalidate the tokens of an account that is already connected.
    await prisma.secret.deleteMany({ where: { id: secretId, ...owner } });
    throw error;
  }

  // A replacement of a private connection that had no agent gets one too; the provisioner does
  // nothing for a row that is not private or already has one.
  await options.provision?.(row.id).catch(() => undefined);
  try {
    options.afterConnect?.(row.id);
  } catch {
    // Best effort.
  }
  const final =
    (await prisma.connection.findFirst({ where: { id: row.id, ...owner } }).catch(() => null)) ??
    row;
  return {
    id: final.id,
    connectorId: row.connectorId,
    provider: row.provider,
    displayName: row.displayName,
    status: row.status as "pending" | "connected" | "revoked" | "error",
    error: connectionError(row),
    writesEnabled: final.writesEnabled,
    agentBotId: final.agentBotId,
    capabilities: [],
    createdAt: row.createdAt.toISOString(),
  };
}

/** Short user-safe reason for a failed connection; never provider internals. */
export function connectionError(row: { status: string }): string | null {
  return row.status === "error" ? "Connection failed. Reconnect to try again." : null;
}

/** Readable text for a provider failure; the full raw error goes to the server log. */
export function connectionFailureMessage(error: unknown): string {
  const raw = sanitizeComposioError(error);
  getLogger().error("connection provider error", raw);
  return providerErrorMessage(raw, "The app could not be connected.");
}
