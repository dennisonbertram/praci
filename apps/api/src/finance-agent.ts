import type { Actor, Bot } from "@rakazo/contracts";
import {
  actorScope,
  CRYPTO_READ_TOOLS,
  FINANCE_READ_TOOLS,
  financeAgentSpawnKey,
  financeProviderForEndpoint,
  isCryptoEndpoint,
  pageAgentColor,
} from "@rakazo/contracts";
import type { createRepos, PrismaClient } from "@rakazo/db";

const FINANCE_AGENT_INSTRUCTIONS =
  "You are the user's finance agent. You answer questions about their cash, spend, burn, runway and subscriptions from their connected Mercury and Brex accounts, uploaded bank statements and crypto wallets, and suggest where to cut costs. Start with the finance_overview, finance_breakdown, finance_transactions and finance_recurring tools: they read the synced data in one fast call and match the Finance page, with transfers between the user's own accounts and Brex card payments already left out. Use the Mercury and Brex tools only for details the sync does not have, such as receipts, memos, cards and bills. What counts as cash follows the runway scope the user saved (bank only, plus stablecoins, or plus all priced crypto); finance_overview reports it as cash.runwayCrypto and its cash and runway already use it, and lists every cash account in cash.accounts. Crypto never affects burn. Read wallets with finance_crypto and the finance-crypto skill. Compute totals with code, never in your head, and do not count Brex card payments and card purchases both. You can read but not move money, pay, categorize or change anything in Mercury or Brex; when asked to, say what you would change and let the user do it. Use the finance skills for cost cuts, runway scenarios, monthly reviews and categories.";
("You are the user's finance agent. You answer questions about their cash, spend, burn, runway and subscriptions from their connected Mercury and Brex accounts, and suggest where to cut costs. Read the data with the tools before answering, and compute totals with code, never in your head. Leave out transfers between the user's own accounts, and do not count Brex card payments and card purchases both. You can read but not move money, pay, categorize or change anything in Mercury or Brex; when asked to, say what you would change and let the user do it. Use the finance skills for cost cuts, runway scenarios, monthly reviews and categories.");

/**
 * Gives the bot each of the user's finance MCP servers with only the read tools. The list is written
 * on every call, so a wider list left by an older version is narrowed again. A bot a user also gave
 * other servers keeps those.
 */
export async function assignFinanceServers(
  prisma: Pick<PrismaClient, "mcpServer" | "botMcpServer">,
  actor: Actor,
  botId: string,
): Promise<void> {
  const servers = await prisma.mcpServer.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId, enabled: true },
    select: { id: true, endpoint: true },
  });
  for (const server of servers) {
    const provider = financeProviderForEndpoint(server.endpoint);
    // The Blockscout server is not a finance provider; it gets its own read-only tool list.
    if (!provider && !isCryptoEndpoint(server.endpoint)) continue;
    const allowedTools = provider ? [...FINANCE_READ_TOOLS[provider]] : [...CRYPTO_READ_TOOLS];
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

/** Matches the user's live Finance agent, found by its spawn key. */
export const financeAgentWhere = (actor: Actor) => ({
  ...actorScope(actor),
  spawnKey: financeAgentSpawnKey(actor.userId),
  archivedAt: null,
});

/** Gives the finance servers to the user's Finance agent when one already exists. */
export async function assignToExistingFinanceAgent(
  prisma: Pick<PrismaClient, "bot" | "mcpServer" | "botMcpServer">,
  actor: Actor,
): Promise<void> {
  const bot = await prisma.bot.findFirst({ where: financeAgentWhere(actor), select: { id: true } });
  if (bot) await assignFinanceServers(prisma, actor, bot.id);
}

/**
 * The only way a Finance agent is created. The unique (spaceId, spawnKey) index makes it idempotent
 * across API processes (createBot returns the existing bot when it loses a race). No intro run is
 * queued, so an unused thread costs nothing.
 */
export async function ensureFinanceAgent(
  deps: {
    prisma: Pick<PrismaClient, "mcpServer" | "botMcpServer">;
    repos: Pick<ReturnType<typeof createRepos>, "createBot">;
  },
  actor: Actor,
): Promise<Bot> {
  const bot = await deps.repos.createBot(actor, {
    spawnKey: financeAgentSpawnKey(actor.userId),
    name: "Finance agent",
    title: "",
    description: "Answers questions about your bank, card, statement and crypto accounts.",
    instructions: FINANCE_AGENT_INSTRUCTIONS,
    notifyOnFinish: true,
    color: pageAgentColor("finance"),
  });
  await assignFinanceServers(deps.prisma, actor, bot.id);
  return bot;
}
