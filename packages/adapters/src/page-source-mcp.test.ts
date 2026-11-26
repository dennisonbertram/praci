import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cards: { id: string; blocks: unknown[]; runId: string; botId: string }[] = [];
vi.mock("@rakazo/db", async (original) => ({
  ...(await original<typeof import("@rakazo/db")>()),
  createThreadMessageInTransaction: vi.fn(
    async (_tx: unknown, input: { blocks: unknown[]; runId: string; botId: string }) => {
      const card = { id: `m${cards.length + 1}`, ...input };
      cards.push(card);
      return card;
    },
  ),
  appendEventInTransaction: vi.fn(async () => ({ seq: 1 })),
}));
vi.mock("./run-notification.js", () => ({ notifyThreadEvent: vi.fn(async () => "created") }));

const { answerPageSourceApproval, findPageSourceApproval, pageSourceCallHash } = await import(
  "./page-source-approval.js"
);
const { pageSourceToolFromTool, refreshPageSource, refreshPageSources, listPageSources } =
  await import("./page-sources.js");

type Row = Record<string, any>;

/** Equality on the plain fields of a where clause; nested relation filters are ignored. */
const matches = (row: Row, where: Row = {}) =>
  Object.entries(where).every(([key, want]) =>
    want === null || typeof want !== "object" || want instanceof Date
      ? want instanceof Date
        ? row[key]?.getTime?.() === want.getTime()
        : row[key] === want
      : "in" in want
        ? want.in.includes(row[key])
        : true,
  );

const READ_TOOL = { name: "getAccounts", annotations: { readOnlyHint: true } };

function world(opts: { tools?: Row[]; assigned?: boolean; allowedTools?: string[] } = {}) {
  const tools = opts.tools ?? [READ_TOOL];
  let nextId = 1;
  const sources: Row[] = [];
  const snapshots: Row[] = [];
  const messages: Row[] = [];
  const bots: Row[] = [
    {
      id: "bot",
      spaceId: "sp",
      userId: "owner",
      name: "Finance helper",
      spawnKey: null,
      audience: "internal",
      archivedAt: null,
      disabledBuiltinTools: [],
    },
  ];
  const assignment = {
    botId: "bot",
    serverId: "srv",
    spaceId: "sp",
    userId: "owner",
    allowAllTools: opts.allowedTools === undefined,
    allowedTools: opts.allowedTools ?? [],
    server: {
      id: "srv",
      name: "Mercury",
      slug: "mercury",
      endpoint: "https://x.test/mcp",
      agentBotId: null,
    },
    bot: { spawnKey: null },
  };
  const prisma: Row = {
    bot: {
      findFirst: vi.fn(async ({ where }: Row) => bots.find((b) => matches(b, where)) ?? null),
    },
    botPage: {
      findFirst: vi.fn(async () => ({
        id: "page",
        botId: "bot",
        title: "Finance",
        content: "",
        revision: 1,
        updatedBy: "bot",
        updatedAt: new Date(),
      })),
      findMany: vi.fn(async () => []),
    },
    botMcpServer: {
      findFirst: vi.fn(async () => (opts.assigned === false ? null : assignment)),
      findMany: vi.fn(async () => (opts.assigned === false ? [] : [assignment])),
    },
    mcpServer: { findMany: vi.fn(async () => [{ id: "srv", name: "Mercury" }]) },
    run: {
      findFirst: vi.fn(async () => ({
        id: "run",
        spaceId: "sp",
        userId: "owner",
        botId: "bot",
        threadId: "t",
      })),
    },
    thread: { findFirst: vi.fn(async () => ({ id: "t" })) },
    message: {
      findFirst: vi.fn(async ({ where }: Row) => {
        const card = cards.find((c) => c.id === where.id);
        return card && where.threadId === "t" && where.runId === card.runId
          ? { id: card.id, botId: card.botId, blocks: card.blocks }
          : null;
      }),
      update: vi.fn(async ({ where, data }: Row) => {
        const card = cards.find((c) => c.id === where.id)!;
        card.blocks = data.blocks;
        return card;
      }),
    },
    pageSource: {
      findMany: vi.fn(async ({ where }: Row) => sources.filter((s) => matches(s, where))),
      findFirst: vi.fn(async ({ where }: Row) => sources.find((s) => matches(s, where)) ?? null),
      findFirstOrThrow: vi.fn(async ({ where }: Row) => sources.find((s) => matches(s, where))!),
      count: vi.fn(async () => sources.length),
      create: vi.fn(async ({ data }: Row) => {
        const row = { id: `src${nextId++}`, lastRefreshAt: null, updatedAt: new Date(), ...data };
        sources.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: Row) => {
        const row = sources.find((s) => s.id === where.id)!;
        Object.assign(row, data, { updatedAt: new Date(Date.now() + 1) });
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: Row) => {
        const hits = sources.filter((s) => matches(s, where));
        for (const row of hits) Object.assign(row, data, { updatedAt: new Date(Date.now() + 1) });
        return { count: hits.length };
      }),
    },
    pageSourceSnapshot: {
      create: vi.fn(async ({ data }: Row) => snapshots.push(data)),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const callServerTool = vi.fn(
    async (_s: unknown, _c: unknown, _t: string, _a: unknown, o?: Row) => {
      await o?.beforeCall?.();
      return { content: [{ type: "text", text: JSON.stringify({ accounts: [{ balance: 5 }] }) }] };
    },
  );
  const listServerTools = vi.fn(async () => tools);
  const deps = {
    prisma: prisma as unknown as PrismaClient,
    events: { append: vi.fn(async () => ({}) as never), notify: vi.fn(async () => undefined) },
    mcp: { callServerTool, listServerTools } as never,
  };
  const scope = { spaceId: "sp", botId: "bot", userId: "owner", runId: "run" };
  const set = (args: Row) => pageSourceToolFromTool("page_source_set", deps, scope, args);
  const mcpArgs = (over: Row = {}) => ({
    name: "Cash",
    kind: "mcp",
    server: "Mercury",
    tool: "getAccounts",
    args: { limit: 5 },
    schedule: "1h",
    ...over,
  });
  const answer = (answerText: string, userId = "owner", messageId = "m1") =>
    answerPageSourceApproval(
      deps,
      { spaceId: "sp", userId, threadId: "t" },
      {
        runId: "run",
        messageId,
        answer: answerText,
      },
    );
  return {
    prisma,
    sources,
    snapshots,
    deps,
    set,
    mcpArgs,
    answer,
    callServerTool,
    listServerTools,
    messages,
    bots,
  };
}

beforeEach(() => {
  cards.length = 0;
});

describe("page_source_set for an mcp source", () => {
  it("saves it pending, posts one card, and calls nothing", async () => {
    const w = world();
    const result = await w.set(w.mcpArgs());
    expect(result).toMatchObject({ status: "pending", note: "Waiting for the owner's approval" });
    expect(w.sources[0]).toMatchObject({ kind: "mcp", status: "pending", approvedCallHash: null });
    expect(w.callServerTool).not.toHaveBeenCalled();
    expect(cards).toHaveLength(1);
    expect(cards[0]?.blocks[0]).toMatchObject({
      kind: "ask",
      text: "Read Mercury every hour?",
      pageSource: { sourceId: "src1", callHash: pageSourceCallHash("mcp", w.sources[0]!.call) },
      actions: [
        { id: "allow", label: "Allow" },
        { id: "deny", label: "Not now" },
      ],
    });
  });

  it("is not affected by an allow rule or unattended mode: it is pending and never called", async () => {
    // Nothing in this path reads approval rules; an always-allow rule for the tool changes nothing.
    const w = world();
    (w.prisma as Row).toolApprovalRule = {
      findMany: vi.fn(async () => [{ tool: "getAccounts", decision: "always_allow" }]),
    };
    await w.set(w.mcpArgs());
    expect(w.sources[0]?.status).toBe("pending");
    expect(w.callServerTool).not.toHaveBeenCalled();
    expect((w.prisma as Row).toolApprovalRule.findMany).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a tool that writes",
      { tools: [{ name: "getAccounts", annotations: { destructiveHint: true } }] },
      /not read-only/,
    ],
    [
      "a tool named like a write",
      { tools: [{ name: "sendMoney", annotations: { readOnlyHint: true } }] },
      /not read-only/,
    ],
    ["a tool the server does not list", { tools: [] }, /not offered/],
    ["a server that is not assigned", { assigned: false }, /assigned/],
  ])("refuses and saves nothing for %s", async (_label, opts, message) => {
    const w = world(opts as never);
    const args = w.mcpArgs(_label === "a tool named like a write" ? { tool: "sendMoney" } : {});
    const result = await w.set(args);
    expect((result as { error: string }).error).toMatch(message);
    expect(w.sources).toHaveLength(0);
    expect(cards).toHaveLength(0);
  });

  it("returns an unknown server as an error", async () => {
    const w = world();
    const result = await w.set(w.mcpArgs({ server: "Elsewhere" }));
    expect((result as { error: string }).error).toMatch(/server must be/);
    expect(w.sources).toHaveLength(0);
  });

  it("keeps approval when only the schedule changes, and asks again when the call changes", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.answer("allow");
    expect(w.sources[0]?.status).toBe("active");
    await w.set(w.mcpArgs({ schedule: "1d" }));
    expect(w.sources[0]).toMatchObject({ status: "active", schedule: "1d" });
    expect(cards).toHaveLength(1);
    await w.set(w.mcpArgs({ args: { limit: 6 } }));
    expect(w.sources[0]).toMatchObject({ status: "pending", approvedCallHash: null });
    expect(cards).toHaveLength(2);
  });

  it("ignores key order when hashing the call", () => {
    const a = pageSourceCallHash("mcp", {
      serverId: "s",
      tool: "t",
      args: { a: 1, b: { c: 2, d: 3 } },
    });
    const b = pageSourceCallHash("mcp", {
      serverId: "s",
      tool: "t",
      args: { b: { d: 3, c: 2 }, a: 1 },
    });
    expect(a).toBe(b);
    expect(a).not.toBe(pageSourceCallHash("mcp", { serverId: "s", tool: "t", args: { a: 2 } }));
  });
});

describe("answering the card", () => {
  it("allow activates the source with the card's hash and the refresh then runs", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    const row = (await w.answer("allow")) as Row;
    expect(row).toMatchObject({ status: "active" });
    expect(row.approvedCallHash).toBe(pageSourceCallHash("mcp", row.call));
    expect(cards[0]?.blocks[0]).toMatchObject({ status: "answered", answer: "allow" });
    const outcome = await refreshPageSource(w.deps, row as never);
    expect(outcome.ok).toBe(true);
    expect(w.callServerTool).toHaveBeenCalledTimes(1);
    expect(w.snapshots).toHaveLength(1);
  });

  it("deny marks it denied and nothing is called", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    expect(await w.answer("deny")).toBe("denied");
    expect(w.sources[0]?.status).toBe("denied");
    expect(cards[0]?.blocks[0]).toMatchObject({ status: "answered", answer: "deny" });
    expect((await refreshPageSource(w.deps, w.sources[0] as never)).ok).toBe(false);
    expect(w.callServerTool).not.toHaveBeenCalled();
  });

  it("a stale card cannot approve a newer call", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.set(w.mcpArgs({ args: { limit: 99 } }));
    expect(await w.answer("allow", "owner", "m1")).toBeNull();
    expect(w.sources[0]).toMatchObject({ status: "pending", approvedCallHash: null });
    expect(cards[0]?.blocks[0]).toMatchObject({ status: "answered", answer: "superseded" });
    // The new card still works.
    expect(await w.answer("allow", "owner", "m2")).toMatchObject({ status: "active" });
  });

  it("a user who does not own the bot cannot answer", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    expect(await w.answer("allow", "someone-else")).toBeNull();
    expect(w.sources[0]?.status).toBe("pending");
  });

  it("a card for a source of another bot approves nothing", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    w.sources[0]!.botId = "other-bot";
    expect(await w.answer("allow")).toBeNull();
    expect(w.sources[0]?.status).toBe("pending");
  });

  it("answers once", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.answer("allow");
    expect(
      await findPageSourceApproval(
        w.deps.prisma,
        { spaceId: "sp", userId: "owner", threadId: "t" },
        { runId: "run", messageId: "m1" },
      ),
    ).toBeNull();
    expect(await w.answer("deny")).toBeNull();
    expect(w.sources[0]?.status).toBe("active");
  });
});

describe("refreshing an mcp source", () => {
  it("never calls a pending source", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    const outcome = await refreshPageSource(w.deps, w.sources[0] as never);
    expect(outcome).toMatchObject({ ok: false });
    expect(w.callServerTool).not.toHaveBeenCalled();
  });

  it("blocks an active source whose approved hash does not match its call", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.answer("allow");
    w.sources[0]!.call = { ...w.sources[0]!.call, args: { limit: 1000 } };
    const outcome = await refreshPageSource(w.deps, w.sources[0] as never);
    expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining("not approved") });
    expect(w.callServerTool).not.toHaveBeenCalled();
  });

  it("stops calling a tool that stops being read-only", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.answer("allow");
    w.listServerTools.mockResolvedValue([
      { name: "getAccounts", annotations: { readOnlyHint: false } },
    ]);
    const outcome = await refreshPageSource(w.deps, w.sources[0] as never);
    expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining("not read-only") });
    expect(w.callServerTool).not.toHaveBeenCalled();
  });

  it("refuses at call time if the call changed during session setup", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.answer("allow");
    w.callServerTool.mockImplementationOnce(async (_s, _c, _t, _a, o?: Row) => {
      w.sources[0]!.call = { ...w.sources[0]!.call, args: { limit: 7 } };
      await o?.beforeCall?.();
      return { content: [{ type: "text", text: "{}" }] };
    });
    const outcome = await refreshPageSource(w.deps, w.sources[0] as never);
    expect(outcome).toMatchObject({ ok: false });
    expect(w.snapshots).toHaveLength(0);
  });

  it("lists the server name for the dialog", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    const [source] = await listPageSources(w.deps.prisma, {
      spaceId: "sp",
      botId: "bot",
      pageId: "page",
    });
    expect(source).toMatchObject({ kind: "mcp", serverName: "Mercury", status: "pending" });
  });
});

describe("review fixes", () => {
  it("does not dispatch a call that changed while the tools were being listed", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.answer("allow");
    let listings = 0;
    w.listServerTools.mockImplementation(async () => {
      listings += 1;
      // The second listing is the one inside beforeCall.
      if (listings === 2) {
        w.sources[0]!.call = { ...w.sources[0]!.call, args: { limit: 8 } };
      }
      return [READ_TOOL];
    });
    const outcome = await refreshPageSource(w.deps, w.sources[0] as never);
    expect(outcome).toMatchObject({ ok: false, error: expect.stringContaining("not approved") });
    expect(w.snapshots).toHaveLength(0);
  });

  it("does not resume a paused source that a concurrent change replaced", async () => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.answer("allow");
    w.sources[0]!.status = "paused";
    const findMany = (w.prisma as Row).pageSource.findMany;
    const read = findMany.getMockImplementation()!;
    findMany.mockImplementationOnce(async (arg: Row) => {
      const rows = await read(arg);
      const seen = rows.map((r: Row) => ({ ...r }));
      // Another save lands after this one read the row.
      const row = w.sources[0]!;
      row.call = { ...row.call, args: { limit: 99 } };
      row.status = "pending";
      row.approvedCallHash = null;
      row.updatedAt = new Date(Date.now() + 5);
      return seen;
    });
    const result = await w.set(w.mcpArgs());
    expect(result).toEqual({ error: "The source changed; read it again." });
    expect(w.sources[0]).toMatchObject({ status: "pending", approvedCallHash: null });
  });

  it("refuses a request too long to show, and shows a long one in full", async () => {
    const w = world();
    const tooLong = await w.set(w.mcpArgs({ args: { q: "x".repeat(600) } }));
    expect(tooLong).toEqual({
      error: "The request is too long to show the owner; use fewer or shorter arguments.",
    });
    expect(w.sources).toHaveLength(0);
    const args = { q: "y".repeat(400) };
    await w.set(w.mcpArgs({ args }));
    const card = cards[0]?.blocks[0] as { detail: string } | undefined;
    expect(card?.detail).toContain(JSON.stringify(args));
  });

  it("posts the pause message in fixed words", async () => {
    const { postPauseMessage, PAUSE_MESSAGE } = await import("./page-source-tick.js");
    const sendUserMessage = vi.fn(async () => ({}));
    await postPauseMessage(
      {
        prisma: { thread: { findFirst: vi.fn(async () => ({ id: "t" })) } },
        events: { sendUserMessage },
        jobs: { enqueue: vi.fn() },
      } as never,
      { spaceId: "sp", userId: "owner", botId: "bot" },
    );
    expect(sendUserMessage).toHaveBeenCalledTimes(1);
    expect(sendUserMessage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: PAUSE_MESSAGE, trigger: "user" }),
    );
  });
});

describe("refreshPageSources", () => {
  const failing = async (failures: number) => {
    const w = world();
    await w.set(w.mcpArgs());
    await w.answer("allow");
    w.sources[0]!.failures = failures;
    w.callServerTool.mockRejectedValue(new Error("boom"));
    return refreshPageSources(w.deps, { spaceId: "sp", botId: "bot", pageId: "page" });
  };

  it("reports that this refresh paused a source after repeated failures", async () => {
    expect(await failing(4)).toEqual({ paused: true });
  });

  it("reports nothing paused while failures stay under the limit", async () => {
    expect(await failing(0)).toEqual({ paused: false });
  });
});
