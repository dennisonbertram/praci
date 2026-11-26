import type { ProductEvent, ThreadGoal } from "@rakazo/contracts";
import { ThreadGoalSchema } from "@rakazo/contracts";
import { isGoalWaitingOnOwner } from "@rakazo/core";
import type { MobileSnapshot } from "./api";

export type GoalLine = { text: string; status: "Paused" | "Waiting on you" | null };

/** The goal line above the composer: the open goal, plus a status word only when it is not working. */
export function goalLineState(
  goal: ThreadGoal | null | undefined,
  runs: ReadonlyArray<{ status: string }>,
): GoalLine | null {
  if (!goal || (goal.status !== "active" && goal.status !== "paused")) return null;
  if (goal.status === "paused") return { text: goal.text, status: "Paused" };
  return { text: goal.text, status: isGoalWaitingOnOwner(runs) ? "Waiting on you" : null };
}

/** Fold a `thread.goal.updated` event into the snapshot. */
export function applyGoalEvent(
  prev: MobileSnapshot | null,
  event: Pick<ProductEvent, "seq" | "payload">,
): MobileSnapshot | null {
  if (!prev) return prev;
  const parsed = ThreadGoalSchema.nullable().safeParse(event.payload?.goal);
  if (!parsed.success) return prev;
  return { ...prev, cursor: event.seq ?? prev.cursor, goal: parsed.data };
}

/** True for the server's answer to a bare `/goal` or `/goal clear`, sent as an error. */
export function isGoalReply(error: unknown): boolean {
  return (error as { data?: { goalReply?: unknown } } | null)?.data?.goalReply === true;
}
