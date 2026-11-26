import type { JobPublisher } from "@rakazo/adapter-kit";
import { runContinueJob } from "@rakazo/adapter-kit";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import {
  claimDuePageSources,
  deleteExpiredPageSnapshots,
  runAsSystem,
  runAsTenant,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { PageSourceDeps } from "./page-sources.js";
import { refreshPageSource } from "./page-sources.js";

const TICK_LIMIT = 50;
const PER_SPACE_CONCURRENCY = 4;
/** Scheduled refreshes per space per UTC day. */
export const PAGE_REFRESHES_PER_SPACE_PER_DAY = 2000;

export type PageRefreshDeps = Omit<PageSourceDeps, "events"> & {
  events: Pick<ThreadEvents, "append" | "sendUserMessage">;
  jobs: Pick<JobPublisher, "enqueue">;
};

const utcMidnight = (now: Date, addDays = 0) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + addDays));

export const PAUSE_MESSAGE =
  "A source on one of your pages stopped working. Call page_source_list to see which one and why.";

/** Tell the bot's thread its source stopped, so the bot can fix it. */
export async function postPauseMessage(
  deps: PageRefreshDeps,
  source: { spaceId: string; userId: string; botId: string },
): Promise<void> {
  const thread = await deps.prisma.thread.findFirst({
    where: { botId: source.botId, spaceId: source.spaceId },
    select: { id: true },
  });
  if (!thread) return;
  // Fixed words only: this message starts a run as the owner, so it must carry nothing a bot or a
  // remote server wrote (the error, the page title, the source name). The bot reads the details
  // from page_source_list, which is an untrusted tool result.
  const text = PAUSE_MESSAGE;
  const sent = await deps.events.sendUserMessage({
    spaceId: source.spaceId,
    threadId: thread.id,
    botId: source.botId,
    userId: source.userId,
    blocks: [{ kind: "text", text }],
    prompt: text,
    trigger: "user",
  });
  if (sent.taskId && sent.runId) {
    await deps.jobs.enqueue(runContinueJob(sent.runId)).catch((error) => {
      getLogger().error("page source pause enqueue", error);
    });
  }
}

/**
 * One tick of the page refresh scheduler: claim due sources (system, only to claim), then run each
 * as its owner, at most 4 at once per space. State lives in the database, so any worker may tick.
 */
export async function runPageRefreshTick(deps: PageRefreshDeps) {
  const now = deps.now?.() ?? new Date();
  const claims = await runAsSystem("claim due page sources across Spaces", () =>
    claimDuePageSources(deps.prisma, now, TICK_LIMIT),
  );
  const bySpace = new Map<string, typeof claims>();
  for (const claim of claims)
    bySpace.set(claim.spaceId, [...(bySpace.get(claim.spaceId) ?? []), claim]);

  const runSpace = async (queue: typeof claims) => {
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const claim = queue[next++] as (typeof queue)[number];
        try {
          await runAsTenant({ spaceId: claim.spaceId, userId: claim.userId }, async () => {
            // The count is shared by every worker; at most one tick of claims can overshoot it.
            const today = await deps.prisma.pageSourceSnapshot.count({
              where: { spaceId: claim.spaceId, fetchedAt: { gte: utcMidnight(now) } },
            });
            if (today >= PAGE_REFRESHES_PER_SPACE_PER_DAY) {
              await deps.prisma.pageSource.updateMany({
                where: { id: claim.id, spaceId: claim.spaceId },
                data: { leaseUntil: null, nextRefreshAt: utcMidnight(now, 1) },
              });
              return;
            }
            const outcome = await refreshPageSource(deps, claim);
            if (!outcome.ok && outcome.paused) await postPauseMessage(deps, claim);
          });
        } catch (error) {
          // The lease expires in 10 minutes and the source is claimed again.
          getLogger().error("pages.refresh check failed", error);
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(PER_SPACE_CONCURRENCY, queue.length) }, worker),
    );
  };
  await Promise.all([...bySpace.values()].map(runSpace));
  return { claimed: claims.length };
}

export const runPageSnapshotRetention = (prisma: PrismaClient) =>
  runAsSystem("delete old page snapshots across Spaces", () => deleteExpiredPageSnapshots(prisma));
