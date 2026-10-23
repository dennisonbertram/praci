import { t } from "@lingui/core/macro";
import type { RunPhase } from "@rakazo/contracts";

/** One line saying what a run waits on before its first tool call. Null when the "Thinking" label already says it. */
export function runPhaseLine(phase: RunPhase): string | null {
  const name = phase.name;
  switch (phase.kind) {
    case "computer_wait":
      return t`Starting up`;
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

/** The slow-run line, such as "Still waiting on Gmail", or null when nothing specific is awaited. */
export function runPhaseWaitingLabel(phase: RunPhase): string | null {
  switch (phase.kind) {
    case "computer_wait":
    case "computer_start":
      return t`Still starting up`;
    case "connecting": {
      const service = phase.name ?? t`tools`;
      return t`Still waiting on ${service}`;
    }
    case "model_wait":
      return t`Still waiting on the model`;
    default:
      return null;
  }
}
