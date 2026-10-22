import type { JobPublisher } from "@rakazo/adapter-kit";
import { routineJobKey, routineWakeupJob } from "@rakazo/adapter-kit";
import {
  cronFromPreset,
  extractForcedSkillName,
  formatCron,
  isOneShotRoutineCron,
  isOneShotRoutineCrons,
  isValidTimezone,
  nextCronDate,
  nextCronDateAcross,
  ONCE_ROUTINE_CRON,
} from "@rakazo/core";
import type { PrismaClient, ThreadEvents } from "@rakazo/db";
import { OWNER_INITIATED_TRIGGERS } from "./mail-tools.js";

export { isOneShotRoutineCron, ONCE_ROUTINE_CRON };

export const SCHEDULE_TOOL_NAMES = new Set([
  "schedule_create",
  "schedule_list",
  "schedule_cancel",
  "schedule_update",
  "schedule_runs",
]);

export function filterBuiltinToolsForRun<T extends { name: string }>(
  tools: T[],
  runTrigger: string,
): T[] {
  // A saved prompt later fires as an owner routine run with the owner's mail, calendar and Drive,
  // so only a run the owner started may create one (routine runs never chain a new schedule).
  return OWNER_INITIATED_TRIGGERS.has(runTrigger) && runTrigger !== "routine"
    ? tools
    : tools.filter((tool) => tool.name !== "schedule_create" && tool.name !== "schedule_update");
}

/** Keep cross-bot messaging thread-specific while exposing schedules in DMs and groups. */
export function filterBuiltinToolsForThread<T extends { name: string }>(
  tools: T[],
  groupId: string | null | undefined,
): T[] {
  return tools.filter(
    (tool) =>
      (groupId || tool.name !== "handoff_to_bot") &&
      // In a group the room is the shared surface: hand the stage to a member
      // rather than starting a private thread off to one side.
      (!groupId || tool.name !== "message_bot"),
  );
}

type ScheduleUnit = "minutes" | "hours" | "days" | "seconds";

export type ResolvedSchedule =
  | { ok: true; cron: string; nextRunAt: Date; oneShot: boolean }
  | { ok: false; error: string };

/**
 * Providers sometimes serialize omitted optional tool fields as null or an empty
 * string. Treat those values as absent, while preserving numeric zero so the
 * normal validation can reject an invalid zero interval/delay with a useful
 * error instead of reporting two schedule modes at once.
 */
export function isScheduleValueProvided(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  return typeof value !== "string" || value.trim().length > 0;
}

export function compactScheduleInput(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => isScheduleValueProvided(value)),
  );
}

export function resolveScheduleTiming(
  input: {
    cron?: unknown;
    every?: unknown;
    unit?: unknown;
    runAt?: unknown;
    delayMinutes?: unknown;
    delaySeconds?: unknown;
  },
  timezone = "UTC",
): ResolvedSchedule {
  const hasRepeat =
    isScheduleValueProvided(input.cron) ||
    isScheduleValueProvided(input.every) ||
    isScheduleValueProvided(input.unit);
  const hasOneShot =
    isScheduleValueProvided(input.runAt) ||
    isScheduleValueProvided(input.delayMinutes) ||
    isScheduleValueProvided(input.delaySeconds);
  if (hasRepeat && hasOneShot) {
    return {
      ok: false,
      error: "Provide either a repeating schedule or a one-shot time, not both.",
    };
  }
  if (!hasRepeat && !hasOneShot) {
    return {
      ok: false,
      error:
        "Provide cron, every/unit for repeating schedules, or runAt/delayMinutes/delaySeconds for one-shot.",
    };
  }
  const hasCron = isScheduleValueProvided(input.cron);
  const hasInterval = isScheduleValueProvided(input.every) || isScheduleValueProvided(input.unit);
  if (hasCron && hasInterval) {
    return {
      ok: false,
      error: "Provide exactly one timing method: cron, or every and unit, not both.",
    };
  }

  if (hasOneShot) {
    const oneShotFields = [input.runAt, input.delayMinutes, input.delaySeconds].filter(
      isScheduleValueProvided,
    );
    if (oneShotFields.length !== 1) {
      return {
        ok: false,
        error:
          "Provide exactly one of runAt, delayMinutes, or delaySeconds for a one-shot schedule.",
      };
    }
    let nextRunAt: Date;
    if (isScheduleValueProvided(input.delaySeconds)) {
      const delaySeconds = Number(input.delaySeconds);
      if (!Number.isFinite(delaySeconds) || delaySeconds < 0) {
        return { ok: false, error: "delaySeconds must be a non-negative number." };
      }
      nextRunAt = new Date(Date.now() + delaySeconds * 1_000);
    } else if (isScheduleValueProvided(input.delayMinutes)) {
      const delayMinutes = Number(input.delayMinutes);
      if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
        return { ok: false, error: "delayMinutes must be a non-negative number." };
      }
      nextRunAt = new Date(Date.now() + delayMinutes * 60_000);
    } else {
      const parsed = new Date(String(input.runAt ?? ""));
      if (!Number.isFinite(parsed.getTime())) {
        return { ok: false, error: "runAt must be a valid ISO datetime." };
      }
      nextRunAt = parsed;
    }
    if (nextRunAt.getTime() <= Date.now()) {
      return { ok: false, error: "One-shot schedules must run in the future." };
    }
    return { ok: true, cron: ONCE_ROUTINE_CRON, nextRunAt, oneShot: true };
  }

  if (hasCron) {
    const cron = String(input.cron).trim();
    if (!cron) return { ok: false, error: "cron must be a non-empty 5-field cron expression." };
    if (isOneShotRoutineCron(cron)) {
      return {
        ok: false,
        error: "Use runAt, delayMinutes, or delaySeconds for one-shot schedules.",
      };
    }
    const intervalError = validateRepeatingCron(cron);
    if (intervalError) return { ok: false, error: intervalError };
    try {
      const nextRunAt = nextCronDate(cron, new Date(), timezone);
      return { ok: true, cron, nextRunAt, oneShot: false };
    } catch {
      return { ok: false, error: "cron must be a valid 5-field cron expression." };
    }
  }

  const every = Number(input.every);
  const unit = String(input.unit ?? "") as ScheduleUnit;
  if (!Number.isFinite(every) || every <= 0 || !Number.isInteger(every)) {
    return { ok: false, error: "every must be a positive whole number." };
  }
  if (unit === "seconds") {
    return { ok: false, error: "minimum interval is 1 minute" };
  }
  if (!["minutes", "hours", "days"].includes(unit)) {
    return { ok: false, error: 'unit must be "minutes", "hours", or "days".' };
  }
  if (unit === "minutes" && every < 1) {
    return { ok: false, error: "minimum interval is 1 minute" };
  }
  const cron = cronFromPreset({ freq: "Interval", n: every, unit });
  const intervalError = validateRepeatingCron(cron);
  if (intervalError) return { ok: false, error: intervalError };
  try {
    const nextRunAt = nextCronDate(cron, new Date(), timezone);
    return { ok: true, cron, nextRunAt, oneShot: false };
  } catch {
    return { ok: false, error: "every/unit produced an invalid cron expression." };
  }
}

function validateRepeatingCron(cron: string): string | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return "cron must be a 5-field cron expression.";
  const minuteExpr = parts[0] ?? "*";
  const step = /^\*\/(\d+)$/.exec(minuteExpr);
  if (step) {
    const n = Number(step[1]);
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
      return "minimum interval is 1 minute";
    }
  }
  return null;
}

export interface ScheduleToolDeps {
  prisma: PrismaClient;
  events: ThreadEvents;
  jobs: JobPublisher;
}

/** Persist and enqueue a bot routine that wakes in the originating thread. */
export async function createScheduleFromTool(
  deps: ScheduleToolDeps,
  input: {
    spaceId: string;
    botId: string;
    userId: string;
    threadId: string;
    name: string;
    prompt: string;
    timezone?: string;
    schedule: Record<string, unknown>;
  },
) {
  const name = input.name.trim();
  const prompt = input.prompt.trim();
  if (!name) return { error: "name is required." };
  if (!prompt) return { error: "prompt is required." };

  // Without an explicit zone, times are the owner's local time.
  const timezone =
    input.timezone?.trim() || (await loadUserTimezone(deps.prisma, input.userId)) || "UTC";
  if (!isValidTimezone(timezone)) return { error: `Unknown time zone: ${timezone}.` };
  const resolved = resolveScheduleTiming(input.schedule, timezone);
  if (!resolved.ok) return { error: resolved.error };

  const row = await deps.prisma.routine.create({
    data: {
      spaceId: input.spaceId,
      botId: input.botId,
      userId: input.userId,
      threadId: input.threadId,
      name,
      prompt,
      crons: [resolved.cron],
      timezone,
      notify: true,
      active: true,
      nextRunAt: resolved.nextRunAt,
    },
  });

  try {
    await deps.jobs.enqueue(routineWakeupJob(row.id, resolved.nextRunAt));
  } catch {
    try {
      await deps.prisma.routine.delete({ where: { id: row.id } });
    } catch {
      // Do not soft-return while the row may still be active.
      await deps.prisma.routine.update({
        where: { id: row.id },
        data: { active: false, nextRunAt: null },
      });
    }
    return { error: "Could not schedule the reminder. Try again." };
  }

  try {
    await deps.events.append({
      spaceId: input.spaceId,
      threadId: input.threadId,
      botId: input.botId,
      type: "routine.created",
      payload: { name: row.name },
    });
  } catch {
    // Match routines.create: the reminder is live even if the thread signal fails.
  }

  return {
    ok: true as const,
    routineId: row.id,
    name: row.name,
    cron: row.crons[0],
    timezone: row.timezone,
    schedule: describeSchedule(row.crons, row.timezone, row.nextRunAt),
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    oneShot: resolved.oneShot,
  };
}

/** List bot routines, optionally restricted to the current group thread. */
export async function listSchedulesFromTool(
  deps: Pick<ScheduleToolDeps, "prisma">,
  input: { spaceId: string; botId: string; userId: string; threadId?: string },
) {
  const rows = await deps.prisma.routine.findMany({
    where: {
      spaceId: input.spaceId,
      botId: input.botId,
      userId: input.userId,
      ...(input.threadId ? { threadId: input.threadId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    routines: rows.map((row) => ({
      routineId: row.id,
      name: row.name,
      prompt: row.prompt,
      crons: row.crons,
      active: row.active,
      timezone: row.timezone,
      schedule: describeSchedule(row.crons, row.timezone, row.nextRunAt),
      nextRunAt: row.nextRunAt?.toISOString() ?? null,
      oneShot: isOneShotRoutineCrons(row.crons),
    })),
  };
}

/** Cancel a bot routine, optionally restricted to the current group thread. */
export async function cancelScheduleFromTool(
  deps: ScheduleToolDeps,
  input: {
    spaceId: string;
    botId: string;
    userId: string;
    threadId?: string;
    routineId?: string;
    name?: string;
  },
) {
  const routineId = input.routineId?.trim();
  const name = input.name?.trim();
  if (!routineId && !name) {
    return { error: "Provide routineId or the exact schedule name to cancel." };
  }

  const existing = await deps.prisma.routine.findFirst({
    where: {
      spaceId: input.spaceId,
      botId: input.botId,
      userId: input.userId,
      ...(input.threadId ? { threadId: input.threadId } : {}),
      ...(routineId ? { id: routineId } : { name: name! }),
    },
  });
  if (!existing) return { error: "Schedule not found." };

  await deps.prisma.routine.delete({ where: { id: existing.id } });
  await deps.jobs.cancel(routineJobKey(existing.id));
  return { ok: true as const, routineId: existing.id, name: existing.name };
}

/** A user's stored zone, or null before any client reported one. */
export async function loadUserTimezone(
  prisma: Pick<PrismaClient, "user">,
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  return user?.timezone ?? null;
}

/** A moment as the user reads it in their zone, e.g. "Wednesday, October 21, 2026 at 8:00 AM". */
function formatLocal(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** A schedule in plain words and the routine's own zone, e.g. "Every day at 8:00 AM (America/New_York)". */
export function describeSchedule(crons: string[], timezone: string, nextRunAt?: Date | null) {
  if (isOneShotRoutineCrons(crons)) {
    return nextRunAt
      ? `Once, ${formatLocal(nextRunAt, timezone)} (${timezone})`
      : "Once (already ran or paused)";
  }
  if (crons.length === 0) return "No schedule";
  return crons
    .map((cron) => {
      const words = formatCron(cron);
      // A clock time needs its zone; "Every 30 minutes" does not.
      return words.includes(" at ") ? `${words} (${timezone})` : words;
    })
    .join("; ");
}

export type ScheduleScope = {
  spaceId: string;
  botId: string;
  userId: string;
  /** Set in a group chat, where an agent only manages the schedules made in that thread. */
  threadId?: string;
};

/** A routine is managed by the bot and owner that made it, in one space (and one thread in a group). */
function ownedRoutine(scope: ScheduleScope, id: string) {
  return {
    id,
    spaceId: scope.spaceId,
    botId: scope.botId,
    userId: scope.userId,
    ...(scope.threadId ? { threadId: scope.threadId } : {}),
  };
}

const TIMING_FIELDS = ["cron", "every", "unit", "runAt", "delayMinutes", "delaySeconds"] as const;

function timingOf(input: unknown): Record<string, unknown> {
  const source = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return compactScheduleInput(Object.fromEntries(TIMING_FIELDS.map((key) => [key, source[key]])));
}

/**
 * Change a bot's schedule. The prompt is replaced whole; `schedule` replaces the timing; only the
 * fields given change. Returns the saved routine so the model can read it back.
 */
export async function updateScheduleFromTool(
  deps: ScheduleToolDeps,
  input: ScheduleScope & {
    id: string;
    prompt?: unknown;
    schedule?: unknown;
    timezone?: unknown;
    enabled?: unknown;
  },
) {
  const id = input.id.trim();
  if (!id) return { error: "id is required." };
  const existing = await deps.prisma.routine.findFirst({ where: ownedRoutine(input, id) });
  if (!existing) return { error: "Schedule not found." };

  const hasPrompt = isScheduleValueProvided(input.prompt);
  const prompt = hasPrompt ? String(input.prompt).trim() : existing.prompt;
  const timezone = isScheduleValueProvided(input.timezone)
    ? String(input.timezone).trim()
    : existing.timezone;
  if (!isValidTimezone(timezone)) return { error: `Unknown time zone: ${timezone}.` };
  const timing = timingOf(input.schedule);
  const hasTiming = Object.keys(timing).length > 0;
  const enabled = typeof input.enabled === "boolean" ? input.enabled : existing.active;

  let crons = existing.crons;
  let nextRunAt = existing.nextRunAt;
  if (hasTiming) {
    const resolved = resolveScheduleTiming(timing, timezone);
    if (!resolved.ok) return { error: resolved.error };
    crons = [resolved.cron];
    nextRunAt = resolved.nextRunAt;
  } else if (
    !isOneShotRoutineCrons(crons) &&
    (timezone !== existing.timezone || (enabled && !nextRunAt))
  ) {
    nextRunAt = nextCronDateAcross(crons, new Date(), timezone);
  }
  if (
    enabled &&
    isOneShotRoutineCrons(crons) &&
    (!nextRunAt || nextRunAt.getTime() <= Date.now())
  ) {
    return { error: "This one-time reminder already ran. Create a new one." };
  }
  if (enabled && crons.length > 0 && !nextRunAt) return { error: "That schedule has no next run." };

  const row = await deps.prisma.routine.update({
    where: { id: existing.id },
    data: { prompt, timezone, crons, active: enabled, nextRunAt: enabled ? nextRunAt : null },
  });
  if (row.active && row.nextRunAt) {
    await deps.jobs.enqueue(routineWakeupJob(row.id, row.nextRunAt));
  } else {
    await deps.jobs.cancel(routineJobKey(row.id));
  }
  if (row.threadId) {
    try {
      await deps.events.append({
        spaceId: row.spaceId,
        threadId: row.threadId,
        botId: row.botId,
        type: "routine.updated",
        payload: { routineId: row.id, active: row.active },
      });
    } catch {
      // The change is saved even if the thread signal fails.
    }
  }
  return {
    ok: true as const,
    routineId: row.id,
    name: row.name,
    prompt: row.prompt,
    schedule: describeSchedule(row.crons, row.timezone, row.nextRunAt),
    crons: row.crons,
    timezone: row.timezone,
    enabled: row.active,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    oneShot: isOneShotRoutineCrons(row.crons),
  };
}

const RUNS_DEFAULT_LIMIT = 10;
const RUNS_MAX_LIMIT = 25;
const RUN_ERROR_MAX = 300;

/** Recent runs of one schedule: status, time, whether it notified the owner, and what failed. */
export async function scheduleRunsFromTool(
  deps: Pick<ScheduleToolDeps, "prisma">,
  input: ScheduleScope & { id: string; limit?: unknown },
) {
  const id = input.id.trim();
  if (!id) return { error: "id is required." };
  const routine = await deps.prisma.routine.findFirst({
    where: ownedRoutine(input, id),
    select: { id: true, name: true },
  });
  if (!routine) return { error: "Schedule not found." };
  const requested = Math.trunc(Number(input.limit));
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 1), RUNS_MAX_LIMIT)
    : RUNS_DEFAULT_LIMIT;
  const runs = await deps.prisma.run.findMany({
    where: {
      routineId: routine.id,
      botId: input.botId,
      spaceId: input.spaceId,
      userId: input.userId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      error: true,
    },
  });
  const notified = runs.length
    ? await deps.prisma.notification.findMany({
        where: {
          spaceId: input.spaceId,
          userId: input.userId,
          routineId: routine.id,
          runId: { in: runs.map((run) => run.id) },
        },
        select: { runId: true },
      })
    : [];
  const notifiedRuns = new Set(notified.map((row) => row.runId));
  return {
    routineId: routine.id,
    name: routine.name,
    runs: runs.map((run) => ({
      runId: run.id,
      status: run.status,
      at: (run.startedAt ?? run.createdAt).toISOString(),
      finishedAt: run.completedAt?.toISOString() ?? null,
      notificationCreated: notifiedRuns.has(run.id),
      ...(run.error ? { error: run.error.slice(0, RUN_ERROR_MAX) } : {}),
    })),
  };
}

export type ScheduleApproval = { summary: string; detail: string };

/**
 * What the owner must approve for a schedule tool call, or undefined when it needs no approval.
 * Only repeating schedules do: a repeating job runs its saved prompt with the owner's mail and
 * Drive on every fire, while a one-off reminder fires once. Changing a repeating schedule's prompt
 * or making any schedule repeat counts as creating it.
 */
export async function scheduleApproval(
  deps: Pick<ScheduleToolDeps, "prisma">,
  scope: ScheduleScope,
  toolName: string,
  args: Record<string, unknown>,
  userTimezone: string | null,
): Promise<ScheduleApproval | undefined> {
  if (toolName !== "schedule_create" && toolName !== "schedule_update") return undefined;
  const create = toolName === "schedule_create";
  const existing = create
    ? undefined
    : await deps.prisma.routine.findFirst({ where: ownedRoutine(scope, String(args.id ?? "")) });
  // The tool reports "not found" without any effect.
  if (!create && !existing) return undefined;

  const timing = create ? timingOf(args) : timingOf(args.schedule);
  const timezone =
    (isScheduleValueProvided(args.timezone) ? String(args.timezone) : undefined) ??
    existing?.timezone ??
    userTimezone ??
    "UTC";
  if (!isValidTimezone(timezone)) return undefined;
  const resolved = Object.keys(timing).length > 0 ? resolveScheduleTiming(timing, timezone) : null;
  if (resolved && !resolved.ok) return undefined;
  const newlyRepeats = resolved?.ok === true && !resolved.oneShot;
  const promptChanges = !create && isScheduleValueProvided(args.prompt);
  const existingRepeats = Boolean(existing) && !isOneShotRoutineCrons(existing?.crons ?? []);
  if (!newlyRepeats && !(promptChanges && existingRepeats)) return undefined;

  const name = create ? String(args.name ?? "").trim() : (existing?.name ?? "");
  const crons = resolved?.ok ? [resolved.cron] : (existing?.crons ?? []);
  const when = crons.map(formatCron).join("; ");
  const lines: string[] = [`time zone: ${timezone}`];
  if (resolved?.ok) lines.push(`next run: ${formatLocal(resolved.nextRunAt, timezone)}`);
  if (isScheduleValueProvided(args.prompt)) lines.push(`prompt: ${String(args.prompt).trim()}`);
  // An update keeps the routine's own thread, which may be a group rather than this chat.
  const group = existing?.threadId
    ? (
        await deps.prisma.thread.findUnique({
          where: { id: existing.threadId },
          select: { group: { select: { name: true } } },
        })
      )?.group
    : null;
  const where = group ? `posts in “${group.name}”` : "posts here";
  // The card leads with when it runs and where it posts; the prompt sits under Details.
  return {
    summary: create ? `${when}, ${where}` : `Changing “${name}”: ${when}, ${where}`,
    detail: lines.join("\n"),
  };
}

/**
 * A skill the owner forced in the message that asked for this routine (`/Name`) is kept as an
 * `@Name` mention, which the routine editor lists and the run expands. The model's prompt alone
 * would drop it.
 */
export function keepForcedSkill(prompt: string, requestPrompt: string): string {
  const forced = extractForcedSkillName(requestPrompt);
  if (!forced || prompt.toLowerCase().includes(`@${forced.name.toLowerCase()}`)) return prompt;
  return `@${forced.name} ${prompt}`;
}
