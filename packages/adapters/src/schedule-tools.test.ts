import { ACTIVE_RUN_STATUSES, ONCE_ROUTINE_CRON } from "@rakazo/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelScheduleFromTool,
  compactScheduleInput,
  createScheduleFromTool,
  filterBuiltinToolsForRun,
  filterBuiltinToolsForThread,
  isOneShotRoutineCron,
  keepForcedSkill,
  listSchedulesFromTool,
  MAX_ACTIVE_ROUTINES_PER_BOT,
  resolveScheduleTiming,
  SCHEDULE_TOOL_NAMES,
  scheduleApproval,
  updateScheduleFromTool,
} from "./schedule-tools.js";

describe("resolveScheduleTiming", () => {
  it("reads a runAt without an offset in the routine's timezone", () => {
    const runAt = `${new Date().getUTCFullYear() + 1}-11-02T10:00`;
    expect(resolveScheduleTiming({ runAt }, "Europe/Berlin")).toMatchObject({
      nextRunAt: new Date(`${new Date().getUTCFullYear() + 1}-11-02T09:00:00Z`),
    });
  });

  it("starts a repeat at the first match at or after startAt", () => {
    const year = new Date().getUTCFullYear() + 1;
    expect(
      resolveScheduleTiming({ cron: "0 10 * * 1", startAt: `${year}-11-04` }, "Europe/Berlin"),
    ).toMatchObject({ ok: true, oneShot: false });
    const daily = resolveScheduleTiming(
      { cron: "0 10 * * *", startAt: `${year}-11-04T10:00` },
      "UTC",
    );
    expect(daily).toMatchObject({ nextRunAt: new Date(`${year}-11-04T10:00:00Z`) });
  });

  it("rejects a past startAt, a bad one, and startAt on a one-shot", () => {
    expect(resolveScheduleTiming({ cron: "0 10 * * *", startAt: "2020-01-01" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("startAt is in the past"),
    });
    expect(resolveScheduleTiming({ cron: "0 10 * * *", startAt: "soon" })).toEqual({
      ok: false,
      error: "startAt must be an ISO date or datetime.",
    });
    expect(resolveScheduleTiming({ delayMinutes: 5, startAt: "2099-01-01" })).toEqual({
      ok: false,
      error: "startAt is only for repeating schedules.",
    });
  });

  it.each(["2030-02-30T10:00Z", "2030-04-31T10:00+05:30", "2030-06-15T24:00:00Z"])(
    "rejects an impossible runAt instead of rolling it over: %s",
    (runAt) => {
      expect(resolveScheduleTiming({ runAt })).toEqual({
        ok: false,
        error: "runAt must be a valid ISO datetime.",
      });
    },
  );

  it("still accepts a real offset datetime for runAt", () => {
    expect(resolveScheduleTiming({ runAt: "2099-04-30T10:00+05:30" })).toMatchObject({
      ok: true,
      nextRunAt: new Date("2099-04-30T04:30:00Z"),
    });
  });

  it("rejects repeating intervals under one minute", () => {
    expect(resolveScheduleTiming({ every: 2, unit: "seconds" })).toEqual({
      ok: false,
      error: "minimum interval is 1 minute",
    });
  });

  it("accepts every 1 minute", () => {
    const result = resolveScheduleTiming({ every: 1, unit: "minutes" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cron).toBe("*/1 * * * *");
    expect(result.oneShot).toBe(false);
    expect(result.nextRunAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("accepts cron every minute", () => {
    const result = resolveScheduleTiming({ cron: "*/1 * * * *" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cron).toBe("*/1 * * * *");
    expect(result.oneShot).toBe(false);
  });

  it("creates one-shot schedules with @once cron", () => {
    const result = resolveScheduleTiming({ delayMinutes: 10 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cron).toBe(ONCE_ROUTINE_CRON);
    expect(result.oneShot).toBe(true);
    expect(result.nextRunAt.getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
  });

  it("allows sub-minute one-shot delays via delaySeconds", () => {
    const result = resolveScheduleTiming({ delaySeconds: 30 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cron).toBe(ONCE_ROUTINE_CRON);
    expect(result.nextRunAt.getTime()).toBeGreaterThan(Date.now());
    expect(result.nextRunAt.getTime()).toBeLessThanOrEqual(Date.now() + 31_000);
  });

  it("rejects one-shot schedules in the past", () => {
    expect(resolveScheduleTiming({ runAt: new Date(Date.now() - 60_000).toISOString() })).toEqual({
      ok: false,
      error: expect.stringMatching(
        /^One-shot schedules must run in the future\. It is now .* in UTC\.$/,
      ),
    });
  });

  it("rejects fractional repeat intervals", () => {
    expect(resolveScheduleTiming({ every: 1.5, unit: "minutes" })).toEqual({
      ok: false,
      error: "every must be a positive whole number.",
    });
  });

  it("rejects malformed cron expressions", () => {
    expect(resolveScheduleTiming({ cron: "*/5 *" })).toEqual({
      ok: false,
      error: "cron must be a 5-field cron expression.",
    });
    expect(resolveScheduleTiming({ cron: "foo * * * *" })).toEqual({
      ok: false,
      error: "cron must be a valid 5-field cron expression.",
    });
  });

  it("rejects mixing repeat and one-shot fields", () => {
    expect(resolveScheduleTiming({ cron: "0 9 * * *", delayMinutes: 5 })).toEqual({
      ok: false,
      error: "Provide either a repeating schedule or a one-shot time, not both.",
    });
  });

  it("rejects two repeating timing methods", () => {
    expect(resolveScheduleTiming({ cron: "0 9 * * *", every: 1, unit: "hours" })).toEqual({
      ok: false,
      error: "Provide exactly one timing method: cron, or every and unit, not both.",
    });
  });

  it("ignores null and empty optional fields from model serializers", () => {
    const repeating = resolveScheduleTiming({
      cron: "0 9 * * *",
      every: null,
      unit: "",
      delayMinutes: null,
      runAt: "",
    });
    expect(repeating.ok).toBe(true);
    if (!repeating.ok) return;
    expect(repeating.oneShot).toBe(false);

    const oneShot = resolveScheduleTiming({
      cron: null,
      every: null,
      unit: "",
      delayMinutes: 10,
      delaySeconds: null,
    });
    expect(oneShot.ok).toBe(true);
    if (!oneShot.ok) return;
    expect(oneShot.oneShot).toBe(true);
  });

  it("keeps zero values for normal validation instead of treating them as absent", () => {
    expect(resolveScheduleTiming({ every: 0, unit: "minutes" })).toEqual({
      ok: false,
      error: "every must be a positive whole number.",
    });
    expect(compactScheduleInput({ every: 0, unit: "minutes", cron: null, runAt: "" })).toEqual({
      every: 0,
      unit: "minutes",
    });
  });
});

describe("filterBuiltinToolsForThread", () => {
  const tools = [
    { name: "handoff_to_bot" },
    { name: "message_bot" },
    { name: "schedule_create" },
    { name: "schedule_list" },
    { name: "schedule_cancel" },
    { name: "remember" },
  ];

  it("keeps handoff and schedule tools in groups", () => {
    expect(filterBuiltinToolsForThread(tools, "group-1").map((tool) => tool.name)).toEqual([
      "handoff_to_bot",
      "schedule_create",
      "schedule_list",
      "schedule_cancel",
      "remember",
    ]);
    expect(filterBuiltinToolsForThread(tools, null).map((tool) => tool.name)).toEqual([
      "message_bot",
      "schedule_create",
      "schedule_list",
      "schedule_cancel",
      "remember",
    ]);
  });

  it("hides schedule creation from routine runs without removing schedule management", () => {
    expect(filterBuiltinToolsForRun(tools, "routine").map((tool) => tool.name)).toEqual([
      "handoff_to_bot",
      "message_bot",
      "schedule_list",
      "schedule_cancel",
      "remember",
    ]);
    expect(filterBuiltinToolsForRun(tools, "user").map((tool) => tool.name)).toContain(
      "schedule_create",
    );
  });

  it("composes thread then run filters without dropping group schedule tools", () => {
    const groupTools = filterBuiltinToolsForRun(
      filterBuiltinToolsForThread(tools, "group-1"),
      "routine",
    ).map((tool) => tool.name);
    expect(groupTools).toEqual(["handoff_to_bot", "schedule_list", "schedule_cancel", "remember"]);
    expect(
      filterBuiltinToolsForRun(filterBuiltinToolsForThread(tools, "group-1"), "user").map(
        (tool) => tool.name,
      ),
    ).toContain("schedule_create");
  });

  it("covers every schedule tool name", () => {
    for (const name of SCHEDULE_TOOL_NAMES) {
      expect(filterBuiltinToolsForThread([{ name }, { name: "remember" }], "group-1")).toEqual([
        { name },
        { name: "remember" },
      ]);
    }
  });
});

describe("isOneShotRoutineCron", () => {
  it("detects the one-shot sentinel", () => {
    expect(isOneShotRoutineCron(ONCE_ROUTINE_CRON)).toBe(true);
    expect(isOneShotRoutineCron("0 9 * * *")).toBe(false);
  });
});

const noRoutines = async () => [];

describe("schedule tool persistence", () => {
  it.each([
    { cron: "0 9 * * *" },
    { watch: { kind: "page", url: "https://example.com", intervalMinutes: 60 } },
  ])("rejects an invalid timezone before persisting %j", async (schedule) => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "routine-1",
      ...args.data,
    }));
    const enqueue = vi.fn(async () => undefined);
    const deps = {
      prisma: {
        routine: { create, findMany: noRoutines },
        bot: { findFirst: vi.fn(async () => ({ computer: null })) },
      },
      events: { append: vi.fn() },
      jobs: { enqueue },
    } as unknown as Parameters<typeof createScheduleFromTool>[0];
    const result = await createScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "thread-1",
      name: "Daily",
      prompt: "Check",
      timezone: "Mars/Olympus_Mons",
      schedule,
    });
    expect(result).toEqual({ error: "Unknown time zone: Mars/Olympus_Mons." });
    expect(create).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("refuses a name already active in the thread, not one in another thread", async () => {
    const findMany = vi.fn(async () => [
      { id: "routine-1", name: "Morning joke", threadId: "thread-1" },
      { id: "routine-2", name: "Evening joke", threadId: "thread-2" },
    ]);
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "routine-3",
      ...args.data,
    }));
    const deps = {
      prisma: {
        user: { findUnique: vi.fn(async () => null) },
        routine: {
          create,
          findMany,
        },
      },
      events: { append: vi.fn() },
      jobs: { enqueue: vi.fn() },
    } as unknown as Parameters<typeof createScheduleFromTool>[0];

    const result = await createScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "thread-1",
      name: " morning joke ",
      prompt: "Tell a joke",
      schedule: { every: 1, unit: "minutes" },
    });

    expect(result).toEqual({
      error:
        'An active routine named "Morning joke" already exists (routine-1). Update or cancel it instead.',
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { spaceId: "ws-1", botId: "bot-1", active: true },
      select: { id: true, name: true, threadId: true },
    });
    expect(create).not.toHaveBeenCalled();

    const other = await createScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "thread-1",
      name: "Evening joke",
      prompt: "Tell a joke",
      schedule: { every: 1, unit: "minutes" },
    });
    expect(other).toMatchObject({ ok: true, routineId: "routine-3" });
  });

  it("refuses a new routine once the bot has the maximum active", async () => {
    const create = vi.fn();
    const deps = {
      prisma: {
        user: { findUnique: vi.fn(async () => null) },
        routine: {
          create,
          findMany: vi.fn(async () =>
            Array.from({ length: MAX_ACTIVE_ROUTINES_PER_BOT }, (_, i) => ({
              id: `routine-${i}`,
              name: `Check ${i}`,
              threadId: "thread-1",
            })),
          ),
        },
      },
      events: { append: vi.fn() },
      jobs: { enqueue: vi.fn() },
    } as unknown as Parameters<typeof createScheduleFromTool>[0];

    const result = await createScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "thread-1",
      name: "One more",
      prompt: "Check",
      schedule: { cron: "0 9 * * *" },
    });

    expect(result).toEqual({
      error: `This bot already has ${MAX_ACTIVE_ROUTINES_PER_BOT} active routines. Cancel one before adding another.`,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates routines with routine.created and enqueues wakeup", async () => {
    const append = vi.fn(async () => undefined);
    const enqueue = vi.fn(async () => undefined);
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "routine-1",
      ...args.data,
      nextRunAt: args.data.nextRunAt,
    }));
    const deps = {
      prisma: {
        routine: { create, findMany: noRoutines },
        user: { findUnique: vi.fn(async () => null) },
      },
      events: { append },
      jobs: { enqueue, cancel: vi.fn(async () => undefined) },
    } as unknown as Parameters<typeof createScheduleFromTool>[0];

    const result = await createScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "thread-1",
      name: "Morning joke",
      prompt: "Tell a joke",
      schedule: { every: 1, unit: "minutes" },
    });

    expect(result).toMatchObject({ ok: true, routineId: "routine-1", cron: "*/1 * * * *" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          spaceId: "ws-1",
          userId: "user-1",
          threadId: "thread-1",
          crons: ["*/1 * * * *"],
          active: true,
        }),
      }),
    );
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ type: "routine.created", payload: { name: "Morning joke" } }),
    );
    expect(enqueue).toHaveBeenCalledOnce();
  });

  it("keeps the routine when event append fails after enqueue", async () => {
    const cancel = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    const deps = {
      prisma: {
        user: { findUnique: vi.fn(async () => null) },
        routine: {
          findMany: noRoutines,
          create: vi.fn(async () => ({
            id: "routine-1",
            name: "Morning joke",
            crons: ["*/1 * * * *"],
            nextRunAt: new Date(),
          })),
          delete: remove,
        },
      },
      events: {
        append: vi.fn(async () => {
          throw new Error("event failed");
        }),
      },
      jobs: { enqueue: vi.fn(async () => undefined), cancel },
    } as unknown as Parameters<typeof createScheduleFromTool>[0];

    const result = await createScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "thread-1",
      name: "Morning joke",
      prompt: "Tell a joke",
      schedule: { every: 1, unit: "minutes" },
    });

    expect(result).toMatchObject({ ok: true, routineId: "routine-1" });
    expect(cancel).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("rolls back routine when enqueue fails", async () => {
    const remove = vi.fn(async () => undefined);
    const deps = {
      prisma: {
        user: { findUnique: vi.fn(async () => null) },
        routine: {
          findMany: noRoutines,
          create: vi.fn(async () => ({
            id: "routine-1",
            name: "Morning joke",
            crons: ["*/1 * * * *"],
            nextRunAt: new Date(),
          })),
          delete: remove,
        },
      },
      events: { append: vi.fn(async () => undefined) },
      jobs: {
        enqueue: vi.fn(async () => {
          throw new Error("enqueue failed");
        }),
        cancel: vi.fn(async () => undefined),
      },
    } as unknown as Parameters<typeof createScheduleFromTool>[0];

    const result = await createScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "thread-1",
      name: "Morning joke",
      prompt: "Tell a joke",
      schedule: { every: 1, unit: "minutes" },
    });

    expect(result).toEqual({ error: "Could not schedule the reminder. Try again." });
    expect(remove).toHaveBeenCalledWith({ where: { id: "routine-1" } });
  });

  it("deactivates when enqueue fails and delete also fails", async () => {
    const update = vi.fn(async () => undefined);
    const deps = {
      prisma: {
        user: { findUnique: vi.fn(async () => null) },
        routine: {
          findMany: noRoutines,
          create: vi.fn(async () => ({
            id: "routine-1",
            name: "Morning joke",
            crons: ["*/1 * * * *"],
            nextRunAt: new Date(),
          })),
          delete: vi.fn(async () => {
            throw new Error("delete failed");
          }),
          update,
        },
      },
      events: { append: vi.fn(async () => undefined) },
      jobs: {
        enqueue: vi.fn(async () => {
          throw new Error("enqueue failed");
        }),
        cancel: vi.fn(async () => undefined),
      },
    } as unknown as Parameters<typeof createScheduleFromTool>[0];

    const result = await createScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "thread-1",
      name: "Morning joke",
      prompt: "Tell a joke",
      schedule: { every: 1, unit: "minutes" },
    });

    expect(result).toEqual({ error: "Could not schedule the reminder. Try again." });
    expect(update).toHaveBeenCalledWith({
      where: { id: "routine-1" },
      data: { active: false, nextRunAt: null },
    });
  });

  it("propagates when enqueue rollback cannot deactivate", async () => {
    const deps = {
      prisma: {
        user: { findUnique: vi.fn(async () => null) },
        routine: {
          findMany: noRoutines,
          create: vi.fn(async () => ({
            id: "routine-1",
            name: "Morning joke",
            crons: ["*/1 * * * *"],
            nextRunAt: new Date(),
          })),
          delete: vi.fn(async () => {
            throw new Error("delete failed");
          }),
          update: vi.fn(async () => {
            throw new Error("deactivate failed");
          }),
        },
      },
      events: { append: vi.fn(async () => undefined) },
      jobs: {
        enqueue: vi.fn(async () => {
          throw new Error("enqueue failed");
        }),
        cancel: vi.fn(async () => undefined),
      },
    } as unknown as Parameters<typeof createScheduleFromTool>[0];

    await expect(
      createScheduleFromTool(deps, {
        spaceId: "ws-1",
        botId: "bot-1",
        userId: "user-1",
        threadId: "thread-1",
        name: "Morning joke",
        prompt: "Tell a joke",
        schedule: { every: 1, unit: "minutes" },
      }),
    ).rejects.toThrow("deactivate failed");
  });

  it("scopes group list and cancel to the current thread without narrowing DMs", async () => {
    const findMany = vi.fn(async () => []);
    const findFirst = vi.fn(async () => null);
    const deps = {
      prisma: {
        routine: { findMany, findFirst, deleteMany: vi.fn(async () => ({ count: 1 })) },
      },
      events: { append: vi.fn(async () => undefined) },
      jobs: { enqueue: vi.fn(async () => undefined), cancel: vi.fn(async () => undefined) },
    } as unknown as Parameters<typeof cancelScheduleFromTool>[0];

    await listSchedulesFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "group-thread-1",
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          spaceId: "ws-1",
          botId: "bot-1",
          userId: "user-1",
          threadId: "group-thread-1",
        },
      }),
    );

    const cancelled = await cancelScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      threadId: "group-thread-1",
      routineId: "routine-1",
    });
    expect(cancelled).toEqual({ error: "Schedule not found." });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          spaceId: "ws-1",
          botId: "bot-1",
          userId: "user-1",
          threadId: "group-thread-1",
          id: "routine-1",
        },
      }),
    );

    findMany.mockClear();
    await listSchedulesFromTool(deps, { spaceId: "ws-1", botId: "bot-1", userId: "user-1" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spaceId: "ws-1", botId: "bot-1", userId: "user-1" },
      }),
    );

    findFirst.mockClear();
    await cancelScheduleFromTool(deps, {
      spaceId: "ws-1",
      botId: "bot-1",
      userId: "user-1",
      routineId: "routine-1",
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spaceId: "ws-1", botId: "bot-1", userId: "user-1", id: "routine-1" },
      }),
    );
  });
});

describe("routine from a forced skill", () => {
  it("keeps the skill the owner forced as an @mention", () => {
    expect(keepForcedSkill("Draft the note", "Use skill: Weekly investor note\n\nbody")).toBe(
      "@Weekly investor note Draft the note",
    );
    expect(
      keepForcedSkill("@Weekly investor note Draft", "/Weekly investor note\nevery Monday"),
    ).toBe("@Weekly investor note Draft");
    expect(keepForcedSkill("Draft the note", "every Monday draft a note")).toBe("Draft the note");
  });

  it("leads the approval with when it runs, and puts the prompt under details", async () => {
    const card = await scheduleApproval(
      { prisma: {} as never },
      { spaceId: "s", botId: "b", userId: "u" },
      "schedule_create",
      { name: "Note", prompt: "Draft the note", cron: "0 9 * * 1" },
      "America/New_York",
    );
    expect(card?.summary).toBe("Every Monday at 9:00 AM, posts here");
    expect(card?.detail).toContain("prompt: Draft the note");
  });

  it("shows the prompt and the run time on the card of a one-shot schedule, without making it ask", async () => {
    const card = await scheduleApproval(
      { prisma: {} as never },
      { spaceId: "s", botId: "b", userId: "u" },
      "schedule_create",
      { name: "Nudge", prompt: "Ping me about the board deck", runAt: "2099-01-01T15:00:00Z" },
      "UTC",
    );
    expect(card?.summary).toMatch(/^Once, .*2099.*, posts here$/);
    expect(card?.detail).toContain("prompt: Ping me about the board deck");
    expect(card?.detail).toContain("next run:");
    // A one-shot alone is not a reason to ask; the executor reads this flag.
    expect(card?.oneShot).toBe(true);
    const repeating = await scheduleApproval(
      { prisma: {} as never },
      { spaceId: "s", botId: "b", userId: "u" },
      "schedule_create",
      { name: "Note", prompt: "Draft", cron: "0 9 * * 1" },
      "UTC",
    );
    expect(repeating?.oneShot).toBeUndefined();
  });

  it("still asks when a watch is edited after being made one-shot, and when it is made one-shot", async () => {
    const row = (crons: string[]) => ({
      name: "W",
      timezone: "UTC",
      crons,
      threadId: null,
      watch: { kind: "page", url: "https://example.com", intervalMinutes: 60 },
    });
    const ask = (crons: string[], args: Record<string, unknown>) =>
      scheduleApproval(
        { prisma: { routine: { findFirst: vi.fn(async () => row(crons)) } } as never },
        { spaceId: "s", botId: "b", userId: "u" },
        "schedule_update",
        { id: "r1", ...args },
        null,
      );
    // already one-shot but still a watch
    expect(await ask(["@once"], { prompt: "Send my files elsewhere" })).toBeDefined();
    // repeating watch edited to a one-shot schedule and a new prompt in one call
    expect(
      await ask(["0 9 * * 1"], {
        prompt: "Send my files elsewhere",
        schedule: { runAt: "2099-01-01T00:00:00Z" },
      }),
    ).toBeDefined();
  });

  it("refuses to edit or delete the managed check-in", async () => {
    const managed = { id: "r1", name: "Check-in", managedKind: "check_in", crons: ["0 9 * * *"] };
    const prisma = {
      routine: { findFirst: vi.fn(async () => managed), delete: vi.fn(), update: vi.fn() },
    };
    const deps = { prisma, jobs: { enqueue: vi.fn(), cancel: vi.fn() } } as never;
    const scope = { spaceId: "s", botId: "b", userId: "u" };
    const message = "This check-in is managed in the bot's settings.";
    expect(await updateScheduleFromTool(deps, { ...scope, id: "r1", prompt: "x" })).toEqual({
      error: message,
    });
    expect(await cancelScheduleFromTool(deps, { ...scope, routineId: "r1" })).toEqual({
      error: message,
    });
    expect(prisma.routine.update).not.toHaveBeenCalled();
    expect(prisma.routine.delete).not.toHaveBeenCalled();
  });

  it.each([
    { cron: "0 */7 * * *", keeps: true },
    { cron: "0 9 * * *", keeps: false },
  ])("on a timezone-only change, keeps the next run of $cron: $keeps", async ({ cron, keeps }) => {
    const due = new Date(Date.now() + 3 * 3_600_000);
    const update = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "r1",
      spaceId: "s",
      botId: "b",
      name: "Note",
      prompt: "x",
      crons: [cron],
      active: true,
      threadId: null,
      watch: null,
      ...args.data,
    }));
    const prisma = {
      routine: {
        findFirst: vi.fn(async () => ({
          id: "r1",
          prompt: "x",
          timezone: "UTC",
          crons: [cron],
          active: true,
          nextRunAt: due,
          managedKind: null,
        })),
        update,
      },
    };
    const deps = {
      prisma,
      events: { append: vi.fn() },
      jobs: { enqueue: vi.fn(), cancel: vi.fn() },
    } as never;
    await updateScheduleFromTool(deps, {
      spaceId: "s",
      botId: "b",
      userId: "u",
      id: "r1",
      timezone: "Pacific/Auckland",
    });
    const nextRunAt = update.mock.calls[0]![0].data.nextRunAt as Date;
    expect(nextRunAt.getTime() === due.getTime()).toBe(keeps);
  });

  describe("a later start", () => {
    beforeEach(() => {
      vi.useFakeTimers({ now: new Date("2026-10-28T12:00:00Z") });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const run = async (
      existing: { crons: string[]; timezone: string; nextRunAt: Date },
      input: Record<string, unknown>,
    ) => {
      const update = vi.fn(async (args: { data: Record<string, unknown> }) => ({
        id: "r1",
        spaceId: "s",
        botId: "b",
        name: "Note",
        prompt: "x",
        active: true,
        threadId: null,
        watch: null,
        ...existing,
        ...args.data,
      }));
      const prisma = {
        routine: {
          findFirst: vi.fn(async () => ({
            id: "r1",
            prompt: "x",
            active: true,
            managedKind: null,
            ...existing,
          })),
          update,
        },
      };
      const deps = {
        prisma,
        events: { append: vi.fn() },
        jobs: { enqueue: vi.fn(), cancel: vi.fn() },
      } as never;
      const result = await updateScheduleFromTool(deps, {
        spaceId: "s",
        botId: "b",
        userId: "u",
        id: "r1",
        ...input,
      });
      return { result, update };
    };

    it.each([
      [
        "0 10 * * 1",
        "Europe/Berlin",
        "2026-11-16T09:00:00.000Z",
        "Europe/London",
        "2026-11-16T10:00:00.000Z",
      ],
      [
        "0 10 * * 1",
        "Europe/London",
        "2026-11-16T10:00:00.000Z",
        "Europe/Berlin",
        "2026-11-16T09:00:00.000Z",
      ],
      [
        "30 2 * * 0",
        "UTC",
        "2027-03-28T02:30:00.000Z",
        "Europe/Berlin",
        "2027-03-28T01:30:00.000Z",
      ],
      [
        "0 * * * *",
        "Asia/Kolkata",
        "2026-11-02T00:30:00.000Z",
        "Europe/Berlin",
        "2026-11-02T01:00:00.000Z",
      ],
      [
        "0 * * * *",
        "Europe/Berlin",
        "2026-11-02T01:00:00.000Z",
        "Asia/Kolkata",
        "2026-11-01T20:30:00.000Z",
      ],
      [
        "0 */7 * * *",
        "Europe/Berlin",
        "2026-11-20T03:00:00.000Z",
        "Europe/London",
        "2026-11-20T03:00:00.000Z",
      ],
      [
        "0 0 */3 * *",
        "Europe/Berlin",
        "2026-11-02T23:00:00.000Z",
        "America/New_York",
        "2026-11-03T05:00:00.000Z",
      ],
    ])(
      "keeps a start set for later (%s) when only the timezone changes from %s",
      async (cron, from, next, to, moved) => {
        const { result } = await run(
          { crons: [cron], timezone: from, nextRunAt: new Date(next) },
          { timezone: to },
        );
        expect(result).toMatchObject({ ok: true, nextRunAt: moved });
      },
    );

    it("moves the next run of the current repeat with startAt alone", async () => {
      const { result, update } = await run(
        { crons: ["0 9 * * 1"], timezone: "UTC", nextRunAt: new Date("2026-11-02T09:00:00Z") },
        { schedule: { startAt: "2026-11-16" } },
      );
      expect(result).toMatchObject({ ok: true, nextRunAt: "2026-11-16T09:00:00.000Z" });
    });

    it("leaves the timing alone on a prompt-only edit, so a run's advance is kept", async () => {
      const { update } = await run(
        { crons: ["0 9 * * 1"], timezone: "UTC", nextRunAt: new Date("2026-11-02T09:00:00Z") },
        { prompt: "New prompt" },
      );
      expect(update.mock.calls[0]![0].data).toEqual({
        prompt: "New prompt",
        promptUpdatedAt: expect.any(Date),
      });
    });

    it("does not start a watch or a one-time reminder from startAt alone", async () => {
      const once = await run(
        { crons: ["@once"], timezone: "UTC", nextRunAt: new Date("2026-11-02T09:00:00Z") },
        { schedule: { startAt: "2026-11-16" } },
      );
      expect(once.result).toEqual({ error: "Give cron or every/unit along with startAt." });
    });
  });

  it("names the group an updated routine posts in", async () => {
    const prisma = {
      routine: {
        findFirst: vi.fn(async () => ({
          name: "Note",
          timezone: "UTC",
          crons: ["0 9 * * 1"],
          threadId: "t-group",
        })),
      },
      thread: { findUnique: vi.fn(async () => ({ group: { name: "Investors" } })) },
    };
    const card = await scheduleApproval(
      { prisma: prisma as never },
      { spaceId: "s", botId: "b", userId: "u" },
      "schedule_update",
      { id: "r1", prompt: "Draft a different note" },
      null,
    );
    expect(card?.summary).toBe("Changing “Note”: Every Monday at 9:00 AM, posts in “Investors”");
  });
});

/** A transaction client whose models answer every call with an empty result, except the given ones. */
function fakeTx(overrides: Record<string, Record<string, unknown>>) {
  const models = new Map<string, unknown>();
  return new Proxy(
    {},
    {
      get(_target, model: string) {
        if (!models.has(model)) {
          models.set(
            model,
            new Proxy(overrides[model] ?? {}, {
              get: (own, method: string) =>
                (own as Record<string, unknown>)[method] ??
                (method === "findMany" ? async () => [] : async () => ({ count: 0 })),
            }),
          );
        }
        return models.get(model);
      },
    },
  );
}

describe("cancelScheduleFromTool scope", () => {
  const input = {
    spaceId: "ws-1",
    botId: "bot-1",
    userId: "user-1",
    threadId: "group-thread-1",
    name: "Daily",
  };
  const setup = (deleteCount = 1) => {
    const order: string[] = [];
    const findFirst = vi.fn(async () => ({ id: "routine-1", name: "Daily" }));
    const deleteMany = vi.fn(async () => {
      order.push("deleteMany");
      return { count: deleteCount };
    });
    const findMany = vi.fn(async () => {
      order.push("findMany");
      return [{ id: "run-1", taskId: "task-1" }];
    });
    const updateMany = vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })),
    );
    const tx = fakeTx({
      run: { findMany, updateManyAndReturn: updateMany },
      routine: { deleteMany },
    });
    const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));
    const cancel = vi.fn(async () => undefined);
    const deps = {
      prisma: { routine: { findFirst }, $transaction },
      events: { append: vi.fn(async () => undefined) },
      jobs: { enqueue: vi.fn(async () => undefined), cancel },
    } as unknown as Parameters<typeof cancelScheduleFromTool>[0];
    return { deps, findFirst, deleteMany, findMany, updateMany, cancel, order };
  };

  it("deletes with the caller's scope and cancels queued runs before the delete", async () => {
    const { deps, deleteMany, findMany, updateMany, cancel, order } = setup();

    await expect(cancelScheduleFromTool(deps, input)).resolves.toEqual({
      ok: true,
      routineId: "routine-1",
      name: "Daily",
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { routineId: "routine-1", spaceId: "ws-1", userId: "user-1", status: "queued" },
      select: { id: true, taskId: true },
    });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["run-1"] }, status: { in: [...ACTIVE_RUN_STATUSES] } },
        data: expect.objectContaining({ status: "cancelled" }),
      }),
    );
    expect(order[0]).toBe("findMany");
    expect(order.at(-1)).toBe("deleteMany");
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        spaceId: "ws-1",
        botId: "bot-1",
        userId: "user-1",
        threadId: "group-thread-1",
        id: "routine-1",
      },
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rolls back and keeps the job when the row moved before the delete", async () => {
    const { deps, cancel } = setup(0);
    const prisma = deps.prisma as unknown as { $transaction: ReturnType<typeof vi.fn> };
    await expect(cancelScheduleFromTool(deps, input)).resolves.toEqual({
      error: "Schedule not found.",
    });
    // The sentinel thrown inside the transaction is what rolls the run cancellation back.
    await expect(prisma.$transaction.mock.results[0]!.value).rejects.toThrow();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("cancels nothing when the schedule is not found", async () => {
    const { deps, findFirst, findMany, updateMany, cancel } = setup();
    findFirst.mockResolvedValueOnce(null as never);
    await expect(cancelScheduleFromTool(deps, input)).resolves.toEqual({
      error: "Schedule not found.",
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe("updateScheduleFromTool queued runs", () => {
  const setup = (active: boolean) => {
    const findMany = vi.fn(async () => [{ id: "run-1", taskId: "task-1" }]);
    const updateMany = vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
      where.id.in.map((id) => ({ id })),
    );
    const tx = fakeTx({ run: { findMany, updateManyAndReturn: updateMany } });
    const $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(tx));
    const prisma = {
      routine: {
        findFirst: vi.fn(async () => ({
          id: "r1",
          prompt: "x",
          timezone: "UTC",
          crons: ["0 9 * * *"],
          active,
          nextRunAt: new Date("2030-01-01T09:00:00Z"),
          managedKind: null,
          watch: null,
        })),
        update: vi.fn(async (args: { data: Record<string, unknown> }) => ({
          id: "r1",
          spaceId: "s",
          userId: "u",
          botId: "b",
          name: "Note",
          prompt: "x",
          timezone: "UTC",
          crons: ["0 9 * * *"],
          active,
          nextRunAt: new Date("2030-01-01T09:00:00Z"),
          threadId: null,
          watch: null,
          ...args.data,
        })),
      },
      $transaction,
    };
    const deps = {
      prisma,
      events: { append: vi.fn() },
      jobs: { enqueue: vi.fn(), cancel: vi.fn() },
    } as never;
    return { deps, findMany, updateMany };
  };
  const scope = { spaceId: "s", botId: "b", userId: "u", id: "r1" };

  it("cancels queued runs when an active schedule is paused", async () => {
    const { deps, findMany, updateMany } = setup(true);
    await updateScheduleFromTool(deps, { ...scope, enabled: false });
    expect(findMany).toHaveBeenCalledWith({
      where: { routineId: "r1", spaceId: "s", userId: "u", status: "queued" },
      select: { id: true, taskId: true },
    });
    expect(updateMany).toHaveBeenCalledOnce();
  });

  it("leaves runs alone on a prompt-only edit and on enabled true to true", async () => {
    const { deps, findMany } = setup(true);
    await updateScheduleFromTool(deps, { ...scope, prompt: "new" });
    await updateScheduleFromTool(deps, { ...scope, enabled: true });
    expect(findMany).not.toHaveBeenCalled();
  });
});
