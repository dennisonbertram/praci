import type { McpAgentDeps } from "@rakazo/adapters";
import { decideExternalAction } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  createDb,
  createThreadEvents,
  createThreadMessageInTransaction,
  requireMembership,
  runAsSystem,
  runAsTenant,
  setApprovalRule,
} from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleMcpRequest } from "./mcp-server.js";
import { loadMessagePage } from "./thread-message-pages.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("MCP agent_send and thread_read (PostgreSQL, runtime login)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `mcpa-org-${suffix}`;
  const [spaceA, spaceB] = [`mcpa-space-a-${suffix}`, `mcpa-space-b-${suffix}`];
  const [alice, bob] = [`mcpa-alice-${suffix}`, `mcpa-bob-${suffix}`];
  const bots: Record<string, { id: string; threadId: string }> = {};
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let actor: Actor;
  let agents: McpAgentDeps;
  /** The scripted runtime: what a worker would do when it picks the run up. */
  let script: (runId: string) => void = () => undefined;

  const finish = (runId: string, text: string) =>
    runAsSystem("mcp test", async () => {
      const run = await prisma.run.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date() },
      });
      await prisma.$transaction((tx) =>
        createThreadMessageInTransaction(tx, {
          threadId: run.threadId,
          role: "bot",
          blocks: [{ kind: "text", text }],
          botId: run.botId,
          runId,
        }),
      );
    });
  const setStatus = (runId: string, status: string) =>
    runAsSystem("mcp test", () => prisma.run.update({ where: { id: runId }, data: { status } }));
  const runs = () =>
    runAsSystem("mcp test", () =>
      prisma.run.findMany({ where: { spaceId: spaceA }, orderBy: { createdAt: "asc" } }),
    );
  const connect = (extra = {}) =>
    runAsSystem("mcp test", () =>
      prisma.mcpConnection.create({
        data: { userId: alice, spaceId: spaceA, kind: "pat", label: "Claude Code", ...extra },
      }),
    );
  const rule = (effect: "always_allow" | "require_approval") =>
    runAsTenant(actor, () =>
      setApprovalRule(prisma, {
        userId: alice,
        spaceId: spaceA,
        matchKind: "tool",
        matchValue: "agent_send",
        effect,
      }),
    );
  const clearRules = () =>
    runAsSystem("mcp test", () =>
      prisma.actionApprovalRule.deleteMany({ where: { spaceId: spaceA } }),
    );
  const callTool = async (
    connection: { id: string; readOnly: boolean },
    name: string,
    args = {},
  ) => {
    const call = {
      actor,
      connectionId: connection.id,
      scopes: connection.readOnly ? ["mcp:read"] : ["mcp:read", "mcp:write"],
    };
    const response = await handleMcpRequest(
      prisma,
      call,
      new Request("http://mcp.test/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: args },
        }),
      }),
      undefined,
      agents,
    );
    const { result } = (await response.json()) as {
      result: { isError?: boolean; content: Array<{ text: string }> };
    };
    return { isError: Boolean(result.isError), data: JSON.parse(result.content[0]!.text) };
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    const events = createThreadEvents(prisma);
    agents = {
      events,
      jobs: {
        enqueue: async (job: unknown) => {
          const runId = (job as { payload?: { runId?: string } }).payload?.runId;
          if (runId) script(runId);
        },
      } as McpAgentDeps["jobs"],
    };
    for (const id of [alice, bob]) {
      await prisma.user.create({ data: { id, name: id, email: `${id}@x.test` } });
    }
    await prisma.organization.create({
      data: { id: organizationId, name: "MCP Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB].map((id) => ({ id, organizationId, name: id })),
    });
    for (const userId of [alice, bob]) {
      await prisma.member.create({
        data: { id: `m-${userId}`, organizationId, userId, role: "member", createdAt: new Date() },
      });
    }
    await prisma.spaceMember.createMany({
      data: [
        [alice, spaceA],
        [alice, spaceB],
        [bob, spaceA],
      ].map(([userId, spaceId]) => ({
        id: `sm-${userId}-${spaceId}`,
        organizationId,
        spaceId: spaceId!,
        userId: userId!,
        createdAt: new Date(),
      })),
    });
    actor = await requireMembership(prisma, alice, spaceA);
    await runAsSystem("mcp test", async () => {
      for (const [key, spaceId, userId] of [
        ["alice", spaceA, alice],
        ["aliceB", spaceB, alice],
        ["bob", spaceA, bob],
      ] as const) {
        const bot = await prisma.bot.create({
          data: { spaceId, userId, name: key, color: "blue" },
        });
        const thread = await prisma.thread.create({
          data: { spaceId, userId, botId: bot.id },
        });
        bots[key] = { id: bot.id, threadId: thread.id };
      }
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
    await close();
  });

  it("hides agent_send from a read-only connection and refuses it; thread_read stays", async () => {
    const readOnly = await connect({ readOnly: true });
    const refused = await callTool(readOnly, "agent_send", {
      botId: bots.alice!.id,
      message: "hello",
    });
    expect(refused).toEqual({ isError: true, data: { error: "This connection is read-only" } });
    expect(await runs()).toHaveLength(0);
    const read = await callTool(readOnly, "thread_read", { threadId: bots.alice!.threadId });
    expect(read.isError).toBe(false);
  });

  it("asks by default and starts no run until the member approves", async () => {
    await clearRules();
    const writer = await connect();
    const { data } = await callTool(writer, "agent_send", {
      botId: bots.alice!.id,
      message: "Summarize my week",
    });
    expect(data).toEqual({ status: "pending_approval", actionId: expect.any(String) });
    expect(await runs()).toHaveLength(0);

    // Approving starts the run and returns; action_status then follows it to its reply.
    await runAsTenant(actor, () =>
      decideExternalAction(prisma, actor, data.actionId, "approve", { agents }),
    );
    const [run] = await runs();
    expect(run?.trigger).toBe("mcp");
    const running = await callTool(writer, "action_status", { actionId: data.actionId });
    expect(running.data.status).toBe("done");
    expect(running.data.result).toMatchObject({ runId: run!.id, status: "running" });
    await finish(run!.id, "You had three meetings.");
    const done = await callTool(writer, "action_status", { actionId: data.actionId });
    expect(done.data.result).toMatchObject({
      status: "completed",
      untrusted_text: { reply: "You had three meetings." },
    });
  });

  it("returns the reply within the wait, as an unattended and tainted mcp run", async () => {
    await clearRules();
    await rule("always_allow");
    script = (runId) => void setTimeout(() => void finish(runId, "Hi from the agent"), 200);
    const writer = await connect({ label: "Cursor" });
    const before = (await runs()).length;
    const { data, isError } = await callTool(writer, "agent_send", {
      botId: bots.alice!.id,
      message: "Say hi",
      waitSeconds: 10,
    });
    expect(isError).toBe(false);
    expect(data).toMatchObject({
      threadId: bots.alice!.threadId,
      status: "completed",
      untrusted_text: { reply: "Hi from the agent" },
    });
    const all = await runs();
    expect(all).toHaveLength(before + 1);
    expect(all.at(-1)).toMatchObject({ trigger: "mcp", unattended: true, externalTaint: true });

    // thread_read returns both messages, text under untrusted_text.
    const read = await callTool(writer, "thread_read", { threadId: bots.alice!.threadId });
    const texts = read.data.messages.map(
      (m: { untrusted_text: { text: string } }) => m.untrusted_text.text,
    );
    expect(texts.slice(-2)).toEqual(["Say hi", "Hi from the agent"]);

    // The thread names the connection that sent the message.
    const page = await runAsTenant(actor, () =>
      loadMessagePage(prisma, bots.alice!.threadId, undefined, 50),
    );
    expect(page.messages.findLast((m) => m.role === "user" && m.via)?.via).toBe("Cursor");
    // The live event carries it too, so the label shows without a reload.
    const live = await runAsSystem("mcp test", () =>
      prisma.event.findMany({
        where: { threadId: bots.alice!.threadId, type: "thread.message.created" },
        orderBy: { seq: "desc" },
      }),
    );
    expect(
      live.find((e) => (e.payload as { role?: string }).role === "user")?.payload,
    ).toMatchObject({
      via: "Cursor",
    });
    script = () => undefined;
  });

  it("returns running at the timeout and waiting_for_approval when the run holds", async () => {
    await clearRules();
    await rule("always_allow");
    const writer = await connect();
    // Nothing finishes the run, and the wait is zero.
    const slow = await callTool(writer, "agent_send", {
      botId: bots.alice!.id,
      message: "Take your time",
      waitSeconds: 0,
    });
    expect(slow.data).toMatchObject({ status: "running", runId: expect.any(String) });
    // The earlier run is still active, so a second send steers it. Let it finish first.
    await finish(slow.data.runId, "done");

    script = (runId) => void setTimeout(() => void setStatus(runId, "waiting_input"), 100);
    const held = await callTool(writer, "agent_send", {
      botId: bots.alice!.id,
      message: "Do something risky",
      waitSeconds: 10,
    });
    expect(held.data).toMatchObject({ status: "waiting_for_approval", runId: expect.any(String) });
    expect(held.data.untrusted_text).toBeUndefined();
    script = () => undefined;
    await finish(held.data.runId, "ok");
  });

  it("finds only the member's own agents and threads in this Space", async () => {
    await clearRules();
    await rule("always_allow");
    const writer = await connect();
    const before = (await runs()).length;
    for (const botId of [bots.bob!.id, bots.aliceB!.id, "missing"]) {
      const sent = await callTool(writer, "agent_send", { botId, message: "hi" });
      expect(sent).toEqual({ isError: true, data: { error: "Agent not found" } });
    }
    const wrongThread = await callTool(writer, "agent_send", {
      botId: bots.alice!.id,
      message: "hi",
      threadId: bots.bob!.threadId,
    });
    expect(wrongThread.data).toEqual({ error: "Agent not found" });
    for (const threadId of [bots.bob!.threadId, bots.aliceB!.threadId, "missing"]) {
      const read = await callTool(writer, "thread_read", { threadId });
      expect(read).toEqual({ isError: true, data: { error: "Thread not found" } });
    }
    expect(await runs()).toHaveLength(before);
    await clearRules();
  });
});
