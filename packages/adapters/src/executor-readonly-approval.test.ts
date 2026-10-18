import type {
  AdapterContext,
  AgentRunRequest,
  AutoReviewProvider,
  ConnectorCall,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import { MEMORY_REVISION_CONFLICT_ERROR } from "@rakazo/adapter-kit";
import {
  cartaAgentSpawnKey,
  inboxAgentSpawnKey,
  integrationAgentSpawnKey,
} from "@rakazo/contracts";
import type { ActionApprovalRule } from "@rakazo/core";
import { approvalEffectKey, toolEffectIdempotencyKey } from "@rakazo/core/node/approval-effect-key";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isApprovalPausedResult } from "./approval-effect.js";
import { MAX_SHARED_MEMORY_CHARS } from "./builtin-tools.js";
import { ConnectorRegistry } from "./composio-connector.js";
import { ComposioEmulator } from "./composio-emulator.js";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { DestinationEmulator } from "./destination-emulator.js";
import { createRunExecutor, MAIL_CONSENT_OFF } from "./executor.js";
import { fakeMercury, fakeMercuryMcpFetch } from "./finance-fake-tools.js";
import type * as InboxTriageModule from "./inbox-triage.js";
import { catalogEntries, DIRECT_TOOL_LIMIT, resolveCatalogCall } from "./lazy-tool-catalog.js";
import { McpConnector } from "./mcp-connector.js";
import { PipedreamConnector } from "./pipedream-connector.js";
import { ThirdPartyConnectorEmulator } from "./third-party-connector-emulator.js";

vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  provisionComputer: async () => ({ id: "computer-1", kind: "desktop" }),
}));

/** What the Inbox's consent check reports; by default mail may be read. */
const triage = vi.hoisted(() => ({ needsConsent: false }));
vi.mock("./inbox-triage.js", async (importOriginal) => ({
  ...(await importOriginal<typeof InboxTriageModule>()),
  triageStatus: async () =>
    triage.needsConsent
      ? { ready: null, blocked: { reason: "needs_consent", recipient: { key: "k", name: "M" } } }
      : { ready: {}, blocked: null },
}));

const reviewMock = vi.fn();
const autoReviewProvider: AutoReviewProvider = {
  describe: () => ({
    id: "mock",
    contractVersion: "1",
    adapterVersion: "0.1.0",
    capabilities: { offline: true, keyless: true },
  }),
  review: reviewMock,
};

type Effect = {
  id: string;
  kind: string;
  idempotencyKey: string;
  status: string;
  request: unknown;
  result?: unknown;
  reviewDecision?: string;
  runId?: string;
};

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown> = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (expected && typeof expected === "object" && "in" in expected) {
      return (expected as { in: unknown[] }).in.includes(row[key]);
    }
    return row[key] === expected;
  });
}

function fixture({
  name = "demo_get_item",
  catalog = false,
  readOnly = true,
  rules = [] as ActionApprovalRule[],
  autoReview = false,
  trigger = "user",
  secrets = [] as string[],
  prompt = "Read the item",
  bot = {
    name: "Assistant",
    title: "Assistant",
    description: "Test assistant",
  },
  shutdownSignal,
  builtin = false,
  disabledBuiltinTools = [],
  existingSharedMemory,
  advanceRevisionAfterRead = false,
  spawnKey = null,
  mail,
  afterCall,
  beforeToolCall,
  route,
  connector: realConnector,
  peer,
  connectionRows = [],
  availableTools,
}: {
  /** A bot_message run started by bot `peer-1`: whether that bot is in the run's space and user, and whether the bot is its server's agent. */
  peer?: { senderInScope: boolean; linked: boolean };
  connectionRows?: Record<string, unknown>[];
  availableTools?: ConnectorTool[];
  beforeToolCall?: (index: number) => void;
  /** Replaces the stub connector, for runs against a real McpConnector. */
  connector?: unknown;
  route?: ConnectorTool["route"];
  spawnKey?: string | null;
  mail?: unknown;
  afterCall?: (index: number) => void;
  builtin?: boolean;
  disabledBuiltinTools?: string[];
  existingSharedMemory?: string;
  /** Simulates another writer landing between the save's read and its commit. */
  advanceRevisionAfterRead?: boolean;
  name?: string;
  catalog?: boolean;
  readOnly?: boolean;
  rules?: ActionApprovalRule[];
  autoReview?: boolean;
  trigger?: string;
  secrets?: string[];
  prompt?: string;
  bot?: { name: string; title: string; description: string };
  shutdownSignal?: AbortSignal;
} = {}) {
  const tool: ConnectorTool = {
    name,
    description: "Read an item",
    readOnly,
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    route: route ?? { connectorId: "demo", resourceId: "resource-1", toolName: name },
  };
  const effects: Effect[] = [];
  const results: unknown[] = [];
  const sharedMemoryState = {
    content: existingSharedMemory as string | undefined,
    revision: existingSharedMemory === undefined ? 0 : 1,
  };
  const commit = vi.fn(
    async (request: { path: string; content: string; expectedRevision?: number }) => {
      if (
        request.expectedRevision !== undefined &&
        request.expectedRevision !== sharedMemoryState.revision
      ) {
        throw new Error(MEMORY_REVISION_CONFLICT_ERROR);
      }
      sharedMemoryState.content = request.content;
      sharedMemoryState.revision = (sharedMemoryState.revision || 0) + 1;
      return {
        id: "doc-1",
        path: request.path,
        revision: sharedMemoryState.revision,
        content: request.content,
      };
    },
  );
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
    ...(peer ? { sourceMessageId: "msg-1" } : {}),
  };
  const externalEffect = {
    findMany: vi.fn(
      async ({
        where,
      }: {
        where?: { id?: string; runId?: string; status?: string; kind?: string };
      } = {}) =>
        effects.filter((effect) => {
          if (where?.status && effect.status !== where.status) return false;
          if (where?.kind && effect.kind !== where.kind) return false;
          if (where?.runId && effect.runId && effect.runId !== where.runId) return false;
          if (where?.id && effect.id !== where.id) return false;
          return true;
        }),
    ),
    findUnique: vi.fn(
      async ({ where }: { where: { id?: string; idempotencyKey?: string } }) =>
        effects.find((effect) =>
          where.id ? effect.id === where.id : effect.idempotencyKey === where.idempotencyKey,
        ) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Omit<Effect, "id"> }) => {
      const effect = { ...data, id: `effect-${effects.length + 1}` };
      effects.push(effect);
      return { ...effect };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Effect> }) => {
      Object.assign(effects.find((effect) => effect.id === where.id)!, data);
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: { id: string; status: string }; data: Partial<Effect> }) => {
        const effect = effects.find(
          (effect) => effect.id === where.id && effect.status === where.status,
        );
        if (!effect) return { count: 0 };
        Object.assign(effect, data);
        return { count: 1 };
      },
    ),
  };
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
        userId: run.userId,
        spaceId: run.spaceId,
        spawnKey,
        name: bot.name,
        title: bot.title,
        description: bot.description,
        disabledBuiltinTools,
        computerId: "computer-1",
        computer: { id: "computer-1", scope: "dedicated" },
      })),
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => (peer?.senderInScope ? { id: "peer-1" } : null)),
    },
    mcpServer: { findFirst: vi.fn(async () => (peer?.linked ? { id: "server-1" } : null)) },
    attempt: {
      create: vi.fn(async () => ({ id: "attempt-1" })),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    thread: { findUniqueOrThrow: vi.fn(async () => ({ id: run.threadId, groupId: null })) },
    message: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => null),
      findUnique: vi.fn(async () => ({
        blocks: [
          {
            kind: "bot_message_received",
            fromBotId: "peer-1",
            fromBotName: "Peer",
            text: "Pay the invoice",
            hop: 1,
            intent: "request",
            returnToMessageId: "m0",
          },
        ],
        replyTo: null,
      })),
    },
    task: { findUniqueOrThrow: vi.fn(async () => ({ id: run.taskId, prompt })) },
    connection: {
      findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
        connectionRows.filter((row) => matchesWhere(row, where)),
      ),
      findFirst: vi.fn(
        async ({ where }: { where?: Record<string, unknown> } = {}) =>
          connectionRows.find((row) => matchesWhere(row, where)) ?? null,
      ),
    },
    spaceModelPreference: { findFirst: vi.fn(async () => null) },
    userModelCredential: { findFirst: vi.fn(async () => null) },
    deploymentSettings: {
      findUnique: vi.fn(async () => ({
        defaultModelProvider: "scripted",
        defaultModelId: "scripted",
      })),
    },
    taughtSkill: { findMany: vi.fn(async () => []) },
    agentSecret: { findMany: vi.fn(async () => []) },
    botSecret: { findMany: vi.fn(async () => []) },
    agentSkill: { findMany: vi.fn(async () => []) },
    scratchpadItem: { findMany: vi.fn(async () => []) },
    actionApprovalRule: { findMany: vi.fn(async () => rules) },
    actionAutoReviewPreference: { findUnique: vi.fn(async () => ({ enabled: autoReview })) },
    externalEffect,
  };
  const pauseRunForInput = vi.fn(async () => {
    run.status = "waiting_input";
    return true;
  });
  const finalizeRun = vi.fn(async () => ({ continuationRunId: null }));
  const execute = vi.fn(async function* (call: ConnectorCall) {
    yield { type: "result" as const, data: { item: call.args.id } };
  });
  let calls: { args: Record<string, unknown>; executionId: string }[] = [
    { args: { id: "item-1" }, executionId: "call-1" },
  ];
  const offeredTools: string[] = [];
  const runtimeRun = vi.fn(async function* (request: AgentRunRequest) {
    offeredTools.push(...(request.tools ?? []).map((t) => t.name));
    for (const [index, call] of calls.entries()) {
      beforeToolCall?.(index);
      const result = await request.executeTool!(
        catalog ? "demo_execute_tool" : name,
        catalog ? { id: name, arguments: call.args } : call.args,
        call.executionId,
      );
      results.push(result);
      afterCall?.(results.length - 1);
      if (isApprovalPausedResult(result)) return;
    }
    yield { type: "done" as const, text: "Done" };
  });
  const executor = createRunExecutor({
    prisma,
    runtime: { describe: () => ({ capabilities: { scripted: false } }), run: runtimeRun },
    connector: realConnector ?? {
      discoverTools: async () =>
        availableTools ??
        (builtin
          ? []
          : catalog
            ? [
                {
                  name: "demo_execute_tool",
                  description: "Execute a catalog tool",
                  inputSchema: { type: "object" },
                  route: {
                    connectorId: route?.connectorId ?? "demo",
                    toolName: "__catalog_execute",
                  },
                },
              ]
            : [tool]),
      resolveCall: async (call: ConnectorCall) =>
        catalog ? resolveCatalogCall(call, catalogEntries([tool])) : undefined,
      execute,
    },
    sandbox: { describe: () => ({ capabilities: { graphical: false } }) },
    memory: {
      read: async (request: { scope: string; path?: string }) => {
        const documents =
          request.scope === "user" &&
          request.path === "MEMORY.md" &&
          sharedMemoryState.content !== undefined
            ? [
                {
                  id: "doc-1",
                  path: "MEMORY.md",
                  content: sharedMemoryState.content,
                  revision: sharedMemoryState.revision,
                  updatedAt: "",
                },
              ]
            : [];
        if (advanceRevisionAfterRead && request.path === "MEMORY.md") {
          sharedMemoryState.content = "Someone else edited";
          sharedMemoryState.revision += 1;
        }
        return { documents };
      },
      commit,
    },
    memoryProviders: { resolve: async () => null },
    events: { append: vi.fn(async () => undefined), pauseRunForInput, finalizeRun },
    jobs: { enqueue: vi.fn(async () => undefined) },
    secrets,
    autoReview: autoReviewProvider,
    shutdownSignal,
    mail,
  } as unknown as Parameters<typeof createRunExecutor>[0]);
  return {
    offeredTools,
    effects,
    results,
    execute,
    commit,
    sharedMemoryState,
    pauseRunForInput,
    setCalls(next: typeof calls) {
      calls = next;
    },
    async run(options: { expectFailure?: boolean } = {}) {
      run.status = "queued";
      await executor.continueRun(run.id, "worker-1");
      expect(runtimeRun).toHaveBeenCalled();
      expect(prisma.attempt.update).not.toHaveBeenCalled();
      if (!options.expectFailure)
        expect(finalizeRun).not.toHaveBeenCalledWith(
          expect.objectContaining({ outcome: "failed" }),
        );
    },
  };
}

describe("disabled builtins", () => {
  it("refuses a direct call before any effect or memory write", async () => {
    const f = fixture({
      name: "save_shared_memory",
      builtin: true,
      disabledBuiltinTools: ["save_shared_memory", "unknown"],
    });
    f.setCalls([{ args: { content: "Must not be saved" }, executionId: "call-1" }]);
    await f.run();
    expect(f.results).toEqual([{ error: "This tool is disabled for this bot." }]);
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.effects).toEqual([]);
  });
});

describe("connector read-only metadata and approval enforcement", () => {
  beforeEach(() => {
    reviewMock.mockReset();
  });

  it.each(["shell", "write_file"])(
    "forces owner approval for webhook-triggered %s despite an allow rule",
    async (name) => {
      const f = fixture({
        name,
        trigger: "webhook",
        rules: [{ effect: "always_allow", matchKind: "tool", matchValue: name }],
      });
      await f.run();
      expect(f.pauseRunForInput).toHaveBeenCalledOnce();
      expect(isApprovalPausedResult(f.results[0])).toBe(true);
      expect(reviewMock).not.toHaveBeenCalled();
    },
  );

  it("writes shared memory directly, including when an always-allow rule exists", async () => {
    const args = { path: " MEMORY.md ", content: "Printing: all print jobs go to Clyde." };
    const f = fixture({
      name: "save_shared_memory",
      builtin: true,
      autoReview: true,
      rules: [{ effect: "always_allow", matchKind: "tool", matchValue: "save_shared_memory" }],
    });
    f.setCalls([{ args, executionId: "call-1" }]);
    await f.run();
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(reviewMock).not.toHaveBeenCalled();
    expect(f.commit).toHaveBeenCalledOnce();
    expect(f.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "user",
        path: "MEMORY.md",
        content: args.content,
        expectedRevision: 0,
      }),
      expect.objectContaining({ spaceId: "space-1", userId: "user-1" }),
    );
    expect(f.commit.mock.calls[0]![0]).not.toHaveProperty("botId");
    expect(f.results.at(-1)).toEqual({ ok: true, path: "MEMORY.md", revision: 1 });
  });

  it("replaces an existing shared document at the revision it just read", async () => {
    const f = fixture({
      name: "save_shared_memory",
      builtin: true,
      existingSharedMemory: "Old rule",
    });
    f.setCalls([{ args: { path: "MEMORY.md", content: "New rule" }, executionId: "call-1" }]);
    await f.run();
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(f.commit).toHaveBeenCalledWith(
      expect.objectContaining({ content: "New rule", expectedRevision: 1 }),
      expect.anything(),
    );
    expect(f.results.at(-1)).toEqual({ ok: true, path: "MEMORY.md", revision: 2 });
  });

  it("does not overwrite shared memory that changed after it was read", async () => {
    const f = fixture({
      name: "save_shared_memory",
      builtin: true,
      existingSharedMemory: "Old rule",
      advanceRevisionAfterRead: true,
    });
    f.setCalls([{ args: { path: "MEMORY.md", content: "New rule" }, executionId: "call-1" }]);
    await f.run();
    expect(f.commit).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRevision: 1 }),
      expect.anything(),
    );
    expect(f.sharedMemoryState.content).toBe("Someone else edited");
    expect(f.results.at(-1)).toEqual({ error: MEMORY_REVISION_CONFLICT_ERROR });
  });

  it("rejects shared memory content over the size limit", async () => {
    const args = {
      path: "MEMORY.md",
      content: "x".repeat(MAX_SHARED_MEMORY_CHARS + 1),
    };
    const f = fixture({ name: "save_shared_memory", builtin: true });
    f.setCalls([{ args, executionId: "call-1" }]);
    await f.run();
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(f.results.at(-1)).toEqual({
      error: `content exceeds ${MAX_SHARED_MEMORY_CHARS} characters`,
    });
  });

  it("rejects a shared memory save without a path", async () => {
    const f = fixture({ name: "save_shared_memory", builtin: true });
    f.setCalls([{ args: { path: "  ", content: "ok" }, executionId: "call-1" }]);
    await f.run();
    expect(f.commit).not.toHaveBeenCalled();
    expect(f.results.at(-1)).toEqual({ error: "path is required" });
  });

  describe.each([false, true])("catalog = %s", (catalog) => {
    it.each(["tool", "connector"] as const)(
      "honors an explicit %s approval rule",
      async (matchKind) => {
        const f = fixture({
          catalog,
          autoReview: true,
          rules: [
            {
              effect: "require_approval",
              matchKind,
              matchValue: matchKind === "tool" ? "demo_get_item" : "demo",
            },
          ],
        });
        await f.run();
        expect(f.execute).not.toHaveBeenCalled();
        expect(f.pauseRunForInput).toHaveBeenCalledOnce();
        expect(f.pauseRunForInput).toHaveBeenCalledWith(
          expect.objectContaining({
            blocks: [expect.objectContaining({ kind: "ask", approvalEffectId: f.effects[0]!.id })],
          }),
        );
        expect(isApprovalPausedResult(f.results[0])).toBe(true);
        expect(reviewMock).not.toHaveBeenCalled();
      },
    );

    it("replays the approved arguments once and returns the result on retry", async () => {
      const f = fixture({
        catalog,
        rules: [{ effect: "require_approval", matchKind: "tool", matchValue: "demo_get_item" }],
      });
      await f.run();
      expect(f.effects).toHaveLength(1);
      f.effects[0]!.status = "approved";
      f.setCalls([{ args: { id: "model-reconstructed" }, executionId: "call-2" }]);
      await f.run();
      expect(f.execute).toHaveBeenCalledOnce();
      expect(f.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          args: { id: "item-1" },
          executionId: approvalEffectKey("run-1", "demo_get_item", { id: "item-1" }),
        }),
        expect.anything(),
      );
      expect(f.effects).toHaveLength(1);
      expect(f.effects[0]!.status).toBe("completed");
      expect(f.results.at(-1)).toEqual({ item: "item-1" });
      expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    });

    it("executes a later identical-args call after an approved replay when approval is not required by default", async () => {
      const args = { id: "item-1" };
      const rules: ActionApprovalRule[] = [
        { effect: "require_approval", matchKind: "tool", matchValue: "demo_get_item" },
      ];
      const f = fixture({ catalog, rules });
      await f.run();
      expect(f.effects).toHaveLength(1);
      f.effects[0]!.status = "approved";
      rules[0]!.effect = "always_allow";
      f.setCalls([
        { args, executionId: "call-2" },
        { args, executionId: "call-3" },
      ]);
      await f.run();
      expect(f.execute).toHaveBeenCalledTimes(2);
      expect(f.effects).toHaveLength(2);
      expect(f.effects[0]?.idempotencyKey).toBe(approvalEffectKey("run-1", "demo_get_item", args));
      expect(f.effects[1]?.idempotencyKey).toBe(
        toolEffectIdempotencyKey("run-1", "demo_get_item", args, 1),
      );
      expect(f.results.slice(1)).toEqual([{ item: "item-1" }, { item: "item-1" }]);
      expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    });

    it("honors a persisted denial on a new tool call id", async () => {
      const f = fixture({
        catalog,
        rules: [{ effect: "require_approval", matchKind: "tool", matchValue: "demo_get_item" }],
      });
      await f.run();
      expect(f.effects).toHaveLength(1);
      f.effects[0]!.status = "denied";
      f.setCalls([{ args: { id: "item-1" }, executionId: "call-2" }]);
      await f.run();
      expect(f.execute).not.toHaveBeenCalled();
      expect(f.results.at(-1)).toEqual({
        error:
          "The user denied this action. Do not retry or rephrase it; tell the user and ask what they want instead.",
      });
      expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    });

    it("consumes the saved approval after the user chooses always allow", async () => {
      const rules: ActionApprovalRule[] = [
        { effect: "require_approval", matchKind: "tool", matchValue: "demo_get_item" },
      ];
      const f = fixture({ catalog, rules });
      await f.run();
      expect(f.effects).toHaveLength(1);
      f.effects[0]!.status = "approved";
      rules[0]!.effect = "always_allow";
      f.setCalls([{ args: { id: "model-reconstructed" }, executionId: "call-2" }]);
      await f.run();
      expect(f.execute).toHaveBeenCalledOnce();
      expect(f.results.at(-1)).toEqual({ item: "item-1" });
      expect(f.effects).toHaveLength(1);
      expect(f.effects[0]!.status).toBe("completed");
      expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    });

    it("allows ordinary reads without approval or automatic review", async () => {
      const f = fixture({ catalog, autoReview: true });
      f.setCalls([
        { args: { id: "item-1" }, executionId: "call-1" },
        { args: { id: "item-1" }, executionId: "call-2" },
      ]);
      await f.run();
      expect(f.execute).toHaveBeenCalledTimes(2);
      expect(f.results).toEqual([{ item: "item-1" }, { item: "item-1" }]);
      expect(f.pauseRunForInput).not.toHaveBeenCalled();
      expect(reviewMock).not.toHaveBeenCalled();
    });

    it("replays a non-approval connector effect when the tool-call id changes", async () => {
      const f = fixture({ catalog });
      f.setCalls([{ args: { id: "item-1" }, executionId: "call-1" }]);
      await f.run();
      expect(f.execute).toHaveBeenCalledOnce();
      expect(f.effects[0]?.idempotencyKey).toBe(
        toolEffectIdempotencyKey("run-1", "demo_get_item", { id: "item-1" }),
      );

      f.setCalls([{ args: { id: "item-1" }, executionId: "call-new" }]);
      await f.run();
      expect(f.execute).toHaveBeenCalledOnce();
      expect(f.effects).toHaveLength(1);
      expect(f.results.at(-1)).toEqual({ item: "item-1" });
    });

    it("keeps an explicit allow rule ahead of automatic review", async () => {
      const f = fixture({
        catalog,
        name: "demo_send_message",
        autoReview: true,
        rules: [{ effect: "always_allow", matchKind: "tool", matchValue: "demo_send_message" }],
      });
      await f.run();
      expect(f.execute).toHaveBeenCalledOnce();
      expect(f.pauseRunForInput).not.toHaveBeenCalled();
      expect(reviewMock).not.toHaveBeenCalled();
    });

    it("forces owner approval for webhook-triggered writes despite an allow rule", async () => {
      const f = fixture({
        catalog,
        name: "demo_send_message",
        trigger: "webhook",
        rules: [{ effect: "always_allow", matchKind: "tool", matchValue: "demo_send_message" }],
      });
      await f.run();
      expect(f.execute).not.toHaveBeenCalled();
      expect(f.pauseRunForInput).toHaveBeenCalledOnce();
      expect(isApprovalPausedResult(f.results[0])).toBe(true);
      expect(reviewMock).not.toHaveBeenCalled();
    });

    it("forces owner approval for a webhook-triggered read-named write operation", async () => {
      const f = fixture({
        catalog,
        name: "demo_read_profile_card",
        readOnly: false,
        trigger: "webhook",
        rules: [
          { effect: "always_allow", matchKind: "tool", matchValue: "demo_read_profile_card" },
        ],
      });
      await f.run();
      expect(f.execute).not.toHaveBeenCalled();
      expect(f.pauseRunForInput).toHaveBeenCalledOnce();
      expect(isApprovalPausedResult(f.results[0])).toBe(true);
    });

    it("lets a webhook-triggered declared read run unattended", async () => {
      const f = fixture({ catalog, trigger: "webhook" });
      await f.run();
      expect(f.execute).toHaveBeenCalledOnce();
      expect(f.pauseRunForInput).not.toHaveBeenCalled();
    });

    it("treats a read-named write operation as consequential for automatic review", async () => {
      reviewMock.mockResolvedValue({ decision: "ask", reason: "Writes data", model: "mock" });
      const f = fixture({
        catalog,
        name: "demo_find_validator_record",
        readOnly: false,
        autoReview: true,
      });
      await f.run();
      expect(reviewMock).toHaveBeenCalledOnce();
      expect(f.execute).not.toHaveBeenCalled();
      expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    });

    it.each(["ask", "error", "pass"] as const)(
      "honors automatic review %s despite a read-only hint",
      async (decision) => {
        reviewMock.mockResolvedValue({
          decision,
          reason: "Review result",
          model: "scripted/checker",
        });
        const f = fixture({ catalog, name: "demo_send_message", autoReview: true });
        await f.run();
        expect(reviewMock).toHaveBeenCalledOnce();
        expect(reviewMock).toHaveBeenCalledWith(
          expect.objectContaining({ toolName: "demo_send_message", connectorKind: "demo" }),
          expect.objectContaining({ runId: "run-1" }),
        );
        expect(f.effects[0]?.reviewDecision).toBe(decision);
        expect(f.execute).toHaveBeenCalledTimes(decision === "pass" ? 1 : 0);
        expect(f.pauseRunForInput).toHaveBeenCalledTimes(decision === "pass" ? 0 : 1);
      },
    );

    it("redacts run secrets from automatic review task and bot context", async () => {
      reviewMock.mockResolvedValue({ decision: "pass", model: "mock" });
      const f = fixture({
        catalog,
        name: "demo_send_message",
        autoReview: true,
        secrets: ["super-secret-token"],
        prompt: "Send mail with super-secret-token",
        bot: {
          name: "Mail",
          title: "Helper",
          description: "Uses super-secret-token",
        },
      });
      await f.run();
      expect(reviewMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userTask: "Send mail with [redacted]",
          botDescription: "Mail: Helper\nUses [redacted]",
        }),
        expect.objectContaining({ runId: "run-1" }),
      );
    });

    it("does not persist a review decision when the run is cancelled", async () => {
      const shutdown = new AbortController();
      reviewMock.mockImplementation(async () => {
        shutdown.abort();
        return { decision: "error", reason: "Checker timed out or failed.", model: "mock" };
      });
      const f = fixture({
        catalog,
        name: "demo_send_message",
        autoReview: true,
        shutdownSignal: shutdown.signal,
      });
      await f.run();
      expect(f.effects[0]?.reviewDecision).toBeUndefined();
      expect(f.execute).not.toHaveBeenCalled();
      expect(f.pauseRunForInput).not.toHaveBeenCalled();
    });
  });
});

describe("mail_send for the Carta agent", () => {
  beforeEach(() => {
    reviewMock.mockReset();
  });
  const send = {
    to: ["investor@example.test"],
    bcc: ["hidden@example.test"],
    subject: "Update",
    body: "Hello",
  };
  const rules: ActionApprovalRule[] = [
    { effect: "always_allow", matchKind: "tool", matchValue: "mail_send" },
  ];
  const mailFixture = (spawnKey: string | null, args: Record<string, unknown>) => {
    const mail = {
      listAccounts: vi.fn(async () => [{ id: "acct-1", address: "me@example.test" }]),
    };
    const f = fixture({
      name: "mail_send",
      builtin: true,
      autoReview: true,
      rules,
      spawnKey,
      mail,
    });
    f.setCalls([{ args, executionId: "call-1" }]);
    return f;
  };

  it("asks despite an always-allow rule and Auto Review", async () => {
    const f = mailFixture(cartaAgentSpawnKey("user-1"), send);
    await f.run();
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(isApprovalPausedResult(f.results[0])).toBe(true);
    expect(reviewMock).not.toHaveBeenCalled();
  });

  it("is allowed by the same rule for an ordinary bot", async () => {
    const f = mailFixture(null, send);
    await f.run();
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(isApprovalPausedResult(f.results[0])).toBe(false);
  });

  it("refuses a draft-id-only send before any approval or effect", async () => {
    const f = mailFixture(cartaAgentSpawnKey("user-1"), { draftId: "d1" });
    await f.run();
    expect(f.results[0]).toEqual({ error: expect.stringContaining("full message") });
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(f.effects).toEqual([]);
  });
});

describe("Inbox agent mail without AI data sharing consent", () => {
  const mailFixture = () => {
    const f = fixture({
      name: "mail_search",
      builtin: true,
      spawnKey: inboxAgentSpawnKey("user-1"),
      mail: { listAccounts: vi.fn(async () => [{ id: "acct-1", address: "me@example.test" }]) },
    });
    f.setCalls([{ args: { queries: ["from:priya"] }, executionId: "call-1" }]);
    return f;
  };

  it("refuses to read mail once consent is withdrawn", async () => {
    triage.needsConsent = true;
    const f = mailFixture();
    await f.run();
    expect(f.results[0]).toEqual({ error: MAIL_CONSENT_OFF });
    triage.needsConsent = false;
  });

  it("reads mail while consent is given", async () => {
    const f = mailFixture();
    await f.run();
    expect(f.results[0]).not.toEqual({ error: MAIL_CONSENT_OFF });
  });

  it("settles a claimed send as failed instead of leaving it executing", async () => {
    triage.needsConsent = true;
    try {
      const f = fixture({
        name: "mail_send",
        builtin: true,
        spawnKey: inboxAgentSpawnKey("user-1"),
        rules: [{ effect: "always_allow", matchKind: "tool", matchValue: "mail_send" }],
        mail: { listAccounts: vi.fn(async () => [{ id: "acct-1", address: "me@example.test" }]) },
      });
      f.setCalls([
        {
          args: { to: ["sam@example.test"], subject: "Hi", body: "Hello" },
          executionId: "call-1",
        },
      ]);
      await f.run();
      expect(isApprovalPausedResult(f.results[0])).toBe(true);
      // The user approves the card; consent is withdrawn before the resumed call runs.
      f.effects[0]!.status = "approved";
      await f.run();
      expect(f.results[1]).toEqual({ error: MAIL_CONSENT_OFF });
      expect(f.effects[0]?.status).toBe("completed");
    } finally {
      triage.needsConsent = false;
    }
  });

  it("stops reading mail when consent is withdrawn during the run", async () => {
    // The first call runs with consent; consent is revoked before the second call of the same run.
    try {
      const f = fixture({
        name: "mail_search",
        builtin: true,
        spawnKey: inboxAgentSpawnKey("user-1"),
        mail: { listAccounts: vi.fn(async () => [{ id: "acct-1", address: "me@example.test" }]) },
        afterCall: (index) => {
          if (index === 0) triage.needsConsent = true;
        },
      });
      f.setCalls([
        { args: { queries: ["from:priya"] }, executionId: "call-1" },
        { args: { queries: ["from:sam"] }, executionId: "call-2" },
      ]);
      await f.run();
      expect(f.results[0]).not.toEqual({ error: MAIL_CONSENT_OFF });
      expect(f.results[1]).toEqual({ error: MAIL_CONSENT_OFF });
    } finally {
      triage.needsConsent = false;
    }
  });
});

describe("Carta write tools", () => {
  beforeEach(() => {
    reviewMock.mockReset();
  });
  // The executor sees MCP tools by their namespaced name; the raw name lives on the route.
  const mutate = (spawnKey: string | null, endpoint = "https://mcp.app.carta.com/mcp") =>
    fixture({
      name: "mcp__integration-5f783c95__mutate",
      // A misleading read-only annotation must not override Carta's forced-write preset.
      readOnly: true,
      autoReview: true,
      rules: [
        {
          effect: "always_allow",
          matchKind: "tool",
          matchValue: "mcp__integration-5f783c95__mutate",
        },
      ],
      spawnKey,
      route: {
        connectorId: "mcp",
        resourceId: "server-1",
        toolName: "mutate",
        endpoint,
      },
    });

  it("asks for the Carta agent despite an always-allow rule and Auto Review", async () => {
    const f = mutate(cartaAgentSpawnKey("user-1"));
    await f.run();
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(isApprovalPausedResult(f.results[0])).toBe(true);
    expect(reviewMock).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("does not gate another server's mutate for the Carta agent", async () => {
    const f = mutate(cartaAgentSpawnKey("user-1"), "https://mcp.example.test/mcp");
    await f.run();
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
  });

  it("follows the saved rule for an ordinary bot's tool of the same name", async () => {
    const f = mutate(null);
    await f.run();
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(f.execute).toHaveBeenCalledOnce();
  });
});

describe("integration agent write tools", () => {
  beforeEach(() => {
    reviewMock.mockReset();
  });
  const tool = (spawnKey: string | null, readOnly: boolean) =>
    fixture({
      name: "mcp__demo__requestSendMoney",
      readOnly,
      autoReview: true,
      rules: [
        { effect: "always_allow", matchKind: "tool", matchValue: "mcp__demo__requestSendMoney" },
      ],
      spawnKey,
      route: { connectorId: "mcp", resourceId: "server-1", toolName: "requestSendMoney" },
    });

  it("asks despite an always-allow rule and Auto Review, and the card has no rule option", async () => {
    const f = tool(integrationAgentSpawnKey("server-1"), false);
    await f.run();
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(isApprovalPausedResult(f.results[0])).toBe(true);
    expect(reviewMock).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
    const [{ blocks }] = f.pauseRunForInput.mock.calls[0] as unknown as [{ blocks: unknown[] }];
    const card = blocks[0] as { detail: string; actions: Array<{ id: string }> };
    expect(card.actions.map((a) => a.id)).toEqual(["allow", "deny"]);
    expect(card.detail).toContain("requestSendMoney");
  });

  it("does not ask for a read", async () => {
    const f = tool(integrationAgentSpawnKey("server-1"), true);
    await f.run();
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(f.execute).toHaveBeenCalledOnce();
  });
});

describe("connected app integration agent tools", () => {
  const connection = (extra: Record<string, unknown> = {}) => ({
    id: "connection-1",
    spaceId: "space-1",
    userId: "user-1",
    connectorId: "composio",
    provider: "GMAIL",
    providerRef: "account-1",
    displayName: "Work Gmail",
    status: "connected",
    allAgents: true,
    botAccess: [],
    agentBotId: "bot-1",
    writesEnabled: true,
    ...extra,
  });
  const agentKey = integrationAgentSpawnKey("connection-1");
  const ownTool: ConnectorTool = {
    name: "GMAIL_SEND_EMAIL",
    description: "Send mail",
    inputSchema: { type: "object", properties: { recipient_email: { type: "string" } } },
    readOnly: false,
    route: { connectorId: "composio", toolName: "GMAIL_SEND_EMAIL" },
  };
  const ownReadTool: ConnectorTool = {
    name: "GMAIL_FETCH_EMAILS",
    description: "Fetch mail",
    inputSchema: { type: "object", properties: {} },
    readOnly: true,
    route: { connectorId: "composio", toolName: "GMAIL_FETCH_EMAILS" },
  };

  beforeEach(() => {
    reviewMock.mockReset();
  });

  it("offers only its linked app account, excludes MCP and other apps, and asks before writes", async () => {
    const sibling = connection({
      id: "connection-2",
      allAgents: false,
      agentBotId: null,
      botAccess: [],
    });
    const f = fixture({
      name: ownTool.name,
      spawnKey: agentKey,
      autoReview: true,
      rules: [{ effect: "always_allow", matchKind: "tool", matchValue: ownTool.name }],
      route: ownTool.route,
      connectionRows: [connection({ allAgents: false, botAccess: [{ botId: "bot-1" }] }), sibling],
      availableTools: [
        ownTool,
        {
          ...ownTool,
          name: "SLACK_POST_MESSAGE",
          route: { connectorId: "pipedream", toolName: "SLACK_POST_MESSAGE" },
        },
        {
          ...ownTool,
          name: "mcp__other__write",
          route: { connectorId: "mcp", resourceId: "other-server", toolName: "write" },
        },
      ],
    });
    const callArgs = {
      recipient_email: "person@example.test",
      subject: "Project update",
      body: "The complete message body.",
      options: { include_signature: false },
    };
    f.setCalls([{ args: callArgs, executionId: "write-1" }]);
    await f.run();

    expect(f.offeredTools).toContain(ownTool.name);
    expect(f.offeredTools).not.toContain("SLACK_POST_MESSAGE");
    expect(f.offeredTools).not.toContain("mcp__other__write");
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(reviewMock).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
    const [{ blocks }] = f.pauseRunForInput.mock.calls[0] as unknown as [{ blocks: unknown[] }];
    const card = blocks[0] as { detail: string; actions: Array<{ id: string }> };
    expect(card.detail).toContain('"recipient_email": "person@example.test"');
    expect(card.detail).toContain('"The complete message body."');
    expect(card.detail).toContain('"include_signature": false');
    expect(card.actions.map((action) => action.id)).toEqual(["allow", "deny"]);
    f.effects[0]!.status = "approved";
    await f.run();
    expect(f.execute).toHaveBeenCalledOnce();
    expect(f.execute.mock.calls[0]?.[0]).toMatchObject({
      route: { connectorId: "composio", connectionId: "connection-1" },
    });
  });

  it("does not expose an account that is not linked to this agent", async () => {
    const f = fixture({
      name: ownTool.name,
      spawnKey: agentKey,
      route: ownTool.route,
      connectionRows: [connection({ agentBotId: "another-bot" })],
      availableTools: [ownTool],
    });
    await f.run();
    expect(f.offeredTools).not.toContain(ownTool.name);
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("does not expose a foreign user's or space's account", async () => {
    const f = fixture({
      name: ownTool.name,
      spawnKey: agentKey,
      route: ownTool.route,
      connectionRows: [
        connection({ userId: "other-user", spaceId: "other-space", agentBotId: "bot-1" }),
      ],
      availableTools: [ownTool],
    });
    await f.run();
    expect(f.offeredTools).not.toContain(ownTool.name);
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("lets a same-owner peer use the target agent's app tools but not a foreign peer", async () => {
    const sameOwnerRead = fixture({
      name: ownReadTool.name,
      trigger: "bot_message",
      peer: { senderInScope: true, linked: true },
      spawnKey: agentKey,
      route: ownReadTool.route,
      connectionRows: [connection()],
      availableTools: [ownReadTool],
    });
    await sameOwnerRead.run();
    expect(sameOwnerRead.offeredTools).toContain(ownReadTool.name);
    expect(sameOwnerRead.execute).toHaveBeenCalledOnce();

    const sameOwner = fixture({
      name: ownTool.name,
      trigger: "bot_message",
      peer: { senderInScope: true, linked: true },
      spawnKey: agentKey,
      route: ownTool.route,
      connectionRows: [connection()],
      availableTools: [ownTool],
    });
    await sameOwner.run();
    expect(sameOwner.offeredTools).toContain(ownTool.name);
    expect(sameOwner.pauseRunForInput).toHaveBeenCalledOnce();
    sameOwner.effects[0]!.status = "approved";
    await sameOwner.run();
    expect(sameOwner.execute).toHaveBeenCalledOnce();

    const foreign = fixture({
      name: ownTool.name,
      trigger: "bot_message",
      peer: { senderInScope: false, linked: true },
      spawnKey: agentKey,
      route: ownTool.route,
      connectionRows: [connection()],
      availableTools: [ownTool],
    });
    await foreign.run();
    expect(foreign.offeredTools).not.toContain(ownTool.name);
    expect(foreign.execute).not.toHaveBeenCalled();
  });

  it("hides writes when the connection switch is off", async () => {
    const f = fixture({
      name: ownTool.name,
      spawnKey: agentKey,
      route: ownTool.route,
      connectionRows: [connection({ writesEnabled: false })],
      availableTools: [ownTool],
    });
    await f.run();
    expect(f.offeredTools).not.toContain(ownTool.name);
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
  });

  it("executes pinned Pipedream reads above the catalog limit with writes off", async () => {
    const reads = Array.from({ length: DIRECT_TOOL_LIMIT + 1 }, (_, index) => ({
      name: `read_item_${index}`,
      description: "Read a synthetic item",
      inputSchema: { type: "object", properties: { id: { type: "string" } } },
      annotations: { readOnlyHint: true },
    }));
    const call = vi.fn(() => ({ item: "synthetic item" }));
    const tools = [
      ...reads,
      { ...reads[0]!, name: "write_item", annotations: { readOnlyHint: false } },
      { name: "unknown_item", description: "Unknown action", inputSchema: { type: "object" } },
    ];
    const emulator = new ThirdPartyConnectorEmulator({
      "remote.mcp.pipedream.net": {
        tools,
        call,
      },
    });
    const accountIds: Array<string | null> = [];
    const connector = new PipedreamConnector(
      {
        clientId: "fake-client-id",
        clientSecret: "fake-client-secret",
        projectId: "fake-project-id",
        environment: "development",
        identitySecret: "fake-identity-secret",
      },
      {
        resolveHostname: emulator.resolveHostname,
        fetch: async (input, init) => {
          if (String(init?.body).includes('"method":"tools/call"')) {
            accountIds.push(new Headers(init?.headers).get("x-pd-account-id"));
          }
          return emulator.fetch(input, init);
        },
      },
    );
    const f = fixture({
      name: reads[0]!.name,
      spawnKey: agentKey,
      connectionRows: [
        connection({ connectorId: "pipedream", provider: "gmail", writesEnabled: false }),
      ],
      connector: new ConnectorRegistry(new DestinationEmulator(), [connector]),
    });

    await f.run();

    expect(f.offeredTools).toEqual(expect.arrayContaining(reads.map((tool) => tool.name)));
    expect(f.offeredTools).not.toContain("write_item");
    expect(f.offeredTools).not.toContain("unknown_item");
    expect(f.offeredTools).not.toContain("pipedream_execute_tool");
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(call).toHaveBeenCalledExactlyOnceWith(reads[0]!.name, { id: "item-1" });
    expect(accountIds).toEqual(["account-1"]);
  });

  it("hides linked-account writes from ordinary bots but leaves no-agent behavior unchanged", async () => {
    const write = { ...ownTool, name: "GMAIL_SEND_EMAIL", route: ownTool.route };
    const read: ConnectorTool = {
      ...ownTool,
      name: "GMAIL_FETCH_EMAILS",
      readOnly: true,
      route: { connectorId: "composio", toolName: "GMAIL_FETCH_EMAILS" },
    };
    const linked = fixture({
      name: write.name,
      spawnKey: null,
      connectionRows: [connection({ allAgents: true, writesEnabled: true })],
      availableTools: [read, write],
    });
    await linked.run();
    expect(linked.offeredTools).toContain(read.name);
    expect(linked.offeredTools).not.toContain(write.name);

    const ordinary = fixture({
      name: write.name,
      spawnKey: null,
      connectionRows: [connection({ agentBotId: null, writesEnabled: false })],
      availableTools: [read, write],
    });
    await ordinary.run();
    expect(ordinary.offeredTools).toContain(write.name);
    expect(ordinary.execute).toHaveBeenCalledOnce();
  });

  it("blocks an ordinary bot write if the account becomes agent-linked after discovery", async () => {
    const ordinary = connection({ agentBotId: null });
    const f = fixture({
      name: ownTool.name,
      spawnKey: null,
      connectionRows: [ordinary],
      availableTools: [ownTool],
      beforeToolCall: () => {
        ordinary.agentBotId = "another-agent";
      },
    });

    await f.run();

    expect(f.offeredTools).toContain(ownTool.name);
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("blocks an ordinary bot read if the account becomes exclusive after discovery", async () => {
    const ordinary = connection({
      agentBotId: null,
      allAgents: true,
      botAccess: [],
    });
    const f = fixture({
      name: ownReadTool.name,
      spawnKey: null,
      route: ownReadTool.route,
      connectionRows: [ordinary],
      availableTools: [ownReadTool],
      beforeToolCall: () => {
        ordinary.allAgents = false;
      },
    });

    await f.run();

    expect(f.offeredTools).toContain(ownReadTool.name);
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("rechecks durable write state after approval and discovery before dispatch", async () => {
    const linked = connection();
    let discoveries = 0;
    const execute = vi.fn(async function* (call: ConnectorCall) {
      yield { type: "result" as const, data: { ok: true, args: call.args } };
    });
    const connector = {
      discoverTools: async () => {
        discoveries += 1;
        if (discoveries === 2) linked.writesEnabled = false;
        return [ownTool];
      },
      execute,
    };
    const f = fixture({
      name: ownTool.name,
      spawnKey: agentKey,
      route: ownTool.route,
      connectionRows: [linked],
      connector,
    });
    await f.run();
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    f.effects[0]!.status = "approved";
    await f.run({ expectFailure: true });
    expect(execute).not.toHaveBeenCalled();
    expect(f.results.at(-1)).toMatchObject({ error: expect.stringContaining("Changes are off") });
  });

  it.each([
    ["link", { agentBotId: "another-bot" }],
    ["connected status", { status: "revoked" }],
    ["access", { allAgents: false, botAccess: [] }],
  ])("rechecks the app connection %s before dispatch", async (_label, change) => {
    const linked = connection();
    let discoveries = 0;
    const execute = vi.fn(async function* () {
      yield { type: "result" as const, data: { ok: true } };
    });
    const connector = {
      discoverTools: async () => {
        discoveries += 1;
        if (discoveries === 2) Object.assign(linked, change);
        return [ownTool];
      },
      execute,
    };
    const f = fixture({
      name: ownTool.name,
      spawnKey: agentKey,
      route: ownTool.route,
      connectionRows: [linked],
      connector,
    });
    await f.run();
    f.effects[0]!.status = "approved";
    await f.run({ expectFailure: true });
    expect(execute).not.toHaveBeenCalled();
  });
});

class TrackingComposioEmulator extends ComposioEmulator {
  readonly executionContexts: AdapterContext[] = [];

  override async *execute(call: ConnectorCall, context: AdapterContext) {
    this.executionContexts.push(context);
    yield* super.execute(call, context);
  }
}

describe("connected app writes through the Composio emulator", () => {
  const connection = (extra: Record<string, unknown> = {}) => ({
    id: "connection-1",
    spaceId: "space-1",
    userId: "user-1",
    connectorId: "composio",
    provider: "GMAIL",
    providerRef: "account-1",
    displayName: "Work Gmail",
    status: "connected",
    allAgents: true,
    botAccess: [],
    agentBotId: "bot-1",
    writesEnabled: true,
    ...extra,
  });

  beforeEach(() => {
    reviewMock.mockReset();
  });

  it("does not execute an emulator write after denial", async () => {
    const emulator = new TrackingComposioEmulator();
    const f = fixture({
      name: "GMAIL_SEND_EMAIL",
      spawnKey: integrationAgentSpawnKey("connection-1"),
      connectionRows: [connection()],
      connector: new ConnectorRegistry(new DestinationEmulator(), [emulator]),
    });

    await f.run();
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(emulator.executions).toEqual([]);
    expect(reviewMock).not.toHaveBeenCalled();
    f.effects[0]!.status = "denied";
    await f.run();
    expect(emulator.executions).toEqual([]);
  });

  it("executes approved writes once, asks again, and rejects a write disabled after approval", async () => {
    const linked = connection();
    const emulator = new TrackingComposioEmulator();
    const firstArgs = {
      recipient_email: "person@example.test",
      subject: "Project update",
      body: "The complete message body.",
      cc: ["copy@example.test"],
      is_html: false,
    };
    const secondArgs = { ...firstArgs, subject: "Second update" };
    let disableBeforeCall = false;
    const f = fixture({
      name: "GMAIL_SEND_EMAIL",
      spawnKey: integrationAgentSpawnKey("connection-1"),
      autoReview: true,
      rules: [{ effect: "always_allow", matchKind: "tool", matchValue: "GMAIL_SEND_EMAIL" }],
      connectionRows: [
        linked,
        connection({
          id: "connection-2",
          providerRef: "account-2",
          displayName: "Personal Gmail",
          agentBotId: null,
        }),
      ],
      connector: new ConnectorRegistry(new DestinationEmulator(), [emulator]),
      beforeToolCall: () => {
        if (disableBeforeCall) linked.writesEnabled = false;
      },
    });
    f.setCalls([{ args: firstArgs, executionId: "send-1" }]);
    await f.run();
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(emulator.executions).toEqual([]);
    expect(f.offeredTools).toContain("save_shared_memory");

    f.effects[0]!.status = "approved";
    await f.run();
    expect(emulator.executions).toHaveLength(1);
    expect(emulator.executions[0]).toEqual({
      userId: "user-1",
      tool: "GMAIL_SEND_EMAIL",
      args: firstArgs,
    });
    expect(reviewMock).not.toHaveBeenCalled();

    f.setCalls([{ args: secondArgs, executionId: "send-2" }]);
    await f.run();
    expect(f.pauseRunForInput).toHaveBeenCalledTimes(2);
    expect(emulator.executions).toHaveLength(1);
    expect(reviewMock).not.toHaveBeenCalled();

    f.effects[1]!.status = "approved";
    disableBeforeCall = true;
    await f.run({ expectFailure: true });
    expect(emulator.executions).toHaveLength(1);
    expect(f.results.at(-1)).toMatchObject({
      error: expect.stringContaining("Changes are off"),
    });
    expect(reviewMock).not.toHaveBeenCalled();
    expect(emulator.executionContexts[0]?.connectedAppAgentConnectionId).toBe("connection-1");
    expect(emulator.executionContexts[0]?.connectedConnections).toEqual([
      expect.objectContaining({
        id: "connection-1",
        connectorId: "composio",
        externalId: "GMAIL",
        providerRef: "account-1",
      }),
    ]);
  });
});

/**
 * Real executor (scripted model, in-memory stores) over a real McpConnector, talking to the emulated
 * Mercury MCP server through fetch. Not exercised: Postgres, the model runtime, the MCP network.
 */
describe("Mercury agent writes, offline end to end", () => {
  const endpoint = "https://mcp.mercury.com/mcp";
  const serverId = "server-1";
  const server = {
    id: serverId,
    slug: "demo",
    name: "Mercury",
    transport: "streamable_http",
    endpoint,
    secretId: null,
    args: [],
    revision: 1,
    spaceId: "space-1",
    userId: "user-1",
    writesEnabled: true,
    agentBotId: "bot-1",
    agentExclusive: false,
  };
  const assignmentFor = (botId: string, spawnKey: string | null) => ({
    botId,
    serverId,
    spaceId: "space-1",
    userId: "user-1",
    allowAllTools: true,
    allowedTools: [],
    bot: { id: botId, spawnKey, spaceId: "space-1", userId: "user-1", archivedAt: null },
    server,
  });
  const mercuryConnector = (botId: string, spawnKey: string | null) => {
    const assignment = assignmentFor(botId, spawnKey);
    return new McpConnector(
      {
        botMcpServer: {
          findMany: async () => [assignment],
          findFirst: async () => assignment,
        },
      } as never,
      {} as never,
      {
        network: {
          fetch: (input: string | URL | Request, init?: RequestInit) =>
            fakeMercuryMcpFetch(mercury)(input, init),
          resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
        },
      },
    );
  };
  const agentKey = integrationAgentSpawnKey(serverId);
  const sendArgs = { amount: 12.5, recipientId: "rcp-1", note: "Test" };
  let mercury = fakeMercury({ txns: {} });
  beforeEach(() => {
    mercury = fakeMercury({ txns: {} });
    server.writesEnabled = true;
    server.agentExclusive = false;
    reviewMock.mockReset();
  });
  const agentRun = (connector: McpConnector) => {
    const f = fixture({
      name: "mcp__demo__requestSendMoney",
      readOnly: false,
      autoReview: true,
      rules: [
        { effect: "always_allow", matchKind: "tool", matchValue: "mcp__demo__requestSendMoney" },
      ],
      spawnKey: agentKey,
      connector,
    });
    f.setCalls([{ args: sendArgs, executionId: "call-1" }]);
    return f;
  };

  it("asks first, and a denial sends nothing", async () => {
    const f = agentRun(mercuryConnector("bot-1", agentKey));
    await f.run();
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(mercury.sendMoneyRequests).toHaveLength(0);
    f.effects[0]!.status = "denied";
    await f.run();
    expect(f.results.at(-1)).toMatchObject({ error: expect.stringContaining("denied") });
    expect(mercury.sendMoneyRequests).toHaveLength(0);
  });

  it("sends exactly one request once the user approves", async () => {
    const f = agentRun(mercuryConnector("bot-1", agentKey));
    await f.run();
    expect(mercury.sendMoneyRequests).toHaveLength(0);
    f.effects[0]!.status = "approved";
    await f.run();
    expect(mercury.sendMoneyRequests).toEqual([sendArgs]);
  });

  it("refuses even an approved call when changes are switched off before it runs", async () => {
    const connector = mercuryConnector("bot-1", agentKey);
    const discover = connector.discoverTools.bind(connector);
    // The tool list is read at the start of each run. The user approves in the first run, then
    // the switch flips after the second run read its list and before the approved call.
    let listings = 0;
    connector.discoverTools = async (context) => {
      const tools = await discover(context);
      if (++listings === 2) server.writesEnabled = false;
      return tools;
    };
    const f = agentRun(connector);
    await f.run();
    f.effects[0]!.status = "approved";
    // The refused approved call is never replayed, so the run itself ends failed.
    await f.run({ expectFailure: true });
    expect(f.results.at(-1)).toMatchObject({ error: expect.stringContaining("Changes are off") });
    expect(mercury.sendMoneyRequests).toHaveLength(0);
  });

  it("does not offer the write tool when changes are off from the start", async () => {
    server.writesEnabled = false;
    const f = agentRun(mercuryConnector("bot-1", agentKey));
    await f.run();
    expect(f.offeredTools).not.toContain("mcp__demo__requestSendMoney");
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(mercury.sendMoneyRequests).toHaveLength(0);
  });

  it("hides the write tool from another bot when shared, and every tool when exclusive", async () => {
    const context = { spaceId: "space-1", userId: "user-1", botId: "bot-2" } as never;
    const other = mercuryConnector("bot-2", null);
    const shared = (await other.discoverTools(context)).map((t) => t.name);
    expect(shared).toContain("mcp__demo__getAccounts");
    expect(shared).not.toContain("mcp__demo__requestSendMoney");
    server.agentExclusive = true;
    expect(await other.discoverTools(context)).toEqual([]);
    await other.close();
  });
});

describe("tools offered to a peer-started run", () => {
  const mailRun = (trigger: string) => {
    const mail = {
      listAccounts: vi.fn(async () => [{ id: "acct-1", address: "me@example.test" }]),
    };
    return fixture({ trigger, mail });
  };

  it("gives a user run mail, schedules and connector tools", async () => {
    const f = mailRun("user");
    await f.run();
    expect(f.offeredTools).toEqual(
      expect.arrayContaining(["mail_search", "schedule_create", "demo_get_item"]),
    );
  });

  it("gives a bot_message run no mail, schedule creation or connector tools", async () => {
    const f = mailRun("bot_message");
    await f.run();
    expect(f.offeredTools).not.toContain("mail_search");
    expect(f.offeredTools).not.toContain("schedule_create");
    expect(f.offeredTools).not.toContain("demo_get_item");
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.results[0]).toEqual({ error: expect.stringContaining("unknown tool") });
  });
});

describe("integration agent asked by another bot", () => {
  const peerRun = (
    peer: { senderInScope: boolean; linked: boolean },
    spawnKey: string | null,
    catalog = false,
  ) =>
    fixture({
      catalog,
      name: "mcp__demo__requestSendMoney",
      readOnly: false,
      trigger: "bot_message",
      spawnKey,
      peer,
      route: { connectorId: "mcp", resourceId: "server-1", toolName: "requestSendMoney" },
    });
  const agentKey = integrationAgentSpawnKey("server-1");

  it("offers its server's tools to a bot of the same space and user, and still asks before a write", async () => {
    const f = peerRun({ senderInScope: true, linked: true }, agentKey);
    await f.run();
    expect(f.offeredTools).toContain("mcp__demo__requestSendMoney");
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("resolves a catalog wrapper to the agent's own tool and still asks before a write", async () => {
    const f = peerRun({ senderInScope: true, linked: true }, agentKey, true);
    await f.run();
    expect(f.offeredTools).toContain("demo_execute_tool");
    expect(f.pauseRunForInput).toHaveBeenCalledOnce();
    expect(f.execute).not.toHaveBeenCalled();
    // Once the user approves, the resolved tool reaches the connector.
    f.effects[0]!.status = "approved";
    await f.run();
    expect(f.execute).toHaveBeenCalledOnce();
  });

  it("gives a peer from another space or user nothing", async () => {
    const f = peerRun({ senderInScope: false, linked: true }, agentKey);
    await f.run();
    expect(f.offeredTools).not.toContain("mcp__demo__requestSendMoney");
    expect(f.results[0]).toEqual({ error: expect.stringContaining("unknown tool") });
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("gives nothing when the agent is no longer linked to the server", async () => {
    const f = peerRun({ senderInScope: true, linked: false }, agentKey);
    await f.run();
    expect(f.offeredTools).not.toContain("mcp__demo__requestSendMoney");
    expect(f.execute).not.toHaveBeenCalled();
  });

  it("changes nothing for an ordinary bot", async () => {
    const f = peerRun({ senderInScope: true, linked: true }, null);
    await f.run();
    expect(f.offeredTools).not.toContain("mcp__demo__requestSendMoney");
    expect(f.execute).not.toHaveBeenCalled();
  });
});
