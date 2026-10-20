import type { RunPhase } from "@rakazo/contracts";
import type { WorkingActivity } from "@rakazo/core";
import { isRunWorking } from "@rakazo/core";
import { t } from "./i18n";

/** Run ids whose failure the reader dismissed. Kept in memory: a restart shows the error once more. */
export const dismissedRunErrorIds = new Set<string>();

/** One line saying what a run waits on before its first tool call. Null when no phase is worth a line. */
export function runPhaseLine(phase: RunPhase): string | null {
  const name = phase.name;
  switch (phase.kind) {
    case "computer_wait":
      return t("Waiting for the computer");
    case "computer_start":
      return t("Starting the computer");
    case "connecting":
      return name ? t("Connecting to {name}", { name }) : t("Connecting to tools");
    case "model_wait":
      return t("Waiting for the model");
    case "retrying":
      return name ? t("Retrying: {name}", { name }) : t("Retrying");
    default:
      return null;
  }
}

/** The service named in "Still waiting on ...", or null when nothing specific is awaited. */
export function runPhaseWaitingOn(phase: RunPhase): string | null {
  switch (phase.kind) {
    case "computer_wait":
    case "computer_start":
      return t("the computer");
    case "connecting":
      return phase.name ?? t("tools");
    case "model_wait":
      return t("the model");
    default:
      return null;
  }
}

/** The muted line beside the working dots, and the service to name once the run goes quiet. */
export function workingStatus(activity: WorkingActivity): {
  text: string;
  waitingOn: string | null;
} {
  switch (activity.kind) {
    case "starting":
      return { text: t("Starting…"), waitingOn: null };
    case "phase":
      return {
        text: runPhaseLine(activity.phase) ?? t("Thinking…"),
        waitingOn: runPhaseWaitingOn(activity.phase),
      };
    case "writing":
      return { text: t("Writing…"), waitingOn: null };
    case "tool":
      return { text: activity.detail ?? activity.label, waitingOn: activity.service ?? null };
    default:
      return { text: t("Thinking…"), waitingOn: null };
  }
}

/** Status shown in place of a bot's preview in the list. Null keeps the preview. */
export function botRowStatus(bot: {
  status: string;
  runPhase?: RunPhase | null;
  runErrorId?: string | null;
}): string | null {
  if (bot.runErrorId && !dismissedRunErrorIds.has(bot.runErrorId)) return t("Error");
  const phaseLine = bot.runPhase ? runPhaseLine(bot.runPhase) : null;
  if (phaseLine && isRunWorking(bot.status)) return `${phaseLine}…`;
  switch (bot.status) {
    case "queued":
      return t("Waiting in line…");
    case "leased":
      return t("Starting…");
    case "running":
      return t("Working…");
    case "waiting_input":
      return t("Needs an answer");
    case "waiting_takeover":
      return t("Needs you");
    default:
      return null;
  }
}
