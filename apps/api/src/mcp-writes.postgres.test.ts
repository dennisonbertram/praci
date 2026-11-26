import {
  decideExternalAction,
  ExternalActionNotPending,
  expireExternalActions,
  listPendingActions,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { BLOCKED_ACTION_MESSAGE } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDb, requireMembership, runAsSystem, runAsTenant, setApprovalRule } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleMcpRequest } from "./mcp-server.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("MCP writes and approvals (PostgreSQL, runtime login)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `mcpw-org-${suffix}`;
  const [spaceA, spaceB] = [`mcpw-space-a-${suffix}`, `mcpw-space-b-${suffix}`];
  const alice = `mcpw-alice-${suffix}`;
  const client = "mcpw-client";
  const botIds: Record<string, string> = {};
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  const connect = (spaceId: string, extra = {}) =>
    runAsSystem("mcp test", () =>
      prisma.mcpConnection.create({
        data: { userId: alice, spaceId, kind: "pat", label: "writer", ...extra },
      }),
    );
  let actor: Actor;
  const rule = (matchValue: string, effect: "always_allow" | "require_approval" | "block") =>
    runAsTenant(actor, () =>
      setApprovalRule(prisma, {
        userId: alice,
        spaceId: spaceA,
        matchKind: "tool",
        matchValue,
        effect,
      }),
    );
  const clearRules = () =>
    runAsSystem("mcp test", () =>
      prisma.actionApprovalRule.deleteMany({ where: { spaceId: spaceA } }),
    );
  const rpc = async (
    connection: { id: string; readOnly: boolean },
    method: string,
    params = {},
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
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      }),
    );
    return (await response.json()) as {
      result: {
        isError?: boolean;
        content: Array<{ text: string }>;
        tools: Array<{ name: string }>;
      };
    };
  };
  const callTool = async (
    connection: { id: string; readOnly: boolean },
    name: string,
    args = {},
  ) => {
    const { result } = await rpc(connection, "tools/call", { name, arguments: args });
    return { isError: Boolean(result.isError), data: JSON.parse(result.content[0]!.text) };
  };
  const contacts = (spaceId = spaceA) =>
    runAsSystem("mcp test", () =>
      prisma.contact.findMany({ where: { spaceId, name: { startsWith: "Wendy" } } }),
    );
  const outcomes = (connectionId: string) =>
    runAsSystem("mcp test", async () =>
      (
        await prisma.mcpCallLog.findMany({ where: { connectionId }, orderBy: { createdAt: "asc" } })
      ).map((row) => [row.tool, row.outcome]),
    );

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({ data: { id: alice, name: alice, email: `${alice}@x.test` } });
    await prisma.organization.create({
      data: { id: organizationId, name: "MCP Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB].map((id) => ({ id, organizationId, name: id })),
    });
    await prisma.member.create({
      data: {
        id: `m-${alice}`,
        organizationId,
        userId: alice,
        role: "member",
        createdAt: new Date(),
      },
    });
    await prisma.spaceMember.createMany({
      data: [spaceA, spaceB].map((spaceId) => ({
        id: `sm-${spaceId}`,
        organizationId,
        spaceId,
        userId: alice,
        createdAt: new Date(),
      })),
    });
    actor = await requireMembership(prisma, alice, spaceA);
    await runAsSystem("mcp test", async () => {
      for (const spaceId of [spaceA, spaceB]) {
        botIds[spaceId] = (
          await prisma.bot.create({ data: { spaceId, userId: alice, name: "Bot", color: "blue" } })
        ).id;
      }
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: alice } });
    await close();
  });

  it("hides write tools from a read-only connection and refuses them if called", async () => {
    const readOnly = await connect(spaceA, { readOnly: true });
    const listed = (await rpc(readOnly, "tools/list")).result.tools.map((tool) => tool.name);
    expect(listed).not.toContain("contacts_add");
    expect(listed).not.toContain("scratchpad_add");
    const refused = await callTool(readOnly, "contacts_add", { name: "Wendy Readonly" });
    expect(refused).toEqual({ isError: true, data: { error: "This connection is read-only" } });
    expect(await contacts()).toHaveLength(0);
    const writer = await connect(spaceA);
    const writerTools = (await rpc(writer, "tools/list")).result.tools.map((tool) => tool.name);
    expect(writerTools).toEqual(
      expect.arrayContaining([
        "contacts_add",
        "contacts_save",
        "scratchpad_add",
        "scratchpad_update",
        "scratchpad_complete",
        "action_status",
      ]),
    );
  });

  it("asks with no rule; an explicit Allow runs it; Block refuses it", async () => {
    await clearRules();
    const writer = await connect(spaceA);
    // No rule: an outside client's write asks, even though a bot's would be allowed.
    const unruled = await callTool(writer, "contacts_add", { name: "Wendy Unruled" });
    expect(unruled.data.status).toBe("pending_approval");
    expect(await contacts()).toHaveLength(0);

    await rule("contacts_add", "always_allow");
    const allowed = await callTool(writer, "contacts_add", { name: "Wendy Allowed" });
    expect(allowed.isError).toBe(false);
    expect(allowed.data.contact.untrusted_text.name).toBe("Wendy Allowed");

    await rule("contacts_add", "require_approval");
    const asked = await callTool(writer, "contacts_add", { name: "Wendy Asked" });
    expect(asked.data).toEqual({ status: "pending_approval", actionId: expect.any(String) });
    expect((await contacts()).map((c) => c.name)).toEqual(["Wendy Allowed"]);
    const notices = await runAsSystem("mcp test", () =>
      prisma.notification.findMany({ where: { spaceId: spaceA, surface: "mcp" } }),
    );
    expect(notices.map((n) => n.title)).toContain("Approval needed");

    await rule("contacts_add", "block");
    const blocked = await callTool(writer, "contacts_add", { name: "Wendy Blocked" });
    expect(blocked).toEqual({ isError: true, data: { error: BLOCKED_ACTION_MESSAGE } });
    expect((await contacts()).map((c) => c.name)).toEqual(["Wendy Allowed"]);

    expect(await outcomes(writer.id)).toEqual([
      ["contacts_add", "pending"],
      ["contacts_add", "ok"],
      ["contacts_add", "pending"],
      ["contacts_add", "blocked"],
    ]);
    await clearRules();
  });

  it("Always allow on an approval saves a tool rule, so the next call runs", async () => {
    await clearRules();
    const writer = await connect(spaceA);
    const { data } = await callTool(writer, "contacts_add", { name: "Wendy Always" });
    await runAsTenant(actor, () =>
      decideExternalAction(prisma, actor, data.actionId, "approve", { alwaysAllow: true }),
    );
    const next = await callTool(writer, "contacts_add", { name: "Wendy Always Two" });
    expect(next.data.contact).toBeDefined();
    await clearRules();
  });

  it("asks for contacts_save even with no rule, like a bot does", async () => {
    await clearRules();
    const writer = await connect(spaceA);
    const result = await callTool(writer, "contacts_save", {
      name: "Wendy Save",
      email: "w@x.test",
    });
    expect(result.data.status).toBe("pending_approval");
  });

  it("approve runs the change once, even for two simultaneous approvals", async () => {
    await clearRules();
    await rule("contacts_add", "require_approval");
    const writer = await connect(spaceA);
    const { data } = await callTool(writer, "contacts_add", { name: "Wendy Once" });
    const decide = () =>
      runAsTenant(actor, () => decideExternalAction(prisma, actor, data.actionId, "approve")).then(
        () => "ok",
        (error) => (error instanceof ExternalActionNotPending ? "late" : String(error)),
      );
    const answers = await Promise.all([decide(), decide(), decide()]);
    expect(answers.sort()).toEqual(["late", "late", "ok"]);
    expect((await contacts()).filter((c) => c.name === "Wendy Once")).toHaveLength(1);
    const status = await callTool(writer, "action_status", { actionId: data.actionId });
    expect(status.data.status).toBe("done");
    expect(status.data.result.contact.untrusted_text.name).toBe("Wendy Once");
    await clearRules();
  });

  it("deny closes the action without running it, and it cannot be approved afterwards", async () => {
    await rule("contacts_add", "require_approval");
    const writer = await connect(spaceA);
    const { data } = await callTool(writer, "contacts_add", { name: "Wendy Denied" });
    await runAsTenant(actor, () => decideExternalAction(prisma, actor, data.actionId, "deny"));
    await expect(
      runAsTenant(actor, () => decideExternalAction(prisma, actor, data.actionId, "approve")),
    ).rejects.toBeInstanceOf(ExternalActionNotPending);
    expect((await contacts()).filter((c) => c.name === "Wendy Denied")).toHaveLength(0);
    expect((await callTool(writer, "action_status", { actionId: data.actionId })).data.status).toBe(
      "denied",
    );
    await clearRules();
  });

  it("expires an action after 24 hours and then cannot approve it", async () => {
    await rule("contacts_add", "require_approval");
    const writer = await connect(spaceA);
    const { data } = await callTool(writer, "contacts_add", { name: "Wendy Expired" });
    const old = new Date(Date.now() - 25 * 3_600_000);
    await runAsSystem("mcp test", () =>
      prisma.externalAction.update({ where: { id: data.actionId }, data: { createdAt: old } }),
    );
    const waiting = await runAsTenant(actor, () => listPendingActions(prisma, actor));
    expect(waiting.map((action) => action.id)).not.toContain(data.actionId);
    await expireExternalActions(prisma);
    expect((await callTool(writer, "action_status", { actionId: data.actionId })).data.status).toBe(
      "expired",
    );
    await expect(
      runAsTenant(actor, () => decideExternalAction(prisma, actor, data.actionId, "approve")),
    ).rejects.toBeInstanceOf(ExternalActionNotPending);
    expect((await contacts()).filter((c) => c.name === "Wendy Expired")).toHaveLength(0);
    await clearRules();
  });

  it("shows an action's state only to the connection that made it", async () => {
    await rule("contacts_add", "require_approval");
    const first = await connect(spaceA);
    const second = await connect(spaceA);
    const { data } = await callTool(first, "contacts_add", { name: "Wendy Private" });
    expect((await callTool(first, "action_status", { actionId: data.actionId })).data.status).toBe(
      "pending",
    );
    expect(await callTool(second, "action_status", { actionId: data.actionId })).toEqual({
      isError: true,
      data: { error: "Action not found" },
    });
    await clearRules();
  });

  it("scratchpad writes take the member's own agent and refuse another Space's", async () => {
    await rule("scratchpad_add", "always_allow");
    await rule("scratchpad_complete", "always_allow");

    const writer = await connect(spaceA);
    const added = await callTool(writer, "scratchpad_add", {
      botId: botIds[spaceA],
      title: "Call the lawyer",
      category: "public_post",
    });
    expect(added.isError).toBe(false);
    const item = await runAsSystem("mcp test", () =>
      prisma.scratchpadItem.findFirstOrThrow({ where: { spaceId: spaceA } }),
    );
    // The client cannot set a gated category.
    expect(item.category).toBeNull();
    const done = await callTool(writer, "scratchpad_complete", {
      botId: botIds[spaceA],
      itemId: item.id,
    });
    expect(done.isError).toBe(false);
    const other = await callTool(writer, "scratchpad_add", { botId: botIds[spaceB], title: "x" });
    expect(other).toEqual({ isError: true, data: { error: "Agent not found" } });
  });
});
