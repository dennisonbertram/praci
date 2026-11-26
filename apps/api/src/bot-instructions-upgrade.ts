import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
  integrationAgentSpawnKey,
  isCustomPageSpawnKey,
  isGtmAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isMailThreadAgentSpawnKey,
  NEW_PAGE_INSTRUCTIONS,
} from "@rakazo/contracts";
import { GTM_PAGE_INSTRUCTIONS } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { BUILT_IN_AGENTS } from "./agent-instruction-upgrades.js";
import { MAIL_THREAD_AGENT_INSTRUCTIONS } from "./inbox-thread-agent.js";
import { currentDefault } from "./integration-agent-upgrades.js";

type Prisma = Pick<PrismaClient, "bot" | "mcpServer" | "connection" | "capabilityInstall">;
type Scope = { spaceId: string; userId: string };
type BotRow = Scope & { id: string; spawnKey: string | null };

/**
 * The text a freshly made agent of this kind would get today, or null for an agent with no default
 * (one the owner made, or a voice agent whose text is code-owned and read live).
 */
export async function currentDefaultInstructions(
  prisma: Prisma,
  bot: BotRow,
): Promise<string | null> {
  const key = bot.spawnKey;
  if (!key) return null;
  const builtIn = BUILT_IN_AGENTS.find((agent) => key.startsWith(agent.spawnKey("")));
  if (builtIn) return builtIn.instructions;
  if (isIntegrationAgentSpawnKey(key))
    return (
      (await currentDefault(prisma, bot, key.slice(integrationAgentSpawnKey("").length)))?.text ??
      null
    );
  if (isMailThreadAgentSpawnKey(key)) return MAIL_THREAD_AGENT_INSTRUCTIONS;
  if (isCustomPageSpawnKey(key)) return NEW_PAGE_INSTRUCTIONS;
  return null;
}

/** The executor appends the GTM page guide to a stored GTM text that lacks it; compare as it will run. */
const asRun = (spawnKey: string | null, text: string) =>
  isGtmAgentSpawnKey(spawnKey) && !text.includes(GTM_PAGE_INSTRUCTIONS)
    ? `${text}\n\n${GTM_PAGE_INSTRUCTIONS}`.trim()
    : text;

const hash = (text: string) => createHash("sha256").update(text).digest("hex");

async function ownBot(prisma: Prisma, scope: Scope, botId: string) {
  const bot = await prisma.bot.findFirst({
    where: { id: botId, spaceId: scope.spaceId, userId: scope.userId, archivedAt: null },
    select: {
      id: true,
      spaceId: true,
      userId: true,
      spawnKey: true,
      instructions: true,
      instructionsUpgradeDismissedHash: true,
    },
  });
  if (!bot) throw new ORPCError("NOT_FOUND", { message: "Bot not found" });
  return bot;
}

/** The stored and default text when they differ and the owner has not kept their own over this default. */
export async function instructionsUpgrade(prisma: Prisma, scope: Scope, botId: string) {
  const bot = await ownBot(prisma, scope, botId);
  const next = await currentDefaultInstructions(prisma, bot);
  if (next === null) return null;
  if (asRun(bot.spawnKey, bot.instructions) === asRun(bot.spawnKey, next)) return null;
  if (bot.instructionsUpgradeDismissedHash === hash(next)) return null;
  return { current: bot.instructions, next };
}

/** Replaces the stored text with the default, only while it still equals what the owner reviewed. */
export async function upgradeInstructions(
  prisma: Prisma,
  scope: Scope,
  botId: string,
  from: string,
): Promise<void> {
  const bot = await ownBot(prisma, scope, botId);
  const next = await currentDefaultInstructions(prisma, bot);
  if (next === null) throw new ORPCError("BAD_REQUEST", { message: "This agent has no default" });
  const { count } = await prisma.bot.updateMany({
    where: { id: bot.id, spaceId: bot.spaceId, userId: bot.userId, instructions: from },
    data: { instructions: next },
  });
  if (count === 0)
    throw new ORPCError("CONFLICT", { message: "The instructions changed; review them again" });
}

/** Keeps the owner's text: the notice stays hidden until a different default ships. */
export async function dismissInstructionsUpgrade(prisma: Prisma, scope: Scope, botId: string) {
  const bot = await ownBot(prisma, scope, botId);
  const next = await currentDefaultInstructions(prisma, bot);
  if (next === null) return;
  await prisma.bot.updateMany({
    where: { id: bot.id, spaceId: bot.spaceId, userId: bot.userId },
    data: { instructionsUpgradeDismissedHash: hash(next) },
  });
}
