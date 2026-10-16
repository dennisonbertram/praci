import type { Actor, Bot } from "@rakazo/contracts";
import {
  CARTA_MCP_ENDPOINT,
  CARTA_READ_TOOLS,
  CARTA_WRITE_TOOLS,
  cartaAgentSpawnKey,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  assignToExistingCartaAgent,
  type CartaSyncDeps,
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
};

function fakes(servers: FakeServer[]) {
  const bot = { id: "bot-1" } as Bot;
  const createBot = vi.fn(async () => bot);
  const findMany = vi.fn(async () =>
    servers.map((server) => ({ enabled: true, writesEnabled: false, ...server })),
  );
  const upsert = vi.fn(async () => ({}));
  const deleteMany = vi.fn(async () => ({ count: 0 }));
  const prisma = {
    mcpServer: { findMany },
    botMcpServer: { upsert, deleteMany },
    bot: { findFirst: vi.fn(async () => bot) },
  } as never;
  return {
    createBot,
    findMany,
    upsert,
    deleteMany,
    prisma,
    deps: { prisma, repos: { createBot } },
  };
}

describe("ensureCartaAgent", () => {
  it("creates the bot by spawn key and names the contact tools and skills", async () => {
    const { createBot, deps } = fakes([]);
    await ensureCartaAgent(deps, actor);
    const input = (createBot.mock.calls[0] as unknown as [Actor, Record<string, unknown>])[1];
    expect(input.spawnKey).toBe(cartaAgentSpawnKey("user-1"));
    expect(input.name).toBe("Carta agent");
    for (const word of [
      "contacts_add",
      "cap_table_update",
      "Other bots",
      "carta-investor-update",
      "carta-audit-response",
      "TBD",
    ])
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
      { id: "srv-on", endpoint: CARTA_MCP_ENDPOINT, writesEnabled: true },
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

  it("takes every Carta server away from the user's other bots", async () => {
    const { deleteMany, deps } = fakes([
      { id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT, enabled: false },
      { id: "srv-other", endpoint: "https://mcp.example.com/mcp" },
    ]);
    await ensureCartaAgent(deps, actor);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        spaceId: "space-1",
        userId: "user-1",
        serverId: { in: ["srv-carta"] },
        botId: { not: "bot-1" },
      },
    });
  });

  it("assignToExistingCartaAgent narrows an existing agent's assignment", async () => {
    const { upsert, prisma } = fakes([{ id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT }]);
    await assignToExistingCartaAgent(prisma, actor);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("assignToExistingCartaAgent clears other bots even before the Carta agent exists", async () => {
    const { upsert, deleteMany, prisma } = fakes([
      { id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT },
    ]);
    (prisma as never as { bot: { findFirst: unknown } }).bot.findFirst = vi.fn(async () => null);
    await assignToExistingCartaAgent(prisma, actor);
    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({
      where: { spaceId: "space-1", userId: "user-1", serverId: { in: ["srv-carta"] } },
    });
  });
});

describe("Carta populate run", () => {
  function syncFakes(options: { endpoint?: string; active?: boolean; hasModel?: boolean } = {}) {
    const base = fakes([{ id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT }]);
    const bot = { id: "bot-1", threadId: "thread-1" } as Bot;
    base.createBot.mockResolvedValue(bot);
    const runFindFirst = vi.fn(async () => (options.active ? { id: "run-active" } : null));
    const runCreate = vi.fn(async () => ({ id: "run-new" }));
    const taskCreate = vi.fn(async () => ({ id: "task-1" }));
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      run: { findFirst: runFindFirst, create: runCreate },
      task: { create: taskCreate },
    };
    const enqueueRun = vi.fn(async () => {});
    const deps = {
      prisma: {
        ...(base.prisma as object),
        mcpServer: {
          findMany: base.findMany,
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
    return { ...base, deps, runCreate, taskCreate, enqueueRun, runFindFirst };
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
    for (const word of ["cap_table_update", "contacts_add", "mail_grep", "12 months", "charts"])
      expect(task.data.prompt).toContain(word);
    expect(f.enqueueRun).toHaveBeenCalledWith("run-new");
  });

  it("does not enqueue a second run while one is queued or running", async () => {
    const f = syncFakes({ active: true });
    await onMcpServerConnected(f.deps, actor, "srv-carta");
    expect(f.runCreate).not.toHaveBeenCalled();
    expect(f.enqueueRun).not.toHaveBeenCalled();
    expect(await startCartaSync(f.deps, actor)).toBe("running");
  });

  it("refresh starts the same run, and reports a missing model", async () => {
    const f = syncFakes();
    expect(await startCartaSync(f.deps, actor)).toBe("started");
    expect(f.enqueueRun).toHaveBeenCalledTimes(1);
    const none = syncFakes({ hasModel: false });
    expect(await startCartaSync(none.deps, actor)).toBe("no_model");
    expect(none.runCreate).not.toHaveBeenCalled();
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
          status: { in: ["queued", "leased", "running"] },
        }),
      }),
    );
  });
});
