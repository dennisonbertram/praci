import type { AdapterContext } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type * as BotMessagesModule from "./bot-messages.js";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor, NO_RESPONSE } from "./executor.js";

vi.mock("./bot-messages.js", async (importOriginal) => ({
  ...(await importOriginal<typeof BotMessagesModule>()),
  loadBotMessageContext: async () => undefined,
  returnBotMessageOutcome: vi.fn(async () => undefined),
}));
vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  provisionComputer: async () => ({ id: "computer-1", kind: "desktop" }),
}));

async function runInbound(options: { trigger: string; quiet: boolean; reply: string }) {
  const run = {
    id: "run-1",
    botId: "bot-1",
    threadId: "thread-1",
    taskId: "task-1",
    spaceId: "space-1",
    userId: "user-1",
    status: "queued",
    trigger: options.trigger,
    routineId: "routine-1",
    sourceMessageId: null,
    leaseFence: 0,
    phase: null,
  };
  const runtimeRun = vi.fn(async function* () {
    yield { type: "text" as const, text: options.reply };
    yield { type: "done" as const, text: options.reply };
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
    routine: {
      findUnique: vi.fn(async () => ({ quiet: options.quiet, managedKind: null })),
      findFirst: vi.fn(async () => ({ notifyOnFinish: false })),
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
      findUnique: vi.fn(async () => ({ meetingTaintedAt: null })),
    },
    message: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    task: { findUniqueOrThrow: vi.fn(async () => ({ id: run.taskId, prompt: "Check it" })) },
    computer: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findUnique: vi.fn(async () => null),
    },
    connection: { findMany: vi.fn(async () => []) },
    spaceModelPreference: { findFirst: vi.fn(async () => null) },
    secret: { findFirst: vi.fn(async () => null) },
    userModelCredential: { findFirst: vi.fn(async () => null) },
    spaceBackupModel: { findMany: vi.fn(async () => []) },
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
    artifact: { findMany: vi.fn(async () => []) },
  };
  const finalizeRun = vi.fn(async () => ({ continuationRunId: null }));
  const executor = createRunExecutor({
    prisma,
    deploymentModelKey: "fake-deployment-key",
    runtime: { describe: () => ({ capabilities: {} }), run: runtimeRun },
    connector: { discoverTools: vi.fn(async (_context: AdapterContext) => []) },
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
    events: { append: vi.fn(async () => undefined), finalizeRun },
    jobs: { enqueue: vi.fn(async () => undefined) },
    secrets: [],
  } as unknown as Parameters<typeof createRunExecutor>[0]);
  await executor.continueRun(run.id, "worker-1");
  const [completed] = finalizeRun.mock.calls as unknown as [
    [{ outcome: string; blocks: Array<{ kind: string; text?: string }> }],
  ];
  return completed![0];
}

describe("a silent inbound webhook routine", () => {
  it("publishes no assistant text when a quiet routine answers NO_RESPONSE", async () => {
    const completed = await runInbound({ trigger: "webhook", quiet: true, reply: NO_RESPONSE });
    expect(completed.outcome).toBe("completed");
    expect(completed.blocks).toEqual([]);
  });

  it("still publishes the answer of a routine that is not quiet", async () => {
    const completed = await runInbound({ trigger: "webhook", quiet: false, reply: NO_RESPONSE });
    expect(completed.outcome).toBe("completed");
    expect(completed.blocks).toEqual([{ kind: "text", text: NO_RESPONSE }]);
  });
});
