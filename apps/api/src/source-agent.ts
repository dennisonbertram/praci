import { ORPCError } from "@orpc/server";
import type { Actor, Bot, CapabilityInstall } from "@rakazo/contracts";
import {
  appAgentColor,
  integrationAgentSpawnKey,
  integrationPresetForEndpoint,
} from "@rakazo/contracts";
import { sourceAccessFor } from "@rakazo/core";
import type { createRepos, PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { lockLiveBot } from "./bot-lock.js";
import { instructions } from "./integration-agent.js";

/** Directly connected sources: the installs that have tools, as opposed to skills and plugins. */
export const SOURCE_KINDS = ["mcp", "api", "graphql"];

type Prisma = Pick<PrismaClient, "capabilityInstall" | "botSourceAccess" | "bot" | "$transaction">;
export type SourceAgentDeps = {
  prisma: Prisma;
  repos: Pick<ReturnType<typeof createRepos>, "createBot">;
  /** Archives a bot this call created when it could not be linked. */
  archiveBot: (botId: string) => Promise<void>;
};

const scope = (actor: Actor, id?: string) => ({
  ...(id ? { id } : {}),
  spaceId: actor.spaceId,
  userId: actor.userId,
});

const withAccess = { botAccess: { select: { botId: true, canWrite: true } } } as const;

async function loadSource(prisma: Pick<Prisma, "capabilityInstall">, actor: Actor, id: string) {
  const row = await prisma.capabilityInstall.findFirst({
    where: { ...scope(actor, id), kind: { in: SOURCE_KINDS } },
    include: withAccess,
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Source not found" });
  return row;
}

type SourceRow = Awaited<ReturnType<typeof loadSource>>;
type ListedBot = { id: string; audience: string; firewall: boolean };

/** The install as the web sees it, with who can really use it (judged by the same rule the run uses). */
export function capabilityDto(row: SourceRow, bots: ListedBot[] = []): CapabilityInstall {
  const isSource = SOURCE_KINDS.includes(row.kind);
  const usable = bots.filter((bot) => sourceAccessFor(row, bot).read);
  return {
    id: row.id,
    kind: row.kind as CapabilityInstall["kind"],
    name: row.name,
    source: row.source,
    version: row.version,
    digest: row.digest,
    secretConfigured: Boolean(row.secretId),
    config: row.config as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    ...(isSource
      ? {
          agentBotId: row.agentBotId,
          allAgents: row.allAgents,
          agentShared: row.agentShared,
          writesEnabled: row.writesEnabled,
          usableBotIds: usable.map((bot) => bot.id),
          writeBotIds: usable
            .filter((bot) => bot.id !== row.agentBotId)
            .filter(
              (bot) =>
                row.botAccess.find((entry) => entry.botId === bot.id)?.canWrite ?? row.allAgents,
            )
            .map((bot) => bot.id),
        }
      : {}),
  };
}

export async function listCapabilities(deps: SourceAgentDeps, actor: Actor) {
  const [rows, bots] = await Promise.all([
    deps.prisma.capabilityInstall.findMany({
      where: scope(actor),
      include: withAccess,
      orderBy: { createdAt: "asc" },
    }),
    deps.prisma.bot.findMany({
      where: { ...scope(actor), archivedAt: null },
      select: { id: true, audience: true, firewall: true },
    }),
  ]);
  return rows.map((row) => capabilityDto(row, bots as ListedBot[]));
}

/** The default text of a source's agent: the single source for creation and upgrade. */
export const sourceAgentInstructions = (name: string, source: string) =>
  instructions(name, integrationPresetForEndpoint(source)?.instructions);

/**
 * Creates (or finds) the source's own agent and links it. Idempotent across processes: createBot
 * returns the existing bot for the spawn key. A source starts private to its agent and read-only
 * unless it already had an open policy (existing sources), which the link leaves as it is.
 */
export async function ensureSourceAgent(
  deps: SourceAgentDeps,
  actor: Actor,
  installId: string,
): Promise<{ install: SourceRow; bot: Bot }> {
  const initial = await loadSource(deps.prisma, actor, installId);
  const spawnKey = integrationAgentSpawnKey(initial.id);
  const preset = integrationPresetForEndpoint(initial.source);
  const link = (bot: Bot) =>
    deps.prisma.$transaction(async (tx) => {
      // The bot row is touched first, so an archive either lands before (no link) or after.
      if (!(await lockLiveBot(tx, actor, bot.id))) return null;
      const linked = await tx.capabilityInstall.updateMany({
        where: {
          ...scope(actor, installId),
          kind: { in: SOURCE_KINDS },
          OR: [{ agentBotId: null }, { agentBotId: bot.id }],
        },
        data: { agentBotId: bot.id },
      });
      if (!linked.count)
        throw new ORPCError("CONFLICT", { message: "The source already has an agent" });
      const current = await tx.capabilityInstall.findFirstOrThrow({
        where: scope(actor, installId),
        include: withAccess,
      });
      // A rename that landed while the agent was made would otherwise leave the old name.
      await tx.bot.updateMany({
        where: { id: bot.id, ...scope(actor) },
        data: { name: `${current.name} agent` },
      });
      return current;
    });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existed = Boolean(
      await deps.prisma.bot.findFirst({
        where: { ...scope(actor), spawnKey, archivedAt: null },
        select: { id: true },
      }),
    );
    const bot = await deps.repos.createBot(actor, {
      spawnKey,
      name: `${initial.name} agent`,
      title: "",
      description: preset?.description ?? `Your ${initial.name} tools`,
      instructions: sourceAgentInstructions(initial.name, initial.source),
      notifyOnFinish: true,
      color: appAgentColor([initial.name], spawnKey),
    });
    const install = await link(bot).catch(async (error) => {
      if (!existed) await deps.archiveBot(bot.id).catch(() => undefined);
      throw error;
    });
    if (install) return { install, bot };
  }
  throw new ORPCError("CONFLICT", {
    message: "The agent was archived while it was created; retry",
  });
}

/** Best effort, for install: a failure leaves the source private with no agent; Create agent repairs it. */
export async function provisionSourceAgent(deps: SourceAgentDeps, actor: Actor, installId: string) {
  try {
    await ensureSourceAgent(deps, actor, installId);
  } catch (error) {
    getLogger().error("source agent provisioning failed", error, { installId });
  }
}

/**
 * Backfill for sources that have no agent yet. Safe to repeat: a source whose agent was archived
 * by its owner keeps the retired spawn key and is skipped, and ensureSourceAgent reuses a live one.
 */
export async function provisionMissingSourceAgents(deps: SourceAgentDeps, actor: Actor) {
  const missing = await deps.prisma.capabilityInstall.findMany({
    where: { ...scope(actor), kind: { in: SOURCE_KINDS }, agentBotId: null },
    select: { id: true },
  });
  if (missing.length === 0) return;
  const retired = new Set(
    (
      await deps.prisma.bot.findMany({
        where: {
          ...scope(actor),
          spawnKey: { in: missing.map((row) => integrationAgentSpawnKey(row.id)) },
          archivedAt: { not: null },
        },
        select: { spawnKey: true },
      })
    ).map((bot) => bot.spawnKey),
  );
  // Retired sources are left out before the cap, so they cannot crowd out ones that need an agent.
  for (const row of missing
    .filter((entry) => !retired.has(integrationAgentSpawnKey(entry.id)))
    .slice(0, 10))
    await provisionSourceAgent(deps, actor, row.id);
}

/** Runs the change on the source's row under a lock, with the agent still active. */
async function mutate(
  prisma: Prisma,
  actor: Actor,
  id: string,
  change: (tx: Prisma, row: SourceRow) => Promise<void>,
) {
  await prisma.$transaction(async (tx) => {
    await (tx as unknown as PrismaClient)
      .$queryRaw`SELECT id FROM capability_installs WHERE id = ${id} FOR UPDATE`;
    const row = await loadSource(tx, actor, id);
    await change(tx, row);
  });
  return loadSource(prisma, actor, id);
}

const requireAgent = (row: SourceRow) => {
  if (!row.agentBotId) throw new ORPCError("BAD_REQUEST", { message: "This source has no agent" });
  return row.agentBotId;
};

export const setSourceWrites = (prisma: Prisma, actor: Actor, id: string, enabled: boolean) =>
  mutate(prisma, actor, id, async (tx, row) => {
    requireAgent(row);
    await tx.capabilityInstall.update({ where: { id }, data: { writesEnabled: enabled } });
  });

/** Only the source's agent may use it (exclusive), or other agents may be added one by one. */
export const setSourceExclusive = (prisma: Prisma, actor: Actor, id: string, exclusive: boolean) =>
  mutate(prisma, actor, id, async (tx, row) => {
    requireAgent(row);
    await tx.capabilityInstall.update({
      where: { id },
      data: { allAgents: false, agentShared: !exclusive },
    });
    // Sharing starts with every other agent off, not with grants left from an earlier share.
    await tx.botSourceAccess.deleteMany({ where: { installId: id } });
  });

/** All: every internal agent, including ones made later. None: only the source's own agent. */
export const setSourceAllAgents = (prisma: Prisma, actor: Actor, id: string, on: boolean) =>
  mutate(prisma, actor, id, async (tx, row) => {
    requireAgent(row);
    await tx.capabilityInstall.update({
      where: { id },
      data: { allAgents: on, agentShared: true },
    });
    if (!on) await tx.botSourceAccess.deleteMany({ where: { installId: id } });
  });

/** One agent's switch and its "Allow changes". Only that agent's grant changes. */
export const setSourceAgentAccess = (
  prisma: Prisma,
  actor: Actor,
  input: { id: string; botId: string; on: boolean; canWrite?: boolean },
) =>
  mutate(prisma, actor, input.id, async (tx, row) => {
    const ownerId = requireAgent(row);
    if (input.botId === ownerId) return; // the source's own agent always keeps access
    const bots = await tx.bot.findMany({
      where: { ...scope(actor), archivedAt: null },
      select: { id: true, audience: true, firewall: true },
    });
    const target = bots.find((bot) => bot.id === input.botId);
    if (!target) throw new ORPCError("NOT_FOUND", { message: "Agent not found" });
    if (input.on && (target.audience === "external" || target.firewall))
      throw new ORPCError("BAD_REQUEST", { message: "This agent cannot use sources" });
    // Under "all agents" one agent cannot differ, so the grants are written out first.
    if (row.allAgents) {
      await tx.botSourceAccess.createMany({
        data: bots
          .filter((bot) => bot.id !== ownerId && bot.audience !== "external" && !bot.firewall)
          .map((bot) => ({
            installId: row.id,
            botId: bot.id,
            ...scope(actor),
            canWrite: row.writesEnabled,
          })),
        skipDuplicates: true,
      });
    }
    await tx.capabilityInstall.update({
      where: { id: row.id },
      data: { allAgents: false, agentShared: true },
    });
    if (!input.on) {
      await tx.botSourceAccess.deleteMany({ where: { installId: row.id, botId: input.botId } });
      return;
    }
    await tx.botSourceAccess.upsert({
      where: { installId_botId: { installId: row.id, botId: input.botId } },
      create: {
        installId: row.id,
        botId: input.botId,
        ...scope(actor),
        canWrite: input.canWrite ?? false,
      },
      update: input.canWrite === undefined ? {} : { canWrite: input.canWrite },
    });
  });

/**
 * Renames the source, then its agent. The agent is renamed after the source's row lock is gone,
 * so no path takes the bot row inside that lock (archive and provisioning take the bot first).
 * Provisioning reads the current name when it links, so a race still ends with matching names.
 */
export async function renameSource(prisma: Prisma, actor: Actor, id: string, name: string) {
  await mutate(prisma, actor, id, async (tx) => {
    await tx.capabilityInstall.update({ where: { id }, data: { name } });
  });
  const row = await loadSource(prisma, actor, id);
  if (row.agentBotId)
    await prisma.bot.updateMany({
      where: { id: row.agentBotId, ...scope(actor) },
      data: { name: `${row.name} agent` },
    });
  return row;
}
