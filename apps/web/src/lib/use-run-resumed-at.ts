import { useRef } from "react";

type RunLike = { id: string; status: string };

/**
 * When each run last went from waiting on the user back to working, as this browser saw it. A
 * resumed run keeps its original start time, so a timer from that would count the time the
 * question sat unanswered.
 */
export function useRunResumedAt(runs: readonly RunLike[]): (runId: string) => number | undefined {
  const waiting = useRef(new Set<string>());
  const resumed = useRef(new Map<string, number>());
  for (const run of runs) {
    if (run.status === "waiting_input" || run.status === "waiting_takeover")
      waiting.current.add(run.id);
    else if (waiting.current.delete(run.id)) resumed.current.set(run.id, Date.now());
  }
  return (runId) => resumed.current.get(runId);
}
