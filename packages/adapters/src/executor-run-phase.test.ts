import type { AdapterContext } from "@rakazo/adapter-kit";
import type { RunPhase } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { ComputerBusyError } from "./computer-lifecycle.js";
import { createRunExecutor, REQUEUE_LIMIT, requeueLimitReached } from "./executor.js";

const lifecycle = vi.hoisted(() => ({
  provision: vi.fn(async (): Promise<unknown> => ({ id: "computer-1", kind: "desktop" })),
  acquire: vi.fn(async (): Promise<unknown> => null),
}));
vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: () => lifecycle.acquire(),
  provisionComputer: () => lifecycle.provision(),
}));

const history = [
  {
    id: "current",
    threadId: "thread-1",
    seq: 2,
    role: "user",
    runId: "run-1",
    blocks: [{ kind: "text", text: "Hello!" }],
    replyToMessageId: null,
    replyQuote: null,
    replyTo: null,
  },
];

async function continueRun(storedPhase: RunPhase | null = null) {
  const run: Record<string, unknown> = {
    id: "run-1",
    botId: "bot-1",
    threadId: "thread-1",
    taskId: "task-1",
    spaceId: "space-1",
    userId: "user-1",
    status: "queued",
    trigger: "user",
    leaseFence: 0,
    phase: storedPhase,
  };
  const runtimeRun = vi.fn(async function* () {
    yield { type: "text" as const, text: "Hi" };
    yield { type: "done" as const, text: "Hi" };
  });
  const prisma = {
    run: {
      findUnique: vi.fn(async () => run),
      findUniqueOrThrow: vi.fn(async () => run),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(run, data);
        return { count: 1 };
      }),
    },
    bot: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: run.botId,
        name: "Assistant",
        title: "Assistant",
        description: "Test assistant",
        modelProvider: null,
        modelId: null,
        thinkingLevel: null,
        computerId: "computer-1",
        computerSwitching: false,
        memoryScope: null,
        computer: { id: "computer-1", scope: "dedicated", state: "stopped" },
      })),
      findMany: vi.fn(async () => []),
    },
    attempt: {
      create: vi.fn(async () => ({ id: "attempt-1" })),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    thread: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: run.threadId,
        groupId: null,
        historyCompactionSummary: null,
        historyCompactedUpToSeq: null,
        nextMessageSeq: 3,
      })),
    },
    message: {
      findMany: vi.fn(async (args: { where?: { threadId?: string } }) =>
        args.where?.threadId ? history : [],
      ),
      findUnique: vi.fn(async () => null),
    },
    task: { findUniqueOrThrow: vi.fn(async () => ({ id: run.taskId, prompt: "Look again" })) },
    computer: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => null),
    },
    connection: { findMany: vi.fn(async () => []) },
    spaceModelPreference: {
      findFirst: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown> | null>>(
        async () => null,
      ),
    },
    secret: { findFirst: vi.fn(async () => null) },
    userModelCredential: { findFirst: vi.fn(async () => null) },
    spaceBackupModel: {
      findMany: vi.fn(async () => {
        return [];
      }),
    },

    deploymentSettings: {
      findUnique: vi.fn(async () => ({
        defaultModelProvider: "openrouter",
        defaultModelId: "openai/gpt-6-luna",
      })),
    },
    taughtSkill: { findMany: vi.fn(async () => []) },
    agentSecret: { findMany: vi.fn(async () => []) },
    botSecret: { findMany: vi.fn(async () => []) },
    agentSkill: { findMany: vi.fn(async () => []) },
    scratchpadItem: { findMany: vi.fn(async () => []) },
    externalEffect: { findMany: vi.fn(async () => []) },
    artifact: {
      findMany: vi.fn(async () => []),
    },
  };
  const finalizeRun = vi.fn(async () => ({ continuationRunId: null }));
  const append = vi.fn(async () => undefined);
  const enqueue = vi.fn(async () => undefined);
  const executor = createRunExecutor({
    prisma,
    deploymentModelKey: "fake-deployment-key",
    runtime: { describe: () => ({ capabilities: {} }), run: runtimeRun },
    connector: {
      discoverTools: vi.fn(async (context: AdapterContext) => {
        context.onConnecting?.("Devin");
        return [];
      }),
    },
    sandbox: {
      describe: () => ({ capabilities: { graphical: false } }),
      writeFile: vi.fn(async () => undefined),
      async *exportWorkspace() {
        yield* [];
      },
    },
    home: { commit: vi.fn(async () => "fixture-revision") },
    memory: { read: async () => ({ documents: [] }) },
    memoryProviders: { resolve: async () => null },
    artifacts: { get: vi.fn() },
    events: { append, finalizeRun },
    jobs: { enqueue },
    secrets: [],
  } as unknown as Parameters<typeof createRunExecutor>[0]);
  await executor.continueRun("run-1", "worker-1");
  const phases = (append.mock.calls as unknown as [{ type: string; payload: RunPhase }][])
    .filter(([event]) => event.type === "run.phase")
    .map(([event]) => event.payload);
  return { run, phases, finalizeRun, enqueue, runtimeRun };
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe("run phases", () => {
  it("reports connecting, starting the computer, waiting for the model and thinking in order", async () => {
    const { phases, runtimeRun } = await continueRun();
    expect(runtimeRun).toHaveBeenCalled();
    expect(phases.map(({ kind, name }) => (name ? `${kind}:${name}` : kind))).toEqual([
      "connecting:Devin",
      "computer_start",
      "model_wait:gpt-6-luna",
      "thinking",
    ]);
    // Reaching the model ends any requeue streak.
    expect(phases.at(-1)).not.toHaveProperty("since");
  });

  it("requeues a busy computer with a waiting phase and counts the streak", async () => {
    lifecycle.provision.mockRejectedValueOnce(
      new ComputerBusyError("another start is in progress"),
    );
    const { run, phases, finalizeRun, enqueue } = await continueRun({
      kind: "computer_wait",
      at: minutesAgo(1),
      since: minutesAgo(1),
      count: 3,
    });
    expect(finalizeRun).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalled();
    expect(run.status).toBe("queued");
    expect(phases.at(-1)).toMatchObject({ kind: "computer_wait", count: 4 });
  });

  it("stops a run that has been requeued without progress past the limit", async () => {
    lifecycle.provision.mockRejectedValueOnce(
      new ComputerBusyError("another start is in progress"),
    );
    const { finalizeRun, enqueue } = await continueRun({
      kind: "computer_wait",
      at: minutesAgo(16),
      since: minutesAgo(16),
      count: REQUEUE_LIMIT.count - 1,
    });
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        error:
          "Stopped after 15 minutes waiting for the computer. Try again, or restart the computer.",
      }),
    );
    expect(enqueue).not.toHaveBeenCalledWith(expect.objectContaining({ type: "run.continue" }));
  });

  it("does not count waiting in line behind another run of the same bot", async () => {
    lifecycle.acquire.mockRejectedValueOnce(new ComputerBusyError("in use by another run"));
    const { phases, finalizeRun } = await continueRun({
      kind: "computer_wait",
      at: minutesAgo(30),
      since: minutesAgo(30),
      count: REQUEUE_LIMIT.count + 5,
    });
    expect(finalizeRun).not.toHaveBeenCalled();
    expect(phases.at(-1)).toMatchObject({ kind: "computer_wait", count: REQUEUE_LIMIT.count + 5 });
  });

  it("needs both the count and the time before it stops a run", () => {
    expect(requeueLimitReached({ since: minutesAgo(16), count: 19 })).toBe(false);
    expect(requeueLimitReached({ since: minutesAgo(14), count: 50 })).toBe(false);
    expect(requeueLimitReached({ since: minutesAgo(16), count: 20 })).toBe(true);
    expect(requeueLimitReached(undefined)).toBe(false);
  });
});
