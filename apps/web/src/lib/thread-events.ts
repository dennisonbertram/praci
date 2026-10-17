import type {
  ComputerStatus,
  ProductEvent,
  Run,
  RunStatus,
  ThreadMessagePage,
  ThreadSnapshot,
} from "@rakazo/contracts";
import {
  activeThreadRuns,
  isActive,
  mergeThreadHistory,
  prependThreadHistoryPage,
} from "@rakazo/core";

export { activeThreadRuns, isThreadSnapshotEvent, reduceThreadSnapshot } from "@rakazo/core";

const computerStates: ReadonlySet<unknown> = new Set<ComputerStatus["state"]>([
  "stopped",
  "booting",
  "running",
  "suspended",
  "error",
]);

/**
 * Reflect a committed direct-message send before its follow-up snapshot arrives.
 *
 * threads.send returns only after the message and run are durable. Keeping that
 * receipt prevents a transient snapshot/SSE interruption from showing a stored
 * user bubble with no working state. A matching live run always wins, and the
 * next durable event or refresh still supplies the authoritative status.
 */
export function applyThreadSendReceipt(
  snapshot: ThreadSnapshot | null,
  receipt: { botId: string; runId: string; taskId: string; createdAt?: string },
  terminalRunIds: ReadonlySet<string> = new Set(),
): ThreadSnapshot | null {
  if (
    !snapshot ||
    snapshot.groupId ||
    snapshot.botId !== receipt.botId ||
    snapshot.run?.id === receipt.runId ||
    terminalRunIds.has(receipt.runId)
  ) {
    return snapshot;
  }
  const currentRuns = activeThreadRuns(snapshot);
  if (currentRuns.some((run) => isActive(run.status as RunStatus))) return snapshot;
  const createdAt = receipt.createdAt ?? new Date().toISOString();
  const run: Run = {
    id: receipt.runId,
    botId: receipt.botId,
    threadId: snapshot.threadId,
    taskId: receipt.taskId,
    status: "queued",
    trigger: "user",
    routineId: null,
    modelProvider: null,
    modelId: null,
    error: null,
    startedAt: null,
    completedAt: null,
    createdAt,
  };
  return { ...snapshot, run, activeRuns: [run] };
}

/** Reason the newest run stopped, until the reader dismisses that run's failure. */
export function threadRunError(
  snapshot: ThreadSnapshot | null,
  dismissedRunIds?: ReadonlySet<string>,
): string | null {
  const run = snapshot?.run;
  if (run?.status !== "failed" || dismissedRunIds?.has(run.id)) return null;
  return run.error ?? null;
}

export function clearActiveThreadRuns(snapshot: ThreadSnapshot): ThreadSnapshot {
  const runIds = new Set(activeThreadRuns(snapshot).map((run) => run.id));
  const computer = snapshot.computer?.busyBotName
    ? { ...snapshot.computer, busyBotName: null }
    : snapshot.computer;
  return {
    ...snapshot,
    run: null,
    activeRuns: [],
    messages: snapshot.messages.filter(
      (message) =>
        !message.runId || !runIds.has(message.runId) || !message.id.startsWith("progress:"),
    ),
    computer,
  };
}

export function mergeThreadSnapshot(
  prev: ThreadSnapshot | null,
  next: ThreadSnapshot,
  preserveLoadedHistory = false,
): ThreadSnapshot {
  // A threads.get started before SSE caught up must not wipe newer live state
  // (e.g. ask cards applied after send's post-refresh request was already in flight).
  if (prev && prev.threadId === next.threadId && prev.cursor > next.cursor) return prev;
  return mergeThreadHistory(prev, next, preserveLoadedHistory);
}

/**
 * Apply a threads.get refresh without clobbering newer event-sourced takeover state.
 *
 * A refresh that started earlier can still return running+busyBotName after the client
 * already applied waiting_takeover. Cursor comparisons only apply within the same thread.
 * Stop clears run/busy optimistically in the shell so an in-flight refresh cannot revive
 * the run before its run.cancelled event lands; an older-cursor refresh must keep that
 * cleared local state (see Shell stopRun).
 */
export function reconcileRefreshedThread(
  prev: ThreadSnapshot | null,
  snap: ThreadSnapshot,
  prevComputer: ComputerStatus | null,
  preserveLoadedHistory = false,
): { snapshot: ThreadSnapshot; computer: ComputerStatus | null } {
  const sameThread = Boolean(prev && prev.threadId === snap.threadId);

  if (sameThread && prev && snap.cursor < prev.cursor) {
    // A subscription can advance the cursor with progress before the send-triggered refresh
    // returns the new run record. Hydrate that matching run without rolling the transcript back.
    // Optimistic stop removes the matching progress message, so an older refresh cannot revive it.
    const refreshedRun = snap.run;
    const hasMatchingLiveProgress = Boolean(
      refreshedRun &&
        prev.messages.some(
          (message) =>
            message.runId === refreshedRun.id && message.id === `progress:${refreshedRun.id}`,
        ),
    );
    if (!prev.run && refreshedRun && hasMatchingLiveProgress) {
      return {
        snapshot: {
          ...prev,
          run: refreshedRun,
          activeRuns: snap.activeRuns,
          computer: snap.computer,
        },
        computer: snap.computer ?? null,
      };
    }
    // Progress can advance the thread cursor while embedded computer status from threads.get
    // is still useful — but only while a live run remains. Preserve event-sourced
    // waiting_takeover clears and optimistic stop clears.
    const preserveLocalComputer =
      prev.run?.status === "waiting_takeover" ||
      !prev.run ||
      !isActive(prev.run.status as RunStatus);
    return {
      snapshot: prev,
      computer: preserveLocalComputer ? prevComputer : (snap.computer ?? null),
    };
  }

  let snapshot = mergeThreadSnapshot(prev, snap, preserveLoadedHistory);
  let computer = snap.computer ?? null;

  const localWaiting =
    sameThread &&
    prev?.run?.status === "waiting_takeover" &&
    snapshot.run?.id === prev.run.id &&
    snapshot.run.status !== "waiting_takeover" &&
    isActive(snapshot.run.status as RunStatus);

  if (localWaiting && snapshot.run) {
    const runId = snapshot.run.id;
    snapshot = {
      ...snapshot,
      run: { ...snapshot.run, status: "waiting_takeover" },
      activeRuns: snapshot.activeRuns?.map((run) =>
        run.id === runId ? { ...run, status: "waiting_takeover" } : run,
      ),
    };
    if (computer?.busyBotName) computer = { ...computer, busyBotName: null };
  } else if (snapshot.run?.status === "waiting_takeover" && computer?.busyBotName) {
    computer = { ...computer, busyBotName: null };
  }

  return { snapshot, computer };
}

export function prependThreadMessagePage(
  prev: ThreadSnapshot | null,
  page: ThreadMessagePage,
): ThreadSnapshot | null {
  return prependThreadHistoryPage(prev, page);
}

export function userHoldsComputerControl(
  computer: Pick<ComputerStatus, "controlHolder" | "controlBotId"> | null | undefined,
  botId: string | undefined,
): boolean {
  return Boolean(botId && computer?.controlHolder === "user" && computer.controlBotId === botId);
}

/** True when a live bot run is blocking Take control (API would return 409). */
export function computerTakeoverBlocked(
  computer: Pick<ComputerStatus, "busyBotName"> | null | undefined,
  runStatus?: string | null,
): boolean {
  if (!computer?.busyBotName) return false;
  // waiting_takeover is the bot asking for control; terminal/idle clears the block even if
  // busyBotName is briefly stale while the executor still holds the lease in finally.
  if (!runStatus || runStatus === "waiting_takeover") return false;
  return isActive(runStatus as RunStatus);
}

export function computerPanelAutoBoot(
  state: ComputerStatus["state"] | undefined,
  screenUrl?: string | null,
): "boot" | "recover-screen" | "wait" {
  if (state === "booting" || state === "suspended") return "wait";
  if (state === "running") return screenUrl ? "wait" : "recover-screen";
  return "boot";
}

/** Auto panel reconnect must use computer.boot — never computer.recover (that destroys the sandbox). */
export function computerPanelAutoUsesBoot(
  action: ReturnType<typeof computerPanelAutoBoot>,
): boolean {
  return action === "boot" || action === "recover-screen";
}

export function computerPanelNeedsMaintenance(
  state: ComputerStatus["state"] | undefined,
  booting: boolean,
): boolean {
  return !booting && (state === "error" || state === "stopped");
}

export function reduceComputerStatus(
  prev: ComputerStatus | null,
  event: ProductEvent,
): ComputerStatus | null {
  if (!prev) return prev;
  if (!isComputerStatusEvent(event)) return prev;
  if (event.botId !== prev.botId) return prev;
  if (event.type === "computer.takeover.requested") {
    const retainedControl = event.payload.retainedControl === true;
    const next = {
      ...prev,
      busyBotName: null,
      takeoverRequested: true,
      ...(retainedControl ? {} : { controlHolder: "none" as const, controlBotId: null }),
    };
    return prev.busyBotName === next.busyBotName &&
      prev.takeoverRequested === next.takeoverRequested &&
      prev.controlHolder === next.controlHolder &&
      prev.controlBotId === next.controlBotId
      ? prev
      : next;
  }
  if (event.type === "computer.takeover.granted") {
    const takeoverRequested = event.payload.takeoverRequested === true;
    return prev.controlHolder === "user" &&
      prev.controlBotId === event.botId &&
      prev.takeoverRequested === takeoverRequested &&
      prev.busyBotName === null
      ? prev
      : {
          ...prev,
          controlHolder: "user",
          controlBotId: event.botId,
          takeoverRequested,
          busyBotName: null,
        };
  }
  if (event.type === "computer.takeover.released") {
    const holder = event.payload.holder;
    if (holder !== "bot" && holder !== "none") return prev;
    return prev.controlHolder === holder &&
      prev.controlBotId === null &&
      !prev.takeoverRequested &&
      prev.busyBotName === null
      ? prev
      : {
          ...prev,
          controlHolder: holder,
          controlBotId: null,
          takeoverRequested: false,
          busyBotName: null,
        };
  }
  const status = event.payload.status;
  if (!isComputerState(status)) return prev;
  const screenAvailable = status === "running" || status === "booting" || prev.screenAvailable;
  if (status === prev.state && screenAvailable === prev.screenAvailable) return prev;
  return {
    ...prev,
    state: status,
    screenAvailable,
  };
}

export function isComputerStatusEvent(event: ProductEvent): boolean {
  return (
    event.type === "computer.status" ||
    event.type === "computer.takeover.requested" ||
    event.type === "computer.takeover.granted" ||
    event.type === "computer.takeover.released"
  );
}

function isComputerState(value: unknown): value is ComputerStatus["state"] {
  return computerStates.has(value);
}

/**
 * Whether the composer offers Stop. A run parked on a question is not working: the composer's
 * text answers that question, so it shows Send, not a Stop that suggests the bot is still busy.
 */
export function composerShowsStop(runs: readonly Pick<Run, "status">[]): boolean {
  return runs.some((run) => run.status !== "waiting_input" && isActive(run.status as RunStatus));
}
