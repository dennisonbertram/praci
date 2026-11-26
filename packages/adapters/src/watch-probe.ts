import type { ConnectorProvider, JobPublisher } from "@rakazo/adapter-kit";
import { runContinueJob } from "@rakazo/adapter-kit";
import { connectorToolLabel } from "@rakazo/contracts";
import {
  expandSkillReferencesInPrompt,
  formatUntrustedDeliveryPayload,
  newRunExternalTaint,
  newRunUnattended,
  normalizePageText,
} from "@rakazo/core";
import type { NotificationEvents, PrismaClient, ThreadEvents } from "@rakazo/db";
import { claimDueWatchChecks, createNotification, recordWatchCheck } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { routineRunModelPin } from "./model-selection.js";
import { listAgentSkillRecords } from "./skill-tools.js";
import { taughtSkillPromptForRoutine } from "./taught-skill-prompt.js";
import { probeConnectorWatch } from "./watch-connector.js";
import type { ResolveHostname } from "./web-ssrf.js";
import { fetchSafeWebText } from "./web-ssrf.js";

export const WATCH_PROBE_TIMEOUT_MS = 15_000;
export const WATCH_PROBE_MAX_BYTES = 2 * 1024 * 1024;
const TICK_LIMIT = 25;
const TICK_CONCURRENCY = 5;
const ACTIVE_RUN_STATUSES = ["queued", "leased", "running", "waiting_input", "waiting_takeover"];

export type ProbeResult =
  | { ok: true; text: string }
  | { ok: false; kind: "transient" | "access"; message: string };

/** A watch pause the owner is told about: the probe's access failure, with the cause in plain words. */
type ProbeFailure = Extract<ProbeResult, { ok: false }>;

export type ProbeDeps = {
  fetch?: typeof globalThis.fetch;
  resolveHostname?: ResolveHostname;
  signal?: AbortSignal;
};

/** Messages the SSRF policy raises for an address it refuses; retrying cannot help. */
const POLICY_BLOCKED = /^(URL |Only http)/;

/**
 * Fetches a page through the same SSRF-checked fetcher as web_fetch and returns its normalized
 * text. A refused address or a 401/403/404/410 is an "access" error (the watch pauses at once);
 * anything else (network, timeout, 5xx, 429) is transient. Never calls a model.
 */
export async function probePage(url: string, deps: ProbeDeps = {}): Promise<ProbeResult> {
  try {
    const { body } = await fetchSafeWebText(url, {
      fetch: deps.fetch,
      resolveHostname: deps.resolveHostname,
      signal: deps.signal,
      timeoutMs: WATCH_PROBE_TIMEOUT_MS,
      maxBytes: WATCH_PROBE_MAX_BYTES,
      // ponytail: a page over 2 MB is read to the cap, not rejected; its snapshot is 16 KB anyway.
      truncate: true,
    });
    return { ok: true, text: normalizePageText(body) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /^Request failed: HTTP (\d+)/.exec(message)?.[1];
    const access =
      POLICY_BLOCKED.test(message) ||
      (status !== undefined && [401, 403, 404, 410].includes(Number(status)));
    return { ok: false, kind: access ? "access" : "transient", message };
  }
}

export type WatchProbeDeps = ProbeDeps & {
  prisma: PrismaClient;
  jobs: JobPublisher;
  /** Needed for connected-app watches; without it they pause. */
  connector?: ConnectorProvider;
  events?: ThreadEvents;
  notificationEvents?: NotificationEvents;
  now?: () => Date;
};

type Wake = {
  routine: { id: string; spaceId: string; botId: string; userId: string };
  /** The address of a page watch, or "App tool" of a connected-app watch. */
  url: string;
  diff: string;
  connector?: boolean;
};

const WATCHED_APP = "result of the watched app";
const WATCHED_PAGE = "watched page";
/** Starts the note a watch wake appends to a routine's instruction; what follows is not the owner's. */
const WATCH_NOTE_START = (what: string) => `\n\nThe ${what} changed (`;

/**
 * The owner's part of a watch wake's task prompt: the routine's instruction without the note,
 * whose url and diff come from what the watch read.
 */
export function watchWakeInstruction(taskPrompt: string): string {
  const cuts = [WATCHED_PAGE, WATCHED_APP]
    .map((what) => taskPrompt.indexOf(WATCH_NOTE_START(what)))
    .filter((index) => index !== -1);
  return cuts.length > 0 ? taskPrompt.slice(0, Math.min(...cuts)) : taskPrompt;
}

/** The prompt of a watch wake: the routine's own instruction, then the change fenced as untrusted data. */
export function watchWakePrompt(
  instruction: string,
  url: string,
  diff: string,
  connector = false,
): string {
  const what = connector ? WATCHED_APP : WATCHED_PAGE;
  return `${instruction}${WATCH_NOTE_START(what)}${url}). Changes since you last saw it:\n\n${formatUntrustedDeliveryPayload(
    connector ? "[App Changes]" : "[Page Changes]",
    { diff: diff.split("\n") },
  )}`;
}

type WakeDb = Pick<
  PrismaClient,
  "routine" | "bot" | "thread" | "agentSkill" | "botSkillSetting" | "task" | "run" | "taughtSkill"
>;

/**
 * Creates the task and queued unattended, externally tainted run for a routine whose page
 * changed. Called inside recordWatchCheck's transaction so the run exists iff the snapshot moved.
 */
export async function createWatchWakeRun(db: WakeDb, wake: Wake) {
  const routine = await db.routine.findFirst({
    where: { id: wake.routine.id, spaceId: wake.routine.spaceId, active: true },
  });
  if (!routine) return null;
  const bot = await db.bot.findUnique({
    where: { id: routine.botId },
    include: { thread: true },
  });
  if (!bot || bot.archivedAt || !bot.thread) return null;
  const target = routine.threadId
    ? await db.thread.findFirst({
        where: {
          id: routine.threadId,
          spaceId: routine.spaceId,
          OR: [
            { botId: bot.id },
            { group: { archivedAt: null, members: { some: { botId: bot.id } } } },
          ],
        },
        select: { id: true },
      })
    : null;
  const threadId = target?.id ?? bot.thread.id;
  const skills = await listAgentSkillRecords(db, {
    spaceId: routine.spaceId,
    userId: routine.userId,
    botId: routine.botId,
  });
  const prompt = watchWakePrompt(
    expandSkillReferencesInPrompt(
      (await taughtSkillPromptForRoutine(db, routine)) ?? routine.prompt,
      skills,
    ),
    wake.url,
    wake.diff,
    wake.connector,
  );
  const task = await db.task.create({
    data: {
      spaceId: routine.spaceId,
      botId: bot.id,
      threadId,
      userId: routine.userId,
      prompt,
      status: "queued",
    },
  });
  const run = await db.run.create({
    data: {
      spaceId: routine.spaceId,
      botId: bot.id,
      threadId,
      taskId: task.id,
      userId: routine.userId,
      status: "queued",
      trigger: "routine",
      unattended: newRunUnattended({ trigger: "routine" }),
      externalTaint: newRunExternalTaint({ trigger: "routine", source: { externalTaint: true } }),
      routineId: routine.id,
      ...routineRunModelPin(routine),
    },
  });
  return run;
}

/** After the wake commits: start the run. The job reconciler also enqueues any queued run, so a crash here is recovered. */
async function startWatchWake(
  deps: WatchProbeDeps,
  run: { id: string; spaceId: string; threadId: string; botId: string; routineId: string | null },
) {
  await deps.jobs.enqueue(runContinueJob(run.id));
  await deps.prisma.routine.update({
    where: { id: run.routineId as string },
    data: { lastRunAt: new Date() },
  });
  try {
    await deps.events?.append({
      spaceId: run.spaceId,
      threadId: run.threadId,
      botId: run.botId,
      type: "routine.fired",
      runId: run.id,
      payload: { routineId: run.routineId, watch: true },
    });
  } catch {
    // Best effort: the run is already queued.
  }
}

const PAUSE_REASON: Record<string, string> = {
  access: "the page could not be checked",
  errors: "the page could not be checked",
  noisy: "the page changes too often",
};

async function notifyPaused(
  deps: WatchProbeDeps,
  claim: { routineId: string; spaceId: string; botId: string; userId: string },
  reason: string,
  now: Date,
  detail?: string,
) {
  const routine = await deps.prisma.routine.findUnique({
    where: { id: claim.routineId },
    select: { name: true },
  });
  const name = (routine?.name ?? "Watch").slice(0, 40);
  const result = await createNotification(deps.prisma, {
    spaceId: claim.spaceId,
    userId: claim.userId,
    botId: claim.botId,
    routineId: claim.routineId,
    surface: "routines",
    title: `${name} paused: ${detail ?? PAUSE_REASON[reason] ?? "it needs a look"}`,
    importance: "attention",
    dedupeKey: `watch-paused:${claim.routineId}:${now.toISOString()}`,
    skipRateLimits: true,
    now,
  });
  if (result.status === "created") {
    await deps.notificationEvents
      ?.notify(
        { spaceId: claim.spaceId, userId: claim.userId },
        {
          id: result.notification.id,
          surface: result.notification.surface,
          importance: result.notification.importance,
        },
      )
      .catch(() => undefined);
  }
}

/** Why a connected-app watch paused, in words for the notification title. */
function connectorPauseDetail(
  result: { outcome: string; pausedReason?: string | null },
  probe: ProbeResult,
): string {
  if (result.outcome === "noisy") return PAUSE_REASON.noisy as string;
  return !probe.ok && probe.kind === "access"
    ? probe.message.replace(/\.$/, "").replace(/^[A-Z]/, (letter) => letter.toLowerCase())
    : "the app could not be checked";
}

/**
 * One tick of the page-watch probe: claim the due watches, fetch each, record the result, and
 * for each real change queue one run. No model is called here.
 */
export async function runWatchProbeTick(deps: WatchProbeDeps) {
  const now = deps.now?.() ?? new Date();
  const claims = await claimDueWatchChecks(deps.prisma, now, TICK_LIMIT);
  const summary = { checked: 0, woke: 0, paused: 0 };
  let next = 0;
  const worker = async () => {
    while (next < claims.length) {
      const claim = claims[next++] as (typeof claims)[number];
      try {
        const watch = claim.watch;
        const connectorMissing: ProbeFailure = {
          ok: false,
          kind: "access",
          message: "Connected apps are not available here.",
        };
        const probe =
          watch.kind === "connector"
            ? deps.connector
              ? await probeConnectorWatch(
                  { prisma: deps.prisma, connector: deps.connector, signal: deps.signal },
                  {
                    routineId: claim.routineId,
                    spaceId: claim.spaceId,
                    userId: claim.userId,
                    botId: claim.botId,
                  },
                  watch,
                )
              : connectorMissing
            : await probePage(watch.url, deps);
        const wakeInFlight =
          (await deps.prisma.run.count({
            where: {
              routineId: claim.routineId,
              spaceId: claim.spaceId,
              status: { in: ACTIVE_RUN_STATUSES as never },
            },
          })) > 0;
        const wakeBase = {
          routine: {
            id: claim.routineId,
            spaceId: claim.spaceId,
            botId: claim.botId,
            userId: claim.userId,
          },
          url:
            watch.kind === "connector"
              ? `${watch.appName}, ${connectorToolLabel(watch.toolName)}`
              : watch.url,
          connector: watch.kind === "connector",
        };
        const result = await recordWatchCheck(
          deps.prisma,
          {
            routineId: claim.routineId,
            spaceId: claim.spaceId,
            now,
            wakeInFlight,
            ...(probe.ok ? { text: probe.text } : { error: { kind: probe.kind } }),
          },
          (tx, diff) => createWatchWakeRun(tx, { ...wakeBase, diff }),
        );
        summary.checked++;
        if (result.outcome === "wake") {
          if (result.created) {
            await startWatchWake(deps, result.created);
            summary.woke++;
          }
        } else if (result.outcome === "noisy" || (result.outcome === "error" && result.paused)) {
          summary.paused++;
          await notifyPaused(
            deps,
            claim,
            result.outcome === "noisy" ? "noisy" : (result.pausedReason ?? "errors"),
            now,
            watch.kind === "connector" ? connectorPauseDetail(result, probe) : undefined,
          );
        }
      } catch (error) {
        // The lease on the claim expires in 10 minutes and the watch is checked again.
        getLogger().error("watch.probe check failed", error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(TICK_CONCURRENCY, claims.length) }, worker));
  return summary;
}
