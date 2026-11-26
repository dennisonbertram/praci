import type {
  AdapterContext,
  ComputerInput,
  ControlLeaseRef,
  JobPublisher,
  SandboxProvider,
  SecretStore,
} from "@rakazo/adapter-kit";
import { computerControlExpireJobKey, skillTeachingExpireJobKey } from "@rakazo/adapter-kit";
import type {
  Actor,
  MessageBlock,
  TaughtSkill,
  TeachLoginPrompt,
  TeachTestOutcome,
} from "@rakazo/contracts";
import type { SkillPlaybook, TeachRecordingEvent, TeachSnapshot } from "@rakazo/core";
import {
  applyPlainSteps,
  buildPlaybookFromRecording,
  buildPlaybookWithProtected,
  computerInputForDomKey,
  isProtectedFieldLabel,
  redactSecretText,
  sanitizeTeachRecordingEvent,
  splitWindowTitle,
} from "@rakazo/core";
import type { Prisma, PrismaClient, ThreadEvents } from "@rakazo/db";
import {
  appendEventInTransaction,
  createThreadMessageInTransaction,
  IsolationError,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { revokeScreenControl } from "./computer-control.js";
import { scheduleComputerSleep } from "./computer-idle.js";
import { toComputerRef } from "./computer-support.js";
import { appendHeldValue, readHeldValues, scrubHeld } from "./teach-held-values.js";

export type TaughtSkillRow = {
  id: string;
  spaceId: string;
  botId: string;
  userId: string;
  name: string;
  goal: string;
  status: string;
  playbook: unknown;
  recording: unknown;
  startedAt: Date | null;
  expiresAt: Date | null;
  stoppedAt: Date | null;
  lastRunAt?: Date | null;
  lastTestRunId?: string | null;
  lastTestOutcome?: string | null;
  lastTestNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Window titles are sampled at most this often while recording. */
const WINDOW_SAMPLE_MS = 3_000;

/** What the last focus check found; cleared by every click and navigation key. */
type FocusState = { protected: boolean; field?: string };

type TeachRecording = {
  events: TeachRecordingEvent[];
  snapshots: TeachSnapshot[];
  controlLeaseId?: string;
  /** Kept with the recording, not in process memory, so any API process sees the same answer. */
  focus?: FocusState;
};

export type TeachComputerInput = (
  | ComputerInput
  | { kind: "scroll"; direction: "up" | "down"; amount?: number }
) & {
  sensitive?: boolean;
  skillId?: string;
  /** Label of the focused field, when the client knows it ("Password"). */
  field?: string;
};

export interface TeachingSessionDeps {
  prisma: PrismaClient;
  events: ThreadEvents;
  jobs: JobPublisher;
  sandbox: SandboxProvider;
  /** Encrypts held passwords. Without it a protected value is dropped and cannot be saved as a login. */
  secrets?: SecretStore;
  /** One model call that rewrites sanitized coordinate steps as plain steps; null falls back to them. */
  describeSteps?: (input: {
    scope: { userId: string; spaceId: string; botId: string };
    goal: string;
    steps: string[];
  }) => Promise<string[] | null>;
}

export function emptyRecording(): TeachRecording {
  return { events: [], snapshots: [] };
}

export function parseRecording(value: unknown): TeachRecording {
  if (!value || typeof value !== "object") return emptyRecording();
  const record = value as Partial<TeachRecording>;
  return {
    events: Array.isArray(record.events) ? (record.events as TeachRecordingEvent[]) : [],
    snapshots: Array.isArray(record.snapshots) ? (record.snapshots as TeachSnapshot[]) : [],
    controlLeaseId: typeof record.controlLeaseId === "string" ? record.controlLeaseId : undefined,
    focus:
      record.focus && typeof record.focus.protected === "boolean"
        ? { protected: record.focus.protected, field: record.focus.field }
        : undefined,
  };
}

export function parsePlaybook(value: unknown): SkillPlaybook {
  if (!value || typeof value !== "object") {
    return buildPlaybookFromRecording("", []);
  }
  const record = value as Partial<SkillPlaybook>;
  return {
    whenToUse: String(record.whenToUse ?? ""),
    inputs: Array.isArray(record.inputs) ? record.inputs.map(String) : [],
    steps: Array.isArray(record.steps) ? record.steps.map(String) : [],
    howToCheck: String(record.howToCheck ?? ""),
    whatToReturn: String(record.whatToReturn ?? ""),
    approvalBoundaries: String(record.approvalBoundaries ?? ""),
    failureHandling: String(record.failureHandling ?? ""),
  };
}

export function mapTaughtSkill(
  row: TaughtSkillRow,
  loginPrompts: TeachLoginPrompt[] = [],
): TaughtSkill {
  const { focus: _focus, ...recording } = parseRecording(row.recording);
  return {
    id: row.id,
    botId: row.botId,
    name: row.name,
    goal: row.goal,
    status: row.status as TaughtSkill["status"],
    playbook: parsePlaybook(row.playbook),
    recording,
    startedAt: row.startedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    stoppedAt: row.stoppedAt?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastTestOutcome: (row.lastTestOutcome as TeachTestOutcome | null | undefined) ?? null,
    lastTestNote: row.lastTestNote ?? null,
    loginPrompts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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

export async function getActiveTeachingSession(
  prisma: PrismaClient,
  spaceId: string,
  botId: string,
  userId?: string,
) {
  return prisma.taughtSkill.findFirst({
    where: {
      spaceId,
      botId,
      status: "recording",
      ...(userId ? { userId } : {}),
    },
  });
}

function recordingEventKey(event: TeachRecordingEvent): string {
  return JSON.stringify(event);
}

async function mutateRecording(
  deps: TeachingSessionDeps,
  skillId: string,
  mutate: (
    recording: TeachRecording,
    held: readonly { value: string }[],
  ) => { recording: TeachRecording; changed: boolean },
  options?: { requireRecording?: boolean },
): Promise<TaughtSkillRow> {
  return deps.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM taught_skills WHERE id = ${skillId} FOR UPDATE`;
    const skill = await tx.taughtSkill.findUniqueOrThrow({ where: { id: skillId } });
    if (options?.requireRecording !== false && skill.status !== "recording") {
      return skill;
    }
    if (skill.expiresAt && skill.expiresAt.getTime() <= Date.now()) {
      return skill;
    }
    const current = parseRecording(skill.recording);
    // Anything written while a password is held is scrubbed against it before it reaches Postgres.
    const held = deps.secrets ? await readHeldValues(tx, deps.secrets, skillId) : [];
    const next = mutate(current, held);
    if (!next.changed) return skill;
    return tx.taughtSkill.update({
      where: { id: skillId },
      data: { recording: next.recording as never },
    });
  });
}

export async function observeStopSnapshot(
  deps: TeachingSessionDeps,
  actor: Actor,
  bot: { id: string; computer: { providerRef: string | null } | null },
): Promise<TeachSnapshot | undefined> {
  if (!bot.computer?.providerRef) return undefined;
  try {
    const observation = await deps.sandbox.observe(
      toComputerRef(bot.computer as never),
      computerContext(actor, bot.id, "skills.snapshot"),
    );
    const summary =
      typeof observation === "object" &&
      observation &&
      "activeWindow" in observation &&
      observation.activeWindow &&
      typeof observation.activeWindow === "object" &&
      "title" in observation.activeWindow
        ? String((observation.activeWindow as { title?: string }).title ?? "screen captured")
        : "screen captured";
    return { at: new Date().toISOString(), summary };
  } catch {
    return undefined;
  }
}

/** `text` without any held value, and without anything that looks like a secret. */
function scrubText(text: string, held: readonly { value: string }[]): string {
  return redactSecretText(scrubHeld(text, held));
}

function scrubEvent(
  event: TeachRecordingEvent,
  held: readonly { value: string }[],
): TeachRecordingEvent {
  const scrub = (text: string | undefined) => (text ? scrubText(text, held) : text);
  return {
    ...event,
    ...(event.summary ? { summary: scrub(event.summary) } : {}),
    ...(event.title ? { title: scrub(event.title) } : {}),
    ...(event.app ? { app: scrub(event.app) } : {}),
    ...(event.path ? { path: scrub(event.path) } : {}),
    ...(event.command ? { command: scrub(event.command) } : {}),
    ...(event.text && !event.sensitive ? { text: scrubHeld(event.text, held) } : {}),
  };
}

/** The recording with every held password removed from the text that may echo it. */
export function scrubRecording(
  recording: TeachRecording,
  held: readonly { value: string }[],
): TeachRecording {
  const { focus: _focus, ...rest } = recording;
  return {
    ...rest,
    events: recording.events.map((event) => scrubEvent(event, held)),
    snapshots: recording.snapshots.map((snapshot) => ({
      ...snapshot,
      summary: scrubText(snapshot.summary, held),
    })),
  };
}

/** A recording row as the user may see it: the stored text is scrubbed against what is held now. */
export async function scrubTaughtSkillRow<Row extends TaughtSkillRow>(
  deps: Pick<TeachingSessionDeps, "prisma" | "secrets">,
  row: Row,
): Promise<Row> {
  if (!deps.secrets || (row.status !== "recording" && row.status !== "drafting")) return row;
  const held = await readHeldValues(deps.prisma, deps.secrets, row.id);
  if (held.length === 0) return row;
  return { ...row, recording: scrubRecording(parseRecording(row.recording), held) };
}

type PlainSteps = { steps: string[]; eventCount: number };

async function finalizeTeachingRecording(
  deps: TeachingSessionDeps,
  actor: Actor,
  skillId: string,
  reason: "stopped" | "expired",
  stopSnapshot?: TeachSnapshot,
  plain?: PlainSteps | null,
): Promise<{ skill: TaughtSkillRow; stopped: { threadId: string; seq: number } | null }> {
  return deps.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM taught_skills WHERE id = ${skillId} FOR UPDATE`;
    const skill = await tx.taughtSkill.findUniqueOrThrow({ where: { id: skillId } });
    if (skill.status === "draft" || skill.status === "saved") {
      return { skill, stopped: null };
    }
    if (skill.status !== "recording" && skill.status !== "drafting") {
      throw new Error("Teaching session is not active");
    }
    const held = deps.secrets ? await readHeldValues(tx, deps.secrets, skillId) : [];
    const recording = scrubRecording(parseRecording(skill.recording), held);
    if (stopSnapshot) {
      const summary = scrubText(stopSnapshot.summary, held);
      recording.snapshots.push({ ...stopSnapshot, summary });
      recording.events.push({ at: stopSnapshot.at, kind: "snapshot", summary });
    }
    const built = buildPlaybookWithProtected(skill.goal, recording.events, recording.snapshots);
    let { playbook, protectedSteps } = built;
    const applied =
      plain && plain.eventCount === parseRecording(skill.recording).events.length
        ? applyPlainSteps(protectedSteps, plain.steps)
        : null;
    if (applied) {
      playbook = { ...playbook, steps: applied.steps };
      protectedSteps = applied.protectedSteps;
    }
    // Each held value belongs to one step; a value with no step has nothing to fill.
    if (deps.secrets) {
      await tx.teachHeldValue.deleteMany({
        where: { skillId, segment: { notIn: protectedSteps.map((step) => step.segment) } },
      });
      for (const step of protectedSteps) {
        await tx.teachHeldValue.updateMany({
          where: { skillId, segment: step.segment },
          data: { stepIndex: step.stepIndex },
        });
      }
    }
    const updated = await tx.taughtSkill.update({
      where: { id: skillId },
      data: {
        status: "draft",
        recording: recording as never,
        playbook: playbook as never,
        playbookUpdatedAt: new Date(),
        stoppedAt: new Date(),
      },
    });
    // The stopped event must commit with the status flip; appended afterwards it is lost for
    // good when the process dies in between, because retries see a draft and skip it.
    const bot = await tx.bot.findUnique({
      where: { id: skill.botId },
      include: { thread: true },
    });
    let stopped: { threadId: string; seq: number } | null = null;
    if (bot?.thread) {
      const event = await appendEventInTransaction(tx, {
        spaceId: actor.spaceId,
        threadId: bot.thread.id,
        botId: skill.botId,
        type: "skill.teaching.stopped",
        payload: { skillId: skill.id, reason },
      });
      stopped = { threadId: bot.thread.id, seq: event.seq };
    }
    return { skill: updated, stopped };
  });
}

export async function appendRecordingEvent(
  deps: TeachingSessionDeps,
  skillId: string,
  event: TeachRecordingEvent,
  options?: { requireRecording?: boolean },
): Promise<TaughtSkillRow> {
  return mutateRecording(
    deps,
    skillId,
    (recording, held) => {
      const stored = scrubEvent(sanitizeTeachRecordingEvent(event), held);
      const key = recordingEventKey(stored);
      if (recording.events.some((existing) => recordingEventKey(existing) === key)) {
        return { recording, changed: false };
      }
      recording.events.push(stored);
      return { recording, changed: true };
    },
    options,
  );
}

export async function releaseTeachingComputerControlForBot(
  deps: TeachingSessionDeps,
  actor: Actor,
  botId: string,
  expectedLeaseId?: string | null,
): Promise<void> {
  const bot = await deps.prisma.bot.findUnique({
    where: { id: botId },
    include: { computer: true },
  });
  if (!bot) return;
  await releaseTeachingComputerControl(deps, actor, bot, expectedLeaseId);
}

async function releaseTeachingComputerControl(
  deps: TeachingSessionDeps,
  actor: Actor,
  bot: {
    id: string;
    computer: {
      id: string;
      homeKey: string;
      kind: string;
      providerRef: string | null;
      controlHolder: string;
      controlBotId: string | null;
      controlLeaseId: string | null;
      controlRunId: string | null;
    } | null;
  },
  expectedLeaseId?: string | null,
): Promise<void> {
  const computer = bot.computer;
  if (
    computer?.controlHolder !== "user" ||
    computer.controlBotId !== bot.id ||
    !computer.controlLeaseId
  ) {
    return;
  }
  if (!expectedLeaseId || computer.controlLeaseId !== expectedLeaseId) return;
  const leaseId = computer.controlLeaseId;
  await revokeScreenControl(
    deps,
    computer,
    computerContext(actor, bot.id, "skills.release"),
    leaseId,
  );
  await deps.jobs.cancel(computerControlExpireJobKey(computer.id, leaseId));
  await deps.events.finalizeComputerControlRelease({
    spaceId: actor.spaceId,
    computerId: computer.id,
    botId: bot.id,
    runId: computer.controlRunId,
    leaseId,
    holder: "bot",
    reason: "released",
  });
  await scheduleComputerSleep(deps.jobs, computer.id);
}

function skillDraftBlocks(skill: TaughtSkillRow): MessageBlock[] {
  return [
    {
      kind: "skill_draft",
      skillId: skill.id,
      name: skill.name || skill.goal.slice(0, 80),
      goal: skill.goal,
      playbook: parsePlaybook(skill.playbook),
      status: "draft",
    },
  ];
}

async function findSkillDraftMessage(
  prisma: { message: { findMany: PrismaClient["message"]["findMany"] } },
  threadId: string,
  skillId: string,
): Promise<{ id: string; blocks: MessageBlock[] } | null> {
  const messages = await prisma.message.findMany({
    where: { threadId, role: "bot" },
    orderBy: { seq: "desc" },
    take: 100,
    select: { id: true, blocks: true },
  });
  for (const message of messages) {
    const blocks = message.blocks as MessageBlock[];
    if (
      Array.isArray(blocks) &&
      blocks.some((block) => block.kind === "skill_draft" && block.skillId === skillId)
    ) {
      return { id: message.id, blocks };
    }
  }
  return null;
}

async function hasSkillDraftCreatedEvent(
  prisma: { event: { findMany: PrismaClient["event"]["findMany"] } },
  threadId: string,
  skillId: string,
): Promise<boolean> {
  const events = await prisma.event.findMany({
    where: { threadId, type: "skill.draft.created" },
    select: { payload: true },
    take: 50,
  });
  return events.some((event) => {
    const payload = event.payload;
    return (
      payload !== null &&
      typeof payload === "object" &&
      "skillId" in payload &&
      payload.skillId === skillId
    );
  });
}

async function emitSkillDraftMessages(
  deps: TeachingSessionDeps,
  actor: Actor,
  skill: TaughtSkillRow,
  bot: { id: string; thread: { id: string } | null },
): Promise<void> {
  if (skill.status !== "draft" || !bot.thread) return;
  const threadId = bot.thread.id;
  const published = await deps.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT id FROM taught_skills WHERE id = ${skill.id} FOR UPDATE`;
    let created = await findSkillDraftMessage(tx, threadId, skill.id);
    if (!created) {
      const blocks = skillDraftBlocks(skill);
      const message = await createThreadMessageInTransaction(tx, {
        threadId,
        role: "bot",
        blocks,
      });
      created = { id: message.id, blocks };
    }
    if (await hasSkillDraftCreatedEvent(tx, threadId, skill.id)) return null;
    await appendEventInTransaction(tx, {
      spaceId: actor.spaceId,
      threadId,
      botId: bot.id,
      type: "thread.message.created",
      payload: { messageId: created.id, role: "bot", blocks: created.blocks },
    });
    const draftEvent = await appendEventInTransaction(tx, {
      spaceId: actor.spaceId,
      threadId,
      botId: bot.id,
      type: "skill.draft.created",
      payload: { skillId: skill.id, name: skill.name || skill.goal.slice(0, 80) },
    });
    return draftEvent.seq;
  });
  if (published != null) await deps.events.notify(threadId, published);
}

/**
 * Asks the bot's model to rewrite the sanitized steps in plain words. It sees the same text the
 * draft card would show, so it never receives a typed password. Any failure keeps the
 * coordinate steps.
 */
async function describePlainSteps(
  deps: TeachingSessionDeps,
  skillId: string,
): Promise<PlainSteps | null> {
  if (!deps.describeSteps) return null;
  try {
    const skill = await deps.prisma.taughtSkill.findUnique({ where: { id: skillId } });
    if (!skill || (skill.status !== "recording" && skill.status !== "drafting")) return null;
    const held = deps.secrets ? await readHeldValues(deps.prisma, deps.secrets, skillId) : [];
    const stored = parseRecording(skill.recording);
    const recording = scrubRecording(stored, held);
    const { playbook, protectedSteps } = buildPlaybookWithProtected(
      skill.goal,
      recording.events,
      recording.snapshots,
    );
    if (playbook.steps.length < 2 && protectedSteps.length === 0) return null;
    const steps = await deps.describeSteps({
      scope: { userId: skill.userId, spaceId: skill.spaceId, botId: skill.botId },
      goal: skill.goal,
      steps: playbook.steps,
    });
    return steps ? { steps, eventCount: stored.events.length } : null;
  } catch (error) {
    getLogger().warn("teach steps failed; keeping coordinate steps", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function completeTeachingSession(
  deps: TeachingSessionDeps,
  actor: Actor,
  skillId: string,
  reason: "stopped" | "expired",
  stopSnapshot?: TeachSnapshot,
): Promise<TaughtSkillRow> {
  lastWindowSample.delete(skillId);
  const plain = await describePlainSteps(deps, skillId);
  const { skill: finalized, stopped } = await finalizeTeachingRecording(
    deps,
    actor,
    skillId,
    reason,
    stopSnapshot,
    plain,
  );
  const bot = await deps.prisma.bot.findUnique({
    where: { id: finalized.botId },
    include: { thread: true, computer: true },
  });
  if (!bot) throw new IsolationError();
  await releaseTeachingComputerControlForBot(
    deps,
    actor,
    bot.id,
    parseRecording(finalized.recording).controlLeaseId,
  );
  if (finalized.status === "draft") {
    await emitSkillDraftMessages(deps, actor, finalized, bot);
  }
  if (stopped) await deps.events.notify(stopped.threadId, stopped.seq);
  return finalized;
}

export async function expireTaughtSkillTeaching(
  deps: TeachingSessionDeps,
  skillId: string,
): Promise<TaughtSkillRow | null> {
  const skill = await deps.prisma.taughtSkill.findUnique({ where: { id: skillId } });
  if (!skill) return null;
  const actor = { spaceId: skill.spaceId, userId: skill.userId } as Actor;
  if (skill.status !== "recording") {
    const leaseId = parseRecording(skill.recording).controlLeaseId;
    if (leaseId) await releaseTeachingComputerControlForBot(deps, actor, skill.botId, leaseId);
    if (skill.status === "draft") {
      const bot = await deps.prisma.bot.findUnique({
        where: { id: skill.botId },
        include: { thread: true },
      });
      if (bot) await emitSkillDraftMessages(deps, actor, skill, bot);
    }
    return skill;
  }
  if (!skill.expiresAt || skill.expiresAt.getTime() > Date.now()) {
    return skill;
  }
  const bot = await deps.prisma.bot.findUnique({
    where: { id: skill.botId },
    include: { thread: true, computer: true },
  });
  if (!bot) return skill;
  const stopSnapshot = bot.computer?.providerRef
    ? await observeStopSnapshot(deps, actor, bot)
    : undefined;
  const finalized = await completeTeachingSession(deps, actor, skill.id, "expired", stopSnapshot);
  await deps.jobs.cancel(skillTeachingExpireJobKey(skill.id));
  return finalized;
}

export async function applyTeachingDesktopInput(
  sandbox: SandboxProvider,
  computer: {
    homeKey: string;
    kind: string;
    providerRef: string | null;
    controlLeaseId: string | null;
  },
  mapped: TeachComputerInput,
  context: AdapterContext,
): Promise<void> {
  if (!computer.providerRef) return;
  const lease: ControlLeaseRef = {
    leaseId: computer.controlLeaseId ?? "lease",
    holder: "user",
    fence: 0,
  };
  if (mapped.kind === "scroll") {
    await sandbox.act(
      toComputerRef(computer),
      {
        actions: [{ kind: "scroll", direction: mapped.direction, amount: mapped.amount }],
        observe: false,
      },
      context,
    );
    return;
  }
  const { skillId: _skillId, ...desktop } = mapped;
  const input: ComputerInput =
    desktop.kind === "key" && desktop.key && !desktop.modifiers?.length
      ? computerInputForDomKey(desktop.key)
      : desktop;
  await sandbox.sendInput(toComputerRef(computer), input, lease, context);
}

function protectedInputMissesRecording(
  mapped: TeachComputerInput,
  activeSkillId: string | undefined,
): boolean {
  return mapped.sensitive === true && Boolean(mapped.skillId) && activeSkillId !== mapped.skillId;
}

export async function recordTeachingInputEvent(
  deps: TeachingSessionDeps,
  actor: Actor,
  botId: string,
  mapped: TeachComputerInput,
): Promise<"recorded" | "idle" | "stale"> {
  const skill = await getActiveTeachingSession(deps.prisma, actor.spaceId, botId, actor.userId);
  // Protected input names the recording it was queued for, so a later one cannot receive it.
  if (protectedInputMissesRecording(mapped, skill?.id)) return "stale";
  if (!skill) return "idle";
  if (skill.expiresAt && skill.expiresAt.getTime() <= Date.now()) {
    await expireTaughtSkillTeaching(deps, skill.id);
    return "stale";
  }
  const prepared = await deps.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM taught_skills WHERE id = ${skill.id} FOR UPDATE`;
    const current = await tx.taughtSkill.findUniqueOrThrow({ where: { id: skill.id } });
    if (current.status !== "recording") return { kind: "stale" as const };
    if (current.expiresAt && current.expiresAt.getTime() <= Date.now()) {
      return { kind: "expired" as const };
    }
    const bot = await tx.bot.findUnique({
      where: { id: botId },
      include: { computer: true },
    });
    return {
      kind: "ready" as const,
      computer: bot?.computer ?? null,
      focus: parseRecording(current.recording).focus,
    };
  });
  if (prepared.kind === "expired") {
    await expireTaughtSkillTeaching(deps, skill.id);
    return "stale";
  }
  if (prepared.kind === "stale") return "stale";
  // The browser tells us which field has focus; the web client cannot, because the screen is
  // a VNC picture. The answer lasts until the next click or navigation key.
  const typing = isTypingInput(mapped);
  let focus = prepared.focus;
  let input: TeachComputerInput = mapped;
  if (typing && !mapped.sensitive) {
    if (!focus && prepared.computer?.providerRef) {
      focus = await detectProtectedFocus(deps, actor, botId, prepared.computer);
    }
    if (focus?.protected) {
      input = { ...mapped, sensitive: true, field: mapped.field ?? focus.field };
    }
  }

  const event = sanitizeTeachRecordingEvent({
    at: new Date().toISOString(),
    kind: input.kind === "scroll" ? "scroll" : input.kind,
    ...(input.sensitive ? { sensitive: true as const } : {}),
    ...(input.field && (input.kind === "key" || input.kind === "clipboard")
      ? { field: input.field.slice(0, 120) }
      : {}),
    ...(input.kind === "key"
      ? { key: input.key }
      : input.kind === "clipboard"
        ? { text: input.text }
        : input.kind === "scroll"
          ? { type: input.direction, text: String(input.amount ?? 3) }
          : {
              x: input.x,
              y: input.y,
              button: input.button,
              type: input.type,
            }),
  });
  if (prepared.computer?.providerRef) {
    // The row lock above does not cover sandbox IO. Only protected input is
    // bound to a recording, so ordinary events skip this extra read.
    if (mapped.sensitive === true && mapped.skillId) {
      const active = await getActiveTeachingSession(
        deps.prisma,
        actor.spaceId,
        botId,
        actor.userId,
      );
      if (protectedInputMissesRecording(mapped, active?.id)) return "stale";
    }
    await applyTeachingDesktopInput(
      deps.sandbox,
      prepared.computer,
      mapped,
      computerContext(actor, botId, "input"),
    );
  }
  const recorded = await deps.prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM taught_skills WHERE id = ${skill.id} FOR UPDATE`;
    const current = await tx.taughtSkill.findUniqueOrThrow({ where: { id: skill.id } });
    if (current.status !== "recording") return "stale" as const;
    if (current.expiresAt && current.expiresAt.getTime() <= Date.now()) return "expired" as const;
    const recording = parseRecording(current.recording);
    if (deps.secrets && event.sensitive && (input.kind === "key" || input.kind === "clipboard")) {
      // Consecutive keystrokes into a protected field are one value; a paste is its own.
      const last = recording.events.at(-1);
      const segment =
        input.kind === "key" && last?.sensitive && last.kind === "key" && last.segment != null
          ? last.segment
          : Math.max(-1, ...recording.events.map((entry) => entry.segment ?? -1)) + 1;
      event.segment = segment;
      await appendHeldValue(tx, deps.secrets, {
        skillId: skill.id,
        spaceId: skill.spaceId,
        userId: skill.userId,
        segment,
        field: event.field,
        input:
          input.kind === "key"
            ? { kind: "key", key: input.key }
            : { kind: "clipboard", text: input.text },
      });
    }
    recording.events.push(event);
    if (typing) recording.focus = focus;
    else if (input.kind !== "scroll") delete recording.focus;
    await tx.taughtSkill.update({
      where: { id: skill.id },
      data: { recording: recording as never },
    });
    return "recorded" as const;
  });
  if (recorded === "expired") {
    await expireTaughtSkillTeaching(deps, skill.id);
    return "stale";
  }
  if (recorded === "recorded" && !event.sensitive && wantsWindowSample(mapped, skill.id)) {
    await recordWindowChange(deps, actor, skill.id, botId, prepared.computer);
  }
  return recorded;
}

/** Keys that put characters into the focused field, and pastes. Anything else may move focus. */
function isTypingInput(input: TeachComputerInput): boolean {
  if (input.kind === "clipboard") return true;
  return (
    input.kind === "key" &&
    !input.modifiers?.length &&
    (input.key?.length === 1 || input.key === "Backspace")
  );
}

const LOGIN_WINDOW_TITLE = /log ?in|sign ?in|password|auth/i;

/**
 * Whether the field with focus in the sandbox holds a credential. The browser answers when it
 * can; otherwise (another app has focus, the check fails) the window title decides, because a
 * sign-in page's title is the only other evidence. Native desktop apps are the remaining gap
 * (docs/computer-runtime.md).
 */
async function detectProtectedFocus(
  deps: TeachingSessionDeps,
  actor: Actor,
  botId: string,
  computer: { providerRef: string | null },
): Promise<FocusState> {
  const context = computerContext(actor, botId, "skills.focus");
  try {
    const result = await deps.sandbox.pageBrowser?.(
      toComputerRef(computer as never),
      { command: "focus" },
      context,
    );
    const focus = result?.ok ? result.focus : undefined;
    if (focus?.hasFocus && focus.tag !== "iframe") {
      const passwordLike =
        focus.type === "password" ||
        /(?:current|new)-password|one-time-code/i.test(focus.autocomplete ?? "") ||
        [focus.name, focus.id, focus.label, focus.placeholder].some(isProtectedFieldLabel);
      return passwordLike
        ? { protected: true, field: (focus.label || focus.name || "Password").slice(0, 120) }
        : { protected: false };
    }
  } catch {
    // Fall through to the window title.
  }
  try {
    const observation = await deps.sandbox.observe(
      toComputerRef(computer as never),
      computerContext(actor, botId, "skills.focus"),
    );
    if (LOGIN_WINDOW_TITLE.test(observation.activeWindow?.title ?? "")) return { protected: true };
  } catch {
    // No evidence either way.
  }
  return { protected: false };
}

/** After a click or Enter the foreground window may have changed; the title is all we can see. */
// ponytail: per-process throttle only limits screenshots; the recording itself is in Postgres.
const lastWindowSample = new Map<string, number>();

function wantsWindowSample(mapped: TeachComputerInput, skillId: string): boolean {
  const triggers =
    (mapped.kind === "pointer" && (mapped.type === "click" || mapped.type === "up")) ||
    (mapped.kind === "key" && (mapped.key === "Enter" || mapped.key === "Tab"));
  if (!triggers) return false;
  const now = Date.now();
  if (now - (lastWindowSample.get(skillId) ?? 0) < WINDOW_SAMPLE_MS) return false;
  lastWindowSample.set(skillId, now);
  return true;
}

async function recordWindowChange(
  deps: TeachingSessionDeps,
  actor: Actor,
  skillId: string,
  botId: string,
  computer: { providerRef: string | null } | null,
): Promise<void> {
  if (!computer?.providerRef) return;
  try {
    const observation = await deps.sandbox.observe(
      toComputerRef(computer as never),
      computerContext(actor, botId, "skills.window"),
    );
    const title = observation.activeWindow?.title?.trim();
    if (!title) return;
    await mutateRecording(deps, skillId, (recording, held) => {
      const lastWindow = recording.events.findLast((entry) => entry.kind === "window");
      // The app name comes from the scrubbed title, so a password echoed in the title cannot leak
      // through it.
      const clean = scrubText(title, held);
      const { app } = splitWindowTitle(clean);
      const event = sanitizeTeachRecordingEvent({
        at: new Date().toISOString(),
        kind: "window",
        title: clean,
        ...(app ? { app } : {}),
      });
      if (lastWindow?.title === event.title) return { recording, changed: false };
      recording.events.push(event);
      return { recording, changed: true };
    });
  } catch {
    // The title is a convenience; a failed look never stops the recording.
  }
}

export async function captureTeachingSnapshot(
  deps: TeachingSessionDeps,
  actor: Actor,
  bot: { id: string; computer: { id: string; kind: string; providerRef: string | null } | null },
  skill: TaughtSkillRow,
): Promise<TaughtSkillRow> {
  const snapshot = await observeStopSnapshot(deps, actor, bot);
  if (!snapshot) return skill;
  return mutateRecording(deps, skill.id, (recording, held) => {
    const summary = scrubText(snapshot.summary, held);
    recording.snapshots.push({ ...snapshot, summary });
    recording.events.push({ at: snapshot.at, kind: "snapshot", summary });
    return { recording, changed: true };
  });
}
