import type { JobPublisher } from "@rakazo/adapter-kit";
import { pipelineAutoStatusJob, pipelineImportJob, runContinueJob } from "@rakazo/adapter-kit";
import type { PipelineImportRow } from "@rakazo/contracts";
import {
  PIPELINE_IMPORT_REVIEW_TOOL,
  PIPELINE_IMPORT_STAGE_MAX,
  PIPELINE_IMPORT_STAGE_TOOL,
  PipelineImportRowSchema,
} from "@rakazo/contracts";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { applyNextPipelineImportRow } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

type Scope = { spaceId: string; userId: string };

export const PIPELINE_IMPORT_TOOL_NAMES: ReadonlySet<string> = new Set([
  PIPELINE_IMPORT_STAGE_TOOL,
  PIPELINE_IMPORT_REVIEW_TOOL,
]);

export const PIPELINE_IMPORT_REFUSED =
  "This run cannot import a list: it read outside content, or this agent is firewalled or external. Ask the owner to send the list to the Investors agent in a new chat.";

/** Models send null or "" for an empty cell; neither is a value, and neither should fail a row. */
function withoutEmpties(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutEmpties);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== null && item !== "")
      .map(([key, item]) => [key, withoutEmpties(item)]),
  );
}

/**
 * `pipeline_import_stage`: holds rows and changes nothing else, so it needs no approval. A row is
 * data: it parses against a schema with no kind, id, round or amount, and a bad row is reported on
 * its own. Repeating a call changes nothing.
 */
export async function stagePipelineImportFromTool(
  deps: {
    events: Pick<ThreadEvents, "stagePipelineImportRows">;
    jobs: Pick<JobPublisher, "enqueue">;
    /** From the run, never from model input. */
    scope: Scope;
    runId: string;
    botId: string;
  },
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const raw = Array.isArray(args.rows) ? args.rows : [];
  if (raw.length === 0) return { error: "Pass rows: a list of prospects." };
  if (raw.length > PIPELINE_IMPORT_STAGE_MAX) {
    return {
      error: `At most ${PIPELINE_IMPORT_STAGE_MAX} rows per call; you passed ${raw.length}. Split the list and call again.`,
    };
  }
  const rows: PipelineImportRow[] = [];
  const failed: { row: number; firm: string; reason: string }[] = [];
  raw.forEach((item, index) => {
    const parsed = PipelineImportRowSchema.safeParse(withoutEmpties(item));
    if (parsed.success) {
      rows.push(parsed.data);
      return;
    }
    const firm = (item as { firm?: unknown } | null)?.firm;
    failed.push({
      row: index + 1,
      firm: typeof firm === "string" ? firm.slice(0, 200) : "",
      reason: parsed.error.issues[0]?.message ?? "Invalid row.",
    });
  });
  try {
    const staged = await deps.events.stagePipelineImportRows(deps.scope, {
      runId: deps.runId,
      botId: deps.botId,
      start: args.start === true,
      rows,
    });
    if (staged.resumeRunId) {
      await deps.jobs
        .enqueue(runContinueJob(staged.resumeRunId))
        .catch((error) => getLogger().error("pipeline import replaced card wake", error));
    }
    return {
      staged: staged.staged,
      added: staged.added,
      failed: [...failed, ...staged.rejected.map((row) => ({ row: 0, ...row }))],
    };
  } catch (error) {
    getLogger().error("pipeline import stage", error);
    return { error: "Could not stage these rows." };
  }
}

/** Applies an import's queued rows, then settles it. Safe to run twice at once and to run again. */
export async function runPipelineImport(
  deps: {
    prisma: PrismaClient;
    jobs: Pick<JobPublisher, "enqueue">;
    events: Pick<ThreadEvents, "settlePipelineImport">;
  },
  payload: Scope & { importId: string },
): Promise<void> {
  const scope = { spaceId: payload.spaceId, userId: payload.userId };
  while (await applyNextPipelineImportRow(deps.prisma, scope, payload.importId));
  // Fresh rows deserve a status pass now; the next sweep would wait up to 30 minutes.
  await deps.jobs
    .enqueue(pipelineAutoStatusJob(scope))
    .catch((error) => getLogger().error("pipeline auto-status enqueue", error));
  const { resumeRunId } = await deps.events.settlePipelineImport(payload);
  if (resumeRunId) {
    // The queued run is durable; a missed wake is repaired by the reconciler.
    await deps.jobs
      .enqueue(runContinueJob(resumeRunId))
      .catch((error) => getLogger().error("pipeline import wake", error));
  }
}

/** A worker died with rows queued, or before settling: queue the import's job again. */
export async function reconcilePipelineImports(deps: {
  prisma: PrismaClient;
  jobs: JobPublisher;
  now: Date;
  batchSize: number;
  staleMs: number;
}): Promise<void> {
  const cutoff = new Date(deps.now.getTime() - deps.staleMs);
  const stale = await deps.prisma.pipelineImport.findMany({
    where: { status: "applying", updatedAt: { lte: cutoff } },
    orderBy: { updatedAt: "asc" },
    take: deps.batchSize,
    select: { id: true, spaceId: true, userId: true },
  });
  for (const row of stale) {
    await deps.jobs.enqueue({
      ...pipelineImportJob({ importId: row.id, spaceId: row.spaceId, userId: row.userId }),
      keepExisting: true,
      replaceLockedBefore: cutoff,
    });
  }
}
