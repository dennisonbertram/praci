import { t } from "@lingui/core/macro";
import type { RunPhase } from "@rakazo/contracts";

/** One line saying what a run waits on before its first tool call. Null when the "Thinking" label already says it. */
export function runPhaseLine(phase: RunPhase): string | null {
  const name = phase.name;
  switch (phase.kind) {
    case "computer_wait":
      return t`Waiting for the computer`;
    case "computer_start":
      return t`Getting ready`;
    case "connecting":
      return name ? t`Connecting to ${name}` : t`Connecting to tools`;
    case "model_wait":
      return t`Waiting for the model`;
    case "retrying":
      return t`Retrying`; // the stored name is an internal cause, not copy for people
    default:
      return null;
  }
}

/** The service or resource named in "Still waiting on ...", or null when nothing specific is awaited. */
export function runPhaseWaitingOn(phase: RunPhase): string | null {
  switch (phase.kind) {
    case "computer_wait":
    case "computer_start":
      return t`the computer`;
    case "connecting":
      return phase.name ?? t`tools`;
    case "model_wait":
      return t`the model`;
    default:
      return null;
  }
}
