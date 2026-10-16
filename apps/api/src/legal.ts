import { ORPCError } from "@orpc/server";
import type { JobPublisher } from "@rakazo/adapter-kit";
import { runContinueJob } from "@rakazo/adapter-kit";
import type { DataRoomAi } from "@rakazo/adapters";
import { toLegalContract, toLegalDeadline } from "@rakazo/adapters";
import type {
  Actor,
  Bot,
  DataRoomConsentStatus,
  LegalGraph,
  LegalOverview,
} from "@rakazo/contracts";
import {
  DATA_ROOM_DISCLOSURE,
  DATA_ROOM_DISCLOSURE_VERSION,
  LEGAL_AGENT_MODEL,
  legalAgentSpawnKey,
} from "@rakazo/contracts";
import type { createRepos, PrismaClient } from "@rakazo/db";
import { createLegalRepos, IsolationError } from "@rakazo/db";
import { ensureLegalAgent, ensureLegalRoutine } from "./legal-agent.js";

export interface LegalDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
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

export async function legalOverview(deps: LegalDeps, actor: Actor): Promise<LegalOverview> {
  const repo = createLegalRepos(deps.prisma);
  const now = today();
  const [contracts, openDeadlines, counts, unreviewed, bot] = await Promise.all([
    repo.listContracts(actor, { limit: 500 }),
    repo.listDeadlines(actor, { status: "open", limit: 500 }),
    repo.deadlineCounts(actor, now),
    repo.countUnreviewed(actor),
    deps.prisma.bot.findFirst({
      where: { ...scope(actor), spawnKey: legalAgentSpawnKey(actor.userId), archivedAt: null },
      select: { id: true },
    }),
  ]);
  const lastScan = bot
    ? await deps.prisma.run.findFirst({
        where: { botId: bot.id, trigger: "routine", status: "completed" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      })
    : null;
  // The same resolution path a run uses: the bot's own model if the user has its credential, else the default.
  const resolved = bot ? (await deps.resolveAi(actor, bot.id).catch(() => null))?.model : null;
  const titles = new Map(contracts.map((c) => [c.id, c.title]));
  const next = new Map<string, string>();
  for (const d of openDeadlines) {
    // Deadlines are sorted by date, so the first one seen for a contract is its next one.
    if (d.contractId && !next.has(d.contractId)) {
      next.set(d.contractId, d.dueDate.toISOString().slice(0, 10));
    }
  }
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
    agent: { botId: bot?.id ?? null, lastScanAt: lastScan?.completedAt?.toISOString() ?? null },
    model: resolved
      ? {
          provider: resolved.provider,
          id: resolved.id,
          isPreferred:
            resolved.provider === LEGAL_AGENT_MODEL.provider &&
            resolved.id === LEGAL_AGENT_MODEL.id,
        }
      : null,
  };
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

export async function legalUpdateDeadline(
  deps: LegalDeps,
  actor: Actor,
  input: { id: string; status?: string; notes?: string | null },
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
  const active = await deps.prisma.run.findFirst({
    where: {
      botId: bot.id,
      routineId: routine.id,
      status: { in: ["queued", "leased", "running", "waiting_input", "waiting_takeover"] },
    },
    select: { id: true },
  });
  if (active) return { runId: active.id, botId: bot.id };
  const run = await deps.prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        ...scope(actor),
        botId: bot.id,
        threadId,
        prompt: routine.prompt,
        status: "queued",
      },
    });
    return tx.run.create({
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
  });
  await deps.jobs.enqueue(runContinueJob(run.id));
  return { runId: run.id, botId: bot.id };
}

// ---- Data Room consent for the Legal agent's model ----

async function consentStatus(deps: LegalDeps, actor: Actor) {
  const bot = await ensureLegalAgent(deps, actor);
  const ai = await deps.resolveAi(actor, bot.id);
  const status: DataRoomConsentStatus = {
    key: ai.consentKey,
    version: DATA_ROOM_DISCLOSURE_VERSION,
    allowed: ai.allowed,
    disclosure: DATA_ROOM_DISCLOSURE,
    recipients: ai.recipients.map(({ name, detail }) => ({ name, detail })),
  };
  return { ai, status };
}

/** Who would receive Data Room text when the Legal agent reads it, and whether the user allowed that. */
export async function legalConsent(deps: LegalDeps, actor: Actor) {
  return (await consentStatus(deps, actor)).status;
}

/** Records consent for exactly the recipients shown, like dataRoom.consentGrant but without re-queueing items. */
export async function legalConsentGrant(
  deps: LegalDeps,
  actor: Actor,
  input: { key: string; version: string },
) {
  const { ai, status } = await consentStatus(deps, actor);
  if (!ai.recipients.length || input.key !== status.key || input.version !== status.version) {
    throw new ORPCError("CONFLICT", { message: "AI data sharing changed. Review it again." });
  }
  await deps.prisma.aiDataConsent.upsert({
    where: {
      userId_spaceId_recipientKey: {
        userId: actor.userId,
        spaceId: actor.spaceId,
        recipientKey: status.key,
      },
    },
    create: {
      userId: actor.userId,
      spaceId: actor.spaceId,
      recipientKey: status.key,
      version: status.version,
    },
    update: { version: status.version, grantedAt: new Date() },
  });
  return { ...status, allowed: true };
}
