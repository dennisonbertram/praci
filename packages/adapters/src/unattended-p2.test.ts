import { checkInInstruction, quietRoutineGuidance } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkInPostedToday, checkInReplyIsOver } from "./check-in.js";
import { createRunExecutor, userTurnInstructions } from "./executor.js";
import { notifyPastDueItems } from "./past-due.js";
import { notifyThreadEvent } from "./run-notification.js";
import {
  addScratchpadItemFromTool,
  completeScratchpadItemFromTool,
  updateScratchpadItemFromTool,
} from "./scratchpad-tools.js";

vi.mock("./run-notification.js", () => ({ notifyThreadEvent: vi.fn(async () => "created") }));

const scope = { spaceId: "ws", userId: "user", botId: "bot" };

describe("quiet guidance", () => {
  const instructions = (quietGuidance?: string) =>
    userTurnInstructions({
      botInstructions: "Bot",
      computerInstruction: "Computer",
      pageBrowserAllowed: false,
      workspaceInstruction: "Home",
      replyGuidance: "Reply",
      quietGuidance,
      groupContext: undefined,
      messagingContext: undefined,
      redactedMemoryContext: undefined,
      redactedScratchpadContext: undefined,
      hasHistoricalContext: false,
      agentEnvironmentInstruction: undefined,
      botDirectory: undefined,
      pluginLine: undefined,
      agentSkillsLine: undefined,
      taughtSkillsLine: undefined,
    }).join("\n");

  it("is added only when given", () => {
    expect(instructions(quietRoutineGuidance())).toContain(quietRoutineGuidance());
    expect(instructions()).not.toContain("stay silent as the silent-reply rule");
  });
});

describe("check-in daily cap", () => {
  const now = new Date("2026-10-26T15:00:00.000Z");
  const routine = { id: "r1", timezone: "America/New_York" };
  const db = (messageAt: Date[]) =>
    ({
      run: { findMany: vi.fn(async () => [{ id: "run-1" }]) },
      message: { findMany: vi.fn(async () => messageAt.map((createdAt) => ({ createdAt }))) },
    }) as never;

  it("is true when a reply was posted today in the routine's time zone", async () => {
    expect(await checkInPostedToday(db([new Date("2026-10-26T13:30:00Z")]), routine, now)).toBe(
      true,
    );
  });

  it("is false for a reply from the previous local day or no reply", async () => {
    // 02:00 UTC on the 26th is still the 25th in New York.
    expect(await checkInPostedToday(db([new Date("2026-10-26T02:00:00Z")]), routine, now)).toBe(
      false,
    );
    expect(await checkInPostedToday(db([]), routine, now)).toBe(false);
  });

  function wake(posted: boolean, activeRun = false) {
    const scheduledAt = new Date(Date.now() - 1000);
    const routineRow = {
      id: "routine-1",
      spaceId: "space-1",
      userId: "user-1",
      botId: "bot-1",
      prompt: "stale stored text",
      managedKind: "check_in",
      crons: ["0 9 * * *"],
      timezone: "UTC",
      active: true,
      nextRunAt: scheduledAt,
      lastRunAt: null,
      threadId: null,
    };
    const taskCreate = vi.fn(async () => ({ id: "task-1" }));
    const runCreate = vi.fn(async () => ({ id: "run-1", taskId: "task-1" }));
    const routineUpdate = vi.fn(async () => ({}));
    const tx = {
      routine: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: routineUpdate,
        findUnique: vi.fn(async () => ({
          modelProvider: null,
          modelId: null,
          thinkingLevel: null,
        })),
      },
      run: {
        findFirst: vi.fn(async () => (activeRun ? { id: "active" } : null)),
        findMany: vi.fn(async () => [{ id: "old-run" }]),
        create: runCreate,
      },
      message: {
        findMany: vi.fn(async () => (posted ? [{ createdAt: new Date() }] : [])),
      },
      task: { create: taskCreate },
    };
    const prisma = {
      routine: { findUnique: vi.fn(async () => routineRow) },
      bot: {
        findUnique: vi.fn(async () => ({
          id: "bot-1",
          userId: "user-1",
          spawnKey: null,
          archivedAt: null,
          thread: { id: "thread-1" },
        })),
      },
      agentSkill: { findMany: vi.fn(async () => []) },
      botSkillSetting: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
    } as unknown as PrismaClient;
    const executor = createRunExecutor({
      prisma,
      jobs: { enqueue: vi.fn(async () => undefined), cancel: vi.fn(), close: vi.fn() },
      events: { append: vi.fn(async () => undefined) },
    } as unknown as Parameters<typeof createRunExecutor>[0]);
    return { executor, scheduledAt, taskCreate, runCreate, routineUpdate };
  }

  it("skips the wake while a check-in run is still active", async () => {
    const busy = wake(false, true);
    await busy.executor.wakeRoutine("routine-1", busy.scheduledAt.toISOString());
    expect(busy.runCreate).not.toHaveBeenCalled();
    // The schedule moved on but nothing ran: Last ran goes back to its old value.
    expect(busy.routineUpdate).toHaveBeenCalledWith({
      where: { id: "routine-1" },
      data: { lastRunAt: null },
    });
  });

  it("ends a check-in reply silently when another run already posted today", async () => {
    const routineRow = { id: "r1", timezone: "UTC", managedKind: "check_in" };
    const dbFor = (row: unknown, posted: boolean) =>
      ({
        routine: { findUnique: vi.fn(async () => row) },
        run: { findMany: vi.fn(async () => [{ id: "earlier" }]) },
        message: { findMany: vi.fn(async () => (posted ? [{ createdAt: new Date() }] : [])) },
      }) as never;
    const run = { id: "now", routineId: "r1" };
    expect(await checkInReplyIsOver(dbFor(routineRow, true), run, new Date())).toBe(true);
    expect(await checkInReplyIsOver(dbFor(routineRow, false), run, new Date())).toBe(false);
    expect(
      await checkInReplyIsOver(dbFor({ ...routineRow, managedKind: null }, true), run, new Date()),
    ).toBe(false);
    expect(
      await checkInReplyIsOver(dbFor(null, true), { id: "x", routineId: null }, new Date()),
    ).toBe(false);
  });

  it("skips the wake after a message today and runs the built-in instruction otherwise", async () => {
    const skipped = wake(true);
    await skipped.executor.wakeRoutine("routine-1", skipped.scheduledAt.toISOString());
    expect(skipped.runCreate).not.toHaveBeenCalled();
    expect(skipped.routineUpdate).toHaveBeenCalledWith({
      where: { id: "routine-1" },
      data: { lastRunAt: null },
    });

    const ran = wake(false);
    await ran.executor.wakeRoutine("routine-1", ran.scheduledAt.toISOString());
    expect(ran.routineUpdate).not.toHaveBeenCalled();
    expect(ran.taskCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ prompt: checkInInstruction() }),
    });
  });
});

describe("open item fields", () => {
  function prisma(existing: Record<string, unknown> = {}) {
    const row = {
      id: "item-1",
      ...scope,
      title: "Contract",
      status: "open",
      notes: "",
      category: null,
      channel: null,
      proof: null,
      approvedAt: null,
      approvedBy: null,
      dueAt: new Date("2026-11-01T00:00:00Z"),
      waitingOn: "Acme legal",
      resolvedReason: null,
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
      ...existing,
    };
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      ...row,
      ...data,
    }));
    return {
      updateMany,
      create,
      prisma: {
        scratchpadItem: { findFirst: vi.fn(async () => row), updateMany, create },
      } as never,
    };
  }

  it("adds dueAt (date or datetime) and waitingOn", async () => {
    const { prisma: p, create } = prisma();
    const result = await addScratchpadItemFromTool(
      { prisma: p },
      { ...scope, title: "Send NDA", dueAt: "2026-11-02", waitingOn: " Acme legal " },
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dueAt: new Date("2026-11-02T23:59:59.000Z"),
        waitingOn: "Acme legal",
      }),
    });
    expect(result).toMatchObject({ item: { dueAt: "2026-11-02T23:59:59.000Z" } });
    expect(
      await addScratchpadItemFromTool({ prisma: p }, { ...scope, title: "x", dueAt: "soon" }),
    ).toEqual({ error: "dueAt must be an ISO date or datetime with timezone." });
    expect(
      await addScratchpadItemFromTool(
        { prisma: p },
        { ...scope, title: "x", waitingOn: "w".repeat(201) },
      ),
    ).toMatchObject({ error: expect.stringContaining("waitingOn") });
  });

  it("clears dueAt and waitingOn with null and empty text", async () => {
    const { prisma: p, updateMany } = prisma();
    await updateScratchpadItemFromTool(
      { prisma: p },
      { ...scope, itemId: "item-1", dueAt: null, waitingOn: "" },
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dueAt: null, waitingOn: null }) }),
    );
  });

  it("stores the completion reason and clears it on reopen", async () => {
    const done = prisma();
    await completeScratchpadItemFromTool(
      { prisma: done.prisma },
      { ...scope, itemId: "item-1", reason: " Replied by email " },
    );
    expect(done.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "done", resolvedReason: "Replied by email" }),
      }),
    );
    expect(
      await completeScratchpadItemFromTool(
        { prisma: done.prisma },
        { ...scope, itemId: "item-1", reason: "r".repeat(201) },
      ),
    ).toMatchObject({ error: expect.stringContaining("reason") });

    const reopened = prisma({ status: "done", resolvedReason: "Replied" });
    await updateScratchpadItemFromTool(
      { prisma: reopened.prisma },
      { ...scope, itemId: "item-1", status: "open" },
    );
    expect(reopened.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ resolvedReason: null }) }),
    );
  });

  it("keeps the gate: an agent cannot open a gated item", async () => {
    const { prisma: p } = prisma({ category: "public_post", status: "parked" });
    expect(
      await updateScratchpadItemFromTool(
        { prisma: p },
        { ...scope, itemId: "item-1", status: "open", dueAt: "2026-11-02" },
      ),
    ).toEqual({ error: "Agents cannot open gated items." });
  });
});

describe("past-due notification", () => {
  const now = new Date("2026-10-26T15:00:00.000Z");
  beforeEach(() => vi.mocked(notifyThreadEvent).mockClear());

  const group = (botId: string, n: number) => ({
    spaceId: "space-1",
    userId: "user-1",
    botId,
    _count: { _all: n },
  });
  const firstTitle: Record<string, string> = { b1: "NDA", b2: "Invoice" };
  const prisma = (groups: unknown[]) =>
    ({
      scratchpadItem: {
        groupBy: vi.fn(async () => groups),
        findFirst: vi.fn(async ({ where }: { where: { botId: string } }) => ({
          title: firstTitle[where.botId],
        })),
      },
      bot: {
        findMany: vi.fn(async () => [
          { id: "b1", name: "Ada", thread: { id: "t-b1", groupId: null } },
          { id: "b2", name: "Bo", thread: { id: "t-b2", groupId: null } },
        ]),
      },
      user: { findMany: vi.fn(async () => [{ id: "user-1", timezone: "UTC" }]) },
    }) as unknown as PrismaClient;

  it("notifies every bot with overdue items, however many another has, with the first title and a bot+day key", async () => {
    const p = prisma([group("b1", 2000), group("b2", 1)]);
    expect(await notifyPastDueItems({ prisma: p, now })).toBe(2);
    const calls = vi.mocked(notifyThreadEvent).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[3]).toMatchObject({
      kind: "help",
      title: "Ada: 2000 items are past due",
      body: "NDA",
    });
    expect(calls[1]?.[3]).toMatchObject({ title: "Bo: 1 item is past due", body: "Invoice" });
    expect(calls[0]?.[4]).toBe("past-due:b1:2026-10-26");
    expect(calls[0]?.[2]).toMatchObject({ spaceId: "space-1", userId: "user-1", botId: "b1" });
  });

  it("repeats the same key on a later sweep the same day, so the store dedupes", async () => {
    const p = prisma([group("b1", 1)]);
    await notifyPastDueItems({ prisma: p, now });
    await notifyPastDueItems({ prisma: p, now: new Date("2026-10-26T20:00:00Z") });
    const keys = vi.mocked(notifyThreadEvent).mock.calls.map((call) => call[4]);
    expect(new Set(keys).size).toBe(1);
  });

  it("queries only open or parked items past due on active bots", async () => {
    const p = prisma([]);
    await notifyPastDueItems({ prisma: p, now });
    expect(p.scratchpadItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["spaceId", "userId", "botId"],
        where: {
          status: { in: ["open", "parked"] },
          dueAt: { lt: now },
          bot: { archivedAt: null },
        },
      }),
    );
  });
});
