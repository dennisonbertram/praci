import type { Run, ThreadMessage } from "@rakazo/contracts";
import { humanizeToolName } from "@rakazo/core";

export type WorkingActivity =
  | { kind: "starting" }
  | { kind: "thinking" }
  | { kind: "writing" }
  | { kind: "tool"; label: string };

/** What a live run is doing now, read from its status and the newest bot message. */
export function workingActivity(
  run: Pick<Run, "id" | "botId" | "status">,
  messages: readonly ThreadMessage[],
): WorkingActivity {
  if (run.status === "queued" || run.status === "leased") return { kind: "starting" };
  const last = messages.at(-1);
  if (last?.role !== "bot" || last.botId !== run.botId) return { kind: "thinking" };
  if (last.runId && last.runId !== run.id) return { kind: "thinking" };
  const tail = last.blocks.at(-1);
  const pending = tail?.kind === "progress" ? tail.pendingToolNames?.at(-1) : undefined;
  if (pending) return { kind: "tool", label: humanizeToolName(pending) };
  if (tail?.kind === "steps") {
    const step = tail.steps.at(-1);
    if (step) return { kind: "tool", label: step.label };
  }
  if ((tail?.kind === "text" || tail?.kind === "progress") && tail.text.trim()) {
    return { kind: "writing" };
  }
  return { kind: "thinking" };
}
