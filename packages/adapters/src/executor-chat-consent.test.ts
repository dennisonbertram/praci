import type { AgentRunRequest } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION, PINNED_CONNECTION_LOST_MESSAGE } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";

const RUN_SECRET = "sk-test-FAKE-0123456789abcdef";

const allowedKey = (modelId: string) =>
  aiRecipient({ provider: "openrouter", modelId, use: "model" })?.key;

const notifications = vi.hoisted(() => ({
  notifyThreadEvent: vi.fn(async (..._args: unknown[]) => "created" as const),
  writeThreadNotification: vi.fn(async () => ({ status: "created" as const, publish: null })),
}));

vi.mock("./run-notification.js", () => notifications);

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
  pinned: "ok" | "gone" | "no-secret" | null = null,
  stoppedRuns: Array<Record<string, unknown>> = [],
  toolCall: { name: string; args: Record<string, unknown> } = {
    name: "message_bot",
    args: { bot_id: "bot-2", message: "hi" },
  },
  runExtra: Record<string, unknown> = {},
  botNotify = true,
  // The meeting-text check asks for its own read; tests that need a clear answer set it here.
  meetingTaint: "error" | "clear" = "error",
) {
  notifications.notifyThreadEvent.mockClear();
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
    createdAt: new Date("2026-11-05T12:00:00Z"),
    ...runExtra,
  };
  const get = vi.fn(async () => new Uint8Array([1, 2, 3, 4]));
  let request: AgentRunRequest | undefined;
  const runtimeRun = vi.fn(async function* (next: AgentRunRequest) {
    request = next;
    if (delegate) {
      await next.executeTool?.(toolCall.name, toolCall.args, "call-1");
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
      findFirst: vi.fn(async () => ({
        bot: { notifyOnFinish: botNotify },
        thread: { groupId: null },
      })),
      findUniqueOrThrow: vi.fn(async () => run),
      findMany: vi.fn(async () => stoppedRuns),
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
        modelProvider: pinned ? "openrouter" : null,
        modelId: pinned ? "openai/gpt-6-luna" : null,
        modelCredentialId: pinned ? "cred-1" : null,
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
      findUnique: vi.fn(async () => {
        if (meetingTaint === "error") throw new Error("no thread read in this test");
        return { meetingTaintedAt: null };
      }),
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
    task: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: run.taskId,
        prompt: "Look again",
      })),
    },
    computer: { updateMany: vi.fn(async () => ({ count: 1 })) },
    connection: { findMany: vi.fn(async () => []) },
    spaceModelPreference: {
      findFirst: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown> | null>>(
        async () => null,
      ),
    },
    // A pinned connection's key is on file unless the run is meant to lose it.
    secret: {
      findFirst: vi.fn(async () =>
        pinned === "ok" ? { id: "secret-1", ciphertext: "cipher-1", userId: "user-1" } : null,
      ),
    },
    userModelCredential: {
      findFirst: vi.fn(async (args?: { where?: { id?: string } }) =>
        args?.where?.id && pinned === "gone"
          ? null
          : {
              id: "cred-1",
              userId: "user-1",
              provider: "openrouter",
              label: "OpenRouter",
              secretId: "secret-1",
              createdAt: new Date(0),
            },
      ),
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
    actionApprovalRule: { findMany: vi.fn(async () => []) },
    externalEffect: {
      update: vi.fn(async () => ({})),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () =>
        effectStatus
          ? {
              id: "effect-1",
              runId: "run-1",
              spaceId: "space-1",
              status: effectStatus,
            }
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
        {
          id: "art-1",
          storageKey: "shot.png",
          size: 4,
          mimeType: "image/png",
          name: "shot.png",
        },
      ]),
    },
  };
  const finalizeRun = vi.fn(async () => ({ continuationRunId: null }));
  const pauseRunForInput = vi.fn(async () => true);
  const executor = createRunExecutor({
    prisma,
    deploymentModelKey: "fake-deployment-key",
    runtime: {
      describe: () => ({ capabilities: { scripted } }),
      run: runtimeRun,
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
    artifacts: { get },
    events: {
      append: vi.fn(async () => undefined),
      finalizeRun,
      pauseRunForInput,
    },
    jobs: { enqueue: vi.fn(async () => undefined) },
    secrets: [RUN_SECRET],
    secretStore: { load: vi.fn(async () => "sk-test-key-12345678") },
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

  it("notifies the owner when a run pauses for chat consent", async () => {
    await runChat(false, null, "user", null, false, null, [], undefined, {}, true, "clear");
    expect(notifications.notifyThreadEvent).toHaveBeenCalledTimes(1);
    const message = notifications.notifyThreadEvent.mock.calls[0]?.[3] as {
      kind: string;
      title: string;
      body: string;
    };
    expect(message.kind).toBe("help");
    expect(message.title.endsWith(" needs approval")).toBe(true);
    expect(message.body).toBe("");
  });

  it("does not notify a consent pause for a muted agent", async () => {
    await runChat(false, null, "user", null, false, null, [], undefined, {}, false, "clear");
    expect(notifications.notifyThreadEvent).not.toHaveBeenCalled();
  });

  it("ends the run when the owner chose Not now", async () => {
    const { runtimeRun, pauseRunForInput, finalizeRun } = await runChat(false, "denied");
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(pauseRunForInput).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        error: expect.stringContaining("Send a message to be asked again"),
      }),
    );
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Chat is off until you allow AI models"),
      }),
    );
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

  it("never offers a backup model to a run pinned to a connection", async () => {
    const { request, runtimeRun } = await runChat(
      ["openai/gpt-6-luna", "openai/gpt-4o"],
      null,
      "user",
      null,
      false,
      "ok",
    );
    expect(runtimeRun).toHaveBeenCalled();
    expect(request?.fallbackModels ?? []).toEqual([]);
  });

  it("fails a run whose pinned connection is gone instead of using another", async () => {
    const { runtimeRun, finalizeRun } = await runChat(true, null, "user", null, false, "gone");
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        error: PINNED_CONNECTION_LOST_MESSAGE,
      }),
    );
  });

  it("fails a pinned run whose secret vanished instead of using the deployment key", async () => {
    const { runtimeRun, finalizeRun } = await runChat(true, null, "user", null, false, "no-secret");
    expect(runtimeRun).not.toHaveBeenCalled();
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        error: PINNED_CONNECTION_LOST_MESSAGE,
      }),
    );
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
    expect(finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "failed",
        error: expect.stringContaining("in Settings under Privacy and approvals"),
      }),
    );
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
          blocks: [
            expect.objectContaining({
              kind: "ask",
              consent: expect.any(Object),
            }),
          ],
        }),
      );
    },
  );
});

describe("Continuing after Stop", () => {
  const stopped = (extra: Record<string, unknown> = {}, tool = "web_search") => ({
    status: "cancelled",
    externalTaint: false,
    readOutsideContent: false,
    readDesktop: false,
    goalEvidence: [
      { id: "t1", tool, args: '{"q":"acme"}', ok: true, result: "Acme Ltd, founded 2019" },
    ],
    ...extra,
  });
  const noteOf = (request?: AgentRunRequest) =>
    request?.history.find((item) => item.content.includes("<finished_work>"));
  const markersWritten = (prisma: { run: { updateMany: { mock: { calls: unknown[][] } } } }) =>
    prisma.run.updateMany.mock.calls
      .map(([arg]) => (arg as { data: Record<string, unknown> }).data)
      .filter((data) => "readOutsideContent" in data || "readDesktop" in data);

  it("shows the next turn what the stopped run finished, as data", async () => {
    const { request } = await runChat(true, null, "user", null, false, null, [stopped()]);
    const note = noteOf(request);
    expect(note?.role).toBe("user");
    expect(note?.content).toContain("Acme Ltd, founded 2019");
    expect(note?.content).toMatch(/not instructions/);
    expect(note?.content).toMatch(/Do not redo/);
  });

  it("adds nothing when the earlier run finished no calls", async () => {
    const { request } = await runChat(true, null, "user", null, false, null, [
      stopped({ goalEvidence: null }),
    ]);
    expect(noteOf(request)).toBeUndefined();
  });

  it("leaves the note out when the stopped run was restricted at run level", async () => {
    const { request } = await runChat(true, null, "user", null, false, null, [
      stopped({ externalTaint: true }),
    ]);
    expect(noteOf(request)).toBeUndefined();
  });

  it("leaves the note out when this run itself began with outside content", async () => {
    const { request, prisma } = await runChat(
      true,
      null,
      "user",
      null,
      false,
      null,
      [stopped()],
      undefined,
      {
        externalTaint: true,
      },
    );
    expect(noteOf(request)).toBeUndefined();
    expect(prisma.run.findMany).not.toHaveBeenCalled();
  });

  it("starts the continuing run as restricted as the stopped one ended, and records it", async () => {
    const { prisma } = await runChat(true, null, "user", null, false, null, [
      stopped({ readOutsideContent: true, readDesktop: true }),
    ]);
    expect(markersWritten(prisma)).toEqual(
      expect.arrayContaining([{ readOutsideContent: true }, { readDesktop: true }]),
    );
  });

  it("does not mark a run whose stopped predecessor read nothing from outside", async () => {
    const { prisma } = await runChat(true, null, "user", null, false, null, [stopped()]);
    expect(markersWritten(prisma)).toEqual([]);
  });

  it("writes each finished call to the run as it completes, with secrets removed", async () => {
    const { prisma } = await runChat(true, null, "user", null, true, null, [], {
      name: "recall_memory",
      args: { query: `acme, token ${RUN_SECRET}` },
    });
    const written = prisma.run.updateMany.mock.calls
      .map(([arg]) => (arg as { data: { goalEvidence?: unknown[] } }).data.goalEvidence)
      .filter(Boolean);
    expect(JSON.stringify(written.at(-1))).toContain("recall_memory");
    expect(JSON.stringify(written.at(-1))).toContain("[redacted]");
    expect(JSON.stringify(written)).not.toContain(RUN_SECRET);
  });

  it("marks the run the moment a tool that can bring in outside content returns", async () => {
    const { prisma } = await runChat(true, null, "user", null, true, null, [], {
      name: "read_file",
      args: { path: "x" },
    });
    expect(markersWritten(prisma)).toEqual([{ readOutsideContent: true }]);
  });
});
