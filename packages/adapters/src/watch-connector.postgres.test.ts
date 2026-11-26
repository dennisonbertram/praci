import type {
  AdapterContext,
  ConnectorCall,
  ConnectorEvent,
  ConnectorProvider,
  ConnectorTool,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createWatchFromTool, scheduleApproval } from "./schedule-tools.js";
import { WATCH_CONNECTOR_TIMEOUT_MS } from "./watch-connector.js";
import { runWatchProbeTick } from "./watch-probe.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

/** A connector that serves tools only for the connections in the context, like Composio does. */
class FakeConnector implements ConnectorProvider {
  tools: Array<ConnectorTool & { connectionId: string }> = [];
  value: unknown = { balance: 100 };
  executed: string[] = [];
  /** Runs after discovery and before the provider call, to change state mid-check. */
  beforeExecute?: () => Promise<void>;
  /** Offer only the catalog's execute wrapper, as a connector with many tools does. */
  catalog = false;
  async resolveCall(call: ConnectorCall, context: AdapterContext) {
    const ids = new Set((context.connectedConnections ?? []).map((row) => row.id));
    const tool = this.tools.find(
      (candidate) => candidate.name === call.args.id && ids.has(candidate.connectionId),
    );
    if (!tool) throw new Error("Tool is unknown or not authorized for this bot");
    // The real catalog checks the arguments against the tool's schema.
    if (typeof (call.args.arguments as { account?: unknown }).account === "number")
      throw new Error("Tool arguments are invalid");
    const { connectionId, ...rest } = tool;
    const resolved = {
      ...rest,
      route: { connectorId: "composio", toolName: tool.name, connectionId },
    };
    return {
      tool: resolved,
      call: {
        ...call,
        tool: tool.name,
        args: call.args.arguments as Record<string, unknown>,
        route: resolved.route,
      },
    };
  }
  describe() {
    return {
      id: "composio",
      contractVersion: "1",
      adapterVersion: "0",
      capabilities: { discover: true, oauth: false, secretsBrokered: false },
    };
  }
  async discoverTools(context: AdapterContext, only?: readonly string[]) {
    const ids = new Set((context.connectedConnections ?? []).map((row) => row.id));
    if (this.catalog) {
      return ids.size === 0
        ? []
        : [
            {
              name: "fake_execute_tool",
              description: "Run a tool by id.",
              inputSchema: { type: "object" },
              route: { connectorId: "composio", toolName: "__catalog_execute" },
            },
          ];
    }
    return this.tools
      .filter((tool) => ids.has(tool.connectionId) && (!only || only.includes("composio")))
      .map(({ connectionId, ...tool }) => ({
        ...tool,
        route: { connectorId: "composio", toolName: tool.name, connectionId },
      }));
  }
  async *execute(call: ConnectorCall): AsyncIterable<ConnectorEvent> {
    await this.beforeExecute?.();
    const denied = await call.beforeDispatch?.();
    if (denied) {
      yield { type: "error", message: denied };
      return;
    }
    this.executed.push(call.tool);
    yield { type: "result", data: this.value };
  }
}

describePostgres("connected-app watches (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const orgId = `wc-org-${suffix}`;
  const spaceId = `wc-space-${suffix}`;
  const otherSpaceId = `wc-other-${suffix}`;
  const userId = `wc-user-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let threadId: string;
  let connectionId: string;
  let otherConnectionId: string;
  const jobs = { enqueue: vi.fn(async () => {}), cancel: vi.fn(async () => {}) };
  const events = { append: vi.fn(async () => {}) };
  const fake = new FakeConnector();
  const deps = () =>
    ({ prisma, events, jobs, connector: fake }) as unknown as Parameters<
      typeof createWatchFromTool
    >[0];
  let clock = new Date();
  const tick = () => {
    clock = new Date(clock.getTime() + 24 * 60 * 60_000);
    return runWatchProbeTick({
      prisma,
      jobs: jobs as never,
      events: events as never,
      connector: fake,
      now: () => clock,
    });
  };
  const create = (name: string, tool: string, args: Record<string, unknown> = {}) =>
    createWatchFromTool(deps(), {
      spaceId,
      botId,
      userId,
      threadId,
      name,
      instruction: "Tell me the new number.",
      tool,
      arguments: args,
    });
  const routineNamed = (name: string) =>
    prisma.routine.findFirstOrThrow({ where: { spaceId, name } });
  const runs = (routineId: string) => prisma.run.findMany({ where: { routineId } });
  const read = (name: string): ConnectorTool & { connectionId: string } => ({
    name,
    description: name,
    inputSchema: { type: "object", properties: { account: { type: "string" } } },
    readOnly: true,
    connectionId,
  });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: orgId, name: "WC Org", slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: spaceId } });
    await prisma.space.create({
      data: { id: otherSpaceId, organizationId: orgId, name: otherSpaceId },
    });
    botId = (await prisma.bot.create({ data: { spaceId, userId, name: "A", color: "blue" } })).id;
    threadId = (await prisma.thread.create({ data: { spaceId, userId, botId } })).id;
    connectionId = (
      await prisma.connection.create({
        data: {
          spaceId,
          userId,
          connectorId: "composio",
          provider: "fakebank",
          displayName: "Fake Bank",
          status: "connected",
        },
      })
    ).id;
    otherConnectionId = (
      await prisma.connection.create({
        data: {
          spaceId: otherSpaceId,
          userId,
          connectorId: "composio",
          provider: "otherbank",
          displayName: "Other Bank",
          status: "connected",
        },
      })
    ).id;
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("refuses to create a watch on a write tool, a flipped tool, a missing tool or another space's connection", async () => {
    fake.tools = [
      read("list_accounts"),
      { ...read("create_payment"), readOnly: undefined },
      { ...read("list_flipped"), readOnly: false },
      { ...read("list_foreign"), connectionId: otherConnectionId },
    ];
    for (const tool of ["create_payment", "list_flipped", "list_foreign", "list_missing"]) {
      expect(await create(`Bad ${tool}`, tool)).toHaveProperty("error");
    }
    expect(await prisma.routine.count({ where: { spaceId } })).toBe(0);
    expect(fake.executed).toEqual([]);
  });

  it("refuses a connection limited to other agents", async () => {
    await prisma.connection.update({ where: { id: connectionId }, data: { allAgents: false } });
    fake.tools = [read("list_accounts")];
    expect(await create("Limited", "list_accounts")).toHaveProperty("error");
    await prisma.connection.update({ where: { id: connectionId }, data: { allAgents: true } });
  });

  it("shows the owner what it checks, then baselines, stays quiet, and wakes a tainted run once", async () => {
    fake.tools = [read("list_accounts")];
    const args = { account: "main" };
    const card = await scheduleApproval(
      deps(),
      { spaceId, botId, userId },
      "watch_create",
      {
        name: "Balance",
        instruction: "Tell me the new number.",
        tool: "list_accounts",
        arguments: args,
      },
      "UTC",
      "Fake Bank",
    );
    expect(card?.summary).toBe(
      "Checks Fake Bank list accounts every hour and tells you only when it changes",
    );
    expect(card?.detail).toContain('arguments: {"account":"main"}');

    const created = await create("Balance", "list_accounts", args);
    expect(created).toMatchObject({
      ok: true,
      watch: {
        kind: "connector",
        connectorId: "composio",
        connectionId,
        toolName: "list_accounts",
      },
    });
    const routine = await routineNamed("Balance");

    expect(await tick()).toMatchObject({ checked: 1, woke: 0 });
    expect(fake.executed).toEqual(["list_accounts"]);
    expect(await runs(routine.id)).toHaveLength(0);
    // The same data in another key order is not a change.
    fake.value = { balance: 100 };
    expect(await tick()).toMatchObject({ checked: 1, woke: 0 });
    expect(await runs(routine.id)).toHaveLength(0);

    fake.value = { balance: 90 };
    expect(await tick()).toMatchObject({ checked: 1, woke: 1 });
    const [run] = await runs(routine.id);
    expect(run).toMatchObject({ trigger: "routine", unattended: true, externalTaint: true });
    const task = await prisma.task.findUniqueOrThrow({ where: { id: run!.taskId } });
    expect(task.prompt).toContain("Tell me the new number.");
    expect(task.prompt).toContain("<untrusted_delivery_payload>");
    expect(task.prompt).toContain("90");
    expect(task.prompt).toContain("Fake Bank");
    await prisma.routine.update({ where: { id: routine.id }, data: { active: false } });
  });

  it("pauses with one notification when the grant is revoked, without calling the tool", async () => {
    fake.tools = [read("list_accounts")];
    await create("Revoked", "list_accounts");
    const routine = await routineNamed("Revoked");
    await tick(); // baseline
    const before = fake.executed.length;
    await prisma.connection.update({ where: { id: connectionId }, data: { status: "revoked" } });
    expect(await tick()).toMatchObject({ paused: 1 });
    expect(fake.executed).toHaveLength(before);
    expect(await tick()).toMatchObject({ checked: 0 });
    const notes = await prisma.notification.findMany({ where: { routineId: routine.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.title).toBe(
      "Revoked paused: the connected account is no longer available to this bot",
    );
    expect(
      (await prisma.routineWatchState.findUniqueOrThrow({ where: { routineId: routine.id } }))
        .pausedReason,
    ).toBe("access");
    await prisma.connection.update({ where: { id: connectionId }, data: { status: "connected" } });
    await prisma.routine.update({ where: { id: routine.id }, data: { active: false } });
  });

  it("pauses when the tool's declared effect is no longer read-only", async () => {
    fake.tools = [read("list_accounts")];
    await create("Flipped", "list_accounts");
    const routine = await routineNamed("Flipped");
    await tick(); // baseline
    const before = fake.executed.length;
    fake.tools = [{ ...read("list_accounts"), readOnly: false }];
    expect(await tick()).toMatchObject({ paused: 1 });
    expect(fake.executed).toHaveLength(before);
    const [note] = await prisma.notification.findMany({ where: { routineId: routine.id } });
    expect(note?.title).toBe("Flipped paused: the tool is no longer a read-only tool");
    await prisma.routine.update({ where: { id: routine.id }, data: { active: false } });
  });

  it("pauses when access is revoked after discovery but before the provider call", async () => {
    fake.tools = [read("list_accounts")];
    await create("Late", "list_accounts");
    const routine = await routineNamed("Late");
    await tick(); // baseline
    const before = fake.executed.length;
    fake.beforeExecute = async () => {
      await prisma.connection.update({ where: { id: connectionId }, data: { status: "revoked" } });
    };
    expect(await tick()).toMatchObject({ paused: 1 });
    fake.beforeExecute = undefined;
    expect(fake.executed).toHaveLength(before);
    const [note] = await prisma.notification.findMany({ where: { routineId: routine.id } });
    expect(note?.title).toBe(
      "Late paused: this connected account is no longer available to this bot",
    );
    await prisma.connection.update({ where: { id: connectionId }, data: { status: "connected" } });
  });

  it("watches a tool behind the lazy catalog and still refuses a write there", async () => {
    fake.catalog = true;
    fake.tools = [read("list_accounts"), { ...read("create_payment"), readOnly: undefined }];
    fake.value = { balance: 1 };
    expect(await create("Catalog write", "create_payment")).toHaveProperty("error");
    expect(await create("Catalog arguments", "list_accounts", { account: 5 })).toHaveProperty(
      "error",
    );
    const created = await create("Catalog", "list_accounts", { account: "main" });
    expect(created).toMatchObject({
      ok: true,
      watch: { toolName: "list_accounts", connectionId },
    });
    const routine = await routineNamed("Catalog");
    await tick(); // baseline
    fake.value = { balance: 2 };
    expect(await tick()).toMatchObject({ woke: 1 });
    expect(await runs(routine.id)).toHaveLength(1);
    expect(fake.executed.at(-1)).toBe("list_accounts");
    fake.catalog = false;
  });

  it("refuses a built-in name and a false readOnlyHint, and pauses when the hint flips", async () => {
    // A bot may have five watches; clear the earlier tests'.
    await prisma.routine.deleteMany({ where: { spaceId } });
    fake.tools = [
      { ...read("shell"), readOnly: false },
      { ...read("list_hinted"), readOnlyHint: false },
      { ...read("list_flip"), readOnlyHint: true },
    ];
    expect(await create("Shell", "shell")).toHaveProperty("error");
    expect(await create("Hinted", "list_hinted")).toHaveProperty("error");
    expect(await create("Flip", "list_flip")).toHaveProperty("ok", true);
    const routine = await routineNamed("Flip");
    await tick(); // baseline
    const before = fake.executed.length;
    fake.tools = [{ ...read("list_flip"), readOnlyHint: false }];
    expect(await tick()).toMatchObject({ paused: 1 });
    expect(fake.executed).toHaveLength(before);
    expect(
      (await prisma.notification.findMany({ where: { routineId: routine.id } }))[0]?.title,
    ).toBe("Flip paused: the tool is no longer a read-only tool");
  });

  it("starts a fresh timeout for the tool call once discovery returns", async () => {
    fake.tools = [read("list_accounts")];
    fake.value = { balance: 1 };
    await create("Budget", "list_accounts", { account: "x" });
    const spy = vi.spyOn(globalThis, "setTimeout");
    try {
      await tick();
      const budgets = spy.mock.calls.filter(([, ms]) => ms === WATCH_CONNECTOR_TIMEOUT_MS);
      // One budget for discovery, a second for the call: a slow unrelated provider cannot
      // use up the watched tool's time.
      expect(budgets.length).toBeGreaterThanOrEqual(2);
    } finally {
      spy.mockRestore();
    }
  });

  it("ignores Composio's per-execution log id when comparing results", async () => {
    fake.tools = [read("list_accounts")];
    fake.value = { data: { balance: 5 }, logId: "log_1" };
    await create("Logged", "list_accounts", { account: "x" });
    const routine = await routineNamed("Logged");
    await tick(); // baseline
    fake.value = { data: { balance: 5 }, logId: "log_2" };
    expect(await tick()).toMatchObject({ woke: 0 });
    fake.value = { data: { balance: 6 }, logId: "log_3" };
    expect(await tick()).toMatchObject({ woke: 1 });
    const [run] = await runs(routine.id);
    const task = await prisma.task.findUniqueOrThrow({ where: { id: run!.taskId } });
    expect(task.prompt).not.toContain("log_");
  });
});
