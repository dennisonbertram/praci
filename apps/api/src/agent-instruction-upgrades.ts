import type { PrismaClient } from "@rakazo/db";
import { isPastDefault } from "./agent-default-history.js";
import { CARTA_AGENT } from "./carta-agent.js";
import { COMPANY_AGENT, COMPANY_IMPORTER } from "./company-agent.js";
import { DATA_ROOM_AGENT } from "./data-room-agent.js";
import { FINANCE_AGENT } from "./finance-agent.js";
import { GTM_AGENT } from "./gtm-agent.js";
import { INBOX_AGENT } from "./inbox-agent.js";
import { INVESTORS_AGENT } from "./investors-agent.js";
import { LEGAL_AGENT } from "./legal-agent.js";
import type { BuiltInAgent } from "./page-agent-ensure.js";
import { SCANNER_AGENT } from "./scanner-agent.js";

/**
 * Every built-in agent with a default text; the one table the ensure functions, the startup upgrade
 * and the upgrade notice all read. Earlier defaults are hashes in agent-default-history.ts. Integration
 * and mail-thread agents are not listed: their text is built per connection or per thread.
 */
export const BUILT_IN_AGENTS: BuiltInAgent[] = [
  INBOX_AGENT,
  CARTA_AGENT,
  COMPANY_AGENT,
  COMPANY_IMPORTER,
  DATA_ROOM_AGENT,
  FINANCE_AGENT,
  GTM_AGENT,
  INVESTORS_AGENT,
  LEGAL_AGENT,
  SCANNER_AGENT,
];

/**
 * Upgrades every active built-in agent, in every space, whose instructions still equal an earlier
 * default recorded by hash in agent-default-history.ts.
 * Each row is replaced only while its stored text is still the text that was read, so an edited
 * agent is never touched and several API processes running this at once are harmless. Returns the
 * count per kind.
 */
export async function upgradeBuiltInAgentInstructions(
  prisma: Pick<PrismaClient, "bot">,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const { kind, spawnKey, instructions } of BUILT_IN_AGENTS) {
    counts[kind] = 0;
    const bots = await prisma.bot.findMany({
      where: {
        archivedAt: null,
        spawnKey: { startsWith: spawnKey("") },
        instructions: { not: instructions },
      },
      select: { id: true, instructions: true },
    });
    for (const bot of bots) {
      if (!isPastDefault(kind, bot.instructions)) continue;
      const { count } = await prisma.bot.updateMany({
        where: { id: bot.id, instructions: bot.instructions },
        data: { instructions },
      });
      counts[kind] += count;
    }
  }
  return counts;
}
