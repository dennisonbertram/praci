import { describe, expect, it, vi } from "vitest";
import {
  activityNotificationsEnabled,
  activityPromptSnippet,
  listPendingApprovalNotifications,
  listSpaceRuns,
  pendingAskIsApproval,
  pendingAskSnippet,
} from "./runs.js";

it("adds scoped reply ids and sanitized failure context to recent activity", async () => {
  const actor = { spaceId: "space-1", userId: "user-1" } as never;
  const scan = [
    { id: "failed", trigger: "user", status: "failed" },
    { id: "completed", trigger: "user", status: "completed" },
  ];
  const row = (id: string, status: string, error: string | null) => ({
    id,
    botId: "bot-1",
    threadId: "thread-1",
    status,
    trigger: "user",
    error,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    completedAt: new Date("2026-01-01T00:00:00.000Z"),
    bot: { name: "Ada", notifyOnFinish: true },
    routine: null,
    task: { prompt: "Do the work" },
    sourceMessage: null,
    thread: { groupId: null, group: null },
  });
  const messageFindMany = vi.fn(async () => []);
  const prisma = {
    run: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(scan)
        .mockResolvedValueOnce([
          row("failed", "failed", "provider detail"),
          row("completed", "completed", null),
        ]),
    },
    message: { findMany: messageFindMany },
    $queryRaw: vi.fn(async () => [{ id: "reply-1", runId: "failed" }]),
  } as never;

  const runs = await listSpaceRuns(prisma, actor, "recent");
  expect(runs.find((run) => run.runId === "failed")).toMatchObject({
    error: "provider detail",
    messageId: "reply-1",
  });
  expect(runs.find((run) => run.runId === "completed")).toMatchObject({
    error: null,
    messageId: null,
  });
});

describe("run activity copy", () => {
  it("presents structured agent messages instead of their internal wake prompt", () => {
    expect(
      activityPromptSnippet({
        trigger: "bot_message",
        prompt: "[bot] A message just arrived from another bot with internal routing data",
        sourceBlocks: [
          {
            kind: "bot_message_received",
            fromBotId: "maya",
            fromBotName: "Maya",
            text: "Please check the release workflow.",
            intent: "request",
          },
        ],
      }),
    ).toBe("Maya asked: Please check the release workflow.");
  });

  it("strips markdown from an agent message", () => {
    const snippet = activityPromptSnippet({
      trigger: "bot_message",
      prompt: "x",
      sourceBlocks: [
        {
          kind: "bot_message_received",
          fromBotId: "maya",
          fromBotName: "Maya",
          text: "## Summary\n**Northwind** renewed: see [the file](https://example.com/a).",
          intent: "result",
        },
      ],
    });
    expect(snippet).toBe("Update from Maya: Summary Northwind renewed: see the file.");
    expect(snippet).not.toMatch(/[*#]/);
  });

  it("fails closed when an agent message has no valid structured source", () => {
    expect(
      activityPromptSnippet({
        trigger: "bot_message",
        prompt: "[bot] private internal routing envelope",
        sourceBlocks: [{ kind: "text", text: "not a peer message" }],
      }),
    ).toBe("Message from another agent");
  });
});

describe("listSpaceRuns archived groups", () => {
  it.each(["active", "recent"] as const)("hides runs of archived groups in %s", async (filter) => {
    const actor = { spaceId: "space-1", userId: "user-1" } as never;
    const findMany = vi.fn(async () => []);
    const prisma = { run: { findMany }, message: { findMany: vi.fn(async () => []) } } as never;

    await listSpaceRuns(prisma, actor, filter);

    expect(findMany).toHaveBeenCalled();
    for (const [args] of findMany.mock.calls as unknown as Array<[{ where: object }]>) {
      expect(args.where).toMatchObject({
        thread: { OR: [{ groupId: null }, { group: { archivedAt: null } }] },
      });
    }
  });
});

it("never shows a new bot's internal introduction prompt", () => {
  expect(
    activityPromptSnippet({
      trigger: "created",
      prompt: "You were just created. In one reply, say what you understood your role to be",
    }),
  ).toBe("Introduced itself");
});

describe("run activity notification preference", () => {
  it("silences only direct messages", () => {
    expect(activityNotificationsEnabled(null, false)).toBe(false);
    expect(activityNotificationsEnabled("group-1", false)).toBe(true);
  });
});

it("previews the pending question on a held run and skips answered cards", () => {
  const ask = (text: string, status?: "pending" | "answered") => ({
    blocks: [{ kind: "ask", text, status }],
  });
  expect(pendingAskSnippet([ask("Old one", "answered"), ask("Send $1,200 to Acme?")])).toBe(
    "Send $1,200 to Acme?",
  );
  expect(pendingAskSnippet([ask("Done", "answered")])).toBeUndefined();
  expect(pendingAskSnippet([{ blocks: [{ kind: "text", text: "hi" }] }])).toBeUndefined();
});

it("tells a pending approval card from a pending question", () => {
  const card = (extra: object, status?: "answered") => ({
    blocks: [{ kind: "ask", text: "Send $250?", status, ...extra }],
  });
  expect(pendingAskIsApproval([card({ approvalEffectId: "effect-1" })])).toBe(true);
  expect(pendingAskIsApproval([card({})])).toBe(false);
  expect(pendingAskIsApproval([card({ approvalEffectId: "effect-1" }, "answered")])).toBe(false);
});

describe("listPendingApprovalNotifications", () => {
  const actor = { spaceId: "s", userId: "u" } as never;
  const fake = (
    runs: unknown[],
    messages: unknown[],
    notifications: unknown[] = [{ id: "n1", runId: "r1" }],
  ) => {
    const notificationFind = vi.fn(async () => notifications);
    const runFind = vi.fn(async () => runs);
    const prisma = {
      run: { findMany: runFind },
      message: { findMany: vi.fn(async () => messages) },
      notification: { findMany: notificationFind },
    } as never;
    return { prisma, runFind, notificationFind };
  };

  it("looks only at held runs of existing agents, however old the notification", async () => {
    const { prisma, runFind, notificationFind } = fake(
      [{ id: "r1", threadId: "t1" }],
      [
        {
          runId: "r1",
          blocks: [{ kind: "ask", text: "Send?", status: "pending", approvalEffectId: "e1" }],
        },
      ],
    );
    await listPendingApprovalNotifications(prisma, actor);
    expect(runFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "waiting_input", bot: { archivedAt: null } }),
      }),
    );
    const where = (
      notificationFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({ runId: { in: ["r1"] } });
    expect(where).not.toHaveProperty("seenAt");
    expect(where).toMatchObject({ dismissedAt: null });
    expect(where).not.toHaveProperty("createdAt");
  });

  it("matches by run, so a stale approval from another agent in the same group thread stays out", async () => {
    const { prisma, notificationFind } = fake(
      [
        { id: "r1", threadId: "g" },
        { id: "r2", threadId: "g" },
      ],
      [
        { runId: "r1", blocks: [{ kind: "ask", text: "Send?", status: "answered" }] },
        {
          runId: "r2",
          blocks: [{ kind: "ask", text: "Pay?", status: "pending", approvalEffectId: "e2" }],
        },
      ],
    );
    await listPendingApprovalNotifications(prisma, actor);
    const call = notificationFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }];
    expect(call[0].where).toMatchObject({ runId: { in: ["r2"] } });
    expect(call[0].where).not.toHaveProperty("threadId");
  });

  it("returns nothing when the card was answered", async () => {
    const { prisma, notificationFind } = fake(
      [{ id: "r1", threadId: "t1" }],
      [{ runId: "r1", blocks: [{ kind: "ask", text: "Send?", status: "answered" }] }],
    );
    expect(await listPendingApprovalNotifications(prisma, actor)).toEqual([]);
    expect(notificationFind).not.toHaveBeenCalled();
  });

  const approval = (runId: string, status?: "answered") => ({
    runId,
    blocks: [{ kind: "ask", text: "Send?", status, approvalEffectId: `e-${runId}` }],
  });

  it("counts one approval per held run, however many it asked before", async () => {
    // The mock returns notifications newest first, as the query orders them.
    const { prisma } = fake(
      [
        { id: "r1", threadId: "t1" },
        { id: "r2", threadId: "t2" },
      ],
      [approval("r1"), approval("r2")],
      [
        { id: "n5", runId: "r1" },
        { id: "n4", runId: "r2" },
        { id: "n3", runId: "r1" },
        { id: "n2", runId: "r1" },
        { id: "n1", runId: "r2" },
      ],
    );
    const result = await listPendingApprovalNotifications(prisma, actor);
    expect(result.map((n) => n.id)).toEqual(["n4", "n5"]);
  });

  it("drops a run whose pending card is a question, not an approval", async () => {
    const { prisma, notificationFind } = fake(
      [{ id: "r1", threadId: "t1" }],
      [{ runId: "r1", blocks: [{ kind: "ask", text: "Which one?", status: "pending" }] }],
    );
    expect(await listPendingApprovalNotifications(prisma, actor)).toEqual([]);
    expect(notificationFind).not.toHaveBeenCalled();
  });

  it("drops an approval whose card was answered", async () => {
    const { prisma } = fake([{ id: "r1", threadId: "t1" }], [approval("r1", "answered")]);
    expect(await listPendingApprovalNotifications(prisma, actor)).toEqual([]);
  });
});

describe("listSpaceRuns queries", () => {
  const actor = { spaceId: "space-1", userId: "user-1" } as never;
  const at = new Date("2026-01-01T00:00:00.000Z");
  const row = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    botId: "bot-1",
    threadId: "thread-1",
    status: "completed",
    trigger: "user",
    error: null,
    updatedAt: at,
    completedAt: at,
    bot: { name: "Ada", notifyOnFinish: true },
    routine: null,
    task: { prompt: "Do the work" },
    sourceMessage: null,
    thread: { groupId: null, group: null },
    ...over,
  });
  const fake = (scan: unknown[] | null, found: unknown[], messages: unknown[] = []) => {
    const runFind = vi.fn();
    if (scan) runFind.mockResolvedValueOnce(scan);
    runFind.mockResolvedValueOnce(found);
    const messageFind = vi.fn(async () => messages);
    const prisma = {
      run: { findMany: runFind },
      message: { findMany: messageFind },
      $queryRaw: vi.fn(async () => []),
    } as never;
    return { prisma, runFind, messageFind };
  };
  const arg = (mock: ReturnType<typeof vi.fn>, call: number) =>
    mock.mock.calls[call]?.[0] as {
      where: Record<string, unknown>;
      orderBy: unknown[];
    };

  it("orders recent runs by completion with unfinished rows last, in both queries", async () => {
    const { prisma, runFind } = fake(
      [{ id: "a", trigger: "user", status: "completed" }],
      [row("a")],
    );
    await listSpaceRuns(prisma, actor, "recent");
    const first = { completedAt: { sort: "desc", nulls: "last" } };
    expect(arg(runFind, 0).orderBy).toEqual([first, { updatedAt: "desc" }, { id: "desc" }]);
    expect(arg(runFind, 1).orderBy).toEqual(arg(runFind, 0).orderBy);
  });

  it("scopes held-run messages to the space and user", async () => {
    const { prisma, messageFind } = fake(
      [{ id: "h", trigger: "user", status: "completed" }],
      [row("h", { status: "waiting_input" })],
    );
    await listSpaceRuns(prisma, actor, "recent");
    const call = messageFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }];
    expect(call[0].where.thread).toEqual({ spaceId: "space-1", userId: "user-1" });
  });

  it("scopes pending-approval messages to the space and user", async () => {
    const messageFind = vi.fn(async () => []);
    const prisma = {
      run: { findMany: vi.fn(async () => [{ id: "r1", threadId: "t1" }]) },
      message: { findMany: messageFind },
    } as never;
    await listPendingApprovalNotifications(prisma, actor);
    const call = messageFind.mock.calls[0] as unknown as [{ where: Record<string, unknown> }];
    expect(call[0].where.thread).toEqual({ spaceId: "space-1", userId: "user-1" });
  });

  it("caps quiet routine runs at 5 and marks them silent", async () => {
    const quiet = (i: number) => ({ id: `q${i}`, trigger: "routine", status: "completed" });
    const normal = (i: number) => ({ id: `n${i}`, trigger: "user", status: "completed" });
    const scan = [...Array.from({ length: 7 }, (_, i) => quiet(i)), ...[0, 1, 2].map(normal)];
    const { prisma, runFind } = fake(
      scan,
      scan.map((s) => row(s.id, { trigger: s.trigger })),
    );
    const result = await listSpaceRuns(prisma, actor, "recent");
    expect(arg(runFind, 1).where).toMatchObject({
      id: { in: ["q0", "q1", "q2", "q3", "q4", "n0", "n1", "n2"] },
    });
    expect(result.filter((r) => r.silent === true).map((r) => r.runId)).toEqual([
      "q0",
      "q1",
      "q2",
      "q3",
      "q4",
    ]);
    expect(result.filter((r) => r.silent === undefined)).toHaveLength(3);
  });

  it("does not treat a routine run that replied as quiet", async () => {
    const scan = [{ id: "r1", trigger: "routine", status: "completed" }];
    const { prisma } = fake(scan, [row("r1", { trigger: "routine" })], [{ runId: "r1" }]);
    const [only] = await listSpaceRuns(prisma, actor, "recent");
    expect(only?.silent).toBeUndefined();
  });

  it("caps other finished runs at 20", async () => {
    const scan = Array.from({ length: 25 }, (_, i) => ({
      id: `n${i}`,
      trigger: "user",
      status: "completed",
    }));
    const { prisma, runFind } = fake(scan, []);
    await listSpaceRuns(prisma, actor, "recent");
    const ids = (arg(runFind, 1).where.id as { in: string[] }).in;
    expect(ids).toEqual(scan.slice(0, 20).map((s) => s.id));
  });

  it("lists active runs with one query and no scan", async () => {
    const { prisma, runFind } = fake(null, [row("a", { status: "running" })]);
    await listSpaceRuns(prisma, actor, "active");
    expect(runFind).toHaveBeenCalledTimes(1);
    const call = arg(runFind, 0);
    expect(call.where).toMatchObject({
      spaceId: "space-1",
      userId: "user-1",
      bot: { archivedAt: null },
      trigger: { notIn: expect.any(Array) },
      status: { in: expect.arrayContaining(["running"]) },
    });
    expect(call.where).not.toHaveProperty("id");
    expect(call.orderBy).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
  });

  it("flags a held approval and previews it; a plain question is not an approval", async () => {
    const held = (id: string) => row(id, { status: "waiting_input" });
    const { prisma } = fake(
      null,
      [held("approve"), held("ask")],
      [
        {
          runId: "approve",
          blocks: [{ kind: "ask", text: "Send $5?", status: "pending", approvalEffectId: "e1" }],
        },
        { runId: "ask", blocks: [{ kind: "ask", text: "Which one?", status: "pending" }] },
      ],
    );
    const result = await listSpaceRuns(prisma, actor, "active");
    expect(result.find((r) => r.runId === "approve")).toMatchObject({
      needsApproval: true,
      promptSnippet: "Send $5?",
    });
    expect(result.find((r) => r.runId === "ask")).toMatchObject({
      needsApproval: false,
      promptSnippet: "Which one?",
    });
  });

  it("shows the routine name instead of the prompt, unless the name is blank", async () => {
    const { prisma } = fake(null, [
      row("named", { trigger: "routine", routine: { name: "Weekly digest" } }),
      row("blank", { trigger: "routine", routine: { name: "  " } }),
    ]);
    const result = await listSpaceRuns(prisma, actor, "active");
    expect(result.find((r) => r.runId === "named")?.promptSnippet).toBe("Weekly digest");
    expect(result.find((r) => r.runId === "blank")?.promptSnippet).toBe("Do the work");
  });
});
