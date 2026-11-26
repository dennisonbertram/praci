import type { PrismaClient } from "@rakazo/db";
import { createDb, createThreadEvents, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "./rpc-context.js";
import {
  clearThreadGoal,
  sendThreadMessage,
  stopThreadRuns,
  threadSnapshot,
} from "./thread-target.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("thread goals (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const ids = {
    user: `goal-user-${suffix}`,
    other: `goal-other-${suffix}`,
    org: `goal-org-${suffix}`,
    space: `goal-sp-${suffix}`,
  };
  let prisma: PrismaClient;
  let app: ReturnType<typeof createDb>;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;
  let groupThreadId: string;
  let groupId: string;
  const actor = { spaceId: ids.space, userId: ids.user } as Actor;
  const deps = () =>
    ({
      prisma: app.prisma,
      events: createThreadEvents(app.prisma),
      jobs: { enqueue: async () => undefined },
      sandbox: {} as never,
    }) as never;
  const botTarget = () => ({ kind: "bot", botId, threadId }) as never;
  const inTenant = <T>(fn: () => Promise<T>) =>
    runAsTenant({ spaceId: ids.space, userId: ids.user }, fn);
  const say = (text: string) =>
    inTenant(() => sendThreadMessage(deps(), actor, botTarget(), { text }));
  const userError = async (promise: Promise<unknown>) => {
    const error = await promise.then(
      () => null,
      (e: unknown) => e as { code?: string; message?: string; data?: unknown },
    );
    expect(error).not.toBeNull();
    return error!;
  };
  const goals = () =>
    prisma.threadGoal.findMany({ where: { threadId }, orderBy: { createdAt: "asc" } });
  const goalEvents = () =>
    prisma.event.findMany({ where: { threadId, type: "thread.goal.updated" } });

  beforeAll(async () => {
    const db = createDb(process.env.DATABASE_MIGRATION_URL || databaseUrl!);
    app = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
      await app.prisma.$disconnect();
      await app.pool.end();
    };
    for (const id of [ids.user, ids.other]) {
      await prisma.user.create({ data: { id, name: "Tester", email: `${id}@example.test` } });
    }
    await prisma.organization.create({
      data: { id: ids.org, name: "Org", slug: ids.org, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: ids.space, organizationId: ids.org, name: "General", isDefault: true },
    });
    botId = (
      await prisma.bot.create({
        data: { spaceId: ids.space, userId: ids.user, name: "Mercury", color: "blue" },
      })
    ).id;
    threadId = (
      await prisma.thread.create({ data: { spaceId: ids.space, userId: ids.user, botId } })
    ).id;
    const group = await prisma.chatGroup.create({
      data: { spaceId: ids.space, userId: ids.user, name: "Team" },
    });
    groupId = group.id;
    groupThreadId = (
      await prisma.thread.create({ data: { spaceId: ids.space, userId: ids.user, groupId } })
    ).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.user, ids.other] } } });
    await close();
  });
  beforeEach(async () => {
    await prisma.thread.update({ where: { id: threadId }, data: { unread: false } });
    await prisma.run.deleteMany({ where: { threadId } });
    await prisma.message.deleteMany({ where: { threadId } });
    await prisma.task.deleteMany({ where: { threadId } });
    await prisma.threadGoal.deleteMany({ where: { threadId } });
    await prisma.event.deleteMany({ where: { threadId } });
  });

  it("set creates the goal, the message as typed, and a run that carries the goal", async () => {
    const sent = await say("/goal find three suppliers");
    const [goal] = await goals();
    expect(goal).toMatchObject({
      spaceId: ids.space,
      userId: ids.user,
      threadId,
      botId,
      text: "find three suppliers",
      status: "active",
      continuations: 0,
      stalls: 0,
    });
    const run = await prisma.run.findUniqueOrThrow({
      where: { id: sent.runId },
      include: { task: true },
    });
    expect(run.goalId).toBe(goal!.id);
    expect(run.task.prompt).toContain("find three suppliers");
    expect(run.task.prompt).not.toContain("/goal");
    const message = await prisma.message.findFirstOrThrow({ where: { threadId, role: "user" } });
    expect(message.blocks).toEqual([{ kind: "text", text: "/goal find three suppliers" }]);
    expect(await goalEvents()).toHaveLength(1);
  });

  it("set replaces an open goal and tags a run that is already live", async () => {
    const first = await say("/goal first");
    const second = await say("/goal second");
    const all = await goals();
    expect(all.map((g) => [g.text, g.status])).toEqual([
      ["first", "cleared"],
      ["second", "active"],
    ]);
    expect(all[0]!.endedAt).not.toBeNull();
    // The second message steered the live run, which now belongs to the new goal.
    expect(second.runId).toBe(first.runId);
    expect((await prisma.run.findUniqueOrThrow({ where: { id: first.runId } })).goalId).toBe(
      all[1]!.id,
    );
  });

  it("rejects /goal in a group and an over-long goal with the exact messages", async () => {
    const groupError = await userError(
      inTenant(() =>
        sendThreadMessage(
          deps(),
          actor,
          {
            kind: "group",
            groupId,
            threadId: groupThreadId,
            groupName: "Team",
            members: [],
            memberBotIds: [],
          } as never,
          { text: "/goal x" },
        ),
      ),
    );
    expect(groupError.message).toBe("Goals work in a bot's own chat.");
    const long = await userError(say(`/goal ${"a".repeat(2001)}`));
    expect(long.message).toBe("Keep the goal under 2,000 characters.");
    expect(await goals()).toHaveLength(0);
    expect(await prisma.message.count({ where: { threadId } })).toBe(0);
  });

  it("show and clear answer through the error and create no message or run", async () => {
    expect((await userError(say("/goal"))).message).toBe("No goal set.");
    expect((await userError(say("/goal clear"))).message).toBe("No goal set.");
    await say("/goal ship it");
    const messages = await prisma.message.count({ where: { threadId } });
    const runs = await prisma.run.count({ where: { threadId } });
    const shown = await userError(say("/goal"));
    expect(shown.message).toBe("Goal: ship it");
    expect(shown.data).toEqual({ goalReply: true });
    await prisma.threadGoal.updateMany({ where: { threadId }, data: { status: "paused" } });
    expect((await userError(say("/goal"))).message).toBe("Goal: ship it (paused)");
    expect((await userError(say("/goal clear"))).message).toBe("Goal cleared.");
    expect((await goals())[0]).toMatchObject({ status: "cleared" });
    expect((await goals())[0]!.endedAt).not.toBeNull();
    expect(await prisma.message.count({ where: { threadId } })).toBe(messages);
    expect(await prisma.run.count({ where: { threadId } })).toBe(runs);
  });

  it("clearGoal clears the open goal and is harmless without one", async () => {
    await inTenant(() => clearThreadGoal(deps(), actor, botTarget()));
    await say("/goal ship it");
    await inTenant(() => clearThreadGoal(deps(), actor, botTarget()));
    expect((await goals())[0]!.status).toBe("cleared");
    expect(await goalEvents()).toHaveLength(2);
  });

  it("stop pauses the goal, and the next message resumes it with fresh counters", async () => {
    await say("/goal ship it");
    await prisma.threadGoal.updateMany({
      where: { threadId },
      data: { continuations: 7, stalls: 2 },
    });
    await inTenant(() => stopThreadRuns(deps(), actor, botTarget()));
    expect((await goals())[0]).toMatchObject({ status: "paused", stopReason: "owner" });

    const sent = await say("keep going");
    const [goal] = await goals();
    expect(goal).toMatchObject({
      status: "active",
      stopReason: null,
      continuations: 0,
      stalls: 0,
    });
    expect((await prisma.run.findUniqueOrThrow({ where: { id: sent.runId } })).goalId).toBe(
      goal!.id,
    );
  });

  it("a plain message with an active goal tags its new run", async () => {
    await say("/goal ship it");
    await prisma.run.updateMany({ where: { threadId }, data: { status: "completed" } });
    const sent = await say("and another thing");
    const [goal] = await goals();
    expect((await prisma.run.findUniqueOrThrow({ where: { id: sent.runId } })).goalId).toBe(
      goal!.id,
    );
  });

  it("allows only one open goal per thread", async () => {
    await say("/goal ship it");
    await expect(
      prisma.threadGoal.create({
        data: {
          spaceId: ids.space,
          userId: ids.user,
          threadId,
          botId,
          text: "again",
          status: "paused",
        },
      }),
    ).rejects.toThrow();
  });

  it("the snapshot shows the open goal only", async () => {
    await say("/goal ship it");
    await prisma.threadGoal.updateMany({
      where: { threadId },
      data: { lastVerdict: { verdict: "continue", reason: "two of three found" } },
    });
    const target = {
      kind: "bot",
      botId,
      threadId,
      bot: await prisma.bot.findUniqueOrThrow({
        where: { id: botId },
        include: { computer: true },
      }),
    } as never;
    const snap = await inTenant(() => threadSnapshot({ prisma: app.prisma }, target));
    expect(snap.goal).toMatchObject({
      text: "ship it",
      status: "active",
      stopReason: null,
      lastReason: "two of three found",
      continuations: 0,
    });
    await inTenant(() => clearThreadGoal(deps(), actor, botTarget()));
    expect((await inTenant(() => threadSnapshot({ prisma: app.prisma }, target))).goal).toBeNull();
  });

  it("clearing the thread ends the goal", async () => {
    await say("/goal ship it");
    await inTenant(() =>
      createThreadEvents(app.prisma).clearThread({ spaceId: ids.space, threadId, botId }),
    );
    expect((await goals())[0]).toMatchObject({ status: "cleared" });
    expect((await goals())[0]!.endedAt).not.toBeNull();
  });
});
