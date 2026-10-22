import type { AgentRunRequest } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";

const allowedKey = (modelId: string) =>
  aiRecipient({ provider: "openrouter", modelId, use: "model" })?.key;

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

async function runChat(
  consented: boolean | string[],
  effectStatus: string | null = null,
  trigger = "user",
  sourceBlocks: unknown[] | null = null,
  delegate = false,
) {
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
    sourceMessageId: sourceBlocks ? "source-1" : null,
    leaseFence: 0,
  };
  const get = vi.fn(async () => new Uint8Array([1, 2, 3, 4]));
  let request: AgentRunRequest | undefined;
  const runtimeRun = vi.fn(async function* (next: AgentRunRequest) {
    request = next;
    if (delegate) {
      await next.executeTool?.("message_bot", { bot_id: "bot-2", message: "hi" }, "call-1");
    }
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
        name: "Chief",
        userId: "user-1",
        spawnKey: null,
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
      findMany: vi.fn(async () => [{ id: "bot-2", name: "Ana", spawnKey: null }]),
      // The delegation target runs on a different model than the chat bot.
      findFirst: vi.fn(async (args: { where?: { id?: string } }) => ({
        id: "bot-2",
        name: "Ana",
        userId: "user-1",
        modelProvider: args.where?.id === "bot-2" ? "openrouter" : null,
        modelId: args.where?.id === "bot-2" ? "openai/gpt-4o" : null,
        thinkingLevel: null,
      })),
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
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () =>
        sourceBlocks ? { blocks: sourceBlocks, replyTo: null } : null,
      ),
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
    userModelCredential: {
      findFirst: vi.fn(async () => ({
        id: "cred-1",
        userId: "user-1",
        provider: "openrouter",
        label: "OpenRouter",
        secretId: "secret-1",
        createdAt: new Date(0),
      })),
    },
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
        defaultModelId: "openai/gpt-6-luna",
      })),
    },
    aiDataConsent: {
      findUnique: vi.fn(
        async (args: { where: { userId_spaceId_recipientKey: { recipientKey: string } } }) => {
          const key = args.where.userId_spaceId_recipientKey.recipientKey;
          const ok = Array.isArray(consented)
            ? consented.some((modelId) => allowedKey(modelId) === key)
            : consented;
          return ok ? { version: AI_DISCLOSURE_VERSION } : null;
        },
      ),
    },
    user: { findUnique: vi.fn(async () => null) },
    taughtSkill: { findMany: vi.fn(async () => []) },
    agentSecret: { findMany: vi.fn(async () => []) },
    botSecret: { findMany: vi.fn(async () => []) },
    agentSkill: { findMany: vi.fn(async () => []) },
    botSkillSetting: { findMany: vi.fn(async () => []) },
    scratchpadItem: { findMany: vi.fn(async () => []) },
    externalEffect: {
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () =>
        effectStatus
          ? { id: "effect-1", runId: "run-1", spaceId: "space-1", status: effectStatus }
          : null,
      ),
      create: vi.fn(async () => ({
        id: "effect-1",
        runId: "run-1",
        spaceId: "space-1",
        status: "intended",
      })),
    },
    artifact: {
      findMany: vi.fn(async () => [
        { id: "art-1", storageKey: "shot.png", size: 4, mimeType: "image/png", name: "shot.png" },
      ]),
    },
  };
  const finalizeRun = vi.fn(async () => ({ continuationRunId: null }));
  const pauseRunForInput = vi.fn(async () => true);
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
    events: { append: vi.fn(async () => undefined), finalizeRun, pauseRunForInput },
    jobs: { enqueue: vi.fn(async () => undefined) },
    secrets: [],
  } as unknown as Parameters<typeof createRunExecutor>[0]);

  await executor.continueRun(run.id, "worker-1");
  return { request, prisma, runtimeRun, finalizeRun, pauseRunForInput };
}

describe("Chat runs need AI consent for the model they use", () => {
  it("pauses on the consent card without calling the model when consent is missing", async () => {
    const { runtimeRun, pauseRunForInput } = await runChat(false);
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(pauseRunForInput).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [expect.objectContaining({ kind: "ask", consent: expect.any(Object) })],
      }),
    );
  });

  it("ends the run when the owner chose Not now", async () => {
    const { runtimeRun, pauseRunForInput, finalizeRun } = await runChat(false, "denied");
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(pauseRunForInput).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
  });

  it("runs the model once consent is on file", async () => {
    const { runtimeRun, pauseRunForInput } = await runChat(true);
    expect(runtimeRun).toHaveBeenCalled();
    expect(pauseRunForInput).not.toHaveBeenCalled();
  });

  it("leaves background runs to their own checks", async () => {
    const { runtimeRun } = await runChat(false, null, "routine");
    expect(runtimeRun).toHaveBeenCalled();
  });

  it("pauses a follow-up message without consent", async () => {
    const { runtimeRun, pauseRunForInput } = await runChat(false, null, "follow_up");
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(pauseRunForInput).toHaveBeenCalled();
  });

  it("does not offer a backup model the user has not allowed", async () => {
    const { request } = await runChat(["openai/gpt-6-luna"]);
    expect(request?.fallbackModels ?? []).toEqual([]);
  });

  it("keeps an allowed backup model", async () => {
    const { request } = await runChat(["openai/gpt-6-luna", "openai/gpt-4o"]);
    expect(request?.fallbackModels).toEqual([{ provider: "openrouter", id: "openai/gpt-4o" }]);
  });

  it("refuses a subagent model the user has not allowed", async () => {
    const { request } = await runChat(["openai/gpt-6-luna"]);
    await expect(request?.resolveModel?.("openrouter", "openai/gpt-4o")).rejects.toThrow(/Allow/);
  });

  const delegated = (ownerOrigin: boolean) => [
    {
      kind: "bot_message_received",
      fromBotId: "bot-2",
      fromName: "Ana",
      text: "Summarize my contracts",
      intent: "request",
      hop: 1,
      ownerOrigin,
    },
  ];

  it("does not send an owner's delegated chat to a model the user has not allowed", async () => {
    const { runtimeRun, finalizeRun } = await runChat(false, null, "bot_message", delegated(true));
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed" }));
  });

  it("runs a delegated chat once the user allowed the model", async () => {
    const { runtimeRun } = await runChat(true, null, "bot_message", delegated(true));
    expect(runtimeRun).toHaveBeenCalled();
  });

  it("leaves a delegation that did not start from the owner's chat alone", async () => {
    const { runtimeRun } = await runChat(false, null, "bot_message", delegated(false));
    expect(runtimeRun).toHaveBeenCalled();
  });

  it.each(["user", "follow_up"])(
    "asks on a card before a %s message is delegated to an unallowed model",
    async (trigger) => {
      const { pauseRunForInput } = await runChat(["openai/gpt-6-luna"], null, trigger, null, true);
      expect(pauseRunForInput).toHaveBeenCalledWith(
        expect.objectContaining({
          blocks: [expect.objectContaining({ kind: "ask", consent: expect.any(Object) })],
        }),
      );
    },
  );
});
