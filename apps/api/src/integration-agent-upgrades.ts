import {
  GRANOLA_API_CONNECTOR_ID,
  INTEGRATION_PRESETS,
  integrationAgentSpawnKey,
  integrationPresetForEndpoint,
  isBrexCardsEndpoint,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { connectedAppAgentInstructions, mcpServerAgentInstructions } from "./integration-agent.js";
import { isPastIntegrationDefault } from "./integration-agent-history.js";
import { SOURCE_KINDS, sourceAgentInstructions } from "./source-agent.js";

const presetKey = (endpoint: string | null | undefined) => {
  const preset = integrationPresetForEndpoint(endpoint);
  return Object.entries(INTEGRATION_PRESETS).find(([, p]) => p === preset)?.[0];
};

type Prisma = Pick<PrismaClient, "bot" | "mcpServer" | "connection" | "capabilityInstall">;
type Row = { spaceId: string; userId: string };

/** The current default for the agent behind an id, with what its past defaults were built from. */
export async function currentDefault(prisma: Prisma, bot: Row & { id: string }, id: string) {
  const own = { spaceId: bot.spaceId, userId: bot.userId };
  const server = await prisma.mcpServer.findFirst({
    where: { id, ...own },
    select: { endpoint: true, name: true },
  });
  if (server) {
    const preset = integrationPresetForEndpoint(server.endpoint);
    const keys = [presetKey(server.endpoint)].filter((k) => k !== undefined);
    let text = mcpServerAgentInstructions(server);
    // The Brex cards server shares this agent: creation appends its guidance once.
    const linked = await prisma.mcpServer.findMany({
      where: { agentBotId: bot.id, ...own },
      select: { endpoint: true },
    });
    if (linked.some((row) => isBrexCardsEndpoint(row.endpoint)) && keys[0] === "brex") {
      keys.push("brexCards");
      text = `${text} ${INTEGRATION_PRESETS.brexCards.instructions}`;
    }
    return { service: preset?.service ?? server.name, keys, text };
  }
  const connection = await prisma.connection.findFirst({
    where: { id, ...own },
    select: { connectorId: true, displayName: true, provider: true },
  });
  if (connection)
    return {
      service: connection.displayName || connection.provider,
      keys: connection.connectorId === GRANOLA_API_CONNECTOR_ID ? ["granola"] : [],
      text: connectedAppAgentInstructions(connection),
    };
  const source = await prisma.capabilityInstall.findFirst({
    where: { id, ...own, kind: { in: SOURCE_KINDS } },
    select: { name: true, source: true },
  });
  if (source)
    return {
      service: source.name,
      keys: [presetKey(source.source)].filter((k) => k !== undefined),
      text: sourceAgentInstructions(source.name, source.source),
    };
  return null;
}

/**
 * Upgrades every active integration agent (MCP server, connected app or source) whose instructions
 * are exactly a past default to the current default. Each row changes only while its stored text is
 * still the text that was read, so an edited agent is never touched and concurrent API processes are
 * harmless. Returns the number upgraded.
 */
export async function upgradeIntegrationAgentInstructions(prisma: Prisma): Promise<number> {
  const prefix = integrationAgentSpawnKey("");
  const bots = await prisma.bot.findMany({
    where: { archivedAt: null, spawnKey: { startsWith: prefix } },
    select: { id: true, spaceId: true, userId: true, spawnKey: true, instructions: true },
  });
  let upgraded = 0;
  for (const bot of bots) {
    const current = await currentDefault(
      prisma,
      bot,
      (bot.spawnKey as string).slice(prefix.length),
    );
    if (!current || bot.instructions === current.text) continue;
    if (!isPastIntegrationDefault(bot.instructions, current.service, current.keys)) continue;
    const { count } = await prisma.bot.updateMany({
      where: {
        id: bot.id,
        spaceId: bot.spaceId,
        userId: bot.userId,
        instructions: bot.instructions,
        archivedAt: null,
      },
      data: { instructions: current.text },
    });
    upgraded += count;
  }
  return upgraded;
}
