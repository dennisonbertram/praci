import type { GoalEvidenceEntry } from "@rakazo/core";
import { parseGoalEvidence } from "@rakazo/core";
import type { PrismaClient } from "./client.js";

const LOOKBACK_RUNS = 5;
const MAX_STOPPED_RUNS = 3;

export type StoppedWork = {
  /** Finished calls of each stopped run, oldest run first. */
  runs: GoalEvidenceEntry[][];
  /** A stopped run was restricted at run level (outside content in its prompt, firewall): no note. */
  restricted: boolean;
  /** The continuing run must start as if it had already read these. */
  readOutsideContent: boolean;
  readDesktop: boolean;
};

/**
 * What runs the owner stopped had finished, for the turn that continues them. Only runs since the
 * last completed one count: that run already acted on what came before it. Scoped to the same
 * space, user, thread and bot as the run asking. The restriction markers come from the columns
 * written when they were set, never from the capped tool log, which trims.
 */
export async function loadStoppedRunWork(
  prisma: Pick<PrismaClient, "run">,
  input: {
    spaceId: string;
    threadId: string;
    botId: string;
    userId: string;
    runId: string;
    before: Date;
  },
): Promise<StoppedWork> {
  const rows = await prisma.run.findMany({
    where: {
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      userId: input.userId,
      id: { not: input.runId },
      createdAt: { lt: input.before },
      status: { in: ["cancelled", "completed"] },
    },
    orderBy: { createdAt: "desc" },
    take: LOOKBACK_RUNS,
    select: {
      status: true,
      goalEvidence: true,
      externalTaint: true,
      readOutsideContent: true,
      readDesktop: true,
    },
  });
  const work: StoppedWork = {
    runs: [],
    restricted: false,
    readOutsideContent: false,
    readDesktop: false,
  };
  for (const row of rows) {
    if (row.status === "completed") break;
    const log = parseGoalEvidence(row.goalEvidence);
    if (log.length === 0) continue;
    work.runs.push(log);
    work.restricted ||= row.externalTaint;
    work.readOutsideContent ||= row.readOutsideContent;
    work.readDesktop ||= row.readDesktop;
    if (work.runs.length === MAX_STOPPED_RUNS) break;
  }
  work.runs.reverse();
  return work;
}
