import { ORPCError } from "@orpc/server";
import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { runContinueJob } from "@rakazo/adapter-kit";
import type { DataRoomAi } from "@rakazo/adapters";
import { toLegalContract, toLegalDeadline } from "@rakazo/adapters";
import type { Actor, Bot, LegalGraph, LegalOverview } from "@rakazo/contracts";
import { LEGAL_AGENT_MODEL, LEGAL_SCAN_ROUTINE_NAME } from "@rakazo/contracts";
import { connectionRowsForAudience, deniedConnectionIds } from "@rakazo/core";
import type { createRepos, PrismaClient } from "@rakazo/db";
import { createLegalRepos, IsolationError, LEGAL_NOT_LEGAL_TYPE } from "@rakazo/db";
import { createDataRoomService } from "./data-room.js";
import { ensureLegalAgent, ensureLegalRoutine, lockLegalBot } from "./legal-agent.js";

export interface LegalDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
  artifacts: ArtifactStore;
  repos: Pick<ReturnType<typeof createRepos>, "createBot">;
  /** The Data Room AI resolver for the Legal agent's own model (not the space default). */
  resolveAi: (actor: Actor, botId: string) => Promise<DataRoomAi>;
}

const scope = (actor: Actor) => ({ spaceId: actor.spaceId, userId: actor.userId });
const today = () => new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
const notFound = () => new ORPCError("NOT_FOUND", { message: "Not found" });

/** Idempotent: creates the Legal agent and its daily scan routine; returns the bot. */
export const legalAgent = (deps: LegalDeps, actor: Actor): Promise<Bot> =>
  ensureLegalAgent(deps, actor);

/** Open deadlines due within `days` days, overdue ones included. */
export const legalDueSoonCount = (
  deps: Pick<LegalDeps, "prisma">,
  actor: Actor,
  days: number,
): Promise<number> =>
  deps.prisma.legalDeadline.count({
    where: {
      ...scope(actor),
      status: "open",
      dueDate: { lte: new Date(today().getTime() + days * 86_400_000) },
    },
  });

/** Connections the Legal agent may not use; the scan skips their documents, so the page does not count them. */
async function deniedForLegal(deps: Pick<LegalDeps, "prisma">, actor: Actor, bot: Bot) {
  const rows = await deps.prisma.connection.findMany({
    where: scope(actor),
    select: {
      id: true,
      connectorId: true,
      provider: true,
      status: true,
      allAgents: true,
      agentBotId: true,
      privateByDefault: true,
      botAccess: { where: { botId: bot.id }, select: { botId: true } },
    },
  });
  return [...deniedConnectionIds(connectionRowsForAudience(rows, bot.audience))];
}

export async function legalOverview(deps: LegalDeps, actor: Actor): Promise<LegalOverview> {
  const repo = createLegalRepos(deps.prisma);
  const now = today();
  // Creating the agent here means the first load already knows its model.
  const bot = await ensureLegalAgent(deps, actor);
  const [contracts, openDeadlines, counts, unreviewed] = await Promise.all([
    repo.listContracts(actor, { limit: 500 }),
    repo.listDeadlines(actor, { status: "open", limit: 500 }),
    repo.deadlineCounts(actor, now),
    deniedForLegal(deps, actor, bot).then((denied) => repo.countUnreviewed(actor, denied)),
  ]);
  const lastScan = await deps.prisma.run.findFirst({
    where: { botId: bot.id, trigger: "routine", status: "completed" },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });
  const latestRun = await deps.prisma.run.findFirst({
    where: { botId: bot.id, trigger: "routine" },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, error: true },
  });
  // Paused from the Routines page; the page then says the daily scan is paused.
  const scanRoutine = await deps.prisma.routine.findFirst({
    where: {
      botId: bot.id,
      spaceId: actor.spaceId,
      userId: actor.userId,
      name: LEGAL_SCAN_ROUTINE_NAME,
    },
    select: { active: true },
  });
  // The same resolution path a run uses: the bot's own model if the user has its credential, else the default.
  const resolved = (await deps.resolveAi(actor, bot.id).catch(() => null))?.model;
  const titles = new Map(contracts.map((c) => [c.id, c.title]));
  const next = new Map<string, string>();
  for (const d of openDeadlines) {
    // Deadlines are sorted by date, so the first one seen for a contract is its next one.
    if (d.contractId && !next.has(d.contractId)) {
      next.set(d.contractId, d.dueDate.toISOString().slice(0, 10));
    }
  }
  const isPreferred =
    resolved?.provider === LEGAL_AGENT_MODEL.provider && resolved.id === LEGAL_AGENT_MODEL.id;
  return {
    contracts: contracts.map((c) => toLegalContract(c, next.get(c.id) ?? null)),
    deadlines: openDeadlines.map((d) =>
      toLegalDeadline(d, d.contractId ? (titles.get(d.contractId) ?? null) : null),
    ),
    counts: {
      contracts: contracts.length,
      activeContracts: contracts.filter((c) => c.status === "active").length,
      ...counts,
      unreviewedDocuments: unreviewed,
    },
    agent: {
      botId: bot.id,
      lastScanAt: lastScan?.completedAt?.toISOString() ?? null,
      dailyScanActive: scanRoutine?.active ?? false,
      lastScanRun: latestRun
        ? {
            id: latestRun.id,
            status:
              latestRun.status === "completed" ||
              latestRun.status === "failed" ||
              latestRun.status === "cancelled"
                ? latestRun.status
                : "running",
            error: latestRun.status === "failed" ? latestRun.error : null,
          }
        : null,
    },
    model: resolved ? { provider: resolved.provider, id: resolved.id, isPreferred } : null,
  };
}

/** SAFEs found in the Data room. Reads only; the agent and its scan routine are not created. */
export async function legalSafeCount(deps: Pick<LegalDeps, "prisma">, actor: Actor) {
  const contracts = await createLegalRepos(deps.prisma).listContracts(actor, { limit: 500 });
  return { count: contracts.filter((c) => /\bsafe\b/i.test(c.contractType)).length };
}

/** What deleting this Data room item would also remove from Legal. Reads only; the agent is not created. */
export async function legalItemLinks(
  deps: Pick<LegalDeps, "prisma">,
  actor: Actor,
  itemId: string,
) {
  const contract = await deps.prisma.legalContract.findFirst({
    where: { ...scope(actor), dataRoomItemId: itemId, contractType: { not: LEGAL_NOT_LEGAL_TYPE } },
    select: { id: true, title: true },
  });
  if (!contract) return { contractTitle: null, deadlines: 0 };
  const deadlines = await deps.prisma.legalDeadline.count({
    where: { ...scope(actor), contractId: contract.id },
  });
  return { contractTitle: contract.title, deadlines };
}

export async function legalGraph(deps: LegalDeps, actor: Actor): Promise<LegalGraph> {
  const { nodes, edges } = await createLegalRepos(deps.prisma).graph(actor);
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: n.kind as LegalGraph["nodes"][number]["kind"],
      label: n.label,
      attrs: (n.attrs as Record<string, unknown> | null) ?? null,
      contractId: n.contractId,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      fromId: e.fromId,
      toId: e.toId,
      relation: e.relation,
      dataRoomItemId: e.dataRoomItemId,
      sourceQuote: e.sourceQuote,
    })),
  };
}

/** Deadlines the user marked done, latest due date first. */
export async function legalDoneDeadlines(deps: LegalDeps, actor: Actor) {
  const repo = createLegalRepos(deps.prisma);
  const [rows, contracts] = await Promise.all([
    repo.listDeadlines(actor, { status: "done", limit: 200, newestFirst: true }),
    repo.listContracts(actor, { limit: 500 }),
  ]);
  const titles = new Map(contracts.map((c) => [c.id, c.title]));
  return rows
    .map((d) => toLegalDeadline(d, d.contractId ? (titles.get(d.contractId) ?? null) : null))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
}

export async function legalUpdateDeadline(
  deps: LegalDeps,
  actor: Actor,
  input: { id: string; status?: string; notes?: string | null; keep?: boolean },
) {
  try {
    const row = await createLegalRepos(deps.prisma).updateDeadline(actor, input.id, input);
    const title = row.contractId
      ? (
          await deps.prisma.legalContract.findFirst({
            where: { id: row.contractId, ...scope(actor) },
            select: { title: true },
          })
        )?.title
      : null;
    return toLegalDeadline(row, title ?? null);
  } catch (error) {
    if (error instanceof IsolationError) throw notFound();
    throw error;
  }
}

/** Queues one run of the daily scan prompt in the Legal agent's thread, unless one is already active. */
export async function legalScanNow(deps: LegalDeps, actor: Actor) {
  const bot = await ensureLegalAgent(deps, actor);
  const routine = await ensureLegalRoutine(deps, actor, bot.id);
  const threadId = bot.threadId;
  // The active-run check and the create share one per-bot lock, so two clicks make one run.
  const { run, existing } = await deps.prisma.$transaction(async (tx) => {
    await lockLegalBot(tx, bot.id);
    const active = await tx.run.findFirst({
      where: {
        botId: bot.id,
        routineId: routine.id,
        status: { in: ["queued", "leased", "running", "waiting_input", "waiting_takeover"] },
      },
      select: { id: true },
    });
    if (active) return { run: active, existing: true };
    const task = await tx.task.create({
      data: {
        ...scope(actor),
        botId: bot.id,
        threadId,
        prompt: routine.prompt,
        status: "queued",
      },
    });
    const created = await tx.run.create({
      data: {
        ...scope(actor),
        botId: bot.id,
        threadId,
        taskId: task.id,
        status: "queued",
        trigger: "routine",
        routineId: routine.id,
      },
      select: { id: true },
    });
    return { run: created, existing: false };
  });
  if (existing) return { runId: run.id, botId: bot.id };
  await deps.jobs.enqueue(runContinueJob(run.id));
  return { runId: run.id, botId: bot.id };
}

// ---- Data Room consent for the Legal agent's model ----

/**
 * The Data room's own consent logic, pointed at the Legal agent's model: one place checks the key and
 * version, writes the consent row, and re-queues items that were waiting for it. The re-queued jobs
 * still check consent for the space's default model themselves, so this grant for the Legal
 * agent's recipient never lets them send text anywhere else.
 */
async function legalDataRoom(deps: LegalDeps, actor: Actor) {
  const bot = await ensureLegalAgent(deps, actor);
  return createDataRoomService({
    prisma: deps.prisma,
    artifacts: deps.artifacts,
    jobs: deps.jobs,
    resolveAi: () => deps.resolveAi(actor, bot.id),
  });
}

/** Who would receive Data Room text when the Legal agent reads it, and whether the user allowed that. */
export async function legalConsent(deps: LegalDeps, actor: Actor) {
  return (await legalDataRoom(deps, actor)).consent(actor);
}

export async function legalConsentGrant(
  deps: LegalDeps,
  actor: Actor,
  input: { key: string; version: string },
) {
  return (await legalDataRoom(deps, actor)).consentGrant(actor, input);
}
