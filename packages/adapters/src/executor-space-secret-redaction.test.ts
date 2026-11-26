import type { ComputerRef } from "@rakazo/adapter-kit";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";
import { EncryptedSecretStore } from "./secrets.js";

const COMPUTER: ComputerRef = {
  id: "sandbox-1",
  botId: "home-1",
  kind: "e2b",
  providerRef: "sandbox-1",
};

vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  acquireDedicatedScreenLeaseFence: async () => null,
  provisionComputer: async () => COMPUTER,
}));

const SPACE_SECRET = "fake-space-value";
const secretStore = new EncryptedSecretStore("test-only-encryption-key");

type ExecuteTool = (
  name: string,
  args: Record<string, unknown>,
  executionId: string,
) => Promise<unknown>;

/** A run with a space secret whose tools print the secret's base64 form. */
async function runWithSpaceSecret(
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>,
) {
  const run = {
    id: "run-2",
    botId: "bot-1",
    threadId: "thread-1",
    taskId: "task-1",
    spaceId: "space-1",
    userId: "user-1",
    status: "queued",
    trigger: "routine",
    routineId: "routine-1",
    retryOfRunId: null,
    leaseFence: 0,
  };
  const scope = { userId: run.userId, spaceId: run.spaceId, botId: run.botId };
  const agentSecretRows = [
    {
      name: "FAKE_TOKEN",
      secret: await secretStore.put(
        SPACE_SECRET,
        { ...scope, operationId: "test", traceId: "test", signal: new AbortController().signal },
        { recordId: "space-1-secret" },
      ),
    },
  ];
  const botSecrets: unknown[] = [];
  const printed = `base64=${Buffer.from(SPACE_SECRET).toString("base64")}`;
  const toolResults: unknown[] = [];
  const runtimeRun = vi.fn(async function* (request: { executeTool?: ExecuteTool }) {
    for (const [index, call] of toolCalls.entries()) {
      toolResults.push(await request.executeTool?.(call.name, call.args, `exec-${index}`));
    }
    const reply = "Done.";
    yield { type: "text-delta" as const, text: reply };
    yield { type: "done" as const, text: reply };
  });
  const prisma = {
    run: {
      findUnique: vi.fn(async () => run),
      findUniqueOrThrow: vi.fn(async () => run),
      findFirst: vi.fn(async () => ({
        bot: { notifyOnFinish: false },
        thread: { groupId: null },
      })),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(run, data);
        return { count: 1 };
      }),
    },
    routine: { findUnique: vi.fn(async () => ({ notify: false, nextRunAt: null })) },
    // The shell runs without a card at Open.
    actionAutoReviewPreference: {
      findUnique: vi.fn(async () => ({ permissionLevel: "open" })),
    },
    event: { count: vi.fn(async () => 0) },
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
        computer: { id: "computer-1", scope: "dedicated", kind: "e2b", homeKey: "home-1" },
      })),
      findMany: vi.fn(async () => []),
    },
    attempt: {
      create: vi.fn(async () => ({ id: "attempt-1" })),
      count: vi.fn(async () => 1),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    thread: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: run.threadId,
        groupId: null,
        historyCompactionSummary: null,
        historyCompactedUpToSeq: null,
        nextMessageSeq: 1,
      })),
      // The fork treats an unreadable thread mark as marked, which would ask before every tool.
      findUnique: vi.fn(async () => ({ meetingTaintedAt: null })),
    },
    message: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    task: { findUniqueOrThrow: vi.fn(async () => ({ id: run.taskId, prompt: "Check the site" })) },
    computer: { updateMany: vi.fn(async () => ({ count: 1 })) },
    deploymentSettings: {
      findUnique: vi.fn(async () => ({
        defaultModelProvider: "openrouter",
        // Sees images, so computer_observe is offered.
        defaultModelId: "openai/gpt-4o",
      })),
    },
    agentSecret: { findMany: vi.fn(async () => agentSecretRows) },
    botSecret: { findMany: vi.fn(async () => botSecrets) },
    externalEffect: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `effect-${data.idempotencyKey}`,
        ...data,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const sandbox = {
    describe: () => ({ id: "e2b", capabilities: { graphical: true } }),
    execute: vi.fn(async function* () {
      yield { type: "stdout" as const, data: printed };
      yield { type: "exit" as const, code: 0 };
    }),
    readFile: vi.fn(async () => new TextEncoder().encode(printed)),
    releaseScreen: vi.fn(async () => undefined),
    async *exportWorkspace() {
      yield* [];
    },
  };
  const events = {
    append: vi.fn(async () => undefined),
    finalizeRun: vi.fn(async () => ({ continuationRunId: null })),
    pauseRunForTakeover: vi.fn(async () => false),
  };
  const executor = createRunExecutor({
    prisma: withEmptyModels(prisma),
    deploymentModelKey: "fake-deployment-key",
    runtime: { describe: () => ({ capabilities: { scripted: false } }), run: runtimeRun },
    sandbox,
    secretStore,
    home: { commit: vi.fn(async () => "fixture-revision") },
    memory: { read: async () => ({ documents: [] }) },
    memoryProviders: { resolve: async () => null },
    artifacts: { get: vi.fn() },
    events,
    jobs: { enqueue: vi.fn(async () => undefined) },
    notifications: { send: vi.fn(async () => undefined) },
    secrets: [],
  } as unknown as Parameters<typeof createRunExecutor>[0]);

  await executor.continueRun(run.id, "worker-1");
  const published = JSON.stringify([events.append.mock.calls, events.finalizeRun.mock.calls]);
  return { toolResults, published };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("space secrets in a run", () => {
  it("hides the base64 form of a space secret from shell and file output", async () => {
    const { toolResults } = await runWithSpaceSecret([
      { name: "shell", args: { command: "print-token" } },
      { name: "read_file", args: { path: "page.txt" } },
    ]);
    expect(toolResults).toHaveLength(2);
    const text = JSON.stringify(toolResults);
    expect(text).toContain("[redacted]");
    expect(text).not.toContain(Buffer.from(SPACE_SECRET).toString("base64"));
    expect(text).not.toContain(SPACE_SECRET);
  });
});

/** Models the run reads but these tests do not care about behave as empty tables. */
function withEmptyModels<T extends object>(prisma: T): T {
  const empty = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    count: async () => 0,
    updateMany: async () => ({ count: 0 }),
  };
  return new Proxy(prisma, {
    get: (target, key) => (key in target ? target[key as keyof T] : empty),
  });
}
