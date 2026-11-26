import { describe, expect, it, vi } from "vitest";
import { stopJobsAndRuns } from "./stop-jobs.js";

const logger = { error: vi.fn() };

describe("stopJobsAndRuns", () => {
  it("aborts in-flight runs before waiting for them to drain", async () => {
    const shutdown = new AbortController();
    let abortedWhileDraining = false;
    const jobHost = {
      stop: async () => {
        await Promise.resolve();
        abortedWhileDraining = shutdown.signal.aborted;
      },
    };
    await stopJobsAndRuns(jobHost, shutdown, { stop: async () => {} }, logger);
    expect(abortedWhileDraining).toBe(true);
  });

  it("aborts runs and stops the job host while the reconciler tick is still pending", async () => {
    const shutdown = new AbortController();
    const jobHost = { stop: vi.fn(async () => {}) };
    let release = () => {};
    const reconciler = {
      stop: vi.fn(() => new Promise<void>((resolve) => (release = resolve))),
    };
    let settled = false;
    const done = stopJobsAndRuns(jobHost, shutdown, reconciler, logger).then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(reconciler.stop).toHaveBeenCalledTimes(1);
    expect(shutdown.signal.aborted).toBe(true);
    expect(jobHost.stop).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    release();
    await done;
    expect(settled).toBe(true);
  });

  it("logs a reconciler stop failure and still finishes", async () => {
    const shutdown = new AbortController();
    const error = new Error("tick failed");
    const log = { error: vi.fn() };
    await stopJobsAndRuns(
      { stop: async () => {} },
      shutdown,
      { stop: () => Promise.reject(error) },
      log,
    );
    expect(log.error).toHaveBeenCalledWith("worker reconciler stop failed", error);
  });
});
