import type {
  ProductEvent,
  Run,
  RunTrigger,
  ThreadMessage,
  ThreadSnapshot,
} from "@rakazo/contracts";
import { RUN_TRIGGERS, RunPhaseSchema } from "@rakazo/contracts";
import {
  isRunTerminalEvent,
  progressMessageId,
  reduceLiveMessageBlocks,
  runFailureError,
  subagentBlockFromPayload,
} from "./events.js";
import { upsertMessageById } from "./message-pages.js";
import { replyMetadata } from "./message-replies.js";
import { isBackgroundRunTrigger } from "./run-state.js";
import { takeLiveMessage, updateCloudAgentMessages } from "./thread-message-updates.js";

const runTriggers = new Set<string>(RUN_TRIGGERS);

function runFromStartedEvent(event: ProductEvent, previous: Run | undefined): Run {
  const trigger = event.payload.trigger;
  return {
    id: event.runId ?? previous?.id ?? event.id,
    botId: event.botId,
    threadId: event.threadId,
    taskId: previous?.taskId ?? event.runId ?? event.id,
    status: "running",
    trigger:
      typeof trigger === "string" && runTriggers.has(trigger)
        ? (trigger as RunTrigger)
        : (previous?.trigger ?? "user"),
    routineId:
      typeof event.payload.routineId === "string"
        ? event.payload.routineId
        : (previous?.routineId ?? null),
    modelProvider: previous?.modelProvider ?? null,
    modelId: previous?.modelId ?? null,
    error: null,
    phase: previous?.phase ?? null,
    startedAt: previous?.startedAt ?? event.createdAt,
    completedAt: null,
    createdAt: previous?.createdAt ?? event.createdAt,
  };
}

export function activeThreadRuns(
  snapshot: ThreadSnapshot | null,
): NonNullable<ThreadSnapshot["activeRuns"]> {
  return snapshot?.activeRuns ?? (snapshot?.run ? [snapshot.run] : []);
}

/** True for events that reduceThreadSnapshot folds into the snapshot. */
export function isThreadSnapshotEvent(event: ProductEvent): boolean {
  return (
    event.type === "thread.cleared" ||
    event.type === "thread.progress" ||
    event.type === "thread.subagent" ||
    event.type === "thread.cloud_agent" ||
    event.type === "agent.tool.called" ||
    event.type === "agent.tool.completed" ||
    event.type === "thread.message.created" ||
    event.type === "thread.message.updated" ||
    event.type === "thread.message.reaction" ||
    event.type === "run.started" ||
    event.type === "run.phase" ||
    event.type === "run.waiting_input" ||
    event.type === "computer.takeover.requested" ||
    isRunTerminalEvent(event)
  );
}

/** Fold one product event into a thread snapshot. Shared by web and mobile. */
export function reduceThreadSnapshot(
  prev: ThreadSnapshot | null,
  event: ProductEvent,
): ThreadSnapshot | null {
  if (!prev) return prev;
  if (event.type === "thread.cleared") {
    return {
      ...prev,
      cursor: event.seq,
      messages: [],
      olderCursor: null,
      run: null,
      activeRuns: [],
    };
  }
  if (event.type === "run.started") {
    // Background runs (ticket work) stay invisible in the transcript; the server
    // already filters their events and snapshots, this guards a late arrival.
    if (isBackgroundRunTrigger(event.payload.trigger as string | undefined)) {
      return { ...prev, cursor: event.seq };
    }
    if (!event.runId) {
      return {
        ...prev,
        cursor: event.seq,
        members: updateMemberStatus(prev.members, event.botId, "running"),
      };
    }
    const previousRun =
      prev.activeRuns?.find((candidate) => candidate.id === event.runId) ??
      (prev.run?.id === event.runId ? prev.run : undefined);
    const run = runFromStartedEvent(event, previousRun);
    const without = (prev.activeRuns ?? (prev.run ? [prev.run] : [])).filter(
      (candidate) => candidate.id !== run.id,
    );
    // Bot threads keep a single primary run; groups accumulate concurrent member runs.
    const activeRuns = prev.groupId ? [...without, run] : [run];
    return {
      ...prev,
      cursor: event.seq,
      members: updateMemberStatus(prev.members, event.botId, "running"),
      // A group failure lives only in run; keep it until dismiss so a late member start
      // cannot wipe the banner (activeRuns still tracks the new work).
      run: prev.groupId && prev.run?.status === "failed" && prev.run.id !== run.id ? prev.run : run,
      activeRuns,
    };
  }
  if (event.type === "run.phase") {
    const parsed = RunPhaseSchema.safeParse(event.payload);
    const known =
      prev.run?.id === event.runId || prev.activeRuns?.some((run) => run.id === event.runId);
    if (!parsed.success || !event.runId || !known) return { ...prev, cursor: event.seq };
    const phase = parsed.data;
    const withPhase = (run: Run) => (run.id === event.runId ? { ...run, phase } : run);
    return {
      ...prev,
      cursor: event.seq,
      run: prev.run ? withPhase(prev.run) : prev.run,
      activeRuns: prev.activeRuns?.map(withPhase),
    };
  }
  if (event.type === "run.waiting_input" || event.type === "computer.takeover.requested") {
    const status = event.type === "run.waiting_input" ? "waiting_input" : "waiting_takeover";
    const runId = event.runId;
    const knownInRun = Boolean(runId && prev.run?.id === runId);
    const knownInActive = Boolean(
      runId && prev.activeRuns?.some((candidate) => candidate.id === runId),
    );
    // Peer bot_message runs are omitted from snapshots while busy; the first wait
    // event is how an open thread learns they need ask/takeover UI.
    const needsInsert = Boolean(runId) && !knownInRun && !knownInActive;
    const runChanged = Boolean(knownInRun && prev.run && prev.run.status !== status);
    const activeRunChanged = Boolean(
      knownInActive &&
        prev.activeRuns?.some((candidate) => candidate.id === runId && candidate.status !== status),
    );
    const members = updateMemberStatus(prev.members, event.botId, status);
    // Waiting pauses (ask and takeover) delete progress events server-side; drop the live
    // bubble so a missed message.created cannot leave "working…" stuck next to the wait.
    const liveId = progressMessageId(event);
    const messages = prev.messages.some((message) => message.id === liveId)
      ? prev.messages.filter((message) => message.id !== liveId)
      : prev.messages;
    // The bot is asking for control, so the "computer busy" banner no longer applies.
    const computer =
      event.type === "computer.takeover.requested" && prev.computer?.busyBotName
        ? { ...prev.computer, busyBotName: null }
        : prev.computer;
    if (
      !runChanged &&
      !activeRunChanged &&
      !needsInsert &&
      members === prev.members &&
      messages === prev.messages &&
      computer === prev.computer
    ) {
      // Nothing visible changed, but a later cursor keeps reconnects from replaying this event.
      return event.seq === prev.cursor ? prev : { ...prev, cursor: event.seq };
    }
    if (needsInsert && runId) {
      const waitingRun: Run = {
        id: runId,
        botId: event.botId,
        threadId: event.threadId,
        taskId: runId,
        status,
        trigger: "bot_message",
        routineId: null,
        modelProvider: null,
        modelId: null,
        error: null,
        startedAt: event.createdAt,
        completedAt: null,
        createdAt: event.createdAt,
      };
      const baseActive = prev.activeRuns ?? (prev.run ? [prev.run] : []);
      const activeRuns = [...baseActive.filter((candidate) => candidate.id !== runId), waitingRun];
      const promoteWaiting =
        !prev.run ||
        (prev.run.status !== "waiting_input" && prev.run.status !== "waiting_takeover");
      return {
        ...prev,
        cursor: event.seq,
        members,
        messages,
        computer,
        run: promoteWaiting ? waitingRun : prev.run,
        activeRuns,
      };
    }
    return {
      ...prev,
      cursor: event.seq,
      members,
      messages,
      computer,
      run: runChanged && prev.run ? { ...prev.run, status } : prev.run,
      activeRuns: activeRunChanged
        ? prev.activeRuns?.map((candidate) =>
            candidate.id === runId ? { ...candidate, status } : candidate,
          )
        : prev.activeRuns,
    };
  }
  if (isRunTerminalEvent(event)) {
    const activeRuns = prev.activeRuns?.filter((candidate) => candidate.id !== event.runId);
    const nextMemberRun = activeRuns?.find((candidate) => candidate.botId === event.botId);
    const failure = runFailureError(event);
    const primaryEnded = prev.run?.id === event.runId ? prev.run : null;
    // In a group the failing run may be a member run rather than the displayed one, so look
    // it up in activeRuns as well or its error would be dropped with it.
    const endedRun =
      primaryEnded ?? prev.activeRuns?.find((candidate) => candidate.id === event.runId) ?? null;
    return {
      ...prev,
      cursor: event.seq,
      messages: prev.messages.filter((message) => message.id !== progressMessageId(event)),
      members: updateMemberStatus(prev.members, event.botId, nextMemberRun?.status ?? "idle"),
      // A failed run stays in run (activeRuns already excludes it) so the transcript can say
      // why it stopped, matching what threads.get returns on the next load.
      run:
        endedRun && failure
          ? { ...endedRun, status: "failed", error: failure }
          : primaryEnded
            ? (activeRuns?.[0] ?? null)
            : prev.run,
      activeRuns,
    };
  }
  if (event.type === "thread.progress") {
    const liveId = progressMessageId(event);
    const { previous, remaining } = takeLiveMessage(prev.messages, liveId);
    const blocks = reduceLiveMessageBlocks(previous?.blocks ?? [], {
      type: "progress",
      payload: event.payload,
    });
    const streaming: ThreadMessage = {
      id: liveId,
      threadId: event.threadId,
      seq: event.seq,
      role: "bot",
      blocks,
      botId: event.botId,
      runId: event.runId,
      createdAt: event.createdAt,
    };
    return { ...prev, cursor: event.seq, messages: [...remaining, streaming] };
  }
  if (event.type === "agent.tool.called") {
    const liveId = progressMessageId(event);
    const { previous, remaining } = takeLiveMessage(prev.messages, liveId);
    const blocks = reduceLiveMessageBlocks(previous?.blocks ?? [], {
      type: "tool",
      name: String(event.payload.name ?? ""),
    });
    const next: ThreadMessage = {
      id: liveId,
      threadId: event.threadId,
      seq: event.seq,
      role: "bot",
      blocks,
      botId: event.botId,
      runId: event.runId,
      createdAt: event.createdAt,
    };
    return { ...prev, cursor: event.seq, messages: [...remaining, next] };
  }
  if (event.type === "agent.tool.completed") {
    return { ...prev, cursor: event.seq };
  }
  if (event.type === "thread.subagent") {
    const block = subagentBlockFromPayload(event.payload);
    const next: ThreadMessage = {
      id: `subagent:${block.agentId}`,
      threadId: event.threadId,
      seq: event.seq,
      role: "bot",
      blocks: [block],
      botId: event.botId,
      runId: event.runId,
      createdAt: event.createdAt,
    };
    const without: ThreadMessage[] = [];
    const kept: ThreadMessage[] = [];
    for (const message of prev.messages) {
      if (message.id === next.id) continue;
      if (message.id.startsWith("progress:")) {
        if (message.runId) kept.push(message);
      } else {
        without.push(message);
      }
    }
    return { ...prev, cursor: event.seq, messages: [...without, next, ...kept] };
  }

  if (event.type === "thread.cloud_agent") {
    return {
      ...prev,
      cursor: event.seq,
      messages: updateCloudAgentMessages(prev.messages, event.payload ?? {}),
    };
  }
  if (event.type === "thread.message.created" || event.type === "thread.message.updated") {
    const role = (event.payload.role as ThreadMessage["role"]) ?? "bot";
    const blocks = (event.payload.blocks as ThreadMessage["blocks"]) ?? [];
    const id = String(event.payload.messageId ?? event.id);
    const known = prev.messages.find((message) => message.id === id);
    const next: ThreadMessage = {
      id,
      threadId: event.threadId,
      seq: event.seq,
      role,
      blocks,
      botId: event.botId,
      runId: event.runId,
      callId: typeof event.payload.callId === "string" ? event.payload.callId : known?.callId,
      ...replyMetadata(event.payload, known),
      createdAt: known?.createdAt ?? event.createdAt,
    };
    const replacedSubagentIds = new Set(
      blocks.filter((block) => block.kind === "subagent").map((block) => block.agentId),
    );
    const liveId = progressMessageId(event);
    const { remaining } = takeLiveMessage(prev.messages, liveId);
    const without = remaining.filter((message) => !replacedSubagent(message, replacedSubagentIds));
    // The delegate answered (or was denied): its outcome reaches this thread as a bot message.
    const answered = blocks.some((block) => block.kind === "bot_message_received");
    return {
      ...prev,
      cursor: event.seq,
      messages: upsertMessageById(without, next),
      ...(answered && prev.delegatePending ? { delegatePending: false } : {}),
    };
  }
  return prev;
}

function updateMemberStatus(
  members: ThreadSnapshot["members"],
  botId: string,
  status: string,
): ThreadSnapshot["members"] {
  const member = members?.find((candidate) => candidate.botId === botId);
  if (!member || member.status === status) return members;
  return members?.map((candidate) =>
    candidate.botId === botId ? { ...candidate, status } : candidate,
  );
}

function replacedSubagent(message: ThreadMessage, agentIds: ReadonlySet<string>) {
  if (agentIds.size === 0) return false;
  return message.blocks.some((block) => block.kind === "subagent" && agentIds.has(block.agentId));
}
