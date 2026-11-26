import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { ACTIVE_RUN_STATUSES } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRunUpdateManyAndReturn } from "./test-support/cancel-runs.js";
import type * as ThreadTargetModule from "./thread-target.js";
import type { ThreadTarget } from "./thread-target.js";

const mocks = vi.hoisted(() => ({
  target: null as unknown,
  sendThreadMessage: vi.fn(),
}));

vi.mock("./thread-target.js", async (importOriginal) => {
  const actual = await importOriginal<typeof ThreadTargetModule>();
  return {
    ...actual,
    resolveThreadTarget: vi.fn(async () => mocks.target),
    sendThreadMessage: mocks.sendThreadMessage,
  };
});

const { createRouter } = await import("./router.js");
const { runJobKey } = await import("@rakazo/adapter-kit");

const actor = {
  spaceId: "workspace-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
} satisfies Actor;

beforeEach(() => {
  mocks.sendThreadMessage.mockReset();
});

describe("threads.clear", () => {
  it("stops run work and releases the screen before expiring the lease and clearing", async () => {
    const calls: string[] = [];
    mocks.target = { kind: "bot", botId: "bot-1", threadId: "thread-1", bot: {} };
    let seq = 0;
    const runUpdate = fakeRunUpdateManyAndReturn();
    const attemptUpdateMany = vi.fn().mockResolvedValue({ count: 0 });
    const taskUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      externalEffect: {
        deleteMany: vi.fn(async () => ({ count: 0 })),
        findMany: vi.fn(async () => []),
      },
      appControlSnapshot: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      runFragment: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $queryRaw: vi.fn(),
      thread: { update: vi.fn(async () => ({ nextEventSeq: ++seq })) },
      run: {
        findMany: vi.fn().mockResolvedValue([{ id: "run-1", botId: "bot-1", taskId: "task-1" }]),
        updateManyAndReturn: runUpdate,
        findUnique: vi.fn().mockResolvedValue({ status: "cancelled" }),
      },
      attempt: { updateMany: attemptUpdateMany },
      task: { updateMany: taskUpdateMany },
      secret: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      message: { findMany: vi.fn().mockResolvedValue([]) },
      threadGoal: { findFirst: vi.fn().mockResolvedValue(null) },
      steeringMessage: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
      computer: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "computer-1",
            homeKey: "home-1",
            kind: "docker",
            providerRef: "computer-1",
            executionBotId: null,
            executionRunId: null,
          },
        ]),
      },
      computerExecutionLease: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { computerId: "computer-1", botId: "bot-1", runId: "run-1", fence: 3 },
          ]),
      },
      event: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => data),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      computerExecutionLease: {
        updateMany: vi.fn(async () => {
          calls.push("expire lease");
        }),
      },
      computer: { updateMany: vi.fn() },
    } as unknown as PrismaClient;
    const execute = vi.fn(async function* () {
      calls.push("cancel run work");
      yield { type: "exit", code: 0 };
    });
    const releaseScreen = vi.fn(async () => {
      calls.push("release screen");
    });
    const clearThread = vi.fn(async () => {
      calls.push("clear thread");
      return { cancelledRunIds: [], historyCompactionGeneration: 1 };
    });
    const cancel = vi.fn().mockResolvedValue(undefined);
    const deps = {
      prisma,
      env: { sandboxProvider: "fake" },
      sandbox: { execute, releaseScreen },
      events: { clearThread, notify: vi.fn().mockResolvedValue(undefined) },
      jobs: { cancel },
      memoryProviders: { resolve: vi.fn().mockResolvedValue(null) },
    };
    const client = createRouterClient(createRouter(deps as never), { context: { actor } as never });

    await expect(client.threads.clear({ botId: "bot-1" })).resolves.toEqual({ ok: true });

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: "computer-1" }),
      expect.objectContaining({
        argv: expect.arrayContaining(["rakazo-cancel-run-work", "computer-1", "run-1"]),
      }),
      expect.objectContaining({ runId: "run-1", cancelRunWork: true }),
    );
    expect(calls).toEqual(["cancel run work", "release screen", "expire lease", "clear thread"]);
    expect(cancel).toHaveBeenCalledWith(runJobKey("run-1"));
    // The stop must cancel the task and attempts too, or a cleared queued run leaves a queued task.
    expect(runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["run-1"] }, status: { in: [...ACTIVE_RUN_STATUSES] } },
        data: expect.objectContaining({ status: "cancelled", leaseOwner: null }),
      }),
    );
    expect(attemptUpdateMany).toHaveBeenCalled();
    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["task-1"] } },
      data: { status: "cancelled" },
    });
  });
});

describe("threads.followUp", () => {
  it("sends a group follow-up through sendThreadMessage", async () => {
    const target = {
      kind: "group",
      groupId: "group-1",
      groupName: "Team",
      threadId: "thread-1",
      members: [],
      memberBotIds: ["bot-1"],
    } satisfies ThreadTarget;
    mocks.target = target;
    mocks.sendThreadMessage.mockResolvedValue({});
    const $transaction = vi.fn();
    const deps = { prisma: { $transaction }, env: { sandboxProvider: "fake" } };
    const client = createRouterClient(createRouter(deps as never), { context: { actor } as never });

    await expect(
      client.threads.followUp({ groupId: "group-1", text: "hello", clientNonce: "nonce-1" }),
    ).resolves.toEqual({ ok: true });

    expect(mocks.sendThreadMessage).toHaveBeenCalledWith(expect.anything(), actor, target, {
      text: "hello",
      clientNonce: "nonce-1",
    });
    expect($transaction).not.toHaveBeenCalled();
  });
});
