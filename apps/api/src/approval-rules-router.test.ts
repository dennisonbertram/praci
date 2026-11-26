import { RPCHandler } from "@orpc/server/fetch";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

// Offline boundary: a fake Prisma client drives the real handlers and the real repos.getBot check.
const actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "user@rakazo.test",
  isDeploymentOwner: true,
} satisfies Actor;

type RuleRow = {
  id: string;
  spaceId: string;
  createdByUserId: string;
  effect: string;
  matchKind: string;
  matchValue: string;
  botId: string | null;
  routineId: string | null;
  createdAt: Date;
};

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") {
      return (condition as Record<string, unknown>[]).some((branch) => matches(row, branch));
    }
    if (condition && typeof condition === "object" && "not" in condition) {
      return row[key] !== (condition as { not: unknown }).not;
    }
    if (condition && typeof condition === "object" && "equals" in condition) {
      return (
        String(row[key]).toLowerCase() ===
        String((condition as { equals: unknown }).equals).toLowerCase()
      );
    }
    return row[key] === condition;
  });
}

function setup(seed: RuleRow[] = []) {
  const bots = [
    { id: "bot-1", userId: "user-1", spaceId: "space-1", name: "Researcher", archivedAt: null },
    {
      id: "bot-firewalled",
      userId: "user-1",
      spaceId: "space-1",
      name: "Gatekeeper",
      archivedAt: null,
      firewall: true,
      permissionLevel: "open",
    },
    { id: "bot-other-user", userId: "user-2", spaceId: "space-1", archivedAt: null },
    { id: "bot-other-space", userId: "user-1", spaceId: "space-2", archivedAt: null },
  ];
  const rows = [...seed];
  const rule = {
    findMany: vi.fn(
      async (args: { where: Record<string, unknown>; include?: Record<string, unknown> }) =>
        rows
          .filter((row) => matches(row as unknown as Record<string, unknown>, args.where))
          .map((row) => {
            const bot = bots.find((entry) => entry.id === row.botId);
            return {
              ...row,
              ...(args.include?.bot ? { bot: bot ? { name: bot.name } : null } : {}),
              ...(args.include?.routine ? { routine: null } : {}),
            };
          }),
    ),
    deleteMany: vi.fn(async (args: { where: Record<string, unknown> }) => {
      const kept = rows.filter(
        (row) => !matches(row as unknown as Record<string, unknown>, args.where),
      );
      const count = rows.length - kept.length;
      rows.splice(0, rows.length, ...kept);
      return { count };
    }),
    create: vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "rule-new",
      botId: null,
      routineId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      ...args.data,
    })),
  };
  const prisma = {
    bot: {
      findFirst: vi.fn(async (args: { where: Record<string, unknown> }) => {
        const bot = bots.find((entry) =>
          Object.entries(args.where).every(
            ([key, value]) =>
              key === "archivedAt" || (entry as Record<string, unknown>)[key] === value,
          ),
        );
        return bot ? { ...bot, thread: null, computer: null } : null;
      }),
    },
    actionAutoReviewPreference: { findUnique: vi.fn(async () => ({ permissionLevel: "open" })) },
    actionApprovalRule: rule,
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ actionApprovalRule: rule })),
  };
  const handler = new RPCHandler(
    createRouter({
      prisma: prisma as unknown as PrismaClient,
      secrets: {},
      env: {
        defaultProvider: "fake",
        defaultModel: "fake-model",
        webOrigin: "http://127.0.0.1:5173",
        screenProxySecret: "fake-test-secret",
        sandboxProvider: "fake",
      },
      dataDir: "/tmp/rakazo-router-test",
    } as unknown as RouterDeps),
  );
  async function call(
    path: "table" | "setActionType" | "list" | "remove" | "set",
    input?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    const { response } = await handler.handle(
      new Request(`http://127.0.0.1/rpc/approvalRules/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json: input ?? {} }),
      }),
      { prefix: "/rpc", context: { actor } },
    );
    if (!response) throw new Error("Procedure did not match");
    const body = response.ok ? ((await response.json()) as { json?: unknown }) : null;
    return { status: response.status, json: body ? body.json : null };
  }
  return { rule, rows, call };
}

const botRule = (overrides: Partial<RuleRow> = {}): RuleRow => ({
  id: "rule-sites",
  spaceId: "space-1",
  createdByUserId: "user-1",
  effect: "always_allow",
  matchKind: "tool",
  matchValue: "web_fetch",
  botId: "bot-1",
  routineId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("approvalRules router", () => {
  it("rejects a bot of another user or space and a missing bot before touching rules", async () => {
    const { rule, call } = setup();
    for (const botId of ["bot-other-user", "bot-other-space", "missing"]) {
      expect((await call("table", { botId })).status).toBeGreaterThanOrEqual(400);
      expect(
        (await call("setActionType", { botId, actionType: "send_email", effect: "block" })).status,
      ).toBeGreaterThanOrEqual(400);
    }
    expect(rule.findMany).not.toHaveBeenCalled();
    expect(rule.deleteMany).not.toHaveBeenCalled();
    expect(rule.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown action type or effect", async () => {
    const { rule, call } = setup();
    expect((await call("setActionType", { actionType: "nope", effect: "allow" })).status).toBe(400);
    expect(
      (await call("setActionType", { actionType: "send_email", effect: "maybe" })).status,
    ).toBe(400);
    expect(rule.create).not.toHaveBeenCalled();
  });

  it("rejects Allow for an always-ask type, which the gate can never honor", async () => {
    const { call } = setup();
    for (const input of [
      { actionType: "spend_money", effect: "allow" },
      { actionType: "spend_money", effect: "allow", botId: "bot-1" },
    ]) {
      expect((await call("setActionType", input)).status).toBe(400);
    }
    // Ask and Block (and clearing) stay supported, as is Allow on a type that can allow.
    for (const effect of ["ask", "block", null]) {
      expect((await call("setActionType", { actionType: "spend_money", effect })).status).toBe(200);
    }
    expect(
      (await call("setActionType", { actionType: "send_email", effect: "allow" })).status,
    ).toBe(200);
  });

  it("rejects a category Allow for an always-ask type, legacy alias included", async () => {
    const { call } = setup();
    for (const matchValue of ["spend_money", "purchase"]) {
      expect(
        (await call("set", { matchKind: "category", matchValue, effect: "always_allow" })).status,
      ).toBe(400);
    }
    // The same category still takes Ask and Block.
    for (const effect of ["require_approval", "block"]) {
      expect(
        (await call("set", { matchKind: "category", matchValue: "spend_money", effect })).status,
      ).toBe(200);
    }
    expect(
      (
        await call("set", {
          matchKind: "category",
          matchValue: "send_email",
          effect: "always_allow",
        })
      ).status,
    ).toBe(200);
  });

  it("reads the table for the caller's own bot", async () => {
    const { call } = setup();
    expect((await call("table", { botId: "bot-1" })).status).toBe(200);
  });

  it("shows the gate's decision at the level the executor resolves", async () => {
    const { call } = setup();
    const space = (await call("table")).json as {
      level: string;
      rows: { actionType: string; effect: string }[];
    };
    expect(space.level).toBe("open");
    expect(space.rows.find((row) => row.actionType === "calendar_changes")?.effect).toBe("allow");
    // A Firewalled agent is held to Ask for changes even when its own level is open.
    const bot = (await call("table", { botId: "bot-firewalled" })).json as typeof space;
    expect(bot.level).toBe("ask_changes");
    expect(bot.rows.find((row) => row.actionType === "calendar_changes")?.effect).toBe("ask");
  });

  it("names the agent on an Allow all sites rule", async () => {
    const { call } = setup([botRule()]);
    const { status, json } = await call("list");
    expect(status).toBe(200);
    expect(json).toEqual([
      expect.objectContaining({
        id: "rule-sites",
        matchKind: "tool",
        matchValue: "web_fetch",
        botId: "bot-1",
        botName: "Researcher",
      }),
    ]);
  });

  it("lists and removes only the caller's own rules in the caller's space", async () => {
    const mine = botRule({ id: "rule-mine" });
    const otherUser = botRule({ id: "rule-other-user", createdByUserId: "user-2" });
    const otherSpace = botRule({ id: "rule-other-space", spaceId: "space-2" });
    const { rule, rows, call } = setup([mine, otherUser, otherSpace]);

    const listed = await call("list");
    expect(listed.status).toBe(200);
    expect((listed.json as { id: string }[]).map((row) => row.id)).toEqual(["rule-mine"]);
    for (const args of rule.findMany.mock.calls) {
      expect(args?.[0].where).toMatchObject({ spaceId: "space-1", createdByUserId: "user-1" });
    }

    expect((await call("remove", { id: "rule-other-user" })).status).toBe(200);
    expect(rows.map((row) => row.id)).toContain("rule-other-user");
    for (const args of rule.deleteMany.mock.calls) {
      expect(args[0].where).toMatchObject({ spaceId: "space-1", createdByUserId: "user-1" });
    }

    expect((await call("remove", { id: "rule-mine" })).status).toBe(200);
    expect(rows.map((row) => row.id)).toEqual(["rule-other-user", "rule-other-space"]);
  });

  it("stores a site rule as its normalized site and drops the raw legacy row", async () => {
    const legacy = botRule({
      id: "legacy",
      botId: null,
      matchKind: "site",
      matchValue: "https://www.Example.com/a",
    });
    const { rule, rows, call } = setup([legacy]);
    const { status } = await call("set", {
      matchKind: "site",
      matchValue: "https://www.Example.com/a",
      effect: "block",
    });
    expect(status).toBe(200);
    expect(rule.create.mock.calls[0]?.[0].data).toMatchObject({ matchValue: "example.com" });
    expect(rows.map((row) => row.id)).not.toContain("legacy");
  });

  it("rejects a site that is not a host and a category that is not an action type", async () => {
    const { rule, call } = setup();
    expect(
      (await call("set", { matchKind: "site", matchValue: "not a host", effect: "block" })).status,
    ).toBe(400);
    expect(
      (await call("set", { matchKind: "category", matchValue: "nope", effect: "block" })).status,
    ).toBe(400);
    expect(rule.create).not.toHaveBeenCalled();
  });

  it("still accepts the legacy email category", async () => {
    const { rule, call } = setup();
    const { status } = await call("set", {
      matchKind: "category",
      matchValue: "email",
      effect: "block",
    });
    expect(status).toBe(200);
    expect(rule.create.mock.calls[0]?.[0].data).toMatchObject({ matchValue: "email" });
  });
});
