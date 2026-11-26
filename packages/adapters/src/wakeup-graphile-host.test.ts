import type { BackgroundJobHandlers } from "@rakazo/adapter-kit";
import {
  HISTORY_COMPACT_MAX_ATTEMPTS,
  historyCompactJob,
  mailSyncJob,
  messagingDeliverJob,
  runContinueJob,
} from "@rakazo/adapter-kit";
import { createLogger, createTestSink, installLogger, wrapJobPayload } from "@rakazo/logging";
import type { Runner } from "graphile-worker";
import { makeWorkerUtils } from "graphile-worker";
import type { Pool } from "pg";
import { afterEach, describe, expect, it, vi } from "vitest";

const run = vi.hoisted(() => vi.fn());

vi.mock("graphile-worker", () => ({
  run: (...args: unknown[]) => run(...args),
  makeWorkerUtils: vi.fn(),
}));

import {
  createRoutineRetryNoticeReconciler,
  databaseCapacityBackoffMs,
  GraphileJobPublisher,
  GraphileJobWorkerHost,
} from "./wakeup.js";

function handlers(): BackgroundJobHandlers {
  return {
    "run.continue": vi.fn(async () => undefined),
    "routine.wakeup": vi.fn(async () => undefined),
    "routine.retry": vi.fn(async () => undefined),
    "computer.update": vi.fn(async () => undefined),
    "computer.sleep": vi.fn(async () => undefined),
    "computer.control-expire": vi.fn(async () => undefined),
    "skill.teaching-expire": vi.fn(async () => undefined),
    "history.compact": vi.fn(async () => undefined),
    "goal.check": vi.fn(async () => undefined),
    "messaging.deliver": vi.fn(async () => undefined),
    "notifications.deliver": vi.fn(async () => undefined),
    "notifications.retention": vi.fn(async () => undefined),
    "messaging.retention": vi.fn(async () => undefined),
    "account.export": vi.fn(async () => undefined),
    "account.export.cleanup": vi.fn(async () => undefined),
    "cloud_agent.poll": vi.fn(async () => undefined),
    "mail.search.expire": vi.fn(async () => undefined),
    "mail.reply.batch": vi.fn(async () => undefined),
    "pipeline.import": vi.fn(async () => undefined),
    "pipeline.auto_status": vi.fn(async () => undefined),
    "pipeline.auto_status.sweep": vi.fn(async () => undefined),
    "inbox.triage": vi.fn(async () => undefined),
    "mail.sync": vi.fn(async () => undefined),
    "mail.attachments": vi.fn(async () => undefined),
    "contacts.photos": vi.fn(async () => undefined),
    "audit.intake": vi.fn(async () => undefined),
    "mail.watch.renew": vi.fn(async () => undefined),
    "mail.sync.sweep": vi.fn(async () => undefined),
    "devin.refresh": vi.fn(async () => undefined),
    "finance.sync": vi.fn(async () => undefined),
    "omi.assemble": vi.fn(async () => undefined),
    "omi.transcribe": vi.fn(async () => undefined),
    "omi.sort": vi.fn(async () => undefined),
    "meetings.capture_transcribe": vi.fn(async () => undefined),
    "meetings.capture_finalize": vi.fn(async () => undefined),
    "meetings.capture_sweep": vi.fn(async () => undefined),
    "meetings.sync": vi.fn(async () => undefined),
    "meetings.digest": vi.fn(async () => undefined),
    "meetings.followup": vi.fn(async () => undefined),
    "dataroom.blob.delete": vi.fn(async () => undefined),
    "dataroom.ingest": vi.fn(async () => undefined),
    "dataroom.classify": vi.fn(async () => undefined),
    "dataroom.index": vi.fn(async () => undefined),
    "dataroom.thumbnail": vi.fn(async () => undefined),
    "dataroom.drive.import": vi.fn(async () => undefined),
    "dataroom.drive.file": vi.fn(async () => undefined),
    "dataroom.box.import": vi.fn(async () => undefined),
    "dataroom.box.file": vi.fn(async () => undefined),
    "dataroom.zip.unpack": vi.fn(async () => undefined),
    "company.import.run": vi.fn(async () => undefined),
    "company.import.unit": vi.fn(async () => undefined),
    "company.import.recover": vi.fn(async () => undefined),
    "company.refresh.tick": vi.fn(async () => undefined),
    "watch.probe": vi.fn(async () => undefined),
    "pages.refresh.tick": vi.fn(async () => undefined),
    "pages.snapshots.retention": vi.fn(async () => undefined),
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function mockRunner() {
  const life = deferred();
  // Keep a rejection handler so Node does not treat the mock lifecycle as an
  // unexpected unhandledRejection before the host attaches supervise().
  life.promise.catch(() => undefined);
  const runner = {
    promise: life.promise,
    stop: vi.fn(async () => {
      life.resolve();
    }),
    kill: vi.fn(async () => undefined),
    addJob: vi.fn(),
    events: { on: vi.fn(), off: vi.fn(), once: vi.fn(), emit: vi.fn() },
  } as unknown as Runner;
  return {
    runner,
    rejectLife: (error: unknown) => life.reject(error),
  };
}

const tooMany = Object.assign(new Error("sorry, too many clients already"), { code: "53300" });

describe("databaseCapacityBackoffMs", () => {
  it("matches the worker startup backoff curve", () => {
    expect(databaseCapacityBackoffMs(0)).toBe(200);
    expect(databaseCapacityBackoffMs(3)).toBe(1_600);
    expect(databaseCapacityBackoffMs(8)).toBe(30_000);
    expect(databaseCapacityBackoffMs(20)).toBe(30_000);
  });
});

describe("GraphileJobPublisher.enqueue", () => {
  function publisherWith(addJob: ReturnType<typeof vi.fn>) {
    vi.mocked(makeWorkerUtils).mockResolvedValue({
      addJob,
      release: vi.fn(async () => undefined),
    } as never);
    return new GraphileJobPublisher({} as Pool);
  }

  it("forwards the job's maxAttempts cap to graphile", async () => {
    const addJob = vi.fn(async () => undefined);
    const publisher = publisherWith(addJob);
    await publisher.enqueue(historyCompactJob("thread-1"));
    expect(addJob).toHaveBeenCalledWith(
      "history.compact",
      expect.anything(),
      expect.objectContaining({ maxAttempts: HISTORY_COMPACT_MAX_ATTEMPTS }),
    );
    await publisher.close();
  });

  it("leaves the queue default when the job sets no cap", async () => {
    const addJob = vi.fn(async (..._args: unknown[]) => undefined);
    const publisher = publisherWith(addJob);
    await publisher.enqueue(messagingDeliverJob("run-1"));
    const options = addJob.mock.calls[0]?.[2] as { maxAttempts?: number } | undefined;
    expect(options?.maxAttempts).toBeUndefined();
    await publisher.close();
  });

  it("runs a user's reply jobs ahead of bulk work by passing a priority", async () => {
    const addJob = vi.fn(async (..._args: unknown[]) => undefined);
    const publisher = publisherWith(addJob);
    await publisher.enqueue(runContinueJob("run-1"));
    await publisher.enqueue(mailSyncJob({ spaceId: "s1", userId: "u1", connectionId: "c1" }));
    const options = (i: number) => addJob.mock.calls[i]?.[2] as { priority?: number } | undefined;
    expect(options(0)?.priority).toBeLessThan(0);
    expect(options(1)?.priority).toBeUndefined();
    await publisher.close();
  });

  type KeyedJob = { attempts: number; maxAttempts: number; runAt: Date; lockedAt?: Date };

  // graphile-worker 0.17.3 add_job: unsafe_dedupe on conflict bumps revision only.
  // replace sets attempts = 0 and run_at = excluded.run_at, or detaches a locked
  // job and inserts a new one.
  function graphileJobs(jobs: Map<string, KeyedJob>) {
    const query = vi.fn(async (_sql: string, params?: readonly unknown[]) => {
      const job = jobs.get(String(params?.[0]));
      return {
        rows: job
          ? [
              {
                attempts: job.attempts,
                max_attempts: job.maxAttempts,
                locked_at: job.lockedAt ?? null,
              },
            ]
          : [],
      };
    });
    const addJob = vi.fn(
      async (
        _name: string,
        _payload: unknown,
        spec: { runAt?: Date; jobKey?: string; maxAttempts?: number; jobKeyMode?: string },
      ) => {
        const key = spec.jobKey;
        if (!key) return;
        const existing = jobs.get(key);
        if (spec.jobKeyMode === "unsafe_dedupe" && existing) return;
        jobs.set(key, {
          attempts: 0,
          maxAttempts: spec.maxAttempts ?? 25,
          runAt: spec.runAt ?? new Date(),
        });
      },
    );
    const withPgClient = vi.fn(
      async (callback: (client: { query: typeof query }) => Promise<unknown>) =>
        callback({ query }),
    );
    return { query, addJob, withPgClient };
  }

  function publisherOver(jobs: Map<string, KeyedJob>) {
    const graphile = graphileJobs(jobs);
    vi.mocked(makeWorkerUtils).mockResolvedValue({
      addJob: graphile.addJob,
      withPgClient: graphile.withPgClient,
      release: vi.fn(async () => undefined),
    } as never);
    return { publisher: new GraphileJobPublisher({} as Pool), ...graphile };
  }

  it("keeps attempts and run_at while a keyed job still has attempts left", async () => {
    const runAt = new Date("2030-01-01T00:00:00.000Z");
    const jobs = new Map([["run:run-1", { attempts: 2, maxAttempts: 25, runAt }]]);
    const { publisher, addJob, query } = publisherOver(jobs);
    const pulledForward = new Date("2030-01-01T00:00:01.000Z");
    await publisher.enqueue({
      name: "run.continue",
      payload: { runId: "pulled-forward" },
      replaceKey: "run:run-1",
      availableAt: pulledForward,
      keepExisting: true,
    });
    expect(query).toHaveBeenCalledWith(
      "select attempts, max_attempts, locked_at from graphile_worker._private_jobs where key = $1",
      ["run:run-1"],
    );
    expect(addJob).toHaveBeenCalledWith(
      "run.continue",
      expect.anything(),
      expect.objectContaining({
        jobKey: "run:run-1",
        jobKeyMode: "unsafe_dedupe",
        runAt: pulledForward,
      }),
    );
    expect(jobs.get("run:run-1")).toEqual({ attempts: 2, maxAttempts: 25, runAt });
    await publisher.close();
  });

  it("replaces an exhausted job so it is re-enqueued with fresh attempts", async () => {
    const runAt = new Date("2030-01-01T00:00:00.000Z");
    const jobs = new Map([["run:run-1", { attempts: 3, maxAttempts: 3, runAt }]]);
    const { publisher, addJob } = publisherOver(jobs);
    const revivedAt = new Date("2030-01-02T00:00:00.000Z");
    await publisher.enqueue({
      name: "run.continue",
      payload: { runId: "revived" },
      replaceKey: "run:run-1",
      availableAt: revivedAt,
      keepExisting: true,
    });
    const options = addJob.mock.calls[0]?.[2] as { jobKeyMode?: string } | undefined;
    expect(options?.jobKeyMode).toBeUndefined();
    expect(jobs.get("run:run-1")).toEqual({ attempts: 0, maxAttempts: 25, runAt: revivedAt });
    await publisher.close();
  });

  it("keeps a job locked after replaceLockedBefore", async () => {
    const runAt = new Date("2030-01-01T00:00:00.000Z");
    const lockedAt = new Date("2030-01-01T00:00:01.000Z");
    const jobs = new Map([["run:run-1", { attempts: 1, maxAttempts: 25, runAt, lockedAt }]]);
    const { publisher, addJob } = publisherOver(jobs);
    await publisher.enqueue({
      name: "run.continue",
      payload: { runId: "retry-pending" },
      replaceKey: "run:run-1",
      availableAt: new Date("2030-01-01T00:00:02.000Z"),
      keepExisting: true,
      replaceLockedBefore: new Date("2030-01-01T00:00:00.000Z"),
    });
    const options = addJob.mock.calls[0]?.[2] as { jobKeyMode?: string } | undefined;
    expect(options?.jobKeyMode).toBe("unsafe_dedupe");
    expect(jobs.get("run:run-1")).toEqual({ attempts: 1, maxAttempts: 25, runAt, lockedAt });
    await publisher.close();
  });

  it("replaces a locked job so a worker that died mid-job cannot hold the key", async () => {
    const runAt = new Date("2030-01-01T00:00:00.000Z");
    const lockedAt = new Date("2030-01-01T00:00:01.000Z");
    const jobs = new Map([["run:run-1", { attempts: 1, maxAttempts: 25, runAt, lockedAt }]]);
    const { publisher, addJob } = publisherOver(jobs);
    const reclaimedAt = new Date("2030-01-01T04:00:00.000Z");
    await publisher.enqueue({
      name: "run.continue",
      payload: { runId: "reclaimed" },
      replaceKey: "run:run-1",
      availableAt: reclaimedAt,
      keepExisting: true,
      replaceLockedBefore: lockedAt,
    });
    const options = addJob.mock.calls[0]?.[2] as { jobKeyMode?: string } | undefined;
    expect(options?.jobKeyMode).toBeUndefined();
    expect(jobs.get("run:run-1")).toEqual({ attempts: 0, maxAttempts: 25, runAt: reclaimedAt });
    await publisher.close();
  });

  it("enqueues a keepExisting job when no row has that key", async () => {
    const jobs = new Map<string, KeyedJob>();
    const { publisher, addJob } = publisherOver(jobs);
    const runAt = new Date("2030-01-03T00:00:00.000Z");
    await publisher.enqueue({
      name: "run.continue",
      payload: { runId: "fresh" },
      replaceKey: "run:missing",
      availableAt: runAt,
      keepExisting: true,
    });
    const options = addJob.mock.calls[0]?.[2] as { jobKeyMode?: string } | undefined;
    expect(options?.jobKeyMode).toBeUndefined();
    expect(jobs.get("run:missing")).toEqual({ attempts: 0, maxAttempts: 25, runAt });
    await publisher.close();
  });
});

describe("GraphileJobWorkerHost runner lifecycle", () => {
  afterEach(() => {
    run.mockReset();
  });

  it("backs off then restarts when runner.promise rejects with 53300", async () => {
    const first = mockRunner();
    const second = mockRunner();
    run.mockResolvedValueOnce(first.runner).mockResolvedValueOnce(second.runner);
    const sleeps: number[] = [];
    const host = new GraphileJobWorkerHost({} as Pool, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    await host.start(handlers());
    expect(run).toHaveBeenCalledTimes(1);

    first.rejectLife(tooMany);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(sleeps).toEqual([200]);

    await host.stop();
    expect(second.runner.stop).toHaveBeenCalled();
  });

  it("retries launch with escalating backoff when restart start hits 53300", async () => {
    const first = mockRunner();
    const recovered = mockRunner();
    run
      .mockResolvedValueOnce(first.runner)
      .mockRejectedValueOnce(tooMany)
      .mockResolvedValueOnce(recovered.runner);
    const sleeps: number[] = [];
    const host = new GraphileJobWorkerHost({} as Pool, {
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    await host.start(handlers());
    first.rejectLife(tooMany);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(3));
    expect(sleeps).toEqual([200, 400]);

    await host.stop();
    expect(recovered.runner.stop).toHaveBeenCalled();
  });

  it("does not restart when runner.promise rejects for a non-53300 error", async () => {
    const first = mockRunner();
    run.mockResolvedValueOnce(first.runner);
    const host = new GraphileJobWorkerHost({} as Pool, {
      sleep: async () => undefined,
    });
    await host.start(handlers());
    const superviseTask = (host as unknown as { superviseTask: Promise<void> }).superviseTask;

    first.rejectLife(new Error("runner exploded"));
    await expect(superviseTask).rejects.toThrow("runner exploded");
    expect(run).toHaveBeenCalledTimes(1);

    await host.stop();
  });

  it("logs when history compaction fails permanently", async () => {
    const first = mockRunner();
    run.mockResolvedValueOnce(first.runner);
    const sink = createTestSink();
    installLogger(createLogger({ service: "rakazo-worker", sinks: [sink] }));
    const host = new GraphileJobWorkerHost({} as Pool, {
      sleep: async () => undefined,
    });

    try {
      await host.start(handlers());
      const on = first.runner.events.on as ReturnType<typeof vi.fn>;
      const failed = on.mock.calls.find((call) => call[0] === "job:failed")?.[1] as
        | ((event: {
            job: {
              task_identifier: string;
              payload: unknown;
              attempts: number;
              max_attempts: number;
            };
            error: unknown;
          }) => void)
        | undefined;
      expect(failed).toBeTypeOf("function");
      failed?.({
        job: {
          task_identifier: "history.compact",
          payload: wrapJobPayload({ threadId: "thread-9" }),
          attempts: HISTORY_COMPACT_MAX_ATTEMPTS,
          max_attempts: HISTORY_COMPACT_MAX_ATTEMPTS,
        },
        error: new Error("The operation was aborted due to timeout"),
      });
      failed?.({
        job: {
          task_identifier: "run.continue",
          payload: wrapJobPayload({ runId: "run-1" }),
          attempts: 25,
          max_attempts: 25,
        },
        error: new Error("handler failed"),
      });
    } finally {
      await host.stop();
      installLogger(createLogger({ service: "rakazo-worker", level: "off", sinks: [] }));
    }

    expect(
      sink.events.filter((event) => event.message === "history.compact failed permanently"),
    ).toEqual([
      expect.objectContaining({
        level: "error",
        message: "history.compact failed permanently",
        "thread.id": "thread-9",
        "history.compact.reason": "attempts_exhausted",
        "history.compact.retryable": false,
        "job.attempts": HISTORY_COMPACT_MAX_ATTEMPTS,
        "job.max_attempts": HISTORY_COMPACT_MAX_ATTEMPTS,
        error: expect.objectContaining({ message: "The operation was aborted due to timeout" }),
      }),
    ]);
  });

  it("logs exhausted jobs once without logging payloads or retryable failures", async () => {
    const first = mockRunner();
    run.mockResolvedValueOnce(first.runner);
    const sink = createTestSink();
    installLogger(createLogger({ service: "rakazo-worker", sinks: [sink] }));
    const host = new GraphileJobWorkerHost({} as Pool);
    const longMessage = "x".repeat(501);

    try {
      await host.start(handlers());
      const on = first.runner.events.on as ReturnType<typeof vi.fn>;
      const failed = on.mock.calls.find((call) => call[0] === "job:failed")?.[1] as
        | ((event: {
            job: {
              id: string;
              task_identifier: string;
              payload: unknown;
              attempts: number;
              max_attempts: number;
            };
            error: unknown;
          }) => void)
        | undefined;
      expect(failed).toBeTypeOf("function");
      failed?.({
        job: {
          id: "job-17",
          task_identifier: "mail.sync",
          payload: { privateUserData: "must-not-log" },
          attempts: 5,
          max_attempts: 5,
        },
        error: new Error(longMessage),
      });
      failed?.({
        job: {
          id: "job-18",
          task_identifier: "mail.sync",
          payload: { privateUserData: "must-not-log-either" },
          attempts: 4,
          max_attempts: 5,
        },
        error: new Error("temporary failure"),
      });
    } finally {
      await host.stop();
      installLogger(createLogger({ service: "rakazo-worker", level: "off", sinks: [] }));
    }

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toEqual(
      expect.objectContaining({
        level: "error",
        "job.task": "mail.sync",
        "job.id": "job-17",
        "job.attempts": 5,
        error: expect.objectContaining({ message: "x".repeat(500) }),
      }),
    );
    expect(JSON.stringify(sink.events)).not.toContain("must-not-log");
  });

  it("wakes a pending restart delay when stop is called", async () => {
    const first = mockRunner();
    run.mockResolvedValueOnce(first.runner);
    const sleepStarted = deferred();
    const host = new GraphileJobWorkerHost({} as Pool, {
      sleep: () => {
        sleepStarted.resolve();
        return new Promise(() => undefined);
      },
    });
    await host.start(handlers());
    first.rejectLife(tooMany);
    await sleepStarted.promise;

    await host.stop();
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("createRoutineRetryNoticeReconciler", () => {
  function pendingNotices(payloads: unknown[] = [wrapJobPayload({ runId: "run-1" })]) {
    const pending = payloads.map((payload, index) => ({
      id: String(index + 1),
      revision: 2,
      payload,
    }));
    const query = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.startsWith("select")) {
        return {
          rows: pending
            .filter((job) => BigInt(job.id) > BigInt(String(params?.[0])))
            .slice(0, Number(params?.[1])),
        };
      }
      const index = pending.findIndex(
        (job) => job.id === params?.[0] && job.revision === params?.[1],
      );
      if (index >= 0) pending.splice(index, 1);
      return { rows: [] };
    });
    return { pending, query, pool: { query } as unknown as Pool };
  }

  it("retains a failed callback for recovery by a later reconciliation", async () => {
    const { pending, query, pool } = pendingNotices();
    const notify = vi
      .fn()
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValue(undefined);
    await createRoutineRetryNoticeReconciler(pool, notify)();
    expect(pending).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(1);

    // A new pass has no dependence on an event or in-memory retry state.
    await createRoutineRetryNoticeReconciler(pool, notify)();
    expect(notify.mock.calls).toEqual([["run-1"], ["run-1"]]);
    expect(pending).toHaveLength(0);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("revision = $2"), ["1", 2]);
    await createRoutineRetryNoticeReconciler(pool, notify)();
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("continues other notices after a failed delivery and skips malformed payloads", async () => {
    const { pool, pending } = pendingNotices([
      { runId: "run-1" },
      wrapJobPayload({ runId: "run-2" }),
      null,
      {},
      { runId: 1 },
      { runId: "" },
    ]);
    const notify = vi
      .fn()
      .mockRejectedValueOnce(new Error("lookup failed"))
      .mockResolvedValue(undefined);
    await createRoutineRetryNoticeReconciler(pool, notify)();
    expect(notify.mock.calls).toEqual([["run-1"], ["run-2"]]);
    expect(pending.map((job) => job.id)).toEqual(["1", "3", "4", "5", "6"]);
  });

  it("retains the request if acknowledging delivery fails", async () => {
    const { pool, query, pending } = pendingNotices();
    query
      .mockImplementationOnce(async () => ({ rows: [...pending] }))
      .mockRejectedValueOnce(new Error("delete failed"));
    const notify = vi.fn(async () => undefined);
    await createRoutineRetryNoticeReconciler(pool, notify)();
    expect(pending).toHaveLength(1);
    await createRoutineRetryNoticeReconciler(pool, notify)();
    expect(notify).toHaveBeenCalledTimes(2);
    expect(pending).toHaveLength(0);
  });

  it("bounds each pass and advances beyond failures before retrying them", async () => {
    const { pool } = pendingNotices(
      Array.from({ length: 21 }, (_, index) => ({ runId: `run-${index + 1}` })),
    );
    const notify = vi.fn(async () => {
      throw new Error("destination unavailable");
    });
    const reconcile = createRoutineRetryNoticeReconciler(pool, notify);
    await reconcile();
    expect(notify).toHaveBeenCalledTimes(20);
    await reconcile();
    expect(notify).toHaveBeenCalledTimes(21);
    expect(notify).toHaveBeenLastCalledWith("run-21");
    await reconcile();
    expect(notify).toHaveBeenCalledTimes(41);
  });

  it("sends concurrently with a bounded number of active deliveries", async () => {
    const { pool } = pendingNotices(
      Array.from({ length: 20 }, (_, index) => ({ runId: `run-${index}` })),
    );
    const release = deferred();
    let active = 0;
    let peak = 0;
    const notify = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await release.promise;
      active -= 1;
    });
    const delivering = createRoutineRetryNoticeReconciler(pool, notify)();
    await vi.waitFor(() => expect(notify).toHaveBeenCalledTimes(4));
    release.resolve();
    await delivering;
    expect(notify).toHaveBeenCalledTimes(20);
    expect(peak).toBe(4);
  });

  it("keeps concurrently replaced work when acknowledging a notice", async () => {
    const { pool, pending } = pendingNotices();
    await createRoutineRetryNoticeReconciler(pool, async () => {
      pending[0] = { id: "1", revision: 3, payload: { runId: "new-run" } };
    })();
    expect(pending).toEqual([{ id: "1", revision: 3, payload: { runId: "new-run" } }]);
  });
});
