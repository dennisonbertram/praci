import type { AdapterContext } from "@rakazo/adapter-kit";
import type { RunPhase } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type * as BotMessagesModule from "./bot-messages.js";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { ComputerBusyError, IN_LINE_BEHIND_SAME_BOT } from "./computer-lifecycle.js";
import {
  createRunExecutor,
  REQUEUE_LIMIT,
  requeueLimitReached,
  runPhaseWriter,
} from "./executor.js";

const lifecycle = vi.hoisted(() => ({
  provision: vi.fn(async (): Promise<unknown> => ({ id: "computer-1", kind: "desktop" })),
  acquire: vi.fn(async (): Promise<unknown> => null),
}));
const botMessages = vi.hoisted(() => ({ returnOutcome: vi.fn(async () => undefined) }));
vi.mock("./bot-messages.js", async (importOriginal) => ({
  ...(await importOriginal<typeof BotMessagesModule>()),
  loadBotMessageContext: async () => undefined,
  returnBotMessageOutcome: botMessages.returnOutcome,
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

async function continueRun(storedPhase: RunPhase | null = null, trigger = "user") {
  const run: Record<string, unknown> = {
    id: "run-1",
    botId: "bot-1",
    threadId: "thread-1",
    taskId: "task-1",
    spaceId: "space-1",
    userId: "user-1",
    status: "queued",
    trigger,
    sourceMessageId: trigger === "bot_message" ? "current" : null,
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

    aiDataConsent: { findUnique: vi.fn(async () => ({ version: AI_DISCLOSURE_VERSION })) },
    user: { findUnique: vi.fn(async () => ({ timezone: null })) },
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
    botSkillSetting: { findMany: vi.fn(async () => []) },
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
    lifecycle.acquire.mockRejectedValueOnce(new ComputerBusyError(IN_LINE_BEHIND_SAME_BOT));
    const { phases, finalizeRun } = await continueRun({
      kind: "computer_wait",
      at: minutesAgo(30),
      since: minutesAgo(30),
      count: REQUEUE_LIMIT.count + 5,
    });
    expect(finalizeRun).not.toHaveBeenCalled();
    expect(phases.at(-1)).toMatchObject({ kind: "computer_wait", count: REQUEUE_LIMIT.count + 5 });
  });

  it("counts and stops a computer that stays unavailable for its lease", async () => {
    lifecycle.acquire.mockRejectedValueOnce(new ComputerBusyError("under maintenance"));
    const { finalizeRun } = await continueRun({
      kind: "computer_wait",
      at: minutesAgo(16),
      since: minutesAgo(16),
      count: REQUEUE_LIMIT.count - 1,
    });
    expect(finalizeRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
  });

  it("needs both the count and the time before it stops a run", () => {
    expect(requeueLimitReached({ since: minutesAgo(16), count: 19 })).toBe(false);
    expect(requeueLimitReached({ since: minutesAgo(14), count: 50 })).toBe(false);
    expect(requeueLimitReached({ since: minutesAgo(16), count: 20 })).toBe(true);
    expect(requeueLimitReached(undefined)).toBe(false);
  });

  it("reports a breaker stop back to the bot that delegated the request", async () => {
    botMessages.returnOutcome.mockClear();
    lifecycle.provision.mockRejectedValueOnce(
      new ComputerBusyError("another start is in progress"),
    );
    const { finalizeRun } = await continueRun(
      {
        kind: "computer_wait",
        at: minutesAgo(16),
        since: minutesAgo(16),
        count: REQUEUE_LIMIT.count - 1,
      },
      "bot_message",
    );
    expect(finalizeRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
    expect(botMessages.returnOutcome).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "run-1" }),
      expect.objectContaining({ id: "bot-1" }),
      expect.stringContaining("Stopped after 15 minutes waiting for the computer"),
      "status",
      { forceUnread: true },
    );
  });
});

describe("runPhaseWriter", () => {
  function fakeRun(trigger: string, phase: RunPhase | null = null) {
    const row = {
      id: "run-1",
      spaceId: "space-1",
      threadId: "thread-1",
      botId: "bot-1",
      trigger,
      status: "running",
      leaseFence: 1,
      phase: phase as unknown,
    };
    const updateMany = vi.fn(
      async ({
        where,
        data,
      }: {
        where: { status: { in: string[] } };
        data: { phase: unknown };
      }) => {
        if (!where.status.in.includes(row.status)) return { count: 0 };
        row.phase = data.phase;
        return { count: 1 };
      },
    );
    const append = vi.fn(async () => undefined);
    const deps = { prisma: { run: { updateMany } }, events: { append } } as never;
    return { row, deps, append, writer: () => runPhaseWriter(deps, row, 1) };
  }

  it("keeps a background run's streak on the row across workers without showing it", async () => {
    const f = fakeRun("tickets");
    await f.writer().requeued({ kind: "computer_wait" }, "busy", true);
    // A later claim starts a fresh writer from the stored row.
    const streak = await f.writer().requeued({ kind: "computer_wait" }, "busy", true);
    expect(streak.count).toBe(2);
    expect(f.row.phase).toMatchObject({ kind: "computer_wait", count: 2 });
    expect(f.append).not.toHaveBeenCalled();
  });

  it("keeps counting a requeue that comes after the model was called", async () => {
    const f = fakeRun("user", {
      kind: "retrying",
      at: minutesAgo(5),
      since: minutesAgo(5),
      count: 3,
    });
    const writer = f.writer();
    await writer.write({ kind: "model_wait", name: "gpt-6-luna" });
    await writer.write({ kind: "thinking" });
    const streak = await writer.requeued({ kind: "retrying" }, "database interruption", true);
    expect(streak.count).toBe(4);
  });

  it("ends the streak once the run produces a tool call or text", async () => {
    const f = fakeRun("user", {
      kind: "retrying",
      at: minutesAgo(5),
      since: minutesAgo(5),
      count: 3,
    });
    const writer = f.writer();
    await writer.progressed();
    expect(f.row.phase).not.toHaveProperty("since");
    const streak = await writer.requeued({ kind: "retrying" }, "database interruption", true);
    expect(streak.count).toBe(1);
  });

  it("does not write a phase onto a finished run", async () => {
    const f = fakeRun("user");
    f.row.status = "failed";
    await f.writer().write({ kind: "thinking" });
    expect(f.row.phase).toBeNull();
    expect(f.append).not.toHaveBeenCalled();
  });
});
