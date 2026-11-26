import type { RealtimeFanout } from "@rakazo/adapter-kit";
import {
  AI_DISCLOSURE_VERSION,
  BOT_SECRET_VALUE_MAX_LENGTH,
  encodeLoginSecret,
} from "@rakazo/contracts";
import { SKIPPED_APPROVAL_ANSWER } from "@rakazo/core";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "./client.js";
import { CrossSpaceCommunicationBlockedError } from "./cross-space-communication.js";
import {
  answerRunInput,
  answerWaitingRunWithTextInTransaction,
  appendEvent,
  claimSteering,
  clearThread,
  completedRunBlocks,
  createPendingSteeringRun,
  finalizeComputerControlRelease,
  finalizeRun,
  followThreadEvents,
  pauseRunForInput,
  pauseRunForTakeover,
  sendUserMessage,
  setApprovalWaitsFor,
  setMailApprovalOutcome,
  skipWaitingApprovalsInTransaction,
} from "./events.js";
import { RunHistoryWriteError } from "./messages.js";
import { AnswerTooLongError } from "./run-secrets.js";

class TestFanout implements RealtimeFanout {
  subscriber: ((payload: string) => void) | undefined;
  unsubscribed = false;

  describe() {
    return {
      id: "test",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { distributed: false, push: true },
    };
  }

  async publish(_topic: string, payload: string) {
    this.subscriber?.(payload);
  }

  async subscribe(_topic: string, subscriber: (payload: string) => void) {
    this.subscriber = subscriber;
    return async () => {
      this.unsubscribed = true;
      this.subscriber = undefined;
    };
  }

  async close() {}
}

function event(seq: number) {
  return {
    id: `event-${seq}`,
    spaceId: "workspace-1",
    threadId: "thread-1",
    botId: "bot-1",
    seq,
    type: "run.started",
    payload: {},
    runId: null,
    createdAt: new Date("2026-08-15T12:00:00.000Z"),
  };
}

describe("finalizeRun", () => {
  it("stamps the final steps block with wall-clock run duration", () => {
    const blocks = [
      { kind: "steps" as const, steps: [{ label: "Read file", count: 1 }] },
      { kind: "text" as const, text: "Then I checked it." },
      { kind: "steps" as const, steps: [{ label: "Run tests", count: 1 }] },
    ];

    expect(
      completedRunBlocks(
        blocks,
        new Date("2026-09-01T12:00:00.000Z"),
        new Date("2026-09-01T12:01:43.000Z"),
      ),
    ).toEqual([blocks[0], blocks[1], { ...blocks[2], durationMs: 103_000 }]);
    expect(completedRunBlocks(blocks, null, new Date())).toBe(blocks);
  });

  it("retries a transaction conflict without duplicating the terminal event or notification", async () => {
    const conflict = Object.assign(new Error("serialization conflict"), { code: "P2034" });
    const createEvent = vi.fn(async () => ({ threadId: "thread-1", seq: 0 }));
    const tx = {
      $queryRaw: vi.fn(async () => []),
      run: {
        findUnique: vi.fn(async () => ({ status: "running" })),
        findUniqueOrThrow: vi.fn(async () => ({ sourceMessage: null, userId: "user-1" })),
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn(async () => ({ count: 1 })) },
      message: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
      task: { updateMany: vi.fn(async () => ({ count: 1 })) },
      thread: { update: vi.fn(async () => ({ nextEventSeq: 1 })) },
      threadGoal: { findFirst: vi.fn(async () => null) },
      event: { create: createEvent, deleteMany: vi.fn(async () => ({ count: 0 })) },
      steeringMessage: {
        findMany: vi.fn(async () => []),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
      bot: { update: vi.fn(async () => ({})) },
    };
    const transaction = vi
      .fn()
      .mockRejectedValueOnce(conflict)
      .mockImplementation(async (operation: (client: typeof tx) => unknown) => operation(tx));
    const publish = vi.fn(async () => undefined);

    await expect(
      finalizeRun(
        { $transaction: transaction } as unknown as PrismaClient,
        {
          spaceId: "space-1",
          threadId: "thread-1",
          botId: "bot-1",
          runId: "run-1",
          taskId: "task-1",
          attemptId: "attempt-1",
          leaseOwner: "worker-1",
          leaseFence: 1,
          outcome: "failed",
          error: "failed",
        },
        { publish } as never,
      ),
    ).resolves.toEqual({ continuationRunId: null });
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(createEvent).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledOnce();
  });

  it("resumes a held messaging inbound as a messaging run", async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      run: {
        findUnique: vi.fn(async () => ({ status: "running", startedAt: null })),
        findUniqueOrThrow: vi.fn(async () => ({ sourceMessage: null, userId: "user-1" })),
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async () => ({ id: "run-reply" })),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn(async () => ({ count: 1 })) },
      message: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
      task: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async () => ({ id: "task-reply" })),
      },
      thread: { update: vi.fn(async () => ({ nextEventSeq: 1 })) },
      threadGoal: { findFirst: vi.fn(async () => null) },
      event: {
        create: vi.fn(async () => ({ threadId: "thread-1", seq: 0 })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      steeringMessage: {
        findMany: vi.fn(async () => [
          {
            id: "steer-1",
            userId: "user-1",
            originTrigger: "messaging",
            message: {
              id: "message-slack",
              seq: 4,
              blocks: [{ kind: "text", text: "Check the inbox" }],
            },
          },
        ]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      bot: { update: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      finalizeRun(prisma, {
        spaceId: "space-1",
        threadId: "thread-1",
        botId: "bot-1",
        runId: "intro-run",
        taskId: "intro-task",
        attemptId: "attempt-1",
        leaseOwner: "worker-1",
        leaseFence: 1,
        outcome: "failed",
        error: "intro failed",
      }),
    ).resolves.toEqual({ continuationRunId: "run-reply" });

    expect(tx.run.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trigger: "messaging",
        sourceMessageId: "message-slack",
        status: "queued",
      }),
    });
  });

  it("pins the continuation when every waited message chose the same model", async () => {
    const tx = {
      $queryRaw: vi.fn(async () => []),
      run: {
        findUnique: vi.fn(async () => ({ status: "running", startedAt: null })),
        findUniqueOrThrow: vi.fn(async () => ({ sourceMessage: null, userId: "user-1" })),
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async () => ({ id: "run-reply" })),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn(async () => ({ count: 1 })) },
      message: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
      task: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async () => ({ id: "task-reply" })),
      },
      thread: { update: vi.fn(async () => ({ nextEventSeq: 1 })) },
      threadGoal: { findFirst: vi.fn(async () => null) },
      event: {
        create: vi.fn(async () => ({ threadId: "thread-1", seq: 0 })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      steeringMessage: {
        findMany: vi.fn(async () => [
          {
            id: "steer-1",
            userId: "user-1",
            originTrigger: null,
            modelProvider: "openai-compatible",
            modelId: "private-model",
            thinkingLevel: "low",
            message: {
              id: "message-hook",
              seq: 4,
              blocks: [{ kind: "text", text: "Run the routine" }],
            },
          },
        ]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      bot: { update: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await finalizeRun(prisma, {
      spaceId: "space-1",
      threadId: "thread-1",
      botId: "bot-1",
      runId: "routine-run",
      taskId: "routine-task",
      attemptId: "attempt-1",
      leaseOwner: "worker-1",
      leaseFence: 1,
      outcome: "failed",
      error: "stopped",
    });

    expect(tx.run.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trigger: "follow_up",
        sourceMessageId: "message-hook",
        modelProvider: "openai-compatible",
        modelId: "private-model",
        thinkingLevel: "low",
        modelPinned: true,
      }),
    });
  });

  it("resumes a held group-channel message without taking a later direct message", async () => {
    const channel = {
      kind: "channel_message" as const,
      provider: "slack",
      channelId: "channel-1",
      fromAddress: "U1",
      fromLabel: "Pat",
      text: "What is the status?",
    };
    const tx = {
      $queryRaw: vi.fn(async () => []),
      run: {
        findUnique: vi.fn(async () => ({ status: "running", startedAt: null })),
        findUniqueOrThrow: vi.fn(async () => ({ sourceMessage: null, userId: "user-1" })),
        findMany: vi.fn(async () => []),
        findFirst: vi.fn(async () => null),
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async () => ({ id: "run-reply" })),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn(async () => ({ count: 1 })) },
      message: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
      task: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        create: vi.fn(async () => ({ id: "task-reply" })),
      },
      thread: { update: vi.fn(async () => ({ nextEventSeq: 1 })) },
      threadGoal: { findFirst: vi.fn(async () => null) },
      event: {
        create: vi.fn(async () => ({ threadId: "thread-1", seq: 0 })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      steeringMessage: {
        findMany: vi.fn(async () => [
          {
            id: "steer-channel",
            userId: "user-1",
            originTrigger: "messaging",
            message: { id: "message-channel", seq: 4, blocks: [channel] },
          },
          {
            id: "steer-dm",
            userId: "user-1",
            originTrigger: "messaging",
            message: {
              id: "message-dm",
              seq: 5,
              blocks: [{ kind: "text", text: "And privately?" }],
            },
          },
          {
            id: "steer-app",
            userId: "user-2",
            originTrigger: null,
            message: {
              id: "message-app",
              seq: 6,
              blocks: [{ kind: "text", text: "From the app" }],
            },
          },
        ]),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      bot: { update: vi.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      finalizeRun(prisma, {
        spaceId: "space-1",
        threadId: "thread-1",
        botId: "bot-1",
        runId: "routine-run",
        taskId: "routine-task",
        attemptId: "attempt-1",
        leaseOwner: "worker-1",
        leaseFence: 1,
        outcome: "failed",
        error: "routine failed",
      }),
    ).resolves.toEqual({ continuationRunId: "run-reply" });

    expect(tx.run.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        trigger: "messaging",
        sourceMessageId: "message-channel",
        userId: "user-1",
        status: "queued",
      }),
    });
    expect(tx.steeringMessage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["steer-channel"] }, runId: null },
      data: { runId: "run-reply", claimedAt: null },
    });
  });
});

describe("followThreadEvents", () => {
  it("does not lose a notification that arrives while querying", async () => {
    const fanout = new TestFanout();
    const findMany = vi
      .fn()
      .mockImplementationOnce(async () => {
        await fanout.publish("thread:thread-1", "wake");
        return [];
      })
      .mockResolvedValueOnce([event(0)])
      .mockResolvedValue([]);
    const prisma = { event: { findMany } } as unknown as PrismaClient;
    const abort = new AbortController();
    const stream = followThreadEvents(prisma, "thread-1", -1, fanout, abort.signal, 10_000);

    await expect(stream.next()).resolves.toMatchObject({ value: { seq: 0 }, done: false });
    expect(findMany).toHaveBeenCalledTimes(2);
    abort.abort();
    await stream.return(undefined);
    expect(fanout.unsubscribed).toBe(true);
  });

  it("periodically catches up when a signal is missed", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([event(0)]);
    const prisma = { event: { findMany } } as unknown as PrismaClient;
    const abort = new AbortController();
    const stream = followThreadEvents(prisma, "thread-1", -1, undefined, abort.signal, 1);

    await expect(stream.next()).resolves.toMatchObject({ value: { seq: 0 }, done: false });
    abort.abort();
    await stream.return(undefined);
  });
});

describe("finalizeComputerControlRelease", () => {
  it("clears the matching lease and appends its release event in one transaction", async () => {
    const fanout = new TestFanout();
    const publish = vi.spyOn(fanout, "publish");
    const tx = {
      computer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      bot: {
        findFirst: vi.fn().mockResolvedValue({
          computerId: "computer-1",
          thread: { id: "thread-1" },
        }),
      },
      run: {
        findUnique: vi.fn().mockResolvedValue({ status: "waiting_takeover" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 8 }) },
      event: {
        create: vi.fn().mockResolvedValue({
          ...event(7),
          type: "computer.takeover.released",
          payload: { holder: "none", leaseId: "lease-1", reason: "expired" },
        }),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      finalizeComputerControlRelease(
        prisma,
        {
          spaceId: "workspace-1",
          computerId: "computer-1",
          botId: "bot-1",
          runId: "run-1",
          leaseId: "lease-1",
          holder: "none",
          reason: "expired",
        },
        fanout,
      ),
    ).resolves.toEqual({ runId: "run-1" });

    expect(tx.computer.updateMany).toHaveBeenCalledWith({
      where: {
        id: "computer-1",
        spaceId: "workspace-1",
        controlBotId: "bot-1",
        controlLeaseId: "lease-1",
        controlRunId: "run-1",
      },
      data: {
        controlHolder: "none",
        controlLeaseId: null,
        controlLeaseExpiresAt: null,
        controlBotId: null,
        controlRunId: null,
      },
    });
    expect(tx.run.updateMany).toHaveBeenCalledWith({
      where: {
        id: "run-1",
        spaceId: "workspace-1",
        botId: "bot-1",
        status: "waiting_takeover",
      },
      data: { status: "queued", checkpoint: "takeover-skipped" },
    });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "computer.takeover.released",
          runId: "run-1",
          payload: { holder: "none", leaseId: "lease-1", reason: "expired" },
        }),
      }),
    );
    expect(publish).toHaveBeenCalledWith("thread:thread-1", JSON.stringify({ cursor: 7 }));
  });

  it("stamps a takeover checkpoint on a steered running run without clearing its lease", async () => {
    const tx = {
      computer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      bot: {
        findFirst: vi.fn().mockResolvedValue({
          computerId: "computer-1",
          thread: { id: "thread-1" },
        }),
      },
      run: {
        findUnique: vi.fn().mockResolvedValue({ status: "running" }),
        updateMany: vi.fn().mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 }),
      },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 8 }) },
      event: {
        create: vi.fn().mockResolvedValue({
          ...event(7),
          type: "computer.takeover.released",
          payload: { holder: "bot", leaseId: "lease-1", reason: "released" },
        }),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      finalizeComputerControlRelease(prisma, {
        spaceId: "workspace-1",
        computerId: "computer-1",
        botId: "bot-1",
        runId: "run-1",
        leaseId: "lease-1",
        holder: "bot",
        reason: "released",
      }),
    ).resolves.toEqual({ runId: "run-1" });

    expect(tx.run.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: "run-1",
        spaceId: "workspace-1",
        botId: "bot-1",
        status: "waiting_takeover",
      },
      data: { status: "queued", checkpoint: "takeover" },
    });
    expect(tx.run.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: "run-1",
        spaceId: "workspace-1",
        botId: "bot-1",
        status: { in: ["leased", "running"] },
      },
      data: { checkpoint: "takeover" },
    });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "computer.takeover.released",
          runId: "run-1",
        }),
      }),
    );
  });

  it("clears the lease even if its controlling bot was deleted", async () => {
    const tx = {
      computer: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      bot: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      finalizeComputerControlRelease(prisma, {
        spaceId: "workspace-1",
        computerId: "computer-1",
        botId: "deleted-bot",
        runId: null,
        leaseId: "lease-1",
        holder: "none",
        reason: "expired",
      }),
    ).resolves.toEqual({ runId: null });

    expect(tx.computer.updateMany).toHaveBeenCalledOnce();
  });
});

describe("pauseRunForInput", () => {
  it("stores the paused run, prompt, and status event in one transaction", async () => {
    const fanout = new TestFanout();
    const publish = vi.spyOn(fanout, "publish");
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      run: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          status: "running",
          createdAt: new Date("2026-08-16T12:00:00.000Z"),
          threadId: "thread-1",
        }),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 4 })
          .mockResolvedValueOnce({ nextEventSeq: 8 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: { create: vi.fn().mockResolvedValue({ id: "message-1" }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      pauseRunForInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          botId: "bot-1",
          runId: "run-1",
          attemptId: "attempt-1",
          leaseOwner: "worker-1",
          leaseFence: 3,
          blocks: [{ kind: "ask", text: "Which city?" }],
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          botId: "bot-1",
          runId: "run-1",
          role: "bot",
        }),
      }),
    );
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "running", leaseFence: 3 }),
        data: { status: "waiting_input", leaseOwner: null, leaseExpiresAt: null },
      }),
    );
    expect(tx.event.create.mock.calls.map(([input]) => input.data.type)).toEqual([
      "thread.message.created",
      "run.waiting_input",
    ]);
    expect(publish).toHaveBeenCalledWith("thread:thread-1", JSON.stringify({ cursor: 8 }));
  });

  it("reuses the pending approval card when a resumed run asks for the same effect again", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      run: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          status: "running",
          createdAt: new Date("2026-08-16T12:00:00.000Z"),
          threadId: "thread-1",
        }),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 9 }) },
      message: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "message-1",
            blocks: [
              {
                kind: "ask",
                text: "Send $300?",
                status: "pending",
                approvalEffectId: "effect-1",
                actions: [
                  { id: "allow", label: "Send" },
                  { id: "deny", label: "Deny" },
                ],
              },
            ],
          },
        ]),
        create: vi.fn(),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      pauseRunForInput(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        runId: "run-1",
        attemptId: "attempt-1",
        leaseOwner: "worker-1",
        leaseFence: 3,
        blocks: [
          {
            kind: "ask",
            text: "Send $300?",
            approvalEffectId: "effect-1",
            actions: [
              { id: "allow", label: "Send" },
              { id: "deny", label: "Deny" },
            ],
          },
        ],
      }),
    ).resolves.toBe(true);

    // One payment request keeps one live card; the run still waits on it.
    expect(tx.message.create).not.toHaveBeenCalled();
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "waiting_input" }) }),
    );
  });

  it("stores offered choice actions on the run checkpoint for resume", async () => {
    const fanout = new TestFanout();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      run: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          status: "running",
          createdAt: new Date("2026-08-16T12:00:00.000Z"),
          threadId: "thread-1",
        }),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 4 })
          .mockResolvedValueOnce({ nextEventSeq: 8 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: { create: vi.fn().mockResolvedValue({ id: "message-1" }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      pauseRunForInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          botId: "bot-1",
          runId: "run-1",
          attemptId: "attempt-1",
          leaseOwner: "worker-1",
          leaseFence: 3,
          blocks: [
            {
              kind: "ask",
              text: "Which token?",
              status: "pending",
              actions: [
                { id: "choice-1", label: "use [redacted]" },
                { id: "choice-2", label: "use plain" },
              ],
            },
          ],
          offeredActions: [
            { id: "choice-1", label: "use sk-live-choice-secret" },
            { id: "choice-2", label: "use plain" },
          ],
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "waiting_input",
          leaseOwner: null,
          leaseExpiresAt: null,
          checkpoint: JSON.stringify({
            kind: "choice_ask_v1",
            actions: [
              { id: "choice-1", label: "use sk-live-choice-secret" },
              { id: "choice-2", label: "use plain" },
            ],
          }),
        },
      }),
    );
  });
});

describe("pauseRunForTakeover", () => {
  it("stores the paused run, attempt, computer takeover mark, and event in one transaction", async () => {
    const fanout = new TestFanout();
    const publish = vi.spyOn(fanout, "publish");
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      run: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "waiting_takeover" }),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      computer: {
        findFirst: vi.fn().mockResolvedValue({
          controlHolder: "none",
          controlBotId: null,
          controlLeaseId: null,
          controlLeaseExpiresAt: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 8 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      pauseRunForTakeover(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          botId: "bot-1",
          runId: "run-1",
          attemptId: "attempt-1",
          leaseOwner: "worker-1",
          leaseFence: 3,
          reason: "Sign in",
          computerId: "computer-1",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "running", leaseFence: 3 }),
        data: {
          status: "waiting_takeover",
          leaseOwner: null,
          leaseExpiresAt: null,
          checkpoint: null,
        },
      }),
    );
    expect(tx.attempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "waiting_takeover" }) }),
    );
    expect(tx.computer.updateMany).toHaveBeenCalledWith({
      where: { id: "computer-1", spaceId: "workspace-1" },
      data: {
        state: "running",
        controlHolder: "none",
        controlLeaseId: null,
        controlLeaseExpiresAt: null,
        controlBotId: null,
        controlRunId: "run-1",
      },
    });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "computer.takeover.requested",
          payload: {
            reason: "Sign in",
            takeoverRequested: true,
            retainedControl: false,
          },
        }),
      }),
    );
    expect(publish).toHaveBeenCalledWith("thread:thread-1", JSON.stringify({ cursor: 7 }));
  });

  it("keeps an active user control lease and only binds controlRunId", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      run: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "waiting_takeover" }),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      computer: {
        findFirst: vi.fn().mockResolvedValue({
          controlHolder: "user",
          controlBotId: "bot-1",
          controlLeaseId: "lease-1",
          controlLeaseExpiresAt: expiresAt,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 8 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      pauseRunForTakeover(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        runId: "run-1",
        attemptId: "attempt-1",
        leaseOwner: "worker-1",
        leaseFence: 3,
        reason: "Sign in",
        computerId: "computer-1",
      }),
    ).resolves.toBe(true);

    expect(tx.computer.updateMany).toHaveBeenCalledWith({
      where: { id: "computer-1", spaceId: "workspace-1" },
      data: { state: "running", controlRunId: "run-1" },
    });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({ retainedControl: true, takeoverRequested: true }),
        }),
      }),
    );
  });

  it("preserves another bot's active user lease without binding this run to it", async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "computer-1" }]),
      run: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "waiting_takeover" }),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      computer: {
        findFirst: vi.fn().mockResolvedValue({
          controlHolder: "user",
          controlBotId: "other-bot",
          controlLeaseId: "lease-other",
          controlLeaseExpiresAt: expiresAt,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 8 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      pauseRunForTakeover(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        runId: "run-1",
        attemptId: "attempt-1",
        leaseOwner: "worker-1",
        leaseFence: 3,
        reason: "Sign in",
        computerId: "computer-1",
      }),
    ).resolves.toBe(true);

    expect(tx.computer.updateMany).toHaveBeenCalledWith({
      where: { id: "computer-1", spaceId: "workspace-1" },
      data: { state: "running" },
    });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({ retainedControl: false, takeoverRequested: true }),
        }),
      }),
    );
  });
});

describe("skipWaitingApprovalsInTransaction", () => {
  const approval = (id: string) => ({
    kind: "ask",
    approvalEffectId: id,
    text: "Send an email?",
    status: "pending",
    actions: [
      { id: "allow", label: "Allow once" },
      { id: "always", label: "Always allow this" },
      { id: "deny", label: "Deny" },
    ],
  });
  const txFor = (messages: Array<{ id: string; blocks: unknown[] }>) => ({
    $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
    message: {
      findMany: vi.fn().mockResolvedValue(messages),
      update: vi.fn().mockResolvedValue({}),
    },
    run: {
      findFirst: vi.fn().mockResolvedValue({ botId: "bot-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
    },
    externalEffect: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    approvalRule: { upsert: vi.fn(), create: vi.fn() },
    thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 4 }) },
    event: {
      create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
        ...event(data.seq),
        type: data.type,
      })),
    },
  });
  const input = { spaceId: "workspace-1", threadId: "thread-1", runId: "run-1" };

  it("closes every open approval card as skipped, denies the effects and resumes the run", async () => {
    const tx = txFor([
      { id: "m-2", blocks: [approval("effect-2")] },
      { id: "m-1", blocks: [approval("effect-1")] },
    ]);
    await expect(skipWaitingApprovalsInTransaction(tx as never, input)).resolves.toMatchObject({
      threadId: "thread-1",
    });
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "queued" } }),
    );
    for (const call of tx.externalEffect.updateMany.mock.calls) {
      expect(call[0].data.status).toBe("denied");
      expect(call[0].data.result.note).toContain("moved on without approving");
    }
    expect(tx.externalEffect.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.message.update).toHaveBeenCalledTimes(2);
    expect(tx.message.update.mock.calls[0]![0].data.blocks[0]).toMatchObject({
      status: "answered",
      answer: "skipped",
    });
    expect(tx.approvalRule.upsert).not.toHaveBeenCalled();
  });

  it("leaves a secret request, a question and a run that no longer waits alone", async () => {
    const secret = { kind: "ask", text: "Paste the key", status: "pending", input: "secret" };
    const question = { kind: "ask", text: "Which city?", status: "pending" };
    for (const blocks of [[secret], [question], [approval("effect-1"), secret]]) {
      const tx = txFor([{ id: "m-1", blocks }]);
      await expect(skipWaitingApprovalsInTransaction(tx as never, input)).resolves.toBeNull();
      expect(tx.run.updateMany).not.toHaveBeenCalled();
      expect(tx.externalEffect.updateMany).not.toHaveBeenCalled();
    }
    const gone = txFor([{ id: "m-1", blocks: [approval("effect-1")] }]);
    gone.run.findFirst.mockResolvedValue(null);
    await expect(skipWaitingApprovalsInTransaction(gone as never, input)).resolves.toBeNull();
    const raced = txFor([{ id: "m-1", blocks: [approval("effect-1")] }]);
    raced.run.updateMany.mockResolvedValue({ count: 0 });
    await expect(skipWaitingApprovalsInTransaction(raced as never, input)).resolves.toBeNull();
    expect(raced.externalEffect.updateMany).not.toHaveBeenCalled();
  });
});

describe("answerRunInput", () => {
  it("answers only the selected pending prompt and publishes its update", async () => {
    const fanout = new TestFanout();
    const publish = vi.spyOn(fanout, "publish");
    publish.mockRejectedValueOnce(new Error("realtime unavailable"));
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              text: "Which city?",
              status: "pending",
              actions: [
                { id: "choice-1", label: "Berlin" },
                { id: "choice-2", label: "Paris" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-2" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          status: "queued",
          createdAt: new Date("2026-08-16T12:00:00.000Z"),
          threadId: "thread-1",
        }),
      },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "choice-2",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "waiting_input" }),
        data: { status: "queued", checkpoint: null },
      }),
    );
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: {
        blocks: [
          {
            kind: "ask",
            text: "Which city?",
            status: "answered",
            answer: "choice-2",
            actions: [
              { id: "choice-1", label: "Berlin" },
              { id: "choice-2", label: "Paris" },
            ],
          },
        ],
      },
    });
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { runs: { some: { id: "run-1" } } },
      data: { prompt: "Selected choice choice-2: Paris" },
    });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "thread.message.updated", botId: "bot-2" }),
      }),
    );
    expect(publish).toHaveBeenCalledWith("thread:thread-1", JSON.stringify({ cursor: 9 }));
  });

  it("keeps a routine's instructions and every earlier answer across choice resumes", async () => {
    // A routine run sees no thread history: its resumed attempt only has the task prompt.
    const answerChoice = async (prompt: string, question: string, answer: string) => {
      const tx = {
        // Answering a card records the person's decision for precedent.
        approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
        $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
        message: {
          findFirst: vi.fn().mockResolvedValue({
            id: "message-1",
            blocks: [
              {
                kind: "ask",
                text: question,
                status: "pending",
                actions: [
                  { id: "choice-1", label: "Two people" },
                  { id: "choice-2", label: "Italian" },
                ],
              },
            ],
          }),
          update: vi.fn().mockResolvedValue({ id: "message-1" }),
        },
        run: {
          findFirst: vi.fn().mockResolvedValue({
            botId: "bot-2",
            trigger: "routine",
            task: { prompt },
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({
            status: "queued",
            createdAt: new Date("2026-08-16T12:00:00.000Z"),
            threadId: "thread-1",
          }),
        },
        task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
        event: {
          create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
            ...event(data.seq),
            type: data.type,
          })),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      const prisma = {
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;
      await expect(
        answerRunInput(prisma, {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer,
        }),
      ).resolves.toBe(true);
      return (tx.task.updateMany.mock.calls[0]![0] as { data: { prompt: string } }).data.prompt;
    };

    const afterFirst = await answerChoice("Plan tonight's dinner.", "Who is eating?", "choice-1");
    expect(afterFirst).toBe(
      "Plan tonight's dinner.\n\nWho is eating?\nAnswer: Selected choice choice-1: Two people",
    );
    const afterSecond = await answerChoice(afterFirst, "Which cuisine?", "choice-2");
    expect(afterSecond).toBe(
      [
        "Plan tonight's dinner.",
        "Who is eating?\nAnswer: Selected choice choice-1: Two people",
        "Which cuisine?\nAnswer: Selected choice choice-2: Italian",
      ].join("\n\n"),
    );
  });

  it("records a spoken call answer as a user utterance with the call identity", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [{ kind: "ask", text: "Which city?", status: "pending" }],
        }),
        create: vi.fn().mockResolvedValue({ id: "user-answer" }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-2", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          status: "queued",
          startedAt: new Date("2026-08-16T12:00:00.000Z"),
          threadId: "thread-1",
        }),
      },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: { update: vi.fn().mockResolvedValue({ nextMessageSeq: 3, nextEventSeq: 5 }) },
      event: {
        create: vi.fn(
          async ({ data }: { data: { seq: number; type: string; payload: unknown } }) => ({
            ...event(data.seq),
            type: data.type,
            payload: data.payload,
          }),
        ),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "Toronto",
          clientNonce: "call:call-1:answer-1",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        threadId: "thread-1",
        role: "user",
        botId: "bot-2",
        runId: "run-1",
        clientNonce: "call:call-1:answer-1",
        blocks: [{ kind: "text", text: "Toronto" }],
      }),
    });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "thread.message.created",
          payload: expect.objectContaining({
            messageId: "user-answer",
            role: "user",
            callId: "call-1",
          }),
        }),
      }),
    );
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { runs: { some: { id: "run-1" } } },
      data: { prompt: "Toronto" },
    });
  });

  it.each([undefined, "call:call-1:choice-1"])(
    "resumes with the full offered choice label (call nonce: %s)",
    async (clientNonce) => {
      const fanout = new TestFanout();
      const secret = "sk-live-choice-secret";
      const tx = {
        // Answering a card records the person's decision for precedent.
        approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
        $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
        message: {
          findFirst: vi.fn().mockResolvedValue({
            id: "message-1",
            blocks: [
              {
                kind: "ask",
                text: "Which token?",
                status: "pending",
                actions: [
                  { id: "choice-1", label: `use [redacted]` },
                  { id: "choice-2", label: "use plain" },
                ],
              },
            ],
          }),
          create: vi.fn().mockResolvedValue({ id: "spoken-choice" }),
          update: vi.fn().mockResolvedValue({ id: "message-1" }),
        },
        run: {
          findFirst: vi.fn().mockResolvedValue({
            botId: "bot-2",
            userId: "user-1",
            checkpoint: JSON.stringify({
              kind: "choice_ask_v1",
              actions: [
                { id: "choice-1", label: `use ${secret}` },
                { id: "choice-2", label: "use plain" },
              ],
            }),
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({
            status: "queued",
            createdAt: new Date("2026-08-16T12:00:00.000Z"),
            threadId: "thread-1",
          }),
        },
        task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 11 }) },
        event: {
          create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
            ...event(data.seq),
            type: data.type,
          })),
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };
      const prisma = {
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;

      await expect(
        answerRunInput(
          prisma,
          {
            spaceId: "workspace-1",
            threadId: "thread-1",
            runId: "run-1",
            messageId: "message-1",
            answeredByUserId: "user-1",
            answer: "choice-1",
            clientNonce,
          },
          fanout,
        ),
      ).resolves.toBe(true);

      expect(tx.task.updateMany).toHaveBeenCalledWith({
        where: { runs: { some: { id: "run-1" } } },
        data: { prompt: `Selected choice choice-1: use ${secret}` },
      });
      expect(tx.message.update).toHaveBeenCalledWith({
        where: { id: "message-1" },
        data: {
          blocks: [
            {
              kind: "ask",
              text: "Which token?",
              status: "answered",
              answer: "choice-1",
              actions: [
                { id: "choice-1", label: "use [redacted]" },
                { id: "choice-2", label: "use plain" },
              ],
            },
          ],
        },
      });
      expect(tx.run.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "queued", checkpoint: null },
        }),
      );
    },
  );

  it("answers a custom free-text reply that is not an offered choice", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              text: "Which city?",
              status: "pending",
              actions: [
                { id: "choice-1", label: "Berlin" },
                { id: "choice-2", label: "Seoul" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-2", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          status: "queued",
          createdAt: new Date("2026-08-16T12:00:00.000Z"),
          threadId: "thread-1",
        }),
      },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 12 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "Toronto",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "queued", checkpoint: null },
      }),
    );
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { runs: { some: { id: "run-1" } } },
      data: { prompt: "Toronto" },
    });
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: {
        blocks: [
          {
            kind: "ask",
            text: "Which city?",
            status: "answered",
            answer: "Toronto",
            actions: [
              { id: "choice-1", label: "Berlin" },
              { id: "choice-2", label: "Seoul" },
            ],
          },
        ],
      },
    });
  });

  it("treats a typed choice label as selecting that option", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              text: "Which city?",
              status: "pending",
              actions: [
                { id: "choice-1", label: "Berlin" },
                { id: "choice-2", label: "Seoul" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-2", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          status: "queued",
          createdAt: new Date("2026-08-16T12:00:00.000Z"),
          threadId: "thread-1",
        }),
      },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 13 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "Seoul",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { runs: { some: { id: "run-1" } } },
      data: { prompt: "Selected choice choice-2: Seoul" },
    });
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: {
        blocks: [
          {
            kind: "ask",
            text: "Which city?",
            status: "answered",
            answer: "choice-2",
            actions: [
              { id: "choice-1", label: "Berlin" },
              { id: "choice-2", label: "Seoul" },
            ],
          },
        ],
      },
    });
  });
});

describe("answerWaitingRunWithTextInTransaction", () => {
  it("answers a pending question ask with composer text", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "message-1",
            blocks: [{ kind: "ask", text: "Which city?", status: "pending" }],
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [{ kind: "ask", text: "Which city?", status: "pending" }],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-2", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      task: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 4 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };

    await expect(
      answerWaitingRunWithTextInTransaction(tx as never, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        answeredByUserId: "user-1",
        answer: "Paris",
      }),
    ).resolves.toMatchObject({ threadId: "thread-1" });
    expect(tx.task.updateMany).toHaveBeenCalledWith({
      where: { runs: { some: { id: "run-1" } } },
      data: { prompt: "Paris" },
    });
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "queued" },
      }),
    );
  });

  it("never resolves a payment card from relayed 'Yes, pay' text", async () => {
    const tx = {
      message: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "message-1",
            blocks: [
              {
                kind: "ask",
                approvalEffectId: "effect-money",
                text: "Send $1,200.00?",
                status: "pending",
                actions: [
                  { id: "allow", label: "Send" },
                  { id: "deny", label: "Deny" },
                ],
              },
            ],
          },
        ]),
      },
      run: { findFirst: vi.fn(), updateMany: vi.fn() },
      task: { updateMany: vi.fn() },
      externalEffect: { update: vi.fn() },
    };

    await expect(
      answerWaitingRunWithTextInTransaction(tx as never, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        answeredByUserId: "user-1",
        answer: "Yes, pay $1,200 to Acme",
      }),
    ).resolves.toBeNull();
    expect(tx.run.updateMany).not.toHaveBeenCalled();
    expect(tx.externalEffect.update).not.toHaveBeenCalled();
  });

  it("leaves approval and secret cards on the dedicated answer path", async () => {
    const tx = {
      message: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "message-1",
            blocks: [
              {
                kind: "ask",
                approvalEffectId: "effect-1",
                text: "Review before writing",
                status: "pending",
                actions: [
                  { id: "allow", label: "Allow once" },
                  { id: "deny", label: "Deny" },
                ],
              },
            ],
          },
        ]),
      },
      run: { findFirst: vi.fn(), updateMany: vi.fn() },
      task: { updateMany: vi.fn() },
    };

    await expect(
      answerWaitingRunWithTextInTransaction(tx as never, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        answeredByUserId: "user-1",
        answer: "allow",
      }),
    ).resolves.toBeNull();
    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });
});

describe("answerRunInput", () => {
  it("approves consequential actions without overwriting the task prompt", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({ id: "effect-1", status: "intended" }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "allow",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(tx.externalEffect.findFirst).toHaveBeenCalledWith({
      where: {
        id: "effect-1",
        spaceId: "workspace-1",
        runId: "run-1",
        status: "intended",
      },
    });
    expect(tx.externalEffect.update).toHaveBeenCalledWith({
      where: { id: "effect-1" },
      data: { status: "approved" },
    });
  });

  it("approves and upserts always-allow without overwriting the task prompt", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "effect-1", status: "intended", kind: "destination.write" }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(tx.externalEffect.update).toHaveBeenCalledWith({
      where: { id: "effect-1" },
      data: { status: "approved" },
    });
    // Always allow replaces any rule for the tool (one rule per target).
    expect(tx.actionApprovalRule.deleteMany).toHaveBeenCalled();
    expect(tx.actionApprovalRule.create).toHaveBeenCalledWith({
      data: {
        spaceId: "workspace-1",
        createdByUserId: "user-1",
        botId: null,
        routineId: null,
        effect: "always_allow",
        matchKind: "tool",
        matchValue: "destination.write",
      },
    });
  });

  it("stores a site rule when Always allow is chosen on a browser card", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "browser_navigate",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.actionApprovalRule.create).toHaveBeenCalledWith({
      data: {
        spaceId: "workspace-1",
        createdByUserId: "user-1",
        botId: null,
        routineId: null,
        effect: "always_allow",
        matchKind: "site",
        matchValue: "example.com",
      },
    });
  });

  it("saves a rule for the agent when Allow all sites is chosen on a fetch card", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_bot_sites", label: "Allow all sites for this agent" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "web_fetch",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_bot_sites",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.actionApprovalRule.create).toHaveBeenCalledWith({
      data: {
        spaceId: "workspace-1",
        createdByUserId: "user-1",
        botId: "bot-1",
        routineId: null,
        effect: "always_allow",
        matchKind: "tool",
        matchValue: "web_fetch",
      },
    });
  });

  it("saves a rule for the routine when Always for this routine is chosen", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_routine", label: "Always for this routine" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          routineId: "routine-1",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "write_file",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_routine",
        },
        fanout,
      ),
    ).resolves.toBe(true);

    expect(tx.actionApprovalRule.create).toHaveBeenCalledWith({
      data: {
        spaceId: "workspace-1",
        createdByUserId: "user-1",
        botId: null,
        routineId: "routine-1",
        effect: "always_allow",
        matchKind: "tool",
        matchValue: "write_file",
      },
    });
  });

  it("refuses Always for this routine outside a routine run", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_routine", label: "Always for this routine" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          routineId: null,
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "write_file",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_routine",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });

  it("does not save a routine rule when the card was already skipped", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "answered",
              answer: SKIPPED_APPROVAL_ANSWER,
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_routine", label: "Always for this routine" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          routineId: "routine-1",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "write_file",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_routine",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });

  it("refuses Always for this routine in a webhook run", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_routine", label: "Always for this routine" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "write_file",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_routine",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });

  it("refuses Always for this routine for a firewalled agent", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_routine", label: "Always for this routine" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          routineId: "routine-1",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: true }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "write_file",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_routine",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });

  it("refuses Always for this routine in a thread marked as holding meeting text", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_routine", label: "Always for this routine" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          routineId: "routine-1",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "write_file",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: new Date() }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_routine",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });

  it("refuses Allow all sites for a firewalled agent", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_bot_sites", label: "Allow all sites for this agent" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: true }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "web_fetch",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_bot_sites",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });

  it("refuses Allow all sites in a webhook run", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_bot_sites", label: "Allow all sites for this agent" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          routineId: "routine-1",
          trigger: "webhook",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "web_fetch",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_bot_sites",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });

  it("refuses Allow all sites in a tainted run", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_bot_sites", label: "Allow all sites for this agent" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          externalTaint: true,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "web_fetch",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: null }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_bot_sites",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });

  it("refuses Allow all sites in a thread marked as holding meeting text", async () => {
    const fanout = new TestFanout();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "always_bot_sites", label: "Allow all sites for this agent" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({
          botId: "bot-1",
          userId: "user-1",
          trigger: "user",
          externalTaint: false,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ userId: "user-1", status: "queued" }),
      },
      bot: { findFirst: vi.fn().mockResolvedValue({ audience: "internal", firewall: false }) },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi.fn().mockResolvedValue({
          id: "effect-1",
          status: "intended",
          kind: "web_fetch",
          request: { url: "https://docs.example.com/guide" },
        }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: "rule-1" }),
        upsert: vi.fn(),
      },
      thread: {
        update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }),
        findFirst: vi.fn().mockResolvedValue({ meetingTaintedAt: new Date() }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "always_bot_sites",
        },
        fanout,
      ),
    ).resolves.toBe(false);

    expect(tx.actionApprovalRule.create).not.toHaveBeenCalled();
  });
  it("does not let another workspace member create an always-allow rule for the run owner", async () => {
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "run-owner" }),
        findUnique: vi.fn().mockResolvedValue({ userId: "run-owner" }),
        updateMany: vi.fn(),
      },
      externalEffect: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "effect-1", status: "intended", kind: "destination.write" }),
      },
      actionApprovalRule: { upsert: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "message-1",
        answeredByUserId: "other-member",
        answer: "always",
      }),
    ).resolves.toBe(false);

    expect(tx.run.updateMany).not.toHaveBeenCalled();
    expect(tx.actionApprovalRule.upsert).not.toHaveBeenCalled();
  });

  it("does not queue a run when an approval card has no matching effect", async () => {
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "missing-effect",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1" }),
        updateMany: vi.fn(),
      },
      externalEffect: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "message-1",
        answeredByUserId: "user-1",
        answer: "allow",
      }),
    ).resolves.toBe(false);
    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });

  it("does not queue a run for an action that the approval card did not offer", async () => {
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before writing",
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1" }),
        updateMany: vi.fn(),
      },
      externalEffect: { findFirst: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "message-1",
        answeredByUserId: "user-1",
        answer: "always",
      }),
    ).resolves.toBe(false);
    expect(tx.externalEffect.findFirst).not.toHaveBeenCalled();
    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an already answered prompt without queuing the run", async () => {
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [{ kind: "ask", text: "Which city?", status: "answered", answer: "Paris" }],
        }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1" }),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "message-1",
        answeredByUserId: "user-1",
        answer: "Rome",
      }),
    ).resolves.toBe(false);
    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    { name: "example_api", origin: "https://api.example.test", auth: { type: "bearer" } },
  ])("stores secret asks without writing plaintext to the task prompt (%j)", async (credential) => {
    const fanout = new TestFanout();
    const store = vi.fn().mockResolvedValue(undefined);
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              text: "Enter your code",
              input: "secret",
              purpose: "api_key",
              ...(credential ? { credential } : {}),
              status: "pending",
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      task: { updateMany: vi.fn() },
      externalEffect: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "123456",
        },
        fanout,
        { store },
      ),
    ).resolves.toBe(true);

    expect(store).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        plaintext: "123456",
        botId: "bot-1",
        userId: "user-1",
        spaceId: "workspace-1",
        credential,
      }),
    );
    expect(tx.task.updateMany).not.toHaveBeenCalled();
    expect(JSON.stringify(tx.event.create.mock.calls)).not.toContain("123456");
    expect(tx.externalEffect.updateMany).toHaveBeenCalledWith({
      where: {
        runId: "run-1",
        spaceId: "workspace-1",
        kind: "request_secret",
        status: "intended",
      },
      data: {
        status: "approved",
        ...(credential ? { result: { credentialSaved: credential } } : {}),
      },
    });
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: {
        blocks: [
          {
            kind: "ask",
            text: "Enter your code",
            input: "secret",
            purpose: "api_key",
            ...(credential ? { credential } : {}),
            status: "answered",
            answer: "",
          },
        ],
      },
    });
  });

  it("does not let another workspace member save a credential as the run owner", async () => {
    const store = vi.fn();
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "owner" }),
        updateMany: vi.fn(),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              text: "API key",
              input: "secret",
              status: "pending",
              credential: {
                name: "example_api",
                origin: "https://api.example.test",
                auth: { type: "bearer" },
              },
            },
          ],
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    expect(
      await answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "other-member",
          answer: "fake-key",
        },
        new TestFanout(),
        { store },
      ),
    ).toBe(false);
    expect(store).not.toHaveBeenCalled();
    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });

  describe("login cards", () => {
    const login = {
      name: "site_login",
      origin: "https://login.example.test",
      auth: { type: "login" },
    };
    function loginFixture(credential: object = login) {
      const store = vi.fn().mockResolvedValue(undefined);
      const tx = {
        // Answering a card records the person's decision for precedent.
        approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
        $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
        message: {
          findFirst: vi.fn().mockResolvedValue({
            id: "message-1",
            blocks: [
              {
                kind: "ask",
                text: "Sign in",
                input: "secret",
                purpose: "password",
                credential,
                status: "pending",
              },
            ],
          }),
          update: vi.fn().mockResolvedValue({ id: "message-1" }),
        },
        run: {
          findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
          findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        task: { updateMany: vi.fn() },
        externalEffect: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
        event: {
          create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
            ...event(data.seq),
            type: data.type,
          })),
        },
      };
      const prisma = {
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;
      const answer = (username?: string, password = "fake-password-1") =>
        answerRunInput(
          prisma,
          {
            spaceId: "workspace-1",
            threadId: "thread-1",
            runId: "run-1",
            messageId: "message-1",
            answeredByUserId: "user-1",
            answer: password,
            ...(username !== undefined ? { username } : {}),
          },
          new TestFanout(),
          { store },
        );
      return { store, tx, answer };
    }

    it("stores the username and password together and records neither", async () => {
      const { store, tx, answer } = loginFixture();
      await expect(answer("  fake-user@example.test ")).resolves.toBe(true);
      expect(store).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: login,
          plaintext: encodeLoginSecret({
            username: "fake-user@example.test",
            password: "fake-password-1",
          }),
        }),
      );
      const recorded = JSON.stringify([tx.event.create.mock.calls, tx.message.update.mock.calls]);
      expect(recorded).not.toContain("fake-user@example.test");
      expect(recorded).not.toContain("fake-password-1");
    });

    it.each(["", "   "])("requires a username (%j)", async (username) => {
      const { store, tx, answer } = loginFixture();
      await expect(answer(username)).resolves.toBe(false);
      await expect(answer()).resolves.toBe(false);
      expect(store).not.toHaveBeenCalled();
      expect(tx.run.updateMany).not.toHaveBeenCalled();
    });

    it("rejects an oversized password before queueing, not with an internal error", async () => {
      const { store, tx, answer } = loginFixture();
      await expect(answer("fake-user", "x".repeat(4097))).resolves.toBe(false);
      expect(store).not.toHaveBeenCalled();
      expect(tx.run.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a username on a card that is not a login", async () => {
      const { store, answer } = loginFixture({ ...login, auth: { type: "bearer" } });
      await expect(answer("fake-user")).resolves.toBe(false);
      expect(store).not.toHaveBeenCalled();
    });
  });

  it("rejects secret asks when no run secret writer is configured", async () => {
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              text: "Enter your code",
              input: "secret",
              status: "pending",
            },
          ],
        }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      answerRunInput(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "message-1",
        answeredByUserId: "user-1",
        answer: "123456",
      }),
    ).resolves.toBe(false);

    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });
});

describe("sendUserMessage", () => {
  it("creates the message, run, and event in one transaction and publishes once", async () => {
    const fanout = new TestFanout();
    const publish = vi.spyOn(fanout, "publish");
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn(),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      run: {
        create: vi.fn().mockResolvedValue({ id: "run-1" }),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
          runId: "run-1",
        })),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      sendUserMessage(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          botId: "bot-1",
          userId: "user-1",
          blocks: [{ kind: "text", text: "hello" }],
          prompt: "hello",
          trigger: "user",
          clientNonce: "nonce-1",
          linkMessageToRun: true,
        },
        fanout,
      ),
    ).resolves.toEqual({ messageId: "message-1", seq: 4, taskId: "task-1", runId: "run-1" });

    expect(tx.run.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trigger: "user",
          clientNonce: "send:message-1",
          sourceMessageId: "message-1",
        }),
      }),
    );
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: { runId: "run-1" },
    });
    expect(tx.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "thread.message.created", runId: "run-1" }),
      }),
    );
    expect(publish).toHaveBeenCalledWith("thread:thread-1", JSON.stringify({ cursor: 8 }));
  });

  it("pins an agreed inbound model onto the run it creates", async () => {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn(),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      run: {
        create: vi.fn().mockResolvedValue({ id: "run-1" }),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
          runId: "run-1",
        })),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await sendUserMessage(prisma, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
      userId: "user-1",
      blocks: [{ kind: "text", text: "ping" }],
      prompt: "ping",
      trigger: "webhook",
      modelPin: {
        modelProvider: "openai-compatible",
        modelId: "private-model",
        thinkingLevel: "low",
      },
    });

    expect(tx.run.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trigger: "webhook",
          modelProvider: "openai-compatible",
          modelId: "private-model",
          thinkingLevel: "low",
          modelPinned: true,
        }),
      }),
    );
  });

  function routineAttributionTx(routine: Record<string, unknown> | null) {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn(),
      },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      run: {
        create: vi.fn().mockResolvedValue({ id: "run-1" }),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      routine: { findFirst: vi.fn().mockResolvedValue(routine) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
          runId: "run-1",
        })),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    return { tx, prisma };
  }

  it("attributes an inbound run to a routine owned by this bot and space", async () => {
    const { tx, prisma } = routineAttributionTx({ id: "routine-1" });
    await sendUserMessage(prisma, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
      userId: "user-1",
      blocks: [{ kind: "text", text: "ping" }],
      prompt: "ping",
      trigger: "webhook",
      routineId: "routine-1",
    });

    expect(tx.routine.findFirst).toHaveBeenCalledWith({
      where: { id: "routine-1", botId: "bot-1", spaceId: "workspace-1" },
      select: { id: true },
    });
    expect(tx.run.create.mock.calls[0]![0].data.routineId).toBe("routine-1");
  });

  it("drops a routineId from another bot or space", async () => {
    const { tx, prisma } = routineAttributionTx(null);
    await sendUserMessage(prisma, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
      userId: "user-1",
      blocks: [{ kind: "text", text: "ping" }],
      prompt: "ping",
      trigger: "webhook",
      routineId: "someone-elses-routine",
    });

    expect(tx.run.create.mock.calls[0]![0].data.routineId ?? null).toBeNull();
  });

  it("persists steering instead of starting a parallel run when the bot is busy", async () => {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      steeringMessage: { create: vi.fn() },
      task: { create: vi.fn() },
      run: {
        findMany: vi.fn().mockResolvedValue([{ id: "run-0", taskId: "task-0", trigger: "user" }]),
        findUnique: vi.fn().mockResolvedValue({ status: "running" }),
        create: vi.fn(),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      sendUserMessage(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        userId: "user-1",
        blocks: [{ kind: "text", text: "hello" }],
        prompt: "hello",
        trigger: "follow_up",
      }),
    ).resolves.toEqual({ messageId: "message-1", seq: 4, taskId: null, runId: "run-0" });

    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.run.create).not.toHaveBeenCalled();
    expect(tx.message.update).toHaveBeenCalledWith({
      where: { id: "message-1" },
      data: { runId: "run-0" },
    });
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: {
        messageId: "message-1",
        botId: "bot-1",
        userId: "user-1",
        unattended: false,
        externalTaint: false,
        runId: "run-0",
      },
    });
  });

  it("keeps an agreed inbound model on steering while a routine run is busy", async () => {
    const tx = {
      bot: { findUnique: vi.fn().mockResolvedValue({ modelCredentialId: null }) },
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      steeringMessage: { create: vi.fn() },
      task: { create: vi.fn() },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "run-routine", taskId: "task-routine", trigger: "routine" }]),
        findUnique: vi.fn().mockResolvedValue({ status: "running" }),
        create: vi.fn(),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await sendUserMessage(prisma, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
      userId: "user-1",
      blocks: [{ kind: "text", text: "ping" }],
      prompt: "ping",
      trigger: "webhook",
      modelPin: {
        modelProvider: "openai-compatible",
        modelId: "private-model",
        thinkingLevel: "low",
      },
    });

    expect(tx.run.create).not.toHaveBeenCalled();
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: {
        messageId: "message-1",
        botId: "bot-1",
        userId: "user-1",
        unattended: true,
        externalTaint: true,
        runId: null,
        modelProvider: "openai-compatible",
        modelId: "private-model",
        thinkingLevel: "low",
      },
    });
  });

  describe("steering and connection pins", () => {
    async function steer(
      busyRun: Record<string, unknown>,
      modelCredentialId: string | null,
      botPin: string | null = null,
    ) {
      const tx = {
        thread: {
          update: vi
            .fn()
            .mockResolvedValueOnce({ nextMessageSeq: 5 })
            .mockResolvedValueOnce({ nextEventSeq: 9 }),
        },
        message: {
          create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
          update: vi.fn().mockResolvedValue({ id: "message-1" }),
        },
        steeringMessage: { create: vi.fn() },
        bot: { findUnique: vi.fn().mockResolvedValue({ modelCredentialId: botPin }) },
        task: { create: vi.fn() },
        run: {
          findMany: vi.fn().mockResolvedValue([{ id: "run-0", taskId: "task-0", ...busyRun }]),
          findUnique: vi.fn().mockResolvedValue({ status: "running" }),
          update: vi.fn(),
          create: vi.fn(),
        },
        event: {
          create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
            ...event(data.seq),
            type: data.type,
          })),
        },
      };
      const prisma = {
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;
      await sendUserMessage(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        userId: "user-1",
        blocks: [{ kind: "text", text: "ping" }],
        prompt: "ping",
        trigger: "webhook",
        modelPin: {
          modelProvider: "openai-compatible",
          modelId: "m",
          modelCredentialId,
          thinkingLevel: null,
        },
      });
      return tx.steeringMessage.create.mock.calls[0]![0].data as Record<string, unknown>;
    }

    it("holds a message pinned to another connection instead of folding it into the live run", async () => {
      const data = await steer({ trigger: "user", modelPinned: false }, "cred-routine", null);
      expect(data.runId).toBeNull();
      expect(data.modelCredentialId).toBe("cred-routine");
    });

    it("holds a message with no pin while the live run is on a pinned connection", async () => {
      const data = await steer(
        { trigger: "user", modelPinned: true, modelCredentialId: "cred-a" },
        null,
        null,
      );
      expect(data.runId).toBeNull();
    });

    it("holds a delivery even when the live run uses the same connection", async () => {
      const data = await steer(
        { trigger: "user", modelPinned: true, modelCredentialId: "cred-a" },
        "cred-a",
      );
      expect(data.runId).toBeNull();
    });
  });

  it("keeps an inbound message pending while the creation intro is active", async () => {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn(),
      },
      steeringMessage: { create: vi.fn() },
      task: { create: vi.fn() },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "intro-run", taskId: "intro-task", trigger: "created" }]),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: new Date() }),
        create: vi.fn(),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      sendUserMessage(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        userId: "user-1",
        blocks: [{ kind: "text", text: "Check the inbox" }],
        prompt: "Check the inbox",
        trigger: "user",
      }),
    ).resolves.toEqual({ messageId: "message-1", seq: 4, taskId: null, runId: "intro-run" });

    expect(tx.run.create).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: {
        messageId: "message-1",
        botId: "bot-1",
        userId: "user-1",
        unattended: false,
        externalTaint: false,
        runId: null,
      },
    });
  });

  it("keeps a messaging inbound's origin on the hold behind the creation intro", async () => {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn(),
      },
      steeringMessage: { create: vi.fn() },
      task: { create: vi.fn() },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "intro-run", taskId: "intro-task", trigger: "created" }]),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: new Date() }),
        create: vi.fn(),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      message: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      sendUserMessage(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        userId: "user-1",
        blocks: [{ kind: "text", text: "Check the inbox" }],
        prompt: "Check the inbox",
        trigger: "messaging",
        clientNonce: "messaging:slack:handle-1",
      }),
    ).resolves.toEqual({ messageId: "message-1", seq: 4, taskId: null, runId: "intro-run" });

    expect(tx.run.create).not.toHaveBeenCalled();
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: {
        messageId: "message-1",
        botId: "bot-1",
        userId: "user-1",
        unattended: true,
        externalTaint: true,
        runId: null,
        originTrigger: "messaging",
      },
    });
  });

  it("keeps the message pending when the busy run is a routine turn", async () => {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      steeringMessage: { create: vi.fn() },
      task: { create: vi.fn() },
      run: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "run-routine", taskId: "task-routine", trigger: "routine" }]),
        findUnique: vi.fn().mockResolvedValue({ status: "running" }),
        create: vi.fn(),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      sendUserMessage(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        userId: "user-1",
        blocks: [{ kind: "text", text: "hello" }],
        prompt: "hello",
        trigger: "messaging",
      }),
    ).resolves.toEqual({ messageId: "message-1", seq: 4, taskId: null, runId: "run-routine" });

    expect(tx.run.create).not.toHaveBeenCalled();
    // No run on the steering row: the routine never claims it; its continuation does.
    // The inbound stays messaging so that continuation is mirrored back to the app.
    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: {
        messageId: "message-1",
        botId: "bot-1",
        userId: "user-1",
        unattended: true,
        externalTaint: true,
        runId: null,
        originTrigger: "messaging",
      },
    });
  });

  it("steers the conversational run when a parallel webhook turn is also active", async () => {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      steeringMessage: { create: vi.fn() },
      task: { create: vi.fn() },
      run: {
        findMany: vi.fn().mockResolvedValue([
          { id: "run-webhook", taskId: "task-webhook", trigger: "webhook" },
          { id: "run-user", taskId: "task-user", trigger: "user" },
        ]),
        findUnique: vi.fn().mockResolvedValue({ status: "running" }),
        create: vi.fn(),
        update: vi.fn(),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      sendUserMessage(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        botId: "bot-1",
        userId: "user-1",
        blocks: [{ kind: "text", text: "hello" }],
        prompt: "hello",
        trigger: "messaging",
      }),
    ).resolves.toEqual({ messageId: "message-1", seq: 4, taskId: null, runId: "run-user" });

    expect(tx.steeringMessage.create).toHaveBeenCalledWith({
      data: {
        messageId: "message-1",
        botId: "bot-1",
        userId: "user-1",
        unattended: true,
        externalTaint: true,
        runId: null,
        originTrigger: "messaging",
      },
    });
  });
});

describe("sendUserMessage taint on a busy run", () => {
  function busyTx() {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      steeringMessage: { create: vi.fn() },
      task: { create: vi.fn() },
      run: {
        findMany: vi.fn().mockResolvedValue([{ id: "run-0", taskId: "task-0", trigger: "user" }]),
        findUnique: vi.fn().mockResolvedValue({ status: "running" }),
        create: vi.fn(),
        update: vi.fn(),
      },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    return { tx, prisma };
  }
  const base = {
    spaceId: "workspace-1",
    threadId: "thread-1",
    botId: "bot-1",
    userId: "user-1",
    blocks: [{ kind: "text" as const, text: "hello" }],
    prompt: "hello",
  };

  it("keeps an inbound message off the busy clean run instead of tainting it in flight", async () => {
    const { tx, prisma } = busyTx();
    await sendUserMessage(prisma, { ...base, trigger: "messaging" });
    expect(tx.run.update).not.toHaveBeenCalled();
    const data = tx.steeringMessage.create.mock.calls[0]![0].data as { runId: string | null };
    expect(data.runId).toBeNull();
  });

  it("leaves the busy run alone when the owner steers it", async () => {
    const { tx, prisma } = busyTx();
    await sendUserMessage(prisma, { ...base, trigger: "follow_up" });
    expect(tx.run.update).not.toHaveBeenCalled();
  });
});

describe("claimSteering", () => {
  function pinnedTx(runOverrides: Record<string, unknown>, rows: Array<Record<string, unknown>>) {
    const tx = {
      $queryRaw: vi.fn(),
      run: {
        findFirst: vi.fn().mockResolvedValue({
          id: "run-1",
          spaceId: "space-1",
          trigger: "user",
          ...runOverrides,
        }),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      thread: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ nextMessageSeq: 7 }),
        update: vi.fn().mockResolvedValue({ nextEventSeq: 1 }),
      },
      event: { create: vi.fn() },
      steeringMessage: {
        findMany: vi.fn().mockResolvedValue(rows),
        updateMany: vi.fn().mockResolvedValue({ count: rows.length }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const claim = () =>
      claimSteering(prisma, {
        threadId: "thread-1",
        botId: "bot-1",
        runId: "run-1",
        leaseOwner: "worker-1",
        leaseFence: 2,
        seenIds: [],
      });
    return { tx, claim };
  }

  it("leaves a row pinned to another connection for its own continuation", async () => {
    const { tx, claim } = pinnedTx(
      {
        modelPinned: true,
        modelProvider: "openai-compatible",
        modelId: "private-model",
        modelCredentialId: "connection-a",
      },
      [
        {
          id: "steer-a",
          messageId: "message-a",
          modelProvider: null,
          modelId: null,
          message: { seq: 5, blocks: [{ kind: "text", text: "Plain" }] },
        },
        {
          id: "steer-b",
          messageId: "message-b",
          prompt: "<untrusted_delivery_payload>{}</untrusted_delivery_payload>",
          externalTaint: true,
          modelProvider: "openai-compatible",
          modelId: "private-model",
          modelCredentialId: "connection-b",
          thinkingLevel: null,
          message: { seq: 6, blocks: [{ kind: "text", text: "Webhook: ci.failed" }] },
        },
      ],
    );
    const claimed = await claim();
    expect(claimed.map((item) => item.id)).toEqual(["steer-a"]);
    expect(tx.steeringMessage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ["steer-a"] } }) }),
    );
  });

  it("leaves a held webhook row for its own continuation", async () => {
    const held = {
      id: "steer-a",
      messageId: "message-a",
      prompt: "<untrusted_delivery_payload>{}</untrusted_delivery_payload>",
      externalTaint: true,
      unattended: true,
      routineId: null,
      modelProvider: null,
      modelId: null,
      modelCredentialId: null,
      thinkingLevel: null,
      message: { seq: 5, blocks: [{ kind: "text", text: "Webhook: ci.failed" }] },
    };
    const { tx, claim } = pinnedTx({}, [held]);
    await expect(claim()).resolves.toEqual([]);
    expect(tx.steeringMessage.updateMany).not.toHaveBeenCalled();
    expect(tx.run.updateMany).not.toHaveBeenCalled();

    const continuation = {
      run: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "run-continuation" }),
      },
      routine: { findFirst: vi.fn() },
      steeringMessage: { findMany: vi.fn().mockResolvedValue([held]), updateMany: vi.fn() },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    await createPendingSteeringRun(continuation as never, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
    });
    expect(continuation.run.create.mock.calls[0]![0].data.externalTaint).toBe(true);
  });

  it("does not claim a held delivery that has no pin on a run pinned elsewhere", async () => {
    const { tx, claim } = pinnedTx(
      {
        modelPinned: true,
        modelProvider: "openai-compatible",
        modelId: "private-model",
        modelCredentialId: "connection-a",
      },
      [
        {
          id: "steer-b",
          messageId: "message-b",
          prompt: "<untrusted_delivery_payload>{}</untrusted_delivery_payload>",
          externalTaint: true,
          modelProvider: null,
          modelId: null,
          message: { seq: 6, blocks: [{ kind: "text", text: "Webhook: ci.failed" }] },
        },
      ],
    );
    await expect(claim()).resolves.toEqual([]);
    expect(tx.steeringMessage.updateMany).not.toHaveBeenCalled();
  });

  it("still claims a plain user steering row", async () => {
    const { tx, claim } = pinnedTx(
      {
        modelPinned: true,
        modelProvider: "openai-compatible",
        modelId: "private-model",
        modelCredentialId: "connection-a",
        thinkingLevel: null,
      },
      [
        {
          id: "steer-a",
          messageId: "message-a",
          prompt: null,
          externalTaint: false,
          unattended: false,
          modelProvider: null,
          modelId: null,
          message: { seq: 5, blocks: [{ kind: "text", text: "Also check the logs" }] },
        },
      ],
    );
    const claimed = await claim();
    expect(claimed.map((item) => item.id)).toEqual(["steer-a"]);
    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });

  it("reads a legacy fenced row with no stored mode as a held delivery", async () => {
    const { tx, claim } = pinnedTx({}, [
      {
        id: "steer-a",
        messageId: "message-a",
        prompt: "<untrusted_delivery_payload>{}</untrusted_delivery_payload>",
        externalTaint: null,
        unattended: null,
        message: { seq: 5, blocks: [{ kind: "text", text: "Webhook: ci.failed" }] },
      },
    ]);
    await expect(claim()).resolves.toEqual([]);
    expect(tx.steeringMessage.updateMany).not.toHaveBeenCalled();
  });

  it("claims pending messages for the fenced run in message order", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      run: {
        findFirst: vi.fn().mockResolvedValue({ id: "run-1", spaceId: "space-1" }),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: null }),
      },
      thread: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ nextMessageSeq: 7 }),
        update: vi.fn().mockResolvedValue({ nextEventSeq: 1 }),
      },
      event: { create: vi.fn() },
      steeringMessage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "steer-1",
            messageId: "message-1",
            message: {
              seq: 5,
              blocks: [
                { kind: "text", text: "First" },
                {
                  kind: "image",
                  artifactId: "artifact-1",
                  name: "chart.png",
                  mimeType: "image/png",
                },
              ],
            },
          },
          {
            id: "steer-2",
            messageId: "message-2",
            message: { seq: 6, blocks: [{ kind: "text", text: "Second" }] },
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      claimSteering(prisma, {
        threadId: "thread-1",
        botId: "bot-1",
        runId: "run-1",
        leaseOwner: "worker-1",
        leaseFence: 2,
        seenIds: [],
      }),
    ).resolves.toEqual([
      {
        id: "steer-1",
        messageId: "message-1",
        text: "First\n[image: chart.png]",
        blocks: [
          { kind: "text", text: "First" },
          {
            kind: "image",
            artifactId: "artifact-1",
            name: "chart.png",
            mimeType: "image/png",
          },
        ],
      },
      {
        id: "steer-2",
        messageId: "message-2",
        text: "Second",
        blocks: [{ kind: "text", text: "Second" }],
      },
    ]);
    expect(tx.run.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leaseOwner: "worker-1", leaseFence: 2 }),
      }),
    );
    expect(tx.event.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "run.steering.claimed",
        payload: { steeringIds: ["steer-1", "steer-2"], nextMessageSeq: 7 },
      }),
    });
    expect(tx.steeringMessage.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["steer-1", "steer-2"] }, claimedAt: null },
      data: { runId: "run-1", claimedAt: expect.any(Date) },
    });
  });

  it("leaves externally marked messages unclaimed when asked to", async () => {
    const make = () => {
      const tx = {
        $queryRaw: vi.fn(),
        run: { findFirst: vi.fn().mockResolvedValue({ id: "run-1", trigger: "user" }) },
        steeringMessage: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      };
      const prisma = {
        $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      } as unknown as PrismaClient;
      return { tx, prisma };
    };
    const input = {
      threadId: "thread-1",
      botId: "bot-1",
      runId: "run-1",
      leaseOwner: "worker-1",
      leaseFence: 1,
      seenIds: [],
    };
    const excluded = make();
    await claimSteering(excluded.prisma, { ...input, excludeExternalOrigin: true });
    expect(excluded.tx.steeringMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          message: expect.objectContaining({
            AND: [
              {
                NOT: {
                  blocks: {
                    array_contains: [{ kind: "bot_message_received", externalOrigin: true }],
                  },
                },
              },
            ],
          }),
        }),
      }),
    );
    const open = make();
    await claimSteering(open.prisma, input);
    const where = (
      open.tx.steeringMessage.findMany.mock.calls[0] as unknown as [
        { where: { message: Record<string, unknown> } },
      ]
    )[0].where;
    expect(where.message).not.toHaveProperty("AND");
  });

  it("does not claim steering into a tool-free creation intro", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      run: { findFirst: vi.fn().mockResolvedValue({ id: "intro-run", trigger: "created" }) },
      steeringMessage: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      claimSteering(prisma, {
        threadId: "thread-1",
        botId: "bot-1",
        runId: "intro-run",
        leaseOwner: "worker-1",
        leaseFence: 2,
        seenIds: [],
      }),
    ).resolves.toEqual([]);
    expect(tx.steeringMessage.findMany).not.toHaveBeenCalled();
    expect(tx.steeringMessage.updateMany).not.toHaveBeenCalled();
  });

  it("leaves pending user messages alone while a routine turn is running", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      run: { findFirst: vi.fn().mockResolvedValue({ id: "run-routine", trigger: "routine" }) },
      steeringMessage: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      claimSteering(prisma, {
        threadId: "thread-1",
        botId: "bot-1",
        runId: "run-routine",
        leaseOwner: "worker-1",
        leaseFence: 1,
        seenIds: [],
      }),
    ).resolves.toEqual([]);
    // Only steering addressed to this run; unassigned (pending) rows wait for the continuation.
    expect(tx.steeringMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: [{ runId: "run-routine" }] }),
      }),
    );
  });

  it("leaves channel and in-app pending rows for a direct-message run", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      run: {
        findFirst: vi.fn().mockResolvedValue({
          id: "run-dm",
          trigger: "messaging",
          sourceMessage: { blocks: [{ kind: "text", text: "And privately?" }] },
        }),
      },
      steeringMessage: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await claimSteering(prisma, {
      threadId: "thread-1",
      botId: "bot-1",
      runId: "run-dm",
      leaseOwner: "worker-1",
      leaseFence: 1,
      seenIds: [],
    });

    expect(tx.steeringMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ runId: null, originTrigger: "messaging" }, { runId: "run-dm" }],
          message: {
            threadId: "thread-1",
            NOT: { blocks: { array_contains: [{ kind: "channel_message" }] } },
          },
        }),
      }),
    );
  });
});

describe("clearThread", () => {
  it("releases the computer execution lease without dropping the computer", async () => {
    const fanout = new TestFanout();
    const publish = vi.spyOn(fanout, "publish");
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 42, historyCompactionGeneration: 0 })
          .mockResolvedValue({ nextEventSeq: 1 }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([{ id: "run-1", taskId: "task-1" }]),
        updateManyAndReturn: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({ id })),
        ),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn() },
      task: { updateMany: vi.fn() },
      computerExecutionLease: { updateMany: vi.fn() },
      mailReplyItem: { updateMany: vi.fn() },
      computer: { updateMany: vi.fn() },
      message: { deleteMany: vi.fn() },
      event: {
        deleteMany: vi.fn(),
        create: vi.fn().mockResolvedValue({
          ...event(0),
          type: "thread.cleared",
        }),
      },
      bot: { update: vi.fn() },
      threadGoal: { findFirst: vi.fn(async () => null) },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      clearThread(prisma, { spaceId: "workspace-1", threadId: "thread-1", botId: "bot-1" }, fanout),
    ).resolves.toMatchObject({
      event: { type: "thread.cleared" },
      cancelledRunIds: ["run-1"],
    });
    // The clear waits on the thread row lock, which snapshot reads can hold for 15s; Prisma's
    // 5s default would fail it. Only the timeout is explicit so the client's connection wait stays.
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 20_000 });
    expect(tx.computerExecutionLease.updateMany).toHaveBeenCalledWith({
      where: { runId: { in: ["run-1"] } },
      data: { expiresAt: new Date(0) },
    });
    expect(tx.computer.updateMany).toHaveBeenCalledWith({
      where: { executionRunId: { in: ["run-1"] } },
      data: {
        executionRunId: null,
        executionBotId: null,
        executionLeaseExpiresAt: null,
      },
    });
    // Every deleted message counts as compacted, so compaction cannot summarize cleared history.
    expect(tx.thread.update).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: {
        historyCompactedUpToSeq: 41,
        historyCompactionSummary: null,
        historyCompactionGeneration: { increment: 1 },
      },
    });
    expect(publish).toHaveBeenCalledWith("thread:thread-1", JSON.stringify({ cursor: 0 }));
  });

  it("scopes group clear lease cleanup to cancelled run ids", async () => {
    const fanout = new TestFanout();
    const order: string[] = [];
    const tx = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        order.push(`raw:${strings.join("?").replace(/\s+/g, " ").trim()}`);
        return [{ id: "group-1" }];
      }),
      thread: {
        update: vi
          .fn()
          .mockImplementationOnce(async () => {
            order.push("thread.update");
            return { nextMessageSeq: 3, historyCompactionGeneration: 0 };
          })
          .mockResolvedValueOnce({ nextMessageSeq: 3, historyCompactionGeneration: 0 })
          .mockResolvedValue({ nextEventSeq: 1 }),
      },
      run: {
        findMany: vi.fn().mockResolvedValue([
          { id: "group-run-1", taskId: "task-1" },
          { id: "group-run-2", taskId: "task-2" },
        ]),
        updateManyAndReturn: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({ id })),
        ),
      },
      secret: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      externalEffect: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      attempt: { updateMany: vi.fn() },
      task: { updateMany: vi.fn() },
      computerExecutionLease: { updateMany: vi.fn() },
      mailReplyItem: { updateMany: vi.fn() },
      computer: { updateMany: vi.fn() },
      message: { deleteMany: vi.fn() },
      event: {
        deleteMany: vi.fn(),
        create: vi.fn().mockResolvedValue({
          ...event(0),
          type: "thread.cleared",
        }),
      },
      chatGroup: { update: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      clearThread(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-group",
          botId: "bot-1",
          groupId: "group-1",
        },
        fanout,
      ),
    ).resolves.toMatchObject({ cancelledRunIds: ["group-run-1", "group-run-2"] });
    // Group before thread, the order every group writer uses.
    expect(order[0]).toContain("chat_groups");
    expect(order[0]).toContain("FOR NO KEY UPDATE");
    expect(order[1]).toBe("thread.update");

    expect(tx.run.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          threadId: "thread-group",
          spaceId: "workspace-1",
        }),
      }),
    );
    expect(tx.computerExecutionLease.updateMany).toHaveBeenCalledWith({
      where: { runId: { in: ["group-run-1", "group-run-2"] } },
      data: { expiresAt: new Date(0) },
    });
    expect(tx.computer.updateMany).toHaveBeenCalledWith({
      where: { executionRunId: { in: ["group-run-1", "group-run-2"] } },
      data: {
        executionRunId: null,
        executionBotId: null,
        executionLeaseExpiresAt: null,
      },
    });
    expect(tx.computerExecutionLease.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ botId: expect.anything() }) }),
    );
  });
});

describe("appendEvent", () => {
  // The append is one autocommit statement, so the thread row lock is held for one statement
  // instead of an interactive transaction's round trips.
  const input = {
    spaceId: "workspace-1",
    threadId: "thread-1",
    botId: "bot-1",
    type: "thread.progress" as const,
    runId: "run-1",
    payload: { text: "progress" },
  };
  const statement = (call: unknown[]) => (call[0] as string[]).join("?");
  const prismaReturning = (rows: unknown[]) => {
    const $queryRaw = vi.fn().mockResolvedValue(rows);
    const $transaction = vi.fn();
    return {
      prisma: { $queryRaw, $transaction } as unknown as PrismaClient,
      $queryRaw,
      $transaction,
    };
  };

  it("appends in one statement without an interactive transaction", async () => {
    const fanout = new TestFanout();
    const publish = vi.spyOn(fanout, "publish");
    const { prisma, $queryRaw, $transaction } = prismaReturning([
      { seq: 5, createdAt: new Date(0), runId: "run-1" },
    ]);

    await expect(appendEvent(prisma, input, fanout)).resolves.toMatchObject({
      type: "thread.progress",
      runId: "run-1",
      seq: 5,
    });
    expect($queryRaw).toHaveBeenCalledTimes(1);
    expect($transaction).not.toHaveBeenCalled();
    expect(publish).toHaveBeenCalledWith("thread:thread-1", JSON.stringify({ cursor: 5 }));
  });

  it("writes nothing and does not publish when the run can no longer write history", async () => {
    const fanout = new TestFanout();
    const publish = vi.spyOn(fanout, "publish");
    const { prisma, $queryRaw } = prismaReturning([]);

    await expect(appendEvent(prisma, input, fanout)).rejects.toThrow(RunHistoryWriteError);
    expect($queryRaw).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("treats a deleted thread as closed run history, and as an error without a run", async () => {
    const { prisma } = prismaReturning([]);
    await expect(appendEvent(prisma, { ...input, runId: undefined })).rejects.toThrow(
      "Thread not found",
    );
    await expect(appendEvent(prisma, input)).rejects.toThrow(RunHistoryWriteError);
  });

  it("does not persist a split-emoji high surrogate that would crash JSON insert", async () => {
    const { prisma, $queryRaw } = prismaReturning([
      { seq: 3, createdAt: new Date(0), runId: "run-1" },
    ]);

    // Orphaned UTF-16 high surrogate (e.g. 😀 split across stream chunks as \uD83D alone).
    const result = await appendEvent(prisma, {
      ...input,
      payload: { delta: "hello \uD83D", streaming: true },
    });

    expect(result.payload).toEqual({ delta: "hello \uFFFD", streaming: true });
    const values = ($queryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(values).toContain(JSON.stringify({ delta: "hello \uFFFD", streaming: true }));
  });

  it("requires a cancelled run for run.cancelled, and a run to name", async () => {
    const { prisma, $queryRaw } = prismaReturning([
      { seq: 7, createdAt: new Date(0), runId: "run-1" },
    ]);
    await expect(
      appendEvent(prisma, { ...input, type: "run.cancelled", payload: {} }),
    ).resolves.toMatchObject({ type: "run.cancelled", seq: 7 });
    expect(statement($queryRaw.mock.calls[0] as unknown[])).toContain("FOR SHARE");

    $queryRaw.mockClear();
    await expect(
      appendEvent(prisma, { ...input, type: "run.cancelled", runId: undefined, payload: {} }),
    ).rejects.toThrow(RunHistoryWriteError);
    expect($queryRaw).not.toHaveBeenCalled();
  });
});

describe("answerRunInput with a mail denial", () => {
  const mailBlock = {
    tool: "mail_send" as const,
    to: ["a@example.test"],
    cc: [],
    bcc: [],
    subject: "Hi",
    body: "Old",
  };
  const mailDenial = {
    note: "The user sent it themselves.",
    mail: { subject: "New subject", body: "New", connectionId: "conn-1" },
  };

  function setup(options: { kind?: string; runUserId?: string; effectFound?: boolean } = {}) {
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review before mail_send",
              mail: mailBlock,
              status: "pending",
              actions: [
                { id: "allow", label: "Allow once" },
                { id: "always", label: "Always allow this tool" },
                { id: "deny", label: "Deny" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ botId: "bot-1", userId: options.runUserId ?? "user-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi
          .fn()
          .mockResolvedValue(
            options.effectFound === false
              ? null
              : { id: "effect-1", kind: options.kind ?? "mail_send", status: "intended" },
          ),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      actionApprovalRule: { upsert: vi.fn() },
      composeSend: { upsert: vi.fn().mockResolvedValue({ id: "compose-1" }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const answer = (extra: { answer?: string; answeredByUserId?: string } = {}) =>
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "deny",
          mailDenial,
          ...extra,
        },
        new TestFanout(),
      );
    return { tx, answer };
  }

  it("denies the effect with the note and shows the edited mail on the card", async () => {
    const { tx, answer } = setup();
    await expect(answer()).resolves.toBe(true);
    expect(tx.externalEffect.update).toHaveBeenCalledWith({
      where: { id: "effect-1" },
      data: { status: "denied", result: { note: "The user sent it themselves." } },
    });
    const blocks = tx.message.update.mock.calls[0]?.[0].data.blocks;
    expect(blocks[0]).toMatchObject({
      status: "answered",
      answer: "allow",
      mail: { subject: "New subject", body: "New", connectionId: "conn-1", to: ["a@example.test"] },
    });
  });

  it("creates the approval's compose record in the same transaction as the claim", async () => {
    const { tx, answer } = setup();
    await expect(answer()).resolves.toBe(true);
    expect(tx.composeSend.upsert).toHaveBeenCalledWith({
      where: {
        spaceId_userId_clientId: {
          spaceId: "workspace-1",
          userId: "user-1",
          clientId: "approval_effect-1",
        },
      },
      create: {
        spaceId: "workspace-1",
        userId: "user-1",
        clientId: "approval_effect-1",
        connectionId: "conn-1",
      },
      update: {},
    });
  });

  it.each([
    ["an allow", {}, { answer: "allow" }],
    ["an always-allow", {}, { answer: "always" }],
    ["another user", {}, { answeredByUserId: "user-2" }],
    ["a non-mail effect", { kind: "destination.write" }, {}],
    ["an effect that is no longer waiting", { effectFound: false }, {}],
  ])("rejects a mail denial on %s without changing anything", async (_name, options, extra) => {
    const { tx, answer } = setup(options);
    await expect(answer(extra)).resolves.toBe(false);
    expect(tx.externalEffect.update).not.toHaveBeenCalled();
    expect(tx.run.updateMany).not.toHaveBeenCalled();
    expect(tx.message.update).not.toHaveBeenCalled();
    expect(tx.composeSend.upsert).not.toHaveBeenCalled();
  });
});

describe("setMailApprovalOutcome", () => {
  it("records the outcome on the card and replaces the agent's note on the denied effect", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      externalEffect: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          runId: "run-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Review",
              status: "answered",
              mail: { tool: "mail_send", to: [], cc: [], bcc: [], subject: "s", body: "b" },
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: { findUnique: vi.fn().mockResolvedValue({ botId: "bot-1" }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    await setMailApprovalOutcome(
      prisma,
      {
        spaceId: "workspace-1",
        threadId: "thread-1",
        messageId: "message-1",
        effectId: "effect-1",
        outcome: "failed",
        note: "nothing was sent",
      },
      new TestFanout(),
    );
    expect(tx.externalEffect.updateMany).toHaveBeenCalledWith({
      where: { id: "effect-1", spaceId: "workspace-1", status: "denied" },
      data: {
        status: "completed",
        result: { error: "nothing was sent", note: "nothing was sent", outcome: "failed" },
      },
    });
    expect(tx.message.update.mock.calls[0]?.[0].data.blocks[0].mail.outcome).toBe("failed");
    for (const [outcome, status, result] of [
      ["sent", "completed", { ok: true, note: "n", outcome: "sent" }],
      ["saved", "completed", { ok: true, note: "n", outcome: "saved" }],
      ["unknown", "uncertain", { error: "n", note: "n", outcome: "unknown", uncertain: true }],
    ] as const) {
      await setMailApprovalOutcome(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        messageId: "message-1",
        effectId: "effect-1",
        outcome,
        note: "n",
      });
      expect(tx.externalEffect.updateMany).toHaveBeenLastCalledWith({
        where: { id: "effect-1", spaceId: "workspace-1", status: "denied" },
        data: { status, result },
      });
    }
  });
});

describe("setApprovalWaitsFor", () => {
  it("marks the card as waiting on the service that accepted the payment", async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          runId: "run-1",
          blocks: [
            { kind: "ask", approvalEffectId: "effect-1", text: "Send $5?", status: "answered" },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: { findUnique: vi.fn().mockResolvedValue({ botId: "bot-1" }) },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    await setApprovalWaitsFor(
      prisma,
      {
        spaceId: "workspace-1",
        threadId: "thread-1",
        messageId: "message-1",
        effectId: "effect-1",
        waitsFor: "Mercury",
      },
      new TestFanout(),
    );
    expect(tx.message.update.mock.calls[0]?.[0].data.blocks[0].waitsFor).toBe("Mercury");
  });
});

describe("answerRunInput on an AI data sharing request", () => {
  const consentTx = (
    request: unknown = { recipientKey: "key-1", version: AI_DISCLOSURE_VERSION },
  ) => {
    const tx = {
      // Answering a card records the person's decision for precedent.
      approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [
            {
              kind: "ask",
              approvalEffectId: "effect-1",
              text: "Allow your mail to be sent to Example?",
              consent: { version: AI_DISCLOSURE_VERSION },
              status: "pending",
              actions: [
                { id: "allow", label: "Allow" },
                { id: "deny", label: "Not now" },
              ],
            },
          ],
        }),
        update: vi.fn().mockResolvedValue({ id: "message-1" }),
      },
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "owner-1" }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ status: "queued" }),
      },
      task: { updateMany: vi.fn() },
      externalEffect: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "effect-1", kind: "ai_consent", status: "intended", request }),
        update: vi.fn().mockResolvedValue({ id: "effect-1" }),
      },
      aiDataConsent: { upsert: vi.fn().mockResolvedValue({}) },
      actionApprovalRule: { upsert: vi.fn() },
      thread: { update: vi.fn().mockResolvedValue({ nextEventSeq: 10 }) },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    const answer = (answeredByUserId: string, answerId: string) =>
      answerRunInput(prisma, {
        spaceId: "workspace-1",
        threadId: "thread-1",
        runId: "run-1",
        messageId: "message-1",
        answeredByUserId,
        answer: answerId,
      });
    return { tx, answer };
  };

  it("records consent for the stored recipient, for the owner and the space, when the owner allows", async () => {
    const { tx, answer } = consentTx();
    await expect(answer("owner-1", "allow")).resolves.toBe(true);
    expect(tx.aiDataConsent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_spaceId_recipientKey: {
            userId: "owner-1",
            spaceId: "workspace-1",
            recipientKey: "key-1",
          },
        },
        create: {
          userId: "owner-1",
          spaceId: "workspace-1",
          recipientKey: "key-1",
          version: AI_DISCLOSURE_VERSION,
        },
      }),
    );
    expect(tx.externalEffect.update).toHaveBeenCalledWith({
      where: { id: "effect-1" },
      data: { status: "approved" },
    });
    expect(tx.run.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "queued" }) }),
    );
  });

  it("records nothing and resumes the run when the owner answers Not now", async () => {
    const { tx, answer } = consentTx();
    await expect(answer("owner-1", "deny")).resolves.toBe(true);
    expect(tx.aiDataConsent.upsert).not.toHaveBeenCalled();
    expect(tx.externalEffect.update).toHaveBeenCalledWith({
      where: { id: "effect-1" },
      data: { status: "denied" },
    });
  });

  it.each(["allow", "deny"])("refuses %s from anyone but the owner of the run", async (id) => {
    const { tx, answer } = consentTx();
    await expect(answer("teammate-1", id)).resolves.toBe(false);
    expect(tx.aiDataConsent.upsert).not.toHaveBeenCalled();
    expect(tx.externalEffect.update).not.toHaveBeenCalled();
    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });

  it.each(["allow", "deny"])(
    "resumes the run as Not now on %s for an older disclosure version, granting nothing",
    async (id) => {
      const { tx, answer } = consentTx({ recipientKey: "key-1", version: "2020-01-01" });
      await expect(answer("owner-1", id)).resolves.toBe(true);
      expect(tx.aiDataConsent.upsert).not.toHaveBeenCalled();
      expect(tx.externalEffect.update).toHaveBeenCalledWith({
        where: { id: "effect-1" },
        data: { status: "denied" },
      });
      expect(tx.run.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "queued" }) }),
      );
      expect(tx.message.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { blocks: [expect.objectContaining({ status: "answered", answer: "deny" })] },
        }),
      );
    },
  );
});

it("checks cross-space peer permission inside the message transaction before creating a run", async () => {
  const tx = {
    // Answering a card records the person's decision for precedent.
    approvalDecision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    thread: { update: vi.fn(async () => ({ nextMessageSeq: 1 })) },
    message: { create: vi.fn(async () => ({ id: "message-1", seq: 0 })) },
    task: { create: vi.fn() },
    run: { create: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(async () => [
      { id: "sender", spaceId: "a", crossSpaceCommunication: true, archivedAt: null },
      { id: "target", spaceId: "b", crossSpaceCommunication: false, archivedAt: null },
    ]),
  };
  const prisma = {
    message: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  } as unknown as PrismaClient;
  await expect(
    sendUserMessage(prisma, {
      spaceId: "b",
      threadId: "thread",
      botId: "target",
      userId: "owner",
      blocks: [{ kind: "text", text: "peer reply" }],
      prompt: "peer reply",
      trigger: "messaging",
      crossSpaceSenderBotId: "sender",
    }),
  ).rejects.toBeInstanceOf(CrossSpaceCommunicationBlockedError);
  expect(tx.task.create).not.toHaveBeenCalled();
  expect(tx.run.create).not.toHaveBeenCalled();
});

describe("one-time secret answer limit", () => {
  it("rejects a secret answer over the value limit without storing it", async () => {
    const store = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "thread-1" }]),
      run: {
        findFirst: vi.fn().mockResolvedValue({ botId: "bot-1", userId: "user-1" }),
        updateMany: vi.fn(),
      },
      message: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message-1",
          blocks: [{ kind: "ask", text: "Code", input: "secret", status: "pending" }],
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    await expect(
      answerRunInput(
        prisma,
        {
          spaceId: "workspace-1",
          threadId: "thread-1",
          runId: "run-1",
          messageId: "message-1",
          answeredByUserId: "user-1",
          answer: "x".repeat(BOT_SECRET_VALUE_MAX_LENGTH + 1),
        },
        undefined,
        { store },
      ),
    ).rejects.toThrow(AnswerTooLongError);
    expect(store).not.toHaveBeenCalled();
    expect(tx.run.updateMany).not.toHaveBeenCalled();
  });
});

describe("inbound steering carries the model text and routine", () => {
  const fenced =
    '<untrusted_delivery_payload>{\n  "event": "ci.failed"\n}</untrusted_delivery_payload>';
  const label = "Webhook: ci.failed";
  const input = {
    spaceId: "workspace-1",
    threadId: "thread-1",
    botId: "bot-1",
    userId: "user-1",
    blocks: [{ kind: "text" as const, text: label }],
    prompt: fenced,
    trigger: "webhook" as const,
    routineId: "routine-1",
  };

  function busyTx() {
    const tx = {
      thread: {
        update: vi
          .fn()
          .mockResolvedValueOnce({ nextMessageSeq: 5 })
          .mockResolvedValueOnce({ nextEventSeq: 9 }),
      },
      message: {
        create: vi.fn().mockResolvedValue({ id: "message-1", seq: 4 }),
        update: vi.fn(),
      },
      task: { create: vi.fn() },
      run: {
        findMany: vi.fn().mockResolvedValue([{ id: "run-0", taskId: "task-0", trigger: "user" }]),
        findUnique: vi.fn().mockResolvedValue({ status: "running" }),
        create: vi.fn(),
        update: vi.fn(),
      },
      routine: { findFirst: vi.fn().mockResolvedValue({ id: "routine-1" }) },
      steeringMessage: { create: vi.fn() },
      event: {
        create: vi.fn(async ({ data }: { data: { seq: number; type: string } }) => ({
          ...event(data.seq),
          type: data.type,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
    return { tx, prisma };
  }

  it("keeps the fenced prompt out of the bubble but in what the model reads", async () => {
    const { tx, prisma } = busyTx();
    await sendUserMessage(prisma, input);

    const steering = tx.steeringMessage.create.mock.calls[0]![0] as {
      data: { prompt?: string; routineId?: string };
    };
    expect(steering.data.prompt).toBe(fenced);
    expect(steering.data.routineId).toBe("routine-1");
    expect(input.blocks).toEqual([{ kind: "text", text: label }]);

    const claimTx = {
      $queryRaw: vi.fn(),
      run: {
        findFirst: vi.fn().mockResolvedValue({ id: "run-1", spaceId: "space-1" }),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: null }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      thread: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ nextMessageSeq: 7 }),
        update: vi.fn().mockResolvedValue({ nextEventSeq: 1 }),
      },
      event: { create: vi.fn() },
      steeringMessage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "steer-1",
            messageId: "message-1",
            // The continuation owns the row it was created for, so it may read the delivery.
            runId: "run-1",
            prompt: steering.data.prompt,
            message: { seq: 5, blocks: input.blocks },
          },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const claimPrisma = {
      $transaction: vi.fn(async (callback: (client: typeof claimTx) => unknown) =>
        callback(claimTx),
      ),
    } as unknown as PrismaClient;
    const [claimed] = await claimSteering(claimPrisma, {
      threadId: "thread-1",
      botId: "bot-1",
      runId: "run-1",
      leaseOwner: "worker-1",
      leaseFence: 2,
      seenIds: [],
    });
    expect(claimed!.text).toBe(fenced);
    expect(claimed!.blocks).toEqual([{ kind: "text", text: label }]);
  });

  function queued(row: {
    id: string;
    seq: number;
    unattended: boolean;
    externalTaint: boolean;
    routineId: string | null;
  }) {
    return {
      id: row.id,
      userId: "user-1",
      originTrigger: null,
      routineId: row.routineId,
      unattended: row.unattended,
      externalTaint: row.externalTaint,
      modelProvider: null,
      modelId: null,
      modelCredentialId: null,
      thinkingLevel: null,
      message: {
        id: `message-${row.seq}`,
        blocks: [{ kind: "text", text: `queued ${row.seq}` }],
        seq: row.seq,
      },
    };
  }

  function continuationTx(rows: Array<Record<string, unknown>>) {
    const tx = {
      run: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "run-continuation" }),
      },
      routine: {
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
          rows.some((row) => row.routineId === where.id) ? { id: where.id } : null,
        ),
      },
      steeringMessage: { findMany: vi.fn().mockResolvedValue(rows), updateMany: vi.fn() },
      task: { create: vi.fn().mockResolvedValue({ id: "task-1" }) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    return tx;
  }

  it("attributes the continuation run to the queued delivery's routine", async () => {
    const tx = continuationTx([
      {
        id: "s1",
        userId: "user-1",
        originTrigger: null,
        routineId: "routine-1",
        modelProvider: null,
        modelId: null,
        modelCredentialId: null,
        thinkingLevel: null,
        message: { id: "message-1", blocks: input.blocks, seq: 4 },
      },
    ]);
    await createPendingSteeringRun(tx as never, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
    });
    expect(tx.routine.findFirst).toHaveBeenCalledWith({
      where: { id: "routine-1", botId: "bot-1", spaceId: "workspace-1" },
      select: { id: true },
    });
    expect(tx.run.create.mock.calls[0]![0].data.routineId).toBe("routine-1");
  });

  it("attributes nothing when queued deliveries name different routines", async () => {
    const tx = continuationTx([
      {
        id: "s1",
        userId: "user-1",
        originTrigger: null,
        routineId: "routine-1",
        modelProvider: null,
        modelId: null,
        modelCredentialId: null,
        thinkingLevel: null,
        message: { id: "message-1", blocks: input.blocks, seq: 4 },
      },
      {
        id: "s2",
        userId: "user-1",
        originTrigger: null,
        routineId: "routine-2",
        modelProvider: null,
        modelId: null,
        modelCredentialId: null,
        thinkingLevel: null,
        message: { id: "message-2", blocks: input.blocks, seq: 5 },
      },
    ]);
    await createPendingSteeringRun(tx as never, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
    });
    expect(tx.run.create.mock.calls[0]![0].data.routineId ?? null).toBeNull();
  });

  it("attributes nothing when a user message waits beside one routine", async () => {
    const tx = continuationTx([
      queued({ id: "s1", seq: 4, unattended: false, externalTaint: false, routineId: null }),
      queued({ id: "s2", seq: 5, unattended: true, externalTaint: true, routineId: "routine-1" }),
    ]);
    await createPendingSteeringRun(tx as never, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
    });
    expect(tx.routine.findFirst).not.toHaveBeenCalled();
    expect(tx.run.create.mock.calls[0]![0].data.routineId ?? null).toBeNull();
  });

  it("keeps a held delivery's outside content tainted on its continuation", async () => {
    const tx = continuationTx([
      queued({ id: "s1", seq: 4, unattended: true, externalTaint: true, routineId: null }),
    ]);
    await createPendingSteeringRun(tx as never, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
    });
    const data = tx.run.create.mock.calls[0]![0].data;
    expect(data.externalTaint).toBe(true);
    expect(data.unattended).toBe(true);
  });

  it("takes the taint but not the unattended mode from a mixed batch", async () => {
    const tx = continuationTx([
      queued({ id: "s1", seq: 4, unattended: false, externalTaint: false, routineId: null }),
      queued({ id: "s2", seq: 5, unattended: true, externalTaint: true, routineId: null }),
    ]);
    await createPendingSteeringRun(tx as never, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
    });
    const data = tx.run.create.mock.calls[0]![0].data;
    expect(data.externalTaint).toBe(true);
    expect(data.unattended).toBe(false);
  });

  it("resumes a legacy fenced row tainted when its stored mode is empty", async () => {
    const tx = continuationTx([
      {
        id: "s1",
        userId: "user-1",
        originTrigger: null,
        routineId: null,
        prompt: "<untrusted_delivery_payload>{}</untrusted_delivery_payload>",
        unattended: null,
        externalTaint: null,
        modelProvider: null,
        modelId: null,
        modelCredentialId: null,
        thinkingLevel: null,
        message: {
          id: "message-4",
          blocks: [{ kind: "text", text: "Webhook: ci.failed" }],
          seq: 4,
        },
      },
    ]);
    await createPendingSteeringRun(tx as never, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
    });
    const data = tx.run.create.mock.calls[0]![0].data;
    expect(data.externalTaint).toBe(true);
    expect(data.unattended).toBe(true);
  });

  it("holds a same-connection webhook delivery for its own continuation", async () => {
    const { tx, prisma } = busyTx();
    await sendUserMessage(prisma, input);
    const steering = tx.steeringMessage.create.mock.calls[0]![0] as {
      data: { runId: string | null };
    };
    expect(steering.data.runId).toBeNull();

    const row = {
      id: "steer-1",
      messageId: "message-1",
      runId: null,
      prompt: fenced,
      unattended: true,
      externalTaint: true,
      routineId: "routine-1",
      modelProvider: null,
      modelId: null,
      modelCredentialId: null,
      thinkingLevel: null,
      message: { seq: 4, blocks: input.blocks },
    };
    const claimTx = {
      $queryRaw: vi.fn(),
      run: {
        findFirst: vi.fn().mockResolvedValue({ id: "run-0", spaceId: "space-1", trigger: "user" }),
        findUnique: vi.fn().mockResolvedValue({ status: "running", startedAt: null }),
      },
      thread: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ nextMessageSeq: 7 }),
        update: vi.fn().mockResolvedValue({ nextEventSeq: 1 }),
      },
      event: { create: vi.fn() },
      steeringMessage: {
        findMany: vi.fn().mockResolvedValue([row]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const claimed = await claimSteering(
      {
        $transaction: vi.fn(async (callback: (client: typeof claimTx) => unknown) =>
          callback(claimTx),
        ),
      } as unknown as PrismaClient,
      {
        threadId: "thread-1",
        botId: "bot-1",
        runId: "run-0",
        leaseOwner: "worker-1",
        leaseFence: 2,
        seenIds: [],
      },
    );
    expect(claimed).toEqual([]);

    const continuation = continuationTx([row]);
    await createPendingSteeringRun(continuation as never, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
    });
    expect(continuation.run.create.mock.calls[0]![0].data.externalTaint).toBe(true);
  });

  it("still attaches a plain user message to the busy run", async () => {
    const { tx, prisma } = busyTx();
    await sendUserMessage(prisma, {
      spaceId: "workspace-1",
      threadId: "thread-1",
      botId: "bot-1",
      userId: "user-1",
      blocks: [{ kind: "text", text: "Also check the logs" }],
      prompt: "Also check the logs",
      trigger: "user",
    });
    const steering = tx.steeringMessage.create.mock.calls[0]![0] as {
      data: { runId: string | null };
    };
    expect(steering.data.runId).toBe("run-0");
  });

  it("holds a busy webhook delivery with the mode its trigger implies", async () => {
    const { tx, prisma } = busyTx();
    // The busy run is a routine turn, so nothing conversational can claim the delivery.
    tx.run.findMany.mockResolvedValue([{ id: "run-0", taskId: "task-0", trigger: "routine" }]);
    await sendUserMessage(prisma, input);
    const steering = tx.steeringMessage.create.mock.calls[0]![0] as {
      data: { runId: string | null; externalTaint?: boolean; unattended?: boolean };
    };
    expect(steering.data.runId).toBeNull();
    expect(steering.data.externalTaint).toBe(true);
    expect(steering.data.unattended).toBe(true);
  });
});
