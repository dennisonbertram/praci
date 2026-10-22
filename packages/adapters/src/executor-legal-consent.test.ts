import type { AgentRunRequest } from "@rakazo/adapter-kit";
import { LEGAL_CONSENT_REQUIRED_MESSAGE } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";

vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  provisionComputer: async () => ({ id: "computer-1", kind: "desktop" }),
}));

function historyMessages() {
  return [
    {
      id: "current",
      threadId: "thread-1",
      seq: 1,
      role: "user",
      runId: "run-1",
      blocks: [{ kind: "text", text: "what contracts renew soon?" }],
      replyToMessageId: null,
      replyQuote: null,
      replyTo: null,
    },
  ];
}

async function runLegal(consented: boolean, modelId = "meta/muse-spark-1.2", trigger = "user") {
  const switchModel = { provider: "openrouter", modelId: "openai/gpt-4o" };
  const backupReadFails = false;
  const scripted = false;
  const run = {
    id: "run-1",
    botId: "bot-1",
    threadId: "thread-1",
    taskId: "task-1",
    spaceId: "space-1",
    userId: "user-1",
    status: "queued",
    trigger,
    leaseFence: 0,
  };
  const get = vi.fn(async () => new Uint8Array([1, 2, 3, 4]));
  let request: AgentRunRequest | undefined;
  const runtimeRun = vi.fn(async function* (next: AgentRunRequest) {
    request = next;
    yield { type: "done" as const, text: "Done" };
  });
  const prisma = {
    // Messages are written in a transaction; none is set up here, so a write fails like before.
    $transaction: vi.fn(async () => {
      throw new Error("no message writes in this test");
    }),
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
        name: "Legal agent",
        userId: "user-1",
        spawnKey: "legal-agent:user-1",
        title: "Assistant",
        description: "Test assistant",
        modelProvider: null,
        modelId: null,
        thinkingLevel: null,
        computerId: "computer-1",
        computerSwitching: false,
        memoryScope: null,
        computer: { id: "computer-1", scope: "dedicated" },
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
        args.where?.threadId ? historyMessages() : [],
      ),
      findUnique: vi.fn(async () => null),
    },
    task: { findUniqueOrThrow: vi.fn(async () => ({ id: run.taskId, prompt: "Look again" })) },
    computer: { updateMany: vi.fn(async () => ({ count: 1 })) },
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
        if (backupReadFails) throw new Error("Backup list unavailable");
        return switchModel
          ? [{ provider: switchModel.provider, modelId: switchModel.modelId }]
          : [];
      }),
    },

    deploymentSettings: {
      findUnique: vi.fn(async () => ({
        defaultModelProvider: "openrouter",
        defaultModelId: modelId,
      })),
    },
    aiDataConsent: {
      findFirst: vi.fn(async () => (consented ? { userId: "user-1" } : null)),
    },
    user: { findUnique: vi.fn(async () => null) },
    taughtSkill: { findMany: vi.fn(async () => []) },
    agentSecret: { findMany: vi.fn(async () => []) },
    botSecret: { findMany: vi.fn(async () => []) },
    agentSkill: { findMany: vi.fn(async () => []) },
    botSkillSetting: { findMany: vi.fn(async () => []) },
    scratchpadItem: { findMany: vi.fn(async () => []) },
    externalEffect: { findMany: vi.fn(async () => []) },
    artifact: {
      findMany: vi.fn(async () => [
        { id: "art-1", storageKey: "shot.png", size: 4, mimeType: "image/png", name: "shot.png" },
      ]),
    },
  };
  const finalizeRun = vi.fn(async () => ({ continuationRunId: null }));
  const executor = createRunExecutor({
    prisma,
    deploymentModelKey: "fake-deployment-key",
    runtime: { describe: () => ({ capabilities: { scripted } }), run: runtimeRun },
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
    artifacts: { get },
    events: { append: vi.fn(async () => undefined), finalizeRun },
    jobs: { enqueue: vi.fn(async () => undefined) },
    secrets: [],
  } as unknown as Parameters<typeof createRunExecutor>[0]);

  await executor.continueRun(run.id, "worker-1");
  return { request, prisma, runtimeRun, finalizeRun };
}

describe("Legal agent runs need Data Room consent for the model they use", () => {
  it("ends the run without calling the model when consent is missing", async () => {
    const { runtimeRun, finalizeRun, prisma } = await runLegal(false);
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        error: LEGAL_CONSENT_REQUIRED_MESSAGE,
      }),
    );
    // The bar above the composer shows the run's error; no bot message repeats it in the chat.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("still sends the consent notice as a bot message on a linked messaging chat", async () => {
    const { prisma } = await runLegal(false, "meta/muse-spark-1.2", "messaging");
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("runs on the consented model only: no backup models are read or offered", async () => {
    const { request, prisma, runtimeRun, finalizeRun } = await runLegal(true);
    expect(runtimeRun).toHaveBeenCalled();
    expect(finalizeRun).not.toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
    expect(request?.model.id).toBe("meta/muse-spark-1.2");
    expect(prisma.spaceBackupModel.findMany).not.toHaveBeenCalled();
    expect(request?.fallbackModels).toEqual([]);
    expect(request?.resolveFallbackModel).toBeUndefined();
  });

  it("runs on the space default model when the Legal agent has no key of its own", async () => {
    const { request, runtimeRun, finalizeRun } = await runLegal(true, "openai/gpt-6-luna");
    expect(runtimeRun).toHaveBeenCalled();
    expect(finalizeRun).not.toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
    expect(request?.model.id).toBe("openai/gpt-6-luna");
  });

  it("still asks for consent when the resolved model is not Muse Spark", async () => {
    const { runtimeRun, finalizeRun } = await runLegal(false, "openai/gpt-6-luna");
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failed", error: LEGAL_CONSENT_REQUIRED_MESSAGE }),
    );
  });
});
