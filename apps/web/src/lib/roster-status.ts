import { t } from "@lingui/core/macro";
import type { RunPhase } from "@rakazo/contracts";
import { runPhaseLine } from "./run-phase";

export function rosterHasUndismissedRunError(
  runErrorId: string | null | undefined,
  dismissedRunErrorIds: ReadonlySet<string>,
): boolean {
  return Boolean(runErrorId && !dismissedRunErrorIds.has(runErrorId));
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
      return t`Needs your answer`;
    default:
      return null;
  }
}

/** Compact rows keep actionable status visible in place of the message preview. */
export function compactRosterStatusLabel(status: string, phase?: RunPhase | null): string | null {
  const workStatus = rosterWorkStatusLabel(status, phase);
  if (workStatus) return workStatus;
  switch (status) {
    case "waiting_takeover":
      return t`Needs you`;
    case "failed":
      return t`Error`;
    default:
      return null;
  }
}
