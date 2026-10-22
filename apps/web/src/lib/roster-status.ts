import { t } from "@lingui/core/macro";
import type { RunPhase } from "@rakazo/contracts";
import { isRunTerminalEvent } from "@rakazo/core";
import { runPhaseLine } from "./run-phase";

export function rosterHasUndismissedRunError(
  runErrorId: string | null | undefined,
  dismissedRunErrorIds: ReadonlySet<string>,
): boolean {
  return Boolean(runErrorId && !dismissedRunErrorIds.has(runErrorId));
}

/** The one name for a run held on the owner's answer or approval: rows, dots, Activity and its heading. */
export function needsAnswerLabel(): string {
  return t`Needs your answer`;
}

/** A request this agent sent waits for the owner's approval on another agent's card. */
export function waitingForApprovalLabel(): string {
  return t`Waiting for approval`;
}

/**
 * Events after which a bot's sidebar status is out of date. A run that pauses for an approval or
 * question must refresh the list too, or its row keeps saying "Working…" until the next poll.
 */
export function rosterStatusChanged(event: { type: string }): boolean {
  return (
    event.type === "run.started" ||
    event.type === "run.waiting_input" ||
    event.type === "bot.updated" ||
    isRunTerminalEvent(event)
  );
}

/** Short sidebar label while a bot is queued, starting, or running. Null keeps the message preview. */
export function rosterWorkStatusLabel(status: string, phase?: RunPhase | null): string | null {
  const phaseLine = phase ? runPhaseLine(phase) : null;
  if (phaseLine && ["queued", "leased", "running"].includes(status)) return `${phaseLine}…`;
  switch (status) {
    case "queued":
      return t`Waiting in line…`;
    case "leased":
      return t`Starting…`;
    case "running":
      return t`Working…`;
    // A question waiting for the owner is the one state that needs them; it gets the same
    // highlight as work in progress instead of looking like a message preview.
    case "waiting_input":
      return needsAnswerLabel();
    default:
      return null;
  }
}

/** Why a run is held for the person: a question or approval card, or a computer sign-in. */
export function rosterHeldFor(status: string): "answer" | "takeover" | null {
  if (status === "waiting_input") return "answer";
  return status === "waiting_takeover" ? "takeover" : null;
}

/** Compact rows keep actionable status visible in place of the message preview. */
export function compactRosterStatusLabel(status: string, phase?: RunPhase | null): string | null {
  const workStatus = rosterWorkStatusLabel(status, phase);
  if (workStatus) return workStatus;
  switch (status) {
    case "waiting_takeover":
      return t`Needs takeover`;
    case "failed":
      return t`Error`;
    default:
      return null;
  }
}
