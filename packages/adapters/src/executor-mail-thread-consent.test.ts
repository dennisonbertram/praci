import type { AgentRunRequest } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";

vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  provisionComputer: async () => ({ id: "computer-1", kind: "desktop" }),
}));

function historyMessages() {
  const message = (id: string, seq: number, role: string, blocks: unknown[]) => ({
    id,
    threadId: "thread-1",
    seq,
    role,
    runId: role === "user" ? "run-1" : null,
    blocks,
    replyToMessageId: null,
    replyQuote: null,
    replyTo: null,
  });
  return [
    message("current", 2, "user", [{ kind: "text", text: "what do they want?" }]),
    message("context", 1, "system", [
      {
        kind: "mail_thread",
        subject: "Q3 vendor invoice",
        messages: [
          {
            from: "Sample Vendor <billing@vendor.example>",
            to: "you@example.test",
            date: "2026-10-01T09:00:00.000Z",
            text: "Please pay invoice 0000 by Friday.",
            attachments: ["invoice-q3.pdf"],
          },
        ],
      },
    ]),
  ];
}

async function runChat(consented: boolean) {
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
    trigger: "user",
    leaseFence: 0,
  };
  const get = vi.fn(async () => new Uint8Array([1, 2, 3, 4]));
  let request: AgentRunRequest | undefined;
  const runtimeRun = vi.fn(async function* (next: AgentRunRequest) {
    request = next;
    yield { type: "done" as const, text: "Done" };
  });
  const prisma = {
    user: { findUnique: vi.fn(async () => ({ timezone: null })) },
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
        name: "Q3 vendor invoice",
        userId: "user-1",
        spawnKey: "mail-thread:conn-1:thread-1",
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
        defaultModelId: "openai/gpt-4o",
      })),
    },
    aiDataConsent: {
      findUnique: vi.fn(async () => ({ version: AI_DISCLOSURE_VERSION })),
      findFirst: vi.fn(async () => (consented ? { userId: "user-1" } : null)),
    },
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

const threadLine = "Please pay invoice 0000 by Friday.";
const historyText = (request: AgentRunRequest | undefined) =>
  (request?.history ?? []).map((item) => item.content).join("\n");

// The Pi runtime keeps only user and assistant history, so the thread must not arrive as "system".
const threadItem = (request: AgentRunRequest | undefined) =>
  (request?.history ?? []).find((item) => item.content.includes("Q3 vendor invoice"));

describe("An Ask agent chat sends the mail thread to the model only after mail consent", () => {
  it("gives the model the thread on the first run when the owner has allowed mail for its model", async () => {
    const { request, runtimeRun } = await runChat(true);
    expect(runtimeRun).toHaveBeenCalled();
    const text = historyText(request);
    expect(text).toContain(threadLine);
    expect(text).toContain("invoice-q3.pdf");
    expect(text).toContain("untrusted data");
    expect(threadItem(request)?.role).toBe("user");
  });

  it("holds the thread back, with a placeholder, when consent is missing", async () => {
    const { request, runtimeRun } = await runChat(false);
    expect(runtimeRun).toHaveBeenCalled();
    const text = historyText(request);
    expect(text).not.toContain(threadLine);
    expect(text).not.toContain("invoice-q3.pdf");
    expect(text).toContain('[email thread: "Q3 vendor invoice", 1 message.');
    expect(threadItem(request)?.role).toBe("user");
  });
});
