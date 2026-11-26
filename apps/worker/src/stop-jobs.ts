/**
 * Stops claiming jobs and aborts in-flight runs at once. An aborted run puts itself back in the
 * queue with its lease cleared and a run.continue job enqueued, and resumes from its checkpoint
 * on the next worker. There is no grace period: a supervisor (tsx watch, Docker, a deploy) can
 * kill this process within seconds, and a run still holding its lease then waits for the lease
 * to lapse before anyone resumes it.
 *
 * The reconciler stops ticking immediately, but its stop waits for a tick in progress, so that
 * wait comes last: it must not delay the abort.
 */
export async function stopJobsAndRuns(
  jobHost: { stop(): Promise<void> },
  shutdown: AbortController,
  reconciler: { stop(): Promise<void> },
  logger: { error(message: string, error: unknown): void },
): Promise<void> {
  const reconcilerStopped = reconciler
    .stop()
    .catch((error: unknown) => logger.error("worker reconciler stop failed", error));
  const drained = jobHost.stop();
  shutdown.abort(new Error("Worker shutting down"));
  await drained;
  await reconcilerStopped;
}
