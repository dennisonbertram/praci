import { BLOCKED_ACTION_MESSAGE } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decideExternalAction, submitMcpWrite } from "./external-actions.js";

const rulesMock = vi.hoisted(() => vi.fn());
const setRuleMock = vi.hoisted(() => vi.fn());
const callWriteMock = vi.hoisted(() => vi.fn());
vi.mock("@rakazo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@rakazo/db")>()),
  listApprovalRules: rulesMock,
  setApprovalRule: setRuleMock,
}));
vi.mock("./mcp-read-tools.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./mcp-read-tools.js")>()),
  callMcpWriteTool: callWriteMock,
}));

const caller = { spaceId: "space-1", userId: "user-1", connectionId: "conn-1" };

function fakePrisma(
  bot: { id: string } | null = { id: "bot-1" },
  permissionLevel: string | null = null,
) {
  const create = vi.fn(async () => ({ id: "action-1" }));
  const findLevel = vi.fn(async () => ({ permissionLevel }));
  const prisma = {
    bot: { findFirst: vi.fn(async () => bot) },
    externalAction: { count: vi.fn(async () => 0), create },
    mcpConnection: { findFirst: vi.fn(async () => null) },
    actionAutoReviewPreference: { findUnique: findLevel },
  } as unknown as PrismaClient;
  return { prisma, create, findLevel };
}

describe("submitMcpWrite preflight", () => {
  it("rejects agent_send without a message", async () => {
    rulesMock.mockResolvedValue([]);
    const { prisma, create } = fakePrisma();
    const out = await submitMcpWrite(prisma, caller, "agent_send", { botId: "bot-1" });
    expect(out).toEqual({ outcome: "error", result: { error: "message is required" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an over-long message", async () => {
    rulesMock.mockResolvedValue([]);
    const { prisma, create } = fakePrisma();
    const out = await submitMcpWrite(prisma, caller, "agent_send", {
      botId: "bot-1",
      message: "a".repeat(10_001),
    });
    expect(out).toEqual({ outcome: "error", result: { error: "message is too long" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects an unknown agent", async () => {
    rulesMock.mockResolvedValue([]);
    const { prisma, create } = fakePrisma(null);
    const out = await submitMcpWrite(prisma, caller, "agent_send", {
      botId: "nope",
      message: "hi",
    });
    expect(out).toEqual({ outcome: "error", result: { error: "Agent not found" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects scratchpad_add without a title", async () => {
    rulesMock.mockResolvedValue([]);
    const { prisma, create } = fakePrisma();
    const out = await submitMcpWrite(prisma, caller, "scratchpad_add", { botId: "bot-1" });
    expect(out).toEqual({ outcome: "error", result: { error: "title is required" } });
    expect(create).not.toHaveBeenCalled();
  });

  it("still queues a valid call", async () => {
    rulesMock.mockResolvedValue([]);
    const { prisma, create } = fakePrisma();
    const out = await submitMcpWrite(prisma, caller, "agent_send", {
      botId: "bot-1",
      message: "hi",
    });
    expect(out).toEqual({
      outcome: "pending",
      result: { status: "pending_approval", actionId: "action-1" },
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("a Block rule wins over a failed check", async () => {
    rulesMock.mockResolvedValue([{ matchKind: "tool", matchValue: "agent_send", effect: "block" }]);
    const { prisma } = fakePrisma();
    const out = await submitMcpWrite(prisma, caller, "agent_send", {});
    expect(out).toEqual({ outcome: "blocked", result: { error: BLOCKED_ACTION_MESSAGE } });
  });
});

describe("submitMcpWrite hard lines", () => {
  it("stores a hard-line call for the member despite an always-allow rule", async () => {
    rulesMock.mockResolvedValue([
      { matchKind: "tool", matchValue: "forget_memory", effect: "always_allow" },
    ]);
    const { prisma, create } = fakePrisma();
    const out = await submitMcpWrite(prisma, caller, "forget_memory" as never, { query: "all" });
    expect(out).toEqual({
      outcome: "pending",
      result: { status: "pending_approval", actionId: "action-1" },
    });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("decideExternalAction always allow", () => {
  it("saves no rule for a hard-line call", async () => {
    setRuleMock.mockReset();
    const action = {
      id: "action-1",
      tool: "forget_memory",
      args: {},
      spaceId: "space-1",
      userId: "user-1",
      connectionId: "conn-1",
    };
    const prisma = {
      externalAction: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirstOrThrow: vi.fn(async () => action),
        update: vi.fn(async () => ({})),
      },
    } as unknown as PrismaClient;
    await decideExternalAction(prisma, caller, "action-1", "approve", { alwaysAllow: true });
    expect(setRuleMock).not.toHaveBeenCalled();
  });

  it("still runs the approved action when saving the rule fails", async () => {
    setRuleMock.mockRejectedValue(new Error("db down"));
    const action = {
      id: "action-1",
      tool: "agent_send",
      args: {},
      spaceId: "space-1",
      userId: "user-1",
      connectionId: "conn-1",
    };
    const update = vi.fn(async () => ({}));
    const prisma = {
      externalAction: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirstOrThrow: vi.fn(async () => action),
        update,
      },
    } as unknown as PrismaClient;
    const out = await decideExternalAction(prisma, caller, "action-1", "approve", {
      alwaysAllow: true,
    });
    expect(setRuleMock).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    expect(["done", "failed"]).toContain(out.status);
  });
});

describe("submitMcpWrite and the permission level", () => {
  const allow = [{ matchKind: "tool", matchValue: "agent_send", effect: "always_allow" }];
  const args = { botId: "bot-1", message: "hi" };

  beforeEach(() => {
    callWriteMock.mockReset().mockResolvedValue({ ok: true });
  });

  it("runs a saved Allow under a level that permits it", async () => {
    rulesMock.mockResolvedValue(allow);
    const { prisma, create } = fakePrisma({ id: "bot-1" }, "open");
    const out = await submitMcpWrite(prisma, caller, "agent_send", args);
    expect(callWriteMock).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ outcome: "ok", result: { ok: true } });
    expect(create).not.toHaveBeenCalled();
  });

  it("stores a saved Allow for the member under Ask for everything", async () => {
    rulesMock.mockResolvedValue(allow);
    const { prisma, create } = fakePrisma({ id: "bot-1" }, "ask_everything");
    const out = await submitMcpWrite(prisma, caller, "agent_send", args);
    expect(out).toEqual({
      outcome: "pending",
      result: { status: "pending_approval", actionId: "action-1" },
    });
    expect(callWriteMock).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("stores a saved Allow whose level could not be read", async () => {
    rulesMock.mockResolvedValue(allow);
    const { prisma, create, findLevel } = fakePrisma({ id: "bot-1" }, "open");
    findLevel.mockRejectedValue(new Error("db down"));
    const out = await submitMcpWrite(prisma, caller, "agent_send", args);
    expect(out).toEqual({
      outcome: "pending",
      result: { status: "pending_approval", actionId: "action-1" },
    });
    expect(callWriteMock).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
