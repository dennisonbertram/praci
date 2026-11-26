import type { SandboxProvider } from "@rakazo/adapter-kit";
import type { Actor, MessageBlock } from "@rakazo/contracts";
import { callClientNonce } from "@rakazo/core";
import type * as MessageQuoteModule from "@rakazo/core/message-quote";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { fakeRunUpdateManyAndReturn } from "./test-support/cancel-runs.js";
import type { ThreadTarget } from "./thread-target.js";
import {
  cancelSupersededQueuedRuns,
  reactToThreadMessage,
  sendThreadMessage,
  stopThreadRuns,
  threadHead,
  threadSnapshot,
} from "./thread-target.js";

// Passthrough mock: every hint derives for real except the sentinel that
// exercises the "derivation must never cost the send" path.
vi.mock("@rakazo/core/message-quote", async (importOriginal) => {
  const actual = await importOriginal<typeof MessageQuoteModule>();
  return {
    ...actual,
    deriveMessageQuote: (
      blocks: MessageBlock[],
      hint: string,
      format: "markdown" | "plain-text",
    ) => {
      if (hint === "explode derivation") throw new Error("derivation blew up");
      return actual.deriveMessageQuote(blocks, hint, format);
    },
  };
});

describe("threadHead", () => {
  it("returns the durable cursor without loading a snapshot", async () => {
    const findFirst = vi.fn().mockResolvedValue({ seq: 12 });
    const prisma = { event: { findFirst } } as unknown as PrismaClient;
    const target = { threadId: "thread-1" } as ThreadTarget;

    await expect(threadHead(prisma, target)).resolves.toEqual({
      threadId: "thread-1",
      cursor: 12,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { threadId: "thread-1" },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
  });
});

describe("queued run supersession", () => {
  it("only cancels queued runs started by user messages or reactions", async () => {
    const tx = {
      externalEffect: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
      },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "run-old", taskId: "task-old", userId: "user-1", spaceId: "space-1" },
          ]),
        updateMany: vi.fn(),
      },
      secret: { deleteMany: vi.fn() },
      task: { updateMany: vi.fn() },
    };
    await cancelSupersededQueuedRuns(tx as never, {
      threadId: "thread-1",
      botIds: ["bot-1"],
      keepRunIds: ["run-new"],
    });
    expect(tx.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ trigger: "user", sourceMessage: { role: "user" } }, { trigger: "reaction" }],
        }),
      }),
    );
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["run-old"] } } }),
    );
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["task-old"] } },
      data: { status: "cancelled" },
    });
    // A superseded run never reads a waiting one-time answer.
    expect(tx.secret.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: "user-1", spaceId: "space-1", kind: "run-secret:run-old" }] },
    });
  });
});

describe("reaction messages", () => {
  it("appends repeated reactions as quiet replies and deduplicates retries", async () => {
    const messages = new Map<string, { id: string }>();
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      message: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({ id: "parent" }),
        findUnique: vi.fn(
          async ({ where }: { where: { threadId_clientNonce: { clientNonce: string } } }) =>
            messages.get(where.threadId_clientNonce.clientNonce) ?? null,
        ),
        create: vi.fn(async ({ data }: { data: { clientNonce: string } }) => {
          const message = { id: `reaction-${messages.size}`, ...data };
          messages.set(data.clientNonce, message);
          return message;
        }),
      },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      event: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: `event-${eventSeq}`,
          createdAt: new Date(),
          ...data,
        })),
      },
      task: { create: vi.fn() },
      run: { create: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "space-1", userId: "user-1" } as Actor;
    const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;
    for (const [clientNonce, reaction] of [
      ["first", "❤️"],
      ["second", "👍"],
      ["third", "❤️"],
      ["third", "❤️"],
    ] as const) {
      await reactToThreadMessage({ prisma }, actor, target, {
        messageId: "parent",
        reaction,
        clientNonce,
      });
    }
    expect(tx.message.create).toHaveBeenCalledTimes(3);
    expect(tx.event.create).toHaveBeenCalledTimes(3);
    expect(tx.message.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        role: "user",
        blocks: [{ kind: "text", text: "❤️" }],
        replyToMessageId: "parent",
        clientNonce: "third",
      }),
    });
    expect(tx.event.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        type: "thread.message.created",
        payload: {
          messageId: "reaction-2",
          role: "user",
          blocks: [{ kind: "text", text: "❤️" }],
          replyToMessageId: "parent",
        },
      }),
    });
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(tx.message.findFirst).toHaveBeenCalledWith({
      where: { id: "parent", threadId: "thread-1" },
      select: { id: true },
    });
    tx.message.findFirst.mockResolvedValueOnce(null);
    await expect(
      reactToThreadMessage({ prisma }, actor, target, {
        messageId: "elsewhere",
        reaction: "❤️",
        clientNonce: "fourth",
      }),
    ).rejects.toThrow();
    expect(tx.message.create).toHaveBeenCalledTimes(3);
  });
});

describe("reactToThreadMessage lock order", () => {
  it("locks the group, without blocking key checks, before the thread", async () => {
    const locks: string[] = [];
    const tx = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        locks.push(strings.join("?").replace(/\s+/g, " ").trim());
        return [{ id: "locked" }];
      }),
      message: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "space-1", userId: "user-1" } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      threadId: "thread-1",
      memberBotIds: ["bot-1"],
    } as ThreadTarget;

    await expect(
      reactToThreadMessage({ prisma }, actor, target, {
        messageId: "parent",
        reaction: "❤️",
        clientNonce: "n",
      }),
    ).rejects.toThrow();
    expect(locks).toHaveLength(2);
    expect(locks[0]).toContain("chat_groups");
    expect(locks[0]).toContain("FOR NO KEY UPDATE");
    expect(locks[1]).toContain("threads");
  });
});

describe("threadSnapshot", () => {
  it("reloads tool-only live messages for an active run", async () => {
    const run = {
      id: "run-1",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-1",
      status: "running",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const findManyEvents = vi.fn().mockResolvedValue([
      {
        id: "event-1",
        threadId: "thread-1",
        botId: "bot-1",
        seq: 4,
        type: "agent.tool.called",
        runId: "run-1",
        payload: { name: "SLACK_FIND_CHANNELS" },
        createdAt: new Date("2026-08-23T00:00:00.000Z"),
      },
    ]);
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: { findMany: vi.fn().mockResolvedValue([]) },
      event: {
        findFirst: vi.fn().mockResolvedValue({ seq: 4 }),
        findMany: findManyEvents,
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: botRunFindFirst([run]) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      run: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;

    const snapshot = await threadSnapshot({ prisma }, target);

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(findManyEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: {
            in: [
              "thread.progress",
              "thread.subagent",
              "run.waiting_input",
              "computer.takeover.requested",
              "agent.tool.called",
              "agent.tool.completed",
            ],
          },
        }),
      }),
    );
    expect(snapshot.messages).toEqual([
      expect.objectContaining({
        id: "progress:run-1",
        botId: "bot-1",
        blocks: [
          {
            kind: "steps",
            steps: [{ label: "Slack find channels", count: 1 }],
          },
        ],
      }),
    ]);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 15_000,
      maxWait: 5_000,
    });
  });

  it("returns the latest failed run so the client can show its error", async () => {
    const run = {
      id: "run-failed",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-1",
      status: "failed",
      trigger: "user",
      modelProvider: "openrouter",
      modelId: "openrouter/unknown",
      error: "Provider is not configured: openrouter",
      startedAt: null,
      completedAt: new Date("2026-08-23T00:00:01.000Z"),
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const findManyEvents = vi.fn();
    const findFirstRun = botRunFindFirst([run]);
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: { findMany: vi.fn().mockResolvedValue([]) },
      event: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: findManyEvents,
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: findFirstRun },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      run: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;

    const snapshot = await threadSnapshot({ prisma }, target);

    expect(findFirstRun).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          botId: "bot-1",
          threadId: "thread-1",
          trigger: { notIn: ["bot_message", "tickets"] },
          status: {
            in: ["queued", "leased", "running", "waiting_input", "waiting_takeover", "failed"],
          },
        }),
      }),
    );
    expect(findFirstRun).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          botId: "bot-1",
          threadId: "thread-1",
          status: { in: ["waiting_input", "waiting_takeover"] },
        },
      }),
    );
    expect(snapshot.run).toEqual(
      expect.objectContaining({
        id: "run-failed",
        status: "failed",
        error: "Provider is not configured: openrouter",
      }),
    );
    expect(findManyEvents).not.toHaveBeenCalled();
  });

  it("prefers a waiting peer ask over a concurrent user run", async () => {
    const waitingPeer = {
      id: "run-peer-waiting",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-peer",
      status: "waiting_input",
      trigger: "bot_message",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:02.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:02.000Z"),
    };
    const olderUser = {
      id: "run-user",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-user",
      status: "running",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:01.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:01.000Z"),
    };
    const snapshot = await threadSnapshot(
      {
        prisma: {
          $transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
            callback({
              $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
              message: { findMany: vi.fn().mockResolvedValue([]) },
              event: {
                findFirst: vi.fn().mockResolvedValue(null),
                findMany: vi.fn().mockResolvedValue([]),
              },
              threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
              run: { findFirst: botRunFindFirst([waitingPeer, olderUser]) },
            }),
          ),
          run: { findMany: vi.fn().mockResolvedValue([]) },
        } as unknown as PrismaClient,
      },
      {
        kind: "bot",
        botId: "bot-1",
        threadId: "thread-1",
        bot: { computer: null },
      } as ThreadTarget,
    );

    expect(snapshot.run).toEqual(
      expect.objectContaining({ id: "run-peer-waiting", status: "waiting_input" }),
    );
  });

  it.each(["waiting_input", "running"])(
    "only exposes ticket runs waiting for input (%s)",
    async (status) => {
      const waitingTicket = {
        id: "run-ticket-waiting",
        botId: "bot-1",
        threadId: "thread-1",
        taskId: "task-ticket",
        status,
        trigger: "tickets",
        modelProvider: null,
        modelId: null,
        error: null,
        startedAt: new Date("2026-08-23T00:00:02.000Z"),
        completedAt: null,
        createdAt: new Date("2026-08-23T00:00:02.000Z"),
      };
      const snapshot = await threadSnapshot(
        {
          prisma: {
            $transaction: vi.fn(async (callback: (client: unknown) => unknown) =>
              callback({
                $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
                message: { findMany: vi.fn().mockResolvedValue([]) },
                event: {
                  findFirst: vi.fn().mockResolvedValue(null),
                  findMany: vi.fn().mockResolvedValue([]),
                },
                threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
                run: { findFirst: botRunFindFirst([waitingTicket]) },
              }),
            ),
            run: { findMany: vi.fn().mockResolvedValue([]) },
          } as unknown as PrismaClient,
        },
        {
          kind: "bot",
          botId: "bot-1",
          threadId: "thread-1",
          bot: { computer: null },
        } as ThreadTarget,
      );

      if (status === "waiting_input") {
        expect(snapshot.run).toEqual(expect.objectContaining({ id: "run-ticket-waiting", status }));
      } else {
        expect(snapshot.run).toBeNull();
      }
    },
  );

  it("drops a failed run once a newer run has finished", async () => {
    const failed = {
      id: "run-failed",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-1",
      status: "failed",
      trigger: "user",
      modelProvider: "openrouter",
      modelId: "openrouter/unknown",
      error: "This operation was aborted",
      startedAt: null,
      completedAt: new Date("2026-08-23T00:00:01.000Z"),
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const completed = {
      id: "run-completed",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-2",
      status: "completed",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: null,
      completedAt: new Date("2026-08-23T00:00:03.000Z"),
      createdAt: new Date("2026-08-23T00:00:02.000Z"),
    };
    const findFirstRun = botRunFindFirst([failed, completed]);
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: { findMany: vi.fn().mockResolvedValue([]) },
      event: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn(),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: findFirstRun },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      run: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;

    const snapshot = await threadSnapshot({ prisma }, target);

    expect(findFirstRun).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trigger: { notIn: ["bot_message", "tickets"] },
          status: { in: ["failed", "completed", "cancelled"] },
        }),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(snapshot.run).toBeNull();
  });

  it("does not return a cancelled or completed run", async () => {
    const findManyEvents = vi.fn();
    const findFirstRun = botRunFindFirst([]);
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: { findMany: vi.fn().mockResolvedValue([]) },
      event: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: findManyEvents,
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: findFirstRun },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      run: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;

    const snapshot = await threadSnapshot({ prisma }, target);

    expect(findFirstRun).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ["queued", "leased", "running", "waiting_input", "waiting_takeover", "failed"],
          },
        }),
      }),
    );
    expect(snapshot.run).toBeNull();
    expect(findManyEvents).not.toHaveBeenCalled();
  });
  it("returns a group's latest failed run so a refresh keeps its error", async () => {
    const run = {
      id: "run-failed",
      botId: "bot-2",
      threadId: "thread-1",
      taskId: "task-1",
      status: "failed",
      trigger: "user",
      modelProvider: "openrouter",
      modelId: "openrouter/unknown",
      error: "member exploded",
      startedAt: null,
      completedAt: new Date("2026-08-23T00:00:01.000Z"),
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const findManyRuns = groupRunFindMany({ terminals: [run] });
    const prisma = groupPrisma(findManyRuns);
    const snapshot = await threadSnapshot({ prisma }, groupTarget());

    expect(findManyRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          threadId: "thread-1",
          trigger: { notIn: ["bot_message", "tickets"] },
          status: { in: ["failed", "completed", "cancelled"] },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 50,
      }),
    );
    expect(findManyRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          threadId: "thread-1",
          status: { in: ["queued", "leased", "running", "waiting_input", "waiting_takeover"] },
          OR: [
            { trigger: { notIn: ["bot_message", "tickets"] } },
            { status: { in: ["waiting_input", "waiting_takeover"] } },
          ],
        },
      }),
    );
    expect(snapshot.run).toEqual(
      expect.objectContaining({ id: "run-failed", status: "failed", error: "member exploded" }),
    );
    expect(snapshot.activeRuns).toEqual([]);
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 15_000,
      maxWait: 5_000,
    });
  });

  it("omits peer bot_message runs from group activeRuns and displayed terminal run", async () => {
    const peerActive = {
      id: "run-peer-active",
      botId: "bot-a",
      threadId: "thread-1",
      taskId: "task-peer",
      status: "running",
      trigger: "bot_message",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:05.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:05.000Z"),
    };
    const peerFailed = {
      id: "run-peer-failed",
      botId: "bot-b",
      threadId: "thread-1",
      taskId: "task-peer-fail",
      status: "failed",
      trigger: "bot_message",
      modelProvider: null,
      modelId: null,
      error: "peer exploded",
      startedAt: new Date("2026-08-23T00:00:01.000Z"),
      completedAt: new Date("2026-08-23T00:00:02.000Z"),
      createdAt: new Date("2026-08-23T00:00:01.000Z"),
    };
    const findManyRuns = groupRunFindMany({
      active: [peerActive],
      terminals: [peerFailed],
    });
    const snapshot = await threadSnapshot({ prisma: groupPrisma(findManyRuns) }, groupTarget());

    expect(snapshot.activeRuns).toEqual([]);
    expect(snapshot.run).toBeNull();
    expect(findManyRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { trigger: { notIn: ["bot_message", "tickets"] } },
            { status: { in: ["waiting_input", "waiting_takeover"] } },
          ],
          status: { in: ["queued", "leased", "running", "waiting_input", "waiting_takeover"] },
        }),
      }),
    );
    expect(findManyRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trigger: { notIn: ["bot_message", "tickets"] },
          status: { in: ["failed", "completed", "cancelled"] },
        }),
      }),
    );
  });

  it("includes waiting peer bot_message runs in group activeRuns", async () => {
    const peerWaiting = {
      id: "run-peer-waiting",
      botId: "bot-a",
      threadId: "thread-1",
      taskId: "task-peer",
      status: "waiting_input",
      trigger: "bot_message",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:05.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:05.000Z"),
    };
    const findManyRuns = groupRunFindMany({ active: [peerWaiting] });
    const snapshot = await threadSnapshot({ prisma: groupPrisma(findManyRuns) }, groupTarget());

    expect(snapshot.activeRuns).toEqual([
      expect.objectContaining({ id: "run-peer-waiting", status: "waiting_input" }),
    ]);
  });

  it("keeps a waiting peer ask as the primary run even when a newer busy run exists", async () => {
    // Real DB order is createdAt desc, so the newer busy run for bot-b comes
    // first here, ahead of the older waiting peer run for bot-a.
    const newerBusy = {
      id: "run-newer-busy",
      botId: "bot-b",
      threadId: "thread-1",
      taskId: "task-busy",
      status: "running",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:10.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:10.000Z"),
    };
    const olderWaiting = {
      id: "run-older-waiting",
      botId: "bot-a",
      threadId: "thread-1",
      taskId: "task-peer",
      status: "waiting_input",
      trigger: "bot_message",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:05.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:05.000Z"),
    };
    const findManyRuns = groupRunFindMany({ active: [newerBusy, olderWaiting] });
    const snapshot = await threadSnapshot({ prisma: groupPrisma(findManyRuns) }, groupTarget());

    expect(snapshot.run).toEqual(expect.objectContaining({ id: "run-older-waiting" }));
    // activeRuns is unaffected by which one is chosen as primary.
    expect(snapshot.activeRuns.map((run) => run.id)).toEqual([
      "run-newer-busy",
      "run-older-waiting",
    ]);
  });

  it("does not revive an older group failure after a newer run completed", async () => {
    const failed = {
      id: "run-old-failed",
      botId: "bot-2",
      threadId: "thread-1",
      taskId: "task-1",
      status: "failed",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: "old failure",
      startedAt: null,
      completedAt: new Date("2026-08-23T00:00:01.000Z"),
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const completed = {
      id: "run-newer-completed",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-2",
      status: "completed",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:02.000Z"),
      completedAt: new Date("2026-08-23T00:00:04.000Z"),
      createdAt: new Date("2026-08-23T00:00:02.000Z"),
    };
    const snapshot = await threadSnapshot(
      { prisma: groupPrisma(groupRunFindMany({ terminals: [completed, failed] })) },
      groupTarget(),
    );

    expect(snapshot.run).toBeNull();
    expect(snapshot.activeRuns).toEqual([]);
  });

  it("does not revive a failure when a newer cancelled run has null completedAt", async () => {
    const failed = {
      id: "run-old-failed",
      botId: "bot-2",
      threadId: "thread-1",
      taskId: "task-1",
      status: "failed",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: "old failure",
      startedAt: null,
      completedAt: new Date("2026-08-23T00:00:01.000Z"),
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const cancelled = {
      id: "run-newer-cancelled",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-2",
      status: "cancelled",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:02.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:03.000Z"),
    };
    const snapshot = await threadSnapshot(
      { prisma: groupPrisma(groupRunFindMany({ terminals: [cancelled, failed] })) },
      groupTarget(),
    );

    expect(snapshot.run).toBeNull();
  });

  it("prefers a timestamped terminal over an older failure with null completedAt", async () => {
    const failed = {
      id: "run-old-failed",
      botId: "bot-2",
      threadId: "thread-1",
      taskId: "task-1",
      status: "failed",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: "old failure",
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const completed = {
      id: "run-completed",
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task-2",
      status: "completed",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:02.000Z"),
      completedAt: new Date("2026-08-23T00:00:04.000Z"),
      createdAt: new Date("2026-08-23T00:00:02.000Z"),
    };
    const snapshot = await threadSnapshot(
      { prisma: groupPrisma(groupRunFindMany({ terminals: [failed, completed] })) },
      groupTarget(),
    );

    expect(snapshot.run).toBeNull();
  });

  it("clamps a long persisted group failure error on refresh", async () => {
    const longError = "x".repeat(400);
    const run = {
      id: "run-failed",
      botId: "bot-2",
      threadId: "thread-1",
      taskId: "task-1",
      status: "failed",
      trigger: "user",
      modelProvider: "openrouter",
      modelId: "openrouter/unknown",
      error: longError,
      startedAt: null,
      completedAt: new Date("2026-08-23T00:00:01.000Z"),
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const snapshot = await threadSnapshot(
      { prisma: groupPrisma(groupRunFindMany({ terminals: [run] })) },
      groupTarget(),
    );

    expect(snapshot.run).toEqual(
      expect.objectContaining({
        id: "run-failed",
        status: "failed",
        error: `${"x".repeat(300)}…`,
      }),
    );
  });

  it("keeps a concurrent member failure in run while another member is still active", async () => {
    const active = {
      id: "run-active",
      botId: "bot-a",
      threadId: "thread-1",
      taskId: "task-a",
      status: "running",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:00.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:00.000Z"),
    };
    const failed = {
      id: "run-failed",
      botId: "bot-b",
      threadId: "thread-1",
      taskId: "task-b",
      status: "failed",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: "member exploded",
      startedAt: new Date("2026-08-23T00:00:01.000Z"),
      completedAt: new Date("2026-08-23T00:00:02.000Z"),
      createdAt: new Date("2026-08-23T00:00:01.000Z"),
    };
    const snapshot = await threadSnapshot(
      { prisma: groupPrisma(groupRunFindMany({ active: [active], terminals: [failed] })) },
      groupTarget(),
    );

    expect(snapshot.run).toEqual(
      expect.objectContaining({ id: "run-failed", status: "failed", error: "member exploded" }),
    );
    expect(snapshot.activeRuns).toEqual([
      expect.objectContaining({ id: "run-active", status: "running" }),
    ]);
  });

  it("keeps a failure on refresh when another member starts after it", async () => {
    const lateActive = {
      id: "run-late",
      botId: "bot-a",
      threadId: "thread-1",
      taskId: "task-a",
      status: "running",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: null,
      startedAt: new Date("2026-08-23T00:00:03.000Z"),
      completedAt: null,
      createdAt: new Date("2026-08-23T00:00:03.000Z"),
    };
    const failed = {
      id: "run-failed",
      botId: "bot-b",
      threadId: "thread-1",
      taskId: "task-b",
      status: "failed",
      trigger: "user",
      modelProvider: null,
      modelId: null,
      error: "member exploded",
      startedAt: new Date("2026-08-23T00:00:01.000Z"),
      completedAt: new Date("2026-08-23T00:00:02.000Z"),
      createdAt: new Date("2026-08-23T00:00:01.000Z"),
    };
    const snapshot = await threadSnapshot(
      {
        prisma: groupPrisma(groupRunFindMany({ active: [lateActive], terminals: [failed] })),
      },
      groupTarget(),
    );

    expect(snapshot.run).toEqual(
      expect.objectContaining({ id: "run-failed", status: "failed", error: "member exploded" }),
    );
    expect(snapshot.activeRuns).toEqual([
      expect.objectContaining({ id: "run-late", status: "running" }),
    ]);
  });
});

function isTerminalRunQuery(where: { status?: { in?: string[] } } | undefined) {
  const statuses = where?.status?.in;
  return Array.isArray(statuses) && statuses.includes("failed") && statuses.includes("completed");
}

type TriggerFilter = { not?: string; notIn?: string[] };

function matchesTriggerFilter(trigger: string | undefined, filter: TriggerFilter | undefined) {
  if (!filter) return true;
  if (filter.not !== undefined && trigger === filter.not) return false;
  if (filter.notIn !== undefined && trigger !== undefined && filter.notIn.includes(trigger)) {
    return false;
  }
  return true;
}

function matchesPeerActiveFilter(
  row: { trigger?: string; status?: string },
  where:
    | {
        trigger?: TriggerFilter;
        OR?: Array<{ trigger?: TriggerFilter; status?: { in?: string[] } }>;
      }
    | undefined,
) {
  if (where?.trigger) return matchesTriggerFilter(row.trigger, where.trigger);
  if (!where?.OR) return true;
  return where.OR.some((clause) => {
    if (!matchesTriggerFilter(row.trigger, clause.trigger)) return false;
    if (clause.status?.in) return clause.status.in.includes(row.status ?? "");
    return true;
  });
}

function botRunFindFirst(
  rows: Array<{
    id: string;
    status: string;
    trigger?: string;
    createdAt?: Date;
  }>,
) {
  return vi.fn().mockImplementation(
    async (args: {
      where?: {
        status?: { in?: string[] };
        trigger?: TriggerFilter;
      };
      select?: { id?: boolean };
    }) => {
      const statuses = args.where?.status?.in;
      const matched = rows
        .filter((row) => !statuses || statuses.includes(row.status))
        .filter((row) => matchesTriggerFilter(row.trigger, args.where?.trigger))
        .sort((a, b) => {
          const byCreated = (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
          return byCreated !== 0 ? byCreated : b.id.localeCompare(a.id);
        });
      const row = matched[0] ?? null;
      if (!row) return null;
      return args.select?.id ? { id: row.id } : row;
    },
  );
}

function groupRunFindMany(input: { active?: unknown[]; terminals?: unknown[] }) {
  return vi.fn().mockImplementation(
    async (args: {
      where?: {
        status?: { in?: string[] };
        trigger?: { not?: string };
        OR?: Array<{ trigger?: { not?: string }; status?: { in?: string[] } }>;
      };
    }) => {
      const rows = isTerminalRunQuery(args.where) ? (input.terminals ?? []) : (input.active ?? []);
      return rows.filter((row) =>
        matchesPeerActiveFilter(row as { trigger?: string; status?: string }, args.where),
      );
    },
  );
}

function groupPrisma(findManyRuns: ReturnType<typeof groupRunFindMany>) {
  const tx = {
    externalEffect: { findMany: vi.fn(async () => []) },
    $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
    message: { findMany: vi.fn().mockResolvedValue([]) },
    event: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    run: { findMany: findManyRuns },
  };
  return {
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
  } as unknown as PrismaClient;
}

function groupTarget() {
  return {
    kind: "group",
    groupId: "group-1",
    groupName: "Group",
    members: [],
    threadId: "thread-1",
  } as unknown as ThreadTarget;
}

describe("sendThreadMessage", () => {
  it("answers a waiting question with a free-text chat message", async () => {
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: 2 } : { nextEventSeq: 3 },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "Paris" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ask-1",
            blocks: [{ kind: "ask", text: "Which city should I use?", status: "pending" }],
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({
          id: "ask-1",
          blocks: [{ kind: "ask", text: "Which city should I use?", status: "pending" }],
        }),
        update: vi.fn(),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "run-waiting", taskId: "task-1", status: "waiting_input", trigger: "user" },
          ]),
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 2, threadId: "thread-1" }) },
      task: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        {
          text: "Paris",
          clientNonce: "nonce-ask",
        },
      ),
    ).resolves.toMatchObject({
      runId: "run-waiting",
      taskId: "task-1",
      seq: 1,
      runIds: ["run-waiting"],
    });
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { runs: { some: { id: "run-waiting" } } },
      data: { prompt: "Paris" },
    });
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "waiting_input" }),
        data: { status: "queued" },
      }),
    );
    // The typed answer is stored once; the card shows it as answered, with no second message.
    expect(tx.message.create).toHaveBeenCalledTimes(1);
    expect(tx.steeringMessage.create).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "thread.message.created",
        payload: expect.objectContaining({ runIds: ["run-waiting"] }),
      }),
    });
  });

  it("continues every waiting run a free-text answer satisfies", async () => {
    const waitingAsk = {
      id: "ask-1",
      blocks: [{ kind: "ask", text: "Which city should I use?", status: "pending" }],
    };
    const tx = {
      externalEffect: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
      },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: 2 } : { nextEventSeq: 3 },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "Paris" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([waitingAsk]),
        findFirst: vi.fn().mockResolvedValue(waitingAsk),
        update: vi.fn(),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([
          { id: "run-waiting-1", taskId: "task-1", status: "waiting_input" },
          { id: "run-waiting-2", taskId: "task-2", status: "waiting_input" },
        ]),
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 2, threadId: "thread-1" }) },
      task: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        {
          text: "Paris",
          clientNonce: "nonce-ask-multi",
        },
      ),
    ).resolves.toMatchObject({
      runId: "run-waiting-1",
      taskId: "task-1",
      seq: 1,
      runIds: ["run-waiting-1", "run-waiting-2"],
    });
    expect(tx.run.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "thread.message.created",
        payload: expect.objectContaining({ runIds: ["run-waiting-1", "run-waiting-2"] }),
      }),
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-waiting-1" } }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-waiting-2" } }),
    );
  });

  it("replays every answered waiting run from a free-text send receipt", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        findUnique: vi.fn().mockResolvedValue({
          id: "msg-1",
          seq: 4,
          runId: "run-waiting-1",
          sourceRuns: [],
        }),
      },
      event: {
        findFirst: vi.fn(async ({ select }: { select?: { seq?: boolean } }) =>
          select?.seq
            ? { seq: 9 }
            : {
                payload: {
                  messageId: "msg-1",
                  role: "user",
                  runIds: ["run-waiting-1", "run-waiting-2"],
                },
              },
        ),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([
          { id: "run-waiting-1", taskId: "task-1", status: "queued" },
          { id: "run-waiting-2", taskId: "task-2", status: "queued" },
        ]),
        findUnique: vi.fn().mockResolvedValue({
          id: "run-waiting-1",
          taskId: "task-1",
          status: "queued",
        }),
      },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        {
          text: "Paris",
          clientNonce: "nonce-ask-replay",
        },
      ),
    ).resolves.toMatchObject({
      runId: "run-waiting-1",
      taskId: "task-1",
      seq: 4,
      runIds: ["run-waiting-1", "run-waiting-2"],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.run.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["run-waiting-1", "run-waiting-2"] } },
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-waiting-1" } }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-waiting-2" } }),
    );
  });

  it("continues every waiting run for a group bot after free-text answers", async () => {
    const waitingAsk = {
      id: "ask-1",
      blocks: [{ kind: "ask", text: "Which city should I use?", status: "pending" }],
    };
    const tx = {
      externalEffect: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
      },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "group-1" }]),
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: 2 } : { nextEventSeq: 3 },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "Paris" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([waitingAsk]),
        findFirst: vi.fn().mockResolvedValue(waitingAsk),
        update: vi.fn(),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([
          { id: "run-waiting-1", taskId: "task-1", botId: "bot-a", status: "waiting_input" },
          { id: "run-waiting-2", taskId: "task-2", botId: "bot-a", status: "waiting_input" },
        ]),
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-a", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
        create: vi.fn(),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 2, threadId: "thread-1" }) },
      task: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      chatGroup: {
        findFirst: vi.fn().mockResolvedValue({
          id: "group-1",
          members: [
            { bot: { id: "bot-a", name: "Alpha", color: null } },
            { bot: { id: "bot-b", name: "Beta", color: null } },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "group-1" }),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Group",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-a", "bot-b"],
    } satisfies ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        {
          text: "Paris",
          clientNonce: "nonce-ask-group-multi",
        },
      ),
    ).resolves.toMatchObject({
      runId: "run-waiting-1",
      taskId: "task-1",
      seq: 1,
      runIds: ["run-waiting-1", "run-waiting-2"],
    });
    expect(tx.run.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "thread.message.created",
        payload: expect.objectContaining({ runIds: ["run-waiting-1", "run-waiting-2"] }),
      }),
    });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-waiting-1" } }),
    );
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-waiting-2" } }),
    );
  });

  describe("a message sent while approval cards wait", () => {
    const approvalCard = {
      kind: "ask",
      approvalEffectId: "effect-1",
      text: "Send an email?",
      status: "pending",
      actions: [
        { id: "allow", label: "Allow once" },
        { id: "deny", label: "Deny" },
      ],
    };
    const secretCard = { kind: "ask", text: "Paste the key", status: "pending", input: "secret" };
    const setup = (card: unknown) => {
      const tx = {
        externalEffect: { findMany: vi.fn(async () => []), updateMany: vi.fn() },
        $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
        thread: {
          update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
            data.nextMessageSeq ? { nextMessageSeq: 2 } : { nextEventSeq: 3 },
          ),
        },
        message: {
          findFirst: vi.fn().mockResolvedValue(null),
          count: vi.fn().mockResolvedValue(2),
          create: vi.fn().mockResolvedValue({
            id: "msg-1",
            threadId: "thread-1",
            seq: 1,
            role: "user",
            blocks: [{ kind: "text", text: "never mind, do it later" }],
            botId: null,
            replyToMessageId: null,
            runId: null,
            createdAt: new Date(),
          }),
          findMany: vi.fn().mockResolvedValue([{ id: "ask-1", blocks: [card] }]),
          update: vi.fn(),
        },
        run: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "run-waiting",
              taskId: "task-1",
              status: "waiting_input",
              trigger: "user",
            },
          ]),
          findFirst: vi.fn().mockResolvedValue({ botId: "bot-1" }),
          findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
        steeringMessage: { create: vi.fn() },
        event: { create: vi.fn().mockResolvedValue({ seq: 2, threadId: "thread-1" }) },
        task: { create: vi.fn(), updateMany: vi.fn() },
        approvalRule: { upsert: vi.fn(), create: vi.fn() },
      };
      const prisma = {
        message: { findUnique: vi.fn().mockResolvedValue(null) },
        threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
        run: { findFirst: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;
      const enqueue = vi.fn().mockResolvedValue(undefined);
      const send = () =>
        sendThreadMessage(
          {
            prisma,
            events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
            jobs: { enqueue } as never,
          },
          { spaceId: "workspace-1", userId: "user-1" } as Actor,
          {
            kind: "bot",
            botId: "bot-1",
            threadId: "thread-1",
            bot: { computer: null },
          } as ThreadTarget,
          { text: "never mind, do it later", clientNonce: "nonce-1" },
        );
      return { tx, enqueue, send };
    };

    it("skips the card as a decline, resumes the run and hands it the message", async () => {
      const { tx, enqueue, send } = setup(approvalCard);
      await expect(send()).resolves.toMatchObject({ runId: "run-waiting" });
      expect(tx.externalEffect.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "denied" }) }),
      );
      expect(tx.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { blocks: [expect.objectContaining({ status: "answered", answer: "skipped" })] },
        }),
      );
      expect(tx.approvalRule.upsert).not.toHaveBeenCalled();
      expect(tx.steeringMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ runId: "run-waiting" }),
      });
      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ name: "run.continue", payload: { runId: "run-waiting" } }),
      );
    });

    it("still refuses while a secret request is open", async () => {
      const { tx, send } = setup(secretCard);
      await expect(send()).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Answer the pending ask first.",
      });
      expect(tx.externalEffect.updateMany).not.toHaveBeenCalled();
      expect(tx.steeringMessage.create).not.toHaveBeenCalled();
    });
  });

  it("waits for the creation intro instead of starting a second run", async () => {
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: 2 } : { nextEventSeq: 3 },
        ),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "Check the inbox" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        update: vi.fn(),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "intro-run", taskId: "intro-task", status: "running", trigger: "created" },
          ]),
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: new Date() }),
        updateMany: vi.fn(),
      },
      task: { create: vi.fn(), updateMany: vi.fn() },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 2, threadId: "thread-1" }) },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        { text: "Check the inbox", clientNonce: "nonce-during-intro" },
      ),
    ).resolves.toMatchObject({
      runId: "intro-run",
      taskId: "intro-task",
      runIds: ["intro-run"],
    });
    // Pending steering: the intro never claims it, so only that turn replies.
    // The continuation after it finishes answers with tools.
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: { messageId: "msg-1", botId: "bot-1", userId: "user-1", runId: null },
    });
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "msg-1" },
      data: { runId: "intro-run" },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("closes the open focus card when the first message is typed", async () => {
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $executeRaw: vi.fn(),
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: 2 } : { nextEventSeq: 3 },
        ),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(1),
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "card-1", blocks: [{ kind: "choice", answerId: null }] }]),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "Check the inbox" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        update: vi.fn(),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "intro-run", taskId: "intro-task", status: "running", trigger: "created" },
          ]),
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: new Date() }),
        updateMany: vi.fn(),
      },
      task: { create: vi.fn(), updateMany: vi.fn() },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 2, threadId: "thread-1" }) },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        { text: "Check the inbox", clientNonce: "nonce-during-intro" },
      ),
    ).resolves.toMatchObject({
      runId: "intro-run",
      taskId: "intro-task",
      runIds: ["intro-run"],
    });
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "card-1" },
      data: { blocks: [{ kind: "choice", answerId: "_dismissed" }] },
    });
  });

  it("runs the failed message again instead of adding a second identical bubble", async () => {
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 5 }) },
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "msg-failed",
          threadId: "thread-1",
          seq: 4,
          role: "user",
          blocks: [{ kind: "text", text: "Pay $20" }],
          sourceRuns: [{ id: "run-failed", status: "failed" }],
        }),
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn(),
        update: vi.fn(),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: "run-2", taskId: "task-2" }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        updateMany: vi.fn(),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-2" }), updateMany: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 5, threadId: "thread-1" }) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;

    await sendThreadMessage(
      {
        prisma,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
        jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
      },
      { spaceId: "workspace-1", userId: "user-1" } as Actor,
      target,
      { text: "Pay $20", clientNonce: "nonce-retry" },
    );

    expect(tx.message.create).not.toHaveBeenCalled();
    // The newest user message is found even when bot messages (an approval card) follow it.
    expect(tx.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { threadId: "thread-1", role: "user" } }),
    );
    // The message keeps its first nonce; the retry's goes on its run.
    expect(tx.message.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { clientNonce: expect.anything() } }),
    );
    expect(tx.run.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceMessageId: "msg-failed",
        clientNonce: "retry:nonce-retry",
      }),
    });
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "thread.message.updated" }),
    });
  });

  it("replays a retry's nonce to the existing message without creating a run", async () => {
    const findUnique = vi
      .fn()
      // Nonce B is not on the message; the lookup by id finds the retried message.
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "msg-failed", seq: 4, runId: null, sourceRuns: [] });
    const prisma = {
      message: { findUnique },
      event: {
        findFirst: vi.fn(async ({ select }: { select?: { seq?: boolean } }) =>
          select?.seq
            ? { seq: 9 }
            : { payload: { messageId: "msg-failed", role: "user", runIds: ["run-retry"] } },
        ),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ sourceMessageId: "msg-failed" }),
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "run-retry", taskId: "task-2", status: "queued" }]),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;
    const target = { kind: "bot", botId: "bot-1", threadId: "thread-1", bot: { computer: null } };

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
        },
        { spaceId: "workspace-1", userId: "user-1" } as Actor,
        target as ThreadTarget,
        { text: "Pay $20", clientNonce: "nonce-B" },
      ),
    ).resolves.toMatchObject({ runId: "run-retry", seq: 4 });
    expect(prisma.run.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { threadId: "thread-1", clientNonce: "retry:nonce-B" } }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.run.create).not.toHaveBeenCalled();
  });

  it("steers a waiting-takeover run instead of refusing the message", async () => {
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 2 })
          .mockResolvedValueOnce({ nextEventSeq: 3 }),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "skip that" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        update: vi.fn(),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "run-waiting", taskId: "task-1", status: "waiting_takeover" }]),
        findUnique: vi.fn().mockResolvedValue({
          status: "waiting_takeover",
          startedAt: new Date(),
        }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 2 }) },
      task: { create: vi.fn() },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        {
          text: "skip that",
          clientNonce: "nonce-takeover",
        },
      ),
    ).resolves.toMatchObject({
      runId: "run-waiting",
      taskId: "task-1",
      seq: 1,
      runIds: ["run-waiting"],
    });
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: {
        messageId: "msg-1",
        botId: "bot-1",
        userId: "user-1",
        runId: "run-waiting",
      },
    });
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
  });
  it("keeps a message pending instead of steering into an active routine run", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "what are the alternatives?" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        update: vi.fn(),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { id: "run-routine", taskId: "task-routine", status: "running", trigger: "routine" },
          ])
          .mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi
          .fn()
          .mockResolvedValue({ id: "run-user", taskId: "task-user", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-user" }) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 2, createdAt: new Date() }),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        { text: "what are the alternatives?", clientNonce: "nonce-routine" },
      ),
    ).resolves.toMatchObject({
      runId: "run-routine",
      taskId: "task-routine",
      runIds: ["run-routine"],
    });
    // Pending steering (no run): the routine's turn never claims it, and the continuation
    // that starts when the routine finishes answers with the full thread.
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: { messageId: "msg-1", botId: "bot-1", userId: "user-1", runId: null },
    });
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "msg-1" },
      data: { runId: "run-routine" },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("keeps a group message pending instead of steering into a member's webhook run", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "status?" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        update: vi.fn(),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "run-webhook",
              taskId: "task-webhook",
              botId: "bot-a",
              status: "running",
              trigger: "webhook",
            },
          ])
          .mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi
          .fn()
          .mockResolvedValue({ id: "run-a", taskId: "task-a", botId: "bot-a", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-a" }) },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      chatGroup: {
        findFirst: vi.fn().mockResolvedValue({
          id: "group-1",
          members: [
            { bot: { id: "bot-a", name: "Alpha", color: null } },
            { bot: { id: "bot-b", name: "Beta", color: null } },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "group-1" }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "group-1" }]),
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Group",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-a", "bot-b"],
    } satisfies ThreadTarget;

    const result = await sendThreadMessage(
      {
        prisma,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
        jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
      },
      actor,
      target,
      { text: "status?", clientNonce: "nonce-group-webhook" },
    );

    expect(result).toMatchObject({ runId: "run-webhook", taskId: "task-webhook" });
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: { messageId: "msg-1", botId: "bot-a", userId: "user-1", runId: null },
    });
    expect(tx.run.create).not.toHaveBeenCalled();
  });
  it("answers a routine run waiting for input from the composer", async () => {
    const waitingAsk = {
      id: "ask-1",
      blocks: [{ kind: "ask", text: "Which city should I use?", status: "pending" }],
    };
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: 2 } : { nextEventSeq: 3 },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "Paris" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([waitingAsk]),
        findFirst: vi.fn().mockResolvedValue(waitingAsk),
        update: vi.fn(),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-routine",
            taskId: "task-routine",
            status: "waiting_input",
            trigger: "routine",
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
        create: vi.fn(),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 2, threadId: "thread-1" }) },
      task: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        { text: "Paris", clientNonce: "nonce-routine-waiting" },
      ),
    ).resolves.toMatchObject({
      runId: "run-routine",
      taskId: "task-routine",
      runIds: ["run-routine"],
    });
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { runs: { some: { id: "run-routine" } } },
      data: { prompt: "Paris" },
    });
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "run-routine", status: "waiting_input" }),
        data: { status: "queued" },
      }),
    );
    expect(tx.steeringMessage.create).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-routine" } }),
    );
  });
  it("answers a group webhook run waiting for input from the composer", async () => {
    const waitingAsk = {
      id: "ask-1",
      blocks: [{ kind: "ask", text: "Which city should I use?", status: "pending" }],
    };
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "group-1" }]),
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: 2 } : { nextEventSeq: 3 },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "Paris" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([waitingAsk]),
        findFirst: vi.fn().mockResolvedValue(waitingAsk),
        update: vi.fn(),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-webhook",
            taskId: "task-webhook",
            botId: "bot-a",
            status: "waiting_input",
            trigger: "webhook",
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-a", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
        create: vi.fn(),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: { create: vi.fn().mockResolvedValue({ seq: 2, threadId: "thread-1" }) },
      task: { create: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      chatGroup: {
        findFirst: vi.fn().mockResolvedValue({
          id: "group-1",
          members: [
            { bot: { id: "bot-a", name: "Alpha", color: null } },
            { bot: { id: "bot-b", name: "Beta", color: null } },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "group-1" }),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Group",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-a", "bot-b"],
    } satisfies ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        { text: "Paris", clientNonce: "nonce-group-webhook-waiting" },
      ),
    ).resolves.toMatchObject({
      runId: "run-webhook",
      taskId: "task-webhook",
      runIds: ["run-webhook"],
    });
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { runs: { some: { id: "run-webhook" } } },
      data: { prompt: "Paris" },
    });
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "run-webhook", status: "waiting_input" }),
        data: { status: "queued" },
      }),
    );
    expect(tx.steeringMessage.create).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-webhook" } }),
    );
  });
  it("steers a conversational run instead of answering a waiting routine", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "what about the watch?" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        update: vi.fn(),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "run-routine",
              taskId: "task-routine",
              status: "waiting_input",
              trigger: "routine",
            },
            { id: "run-user", taskId: "task-user", status: "running", trigger: "user" },
          ])
          .mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: new Date() }),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      task: { create: vi.fn(), updateMany: vi.fn() },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 2, createdAt: new Date() }),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        { text: "what about the watch?", clientNonce: "nonce-routine-and-chat" },
      ),
    ).resolves.toMatchObject({
      runId: "run-user",
      taskId: "task-user",
      runIds: ["run-user"],
    });
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: { messageId: "msg-1", botId: "bot-1", userId: "user-1", runId: "run-user" },
    });
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "msg-1" },
      data: { runId: "run-user" },
    });
    expect(tx.run.updateMany).not.toHaveBeenCalled();
    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("steers a group conversational run instead of answering a waiting webhook", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(2),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "what about the watch?" }],
          botId: null,
          replyToMessageId: null,
          runId: null,
          createdAt: new Date(),
        }),
        update: vi.fn(),
      },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "run-webhook",
              taskId: "task-webhook",
              botId: "bot-a",
              status: "waiting_input",
              trigger: "webhook",
            },
            {
              id: "run-user",
              taskId: "task-user",
              botId: "bot-a",
              status: "running",
              trigger: "user",
            },
          ])
          .mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: new Date() }),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      task: { create: vi.fn(), updateMany: vi.fn() },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      chatGroup: {
        findFirst: vi.fn().mockResolvedValue({
          id: "group-1",
          members: [
            { bot: { id: "bot-a", name: "Alpha", color: null } },
            { bot: { id: "bot-b", name: "Beta", color: null } },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "group-1" }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "group-1" }]),
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Group",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-a", "bot-b"],
    } satisfies ThreadTarget;
    const enqueue = vi.fn().mockResolvedValue(undefined);

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue } as never,
        },
        actor,
        target,
        { text: "what about the watch?", clientNonce: "nonce-group-webhook-and-chat" },
      ),
    ).resolves.toMatchObject({
      runId: "run-user",
      taskId: "task-user",
      runIds: ["run-user"],
    });
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: { messageId: "msg-1", botId: "bot-a", userId: "user-1", runId: "run-user" },
    });
    expect(tx.run.updateMany).not.toHaveBeenCalled();
    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("rejects a quote excerpt without a reply target", async () => {
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

    await expect(
      sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn() } as never,
          jobs: { enqueue: vi.fn() } as never,
        },
        actor,
        target,
        { text: "hi", replyQuote: "just this span", clientNonce: "nonce-1" },
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("persists the quote excerpt alongside the reply target", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({
          id: "parent",
          role: "bot",
          blocks: [{ kind: "text", text: "the parent says just this span inside it" }],
        }),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "why this?" }],
          botId: null,
          replyToMessageId: "parent",
          replyQuote: "just this span",
          runId: null,
          createdAt: new Date(),
        }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

    const result = await sendThreadMessage(
      {
        prisma,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
        jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
      },
      actor,
      target,
      {
        text: "why this?",
        replyToMessageId: "parent",
        replyQuote: "just this span",
        clientNonce: "nonce-1",
      },
    );

    expect(result).toMatchObject({ runId: "run-1", taskId: "task-1" });
    expect(tx.message.findFirst).toHaveBeenCalledWith({
      where: { id: "parent", threadId: "thread-1" },
      select: { id: true, blocks: true, role: true, botId: true },
    });
    expect(tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        replyToMessageId: "parent",
        replyQuote: "just this span",
      }),
    });
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({ replyQuote: "just this span" }),
      }),
    });
  });

  it("stamps the call id on the live event so the bubble joins the call card at once", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const clientNonce = callClientNonce("call-7");
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "book the flight" }],
          botId: null,
          runId: null,
          clientNonce,
          createdAt: new Date(),
        }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await sendThreadMessage(
      {
        prisma,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
        jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
      },
      { spaceId: "workspace-1", userId: "user-1" } as Actor,
      { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget,
      { text: "book the flight", clientNonce },
    );

    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "thread.message.created",
        payload: expect.objectContaining({ callId: "call-7" }),
      }),
    });
  });

  it.each([undefined, "words the parent never said"])(
    "sends an unavailable reply to malformed blocks (quote: %s)",
    async (quote) => {
      let messageSeq = 0;
      let eventSeq = 0;
      const tx = {
        externalEffect: { findMany: vi.fn(async () => []) },
        thread: {
          update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
            data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
          ),
        },
        message: {
          count: vi.fn().mockResolvedValue(2),
          findFirst: vi.fn().mockResolvedValue({
            id: "parent",
            role: "bot",
            blocks: [null],
          }),
          update: vi.fn(),
          create: vi.fn().mockResolvedValue({
            id: "msg-1",
            threadId: "thread-1",
            seq: 1,
            role: "user",
            blocks: [{ kind: "text", text: "why this?" }],
            botId: null,
            replyToMessageId: "parent",
            replyQuote: null,
            runId: null,
            createdAt: new Date(),
          }),
        },
        run: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
          create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
        },
        task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
        event: {
          create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
        },
        threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
        steeringMessage: { create: vi.fn() },
      };
      const prisma = {
        message: { findUnique: vi.fn().mockResolvedValue(null) },
        threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
        run: { findFirst: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;
      const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
      const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

      const result = await sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
        },
        actor,
        target,
        {
          text: "why this?",
          replyToMessageId: "parent",
          replyQuote: quote,
          clientNonce: "nonce-1",
        },
      );

      // The send still lands as a plain reply — the fabricated excerpt is dropped.
      expect(result).toMatchObject({ runId: "run-1", taskId: "task-1" });
      expect(tx.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          replyToMessageId: "parent",
          replyQuote: undefined,
        }),
      });
      expect(tx.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: expect.objectContaining({ replyPreview: null, replyToMessageId: "parent" }),
        }),
      });
    },
  );

  it("sends a plain reply when the reply target no longer exists", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        // The parent was deleted (or paged out) between arming and send.
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "why this?" }],
          botId: null,
          replyToMessageId: null,
          replyQuote: null,
          runId: null,
          createdAt: new Date(),
        }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

    const result = await sendThreadMessage(
      {
        prisma,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
        jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
      },
      actor,
      target,
      {
        text: "why this?",
        replyToMessageId: "deleted-parent",
        replyQuote: "the span that was quoted",
        clientNonce: "nonce-1",
      },
    );

    // The send lands with an unavailable marker and no dangling target.
    expect(result).toMatchObject({ runId: "run-1", taskId: "task-1" });
    expect(tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        replyToMessageId: undefined,
        replyQuote: "",
      }),
    });
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.not.objectContaining({ replyToMessageId: expect.anything() }),
      }),
    });
  });

  it("accepts a quote excerpt that matches formatted parent text", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({
          id: "parent",
          role: "bot",
          // Rendered as "42% growth", stored with markdown source.
          blocks: [{ kind: "text", text: "we saw **42%** growth last week" }],
        }),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "why this?" }],
          botId: null,
          replyToMessageId: "parent",
          replyQuote: "42% growth",
          runId: null,
          createdAt: new Date(),
        }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

    const result = await sendThreadMessage(
      {
        prisma,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
        jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
      },
      actor,
      target,
      {
        text: "why this?",
        replyToMessageId: "parent",
        replyQuote: "42% growth",
        clientNonce: "nonce-1",
      },
    );

    expect(result).toMatchObject({ runId: "run-1", taskId: "task-1" });
    expect(tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ replyQuote: "42% growth" }),
    });
  });

  it.each([
    ["table cells", "| Name | Value |\n|:-----|------:|\n| Alice | 5 |", "Alice 5", "Alice 5"],
    ["indented code", "    2. restart()", "2. restart()", "2. restart()"],
    ["fenced code", "```text\n2. restart()\n```", "2. restart()", "2. restart()"],
    [
      "lists after code fences",
      "```text\n1. code\n```\n1. First\n2. Second",
      "First\nSecond",
      "First\nSecond",
    ],
    ["tab-indented code", "\t2. restart()", "2. restart()", "2. restart()"],
    ["three-space lists", "   1. First\n   2. Second", "First\nSecond", "First\nSecond"],
    [
      "ordered list items",
      "1. Review the diff\n2. Run the tests",
      "Review the diff Run the tests",
      "Review the diff\nRun the tests",
    ],
    [
      "parenthesized list items",
      "1) Review the diff\n2) Run the tests",
      "Review the diff\nRun the tests",
      "Review the diff\nRun the tests",
    ],
    [
      "quoted list items",
      "> 1. Review the diff\n> 2. Run the tests",
      "Review the diff\nRun the tests",
      "Review the diff\nRun the tests",
    ],
  ])(
    "derives a quote excerpt spanning rendered %s",
    async (_name, parentText, requestedQuote, expectedQuote) => {
      let messageSeq = 0;
      let eventSeq = 0;
      const tx = {
        externalEffect: { findMany: vi.fn(async () => []) },
        thread: {
          update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
            data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
          ),
        },
        message: {
          count: vi.fn().mockResolvedValue(2),
          findFirst: vi.fn().mockResolvedValue({
            id: "parent",
            role: "bot",
            blocks: [
              {
                kind: "text",
                text: parentText,
              },
            ],
          }),
          update: vi.fn(),
          create: vi.fn().mockResolvedValue({
            id: "msg-1",
            threadId: "thread-1",
            seq: 1,
            role: "user",
            blocks: [{ kind: "text", text: "why this?" }],
            botId: null,
            replyToMessageId: "parent",
            replyQuote: expectedQuote,
            runId: null,
            createdAt: new Date(),
          }),
        },
        run: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
          create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
        },
        task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
        event: {
          create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
        },
        threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
        steeringMessage: { create: vi.fn() },
      };
      const prisma = {
        message: { findUnique: vi.fn().mockResolvedValue(null) },
        threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
        run: { findFirst: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;
      const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
      const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

      const result = await sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
        },
        actor,
        target,
        {
          text: "why this?",
          replyToMessageId: "parent",
          replyQuote: requestedQuote,
          clientNonce: "nonce-1",
        },
      );

      expect(result).toMatchObject({ runId: "run-1", taskId: "task-1" });
      expect(tx.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ replyQuote: expectedQuote }),
      });
      expect(tx.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: expect.objectContaining({ replyQuote: expectedQuote }),
        }),
      });
    },
  );

  it.each([
    [
      "image only",
      [{ kind: "image", artifactId: "photo", name: "", mimeType: "image/png" }],
      undefined,
      undefined,
      "",
      { kind: "image", artifactId: "photo", name: "", mimeType: "image/png" },
    ],
    [
      "file only",
      [{ kind: "file", artifactId: "file", name: "notes.txt", mimeType: "text/plain", size: 12 }],
      undefined,
      undefined,
      "notes.txt",
      { kind: "file", artifactId: "file", name: "notes.txt", mimeType: "text/plain" },
    ],
    [
      "caption and selection",
      [
        { kind: "image", artifactId: "photo", name: "photo.png", mimeType: "image/png" },
        { kind: "text", text: "Caption selected text" },
      ],
      "selected text",
      "selected text",
      "Caption selected text",
      { kind: "image", artifactId: "photo", name: "photo.png", mimeType: "image/png" },
    ],
  ])(
    "derives live reply metadata for %s from the same-thread parent",
    async (_name, parentBlocks, requestedQuote, expectedQuote, expectedText, expectedAttachment) => {
      let messageSeq = 0;
      let eventSeq = 0;
      const tx = {
        externalEffect: { findMany: vi.fn(async () => []) },
        thread: {
          update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
            data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
          ),
        },
        message: {
          count: vi.fn().mockResolvedValue(2),
          findFirst: vi.fn().mockResolvedValue({
            id: "parent",
            role: "bot",
            blocks: parentBlocks,
          }),
          update: vi.fn(),
          create: vi.fn().mockResolvedValue({
            id: "msg-1",
            threadId: "thread-1",
            seq: 1,
            role: "user",
            blocks: [{ kind: "text", text: "why this?" }],
            botId: null,
            replyToMessageId: "parent",
            replyQuote: expectedQuote,
            runId: null,
            createdAt: new Date(),
          }),
        },
        run: {
          findMany: vi.fn().mockResolvedValue([]),
          findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
          create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
        },
        task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
        event: {
          create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
        },
        threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
        steeringMessage: { create: vi.fn() },
      };
      const prisma = {
        message: { findUnique: vi.fn().mockResolvedValue(null) },
        threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
        run: { findFirst: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;
      const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
      const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

      const result = await sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
        },
        actor,
        target,
        {
          text: "why this?",
          replyToMessageId: "parent",
          replyQuote: requestedQuote,
          clientNonce: "nonce-1",
        },
      );

      expect(tx.message.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "parent", threadId: "thread-1" } }),
      );
      expect(tx.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            replyPreview: { role: "bot", text: expectedText, attachment: expectedAttachment },
          }),
        }),
      });
      expect(result).toMatchObject({ runId: "run-1", taskId: "task-1" });
      expect(tx.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ replyQuote: expectedQuote }),
      });
      expect(tx.event.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          payload: expect.objectContaining({ replyQuote: expectedQuote }),
        }),
      });
    },
  );

  it("drops a quote excerpt that only matches after stripping punctuation", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({
          id: "parent",
          role: "bot",
          blocks: [
            {
              kind: "text",
              text: "C++ is fast and key:value pairs; version 1.2 and 2. items\n    2. restart()\n```text\n1. alpha\n2. beta\n```\n~~~text\n1. gamma\n2. delta\n~~~\n```text\n> ```\n1. epsilon\n2. zeta\n```\n> ```text\n> > ```\n> 1. eta\n> 2. theta\n> ```\n```text\nalpha\n---\nomega\n```\nRead [docs](https://example.test/private)\nAlice\n# 1. heading\n# 2. another heading\n\n    > 1. literal\n    > 2. another literal",
            },
          ],
        }),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "why this?" }],
          botId: null,
          replyToMessageId: "parent",
          replyQuote: null,
          runId: null,
          createdAt: new Date(),
        }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

    for (const replyQuote of [
      "C is fast",
      "key value pairs",
      "version 12",
      "and items",
      "3. restart()",
      "    3. restart()",
      "99. C++ is fast",
      "alpha\nbeta",
      "gamma\ndelta",
      "epsilon\nzeta",
      "eta\ntheta",
      "alpha\nomega",
      "text",
      "https://example.test/private",
      "alice",
      "heading\nanother heading",
      "literal\nanother literal",
    ]) {
      await sendThreadMessage(
        {
          prisma,
          events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
          jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
        },
        actor,
        target,
        { text: "why this?", replyToMessageId: "parent", replyQuote },
      );
    }

    for (const call of tx.message.create.mock.calls) {
      expect(call[0].data.replyQuote).toBeUndefined();
    }
  });

  it("still sends a plain reply when quote derivation throws", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({
          id: "parent",
          role: "bot",
          blocks: [{ kind: "text", text: "the parent says just this span inside it" }],
        }),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "why this?" }],
          botId: null,
          replyToMessageId: "parent",
          replyQuote: null,
          runId: null,
          createdAt: new Date(),
        }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi.fn().mockResolvedValue({ id: "run-1", taskId: "task-1", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = { kind: "bot", botId: "bot-1", threadId: "thread-1" } as ThreadTarget;

    const result = await sendThreadMessage(
      {
        prisma,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
        jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
      },
      actor,
      target,
      {
        text: "why this?",
        replyToMessageId: "parent",
        replyQuote: "explode derivation",
        clientNonce: "nonce-1",
      },
    );

    expect(result).toMatchObject({ runId: "run-1", taskId: "task-1" });
    expect(tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ replyToMessageId: "parent" }),
    });
    expect(tx.message.create.mock.calls[0][0].data.replyQuote).toBeUndefined();
  });

  it("persists the quote excerpt on a group send", async () => {
    let messageSeq = 0;
    let eventSeq = 0;
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      thread: {
        update: vi.fn(async ({ data }: { data: { nextMessageSeq?: unknown } }) =>
          data.nextMessageSeq ? { nextMessageSeq: ++messageSeq } : { nextEventSeq: ++eventSeq },
        ),
      },
      message: {
        count: vi.fn().mockResolvedValue(2),
        findFirst: vi.fn().mockResolvedValue({
          id: "parent",
          role: "bot",
          blocks: [{ kind: "text", text: "the parent says just this span inside it" }],
        }),
        update: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "msg-1",
          threadId: "thread-1",
          seq: 1,
          role: "user",
          blocks: [{ kind: "text", text: "why this?" }],
          botId: null,
          replyToMessageId: "parent",
          replyQuote: "just this span",
          runId: null,
          createdAt: new Date(),
        }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued", startedAt: null }),
        create: vi
          .fn()
          .mockResolvedValue({ id: "run-1", taskId: "task-1", botId: "bot-a", status: "queued" }),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      event: {
        create: vi.fn().mockResolvedValue({ id: "event-1", seq: 1, createdAt: new Date() }),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { create: vi.fn() },
      chatGroup: {
        findFirst: vi.fn().mockResolvedValue({
          id: "group-1",
          members: [
            { bot: { id: "bot-a", name: "Alpha", color: null } },
            { bot: { id: "bot-b", name: "Beta", color: null } },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "group-1" }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "group-1" }]),
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const actor = { spaceId: "workspace-1", userId: "user-1" } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Group",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-a", "bot-b"],
    } satisfies ThreadTarget;

    const result = await sendThreadMessage(
      {
        prisma,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
        jobs: { enqueue: vi.fn().mockResolvedValue(undefined) } as never,
      },
      actor,
      target,
      {
        text: "why this?",
        replyToMessageId: "parent",
        replyQuote: "just this span",
        clientNonce: "nonce-1",
      },
    );

    expect(result).toMatchObject({ runId: "run-1", taskId: "task-1" });
    expect(tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        replyToMessageId: "parent",
        replyQuote: "just this span",
      }),
    });
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({ replyQuote: "just this span" }),
      }),
    });
  });
});

describe("stopThreadRuns", () => {
  it("snapshots every lease when group members share a team computer", async () => {
    const releaseScreen = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn(async function* () {
      yield { type: "exit", code: 0 };
    });
    let nextEventSeq = 0;
    const transaction = {
      externalEffect: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
      },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $queryRaw: vi.fn(),
      thread: {
        update: vi.fn(async () => ({ nextEventSeq: ++nextEventSeq })),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([
          { id: "run-a", botId: "bot-a", taskId: "task" },
          { id: "run-b", botId: "bot-b", taskId: "task" },
        ]),
        updateManyAndReturn: fakeRunUpdateManyAndReturn(),
        findUnique: vi.fn().mockResolvedValue({ status: "cancelled" }),
      },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      secret: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      message: { findMany: vi.fn().mockResolvedValue([]) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      computer: {
        // Production team ownership is lease-only: Computer.executionRunId stays null.
        findMany: vi.fn().mockImplementation(async ({ where }: { where: { OR?: unknown[] } }) => {
          expect(where.OR).toEqual(
            expect.arrayContaining([
              { id: { in: ["computer-db-team"] } },
              { executionRunId: { in: ["run-a", "run-b"] } },
            ]),
          );
          return [
            {
              id: "computer-db-team",
              homeKey: "home-team",
              kind: "fake",
              providerRef: "computer-team",
              executionBotId: null,
              executionRunId: null,
            },
          ];
        }),
      },
      computerExecutionLease: {
        findMany: vi.fn().mockResolvedValue([
          { computerId: "computer-db-team", botId: "bot-a", runId: "run-a", fence: 2 },
          { computerId: "computer-db-team", botId: "bot-b", runId: "run-b", fence: 4 },
        ]),
      },
      event: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      // Simulate workers clearing leases / execution columns as soon as the
      // transaction commits. A post-commit lookup would now miss both sandboxes.
      computer: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      computerExecutionLease: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    } as unknown as PrismaClient;
    const actor = {
      spaceId: "workspace-1",
      userId: "user-1",
    } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Test group",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-a", "bot-b"],
    } satisfies ThreadTarget;

    await stopThreadRuns(
      {
        prisma,
        sandbox: { releaseScreen, execute } as unknown as SandboxProvider,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
      },
      actor,
      target,
    );

    // The stop waits on the thread row lock, which snapshot reads can hold for 15s; only the
    // timeout is explicit so the client's longer connection wait is kept.
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 20_000 });
    expect(transaction.computerExecutionLease.findMany).toHaveBeenCalledWith({
      where: { runId: { in: ["run-a", "run-b"] } },
      select: { computerId: true, botId: true, runId: true, fence: true },
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: "computer-team" }),
      expect.objectContaining({
        argv: expect.arrayContaining(["rakazo-cancel-run-work", "computer-db-team", "run-a"]),
      }),
      expect.objectContaining({ cancelRunWork: true, runId: "run-a", botId: "bot-a" }),
    );
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: "computer-team" }),
      expect.objectContaining({
        argv: expect.arrayContaining(["rakazo-cancel-run-work", "computer-db-team", "run-b"]),
      }),
      expect.objectContaining({ cancelRunWork: true, runId: "run-b", botId: "bot-b" }),
    );
    expect(releaseScreen).toHaveBeenCalledTimes(2);
    expect(releaseScreen).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: "computer-team" }),
      expect.objectContaining({
        spaceId: "workspace-1",
        userId: "user-1",
        botId: "bot-a",
        cancelRunWork: true,
        runId: "run-a",
        screenLeaseId: "run-a:2",
      }),
    );
    expect(releaseScreen).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: "computer-team" }),
      expect.objectContaining({
        spaceId: "workspace-1",
        userId: "user-1",
        botId: "bot-b",
        cancelRunWork: true,
        runId: "run-b",
        screenLeaseId: "run-b:4",
      }),
    );
    expect(prisma.computer.findMany).not.toHaveBeenCalled();
    expect(prisma.computerExecutionLease.updateMany).toHaveBeenCalledWith({
      where: { runId: { in: ["run-a", "run-b"] } },
      data: { expiresAt: new Date(0) },
    });
    expect(prisma.computer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { executionRunId: { in: ["run-a", "run-b"] } } }),
    );
  });

  it("does not tear down a stale legacy execution run when the lease owns a cancelled run", async () => {
    const releaseScreen = vi.fn().mockResolvedValue(undefined);
    const execute = vi.fn(async function* () {
      yield { type: "exit", code: 0 };
    });
    const transaction = {
      externalEffect: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
      },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $queryRaw: vi.fn(),
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 5 }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([{ id: "run-a", botId: "bot-a", taskId: "task" }]),
        updateManyAndReturn: fakeRunUpdateManyAndReturn(),
        findUnique: vi.fn().mockResolvedValue({ status: "cancelled" }),
      },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      secret: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      message: { findMany: vi.fn().mockResolvedValue([]) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      computer: {
        // Selected via lease for cancelled run A, but legacy columns still name
        // unrelated live run B. Legacy teardown must not cancel/release B.
        findMany: vi.fn().mockResolvedValue([
          {
            id: "computer-db-a",
            homeKey: "home-a",
            kind: "fake",
            providerRef: "computer-a",
            executionBotId: "bot-b",
            executionRunId: "run-b",
          },
        ]),
      },
      computerExecutionLease: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { computerId: "computer-db-a", botId: "bot-a", runId: "run-a", fence: 2 },
          ]),
      },
      event: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      computer: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      computerExecutionLease: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaClient;
    const actor = {
      spaceId: "workspace-1",
      userId: "user-1",
    } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Test group",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-a", "bot-b"],
    } satisfies ThreadTarget;

    await stopThreadRuns(
      {
        prisma,
        sandbox: { releaseScreen, execute } as unknown as SandboxProvider,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
      },
      actor,
      target,
    );

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: "computer-a" }),
      expect.objectContaining({
        argv: expect.arrayContaining(["rakazo-cancel-run-work", "computer-db-a", "run-a"]),
      }),
      expect.objectContaining({ cancelRunWork: true, runId: "run-a", botId: "bot-a" }),
    );
    expect(execute).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        argv: expect.arrayContaining(["rakazo-cancel-run-work", "computer-db-a", "run-b"]),
      }),
      expect.anything(),
    );
    expect(releaseScreen).toHaveBeenCalledTimes(1);
    expect(releaseScreen).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: "computer-a" }),
      expect.objectContaining({
        botId: "bot-a",
        runId: "run-a",
        screenLeaseId: "run-a:2",
      }),
    );
    expect(releaseScreen).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ runId: "run-b" }),
    );
  });

  it("closes an open approval card and the effects behind it when the user stops the run", async () => {
    let nextEventSeq = 0;
    const effectUpdate = vi.fn().mockResolvedValue({ count: 2 });
    const messageUpdate = vi.fn().mockResolvedValue({});
    const created: Array<Record<string, unknown>> = [];
    const transaction = {
      $queryRaw: vi.fn(),
      thread: { update: vi.fn(async () => ({ nextEventSeq: nextEventSeq++ })) },
      run: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "run-a",
            botId: "bot-a",
            taskId: "task",
            userId: "user-1",
            spaceId: "workspace-1",
          },
        ]),
        updateManyAndReturn: fakeRunUpdateManyAndReturn(),
        // Still waiting when the card is closed: a cancelled run cannot write to the thread.
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({ status: "waiting_input" })
          .mockResolvedValue({ status: "cancelled" }),
      },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      secret: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      message: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "message-1",
            runId: "run-a",
            blocks: [
              {
                kind: "ask",
                text: "Review before shell",
                status: "pending",
                approvalEffectId: "effect-1",
                actions: [
                  { id: "allow", label: "Allow once" },
                  { id: "deny", label: "Deny" },
                ],
              },
            ],
          },
        ]),
        update: messageUpdate,
      },
      externalEffect: { updateMany: effectUpdate, deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      computer: { findMany: vi.fn().mockResolvedValue([]) },
      computerExecutionLease: { findMany: vi.fn().mockResolvedValue([]) },
      event: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return data;
        }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      computer: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      computerExecutionLease: { updateMany: vi.fn() },
    } as unknown as PrismaClient;
    await stopThreadRuns(
      {
        prisma,
        sandbox: {} as SandboxProvider,
        events: { notify: vi.fn().mockResolvedValue(undefined) } as never,
      },
      { spaceId: "workspace-1", userId: "user-1" } as Actor,
      {
        kind: "bot",
        botId: "bot-a",
        threadId: "thread-1",
      } as ThreadTarget,
    );

    // The card shows it was closed, and the effect behind it (and any other pending one) cannot run.
    expect(messageUpdate).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: {
        blocks: [expect.objectContaining({ status: "answered", answer: "stopped" })],
      },
    });
    expect(effectUpdate).toHaveBeenCalledWith({
      where: { runId: { in: ["run-a"] }, spaceId: "workspace-1", status: "intended" },
      data: { status: "stopped" },
    });
    expect(created.map((event) => event.type)).toEqual(["thread.message.updated", "run.cancelled"]);
  });

  it("writes a run.cancelled event per cancelled run ahead of the progress purge", async () => {
    // Two earlier progress events already hold seqs 0 and 1; a client may have
    // applied cursor 1 before Stop deletes those rows.
    let nextEventSeq = 2;
    const writes: string[] = [];
    const created: Array<Record<string, unknown>> = [];
    const transaction = {
      externalEffect: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
      },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $queryRaw: vi.fn(),
      thread: {
        update: vi.fn(async () => ({ nextEventSeq: ++nextEventSeq })),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([
          { id: "run-a", botId: "bot-a", taskId: "task" },
          { id: "run-b", botId: "bot-b", taskId: "task" },
        ]),
        updateManyAndReturn: fakeRunUpdateManyAndReturn(),
        // appendEventInTransaction re-reads the run after the flip.
        findUnique: vi.fn().mockResolvedValue({ status: "cancelled" }),
      },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      secret: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      message: { findMany: vi.fn().mockResolvedValue([]) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      computer: { findMany: vi.fn().mockResolvedValue([]) },
      computerExecutionLease: { findMany: vi.fn().mockResolvedValue([]) },
      event: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          writes.push("event.create");
          created.push(data);
          return data;
        }),
        deleteMany: vi.fn(async () => {
          writes.push("event.deleteMany");
          return { count: 4 };
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      computer: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      computerExecutionLease: { updateMany: vi.fn().mockResolvedValue({ count: 2 }) },
      // No event delegate: a post-commit progress delete would throw here.
    } as unknown as PrismaClient;
    const notify = vi.fn().mockResolvedValue(undefined);
    const actor = {
      spaceId: "workspace-1",
      userId: "user-1",
    } as Actor;
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Test group",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-a", "bot-b"],
    } satisfies ThreadTarget;

    await stopThreadRuns(
      {
        prisma,
        sandbox: {} as SandboxProvider,
        events: { notify } as never,
      },
      actor,
      target,
    );

    expect(created).toEqual([
      expect.objectContaining({
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-a",
        type: "run.cancelled",
        runId: "run-a",
        payload: {},
        seq: 2,
      }),
      expect.objectContaining({
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-b",
        type: "run.cancelled",
        runId: "run-b",
        payload: {},
        seq: 3,
      }),
    ]);
    // The terminal seqs sit above every deleted progress seq, so max(seq) never
    // rewinds below an applied cursor — the freeze regression.
    expect(Math.max(...created.map((data) => data.seq as number))).toBeGreaterThan(1);
    expect(writes.lastIndexOf("event.create")).toBeLessThan(writes.indexOf("event.deleteMany"));
    expect(transaction.event.deleteMany).toHaveBeenCalledWith({
      where: { type: "thread.progress", runId: { in: ["run-a", "run-b"] } },
    });
    expect(notify).toHaveBeenCalledWith("thread-1", 3);
  });

  it("emits no event and skips the wake when nothing was running", async () => {
    const transaction = {
      externalEffect: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
      },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $queryRaw: vi.fn(),
      thread: { update: vi.fn() },
      run: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn(),
      },
      secret: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      message: { findMany: vi.fn().mockResolvedValue([]) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      computer: { findMany: vi.fn() },
      computerExecutionLease: { findMany: vi.fn() },
      event: { create: vi.fn(), deleteMany: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
      ),
      computer: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      computerExecutionLease: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    } as unknown as PrismaClient;
    const notify = vi.fn().mockResolvedValue(undefined);
    const actor = {
      spaceId: "workspace-1",
      userId: "user-1",
    } as Actor;
    const target = {
      kind: "bot",
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
    } as ThreadTarget;

    await stopThreadRuns(
      {
        prisma,
        sandbox: {} as SandboxProvider,
        events: { notify } as never,
      },
      actor,
      target,
    );

    expect(transaction.event.create).not.toHaveBeenCalled();
    expect(transaction.event.deleteMany).not.toHaveBeenCalled();
    expect(transaction.thread.update).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("helper snapshot settlement", () => {
  it.each(["bot", "group"])("settles stale helpers on reload in a %s thread", async (kind) => {
    const runs = [
      { id: "paused", status: "waiting_input" },
      { id: "working", status: "running" },
    ].map((run) => ({
      ...run,
      botId: "bot-1",
      threadId: "thread-1",
      taskId: "task",
      trigger: "user",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      startedAt: null,
      completedAt: null,
    }));
    const liveEvents = runs.map((run, seq) => ({
      id: `event-${seq}`,
      threadId: "thread-1",
      runId: run.id,
      seq,
      type: "thread.subagent",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      payload: { agentId: run.id, name: "Helper", task: "Check", status: "running" },
    }));
    const previous = liveEvents[1]!;
    const history = [
      liveEvents[0]!,
      { ...previous, payload: { ...previous.payload, agentId: "before-resume" } },
      { ...previous, seq: 2, type: "run.waiting_input", payload: {} },
      { ...previous, seq: 3 },
    ];
    const tx = {
      externalEffect: { findMany: vi.fn(async () => []) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      message: { findMany: vi.fn().mockResolvedValue([]) },
      event: {
        findFirst: vi.fn().mockResolvedValue({ seq: 2 }),
        findMany: vi.fn(
          async (input: {
            where: { type: { in: string[] }; runId?: string | { in: string[] } };
          }) => {
            const { runId } = input.where;
            const runIds = typeof runId === "string" ? [runId] : runId?.in;
            return history.filter(
              (event) =>
                input.where.type.in.includes(event.type) &&
                (!runIds || runIds.includes(event.runId)),
            );
          },
        ),
      },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      run: { findFirst: botRunFindFirst(runs), findMany: groupRunFindMany({ active: runs }) },
    };
    const prisma = {
      $transaction: vi.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
      run: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;
    const result = await threadSnapshot({ prisma }, {
      kind,
      botId: "bot-1",
      threadId: "thread-1",
      bot: { computer: null },
      members: [],
    } as ThreadTarget);
    expect(result.messages.find((m) => m.id === "subagent:paused")?.blocks[0]).toMatchObject({
      status: "failed",
      result: "stopped",
    });
    // A bot thread loads live events for its one current run only; a group loads every active run.
    if (kind === "group") {
      expect(
        result.messages.find((m) => m.id === "subagent:before-resume")?.blocks[0],
      ).toMatchObject({ status: "failed", result: "stopped" });
      expect(result.messages.find((m) => m.id === "subagent:working")?.blocks[0]).toMatchObject({
        status: "running",
      });
    }
  });
});
