import type { Actor, Bot } from "@rakazo/contracts";
import {
  CARTA_MCP_ENDPOINT,
  CARTA_READ_TOOLS,
  CARTA_WRITE_TOOLS,
  cartaAgentSpawnKey,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { CartaSyncDeps } from "./carta-agent.js";
import {
  assignToExistingCartaAgent,
  ensureCartaAgent,
  isCartaSyncing,
  onMcpServerConnected,
  startCartaSync,
} from "./carta-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

type FakeServer = {
  id: string;
  endpoint: string | null;
  enabled?: boolean;
  writesEnabled?: boolean;
  agentBotId?: string | null;
  agentExclusive?: boolean;
};

function fakes(servers: FakeServer[]) {
  const bot = {
    id: "bot-1",
    spaceId: actor.spaceId,
    userId: actor.userId,
    spawnKey: cartaAgentSpawnKey(actor.userId),
    archivedAt: null,
  } as Bot;
  const createBot = vi.fn(async () => bot);
  const rows = servers.map((server) => ({
    enabled: true,
    writesEnabled: false,
    agentBotId: null,
    agentExclusive: false,
    ...server,
  }));
  const findMany = vi.fn(async () => rows.map((server) => ({ ...server })));
  const serverUpdateMany = vi.fn(
    async ({
      where,
      data,
    }: {
      where: {
        id: string;
        endpoint: string | null;
        enabled: boolean;
        writesEnabled: boolean;
        agentBotId: string | null;
      };
      data: Record<string, unknown>;
    }) => {
      const row = rows.find(
        (server) =>
          server.id === where.id &&
          server.endpoint === where.endpoint &&
          server.enabled === where.enabled &&
          server.writesEnabled === where.writesEnabled &&
          server.agentBotId === where.agentBotId,
      );
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  );
  const botUpdateMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) => ({
    count:
      where.id === bot.id &&
      where.spaceId === bot.spaceId &&
      where.userId === bot.userId &&
      where.spawnKey === bot.spawnKey &&
      where.archivedAt === null
        ? 1
        : 0,
  }));
  const upsert = vi.fn(async () => ({}));
  const assignments = [{ botId: "other-bot", serverId: "srv-carta" }];
  const deleteMany = vi.fn(async () => {
    assignments.length = 0;
    return { count: 1 };
  });
  const fakeTx = {
    bot: { updateMany: botUpdateMany },
    mcpServer: { findMany, updateMany: serverUpdateMany },
    botMcpServer: { upsert, deleteMany },
  };
  const transaction = vi.fn(async (callback: (tx: typeof fakeTx) => unknown) => callback(fakeTx));
  const prisma = {
    mcpServer: { findMany, updateMany: serverUpdateMany },
    botMcpServer: { upsert, deleteMany },
    bot: { findFirst: vi.fn(async () => bot), updateMany: botUpdateMany },
    $transaction: transaction,
  } as never;
  return {
    createBot,
    findMany,
    serverUpdateMany,
    botUpdateMany,
    rows,
    upsert,
    deleteMany,
    transaction,
    tx: fakeTx,
    assignments,
    prisma,
    deps: { prisma, repos: { createBot } },
  };
}

describe("ensureCartaAgent", () => {
  it("rewrites the old default description only, scoped to the actor", async () => {
    const { botUpdateMany, deps } = fakes([]);
    await ensureCartaAgent(deps, actor);
    expect(botUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "bot-1",
        spaceId: "space-1",
        userId: "user-1",
        description: "Keeps your cap table and investor contacts.",
      },
      data: { description: "Reads Carta to keep your cap table and contacts current." },
    });
  });

  it("creates the bot by spawn key and names the contact tools and skills", async () => {
    const { createBot, deps } = fakes([]);
    await ensureCartaAgent(deps, actor);
    const input = (createBot.mock.calls[0] as unknown as [Actor, Record<string, unknown>])[1];
    expect(input.spawnKey).toBe(cartaAgentSpawnKey("user-1"));
    expect(input.name).toBe("Carta agent");
    for (const word of ["contacts_add", "cap_table_read", "cap_table_update", "Other bots", "TBD"])
      expect(String(input.instructions)).toContain(word);
  });

  it("assigns only the actor's enabled Carta servers with the read tools, every call", async () => {
    const { upsert, findMany, deps } = fakes([
      { id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT },
      { id: "srv-other", endpoint: "https://mcp.example.com/mcp" },
      { id: "srv-stdio", endpoint: null },
    ]);
    await ensureCartaAgent(deps, actor);
    await ensureCartaAgent(deps, actor);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { spaceId: "space-1", userId: "user-1" } }),
    );
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { allowAllTools: false, allowedTools: [...CARTA_READ_TOOLS] },
        create: expect.objectContaining({ serverId: "srv-carta", allowAllTools: false }),
      }),
    );
  });

  it("adds the write tools only for a server whose writes are on, and skips a disabled server", async () => {
    const { upsert, deps } = fakes([
      {
        id: "srv-on",
        endpoint: CARTA_MCP_ENDPOINT,
        writesEnabled: true,
        agentBotId: "bot-1",
      },
      { id: "srv-off", endpoint: CARTA_MCP_ENDPOINT, enabled: false },
    ]);
    await ensureCartaAgent(deps, actor);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          allowAllTools: false,
          allowedTools: [...CARTA_READ_TOOLS, ...CARTA_WRITE_TOOLS],
        },
      }),
    );
  });

  it("links new Carta servers with exclusive on and writes off", async () => {
    const { serverUpdateMany, rows, deps } = fakes([
      { id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT, enabled: false },
      { id: "srv-other", endpoint: "https://mcp.example.com/mcp" },
    ]);
    await ensureCartaAgent(deps, actor);
    expect(rows[0]).toMatchObject({
      agentBotId: "bot-1",
      agentExclusive: true,
      writesEnabled: false,
    });
    expect(serverUpdateMany).toHaveBeenCalledOnce();
  });

  it("does not restore a Carta link after the endpoint changes during assignment", async () => {
    const { serverUpdateMany, rows, upsert, deps } = fakes([
      { id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT },
    ]);
    serverUpdateMany.mockImplementationOnce(async () => {
      rows[0]!.endpoint = "https://mcp.example.com/mcp";
      return { count: 0 };
    });
    await ensureCartaAgent(deps, actor);
    expect(rows[0]!.agentBotId).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not link Carta servers when the agent is no longer live", async () => {
    const { botUpdateMany, serverUpdateMany, rows, deps } = fakes([
      { id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT },
    ]);
    botUpdateMany.mockResolvedValueOnce({ count: 0 });
    await ensureCartaAgent(deps, actor);
    expect(serverUpdateMany).not.toHaveBeenCalled();
    expect(rows[0]!.agentBotId).toBeNull();
  });

  it("preserves another bot's Carta assignment and existing agent switches", async () => {
    const { deleteMany, serverUpdateMany, upsert, rows, deps, assignments } = fakes([
      {
        id: "srv-carta",
        endpoint: CARTA_MCP_ENDPOINT,
        agentBotId: "bot-1",
        agentExclusive: false,
        writesEnabled: true,
      },
    ]);
    await ensureCartaAgent(deps, actor);
    expect(rows[0]).toMatchObject({
      agentBotId: "bot-1",
      agentExclusive: false,
      writesEnabled: true,
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          allowAllTools: false,
          allowedTools: [...CARTA_READ_TOOLS, ...CARTA_WRITE_TOOLS],
        },
      }),
    );
    expect(assignments).toEqual([{ botId: "other-bot", serverId: "srv-carta" }]);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(serverUpdateMany).toHaveBeenCalledOnce();
  });

  it("assignToExistingCartaAgent narrows an existing agent's assignment", async () => {
    const { upsert, prisma } = fakes([{ id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT }]);
    await assignToExistingCartaAgent(prisma, actor);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("assignToExistingCartaAgent preserves other assignments when no agent exists", async () => {
    const { upsert, deleteMany, prisma } = fakes([
      { id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT },
    ]);
    (prisma as never as { bot: { findFirst: unknown } }).bot.findFirst = vi.fn(async () => null);
    await assignToExistingCartaAgent(prisma, actor);
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });
});

describe("Carta populate run", () => {
  function syncFakes(
    options: { endpoint?: string; active?: boolean; hasModel?: boolean; source?: string } = {},
  ) {
    const base = fakes([{ id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT }]);
    const bot = { id: "bot-1", threadId: "thread-1" } as Bot;
    base.createBot.mockResolvedValue(bot);
    const runFindFirst = vi.fn(async () => (options.active ? { id: "run-active" } : null));
    const runCreate = vi.fn(async () => ({ id: "run-new" }));
    const taskCreate = vi.fn(async () => ({ id: "task-1" }));
    const messageCreate = vi.fn(async () => ({ id: "msg-1" }));
    const basePrisma = base.prisma as unknown as Record<string, unknown>;
    const baseMcpServer = basePrisma.mcpServer as Record<string, unknown>;
    const tx = {
      ...basePrisma,
      $executeRaw: vi.fn(async () => 0),
      run: { findFirst: runFindFirst, create: runCreate },
      task: { create: taskCreate },
      thread: { update: vi.fn(async () => ({ nextMessageSeq: 1, nextEventSeq: 1 })) },
      message: { create: messageCreate },
      event: { create: vi.fn(async () => ({ id: "evt-1" })) },
      mcpServer: {
        ...baseMcpServer,
        findFirst: vi.fn(async () => ({
          endpoint: options.endpoint ?? CARTA_MCP_ENDPOINT,
        })),
      },
    };
    const enqueueRun = vi.fn(async () => {});
    const deps = {
      prisma: {
        ...basePrisma,
        capTableSnapshot: {
          findUnique: vi.fn(async () => (options.source ? { source: options.source } : null)),
        },
        mcpServer: {
          ...baseMcpServer,
          findFirst: vi.fn(async () => ({
            endpoint: options.endpoint ?? CARTA_MCP_ENDPOINT,
          })),
        },
        run: { findFirst: runFindFirst },
        $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
      },
      repos: { createBot: base.createBot },
      hasModel: vi.fn(async () => options.hasModel ?? true),
      enqueueRun,
    } as unknown as CartaSyncDeps;
    return { ...base, deps, runCreate, taskCreate, enqueueRun, runFindFirst, messageCreate };
  }

  it("on Carta sign-in, ensures the agent and enqueues one routine-trigger run", async () => {
    const f = syncFakes();
    await onMcpServerConnected(f.deps, actor, "srv-carta");
    expect(f.createBot).toHaveBeenCalledTimes(1);
    expect(f.runCreate).toHaveBeenCalledTimes(1);
    expect(f.runCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          botId: "bot-1",
          userId: "user-1",
          spaceId: "space-1",
          trigger: "routine",
          status: "queued",
        }),
      }),
    );
    const task = (f.taskCreate.mock.calls[0] as unknown as [{ data: { prompt: string } }])[0];
    for (const word of ["cap_table_update", "contacts_add", "one short sentence", "charts"])
      expect(task.data.prompt).toContain(word);
    expect(f.enqueueRun).toHaveBeenCalledWith("run-new");
  });

  it("does not enqueue a second run while one is queued or running", async () => {
    const f = syncFakes({ active: true });
    await onMcpServerConnected(f.deps, actor, "srv-carta");
    expect(f.runCreate).not.toHaveBeenCalled();
    expect(f.enqueueRun).not.toHaveBeenCalled();
    expect(f.messageCreate).not.toHaveBeenCalled();
    expect(await startCartaSync(f.deps, actor)).toBe("running");
    // A run paused for approval or takeover is still going.
    expect(f.runFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: expect.arrayContaining(["waiting_input", "waiting_takeover"]) },
        }),
      }),
    );
  });

  it("refresh starts the same run, and reports a missing model", async () => {
    const f = syncFakes();
    expect(await startCartaSync(f.deps, actor)).toBe("started");
    expect(f.enqueueRun).toHaveBeenCalledTimes(1);
    // A line in the chat says why the agent replies, since the founder typed no question.
    expect(f.messageCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: "thread-1",
        role: "system",
        blocks: [{ kind: "meta", text: "You asked to refresh the cap table from Carta" }],
      }),
    });
    const none = syncFakes({ hasModel: false });
    expect(await startCartaSync(none.deps, actor)).toBe("no_model");
    expect(none.runCreate).not.toHaveBeenCalled();
  });

  it("does not read Carta when the table's source is another one", async () => {
    for (const source of ["native", "sheet"]) {
      const f = syncFakes({ source });
      await onMcpServerConnected(f.deps, actor, "srv-carta");
      expect(await startCartaSync(f.deps, actor)).toBe("other_source");
      expect(f.runCreate).not.toHaveBeenCalled();
      expect(f.enqueueRun).not.toHaveBeenCalled();
    }
    const carta = syncFakes({ source: "carta" });
    expect(await startCartaSync(carta.deps, actor)).toBe("started");
  });

  it("does nothing for a server that is not Carta's", async () => {
    const f = syncFakes({ endpoint: "https://mcp.example.com/mcp" });
    await onMcpServerConnected(f.deps, actor, "srv-other");
    expect(f.createBot).not.toHaveBeenCalled();
    expect(f.runCreate).not.toHaveBeenCalled();
  });

  it("never throws into the sign-in", async () => {
    const f = syncFakes();
    f.enqueueRun.mockRejectedValueOnce(new Error("queue down"));
    await expect(onMcpServerConnected(f.deps, actor, "srv-carta")).resolves.toBeUndefined();
  });

  it("isCartaSyncing looks only at the user's active populate runs", async () => {
    const findFirst = vi.fn(async () => ({ id: "r" }));
    expect(await isCartaSyncing({ run: { findFirst } } as never, actor)).toBe(true);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: "space-1",
          userId: "user-1",
          trigger: "routine",
          routineId: null,
          status: {
            in: ["queued", "leased", "running", "waiting_input", "waiting_takeover"],
          },
        }),
      }),
    );
  });
});
