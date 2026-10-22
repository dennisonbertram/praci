import type { AgentRunRequest } from "@rakazo/adapter-kit";
import { INVESTORS_AGENT_BUILTIN_TOOLS } from "@rakazo/contracts";
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
      blocks: [{ kind: "text", text: "who owns what?" }],
      replyToMessageId: null,
      replyQuote: null,
      replyTo: null,
    },
  ];
}

async function runInvestors(
  trigger = "user",
  spawnKey: string | null = "investors-agent:user-1",
  prompt = "Look again",
) {
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
        name: "Investors agent",
        userId: "user-1",
        spawnKey,
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
    task: {
      findUniqueOrThrow: vi.fn(async () => ({
        id: run.taskId,
        prompt,
      })),
    },
    computer: { updateMany: vi.fn(async () => ({ count: 1 })) },
    connection: { findMany: vi.fn(async () => []) },
    spaceModelPreference: {
      findFirst: vi.fn<(...args: unknown[]) => Promise<Record<string, unknown> | null>>(
        async () => null,
      ),
    },
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
      findFirst: vi.fn(async () => ({ userId: "user-1" })),
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
  const discoverTools = vi.fn(async () => [
    {
      name: "mcp__carta__list",
      description: "x",
      inputSchema: {},
      readOnly: true,
      route: { connectorId: "mcp" },
    },
    {
      name: "COMPOSIO_SEARCH",
      description: "x",
      inputSchema: {},
      readOnly: true,
      route: { connectorId: "composio" },
    },
  ]);
  const finalizeRun = vi.fn(async () => ({ continuationRunId: null }));
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
    events: { append: vi.fn(async () => undefined), finalizeRun },
    jobs: { enqueue: vi.fn(async () => undefined) },
    secrets: [],
    connector: { discoverTools },
  } as unknown as Parameters<typeof createRunExecutor>[0]);

  await executor.continueRun(run.id, "worker-1");
  return { request, discoverTools };
}

describe("Investors agent runs", () => {
  it("is offered only its fixed tools: no mail_send, MCP or Composio tool", async () => {
    const { request, discoverTools } = await runInvestors();
    const names = (request?.tools ?? []).map((tool) => tool.name);
    const fixed = new Set<string>(INVESTORS_AGENT_BUILTIN_TOOLS);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => !fixed.has(name))).toEqual([]);
    expect(names).toEqual(
      expect.arrayContaining(["cap_table_read", "contacts_list", "search_data_room"]),
    );
    expect(names).toContain("fundraising_read");
    for (const banned of ["mail_send", "mcp__carta__list", "COMPOSIO_SEARCH"]) {
      expect(names).not.toContain(banned);
    }
    expect(discoverTools).not.toHaveBeenCalled();
  });

  it("offers cap_table_update only on the routine sheet read", async () => {
    const chat = await runInvestors("user");
    const routine = await runInvestors("routine");
    const names = (r: typeof chat) => (r.request?.tools ?? []).map((tool) => tool.name);
    expect(names(chat)).toContain("cap_table_read");
    expect(names(chat)).not.toContain("cap_table_update");
    expect(names(routine)).toContain("cap_table_update");
  });

  it("does not offer cap_table_update on an audit drafting run, which reads untrusted email", async () => {
    const audit = await runInvestors(
      "routine",
      "investors-agent:user-1",
      "Answer audit request ar1 with the audit-response skill.",
    );
    const names = (audit.request?.tools ?? []).map((tool) => tool.name);
    expect(names).not.toContain("cap_table_update");
    expect(names).toContain("audit_request_upsert");
  });

  it("offers investor_update_draft to the Investors agent and to no other bot", async () => {
    const investors = await runInvestors();
    expect((investors.request?.tools ?? []).map((tool) => tool.name)).toContain(
      "investor_update_draft",
    );
    for (const spawnKey of ["carta-agent:user-1", "legal-agent:user-1", null]) {
      const other = await runInvestors("user", spawnKey);
      expect((other.request?.tools ?? []).map((tool) => tool.name)).not.toContain(
        "investor_update_draft",
      );
    }
  });

  it("offers audit_request_upsert to the Investors agent and to no other bot", async () => {
    const investors = await runInvestors();
    expect((investors.request?.tools ?? []).map((tool) => tool.name)).toContain(
      "audit_request_upsert",
    );
    for (const spawnKey of ["carta-agent:user-1", "legal-agent:user-1", null]) {
      const other = await runInvestors("user", spawnKey);
      expect((other.request?.tools ?? []).map((tool) => tool.name)).not.toContain(
        "audit_request_upsert",
      );
    }
  });

  it("is not offered fundraising_read on a run another bot started", async () => {
    const { request } = await runInvestors("bot_message");
    expect((request?.tools ?? []).map((tool) => tool.name)).not.toContain("fundraising_read");
  });
});
