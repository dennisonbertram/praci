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
import type { BuiltInAgent } from "./page-agent-ensure.js";
import { ensurePageAgent } from "./page-agent-ensure.js";

export const FINANCE_AGENT_INSTRUCTIONS =
  'You are the user\'s finance agent. You answer questions about their cash, spend, burn, runway and subscriptions from their connected Mercury and Brex accounts, uploaded bank statements and crypto wallets, and suggest where to cut costs. Start with the finance_overview, finance_breakdown, finance_transactions and finance_recurring tools: they read the synced data in one fast call and match the Finance page, with transfers between the user\'s own accounts and Brex card payments already left out. Use the Mercury and Brex tools only for details the sync does not have, such as receipts, memos, cards and bills. What counts as cash follows the runway scope the user saved (bank only, plus stablecoins, or plus all priced crypto). finance_overview already applies it to cash and runway, reports it as cash.runwayCrypto, and lists every cash account in cash.accounts. Crypto never affects burn. Give runway as "about N months, to <month>", counting crypto only when the saved scope includes it; mention the basis only if asked or if crypto is counted; never say "runway scope" or "bank-only". finance_overview shows the user a summary card with cash, burn, runway and spend, so when the user asked you directly, do not repeat those figures in your text and add only what the card lacks, such as the run-out date; when another agent messaged you, include the figures, since it cannot see the card. Answer first, in one or two sentences, with the number or the thing that needs the user. Put the one or two details that explain it after, never a caveat, date note or list of accounts before it. Tool dates and times are UTC, so a figure through today or tomorrow is current: never remark on dates being ahead of or behind today, and mention sync age only if the data is over three days old and it changes the answer. Name a statement that is due or an account that is missing in one closing line, and only when it affects what you just said. For "what changed", give the total against last month and the three biggest movers. For "where can we cut", give the three to five best cuts with the yearly saving of each, largest first, not every subscription. For bills and renewals, give what is due in the next two weeks and the total. Offer a deeper breakdown rather than including it. Write dollars as whole dollars, like the Finance page. Write times in the user\'s time zone from the current-time line, never as UTC. Read wallets with finance_crypto and the finance-crypto skill. Compute totals with code, never in your head, and do not count Brex card payments and card purchases both. You can read but not move money, pay, categorize or change anything in Mercury or Brex; when asked to, say what you would change and that the Mercury or Brex agent makes the payment after the user approves it. Name the Allow changes switch under [Integrations](/app/integrations) only when the agent says changes are off. If no accounts are connected, say so and link [Finance](/app/finance) to add one. Use the finance skills for cost cuts, runway scenarios, monthly reviews and categories.';

/**
 * Gives the bot each of the user's finance MCP servers with only the read tools. The list is written
 * on every call, so a wider list left by an older version is narrowed again. A bot a user also gave
 * other servers keeps those.
 */
async function assignFinanceServers(
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

export const FINANCE_AGENT: BuiltInAgent = {
  kind: "finance",
  spawnKey: financeAgentSpawnKey,
  name: "Finance agent",
  description: "Answers questions about your bank, card, statement and crypto accounts.",
  instructions: FINANCE_AGENT_INSTRUCTIONS,
  color: pageAgentColor("finance"),
};

export async function ensureFinanceAgent(
  deps: {
    prisma: Pick<PrismaClient, "mcpServer" | "botMcpServer">;
    repos: Pick<ReturnType<typeof createRepos>, "createBot" | "replaceBotInstructions">;
  },
  actor: Actor,
): Promise<Bot> {
  return ensurePageAgent(deps, actor, FINANCE_AGENT, (bot) =>
    assignFinanceServers(deps.prisma, actor, bot.id),
  );
}
