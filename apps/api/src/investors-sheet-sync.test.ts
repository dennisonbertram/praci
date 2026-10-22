import type { Actor, Bot } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { SheetReadDeps } from "./investors-sheet-sync.js";
import { sheetReadState, startSheetRead } from "./investors-sheet-sync.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

function fakes(
  options: {
    source?: string;
    sourceRef?: { driveFileId: string; name: string } | null;
    active?: boolean;
    hasModel?: boolean;
  } = {},
) {
  const bot = { id: "bot-1", threadId: "thread-1" } as Bot;
  const createBot = vi.fn(async () => bot);
  const runFindFirst = vi.fn(async () => (options.active ? { id: "run-active" } : null));
  const runCreate = vi.fn(async () => ({ id: "run-new" }));
  const taskCreate = vi.fn(async () => ({ id: "task-1" }));
  const messageCreate = vi.fn(async () => ({ id: "msg-1" }));
  const tx = {
    $executeRaw: vi.fn(async () => 0),
    run: { findFirst: runFindFirst, create: runCreate },
    task: { create: taskCreate },
    thread: { update: vi.fn(async () => ({ nextMessageSeq: 1, nextEventSeq: 1 })) },
    message: { create: messageCreate },
    event: { create: vi.fn(async () => ({ id: "evt-1" })) },
    routine: {
      findFirst: vi.fn(async () => ({ id: "routine-1", crons: [], active: true })),
      create: vi.fn(),
    },
  };
  const enqueueRun = vi.fn(async () => {});
  const sourceRef =
    options.sourceRef === undefined
      ? { driveFileId: "file-1", name: "Cap table" }
      : options.sourceRef;
  const deps = {
    prisma: {
      capTableSnapshot: {
        findUnique: vi.fn(async () =>
          options.source === "none"
            ? null
            : { source: options.source ?? "sheet", data: { sourceRef } },
        ),
      },
      user: { findUnique: vi.fn(async () => ({ timezone: "UTC" })) },
      $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
    },
    jobs: { enqueue: vi.fn(async () => {}), cancel: vi.fn(async () => {}) },
    repos: { createBot },
    hasModel: vi.fn(async () => options.hasModel ?? true),
    enqueueRun,
  } as unknown as SheetReadDeps;
  return { deps, createBot, runFindFirst, runCreate, taskCreate, enqueueRun, messageCreate, tx };
}

describe("startSheetRead", () => {
  it("queues one routine run on the Investors agent whose prompt names the file id", async () => {
    const f = fakes();
    expect(await startSheetRead(f.deps, actor)).toBe("started");
    expect(f.runCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          botId: "bot-1",
          userId: "user-1",
          spaceId: "space-1",
          trigger: "routine",
          status: "queued",
        }),
      }),
    );
    const task = (f.taskCreate.mock.calls[0] as unknown as [{ data: { prompt: string } }])[0];
    for (const word of ["file-1", "drive_read", "cap_table_update", "truncated"])
      expect(task.data.prompt).toContain(word);
    expect(f.enqueueRun).toHaveBeenCalledWith("run-new");
  });

  it("takes the per-user advisory lock and starts no second run while one is active", async () => {
    const f = fakes({ active: true });
    expect(await startSheetRead(f.deps, actor)).toBe("running");
    expect(f.tx.$executeRaw).toHaveBeenCalled();
    expect(f.runCreate).not.toHaveBeenCalled();
    expect(f.enqueueRun).not.toHaveBeenCalled();
    expect(f.runFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          spaceId: "space-1",
          status: { in: expect.arrayContaining(["waiting_input", "waiting_takeover"]) },
        }),
      }),
    );
  });

  it("reads only while the table's source is a sheet with a file", async () => {
    for (const options of [
      { source: "carta" },
      { source: "native" },
      { source: "none" },
      { sourceRef: null },
    ]) {
      const f = fakes(options);
      expect(await startSheetRead(f.deps, actor)).toBe("other_source");
      expect(f.runCreate).not.toHaveBeenCalled();
    }
  });

  it("reports a missing model without queuing", async () => {
    const f = fakes({ hasModel: false });
    expect(await startSheetRead(f.deps, actor)).toBe("no_model");
    expect(f.runCreate).not.toHaveBeenCalled();
  });
});

describe("sheetReadState", () => {
  const stateFor = async (
    run: { status: string; createdAt: Date } | null,
    updatedAt: Date | null,
  ) =>
    sheetReadState(
      { run: { findFirst: vi.fn(async () => run) } } as never,
      actor,
      updatedAt?.toISOString() ?? null,
    );
  const t0 = new Date("2026-01-01T00:00:00Z");
  const t1 = new Date("2026-01-01T00:05:00Z");

  it("is reading while the latest run is active", async () => {
    expect(await stateFor({ status: "running", createdAt: t1 }, t0)).toEqual({
      reading: true,
      lastReadFailed: false,
    });
  });

  it("failed when the run ended and the snapshot is older than the run", async () => {
    expect(await stateFor({ status: "completed", createdAt: t1 }, t0)).toEqual({
      reading: false,
      lastReadFailed: true,
    });
    expect(await stateFor({ status: "failed", createdAt: t1 }, null)).toEqual({
      reading: false,
      lastReadFailed: true,
    });
  });

  it("not failed when the snapshot was written after the run began, or there is no run", async () => {
    expect(await stateFor({ status: "completed", createdAt: t0 }, t1)).toEqual({
      reading: false,
      lastReadFailed: false,
    });
    expect(await stateFor(null, t1)).toEqual({ reading: false, lastReadFailed: false });
  });
});
