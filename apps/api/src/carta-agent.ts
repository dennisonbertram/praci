import type { Actor, Bot } from "@rakazo/contracts";
import {
  actorScope,
  CARTA_READ_TOOLS,
  cartaAgentSpawnKey,
  isCartaEndpoint,
} from "@rakazo/contracts";
import type { createRepos, PrismaClient } from "@rakazo/db";

const CARTA_AGENT_INSTRUCTIONS =
  "You are the user's Carta agent. You manage their company's cap table and investor relationships from Carta, which you can read but never change. Keep the user's investor contacts up to date with the contacts_list and contacts_save tools. Draft investor updates and answer investor audit requests with the Gmail and Drive tools and the skills carta-investor-update and carta-audit-response; the finance_* tools give cash, burn and runway for updates. Never invent a figure: write TBD where you do not have one. Never sign anything in DocuSign and never confirm anything in an investor portal; tell the user what needs their signature. Send email only with the full to, cc, bcc, subject and body in the send call, after the user approves that exact message; every message needs its own approval.";

/**
 * Gives the bot each of the user's Carta MCP servers with only the read tools. The list is written
 * on every call, so a wider list left by an older version is narrowed again.
 */
export async function assignCartaServers(
  prisma: Pick<PrismaClient, "mcpServer" | "botMcpServer">,
  actor: Actor,
  botId: string,
): Promise<void> {
  const servers = await prisma.mcpServer.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId, enabled: true },
    select: { id: true, endpoint: true },
  });
  const allowedTools = [...CARTA_READ_TOOLS];
  for (const server of servers) {
    if (!isCartaEndpoint(server.endpoint)) continue;
    await prisma.botMcpServer.upsert({
      where: { botId_serverId: { botId, serverId: server.id } },
      create: {
        spaceId: actor.spaceId,
        userId: actor.userId,
        botId,
        serverId: server.id,
        allowAllTools: false,
        allowedTools,
      },
      update: { allowAllTools: false, allowedTools },
    });
  }
}

/** Matches the user's live Carta agent, found by its spawn key. */
export const cartaAgentWhere = (actor: Actor) => ({
  ...actorScope(actor),
  spawnKey: cartaAgentSpawnKey(actor.userId),
  archivedAt: null,
});

/** Gives the Carta servers to the user's Carta agent when one already exists. */
export async function assignToExistingCartaAgent(
  prisma: Pick<PrismaClient, "bot" | "mcpServer" | "botMcpServer">,
  actor: Actor,
): Promise<void> {
  const bot = await prisma.bot.findFirst({ where: cartaAgentWhere(actor), select: { id: true } });
  if (bot) await assignCartaServers(prisma, actor, bot.id);
}

/** The only way a Carta agent is created; idempotent through the unique (spaceId, spawnKey) index. */
export async function ensureCartaAgent(
  deps: {
    prisma: Pick<PrismaClient, "mcpServer" | "botMcpServer">;
    repos: Pick<ReturnType<typeof createRepos>, "createBot">;
  },
  actor: Actor,
): Promise<Bot> {
  const bot = await deps.repos.createBot(actor, {
    spawnKey: cartaAgentSpawnKey(actor.userId),
    name: "Carta agent",
    title: "",
    description: "Keeps your cap table and investor contacts, and drafts investor updates.",
    instructions: CARTA_AGENT_INSTRUCTIONS,
    notifyOnFinish: true,
  });
  await assignCartaServers(deps.prisma, actor, bot.id);
  return bot;
}
