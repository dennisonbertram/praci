import type { Actor, Bot } from "@rakazo/contracts";
import type { createRepos, PrismaClient } from "@rakazo/db";
import { isPastDefault } from "./agent-default-history.js";

/**
 * One built-in agent: what a fresh one is created with and what an old one is upgraded to. The
 * list of these is BUILT_IN_AGENTS in agent-instruction-upgrades.ts; earlier instruction defaults
 * live only as hashes in agent-default-history.ts, under `kind`.
 * When contracts gains a page-agent registry, `kind`, `spawnKey` and `color` come from it.
 */
export type BuiltInAgent = {
  kind: string;
  spawnKey: (userId: string) => string;
  name: string;
  title?: string;
  description: string;
  instructions: string;
  color?: string;
  /** The description an earlier version shipped; a stored agent still holding it gets `description`. */
  pastDescription?: string;
  /** Creation-only settings such as the model or computer mode. */
  create?: Partial<Pick<Bot, "computerMode" | "modelProvider" | "modelId" | "thinkingLevel">>;
};

type Deps = {
  repos: Pick<ReturnType<typeof createRepos>, "createBot" | "replaceBotInstructions">;
  /** Needs `bot` only for an agent with a `pastDescription`; other tables are the caller's. */
  prisma?: { bot?: Pick<PrismaClient["bot"], "updateMany">; [table: string]: unknown };
};

/**
 * The only way a built-in agent is created. The unique (spaceId, spawnKey) index makes it
 * idempotent across API processes (createBot returns the existing bot when it loses a race). No
 * intro run is queued, so an unused thread costs nothing. A stored agent still on an old default
 * description or instructions is moved to the current one; an edited one is never touched.
 * `prepare` runs once the bot exists, before the description and instructions are refreshed.
 */
export async function ensurePageAgent(
  deps: Deps,
  actor: Actor,
  agent: BuiltInAgent,
  prepare?: (bot: Bot) => Promise<unknown>,
): Promise<Bot> {
  let bot = await deps.repos.createBot(actor, {
    spawnKey: agent.spawnKey(actor.userId),
    name: agent.name,
    title: agent.title ?? "",
    description: agent.description,
    instructions: agent.instructions,
    notifyOnFinish: true,
    ...(agent.color ? { color: agent.color } : {}),
    ...agent.create,
  });
  await prepare?.(bot);
  if (agent.pastDescription && deps.prisma?.bot) {
    const refreshed = await deps.prisma.bot.updateMany({
      where: {
        id: bot.id,
        spaceId: actor.spaceId,
        userId: actor.userId,
        description: agent.pastDescription,
      },
      data: { description: agent.description },
    });
    if (refreshed?.count) bot = { ...bot, description: agent.description };
  }
  if (!isPastDefault(agent.kind, bot.instructions)) return bot;
  await deps.repos.replaceBotInstructions(actor, bot.id, {
    from: bot.instructions,
    to: agent.instructions,
  });
  return { ...bot, instructions: agent.instructions };
}
