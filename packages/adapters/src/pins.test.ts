import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { formatPinValue, jsonPointerGet, refreshBotPins, saveBotPins } from "./pins.js";

describe("jsonPointerGet", () => {
  const doc = { accounts: [{ balance: 1234.5 }], "a/b": { "m~n": "x" }, empty: null };
  it("walks objects and arrays and unescapes ~1 and ~0", () => {
    expect(jsonPointerGet(doc, "/accounts/0/balance")).toBe(1234.5);
    expect(jsonPointerGet(doc, "/a~1b/m~0n")).toBe("x");
    expect(jsonPointerGet(doc, "")).toBe(doc);
    expect(jsonPointerGet(doc, "/empty")).toBeNull();
  });
  it("throws when nothing is there", () => {
    for (const path of [
      "/nope",
      "/accounts/1",
      "/accounts/-",
      "/empty/x",
      "accounts",
      "/accounts/length",
    ]) {
      expect(() => jsonPointerGet(doc, path)).toThrow();
    }
  });
});

describe("formatPinValue", () => {
  it("formats usd without cents from 1,000", () => {
    expect(formatPinValue(1234.56, "usd")).toBe("$1,235");
    expect(formatPinValue(999.5, "usd")).toBe("$999.50");
    expect(formatPinValue("2500000", "usd")).toBe("$2,500,000");
    expect(formatPinValue(-1500, "usd")).toBe("-$1,500");
  });
  it("formats numbers, percents and text", () => {
    expect(formatPinValue(1234567, "number")).toBe("1,234,567");
    expect(formatPinValue(12.345, "percent")).toBe("12.3%");
    expect(formatPinValue("on track", "text")).toBe("on track");
    expect(formatPinValue({ a: 1 }, "text")).toBe('{"a":1}');
    expect(formatPinValue("x".repeat(60), "text")).toHaveLength(40);
  });
  it("rejects a non-number for a numeric format", () => {
    expect(() => formatPinValue("abc", "usd")).toThrow(/not a number/);
    expect(() => formatPinValue(null, "number")).toThrow();
  });
});

type Row = Record<string, unknown>;
const scope = { spaceId: "sp", botId: "bot", userId: "u" };
const src = (tool = "get_balance", over: Row = {}) => ({
  serverId: "srv",
  tool,
  args: {},
  path: "/balance",
  format: "number" as const,
  ...over,
});

/** In-memory prisma with one bot, one pins row and one server assignment. */
function fakeWorld(opts: {
  assignment?: { allowAllTools: boolean; allowedTools: string[] } | null;
  tools?: { name: string; annotations?: Row }[];
  stats?: Row[];
  /** The bot is the integration agent of the server, whose writes are off. */
  agent?: boolean;
}) {
  let row: Row = {
    id: "p",
    botId: "bot",
    list: null,
    revision: 1,
    updatedBy: "bot",
    updatedAt: new Date(),
    refreshedAt: null,
    stats: opts.stats ?? [],
  };
  let enabled = true;
  const assignment =
    opts.assignment === undefined ? { allowAllTools: true, allowedTools: [] } : opts.assignment;
  const prisma = {
    botMcpServer: {
      findFirst: vi.fn(async () =>
        assignment && enabled
          ? opts.agent
            ? {
                ...assignment,
                botId: "bot",
                serverId: "srv",
                server: { id: "srv", spaceId: "sp", userId: "u", agentBotId: "bot" },
                bot: { spawnKey: "integration-agent:srv", spaceId: "sp", userId: "u" },
              }
            : { ...assignment, server: { id: "srv" }, bot: { spawnKey: null }, serverId: "srv" }
          : null,
      ),
    },
    botPins: {
      findFirst: vi.fn(async () => row),
      updateMany: vi.fn(async ({ data }: { data: Row }) => {
        row = { ...row, ...data };
        return { count: 1 };
      }),
      findUniqueOrThrow: vi.fn(async () => row),
    },
    thread: { findFirst: vi.fn(async () => ({ id: "t" })) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const events = {
    append: vi.fn(async () => ({}) as never),
    sendUserMessage: vi.fn(async () => ({ messageId: "m", seq: 1, taskId: null, runId: null })),
  };
  const mcp = {
    listServerTools: vi.fn(async () => (opts.tools ?? [{ name: "get_balance" }]) as never),
    callServerTool: vi.fn(),
  };
  return {
    prisma: prisma as unknown as PrismaClient,
    events,
    mcp,
    jobs: { enqueue: vi.fn() },
    stored: () => row,
    setStats: (stats: Row[]) => (row = { ...row, stats, revision: (row.revision as number) + 1 }),
    disable: () => (enabled = false),
  };
}
const save = (w: ReturnType<typeof fakeWorld>, source: ReturnType<typeof src>) =>
  saveBotPins(w, scope, {
    stats: [{ id: "a", label: "A", value: "1", source }],
    baseRevision: 1,
    updatedBy: "bot",
  });

describe("pin source authorization", () => {
  it("refuses a server the bot is not assigned to or a tool outside its allowlist", async () => {
    await expect(save(fakeWorld({ assignment: null }), src())).rejects.toThrow(/not assigned/);
    const limited = fakeWorld({ assignment: { allowAllTools: false, allowedTools: ["other"] } });
    await expect(save(limited, src())).rejects.toThrow(/not assigned/);
    const ok = fakeWorld({ assignment: { allowAllTools: false, allowedTools: ["get_balance"] } });
    await expect(save(ok, src())).resolves.toMatchObject({ ok: true });
  });

  it("needs both the annotations and the name to read as read-only, and the server to list the tool", async () => {
    const tool = (annotations?: Row, name = "get_balance") =>
      fakeWorld({ tools: [{ name, annotations }] });
    await expect(save(tool({ readOnlyHint: false }), src())).rejects.toThrow(/not read-only/);
    await expect(save(tool({ destructiveHint: true }), src())).rejects.toThrow(/not read-only/);
    // A bot run would need approval for delete_all whatever the server claims.
    await expect(
      save(tool({ readOnlyHint: true }, "delete_all"), src("delete_all")),
    ).rejects.toThrow(/not read-only/);
    await expect(save(tool({ readOnlyHint: true }), src())).resolves.toMatchObject({ ok: true });
    await expect(save(tool(undefined, "delete_all"), src("delete_all"))).rejects.toThrow(
      /not read-only/,
    );
    await expect(save(tool(undefined, "get_balance"), src("get_other"))).rejects.toThrow(
      /not offered/,
    );
  });
});

describe("pin sources for an integration agent", () => {
  it("accepts the agent's own read, judged on the listed annotations, and refuses a write", async () => {
    const agent = (annotations?: Row) =>
      fakeWorld({ agent: true, tools: [{ name: "get_balance", annotations }] });
    await expect(save(agent({ readOnlyHint: true }), src())).resolves.toMatchObject({ ok: true });
    await expect(save(agent(), src())).rejects.toThrow(/not assigned/);
  });
});

describe("refreshBotPins", () => {
  const sourced = (source = src()) => [{ id: "a", label: "A", value: "1", source }];
  const reply = (n: number) => ({
    content: [{ type: "text", text: JSON.stringify({ balance: n }) }],
  });

  it("does not apply a result to a stat whose source changed during the call", async () => {
    const w = fakeWorld({ stats: sourced() });
    w.mcp.callServerTool.mockImplementation(async () => {
      w.setStats(sourced(src("get_balance", { path: "/other" })));
      return reply(99);
    });
    const result = await refreshBotPins(w, scope);
    expect(result?.pins.stats[0]).toMatchObject({ value: "1", source: { path: "/other" } });
    expect(result?.pins.stats[0]).not.toHaveProperty("error");
  });

  it("saves the error marker and still messages the bot when a source is now invalid", async () => {
    const w = fakeWorld({ stats: [...sourced(), { id: "free", label: "Mood", value: "ok" }] });
    w.disable();
    const result = await refreshBotPins(w, scope);
    expect(result?.pins.stats[0]).toMatchObject({ value: "1", error: expect.any(String) });
    expect(w.mcp.callServerTool).not.toHaveBeenCalled();
    expect(w.events.sendUserMessage).toHaveBeenCalledTimes(1);
  });
});

describe("pin list validation", () => {
  it("returns a validation error the model can act on for an item over 60 characters", async () => {
    const w = fakeWorld({});
    await expect(
      saveBotPins(w, scope, {
        list: { title: "T", items: [{ id: "a", text: "x".repeat(61), done: false }] },
        baseRevision: 1,
        updatedBy: "bot",
      }),
    ).rejects.toThrow(/Invalid list at list.items.0.text.*<=60/);
  });
});
