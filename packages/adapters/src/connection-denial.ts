import { connectionRowsForAudience, deniedConnectionIds, nonOwnerMayWrite } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";

export const CONNECTION_UNAVAILABLE_MESSAGE =
  "This connected account is no longer available to this bot.";

/**
 * Reads the connection rows of a connector route again from the database and returns the message
 * to refuse with when this bot may no longer use them (revoked, disconnected, limited to other
 * agents, or linked to an agent while the tool is not declared read-only), else null. The
 * executor runs it before a connector call and the connector runs it again right before the
 * provider call; the connected-app watch probe uses the same check.
 */
export async function connectionDenial(
  prisma: Pick<PrismaClient, "connection">,
  input: {
    spaceId: string;
    userId: string;
    bot: { id: string; audience: string | null; firewall?: boolean };
    route: { connectorId: string; connectionId?: string };
    /** The connection ids of this connector that were offered to the call. */
    availableIds: string[];
    declaredReadOnly: boolean | undefined;
  },
): Promise<string | null> {
  const { availableIds, declaredReadOnly, route } = input;
  // An agent-linked connection takes changes from its own agent (another path) or a granted bot with a write grant.
  const changeAllowed = (row: {
    agentBotId: string | null;
    writesEnabled: boolean;
    botAccess: { canWrite: boolean }[];
  }) =>
    row.agentBotId === null ||
    (row.agentBotId !== input.bot.id && nonOwnerMayWrite(row, input.bot));
  if (availableIds.length === 0) return null;
  const currentConnections = await prisma.connection.findMany({
    where: {
      id: { in: availableIds },
      spaceId: input.spaceId,
      userId: input.userId,
      connectorId: route.connectorId,
    },
    select: {
      id: true,
      connectorId: true,
      provider: true,
      status: true,
      allAgents: true,
      agentBotId: true,
      writesEnabled: true,
      privateByDefault: true,
      botAccess: {
        where: { botId: input.bot.id, spaceId: input.spaceId, userId: input.userId },
        select: { botId: true, canWrite: true },
      },
    },
  });
  const deniedCurrentIds = deniedConnectionIds(
    connectionRowsForAudience(currentConnections, input.bot.audience, input.bot.firewall),
  );
  if (route.connectionId) {
    const current = currentConnections.find((connection) => connection.id === route.connectionId);
    if (
      current?.status !== "connected" ||
      deniedCurrentIds.has(current.id) ||
      (declaredReadOnly !== true && !changeAllowed(current))
    ) {
      return CONNECTION_UNAVAILABLE_MESSAGE;
    }
    return null;
  }
  const connected = currentConnections.filter((connection) => connection.status === "connected");
  if (
    currentConnections.length !== availableIds.length ||
    connected.length !== currentConnections.length ||
    deniedCurrentIds.size > 0 ||
    (declaredReadOnly !== true && connected.some((connection) => !changeAllowed(connection)))
  ) {
    return CONNECTION_UNAVAILABLE_MESSAGE;
  }
  return null;
}
