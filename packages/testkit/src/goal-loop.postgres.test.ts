import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { goalCheckJob } from "@rakazo/adapter-kit";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../../apps/api/src/app.ts";
import { discardBotIntroFromCreate } from "./discard-bot-intro.js";

process.env.WAKEUP_DRIVER = "memory";
process.env.SANDBOX_PROVIDER = "fake";
process.env.AGENT_RUNTIME = "scripted";
// A developer's model key makes the runs use that provider, which asks for AI data sharing consent
// and stops in waiting_input. The integration harness blanks these; do the same when run alone.
process.env.OPENROUTER_API_KEY = "";
process.env.MODEL_API_KEY = "";

const hasDb = process.env.VERIFY_DATABASE === "1" && Boolean(process.env.DATABASE_URL);
const describeIntegration = hasDb ? describe : describe.skip;

describeIntegration("goal loop with the scripted runtime and the scripted goal check", () => {
  let handles: Awaited<ReturnType<typeof createApp>>;
  const dataDir = mkdtempSync(path.join(tmpdir(), "rakazo-goal-loop-"));
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    const { createApp } = await import("../../../apps/api/src/app.ts");
    handles = await createApp({
      databaseUrl: process.env.DATABASE_URL!,
      dataDir,
      sandboxProvider: "fake",
      agentRuntime: "scripted",
      wakeupDriver: "memory",
      defaultProvider: "scripted",
      defaultModel: "scripted",
    });
  });
  afterAll(async () => {
    await handles?.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  async function owner(label: string) {
    const cookie = await signup(`goal-${label}-${stamp}@rakazo.test`, `Goal ${label}`);
    const me = await rpc<{ userId: string; spaceId: string }>(cookie, "me");
    const bot = await rpc<{ id: string }>(cookie, "bots/create", {
      name: "Loop",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: true,
    });
    const thread = await handles.prisma.thread.findUniqueOrThrow({ where: { botId: bot.id } });
    await handles.awaitIdle?.();
    return {
      me,
      bot,
      thread,
      say: (text: string) =>
        rpc(cookie, "threads/send", { botId: bot.id, text, clientNonce: `n-${Math.random()}` }),
      stop: () => rpc(cookie, "threads/stop", { botId: bot.id }),
    };
  }
  const goalOf = (threadId: string) =>
    handles.prisma.threadGoal.findFirstOrThrow({
      where: { threadId },
      orderBy: { createdAt: "desc" },
    });
  /** Polls without waiting for the job queue to drain: a hung scripted run never drains it. */
  async function until(done: () => Promise<boolean>, drain = true) {
    for (let i = 0; i < 100; i++) {
      if (drain) await handles.awaitIdle?.();
      if (await done()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const runs = await handles.prisma.run.findMany({
      select: { trigger: true, status: true, error: true, goalId: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    });
    throw new Error(
      `the goal loop did not settle: ${JSON.stringify({ runs, failures: handles.backgroundFailures?.() })}`,
    );
  }

  it("runs continue, continue, met: two continuation runs, one goal block, one notification", async () => {
    const t = await owner("loop");
    await t.say("/goal write a file that says hello [met after 2]");
    await until(async () => (await goalOf(t.thread.id)).status !== "active");

    const goal = await goalOf(t.thread.id);
    expect(goal).toMatchObject({ status: "met", continuations: 2, stopReason: null });
    const runs = await handles.prisma.run.findMany({
      where: { threadId: t.thread.id, goalId: goal.id },
      orderBy: { createdAt: "asc" },
    });
    expect(runs.map((run) => [run.trigger, run.status])).toEqual([
      ["user", "completed"],
      ["goal", "completed"],
      ["goal", "completed"],
    ]);
    for (const run of runs.slice(1)) {
      expect(run).toMatchObject({ unattended: false, externalTaint: false, goalId: goal.id });
    }
    // Each run kept what its tool returned, and the check cited it.
    for (const run of runs) {
      expect(run.goalEvidence).toMatchObject([{ id: "t1", tool: "write_file", ok: true }]);
    }
    const messages = await handles.prisma.message.findMany({
      where: { threadId: t.thread.id, role: "bot" },
      orderBy: { seq: "asc" },
    });
    const goalBlocks = messages.flatMap((m) =>
      (m.blocks as Array<{ kind: string }>).filter((b) => b.kind === "goal"),
    );
    expect(goalBlocks).toMatchObject([
      {
        kind: "goal",
        outcome: "met",
        reason: "Scripted: done.",
        text: "Goal met. Scripted: done.",
      },
    ]);
    // One end notification; the goal runs sent no finish push of their own.
    const notices = await handles.prisma.notification.findMany({
      where: { spaceId: t.me.spaceId, userId: t.me.userId },
    });
    expect(notices.map((n) => n.title)).toEqual(["Loop met the goal"]);
    // The continuation prompt is the Task prompt, not a transcript message.
    const tasks = await handles.prisma.task.findMany({
      where: { id: { in: runs.slice(1).map((run) => run.taskId) } },
    });
    expect(tasks.every((task) => task.prompt.startsWith("Goal check: not done yet."))).toBe(true);
    expect(
      await handles.prisma.message.count({
        where: { threadId: t.thread.id, blocks: { string_contains: "Goal check: not done yet" } },
      }),
    ).toBe(0);
    expect(handles.backgroundFailures?.() ?? []).toEqual([]);
  });

  it("ends blocked after three checks in a row say the owner is needed", async () => {
    const t = await owner("blocked");
    await t.say("/goal write a file that says hello [blocked]");
    await until(async () => (await goalOf(t.thread.id)).status !== "active");
    expect(await goalOf(t.thread.id)).toMatchObject({ status: "blocked", continuations: 2 });
    expect(
      (await handles.prisma.notification.findMany({ where: { userId: t.me.userId } })).map(
        (n) => n.title,
      ),
    ).toEqual(["Loop is blocked on the goal"]);
  });

  it("pauses on Stop, ignores the cancelled run, and resumes with fresh counters on the next message", async () => {
    const t = await owner("stop");
    await t.say("/goal work until i stop");
    await until(async () => {
      const run = await handles.prisma.run.findFirst({
        where: { threadId: t.thread.id, trigger: "user", status: "running" },
      });
      return run !== null;
    }, false);
    const hung = await handles.prisma.run.findFirstOrThrow({
      where: { threadId: t.thread.id, trigger: "user" },
    });
    await t.stop();
    await until(
      async () =>
        (await handles.prisma.run.findUniqueOrThrow({ where: { id: hung.id } })).status ===
        "cancelled",
      false,
    );
    expect(await goalOf(t.thread.id)).toMatchObject({ status: "paused", stopReason: "owner" });

    // A check on the cancelled run does not continue the goal.
    const goal = await goalOf(t.thread.id);
    await handles.jobs.enqueue(goalCheckJob(goal.id, hung.id));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(await goalOf(t.thread.id)).toMatchObject({ status: "paused" });
    expect(await handles.prisma.run.count({ where: { goalId: goal.id, trigger: "goal" } })).toBe(0);

    // The owner's next message resumes it with the counters reset; the run's end continues it.
    await handles.prisma.threadGoal.update({
      where: { id: goal.id },
      data: { continuations: 7, stalls: 2 },
    });
    await t.say("write a file that says resumed");
    await until(
      async () =>
        (await handles.prisma.run.count({ where: { goalId: goal.id, trigger: "goal" } })) === 1,
      false,
    );
    expect(await goalOf(t.thread.id)).toMatchObject({
      status: "active",
      continuations: 1,
      stalls: 0,
    });
    await t.stop();
  });

  async function signup(email: string, name: string) {
    const response = await handles.app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
      body: JSON.stringify({ email, password: "password12", name }),
    });
    expect(response.status).toBeLessThan(400);
    const raw = response.headers.get("set-cookie") ?? "";
    const match = raw.match(/better-auth\.session_token=([^;]+)/);
    expect(match?.[1]).toBeTruthy();
    return `better-auth.session_token=${match![1]}`;
  }

  async function rpc<T>(cookie: string, procedure: string, body: unknown = {}): Promise<T> {
    const response = await handles.app.request(`/rpc/${procedure}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173", cookie },
      body: JSON.stringify({ json: body }),
    });
    const payload = (await response.json()) as { json?: T; error?: { message?: string } };
    if (!response.ok || payload.error) {
      throw new Error(payload.error?.message ?? `${procedure} failed (${response.status})`);
    }
    return discardBotIntroFromCreate(handles, cookie, procedure, payload.json as T);
  }
});
