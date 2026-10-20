import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createScheduleFromTool,
  listSchedulesFromTool,
  loadUserTimezone,
  scheduleApproval,
  scheduleRunsFromTool,
  updateScheduleFromTool,
} from "./schedule-tools.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("schedule tools (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `st-org-${suffix}`;
  const spaceId = `st-space-${suffix}`;
  const userId = `st-user-${suffix}`;
  const otherUserId = `st-other-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let otherBotId: string;
  let threadId: string;
  const jobs = { enqueue: vi.fn(async () => {}), cancel: vi.fn(async () => {}) };
  const events = { append: vi.fn(async () => {}) };
  const deps = () =>
    ({ prisma, events, jobs }) as unknown as Parameters<typeof updateScheduleFromTool>[0];
  const scope = () => ({ spaceId, botId, userId });

  const create = (name: string, schedule: Record<string, unknown>, timezone?: string) =>
    createScheduleFromTool(deps(), {
      ...scope(),
      threadId,
      name,
      prompt: `Do ${name}`,
      timezone,
      schedule,
    });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [userId, otherUserId].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await prisma.organization.create({
      data: { id: orgId, name: "ST Org", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: spaceId } });
    botId = (await prisma.bot.create({ data: { spaceId, userId, name: "A", color: "blue" } })).id;
    otherBotId = (await prisma.bot.create({ data: { spaceId, userId, name: "B", color: "red" } }))
      .id;
    threadId = (await prisma.thread.create({ data: { spaceId, userId, botId } })).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("stores and updates the user's time zone", async () => {
    expect(await loadUserTimezone(prisma, userId)).toBeNull();
    await prisma.user.update({ where: { id: userId }, data: { timezone: "America/New_York" } });
    expect(await loadUserTimezone(prisma, userId)).toBe("America/New_York");
    await prisma.user.update({ where: { id: userId }, data: { timezone: "Asia/Tokyo" } });
    expect(await loadUserTimezone(prisma, userId)).toBe("Asia/Tokyo");
    // Another user's zone is separate.
    expect(await loadUserTimezone(prisma, otherUserId)).toBeNull();
  });

  it("defaults a new schedule to the user's zone and reads it in words", async () => {
    const made = await create("Morning", { cron: "0 8 * * *" });
    expect(made).toMatchObject({
      ok: true,
      timezone: "Asia/Tokyo",
      schedule: "Every day at 8:00 AM (Asia/Tokyo)",
    });
    // 08:00 in Tokyo is 23:00 UTC the day before.
    const row = await prisma.routine.findFirstOrThrow({ where: { name: "Morning", userId } });
    expect(row.nextRunAt?.getUTCHours()).toBe(23);
    const explicit = await create("Paris", { cron: "0 8 * * *" }, "Europe/Paris");
    expect(explicit).toMatchObject({ ok: true, timezone: "Europe/Paris" });
    expect(await create("Bad", { cron: "0 8 * * *" }, "Not/AZone")).toEqual({
      error: "Unknown time zone: Not/AZone.",
    });
  });

  it("asks only for repeating creates", async () => {
    const ask = (args: Record<string, unknown>) =>
      scheduleApproval(deps(), scope(), "schedule_create", args, "Asia/Tokyo");
    const repeating = await ask({
      name: "Digest",
      prompt: "Summarize my mail",
      cron: "30 7 * * *",
    });
    expect(repeating?.summary).toBe("creating the repeating schedule “Digest”");
    expect(repeating?.detail).toContain("repeats: Every day at 7:30 AM (Asia/Tokyo)");
    expect(repeating?.detail).toContain("next run:");
    expect(repeating?.detail).toContain("prompt: Summarize my mail");
    expect(await ask({ name: "x", prompt: "p", every: 2, unit: "hours" })).toBeDefined();
    // Blank leftovers from a model are not a repeat.
    expect(
      await ask({ name: "x", prompt: "p", delayMinutes: 10, cron: "", every: null, unit: "" }),
    ).toBeUndefined();
    expect(await ask({ name: "x", prompt: "p", delaySeconds: 30 })).toBeUndefined();
    expect(
      await ask({ name: "x", prompt: "p", runAt: new Date(Date.now() + 3_600_000).toISOString() }),
    ).toBeUndefined();
    // An invalid call fails inside the tool; nothing is saved, so no card.
    expect(await ask({ name: "x", prompt: "p", cron: "nope" })).toBeUndefined();
    expect(
      await scheduleApproval(deps(), scope(), "schedule_list", {}, "Asia/Tokyo"),
    ).toBeUndefined();
  });

  it("applies the update rules", async () => {
    const repeating = (await create("Weekly", { cron: "0 9 * * 1" })) as { routineId: string };
    const oneOff = (await create("Once", { delayMinutes: 90 })) as { routineId: string };
    const ask = (args: Record<string, unknown>) =>
      scheduleApproval(deps(), scope(), "schedule_update", args, "Asia/Tokyo");

    // A new prompt for a repeating schedule asks; the card shows the whole prompt and its schedule.
    const promptChange = await ask({ id: repeating.routineId, prompt: "Full new prompt" });
    expect(promptChange?.summary).toBe("changing the repeating schedule “Weekly”");
    expect(promptChange?.detail).toContain("repeats: Every Monday at 9:00 AM (Asia/Tokyo)");
    expect(promptChange?.detail).toContain("prompt: Full new prompt");
    // Making a one-off repeat asks.
    expect(await ask({ id: oneOff.routineId, schedule: { cron: "0 9 * * *" } })).toBeDefined();
    // Other edits are free: a one-off's prompt, pausing, a zone change, a switch to one-shot.
    expect(await ask({ id: oneOff.routineId, prompt: "New text" })).toBeUndefined();
    expect(await ask({ id: repeating.routineId, enabled: false })).toBeUndefined();
    expect(await ask({ id: repeating.routineId, timezone: "Europe/Paris" })).toBeUndefined();
    expect(await ask({ id: repeating.routineId, schedule: { delayMinutes: 5 } })).toBeUndefined();
    // A routine the bot cannot manage produces no card (the tool itself refuses).
    expect(await ask({ id: "missing", prompt: "x" })).toBeUndefined();

    // The update replaces the whole prompt and returns the saved routine.
    const saved = await updateScheduleFromTool(deps(), {
      ...scope(),
      id: repeating.routineId,
      prompt: "  Full new prompt  ",
      schedule: { cron: "0 10 * * 2" },
      timezone: "Europe/Paris",
    });
    expect(saved).toMatchObject({
      ok: true,
      routineId: repeating.routineId,
      prompt: "Full new prompt",
      schedule: "Every Tuesday at 10:00 AM (Europe/Paris)",
      timezone: "Europe/Paris",
      enabled: true,
    });
    expect(jobs.enqueue).toHaveBeenCalled();

    // Pausing cancels the wakeup and clears the next run; resuming schedules it again.
    jobs.cancel.mockClear();
    const paused = await updateScheduleFromTool(deps(), {
      ...scope(),
      id: repeating.routineId,
      enabled: false,
    });
    expect(paused).toMatchObject({ ok: true, enabled: false, nextRunAt: null });
    expect(jobs.cancel).toHaveBeenCalled();
    const resumed = (await updateScheduleFromTool(deps(), {
      ...scope(),
      id: repeating.routineId,
      enabled: true,
    })) as { nextRunAt: string | null };
    expect(resumed.nextRunAt).not.toBeNull();

    // A blank prompt, an unknown zone and a bad schedule are refused without changing anything.
    expect(
      await updateScheduleFromTool(deps(), {
        ...scope(),
        id: repeating.routineId,
        timezone: "X/Y",
      }),
    ).toEqual({ error: "Unknown time zone: X/Y." });
    expect(
      await updateScheduleFromTool(deps(), {
        ...scope(),
        id: repeating.routineId,
        schedule: { cron: "nope" },
      }),
    ).toMatchObject({ error: expect.any(String) });
    expect(
      (await prisma.routine.findUniqueOrThrow({ where: { id: repeating.routineId } })).prompt,
    ).toBe("Full new prompt");
  });

  it("lists recent runs with status, time, notification and error", async () => {
    const routine = (await create("Checked", { cron: "0 6 * * *" })) as { routineId: string };
    const task = await prisma.task.create({
      data: { spaceId, botId, threadId, userId, prompt: "p", status: "done" },
    });
    const base = {
      spaceId,
      botId,
      threadId,
      taskId: task.id,
      userId,
      routineId: routine.routineId,
    };
    const ok = await prisma.run.create({
      data: {
        ...base,
        status: "completed",
        trigger: "routine",
        startedAt: new Date("2026-10-01T06:00:00Z"),
        createdAt: new Date("2026-10-01T06:00:00Z"),
      },
    });
    const failed = await prisma.run.create({
      data: {
        ...base,
        status: "failed",
        trigger: "routine",
        error: "Gmail rejected the request",
        startedAt: new Date("2026-10-02T06:00:00Z"),
        createdAt: new Date("2026-10-02T06:00:00Z"),
      },
    });
    await prisma.notification.create({
      data: {
        spaceId,
        userId,
        botId,
        routineId: routine.routineId,
        runId: ok.id,
        surface: "thread",
        title: "Done",
        dedupeKey: `st-${suffix}`,
      },
    });

    const result = (await scheduleRunsFromTool(deps(), { ...scope(), id: routine.routineId })) as {
      runs: Array<Record<string, unknown>>;
    };
    expect(result.runs).toEqual([
      {
        runId: failed.id,
        status: "failed",
        at: "2026-10-02T06:00:00.000Z",
        finishedAt: null,
        notificationCreated: false,
        error: "Gmail rejected the request",
      },
      {
        runId: ok.id,
        status: "completed",
        at: "2026-10-01T06:00:00.000Z",
        finishedAt: null,
        notificationCreated: true,
      },
    ]);
    const limited = (await scheduleRunsFromTool(deps(), {
      ...scope(),
      id: routine.routineId,
      limit: 1,
    })) as { runs: unknown[] };
    expect(limited.runs).toHaveLength(1);
  });

  it("refuses another user's or another bot's routine", async () => {
    const mine = (await create("Private", { cron: "0 5 * * *" })) as { routineId: string };
    const intruder = { spaceId, botId, userId: otherUserId };
    const otherBot = { spaceId, botId: otherBotId, userId };
    const otherSpace = { spaceId: `${spaceId}-x`, botId, userId };
    for (const who of [intruder, otherBot, otherSpace]) {
      expect(
        await updateScheduleFromTool(deps(), { ...who, id: mine.routineId, prompt: "hijack" }),
      ).toEqual({ error: "Schedule not found." });
      expect(await scheduleRunsFromTool(deps(), { ...who, id: mine.routineId })).toEqual({
        error: "Schedule not found.",
      });
      expect(
        await scheduleApproval(
          deps(),
          who,
          "schedule_update",
          {
            id: mine.routineId,
            prompt: "hijack",
          },
          null,
        ),
      ).toBeUndefined();
      const listed = (await listSchedulesFromTool(deps(), who)) as {
        routines: Array<{ routineId: string }>;
      };
      expect(listed.routines.map((r) => r.routineId)).not.toContain(mine.routineId);
    }
    expect((await prisma.routine.findUniqueOrThrow({ where: { id: mine.routineId } })).prompt).toBe(
      "Do Private",
    );
  });
});
