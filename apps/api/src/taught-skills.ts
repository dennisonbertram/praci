import { randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import type {
  AdapterContext,
  AgentHomeStore,
  JobPublisher,
  SandboxProvider,
  SecretStore,
} from "@rakazo/adapter-kit";
import {
  runContinueJob,
  skillTeachingExpireJob,
  skillTeachingExpireJobKey,
} from "@rakazo/adapter-kit";
import type { ComputerExecutionLease, TaughtSkillRow, TeachComputerInput } from "@rakazo/adapters";
import {
  acquireComputerExecutionLease,
  appendRecordingEvent,
  ComputerBusyError,
  captureTeachingSnapshot,
  completeTeachingSession,
  deleteHeldValues,
  emptyRecording,
  expireTaughtSkillTeaching,
  extendActiveComputerControl,
  getActiveTeachingSession,
  listLoginPrompts,
  mapTaughtSkill,
  observeStopSnapshot,
  parsePlaybook,
  parseRecording,
  provisionComputer,
  recordTeachingInputEvent,
  releaseComputerExecutionLease,
  releaseTeachingComputerControlForBot,
  scheduleComputerControlExpiry,
  screenLeaseIdForRun,
  scrubTaughtSkillRow,
  teachingControlLeaseExpiresAt,
} from "@rakazo/adapters";
import type {
  Actor,
  MessageBlock,
  TaughtSkill,
  TaughtSkillSummary,
  TeachTestOutcome,
} from "@rakazo/contracts";
import type { SkillPlaybook, TeachRecordingEvent } from "@rakazo/core";
import {
  ACTIVE_RUN_STATUSES,
  ASK_SIGN_IN_STEP,
  buildPlaybookFromRecording,
  FILL_LOGIN_STEP_PREFIX,
  fillLoginStep,
  formatSkillRunPrompt,
  newRunUnattended,
  PROTECTED_STEP,
  parseSkillResult,
  sanitizeTeachRecordingEvent,
  teachRecordingTtlMs,
} from "@rakazo/core";
import type { createRepos, PrismaClient, ThreadEvents } from "@rakazo/db";
import {
  clearEndedRunState,
  expireComputerExecutionLeases,
  IsolationError,
  isUniqueViolation,
} from "@rakazo/db";

export interface TaughtSkillsDeps {
  prisma: PrismaClient;
  events: ThreadEvents;
  jobs: JobPublisher;
  sandbox: SandboxProvider;
  home: AgentHomeStore;
  dataDir: string;
  /** Encrypts the passwords held until the user saves or skips them. */
  secrets: SecretStore;
  /** The bot's model rewriting coordinate steps as plain steps; absent keeps coordinates. */
  describeSteps?: Parameters<typeof completeTeachingSession>[0]["describeSteps"];
  /** Creates the bot-scoped website login (origin = site) through the credential path. */
  putLogin: (
    actor: Actor,
    botId: string,
    login: { name: string; site: string; username: string; password: string },
  ) => Promise<void>;
}

/** The nearest `Type "..."` step before a password, looking back over a few clicks and keys. */
function findTypedUsername(
  steps: string[],
  passwordIndex: number,
): { index: number; value: string } | undefined {
  for (let index = passwordIndex - 1; index >= Math.max(0, passwordIndex - 4); index -= 1) {
    const step = steps[index] ?? "";
    const typed = step.match(/^Type ("(?:[^"\\]|\\.)*")\.$/);
    if (typed && step !== PROTECTED_STEP) return { index, value: JSON.parse(typed[1]!) as string };
    if (step === PROTECTED_STEP || step.startsWith(FILL_LOGIN_STEP_PREFIX)) return undefined;
  }
  return undefined;
}

const HELD_VALUE_GONE = "The typed value is no longer held. Teach the sign-in again.";

/** The first line of a run's error, trimmed to a short note. */
function testNote(text: string | null | undefined): string | null {
  const line = text?.split("\n").find((entry) => entry.trim());
  return line ? line.trim().slice(0, 200) : null;
}

function computerContext(actor: Actor, botId: string, operationId: string): AdapterContext {
  return {
    operationId,
    traceId: operationId,
    spaceId: actor.spaceId,
    userId: actor.userId,
    botId,
    signal: new AbortController().signal,
  };
}

function ownedSkillWhere(actor: Actor, skillId: string) {
  return { id: skillId, spaceId: actor.spaceId, userId: actor.userId };
}

async function getOwnedSkill(
  deps: TaughtSkillsDeps,
  actor: Actor,
  skillId: string,
): Promise<TaughtSkillRow> {
  const skill = await deps.prisma.taughtSkill.findFirst({ where: ownedSkillWhere(actor, skillId) });
  if (!skill) throw new IsolationError();
  return skill;
}

export async function assertTeachingSendAllowed(
  prisma: PrismaClient,
  spaceId: string,
  botId: string,
): Promise<void> {
  const active = await getActiveTeachingSession(prisma, spaceId, botId);
  if (active) {
    throw new ORPCError("CONFLICT", { message: "Stop teaching first" });
  }
}

async function cancelActiveRuns(
  deps: TaughtSkillsDeps,
  _actor: Actor,
  botId: string,
): Promise<void> {
  const activeRuns = await deps.prisma.run.updateManyAndReturn({
    where: { botId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    data: { status: "cancelled", completedAt: new Date() },
    select: { id: true },
  });
  await clearEndedRunState(
    deps.prisma,
    activeRuns.map((run) => run.id),
  );
  await expireComputerExecutionLeases(deps.prisma, { botId });
  await deps.prisma.computer.updateMany({
    where: { executionBotId: botId },
    data: { executionRunId: null, executionBotId: null, executionLeaseExpiresAt: null },
  });
  await deps.prisma.event.deleteMany({
    where: { type: "thread.progress", runId: { in: activeRuns.map((run) => run.id) } },
  });
}

async function ensureGraphicalComputer(
  deps: TaughtSkillsDeps,
  actor: Actor,
  bot: Awaited<ReturnType<ReturnType<typeof createRepos>["getBot"]>>,
) {
  if (bot.computer?.kind === "desktop") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Teaching needs a graphical sandbox computer, not a desktop host",
    });
  }
  if (!bot.computer) throw new IsolationError();
  if (bot.computer.state !== "running" || !bot.computer.providerRef) {
    const ctx = computerContext(actor, bot.id, "skills.start");
    const manualRunId = `teach:${randomUUID()}`;
    let lease: ComputerExecutionLease | null;
    try {
      lease = await acquireComputerExecutionLease(deps.prisma, {
        computerId: bot.computer.id,
        runId: manualRunId,
        botId: bot.id,
      });
    } catch (error) {
      if (error instanceof ComputerBusyError) {
        throw new ORPCError("CONFLICT", { message: "Computer is busy" });
      }
      throw error;
    }
    try {
      await provisionComputer(deps, bot.computer.id, {
        ...ctx,
        screenLeaseId: screenLeaseIdForRun(lease, manualRunId),
      });
    } catch (error) {
      if (error instanceof ComputerBusyError) {
        throw new ORPCError("CONFLICT", { message: "Computer is busy" });
      }
      throw error;
    } finally {
      await releaseComputerExecutionLease(deps.prisma, lease);
    }
    bot = await deps.prisma.bot.findUniqueOrThrow({
      where: { id: bot.id },
      include: { thread: true, computer: true },
    });
  }
  if (!bot.computer?.providerRef || bot.computer.state !== "running") {
    throw new ORPCError("BAD_REQUEST", { message: "Computer must be running to teach" });
  }
  if (bot.computer.kind === "desktop") {
    throw new ORPCError("BAD_REQUEST", {
      message: "Teaching needs a graphical sandbox computer, not a desktop host",
    });
  }
  return bot;
}

async function grantTakeover(
  deps: TaughtSkillsDeps,
  actor: Actor,
  bot: Awaited<ReturnType<ReturnType<typeof createRepos>["getBot"]>>,
  until: Date,
): Promise<{ bot: typeof bot; leaseId: string }> {
  if (!bot.computer) throw new IsolationError();
  if (await extendActiveComputerControl(deps.prisma, deps.jobs, bot.computer, bot.id, until)) {
    const leaseId = bot.computer.controlLeaseId;
    if (!leaseId) throw new IsolationError();
    return { bot, leaseId };
  }
  const leaseId = randomUUID();
  const expiresAt = teachingControlLeaseExpiresAt(until);
  const granted = await deps.prisma.computer.updateMany({
    where: {
      id: bot.computer.id,
      state: "running",
      OR: [{ controlHolder: { not: "user" } }, { controlBotId: bot.id }],
    },
    data: {
      controlHolder: "user",
      controlLeaseId: leaseId,
      controlLeaseExpiresAt: expiresAt,
      controlBotId: bot.id,
      state: "running",
    },
  });
  if (granted.count !== 1) {
    throw new ORPCError("CONFLICT", { message: "Could not take control of the computer" });
  }
  await scheduleComputerControlExpiry(deps.jobs, bot.computer.id, leaseId, expiresAt);
  if (bot.thread) {
    await deps.events.append({
      spaceId: actor.spaceId,
      threadId: bot.thread.id,
      botId: bot.id,
      type: "computer.takeover.granted",
      payload: { holder: "user", reason: "teaching" },
    });
  }
  return { bot, leaseId };
}

async function updateSkillDraftMessage(
  deps: TaughtSkillsDeps,
  actor: Actor,
  skill: TaughtSkillRow,
  input: {
    name?: string;
    playbook?: SkillPlaybook;
    status?: "draft" | "saved";
  },
): Promise<void> {
  const bot = await deps.prisma.bot.findUnique({
    where: { id: skill.botId },
    include: { thread: true },
  });
  if (!bot?.thread) return;

  const messages = await deps.prisma.message.findMany({
    where: { threadId: bot.thread.id, role: "bot" },
    orderBy: { seq: "desc" },
    take: 100,
  });

  for (const message of messages) {
    const parsed = message.blocks as MessageBlock[];
    if (!Array.isArray(parsed)) continue;
    const index = parsed.findIndex(
      (block) => block.kind === "skill_draft" && block.skillId === skill.id,
    );
    if (index === -1) continue;
    const existing = parsed[index];
    if (existing?.kind !== "skill_draft") continue;
    const playbook = input.playbook ?? parsePlaybook(skill.playbook);
    const nextBlocks: MessageBlock[] = [...parsed];
    nextBlocks[index] = {
      kind: "skill_draft",
      skillId: skill.id,
      name: input.name ?? existing.name,
      goal: skill.goal,
      playbook,
      status: input.status ?? existing.status,
    };
    await deps.prisma.message.update({
      where: { id: message.id },
      data: { blocks: nextBlocks as never },
    });
    await deps.events.append({
      spaceId: actor.spaceId,
      threadId: bot.thread.id,
      botId: bot.id,
      type: "thread.message.updated",
      payload: { messageId: message.id, role: "bot", blocks: nextBlocks },
    });
    return;
  }
}

/** Records how the card's Test run ended, once that run is over. */
async function settleTestOutcome(
  deps: TaughtSkillsDeps,
  row: TaughtSkillRow,
): Promise<TaughtSkillRow> {
  if (!row.lastTestRunId || row.lastTestOutcome) return row;
  const run = await deps.prisma.run.findUnique({
    where: { id: row.lastTestRunId },
    select: { status: true, error: true },
  });
  if (!run) return row;
  let outcome: TeachTestOutcome;
  let note: string | null = null;
  if (run.status === "completed") {
    const reply = await deps.prisma.message.findFirst({
      where: { runId: row.lastTestRunId, role: "bot" },
      orderBy: { seq: "desc" },
      select: { blocks: true },
    });
    const text = ((reply?.blocks ?? []) as { kind?: string; text?: string }[])
      .filter((block) => block.kind === "text")
      .map((block) => block.text ?? "")
      .join("\n");
    ({ outcome, note } = parseSkillResult(text));
  } else if (run.status === "failed" || run.status === "cancelled") {
    outcome = "stopped";
    note =
      testNote(run.error) ?? (run.status === "cancelled" ? "Stopped before it finished" : null);
  } else return row;
  const settled = await deps.prisma.taughtSkill.updateMany({
    where: { id: row.id, lastTestRunId: row.lastTestRunId, lastTestOutcome: null },
    data: { lastTestOutcome: outcome, lastTestNote: note },
  });
  return settled.count === 1 ? { ...row, lastTestOutcome: outcome, lastTestNote: note } : row;
}

async function present(deps: TaughtSkillsDeps, row: TaughtSkillRow): Promise<TaughtSkill> {
  if (row.status === "recording") return mapTaughtSkill(await scrubTaughtSkillRow(deps, row));
  const settled = await settleTestOutcome(deps, row);
  const steps = parsePlaybook(settled.playbook).steps;
  const prompts = (await listLoginPrompts(deps.prisma, settled.id)).map((prompt) => {
    const username = findTypedUsername(steps, prompt.stepIndex)?.value;
    return username ? { ...prompt, username } : prompt;
  });
  return mapTaughtSkill(settled, prompts);
}

/** Rewrites playbook steps and the draft card in the thread. */
async function rewriteSteps(
  deps: TaughtSkillsDeps,
  actor: Actor,
  skill: TaughtSkillRow,
  edits: Map<number, string>,
): Promise<TaughtSkillRow> {
  const playbook = parsePlaybook(skill.playbook);
  const steps = playbook.steps.map((step, index) => edits.get(index) ?? step);
  const row = await deps.prisma.taughtSkill.update({
    where: { id: skill.id },
    data: { playbook: { ...playbook, steps } as never, playbookUpdatedAt: new Date() },
  });
  await updateSkillDraftMessage(deps, actor, row, {
    name: row.name,
    playbook: parsePlaybook(row.playbook),
    status: row.status === "saved" ? "saved" : "draft",
  });
  return row;
}

/** Skipped logins ask the user to sign in; the held value goes with them. */
async function skipHeldLogins(
  deps: TaughtSkillsDeps,
  actor: Actor,
  skill: TaughtSkillRow,
  stepIndex?: number,
): Promise<TaughtSkillRow> {
  const pending = (await listLoginPrompts(deps.prisma, skill.id))
    .filter((prompt) => stepIndex === undefined || prompt.stepIndex === stepIndex)
    .map((prompt) => prompt.stepIndex);
  await deleteHeldValues(deps.prisma, {
    skillId: skill.id,
    ...(stepIndex === undefined ? {} : { stepIndex }),
  });
  // Skipping everything (Save) also covers a step whose value expired: no held row, but the
  // placeholder must not reach a saved skill.
  const orphaned =
    stepIndex === undefined
      ? parsePlaybook(skill.playbook).steps.flatMap((step, index) =>
          step === PROTECTED_STEP ? [index] : [],
        )
      : [];
  const edits = new Map([...pending, ...orphaned].map((index) => [index, ASK_SIGN_IN_STEP]));
  if (edits.size === 0) return skill;
  return rewriteSteps(deps, actor, skill, edits);
}

async function expireTeachingSessionIfNeeded(deps: TaughtSkillsDeps, skillId: string) {
  return expireTaughtSkillTeaching(deps, skillId);
}

async function stopTeachingSession(
  deps: TaughtSkillsDeps,
  actor: Actor,
  skillId: string,
): Promise<TaughtSkill> {
  await getOwnedSkill(deps, actor, skillId);
  await expireTeachingSessionIfNeeded(deps, skillId);
  const current = await deps.prisma.taughtSkill.findUniqueOrThrow({ where: { id: skillId } });
  if (current.status === "draft" || current.status === "saved") {
    await releaseTeachingComputerControlForBot(
      deps,
      actor,
      current.botId,
      parseRecording(current.recording).controlLeaseId,
    );
    return present(deps, current);
  }
  if (current.status !== "recording" && current.status !== "drafting") {
    throw new ORPCError("BAD_REQUEST", { message: "Teaching session is not active" });
  }
  const bot = await deps.prisma.bot.findUnique({
    where: { id: current.botId },
    include: { thread: true, computer: true },
  });
  if (!bot) throw new IsolationError();
  const stopSnapshot =
    current.status === "recording" && bot.computer?.providerRef
      ? await observeStopSnapshot(deps, actor, bot)
      : undefined;
  const finalized = await completeTeachingSession(deps, actor, skillId, "stopped", stopSnapshot);
  await deps.jobs.cancel(skillTeachingExpireJobKey(current.id));
  return present(deps, finalized);
}

export function createTaughtSkillsService(deps: TaughtSkillsDeps) {
  return {
    async list(actor: Actor, botId: string): Promise<TaughtSkill[]> {
      const rows = await deps.prisma.taughtSkill.findMany({
        where: { spaceId: actor.spaceId, botId, userId: actor.userId },
        orderBy: { updatedAt: "desc" },
      });
      return Promise.all(rows.map((row) => present(deps, row)));
    },

    async get(actor: Actor, skillId: string): Promise<TaughtSkill> {
      const row = await getOwnedSkill(deps, actor, skillId);
      await expireTeachingSessionIfNeeded(deps, row.id);
      const current = await deps.prisma.taughtSkill.findUniqueOrThrow({ where: { id: skillId } });
      return present(deps, current);
    },

    async start(actor: Actor, botId: string, goal: string): Promise<TaughtSkill> {
      let bot = await deps.prisma.bot.findFirst({
        where: { id: botId, spaceId: actor.spaceId, userId: actor.userId },
        include: { thread: true, computer: true },
      });
      if (!bot) throw new IsolationError();
      const alreadyRecording = await deps.prisma.taughtSkill.findFirst({
        where: { botId, status: "recording" },
        select: { id: true },
      });
      if (alreadyRecording) {
        throw new ORPCError("CONFLICT", { message: "A teaching session is already active" });
      }
      await cancelActiveRuns(deps, actor, botId);
      bot = await ensureGraphicalComputer(deps, actor, bot);
      const startedAt = new Date();
      const expiresAt = new Date(startedAt.getTime() + teachRecordingTtlMs());
      const { leaseId } = await grantTakeover(deps, actor, bot, expiresAt);
      let row: TaughtSkillRow;
      try {
        row = await deps.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT id FROM bots WHERE id = ${botId} FOR UPDATE`;
          const existing = await tx.taughtSkill.findFirst({
            where: { botId, status: "recording" },
          });
          if (existing) {
            throw new ORPCError("CONFLICT", { message: "A teaching session is already active" });
          }
          return tx.taughtSkill.create({
            data: {
              spaceId: actor.spaceId,
              botId,
              userId: actor.userId,
              goal,
              status: "recording",
              startedAt,
              expiresAt,
              recording: { ...emptyRecording(), controlLeaseId: leaseId } as never,
              playbook: buildPlaybookFromRecording(goal, []) as never,
            },
          });
        });
      } catch (error) {
        if (error instanceof ORPCError) throw error;
        if (isUniqueViolation(error)) {
          throw new ORPCError("CONFLICT", { message: "A teaching session is already active" });
        }
        throw error;
      }
      await deps.jobs.enqueue(skillTeachingExpireJob(row.id, expiresAt));
      const withSnapshot = await captureTeachingSnapshot(deps, actor, bot, row);
      if (bot.thread) {
        await deps.events.append({
          spaceId: actor.spaceId,
          threadId: bot.thread.id,
          botId: bot.id,
          type: "skill.teaching.started",
          payload: { skillId: row.id, goal },
        });
      }
      return present(deps, withSnapshot);
    },

    async appendEvent(
      actor: Actor,
      skillId: string,
      event: TeachRecordingEvent,
    ): Promise<TaughtSkill> {
      await getOwnedSkill(deps, actor, skillId);
      await expireTeachingSessionIfNeeded(deps, skillId);
      const current = await deps.prisma.taughtSkill.findUniqueOrThrow({ where: { id: skillId } });
      if (current.status !== "recording") {
        throw new ORPCError("BAD_REQUEST", { message: "Teaching session is not recording" });
      }
      const updated = await appendRecordingEvent(deps, skillId, event, { requireRecording: true });
      if (updated.status !== "recording") {
        throw new ORPCError("BAD_REQUEST", { message: "Teaching session is not recording" });
      }
      return present(deps, updated);
    },

    async snapshot(actor: Actor, skillId: string): Promise<TaughtSkill> {
      await getOwnedSkill(deps, actor, skillId);
      await expireTeachingSessionIfNeeded(deps, skillId);
      const current = await deps.prisma.taughtSkill.findUniqueOrThrow({ where: { id: skillId } });
      if (current.status !== "recording") {
        throw new ORPCError("BAD_REQUEST", { message: "Teaching session is not recording" });
      }
      const bot = await deps.prisma.bot.findUnique({
        where: { id: current.botId },
        include: { computer: true },
      });
      if (!bot) throw new IsolationError();
      const updated = await captureTeachingSnapshot(deps, actor, bot, current);
      return present(deps, updated);
    },

    stop: (actor: Actor, skillId: string) => stopTeachingSession(deps, actor, skillId),

    async updateDraft(
      actor: Actor,
      skillId: string,
      input: { name?: string; playbook: SkillPlaybook },
    ): Promise<TaughtSkill> {
      const skill = await getOwnedSkill(deps, actor, skillId);
      if (skill.status !== "draft" && skill.status !== "saved") {
        throw new ORPCError("BAD_REQUEST", { message: "Skill is not editable yet" });
      }
      const row = await deps.prisma.taughtSkill.update({
        where: { id: skill.id },
        data: {
          name: input.name ?? skill.name,
          playbook: input.playbook as never,
          playbookUpdatedAt: new Date(),
          status: skill.status === "saved" ? "saved" : "draft",
        },
      });
      await updateSkillDraftMessage(deps, actor, row, {
        name: row.name,
        playbook: parsePlaybook(row.playbook),
        status: row.status === "saved" ? "saved" : "draft",
      });
      // An edit that removed the protected step leaves its held value with nothing to fill.
      const edited = parsePlaybook(row.playbook);
      for (const prompt of await listLoginPrompts(deps.prisma, row.id)) {
        if (edited.steps[prompt.stepIndex] !== PROTECTED_STEP) {
          await deleteHeldValues(deps.prisma, { skillId: row.id, stepIndex: prompt.stepIndex });
        }
      }
      return present(deps, row);
    },

    async save(actor: Actor, skillId: string, name?: string): Promise<TaughtSkill> {
      const skill = await getOwnedSkill(deps, actor, skillId);
      if (skill.status !== "draft" && skill.status !== "saved") {
        throw new ORPCError("BAD_REQUEST", { message: "Finish recording before saving" });
      }
      // A password nobody saved as a login is dropped now: its step asks the user to sign in.
      const settled = await skipHeldLogins(deps, actor, skill);
      const row = await deps.prisma.taughtSkill.update({
        where: { id: settled.id },
        data: {
          status: "saved",
          name: name ?? (settled.name || settled.goal.slice(0, 80)),
          // Nothing reads the raw events after Stop, so the saved skill keeps only its playbook.
          recording: {
            events: [],
            snapshots: [],
            ...(parseRecording(settled.recording).controlLeaseId
              ? { controlLeaseId: parseRecording(settled.recording).controlLeaseId }
              : {}),
          } as never,
        },
      });
      const bot = await deps.prisma.bot.findUnique({
        where: { id: row.botId },
        include: { thread: true },
      });
      await updateSkillDraftMessage(deps, actor, row, {
        name: row.name,
        playbook: parsePlaybook(row.playbook),
        status: "saved",
      });
      if (bot?.thread) {
        await deps.events.append({
          spaceId: actor.spaceId,
          threadId: bot.thread.id,
          botId: bot.id,
          type: "skill.saved",
          payload: { skillId: row.id, name: row.name },
        });
      }
      return present(deps, row);
    },

    async testRun(actor: Actor, skillId: string, prompt?: string): Promise<{ runId: string }> {
      const skill = await getOwnedSkill(deps, actor, skillId);
      if (skill.status !== "saved" && skill.status !== "draft") {
        throw new ORPCError("BAD_REQUEST", { message: "Skill must be saved or drafted first" });
      }
      const bot = await deps.prisma.bot.findUnique({
        where: { id: skill.botId },
        include: { thread: true },
      });
      if (!bot?.thread) throw new IsolationError();
      const playbook = parsePlaybook(skill.playbook);
      const taskPrompt =
        prompt ?? formatSkillRunPrompt(skill.name || skill.goal.slice(0, 80), playbook, true);
      const task = await deps.prisma.task.create({
        data: {
          spaceId: actor.spaceId,
          botId: bot.id,
          threadId: bot.thread.id,
          userId: actor.userId,
          prompt: taskPrompt,
          status: "queued",
        },
      });
      const run = await deps.prisma.run.create({
        data: {
          spaceId: actor.spaceId,
          botId: bot.id,
          threadId: bot.thread.id,
          taskId: task.id,
          userId: actor.userId,
          status: "queued",
          trigger: "skill",
          unattended: newRunUnattended({ trigger: "skill" }),
        },
      });
      await deps.prisma.taughtSkill.update({
        where: { id: skill.id },
        data: {
          lastRunAt: new Date(),
          lastTestRunId: run.id,
          lastTestOutcome: null,
          lastTestNote: null,
        },
      });
      await deps.jobs.enqueue(runContinueJob(run.id));
      return { runId: run.id };
    },

    async remove(actor: Actor, skillId: string): Promise<{ ok: true }> {
      const skill = await getOwnedSkill(deps, actor, skillId);
      if (skill.status === "recording") {
        await deps.jobs.cancel(skillTeachingExpireJobKey(skill.id));
        await releaseTeachingComputerControlForBot(
          deps,
          actor,
          skill.botId,
          parseRecording(skill.recording).controlLeaseId,
        );
      }
      await deleteHeldValues(deps.prisma, { skillId: skill.id });
      // Routines that only ran this skill have nothing left to run; the FK clears their reference.
      await deps.prisma.routine.updateMany({
        where: { taughtSkillId: skill.id, prompt: "", active: true },
        data: { active: false, nextRunAt: null },
      });
      await deps.prisma.taughtSkill.delete({ where: { id: skill.id } });
      return { ok: true as const };
    },

    /** Ends a recording and keeps nothing: no events, held values or skill row. */
    async cancel(actor: Actor, skillId: string): Promise<{ ok: true }> {
      const skill = await getOwnedSkill(deps, actor, skillId);
      if (skill.status === "saved") {
        throw new ORPCError("BAD_REQUEST", { message: "A saved skill is deleted, not cancelled" });
      }
      return this.remove(actor, skillId);
    },

    async listSaved(actor: Actor, botId: string): Promise<TaughtSkillSummary[]> {
      const rows = await deps.prisma.taughtSkill.findMany({
        where: { spaceId: actor.spaceId, botId, userId: actor.userId, status: "saved" },
        orderBy: { updatedAt: "desc" },
      });
      return rows.map((row) => ({
        id: row.id,
        name: row.name || row.goal.slice(0, 80),
        goal: row.goal,
        lastRunAt: row.lastRunAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    /** Saves the password typed at `stepIndex` as a login on `site`; the step then fills it. */
    async saveLogin(
      actor: Actor,
      input: {
        skillId: string;
        stepIndex: number;
        name: string;
        site: string;
        username: string;
      },
    ): Promise<TaughtSkill> {
      const skill = await getOwnedSkill(deps, actor, input.skillId);
      if (skill.status !== "draft" && skill.status !== "saved") {
        throw new ORPCError("BAD_REQUEST", { message: "Finish recording first" });
      }
      const playbook = parsePlaybook(skill.playbook);
      if (playbook.steps[input.stepIndex] !== PROTECTED_STEP) {
        throw new ORPCError("BAD_REQUEST", { message: "That step is not a typed password" });
      }
      const held = await deps.prisma.teachHeldValue.findFirst({
        where: {
          skillId: skill.id,
          spaceId: actor.spaceId,
          userId: actor.userId,
          stepIndex: input.stepIndex,
          expiresAt: { gt: new Date() },
        },
      });
      if (!held) throw new ORPCError("NOT_FOUND", { message: HELD_VALUE_GONE });
      // The username is what the user confirmed. The typed step before the password is only
      // offered as a suggestion, and is rewritten only when it is exactly that value.
      const typed = findTypedUsername(playbook.steps, input.stepIndex);
      const username = input.username.trim();
      if (!username) {
        throw new ORPCError("BAD_REQUEST", { message: "Add the username for this login" });
      }
      let site: string;
      try {
        // "crm.example.com/login" and "https://crm.example.com/login" both mean the site's origin.
        site = new URL(
          /^[a-z][a-z0-9+.-]*:\/\//i.test(input.site) ? input.site : `https://${input.site}`,
        ).origin;
      } catch {
        throw new ORPCError("BAD_REQUEST", { message: "Enter the address of the site" });
      }
      await deps.putLogin(actor, skill.botId, {
        name: input.name,
        site,
        username,
        password: await deps.secrets.load(held.ciphertext, held.id),
      });
      await deleteHeldValues(deps.prisma, { skillId: skill.id, stepIndex: input.stepIndex });
      const edits = new Map([[input.stepIndex, fillLoginStep(input.name, held.field)]]);
      if (typed?.value === username) edits.set(typed.index, fillLoginStep(input.name, "Username"));
      return present(deps, await rewriteSteps(deps, actor, skill, edits));
    },

    /** Drops the password typed at `stepIndex`; the step asks the user to sign in. */
    async skipLogin(
      actor: Actor,
      input: { skillId: string; stepIndex: number },
    ): Promise<TaughtSkill> {
      const skill = await getOwnedSkill(deps, actor, input.skillId);
      if (skill.status !== "draft" && skill.status !== "saved") {
        throw new ORPCError("BAD_REQUEST", { message: "Finish recording first" });
      }
      if (parsePlaybook(skill.playbook).steps[input.stepIndex] !== PROTECTED_STEP) {
        throw new ORPCError("BAD_REQUEST", { message: "That step is not a typed password" });
      }
      return present(deps, await skipHeldLogins(deps, actor, skill, input.stepIndex));
    },

    /** A file the user uploaded through the Files window while recording: the path, not the content. */
    async recordFile(actor: Actor, botId: string, path: string): Promise<void> {
      const active = await getActiveTeachingSession(
        deps.prisma,
        actor.spaceId,
        botId,
        actor.userId,
      );
      if (!active) return;
      await appendRecordingEvent(
        deps,
        active.id,
        sanitizeTeachRecordingEvent({ at: new Date().toISOString(), kind: "file", path }),
        { requireRecording: true },
      );
    },

    expireTeachingSessionIfNeeded: (skillId: string) =>
      expireTeachingSessionIfNeeded(deps, skillId),

    async recordInput(
      actor: Actor,
      botId: string,
      mapped: TeachComputerInput,
    ): Promise<"recorded" | "idle" | "stale"> {
      return recordTeachingInputEvent(deps, actor, botId, mapped);
    },
  };
}
