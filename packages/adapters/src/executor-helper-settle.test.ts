import type { AdapterContext } from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type * as BotMessagesModule from "./bot-messages.js";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";

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

const savedEvents: { type: string; payload: unknown }[] = [];

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

async function continueRun(events: unknown[], fail = false, trigger = "user") {
  const storedPhase = null;
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
    yield* events as never[];
    if (fail) throw new Error("fixture runtime failure");
    yield { type: "text" as const, text: "Hi" };
    yield { type: "done" as const, text: "Hi" };
  });
  const prisma: Record<string, unknown> = {
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
      update: vi.fn(async () => ({ nextMessageSeq: 3, nextEventSeq: savedEvents.length + 1 })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: run.threadId,
        groupId: null,
        historyCompactionSummary: null,
        historyCompactedUpToSeq: null,
        nextMessageSeq: 3,
      })),
    },
    message: {
      create: vi.fn(async ({ data }: { data: object }) => ({ ...data, id: "message-1", seq: 3 })),
      findMany: vi.fn(async (args: { where?: { threadId?: string } }) =>
        args.where?.threadId ? history : [],
      ),
      findUnique: vi.fn(async () => null),
    },
    event: {
      create: vi.fn(async ({ data }: { data: { type: string; payload: unknown } }) => {
        savedEvents.push(data);
        return { ...data, seq: savedEvents.length };
      }),
    },
    $queryRaw: vi.fn(async () => [{ id: "thread-1" }]),
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
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
  const finalizeRun = vi.fn(async (_input: unknown) => ({ continuationRunId: null }));
  const pauseRunForInput = vi.fn(async (_input: unknown) => ({ continuationRunId: null }));
  const append = vi.fn(async (_event: unknown) => undefined);
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
    events: { append, finalizeRun, pauseRunForInput, notify: vi.fn(async () => undefined) },
    jobs: { enqueue },
    secrets: [],
  } as unknown as Parameters<typeof createRunExecutor>[0]);
  await executor.continueRun("run-1", "worker-1");
  const helperSaves = savedEvents.filter(
    (event) =>
      event.type === "thread.subagent" &&
      (event.payload as { status?: string }).status === "failed",
  );
  return { run, finalizeRun, pauseRunForInput, helperSaves, prisma, append };
}

const helper = {
  type: "subagent" as const,
  agentId: "helper",
  name: "Helper",
  task: "Check",
  status: "running" as const,
};

describe("helper settlement", () => {
  it("persists a stopped helper before the run finishes", async () => {
    savedEvents.length = 0;
    const { finalizeRun, helperSaves } = await continueRun([helper]);
    expect(finalizeRun).toHaveBeenCalledOnce();
    expect(helperSaves).toHaveLength(1);
    expect(helperSaves[0]?.payload).toMatchObject({
      agentId: "helper",
      status: "failed",
      result: "stopped",
    });
  });

  it("persists a stopped helper before the run pauses to ask", async () => {
    savedEvents.length = 0;
    const { pauseRunForInput, helperSaves } = await continueRun([
      helper,
      { type: "ask" as const, text: "Continue?" },
    ]);
    expect(pauseRunForInput).toHaveBeenCalledOnce();
    expect(helperSaves).toHaveLength(1);
  });

  it("persists a stopped helper when the run fails", async () => {
    savedEvents.length = 0;
    const { helperSaves } = await continueRun([helper], true);
    expect(helperSaves).toHaveLength(1);
  });
});

describe("routine progress", () => {
  const progress = [
    { type: "text" as const, text: "Checking for changes." },
    { type: "progress" as const, text: "Reading the releases", activity: true },
  ];
  const progressEvents = (append: { mock: { calls: unknown[][] } }) =>
    append.mock.calls.filter(([event]) => (event as { type?: string }).type === "thread.progress");

  it("publishes no live narration for a routine run, which may finish silently", async () => {
    savedEvents.length = 0;
    const { append } = await continueRun(progress, false, "routine");
    expect(progressEvents(append)).toEqual([]);
  });

  it("still publishes live progress for a chat run", async () => {
    savedEvents.length = 0;
    const { append } = await continueRun(progress);
    expect(progressEvents(append).length).toBeGreaterThan(0);
  });
});

describe("narration in chat", () => {
  const posted = (prisma: Record<string, unknown>) =>
    (
      prisma.message as { create: { mock: { calls: { data: Record<string, unknown> }[][] } } }
    ).create.mock.calls
      .map(([call]) => call!.data)
      .filter((data) => String(data.clientNonce ?? "").startsWith("user-progress:"))
      .map((data) => (data.blocks as { text: string }[])[0]?.text);

  it("posts one line for a group of lookups and the line for the action", async () => {
    savedEvents.length = 0;
    const tool = (name: string, executionId: string) => ({
      type: "tool" as const,
      name,
      args: {},
      executionId,
    });
    const { prisma } = await continueRun([
      { type: "text" as const, text: "Pulling your list." },
      tool("mail_search", "c1"),
      { type: "text" as const, text: "I'll pull the list now." },
      tool("search_history", "c2"),
      { type: "text" as const, text: "Getting the list together." },
      tool("mail_grep", "c3"),
      { type: "text" as const, text: "Sending the batch." },
      tool("mail_reply_batch", "c4"),
    ]);
    expect(posted(prisma)).toEqual(["Pulling your list.", "Sending the batch."]);
  });
});
