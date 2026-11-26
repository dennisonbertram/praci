import type {
  AgentRunModel,
  AgentRuntime,
  JobPublisher,
  UsageOperationKind,
} from "@rakazo/adapter-kit";
import { runContinueJob } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { GoalVerdict } from "@rakazo/core";
import {
  buildGoalCheckPrompt,
  GOAL_CHECK_UNAVAILABLE_BODY,
  GOAL_END_TITLES,
  GOAL_PAUSED_TITLE,
  goalCheckEvidenceIds,
  parseGoalEvidence,
  parseGoalVerdictText,
  scriptedGoalVerdict,
  validateGoalVerdict,
} from "@rakazo/core";
import type { NotificationEvents, PrismaClient, ThreadEvents } from "@rakazo/db";
import {
  commitGoalVerdict,
  goalSpendUsd,
  loadGoalCheckInput,
  loadGoalToCheck,
  pauseGoalAfterCheck,
  recordUsage,
  threadHasLiveRun,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { aiRecipient } from "./ai-consent.js";
import { formatCurrentTimeInstruction } from "./current-time.js";
import { MISSING_MODEL_MESSAGE, notifyRun } from "./executor.js";
import { PINNED_PROVIDER_NOT_CONNECTED } from "./model-selection.js";
import { isModelAccountRefusal } from "./routine-backoff.js";

const GOAL_CHECK_TIMEOUT_MS = 60_000;
const GOAL_CHECK_KIND: UsageOperationKind = "goal_check";

/** What the goal check receives. It returns the model's verdict object or text; the server validates it. */
export type GoalCheckInput = {
  goal: string;
  continuations: number;
  stalls: number;
  prompt: string;
  /** Every id the evidence has, oldest first (r1.t1, r1.t2, r2.t1, …). */
  evidenceIds: string[];
};
export type GoalCheckFn = (input: GoalCheckInput) => Promise<unknown>;

/** The check cannot run (no AI data consent, no model): the goal pauses instead of guessing. */
class GoalCheckUnavailable extends Error {}

export interface GoalCheckDeps {
  prisma: PrismaClient;
  jobs: JobPublisher;
  events: Pick<ThreadEvents, "notify">;
  notificationEvents?: NotificationEvents;
  runtime: AgentRuntime;
  resolveModel?: (scope: {
    userId: string;
    spaceId: string;
    botId?: string;
  }) => Promise<AgentRunModel>;
  /** Tests inject the check; a scripted runtime selects the scripted one. */
  goalCheck?: GoalCheckFn;
  now?: () => Date;
}

/** A run failure that repeats until the owner fixes the model connection. */
function isModelConnectionFailure(error: string | null): boolean {
  if (!error) return false;
  return (
    error === MISSING_MODEL_MESSAGE ||
    error.includes(PINNED_PROVIDER_NOT_CONNECTED) ||
    isModelAccountRefusal(error)
  );
}

const clip = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

/** The check that asks the bot's own model, with no tools, and records its usage on the judged run. */
async function llmGoalCheck(
  deps: GoalCheckDeps,
  goal: { spaceId: string; userId: string; botId: string; threadId: string },
  runId: string,
): Promise<GoalCheckFn> {
  if (!deps.resolveModel) throw new GoalCheckUnavailable("no model resolver");
  const model = await deps.resolveModel({
    userId: goal.userId,
    spaceId: goal.spaceId,
    botId: goal.botId,
  });
  // The evidence goes to this model, so the owner must have allowed this recipient, as for history compaction.
  const recipient = aiRecipient({
    provider: model.provider,
    modelId: model.id,
    baseUrl: model.baseUrl,
    use: "model",
  });
  if (recipient) {
    const consent = await deps.prisma.aiDataConsent.findUnique({
      where: {
        userId_spaceId_recipientKey: {
          userId: goal.userId,
          spaceId: goal.spaceId,
          recipientKey: recipient.key,
        },
      },
      select: { version: true },
    });
    if (consent?.version !== AI_DISCLOSURE_VERSION) throw new GoalCheckUnavailable("no consent");
  }
  const attribution = {
    spaceId: goal.spaceId,
    userId: goal.userId,
    botId: goal.botId,
    runId,
    operationId: `goal-check:${runId}`,
    operationKind: GOAL_CHECK_KIND,
  };
  return async (input) => {
    let text = "";
    for await (const event of deps.runtime.run(
      {
        botId: goal.botId,
        threadId: goal.threadId,
        runId: `${runId}:goal-check`,
        usageOperationKind: GOAL_CHECK_KIND,
        onUsage: async (usage) => {
          await recordUsage(deps.prisma, usage, attribution);
        },
        prompt: input.prompt,
        instructions: [
          formatCurrentTimeInstruction(),
          "You are a strict goal checker. Output strict JSON only. No tools. No markdown.",
        ].join(" "),
        history: [],
        tools: [],
        model,
      },
      {
        operationId: `goal-check:${runId}`,
        traceId: `goal-check:${runId}`,
        spaceId: goal.spaceId,
        userId: goal.userId,
        signal: AbortSignal.timeout(GOAL_CHECK_TIMEOUT_MS),
      },
    )) {
      if (event.type === "usage" && !event.accounted) {
        await recordUsage(deps.prisma, event, attribution);
      }
      if (event.type === "done" && event.text) text = event.text.trim();
    }
    return /^(?:I hit a problem:|Unknown model )/i.test(text)
      ? undefined
      : parseGoalVerdictText(text);
  };
}

async function resolveGoalCheck(
  deps: GoalCheckDeps,
  goal: { spaceId: string; userId: string; botId: string; threadId: string },
  runId: string,
): Promise<GoalCheckFn> {
  if (deps.goalCheck) return deps.goalCheck;
  if (deps.runtime.describe().capabilities.scripted) {
    return async (input) =>
      scriptedGoalVerdict({
        goal: input.goal,
        continuations: input.continuations,
        evidenceIds: input.evidenceIds,
      });
  }
  return llmGoalCheck(deps, goal, runId);
}

/**
 * Judges a goal after one of its runs ended, then continues it, ends it or pauses it. The model
 * call is made outside any transaction; the write re-checks everything under the thread lock, so
 * two workers that race produce one continuation run.
 */
export async function runGoalCheck(
  deps: GoalCheckDeps,
  payload: { goalId: string; runId: string },
): Promise<void> {
  const target = await loadGoalToCheck(deps.prisma, payload);
  if (!target) return;
  const { goal, run } = target;
  // The goal as this check read it: a pause, resume or newer run before the write drops the result.
  const version = goal.updatedAt;
  const announce = (result: { threadId: string; seq: number } | null) =>
    result
      ? deps.events.notify(result.threadId, result.seq).catch((error) => {
          getLogger().error("goal realtime notification", error);
        })
      : undefined;

  // A cancelled run (Stop, or the 24 hour expiry of a stuck run) never continues the goal.
  if (run.status === "cancelled") {
    if (!(await threadHasLiveRun(deps.prisma, goal))) {
      await announce(
        await pauseGoalAfterCheck(deps.prisma, {
          goalId: goal.id,
          runId: run.id,
          version,
          stopReason: "owner",
        }),
      );
    }
    return;
  }
  // A live run (a card or question waiting, or the owner's newer message) is judged when it ends.
  if (await threadHasLiveRun(deps.prisma, goal)) return;

  const now = () => deps.now?.() ?? new Date();
  let readRunIds: string[] = [];
  const judgedEvidence = parseGoalEvidence(run.goalEvidence);
  const judged = {
    id: run.id,
    failed: run.status === "failed",
    madeProgress: judgedEvidence.some((entry) => entry.ok),
  };

  async function commit(
    verdict: GoalVerdict,
    extra: { modelError?: boolean; evidenceText?: Record<string, string> },
  ) {
    const outcome = await commitGoalVerdict(deps.prisma, {
      goalId: goal.id,
      judged,
      version,
      readRunIds,
      verdict,
      modelError: extra.modelError,
      spendUsd: await goalSpendUsd(deps.prisma, goal),
      now: now(),
      evidenceText: extra.evidenceText ?? {},
    });
    if (outcome.kind === "skipped") return;
    await announce(outcome);
    if (outcome.kind === "continued") {
      await deps.jobs
        .enqueue(runContinueJob(outcome.runId))
        .catch((error) => getLogger().error("goal continuation enqueue", error));
      return;
    }
    const bot = await deps.prisma.bot.findUnique({
      where: { id: goal.botId },
      select: { name: true },
    });
    await notifyRun(
      { prisma: deps.prisma, notificationEvents: deps.notificationEvents },
      {
        id: run.id,
        spaceId: goal.spaceId,
        userId: goal.userId,
        botId: goal.botId,
        threadId: goal.threadId,
        trigger: "goal",
      },
      {
        kind: outcome.end.outcome === "met" ? "completion" : "help",
        title: GOAL_END_TITLES[outcome.end.outcome](bot?.name ?? "The agent"),
        body: outcome.end.reason,
        botId: goal.botId,
        threadId: goal.threadId,
      },
    );
  }

  // The model cannot run until the owner fixes the connection: end now instead of retrying 3 times.
  if (judged.failed && isModelConnectionFailure(run.error)) {
    await commit(
      {
        verdict: "blocked",
        reason: "The model connection is unavailable.",
        evidence: [],
        next: "",
      },
      { modelError: true },
    );
    return;
  }

  // Pausing for a check that could not run is the one pause the owner hears about: the goal stops
  // making progress on its own, and nothing else on the thread says why.
  const pause = async (stopReason: "check_failed") => {
    const bot = await deps.prisma.bot.findUnique({
      where: { id: goal.botId },
      select: { name: true },
    });
    // The push commits with the pause: a pause the owner never hears about would never be checked
    // again, so a failed write must leave the goal active for the retry to judge.
    const paused = await pauseGoalAfterCheck(deps.prisma, {
      goalId: goal.id,
      runId: run.id,
      version,
      stopReason,
      inside: async (tx) =>
        // The realtime signal is deferred to after the commit, so subscribers read the paused goal.
        notifyRun(
          { prisma: tx, notificationEvents: deps.notificationEvents },
          {
            id: run.id,
            spaceId: goal.spaceId,
            userId: goal.userId,
            botId: goal.botId,
            threadId: goal.threadId,
            trigger: "goal",
          },
          {
            kind: "help",
            title: GOAL_PAUSED_TITLE(bot?.name ?? "The agent"),
            body: GOAL_CHECK_UNAVAILABLE_BODY,
            botId: goal.botId,
            threadId: goal.threadId,
          },
          { retryOnFailure: true, deferPublish: true },
        ),
    });
    await announce(paused);
  };

  const input = await loadGoalCheckInput(deps.prisma, goal, run.id);
  readRunIds = input.runs.map((listed) => listed.id);
  const evidenceIds = goalCheckEvidenceIds(input.runs);
  const known = new Set(evidenceIds);
  const evidenceText: Record<string, string> = {};
  input.runs.forEach((listed, index) => {
    for (const entry of listed.evidence) {
      evidenceText[`r${index + 1}.${entry.id}`] = clip(`${entry.tool}: ${entry.result}`, 160);
    }
  });
  const checkInput: GoalCheckInput = {
    goal: goal.text,
    continuations: goal.continuations,
    stalls: goal.stalls,
    evidenceIds,
    prompt: buildGoalCheckPrompt({
      goal: goal.text,
      runs: input.runs,
      workItems: input.workItems,
      lastReply: input.lastReply,
      continuations: goal.continuations,
      stalls: goal.stalls,
    }),
  };

  let check: GoalCheckFn;
  try {
    check = await resolveGoalCheck(deps, goal, run.id);
  } catch (error) {
    if (!(error instanceof GoalCheckUnavailable)) {
      getLogger().error("goal check could not start", error);
    }
    await pause("check_failed");
    return;
  }
  // One retry for malformed output; a second malformed reply pauses the goal.
  let verdict: GoalVerdict | null = null;
  for (let attempt = 0; attempt < 2 && !verdict; attempt++) {
    try {
      verdict = validateGoalVerdict(await check(checkInput), known);
    } catch (error) {
      getLogger().warn("goal check call failed", { error });
    }
  }
  if (!verdict) {
    await pause("check_failed");
    return;
  }
  await commit(verdict, { evidenceText });
}
