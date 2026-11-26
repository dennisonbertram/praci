import type { AgentRunRequest, ConnectorTool } from "@rakazo/adapter-kit";
import {
  AI_DISCLOSURE_VERSION,
  BREX_CARDS_MCP_ENDPOINT,
  integrationAgentSpawnKey,
} from "@rakazo/contracts";
import { approvalEffectKey } from "@rakazo/core/node/approval-effect-key";
import { describe, expect, it, vi } from "vitest";
import { boundDirectApprovalRequest } from "./approval-effect.js";
import type * as ComputerLifecycleModule from "./computer-lifecycle.js";
import { createRunExecutor } from "./executor.js";
import type * as GroupHandoffModule from "./group-handoff.js";

vi.mock("./computer-lifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof ComputerLifecycleModule>()),
  acquireComputerExecutionLease: async () => null,
  provisionComputer: async () => ({ id: "computer-1", kind: "fake" }),
}));

vi.mock("./group-handoff.js", async (importOriginal) => ({
  ...(await importOriginal<typeof GroupHandoffModule>()),
  loadGroupContext: async () => undefined,
}));

const WRITE = "create_vendor_card";
const TOOL_NAME = `mcp__brex-cards__${WRITE}`;
const CARD = {
  cardName: "Notion",
  ownerUserId: "u_ada",
  ownerName: "Ada Example",
  amountCents: 25_000,
  duration: "MONTHLY",
};
const SERVER_ID = "server-1";

type Approved = { id: string; tool?: string; args?: Record<string, unknown> };
type ToolCall = { tool: string; args: Record<string, unknown> };
type FixtureOptions = {
  /** The MCP server's endpoint: the Brex sentinel or, to show nothing else changed, another one. */
  endpoint?: string;
  /** A saved Always-allow rule for the write, and Auto Review on with a reviewer that passes it. */
  allowEverything?: boolean;
  /** Brex write tools the server offers. Defaults to the vendor-card write the original gate covered. */
  tools?: string[];
  /** Effects the user already approved on a card, replayed in order. */
  approved?: Approved[];
  /** Effects the user already denied; a matching call resolves to the denial without a new card. */
  denied?: Approved[];
  /** Calls the model makes, in order. Plain objects are args for the default write. */
  calls?: Array<Record<string, unknown>>;
  /** Calls the model makes, in order, each naming its offered tool. */
  toolCalls?: ToolCall[];
};

function fixture(options: FixtureOptions = {}) {
  const endpoint = options.endpoint ?? BREX_CARDS_MCP_ENDPOINT;
  const run = {
    id: "run-1",
    botId: "bot-1",
    threadId: "thread-1",
    taskId: "task-1",
    spaceId: "space-1",
    userId: "user-1",
    status: "queued",
    trigger: "user",
    routineId: null,
    leaseFence: 0,
  };
  const task = { id: run.taskId, prompt: "Create a Notion card." };
  const spawnKey = integrationAgentSpawnKey(SERVER_ID);
  const agentBot = {
    id: run.botId,
    spaceId: run.spaceId,
    userId: run.userId,
    spawnKey,
    archivedAt: null,
  };
  const serverRows = [
    {
      id: SERVER_ID,
      spaceId: run.spaceId,
      userId: run.userId,
      agentBotId: run.botId,
      endpoint,
      enabled: true,
      agentExclusive: true,
      writesEnabled: true,
      secretId: null,
      agentBot,
    },
  ];
  const routeFor = (toolName: string) => ({
    connectorId: "mcp",
    resourceId: SERVER_ID,
    resourceRevision: 1,
    toolName,
    endpoint,
  });
  const toolNameFor = (write: string) => `mcp__brex-cards__${write}`;
  const writes = options.tools ?? [WRITE];
  const tools: ConnectorTool[] = writes.map((write) => ({
    name: toolNameFor(write),
    description: `Brex ${write} write.`,
    inputSchema: { type: "object", properties: {} },
    readOnly: false,
    route: { ...routeFor(write), discoveredReadOnly: false },
  }));
  const effectRow = (
    { id, tool = WRITE, args = CARD }: Approved,
    index: number,
    status: "approved" | "denied",
    suffix: string,
  ) => {
    const kind = toolNameFor(tool);
    const effectArgs = args;
    return {
      id,
      spaceId: run.spaceId,
      runId: run.id,
      kind,
      idempotencyKey:
        approvalEffectKey(run.id, kind, effectArgs) +
        (status === "approved" ? `:${suffix}-${index}` : `:${suffix}`),
      status,
      request: boundDirectApprovalRequest(routeFor(tool), effectArgs, "__rakazoCatalogTool"),
      createdAt: new Date(Date.UTC(2030, 0, 1, 0, 0, index)),
    };
  };
  const externalEffects: Record<string, unknown>[] = [
    ...(options.approved ?? []).map((approved, index) =>
      effectRow(approved, index, "approved", "approved"),
    ),
    ...(options.denied ?? []).map((denied, index) =>
      effectRow(denied, index + (options.approved?.length ?? 0), "denied", "denied"),
    ),
  ];
  const externalEffect = {
    findMany: vi.fn(async ({ where }: { where?: { status?: string } } = {}) =>
      externalEffects.filter((effect) => !where?.status || effect.status === where.status),
    ),
    findUnique: vi.fn(
      async ({ where }: { where: { id?: string; idempotencyKey?: string } }) =>
        externalEffects.find((effect) =>
          where.id ? effect.id === where.id : effect.idempotencyKey === where.idempotencyKey,
        ) ?? null,
    ),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const effect = { ...data, id: `effect-new-${externalEffects.length + 1}` };
      externalEffects.push(effect);
      return effect;
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) => {
        const effect = externalEffects.find(
          (candidate) => candidate.id === where.id && candidate.status === where.status,
        );
        if (!effect) return { count: 0 };
        Object.assign(effect, data);
        return { count: 1 };
      },
    ),
  };

  const execute = vi.fn(async function* (_call: unknown) {
    yield { type: "result" as const, data: { content: [{ type: "text", text: "{}" }] } };
  });
  const discoverTools = vi.fn(async () => tools);
  const pauseRunForInput = vi.fn(async (_input: unknown) => true);
  const results: unknown[] = [];
  let request: AgentRunRequest | undefined;

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
      findFirst: vi.fn(async () => agentBot),
      findUnique: vi.fn(async () => ({
        ...agentBot,
        audience: "private",
        thread: { id: run.threadId },
      })),
      findUniqueOrThrow: vi.fn(async () => ({
        ...agentBot,
        name: "Brex agent",
        title: "Assistant",
        description: "Test assistant",
        modelProvider: null,
        modelId: null,
        thinkingLevel: null,
        computerId: "computer-1",
        computerSwitching: false,
        memoryScope: null,
        computer: { id: "computer-1", scope: "dedicated", state: "running" },
        audience: "private",
      })),
      findMany: vi.fn(async () => []),
    },
    attempt: {
      create: vi.fn(async () => ({ id: "attempt-1" })),
      update: vi.fn(async () => undefined),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    thread: {
      findUnique: vi.fn(async () => ({ meetingTaintedAt: null })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: run.threadId,
        groupId: null,
        historyCompactionSummary: null,
        historyCompactedUpToSeq: null,
        nextMessageSeq: 3,
      })),
    },
    message: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null) },
    task: { findUniqueOrThrow: vi.fn(async () => task) },
    computer: { updateMany: vi.fn(async () => ({ count: 1 })) },
    connection: { findMany: vi.fn(async () => []) },
    actionApprovalRule: {
      findMany: vi.fn(async () =>
        options.allowEverything
          ? [{ effect: "allow", matchKind: "tool", matchValue: TOOL_NAME, botId: null }]
          : [],
      ),
    },
    actionAutoReviewPreference: {
      findUnique: vi.fn(async () => ({ enabled: options.allowEverything === true })),
    },
    mcpServer: {
      findMany: vi.fn(async ({ where = {} }: { where?: Record<string, unknown> } = {}) =>
        serverRows.filter(
          (server) =>
            (!where.spaceId || server.spaceId === where.spaceId) &&
            (!where.userId || server.userId === where.userId) &&
            (!where.agentBotId || server.agentBotId === where.agentBotId) &&
            (where.enabled === undefined || server.enabled === where.enabled),
        ),
      ),
    },
    spaceModelPreference: { findFirst: vi.fn(async () => null) },
    secret: { findFirst: vi.fn(async () => null) },
    userModelCredential: { findFirst: vi.fn(async () => null) },
    spaceBackupModel: { findMany: vi.fn(async () => []) },
    deploymentSettings: {
      findUnique: vi.fn(async () => ({
        defaultModelProvider: "openrouter",
        defaultModelId: "openai/gpt-6-luna",
      })),
    },
    aiDataConsent: {
      findUnique: vi.fn(async () => ({ version: AI_DISCLOSURE_VERSION })),
      findFirst: vi.fn(async () => ({ userId: run.userId })),
    },
    user: { findUnique: vi.fn(async () => null) },
    taughtSkill: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    agentSecret: { findMany: vi.fn(async () => []) },
    botSecret: { findMany: vi.fn(async () => []) },
    agentSkill: { findMany: vi.fn(async () => []) },
    botSkillSetting: { findMany: vi.fn(async () => []) },
    scratchpadItem: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    externalEffect,
    approval: { create: vi.fn(async () => ({ id: "approval-1" })) },
    artifact: { findMany: vi.fn(async () => []) },
    routine: { findUnique: vi.fn(async () => null) },
    // The connector's own re-read of the row that authorizes the call.
    botMcpServer: {
      findFirst: vi.fn(async () => ({
        botId: run.botId,
        serverId: SERVER_ID,
        spaceId: run.spaceId,
        userId: run.userId,
        allowAllTools: true,
        allowedTools: [],
        server: { ...serverRows[0], revision: 1 },
        bot: agentBot,
      })),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({ $executeRaw: vi.fn(async () => 1) }),
    ),
  };

  // The executor reads many tables a run like this never fills. Any call this fixture does not
  // set up answers as an empty table, so only the rows that matter are written out above.
  const emptyResult = (operation: string) =>
    operation.startsWith("findMany")
      ? []
      : operation === "count"
        ? 0
        : operation === "updateMany" || operation === "deleteMany"
          ? { count: 0 }
          : null;
  const withDefaults = <T extends object>(model: T): T =>
    new Proxy(model, {
      get: (target, operation) =>
        operation in target
          ? Reflect.get(target, operation)
          : typeof operation === "string"
            ? async () => emptyResult(operation)
            : undefined,
    });
  const prismaWithDefaults = new Proxy(prisma as Record<string, object>, {
    get: (target, name) =>
      typeof name !== "string" || name.startsWith("$")
        ? Reflect.get(target, name)
        : withDefaults(target[name] ?? {}),
  });

  const runtimeRun = vi.fn(async function* (next: AgentRunRequest) {
    request = next;
    const calls: ToolCall[] =
      options.toolCalls ?? (options.calls ?? []).map((args) => ({ tool: TOOL_NAME, args }));
    for (const [index, call] of calls.entries()) {
      try {
        results.push(await next.executeTool?.(call.tool, call.args, `tool-call-${index + 1}`));
      } catch (error) {
        results.push(error);
      }
    }
    yield { type: "done" as const, text: "Done" };
  });
  const executor = createRunExecutor({
    prisma: prismaWithDefaults,
    deploymentModelKey: "fake-deployment-key",
    runtime: { describe: () => ({ capabilities: { scripted: false } }), run: runtimeRun },
    sandbox: {
      describe: () => ({ capabilities: { graphical: true } }),
      writeFile: vi.fn(async () => undefined),
      async *exportWorkspace() {
        yield* [];
      },
    },
    home: { commit: vi.fn(async () => "fixture-revision") },
    memory: { read: async () => ({ documents: [] }) },
    memoryProviders: { resolve: async () => null },
    browser: { describe: () => ({ capabilities: { page: true } }) },
    events: {
      append: vi.fn(async () => undefined),
      finalizeRun: vi.fn(async () => ({ continuationRunId: null })),
      pauseRunForInput,
    },
    jobs: { enqueue: vi.fn(async () => undefined) },
    secrets: [],
    secretStore: { load: vi.fn(async () => JSON.stringify({ secret: "offline-key" })) },
    // A reviewer that would pass anything: only the mandatory approval can stop the write.
    ...(options.allowEverything
      ? { autoReview: { review: vi.fn(async () => ({ decision: "pass", reason: "ok" })) } }
      : {}),
    connector: { discoverTools, execute },
  } as unknown as Parameters<typeof createRunExecutor>[0]);

  const dispatched = () =>
    execute.mock.calls.map(([call]) => call as { executionId: string; tool: string });
  return {
    run,
    prisma,
    executor,
    request: () => request,
    results,
    execute,
    pauseRunForInput,
    dispatched,
    externalEffects,
  };
}

describe("Brex cards executor gates", () => {
  it("asks before a write even with a saved Always-allow rule and Auto Review on, and offers no Always allow", async () => {
    const f = fixture({ allowEverything: true, calls: [CARD] });
    await f.executor.continueRun(f.run.id, "worker-1");

    expect((f.request()?.tools ?? []).map((tool) => tool.name)).toContain(TOOL_NAME);
    expect(f.pauseRunForInput).toHaveBeenCalledTimes(1);
    const [{ blocks }] = f.pauseRunForInput.mock.calls[0] as unknown as [
      { blocks: Array<{ kind: string; actions: Array<{ id: string }> }> },
    ];
    expect(blocks[0]?.kind).toBe("ask");
    expect(blocks[0]?.actions.map((action) => action.id)).toEqual(["allow", "deny"]);
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.externalEffects).toHaveLength(1);
    expect(f.externalEffects[0]).toMatchObject({ status: "intended", kind: TOOL_NAME });
  });

  it("hands the approved effect's own id to the connector as the call's key", async () => {
    const f = fixture({ approved: [{ id: "effect-approved-1" }], calls: [CARD] });
    await f.executor.continueRun(f.run.id, "worker-1");

    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(f.dispatched().map((call) => call.executionId)).toEqual(["effect-approved-1"]);
    expect(f.externalEffects[0]).toMatchObject({ id: "effect-approved-1", status: "completed" });
  });

  it("reuses the same key when the same effect is dispatched again by a restarted attempt", async () => {
    const first = fixture({ approved: [{ id: "effect-approved-1" }], calls: [CARD] });
    await first.executor.continueRun(first.run.id, "worker-1");
    const restarted = fixture({ approved: [{ id: "effect-approved-1" }], calls: [CARD] });
    await restarted.executor.continueRun(restarted.run.id, "worker-2");

    expect(first.dispatched().map((call) => call.executionId)).toEqual(["effect-approved-1"]);
    expect(restarted.dispatched().map((call) => call.executionId)).toEqual(["effect-approved-1"]);
  });

  it("gives two separately approved identical requests different keys", async () => {
    const f = fixture({
      approved: [{ id: "effect-approved-1" }, { id: "effect-approved-2" }],
      calls: [CARD, CARD],
    });
    await f.executor.continueRun(f.run.id, "worker-1");

    expect(f.dispatched().map((call) => call.executionId)).toEqual([
      "effect-approved-1",
      "effect-approved-2",
    ]);
  });

  it("leaves other servers' calls keyed as before, by the effect's idempotency key", async () => {
    const f = fixture({
      endpoint: "https://mcp.mercury.com/mcp",
      approved: [{ id: "effect-approved-1" }],
      calls: [CARD],
    });
    await f.executor.continueRun(f.run.id, "worker-1");

    const [call] = f.dispatched();
    expect(call?.executionId).toBe(f.externalEffects[0]?.idempotencyKey);
    expect(call?.executionId).not.toBe("effect-approved-1");
  });

  it("asks before an Offboard write and runs nothing until it is approved", async () => {
    const f = fixture({
      tools: ["lock_card"],
      toolCalls: [{ tool: "mcp__brex-cards__lock_card", args: { cardId: "card_ops" } }],
    });
    await f.executor.continueRun(f.run.id, "worker-1");

    expect(f.pauseRunForInput).toHaveBeenCalledTimes(1);
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.externalEffects).toHaveLength(1);
    expect(f.externalEffects[0]).toMatchObject({
      status: "intended",
      kind: "mcp__brex-cards__lock_card",
    });
  });

  it("needs a separate approved effect for each Offboard write", async () => {
    const lock = { cardId: "card_ops" };
    const cancel = { cardId: "card_ops" };
    const limit = { spendLimitId: "limit_cloud", memberUserIds: ["u_ada"] };
    const f = fixture({
      tools: ["lock_card", "terminate_card", "update_spend_limit"],
      approved: [
        { id: "effect-lock", tool: "lock_card", args: lock },
        { id: "effect-cancel", tool: "terminate_card", args: cancel },
        { id: "effect-limit", tool: "update_spend_limit", args: limit },
      ],
      toolCalls: [
        { tool: "mcp__brex-cards__lock_card", args: lock },
        { tool: "mcp__brex-cards__terminate_card", args: cancel },
        { tool: "mcp__brex-cards__update_spend_limit", args: limit },
      ],
    });
    await f.executor.continueRun(f.run.id, "worker-1");

    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(f.dispatched().map((call) => call.executionId)).toEqual([
      "effect-lock",
      "effect-cancel",
      "effect-limit",
    ]);
    expect(f.dispatched().map((call) => call.tool)).toEqual([
      "mcp__brex-cards__lock_card",
      "mcp__brex-cards__terminate_card",
      "mcp__brex-cards__update_spend_limit",
    ]);
    expect(f.externalEffects.map((effect) => effect.status)).toEqual([
      "completed",
      "completed",
      "completed",
    ]);
  });

  it("does not run an Offboard write after its approval was denied", async () => {
    const lock = { cardId: "card_ops" };
    const f = fixture({
      tools: ["lock_card"],
      denied: [{ id: "effect-denied", tool: "lock_card", args: lock }],
      toolCalls: [{ tool: "mcp__brex-cards__lock_card", args: lock }],
    });
    await f.executor.continueRun(f.run.id, "worker-1");

    expect(f.execute).not.toHaveBeenCalled();
    expect(f.pauseRunForInput).not.toHaveBeenCalled();
    expect(f.externalEffects.some((effect) => effect.status === "denied")).toBe(true);
  });
});
